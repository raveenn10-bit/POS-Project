//
//  BLEPrinterManager.swift
//  HarshApexPrinter
//
//  Created for Harsh Apex POS Companion on iOS.
//  CoreBluetooth manager for ESC/POS BLE thermal receipt printers with
//  automatic MTU discovery, chunked flow-controlled writes, and auto-reconnect.
//

import Foundation
import CoreBluetooth
import Combine

public struct DiscoveredPrinter: Identifiable, Equatable {
    public var id: UUID { peripheral.identifier }
    public let peripheral: CBPeripheral
    public var name: String
    public var rssi: Int
    public var isRecognizedThermalPrinter: Bool

    public static func == (lhs: DiscoveredPrinter, rhs: DiscoveredPrinter) -> Bool {
        lhs.peripheral.identifier == rhs.peripheral.identifier
    }
}

public enum PrinterConnectionState: Equatable {
    case disconnected
    case scanning
    case connecting(name: String)
    case connected(name: String)
    case error(message: String)
}

public final class BLEPrinterManager: NSObject, ObservableObject {

    // MARK: - Known ESC/POS BLE Thermal Printer Service UUIDs
    public static let knownServiceUUIDs: [CBUUID] = [
        CBUUID(string: "000018f0-0000-1000-8000-00805f9b34fb"), // Standard 18F0
        CBUUID(string: "18F0"),
        CBUUID(string: "E7810A71-73AE-499D-8C15-FAA9AEF0C3F2"), // Common POS-58 / XP-58
        CBUUID(string: "49535343-FE7D-4AE5-8FA9-9FAFD205E455"), // ISSC Transparent UART
        CBUUID(string: "0000FF00-0000-1000-8000-00805F9B34FB"), // FF00 custom
        CBUUID(string: "FF00"),
        CBUUID(string: "0000AE00-0000-1000-8000-00805F9B34FB"), // AE00 custom
        CBUUID(string: "0000E781-0000-1000-8000-00805F9B34FB"),
        CBUUID(string: "000018F1-0000-1000-8000-00805F9B34FB")
    ]

    // MARK: - Published Properties
    @Published public private(set) var connectionState: PrinterConnectionState = .disconnected
    @Published public private(set) var isScanning: Bool = false
    @Published public private(set) var discoveredPrinters: [DiscoveredPrinter] = []
    @Published public private(set) var connectedPrinter: DiscoveredPrinter? = nil
    @Published public private(set) var isPrinting: Bool = false
    @Published public private(set) var printProgress: Double = 0.0
    @Published public var lastErrorMessage: String? = nil
    @Published public var negotiatedMTU: Int = 20

    // MARK: - CoreBluetooth Objects
    private var centralManager: CBCentralManager!
    private var activePeripheral: CBPeripheral?
    private var writeCharacteristic: CBCharacteristic?
    private var writeType: CBCharacteristicWriteType = .withoutResponse

    // MARK: - Write Queue & Flow Control
    private var sendQueue: [Data] = []
    private var currentPrintCompletion: ((Result<Void, Error>) -> Void)?
    private var totalBytesToPrint: Int = 0
    private var bytesPrintedSoFar: Int = 0
    private let writeQueueDispatch = DispatchQueue(label: "lk.harshapex.printer.writequeue")
    private var isSendingChunk: Bool = false

    // MARK: - Persistence Keys
    private let lastPrinterUUIDKey = "lk.harshapex.lastPrinterUUID"

    public override init() {
        super.init()
        self.centralManager = CBCentralManager(
            delegate: self,
            queue: DispatchQueue.main,
            options: [CBCentralManagerOptionShowPowerAlertKey: true]
        )
    }

    // MARK: - Scanning Controls

    public func startScan(filterKnownOnly: Bool = false) {
        guard centralManager.state == .poweredOn else {
            lastErrorMessage = "Bluetooth is not powered on or authorized."
            return
        }

        discoveredPrinters.removeAll()
        isScanning = true
        connectionState = .scanning

        let servicesToScan: [CBUUID]? = filterKnownOnly ? BLEPrinterManager.knownServiceUUIDs : nil
        centralManager.scanForPeripherals(
            withServices: servicesToScan,
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        )
    }

    public func stopScan() {
        if isScanning {
            centralManager.stopScan()
            isScanning = false
            if case .scanning = connectionState {
                connectionState = .disconnected
            }
        }
    }

    // MARK: - Connection Management

