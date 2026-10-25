//
//  ContentView.swift
//  HarshApexPrinter
//
//  Created for Harsh Apex POS Companion on iOS.
//  Main user interface for BLE scanning, connection, ESC/POS diagnostics,
//  test prints, and deep link monitoring.
//

import SwiftUI

public struct ContentView: View {
    @ObservedObject var printerManager: BLEPrinterManager
    @ObservedObject var deepLinkHandler: DeepLinkPrintHandler

    @State private var manualText: String = "Harsh Apex POS Test\nColombo, Sri Lanka\n"
    @State private var manualHex: String = "1B 40 1B 61 01 48 61 72 73 68 20 41 70 65 78 0A 1D 56 42 00"
    @State private var is80mm: Bool = false
    @State private var selectedTab: Int = 0
    @State private var toastMessage: String? = nil
    @State private var showToast: Bool = false

    public init(printerManager: BLEPrinterManager, deepLinkHandler: DeepLinkPrintHandler) {
        self.printerManager = printerManager
        self.deepLinkHandler = deepLinkHandler
    }

    public var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Top Branding Header
                headerView

                // Tab Selector
                Picker("Section", selection: $selectedTab) {
                    Text("Printer").tag(0)
                    Text("Diagnostics").tag(1)
                    Text("Jobs (\(deepLinkHandler.recentJobs.count))").tag(2)
                }
                .pickerStyle(SegmentedPickerStyle())
                .padding(.horizontal)
                .padding(.vertical, 8)

