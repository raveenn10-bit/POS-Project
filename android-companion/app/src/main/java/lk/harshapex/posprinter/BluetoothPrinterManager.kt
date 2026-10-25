package lk.harshapex.posprinter

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothSocket
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.ParcelUuid
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.OutputStream
import java.util.UUID

private const val TAG = "BluetoothPrinterManager"

enum class PrinterProtocol {
    CLASSIC_SPP,
    BLE
}

data class DiscoveredDevice(
    val name: String,
    val address: String,
    val protocol: PrinterProtocol,
    val isBonded: Boolean = false,
    val rssi: Int = 0,
    val device: BluetoothDevice
)

sealed class PrinterStatus {
    object Disconnected : PrinterStatus()
    data class Scanning(val protocol: PrinterProtocol) : PrinterStatus()
    data class Connecting(val deviceName: String, val protocol: PrinterProtocol) : PrinterStatus()
    data class Connected(val device: DiscoveredDevice) : PrinterStatus()
    data class Error(val message: String) : PrinterStatus()
}

class BluetoothPrinterManager(private val context: Context) {

    companion object {
        // Standard Bluetooth Classic SPP UUID
        val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

        // Known BLE Thermal Printer Service UUIDs
        val KNOWN_BLE_SERVICES = listOf(
            UUID.fromString("000018f0-0000-1000-8000-00805f9b34fb"), // Standard 18F0
            UUID.fromString("e7810a71-73ae-499d-8c15-faa9aef0c3f2"), // POS-58 / XP-58
            UUID.fromString("49535343-fe7d-4ae5-8fa9-9fafd205e455"), // ISSC UART
            UUID.fromString("0000ff00-0000-1000-8000-00805f9b34fb"), // FF00 custom
            UUID.fromString("0000ae00-0000-1000-8000-00805f9b34fb"), // AE00 custom
            UUID.fromString("0000e781-0000-1000-8000-00805f9b34fb"),
            UUID.fromString("000018f1-0000-1000-8000-00805f9b34fb")
        )

        private const val PREFS_NAME = "lk.harshapex.printer_prefs"
        private const val PREF_LAST_ADDRESS = "last_connected_mac"
        private const val PREF_LAST_PROTOCOL = "last_connected_proto"
    }

    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager?.adapter

    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private val writeMutex = Mutex()

    // StateFlows
    private val _status = MutableStateFlow<PrinterStatus>(PrinterStatus.Disconnected)
    val status: StateFlow<PrinterStatus> = _status.asStateFlow()

    private val _discoveredDevices = MutableStateFlow<List<DiscoveredDevice>>(emptyList())
    val discoveredDevices: StateFlow<List<DiscoveredDevice>> = _discoveredDevices.asStateFlow()

    private val _pairedDevices = MutableStateFlow<List<DiscoveredDevice>>(emptyList())
    val pairedDevices: StateFlow<List<DiscoveredDevice>> = _pairedDevices.asStateFlow()

    private val _isPrinting = MutableStateFlow(false)
    val isPrinting: StateFlow<Boolean> = _isPrinting.asStateFlow()

    private val _printProgress = MutableStateFlow(0f)
    val printProgress: StateFlow<Float> = _printProgress.asStateFlow()

    // Active Connection Handles
    private var classicSocket: BluetoothSocket? = null
    private var classicOutputStream: OutputStream? = null

    private var bleGatt: BluetoothGatt? = null
    private var bleWriteCharacteristic: BluetoothGattCharacteristic? = null
    private var bleMtu: Int = 23
    private var connectedDevice: DiscoveredDevice? = null