    public func connect(to printer: DiscoveredPrinter) {
        stopScan()
        connectionState = .connecting(name: printer.name)
        activePeripheral = printer.peripheral
        activePeripheral?.delegate = self
        centralManager.connect(printer.peripheral, options: nil)
    }

    public func disconnect() {
        if let p = activePeripheral {
            centralManager.cancelPeripheralConnection(p)
        }
        activePeripheral = nil
        writeCharacteristic = nil
        connectedPrinter = nil
        connectionState = .disconnected
    }

    private func saveLastConnected(uuid: UUID) {
        UserDefaults.standard.set(uuid.uuidString, forKey: lastPrinterUUIDKey)
    }

    public func attemptAutoReconnect() {
        guard let savedString = UserDefaults.standard.string(forKey: lastPrinterUUIDKey),
              let uuid = UUID(uuidString: savedString) else { return }

        let known = centralManager.retrievePeripherals(withIdentifiers: [uuid])
        if let peripheral = known.first {
            let printer = DiscoveredPrinter(
                peripheral: peripheral,
                name: peripheral.name ?? "Saved Thermal Printer",
                rssi: 0,
                isRecognizedThermalPrinter: true
            )
            connect(to: printer)
        }
    }

    // MARK: - Print Execution & MTU Management

    /// Transmits raw ESC/POS byte sequence with adaptive MTU sizing and packet pacing
    public func sendData(_ data: Data, completion: @escaping (Result<Void, Error>) -> Void) {
        guard let peripheral = activePeripheral,
              let characteristic = writeCharacteristic,
              connectionState == .connected(name: peripheral.name ?? "Printer") else {
            completion(.failure(NSError(domain: "BLEPrinter", code: -1, userInfo: [NSLocalizedDescriptionKey: "No printer currently connected"])))
            return
        }

        // Determine optimal write MTU
        let maxMtu = peripheral.maximumWriteValueLength(for: writeType)
        // Leave a safety margin (CoreBluetooth uses 3 bytes for ATT headers; standard BLE payload is typically 20 to 182 bytes)
        let safeChunkSize = max(20, min(maxMtu, 140))
        self.negotiatedMTU = safeChunkSize

        writeQueueDispatch.async { [weak self] in
            guard let self = self else { return }
            self.totalBytesToPrint = data.count
            self.bytesPrintedSoFar = 0

            var chunks: [Data] = []
            var offset = 0
            while offset < data.count {
                let chunkSize = min(safeChunkSize, data.count - offset)
                let chunk = data.subdata(in: offset..<(offset + chunkSize))
                chunks.append(chunk)
                offset += chunkSize
            }

            DispatchQueue.main.async {
                self.sendQueue = chunks
                self.currentPrintCompletion = completion
                self.isPrinting = true
                self.printProgress = 0.0
                self.dispatchNextChunk()
            }
        }
    }

    private func dispatchNextChunk() {
        guard let peripheral = activePeripheral,
              let characteristic = writeCharacteristic else {
            finalizePrint(result: .failure(NSError(domain: "BLEPrinter", code: -2, userInfo: [NSLocalizedDescriptionKey: "Printer disconnected during transmission"])))
            return
        }

        guard !sendQueue.isEmpty else {
            finalizePrint(result: .success(()))
            return
        }

        let chunk = sendQueue.removeFirst()
        bytesPrintedSoFar += chunk.count
        printProgress = totalBytesToPrint > 0 ? Double(bytesPrintedSoFar) / Double(totalBytesToPrint) : 1.0

        if writeType == .withResponse {
            // Write with confirmation callback
            peripheral.writeValue(chunk, for: characteristic, type: .withResponse)
            // Next chunk will be triggered in peripheral(_:didWriteValueFor:error:)
        } else {
            // Write without response: inject small pacing delay (15ms) to prevent thermal printer buffer overrun
            peripheral.writeValue(chunk, for: characteristic, type: .withoutResponse)
            DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(15)) { [weak self] in
                self?.dispatchNextChunk()
            }
        }
    }

    private func finalizePrint(result: Result<Void, Error>) {
        isPrinting = false
        printProgress = 1.0
        let completion = currentPrintCompletion
        currentPrintCompletion = nil
        sendQueue.removeAll()
        completion?(result)
    }
}