                // Tab Content
                ScrollView {
                    VStack(spacing: 16) {
                        if selectedTab == 0 {
                            printerTab
                        } else if selectedTab == 1 {
                            diagnosticsTab
                        } else {
                            jobsTab
                        }
                    }
                    .padding()
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(statusColor)
                            .frame(width: 10, height: 10)
                        Text("Harsh Apex Printer")
                            .font(.headline)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        if printerManager.isScanning {
                            printerManager.stopScan()
                        } else {
                            printerManager.startScan()
                        }
                    }) {
                        Image(systemName: printerManager.isScanning ? "stop.circle.fill" : "arrow.clockwise.circle")
                            .imageScale(.large)
                    }
                }
            }
            .alert(isPresented: $deepLinkHandler.showJobNotification) {
                Alert(
                    title: Text("POS Print Notice"),
                    message: Text(deepLinkHandler.activeAlertMessage ?? ""),
                    dismissButton: .default(Text("OK"))
                )
            }
        }
    }

    // MARK: - Header
    private var headerView: some View {
        VStack(spacing: 4) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("HARSH APEX DIGITAL")
                        .font(.caption2)
                        .fontWeight(.heavy)
                        .foregroundColor(.blue)
                        .tracking(1.2)
                    Text(statusTitle)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)
                }
                Spacer()

                if case .connected = printerManager.connectionState {
                    Button("Disconnect") {
                        printerManager.disconnect()
                    }
                    .font(.footnote)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.red.opacity(0.15))
                    .foregroundColor(.red)
                    .cornerRadius(8)
                }
            }
            .padding(.horizontal)
            .padding(.top, 8)

            if printerManager.isPrinting {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Printing ESC/POS stream...")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("\(Int(printerManager.printProgress * 100))%")
                            .font(.caption2)
                            .fontWeight(.bold)
                    }
                    ProgressView(value: printerManager.printProgress)
                        .progressViewStyle(LinearProgressViewStyle(tint: .blue))
                }
                .padding(.horizontal)
                .padding(.top, 4)
            }
        }
        .padding(.bottom, 6)
        .background(Color(.systemBackground))
    }

    // MARK: - Tab 1: Printer Connection & Actions
    private var printerTab: some View {
        VStack(spacing: 16) {
            // Connected Device Card
            if let connected = printerManager.connectedPrinter {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "printer.fill")
                            .font(.title2)
                            .foregroundColor(.green)
                        VStack(alignment: .leading) {
                            Text(connected.name)
                                .font(.headline)
                            Text("UUID: \(connected.id.uuidString.prefix(8))... (MTU: \(printerManager.negotiatedMTU) bytes)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Text("ONLINE")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.green.opacity(0.2))
                            .foregroundColor(.green)
                            .cornerRadius(6)
                    }

                    Divider()

                    // Quick Actions
                    HStack(spacing: 12) {
                        Button(action: printSampleReceipt) {
                            HStack {
                                Image(systemName: "doc.plaintext")
                                Text("Print Test Receipt")
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                        }

                        Button(action: kickDrawer) {
                            HStack {
                                Image(systemName: "tray.full")
                                Text("Drawer")
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Color.orange.opacity(0.15))
                            .foregroundColor(.orange)
                            .cornerRadius(8)
                        }
                    }
                }
                .padding()
                .background(Color(.systemBackground))
                .cornerRadius(12)
                .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
            }

            // Paper Config Card
            HStack {
                Text("Receipt Width")
                    .font(.subheadline)
                    .fontWeight(.medium)
                Spacer()
                Picker("Paper Width", selection: $is80mm) {
                    Text("58mm (32 Col)").tag(false)
                    Text("80mm (48 Col)").tag(true)
                }
                .pickerStyle(SegmentedPickerStyle())
                .frame(width: 200)
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)

            // Discovered Peripherals
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Discovered BLE Printers")
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(.secondary)
                    Spacer()
                    if printerManager.isScanning {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                }

                if printerManager.discoveredPrinters.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "antenna.radiowaves.left.and.right")
                            .font(.system(size: 32))
                            .foregroundColor(.secondary)
                        Text(printerManager.isScanning ? "Scanning for thermal printers..." : "No printers discovered yet.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        if !printerManager.isScanning {
                            Button("Start Scan") {
                                printerManager.startScan()
                            }
                            .font(.footnote)
                            .buttonStyle(.borderedProminent)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 32)
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                } else {
                    ForEach(printerManager.discoveredPrinters) { printer in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 6) {
                                    Text(printer.name)
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                    if printer.isRecognizedThermalPrinter {
                                        Text("ESC/POS")
                                            .font(.system(size: 9, weight: .bold))
                                            .padding(.horizontal, 4)
                                            .padding(.vertical, 1)
                                            .background(Color.blue.opacity(0.15))
                                            .foregroundColor(.blue)
                                            .cornerRadius(4)
                                    }
                                }
                                Text("RSSI: \(printer.rssi) dBm")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()

                            if printerManager.connectedPrinter?.id == printer.id {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                            } else {
                                Button("Connect") {
                                    printerManager.connect(to: printer)
                                }
                                .font(.footnote)
                                .buttonStyle(.bordered)
                            }
                        }
                        .padding()
                        .background(Color(.systemBackground))
                        .cornerRadius(10)
                    }
                }
            }
        }
    }

    // MARK: - Tab 2: Diagnostics & Manual ESC/POS Testing
    private var diagnosticsTab: some View {
        VStack(spacing: 16) {
            // Raw Text Sender Card
            VStack(alignment: .leading, spacing: 8) {
                Text("Manual Text Test")
                    .font(.subheadline)
                    .fontWeight(.bold)
                TextEditor(text: $manualText)
                    .frame(height: 90)
                    .font(.system(.caption, design: .monospaced))
                    .padding(4)
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(8)

                Button(action: sendManualPlainText) {
                    HStack {
                        Image(systemName: "paperplane.fill")
                        Text("Send Plain Text")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .disabled(printerManager.connectedPrinter == nil)
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)

            // Raw Hex Sender Card
            VStack(alignment: .leading, spacing: 8) {
                Text("Manual ESC/POS Hex Sender")
                    .font(.subheadline)
                    .fontWeight(.bold)
                Text("Enter hex bytes separated by spaces (e.g. 1B 40 1B 61 01 0A)")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                TextField("Hex bytes...", text: $manualHex)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .font(.system(.caption, design: .monospaced))

                Button(action: sendManualHex) {
                    HStack {
                        Image(systemName: "terminal.fill")
                        Text("Send Hex Bytes")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color.indigo)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .disabled(printerManager.connectedPrinter == nil)
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)

            // Deep Link Simulator Button
            VStack(alignment: .leading, spacing: 8) {
                Text("Deep Link Test Simulation")
                    .font(.subheadline)
                    .fontWeight(.bold)
                Text("Simulates an incoming print job from Harsh Apex POS Web App.")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Button(action: simulateIncomingDeepLink) {
                    HStack {
                        Image(systemName: "link.badge.plus")
                        Text("Simulate POS Job Deep Link")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.teal)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
        }
    }

    // MARK: - Tab 3: Deep Link Print Jobs History
    private var jobsTab: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Incoming Web Print Jobs")
                .font(.headline)

            if deepLinkHandler.recentJobs.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "tray")
                        .font(.system(size: 36))
                        .foregroundColor(.secondary)
                    Text("No print jobs received yet.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text("Print requests sent from Harsh Apex POS web app via 'harsh-apex-print://' will show here.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
                .background(Color(.systemBackground))
                .cornerRadius(12)
            } else {
                ForEach(deepLinkHandler.recentJobs) { job in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("Job ID: \(job.id)")
                                .font(.subheadline)
                                .fontWeight(.bold)
                            Spacer()
                            jobStatusBadge(for: job.status)
                        }

                        if let bill = job.billNumber {
                            Text("Bill: \(bill)")
                                .font(.caption)
                                .foregroundColor(.primary)
                        }
                        if let total = job.totalAmount {
                            Text("Total: \(total)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        if let bytes = job.rawByteCount {
                            Text("Payload: \(bytes) bytes")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }

                        Text(job.timestamp, style: .time)
                            .font(.caption2)
                            .foregroundColor(.gray)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(10)
                }
            }
        }
    }

    // MARK: - Helper Views & Methods

    @ViewBuilder
    private func jobStatusBadge(for status: PrintJobStatus) -> some View {
        switch status {
        case .received, .validating:
            Text("VALIDATING")
                .font(.caption2).bold()
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Color.orange.opacity(0.2)).foregroundColor(.orange).cornerRadius(4)
        case .fetching, .printing:
            Text("PRINTING")
                .font(.caption2).bold()
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Color.blue.opacity(0.2)).foregroundColor(.blue).cornerRadius(4)
        case .completed:
            Text("DONE")
                .font(.caption2).bold()
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Color.green.opacity(0.2)).foregroundColor(.green).cornerRadius(4)
        case .rejected(let reason):
            Text("REJECTED")
                .font(.caption2).bold()
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Color.red.opacity(0.2)).foregroundColor(.red).cornerRadius(4)
        case .failed(let err):
            Text("FAILED")
                .font(.caption2).bold()
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(Color.red.opacity(0.2)).foregroundColor(.red).cornerRadius(4)
        }
    }

    private var statusTitle: String {
        switch printerManager.connectionState {
        case .disconnected: return "Printer Disconnected"
        case .scanning: return "Scanning for Printers..."
        case .connecting(let name): return "Connecting to \(name)..."
        case .connected(let name): return "Connected: \(name)"
        case .error(let msg): return "Error: \(msg)"
        }
    }

    private var statusColor: Color {
        switch printerManager.connectionState {
        case .disconnected: return .gray
        case .scanning: return .yellow
        case .connecting: return .blue
        case .connected: return .green
        case .error: return .red
        }
    }

    private func printSampleReceipt() {
        let sampleItems = [
            ReceiptItem(name: "Basmati Rice 5kg", qty: 2, price: 1250.00),
            ReceiptItem(name: "Full Cream Milk 1L", qty: 3, price: 480.00),
            ReceiptItem(name: "Ceylon Tea 400g", qty: 1, price: 890.00),
            ReceiptItem(name: "White Sugar 1kg", qty: 2, price: 290.00)
        ]
        let subtotal = sampleItems.reduce(0) { $0 + ($1.qty * $1.price) }
        let discount = 150.00
        let total = subtotal - discount
        let received = 6000.00
        let change = received - total

        let sale = SalePayload(
            number: "HA-\(Int.random(in: 1000...9999))",
            at: Date().timeIntervalSince1970 * 1000,
            method: "Cash",
            items: sampleItems,
            subtotal: subtotal,
            discount: discount,
            total: total,
            received: received,
            change: change,
            shop: ShopInfo(
                name: "Harsh Apex Mart",
                address: "452 Galle Road, Colombo 03",
                phone: "+94 11 234 5678",
                regNo: "PV-89234",
                receiptFooter: "Thank You! Come Again!",
                receiptWidth: is80mm ? "80mm" : "58mm"
            ),
            verificationUrl: "https://harshapex.lk/verify/INV-2026-904"
        )

        let data = EscPosFormatter.buildReceipt(sale: sale, is80mm: is80mm)
        printerManager.sendData(data) { _ in }
    }

    private func kickDrawer() {
        let formatter = EscPosFormatter().kickCashDrawer()
        printerManager.sendData(formatter.build()) { _ in }
    }

    private func sendManualPlainText() {
        let formatter = EscPosFormatter().text(manualText).feed(lines: 2)
        printerManager.sendData(formatter.build()) { _ in }
    }

    private func sendManualHex() {
        let cleaned = manualHex.replacingOccurrences(of: " ", with: "")
        var data = Data()
        var index = cleaned.startIndex
        while index < cleaned.endIndex {
            let nextIndex = cleaned.index(index, offsetBy: 2, limitedBy: cleaned.endIndex) ?? cleaned.endIndex
            if let byte = UInt8(cleaned[index..<nextIndex], radix: 16) {
                data.append(byte)
            }
            index = nextIndex
        }
        printerManager.sendData(data) { _ in }
    }

    private func simulateIncomingDeepLink() {
        let randomId = "JOB-\(Int.random(in: 10000...99999))"
        let sampleItems = [
            ReceiptItem(name: "Anchor Butter 227g", qty: 1, price: 950.00),
            ReceiptItem(name: "Eggs 10 Pack", qty: 1, price: 420.00)
        ]
        let sale = SalePayload(
            number: "HA-SIM-\(Int.random(in: 100...999))",
            at: Date().timeIntervalSince1970 * 1000,
            method: "Card",
            items: sampleItems,
            subtotal: 1370.00,
            discount: 0,
            total: 1370.00,
            received: 1370.00,
            change: 0.00
        )
        let jsonData = try! JSONEncoder().encode(sale)
        let base64 = jsonData.base64EncodedString()
        let now = Int(Date().timeIntervalSince1970)

        if let testUrl = URL(string: "harsh-apex-print://job?id=\(randomId)&token=test-valid-token&ts=\(now)&payload=\(base64)&width=\(is80mm ? "80mm" : "58mm")") {
            deepLinkHandler.handleDeepLink(url: testUrl, printer: printerManager)
        }
    }
}