    // Classic Discovery BroadcastReceiver
    private var isClassicReceiverRegistered = false
    private val classicDiscoveryReceiver = object : BroadcastReceiver() {
        @SuppressLint("MissingPermission")
        override fun onReceive(c: Context?, intent: Intent?) {
            when (intent?.action) {
                BluetoothDevice.ACTION_FOUND -> {
                    val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                    }
                    val rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE).toInt()
                    device?.let { addDiscoveredDevice(it, PrinterProtocol.CLASSIC_SPP, rssi) }
                }
                BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                    if (_status.value is PrinterStatus.Scanning) {
                        _status.value = PrinterStatus.Disconnected
                    }
                }
            }
        }
    }

    // BLE ScanCallback
    private val bleScanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            result?.device?.let { device ->
                addDiscoveredDevice(device, PrinterProtocol.BLE, result.rssi)
            }
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "BLE Scan failed with code: $errorCode")
            _status.value = PrinterStatus.Error("BLE Scan failed (code $errorCode)")
        }
    }

    init {
        loadPairedDevices()
    }

    // =========================================================================
    // Device Discovery & Pairing
    // =========================================================================

    @SuppressLint("MissingPermission")
    fun loadPairedDevices() {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) return

        try {
            val bonded = bluetoothAdapter.bondedDevices ?: emptySet()
            val list = bonded.map { device ->
                val name = device.name ?: "Unknown Bluetooth Device"
                DiscoveredDevice(
                    name = name,
                    address = device.address,
                    protocol = PrinterProtocol.CLASSIC_SPP,
                    isBonded = true,
                    rssi = 0,
                    device = device
                )
            }
            _pairedDevices.value = list
        } catch (e: Exception) {
            Log.w(TAG, "Could not read paired devices", e)
        }
    }

    @SuppressLint("MissingPermission")
    fun startDiscovery(protocol: PrinterProtocol) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
            _status.value = PrinterStatus.Error("Bluetooth is disabled. Please turn on Bluetooth.")
            return
        }

        stopDiscovery()
        _discoveredDevices.value = emptyList()
        _status.value = PrinterStatus.Scanning(protocol)

        if (protocol == PrinterProtocol.CLASSIC_SPP) {
            startClassicDiscovery()
        } else {
            startBleDiscovery()
        }
    }

    @SuppressLint("MissingPermission")
    private fun startClassicDiscovery() {
        try {
            if (!isClassicReceiverRegistered) {
                val filter = IntentFilter().apply {
                    addAction(BluetoothDevice.ACTION_FOUND)
                    addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
                }
                context.registerReceiver(classicDiscoveryReceiver, filter)
                isClassicReceiverRegistered = true
            }
            bluetoothAdapter?.startDiscovery()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start classic discovery", e)
            _status.value = PrinterStatus.Error("Classic Bluetooth scan error: ${e.message}")
        }
    }

    @SuppressLint("MissingPermission")
    private fun startBleDiscovery() {
        try {
            val scanner = bluetoothAdapter?.bluetoothLeScanner
            if (scanner == null) {
                _status.value = PrinterStatus.Error("BLE Scanner not available on this device.")
                return
            }
            val settings = ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build()

            val filters = mutableListOf<ScanFilter>()
            for (uuid in KNOWN_BLE_SERVICES) {
                filters.add(ScanFilter.Builder().setServiceUuid(ParcelUuid(uuid)).build())
            }

            // Start scanning with filters, fallback to open scan if none
            scanner.startScan(null, settings, bleScanCallback)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start BLE scan", e)
            _status.value = PrinterStatus.Error("BLE scan error: ${e.message}")
        }
    }

    @SuppressLint("MissingPermission")
    fun stopDiscovery() {
        try {
            if (bluetoothAdapter?.isDiscovering == true) {
                bluetoothAdapter.cancelDiscovery()
            }
            if (isClassicReceiverRegistered) {
                try {
                    context.unregisterReceiver(classicDiscoveryReceiver)
                } catch (_: Exception) {}
                isClassicReceiverRegistered = false
            }
            bluetoothAdapter?.bluetoothLeScanner?.stopScan(bleScanCallback)
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping discovery", e)
        }

        if (_status.value is PrinterStatus.Scanning) {
            _status.value = PrinterStatus.Disconnected
        }
    }

    @SuppressLint("MissingPermission")
    private fun addDiscoveredDevice(device: BluetoothDevice, protocol: PrinterProtocol, rssi: Int) {
        val name = device.name ?: return
        if (name.isBlank() || name == "Unknown") return

        val current = _discoveredDevices.value.toMutableList()
        val existingIndex = current.indexOfFirst { it.address == device.address }

        val isBonded = device.bondState == BluetoothDevice.BOND_BONDED
        val item = DiscoveredDevice(name, device.address, protocol, isBonded, rssi, device)

        if (existingIndex >= 0) {
            current[existingIndex] = item
        } else {
            current.add(item)
        }

        // Sort recognized printers higher
        current.sortByDescending {
            val isKnown = it.name.contains("pos", ignoreCase = true) ||
                    it.name.contains("print", ignoreCase = true) ||
                    it.name.contains("xp", ignoreCase = true) ||
                    it.name.contains("rp", ignoreCase = true) ||
                    it.name.contains("mpt", ignoreCase = true)
            if (isKnown) 1000 + it.rssi else it.rssi
        }

        _discoveredDevices.value = current
    }

    // =========================================================================
    // Connection Logic: Classic SPP
    // =========================================================================

    @SuppressLint("MissingPermission")
    fun connectClassic(device: DiscoveredDevice) {
        stopDiscovery()
        _status.value = PrinterStatus.Connecting(device.name, PrinterProtocol.CLASSIC_SPP)

        scope.launch {
            try {
                disconnect()

                var socket: BluetoothSocket? = null
                // Attempt 1: Standard RFCOMM SPP socket
                try {
                    socket = device.device.createRfcommSocketToServiceRecord(SPP_UUID)
                    socket.connect()
                } catch (e1: Exception) {
                    Log.w(TAG, "Standard SPP connection failed, attempting reflection fallback...", e1)
                    // Attempt 2: Fallback reflection socket method (crucial for cheap ESC/POS printers)
                    val method = device.device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
                    socket = method.invoke(device.device, 1) as BluetoothSocket
                    socket.connect()
                }

                classicSocket = socket
                classicOutputStream = socket.outputStream
                connectedDevice = device

                saveLastConnection(device.address, PrinterProtocol.CLASSIC_SPP)
                withContext(Dispatchers.Main) {
                    _status.value = PrinterStatus.Connected(device)
                }
                Log.i(TAG, "Connected to Classic SPP printer: ${device.name} [${device.address}]")

            } catch (e: Exception) {
                Log.e(TAG, "Classic connection failed", e)
                withContext(Dispatchers.Main) {
                    _status.value = PrinterStatus.Error("Classic connection failed: ${e.localizedMessage}")
                }
                disconnect()
            }
        }
    }

    // =========================================================================
    // Connection Logic: BLE
    // =========================================================================

    @SuppressLint("MissingPermission")
    fun connectBle(device: DiscoveredDevice) {
        stopDiscovery()
        _status.value = PrinterStatus.Connecting(device.name, PrinterProtocol.BLE)

        scope.launch {
            disconnect()

            val gattCallback = object : BluetoothGattCallback() {
                override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        Log.i(TAG, "BLE Connected, requesting MTU 512...")
                        gatt?.requestMtu(512)
                    } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                        Log.w(TAG, "BLE Disconnected")
                        scope.launch(Dispatchers.Main) {
                            _status.value = PrinterStatus.Disconnected
                        }
                        disconnect()
                    }
                }

                override fun onMtuChanged(gatt: BluetoothGatt?, mtu: Int, status: Int) {
                    bleMtu = if (status == BluetoothGatt.GATT_SUCCESS) mtu else 23
                    Log.i(TAG, "Negotiated BLE MTU: $bleMtu")
                    gatt?.discoverServices()
                }

                override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
                    if (status != BluetoothGatt.GATT_SUCCESS || gatt == null) {
                        scope.launch(Dispatchers.Main) {
                            _status.value = PrinterStatus.Error("BLE service discovery failed.")
                        }
                        return
                    }

                    var writeChar: BluetoothGattCharacteristic? = null
                    for (service in gatt.services) {
                        for (characteristic in service.characteristics) {
                            val props = characteristic.properties
                            if ((props and BluetoothGattCharacteristic.PROPERTY_WRITE) != 0 ||
                                (props and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
                            ) {
                                writeChar = characteristic
                                break
                            }
                        }
                        if (writeChar != null) break
                    }

                    if (writeChar != null) {
                        bleGatt = gatt
                        bleWriteCharacteristic = writeChar
                        connectedDevice = device
                        saveLastConnection(device.address, PrinterProtocol.BLE)
                        scope.launch(Dispatchers.Main) {
                            _status.value = PrinterStatus.Connected(device)
                        }
                        Log.i(TAG, "BLE Printer Ready: ${device.name} with char ${writeChar.uuid}")
                    } else {
                        scope.launch(Dispatchers.Main) {
                            _status.value = PrinterStatus.Error("No writable characteristic found on BLE device.")
                        }
                        disconnect()
                    }
                }
            }

            try {
                device.device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
            } catch (e: Exception) {
                Log.e(TAG, "BLE connect failed", e)
                withContext(Dispatchers.Main) {
                    _status.value = PrinterStatus.Error("BLE Connect Error: ${e.localizedMessage}")
                }
            }
        }
    }

    // =========================================================================
    // Disconnect & Cleanup
    // =========================================================================

    @SuppressLint("MissingPermission")
    fun disconnect() {
        try {
            classicOutputStream?.flush()
            classicOutputStream?.close()
        } catch (_: Exception) {}
        try {
            classicSocket?.close()
        } catch (_: Exception) {}

        classicOutputStream = null
        classicSocket = null

        try {
            bleGatt?.disconnect()
            bleGatt?.close()
        } catch (_: Exception) {}

        bleGatt = null
        bleWriteCharacteristic = null
        connectedDevice = null

        _status.value = PrinterStatus.Disconnected
    }

    // =========================================================================
    // Printing / Data Transmission
    // =========================================================================

    suspend fun printData(data: ByteArray): Result<Unit> = withContext(Dispatchers.IO) {
        writeMutex.withLock {
            val current = connectedDevice
            if (current == null) {
                return@withContext Result.failure(Exception("No thermal printer currently connected."))
            }

            _isPrinting.value = true
            _printProgress.value = 0f

            try {
                if (current.protocol == PrinterProtocol.CLASSIC_SPP) {
                    printClassic(data)
                } else {
                    printBle(data)
                }
                _printProgress.value = 1f
                _isPrinting.value = false
                Result.success(Unit)
            } catch (e: Exception) {
                Log.e(TAG, "Print failed", e)
                _isPrinting.value = false
                Result.failure(e)
            }
        }
    }

    private suspend fun printClassic(data: ByteArray) {
        val out = classicOutputStream ?: throw Exception("Classic Bluetooth output stream is closed.")
        val chunkSize = 512
        var offset = 0
        val total = data.size

        while (offset < total) {
            val length = (total - offset).coerceAtMost(chunkSize)
            out.write(data, offset, length)
            out.flush()
            offset += length
            _printProgress.value = offset.toFloat() / total.toFloat()
            delay(10) // Small pacing delay to avoid buffer overflow on receipt printer
        }
    }

    @SuppressLint("MissingPermission")
    private suspend fun printBle(data: ByteArray) {
        val gatt = bleGatt ?: throw Exception("BLE Gatt not connected.")
        val characteristic = bleWriteCharacteristic ?: throw Exception("No writable characteristic.")

        // Leave 3 bytes for ATT header; typical safe chunk size is between 20 and 140 bytes
        val chunkSize = (bleMtu - 3).coerceIn(20, 140)
        var offset = 0
        val total = data.size

        val writeType = if ((characteristic.properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0) {
            BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
        } else {
            BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
        }

        while (offset < total) {
            val length = (total - offset).coerceAtMost(chunkSize)
            val chunk = data.copyOfRange(offset, offset + length)

            characteristic.value = chunk
            characteristic.writeType = writeType
            val success = gatt.writeCharacteristic(characteristic)

            if (!success) {
                throw Exception("Failed to write BLE chunk at offset $offset")
            }

            offset += length
            _printProgress.value = offset.toFloat() / total.toFloat()
            delay(15) // Crucial pacing delay for BLE ESC/POS microcontrollers
        }
    }

    // =========================================================================
    // Persistence & Auto-Reconnect
    // =========================================================================

    private fun saveLastConnection(mac: String, protocol: PrinterProtocol) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(PREF_LAST_ADDRESS, mac)
            .putString(PREF_LAST_PROTOCOL, protocol.name)
            .apply()
    }

    @SuppressLint("MissingPermission")
    fun attemptAutoReconnect() {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val mac = prefs.getString(PREF_LAST_ADDRESS, null) ?: return
        val protoStr = prefs.getString(PREF_LAST_PROTOCOL, PrinterProtocol.CLASSIC_SPP.name)
        val protocol = try { PrinterProtocol.valueOf(protoStr!!) } catch (_: Exception) { PrinterProtocol.CLASSIC_SPP }

        val device = bluetoothAdapter?.getRemoteDevice(mac) ?: return
        val name = device.name ?: "Saved Printer"
        val discovered = DiscoveredDevice(name, mac, protocol, true, 0, device)

        if (protocol == PrinterProtocol.CLASSIC_SPP) {
            connectClassic(discovered)
        } else {
            connectBle(discovered)
        }
    }
}