// MARK: - CBCentralManagerDelegate
extension BLEPrinterManager: CBCentralManagerDelegate {

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            attemptAutoReconnect()
        case .poweredOff:
            connectionState = .error(message: "Bluetooth is switched off. Please enable Bluetooth.")
        case .unauthorized:
            connectionState = .error(message: "Bluetooth permission denied. Grant permission in Settings.")
        case .unsupported:
            connectionState = .error(message: "Bluetooth Low Energy is not supported on this device.")
        case .resetting:
            connectionState = .error(message: "Bluetooth hardware resetting...")
        case .unknown:
            break
        @unknown default:
            break
        }
    }

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? "Unknown Device"
        guard !name.isEmpty && name != "Unknown Device" else { return }

        // Check if advertising known thermal printer UUIDs
        let advertisedUUIDs = advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] ?? []
        let hasPrinterService = advertisedUUIDs.contains { BLEPrinterManager.knownServiceUUIDs.contains($0) }
        let looksLikePrinterName = name.localizedCaseInsensitiveContains("pos") ||
                                   name.localizedCaseInsensitiveContains("print") ||
                                   name.localizedCaseInsensitiveContains("rp") ||
                                   name.localizedCaseInsensitiveContains("xp") ||
                                   name.localizedCaseInsensitiveContains("mpt") ||
                                   name.localizedCaseInsensitiveContains("thermal")

        let printer = DiscoveredPrinter(
            peripheral: peripheral,
            name: name,
            rssi: RSSI.intValue,
            isRecognizedThermalPrinter: hasPrinterService || looksLikePrinterName
        )

        if let index = discoveredPrinters.firstIndex(where: { $0.id == printer.id }) {
            discoveredPrinters[index].name = printer.name
            discoveredPrinters[index].rssi = printer.rssi
        } else {
            discoveredPrinters.append(printer)
            // Sort: recognized printers first, then by strongest RSSI
            discoveredPrinters.sort {
                if $0.isRecognizedThermalPrinter != $1.isRecognizedThermalPrinter {
                    return $0.isRecognizedThermalPrinter && !$1.isRecognizedThermalPrinter
                }
                return $0.rssi > $1.rssi
            }
        }
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        activePeripheral = peripheral
        peripheral.delegate = self
        let printer = DiscoveredPrinter(
            peripheral: peripheral,
            name: peripheral.name ?? "Thermal Printer",
            rssi: 0,
            isRecognizedThermalPrinter: true
        )
        connectedPrinter = printer
        saveLastConnected(uuid: peripheral.identifier)

        // Discover services
        peripheral.discoverServices(nil)
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        connectionState = .error(message: "Failed to connect: \(error?.localizedDescription ?? "Unknown error")")
        activePeripheral = nil
        connectedPrinter = nil
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        connectionState = .disconnected
        activePeripheral = nil
        writeCharacteristic = nil
        connectedPrinter = nil
        if let err = error {
            lastErrorMessage = "Printer disconnected: \(err.localizedDescription)"
        }
    }
}

// MARK: - CBPeripheralDelegate
extension BLEPrinterManager: CBPeripheralDelegate {

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard error == nil, let services = peripheral.services else {
            connectionState = .error(message: "Service discovery failed.")
            return
        }

        for service in services {
            // Discover all characteristics for each service
            peripheral.discoverCharacteristics(nil, for: service)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard error == nil, let characteristics = service.characteristics else { return }

        for characteristic in characteristics {
            let props = characteristic.properties

            // Priority: writeWithoutResponse gives faster throughput on thermal printers
            if props.contains(.writeWithoutResponse) {
                self.writeCharacteristic = characteristic
                self.writeType = .withoutResponse
                self.connectionState = .connected(name: peripheral.name ?? "Printer")
                self.negotiatedMTU = peripheral.maximumWriteValueLength(for: .withoutResponse)
                return
            } else if props.contains(.write) {
                self.writeCharacteristic = characteristic
                self.writeType = .withResponse
                self.connectionState = .connected(name: peripheral.name ?? "Printer")
                self.negotiatedMTU = peripheral.maximumWriteValueLength(for: .withResponse)
                return
            }
        }

        // If no write characteristic found in this service, continue searching remaining services
        if self.writeCharacteristic == nil {
            for s in peripheral.services ?? [] {
                if s.characteristics == nil {
                    peripheral.discoverCharacteristics(nil, for: s)
                }
            }
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        if let err = error {
            finalizePrint(result: .failure(err))
            return
        }
        if writeType == .withResponse {
            dispatchNextChunk()
        }
    }
}
