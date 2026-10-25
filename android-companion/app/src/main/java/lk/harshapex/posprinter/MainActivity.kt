package lk.harshapex.posprinter

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import kotlinx.coroutines.launch
import java.util.Date

class MainActivity : ComponentActivity() {

    private lateinit var printerManager: BluetoothPrinterManager
    private lateinit var deepLinkHandler: DeepLinkHandler

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        printerManager = BluetoothPrinterManager(applicationContext)
        deepLinkHandler = DeepLinkHandler(printerManager, lifecycleScope)

        // Handle initial deep link if app launched via URL
        intent?.data?.let { uri ->
            deepLinkHandler.handleUri(uri)
        }

        setContent {
            MaterialTheme {
                MainScreen(
                    printerManager = printerManager,
                    deepLinkHandler = deepLinkHandler,
                    onSimulateJob = { is80mm -> simulateWebPosJob(is80mm) }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent?.data?.let { uri ->
            deepLinkHandler.handleUri(uri)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        printerManager.stopDiscovery()
    }

    private fun simulateWebPosJob(is80mm: Boolean) {
        val sampleItems = listOf(
            ReceiptItemModel(name = "Basmati Rice 5kg", qty = 2.0, price = 1250.0),
            ReceiptItemModel(name = "Full Cream Milk 1L", qty = 3.0, price = 480.0),
            ReceiptItemModel(name = "Ceylon Tea 400g", qty = 1.0, price = 890.0)
        )
        val subtotal = sampleItems.sumOf { it.qty * it.price }
        val discount = 150.0
        val total = subtotal - discount

        val sale = SaleModel(
            number = "HA-AND-${(1000..9999).random()}",
            at = System.currentTimeMillis(),
            method = "Cash",
            items = sampleItems,
            subtotal = subtotal,
            discount = discount,
            total = total,
            received = 5000.0,
            change = 5000.0 - total,
            shop = ShopInfoModel(
                name = "Harsh Apex Mart",
                address = "452 Galle Road, Colombo 03",
                phone = "+94 11 234 5678",
                regNo = "PV-89234",
                receiptFooter = "Thank You! Come Again!",
                receiptWidth = if (is80mm) "80mm" else "58mm"
            ),
            verificationUrl = "https://harshapex.lk/verify/INV-2026-904"
        )

        val json = Gson().toJson(sale)
        val base64 = Base64.encodeToString(json.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
        val now = System.currentTimeMillis() / 1000
        val jobId = "SIM-$now"

        val simUri = Uri.parse("harsh-apex-print://job?id=$jobId&token=mock-token&ts=$now&payload=$base64&width=${if (is80mm) "80mm" else "58mm"}")
        deepLinkHandler.handleUri(simUri)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    printerManager: BluetoothPrinterManager,
    deepLinkHandler: DeepLinkHandler,
    onSimulateJob: (Boolean) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val status by printerManager.status.collectAsState()
    val isPrinting by printerManager.isPrinting.collectAsState()
    val printProgress by printerManager.printProgress.collectAsState()
    val pairedDevices by printerManager.pairedDevices.collectAsState()
    val discoveredDevices by printerManager.discoveredDevices.collectAsState()
    val recentJobs by deepLinkHandler.recentJobs.collectAsState()
    val notificationMsg by deepLinkHandler.notificationMessage.collectAsState()

    var selectedTab by remember { mutableStateOf(0) }
    var selectedProtocol by remember { mutableStateOf(PrinterProtocol.CLASSIC_SPP) }
    var is80mm by remember { mutableStateOf(false) }
    var manualText by remember { mutableStateOf("Harsh Apex POS Android\nColombo, Sri Lanka\n") }
    var manualHex by remember { mutableStateOf("1B 40 1B 61 01 48 61 72 73 68 20 41 70 65 78 0A 1D 56 42 00") }

    // Bluetooth Runtime Permission Requester
    val permissionsToRequest = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        arrayOf(
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT
        )
    } else {
        arrayOf(
            Manifest.permission.BLUETOOTH,
            Manifest.permission.BLUETOOTH_ADMIN,
            Manifest.permission.ACCESS_FINE_LOCATION
        )
    }

    var hasPermissions by remember {
        mutableStateOf(
            permissionsToRequest.all {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { map ->
        hasPermissions = map.values.all { it }
        if (hasPermissions) {
            printerManager.loadPairedDevices()
        }
    }

    LaunchedEffect(Unit) {
        if (!hasPermissions) {
            permissionLauncher.launch(permissionsToRequest)
        } else {
            printerManager.attemptAutoReconnect()
        }
    }

    LaunchedEffect(notificationMsg) {
        notificationMsg?.let {
            Toast.makeText(context, it, Toast.LENGTH_SHORT).show()
            deepLinkHandler.clearNotification()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "Harsh Apex Printer",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Text(
                            when (status) {
                                is PrinterStatus.Connected -> "Connected: ${(status as PrinterStatus.Connected).device.name}"
                                is PrinterStatus.Connecting -> "Connecting to ${(status as PrinterStatus.Connecting).deviceName}..."
                                is PrinterStatus.Scanning -> "Scanning (${(status as PrinterStatus.Scanning).protocol.name})..."
                                is PrinterStatus.Error -> (status as PrinterStatus.Error).message
                                else -> "Printer Disconnected"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = when (status) {
                                is PrinterStatus.Connected -> Color(0xFF10B981)
                                is PrinterStatus.Connecting -> Color(0xFF3B82F6)
                                is PrinterStatus.Scanning -> Color(0xFFF59E0B)
                                is PrinterStatus.Error -> Color(0xFFEF4444)
                                else -> Color.Gray
                            }
                        )
                    }
                },
                actions = {
                    IconButton(onClick = {
                        if (status is PrinterStatus.Scanning) {
                            printerManager.stopDiscovery()
                        } else {
                            if (hasPermissions) {
                                printerManager.startDiscovery(selectedProtocol)
                            } else {
                                permissionLauncher.launch(permissionsToRequest)
                            }
                        }
                    }) {
                        Icon(
                            if (status is PrinterStatus.Scanning) Icons.Default.Stop else Icons.Default.Refresh,
                            contentDescription = "Scan"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
        ) {
            // Printing Progress Bar
            if (isPrinting) {
                LinearProgressIndicator(
                    progress = { printProgress },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Tab Navigation
            TabRow(selectedTabIndex = selectedTab) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("Printers") }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("Diagnostics") }
                )
                Tab(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    text = { Text("Jobs (${recentJobs.size})") }
                )
            }

            when (selectedTab) {
                0 -> PrintersTab(
                    status = status,
                    selectedProtocol = selectedProtocol,
                    onProtocolChange = {
                        selectedProtocol = it
                        printerManager.stopDiscovery()
                    },
                    pairedDevices = pairedDevices,
                    discoveredDevices = discoveredDevices,
                    onConnect = { dev ->
                        if (dev.protocol == PrinterProtocol.CLASSIC_SPP) {
                            printerManager.connectClassic(dev)
                        } else {
                            printerManager.connectBle(dev)
                        }
                    },
                    onDisconnect = { printerManager.disconnect() }
                )
                1 -> DiagnosticsTab(
                    isConnected = status is PrinterStatus.Connected,
                    is80mm = is80mm,
                    onWidthToggle = { is80mm = it },
                    manualText = manualText,
                    onManualTextChange = { manualText = it },
                    manualHex = manualHex,
                    onManualHexChange = { manualHex = it },
                    onPrintSample = {
                        coroutineScope.launch {
                            val sampleItems = listOf(
                                ReceiptItemModel("Basmati Rice 5kg", 2.0, 1250.0),
                                ReceiptItemModel("Full Cream Milk 1L", 3.0, 480.0),
                                ReceiptItemModel("Ceylon Tea 400g", 1.0, 890.0)
                            )
                            val subtotal = sampleItems.sumOf { it.qty * it.price }
                            val total = subtotal - 150.0
                            val sale = SaleModel(
                                number = "TEST-${(100..999).random()}",
                                at = System.currentTimeMillis(),
                                method = "Cash",
                                items = sampleItems,
                                subtotal = subtotal,
                                discount = 150.0,
                                total = total,
                                received = 5000.0,
                                change = 5000.0 - total,
                                shop = ShopInfoModel("Harsh Apex POS", "Galle Rd, Colombo", "+94 77 123 4567")
                            )
                            val receipt = EscPosUtil.buildReceipt(sale, is80mm)
                            printerManager.printData(receipt)
                        }
                    },
                    onDrawerKick = {
                        coroutineScope.launch {
                            val data = EscPosUtil().kickCashDrawer().build()
                            printerManager.printData(data)
                        }
                    },
                    onSendText = {
                        coroutineScope.launch {
                            val data = EscPosUtil().text(manualText).feed(2).build()
                            printerManager.printData(data)
                        }
                    },
                    onSendHex = {
                        coroutineScope.launch {
                            val cleaned = manualHex.replace(" ", "")
                            val bytes = ByteArray(cleaned.length / 2)
                            for (i in bytes.indices) {
                                bytes[i] = cleaned.substring(i * 2, i * 2 + 2).toInt(16).toByte()
                            }
                            printerManager.printData(bytes)
                        }
                    },
                    onSimulateJob = { onSimulateJob(is80mm) }
                )
                2 -> JobsTab(recentJobs = recentJobs)
            }
        }
    }
}

@Composable
fun PrintersTab(
    status: PrinterStatus,
    selectedProtocol: PrinterProtocol,
    onProtocolChange: (PrinterProtocol) -> Unit,
    pairedDevices: List<DiscoveredDevice>,
    discoveredDevices: List<DiscoveredDevice>,
    onConnect: (DiscoveredDevice) -> Unit,
    onDisconnect: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Active Connection Header
        if (status is PrinterStatus.Connected) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFECFDF5)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Print,
                            contentDescription = null,
                            tint = Color(0xFF059669),
                            modifier = Modifier.size(36.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                status.device.name,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF065F46)
                            )
                            Text(
                                "${status.device.address} (${status.device.protocol.name})",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF047857)
                            )
                        }
                        Button(
                            onClick = onDisconnect,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                        ) {
                            Text("Disconnect")
                        }
                    }
                }
            }
        }

        // Protocol Selector
        item {
            Text(
                "Communication Protocol",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = selectedProtocol == PrinterProtocol.CLASSIC_SPP,
                    onClick = { onProtocolChange(PrinterProtocol.CLASSIC_SPP) },
                    label = { Text("Bluetooth Classic (SPP)") },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = selectedProtocol == PrinterProtocol.BLE,
                    onClick = { onProtocolChange(PrinterProtocol.BLE) },
                    label = { Text("Bluetooth LE (BLE)") },
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Paired Devices (for Classic SPP)
        if (selectedProtocol == PrinterProtocol.CLASSIC_SPP && pairedDevices.isNotEmpty()) {
            item {
                Text(
                    "Paired Devices (Classic SPP)",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
            }
            items(pairedDevices) { device ->
                DeviceRow(device = device, onConnect = { onConnect(device) })
            }
        }

        // Discovered Devices
        item {
            Text(
                "Discovered Devices (${selectedProtocol.name})",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
        }

        if (discoveredDevices.isEmpty()) {
            item {
                Text(
                    "No devices found yet. Tap Refresh at the top right to start scanning.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.Gray,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            }
        } else {
            items(discoveredDevices) { device ->
                DeviceRow(device = device, onConnect = { onConnect(device) })
            }
        }
    }
}

@Composable
fun DeviceRow(device: DiscoveredDevice, onConnect: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(device.name, fontWeight = FontWeight.SemiBold)
                Text(device.address, style = MaterialTheme.typography.bodySmall, color = Color.Gray)
            }
            Button(onClick = onConnect) {
                Text("Connect")
            }
        }
    }
}

@Composable
fun DiagnosticsTab(
    isConnected: Boolean,
    is80mm: Boolean,
    onWidthToggle: (Boolean) -> Unit,
    manualText: String,
    onManualTextChange: (String) -> Unit,
    manualHex: String,
    onManualHexChange: (String) -> Unit,
    onPrintSample: () -> Unit,
    onDrawerKick: () -> Unit,
    onSendText: () -> Unit,
    onSendHex: () -> Unit,
    onSimulateJob: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            // Paper Width Configuration
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .padding(16.dp)
                        .fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Receipt Width:", fontWeight = FontWeight.Medium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = !is80mm,
                            onClick = { onWidthToggle(false) },
                            label = { Text("58mm") }
                        )
                        FilterChip(
                            selected = is80mm,
                            onClick = { onWidthToggle(true) },
                            label = { Text("80mm") }
                        )
                    }
                }
            }
        }

        item {
            // Test Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = onPrintSample,
                    enabled = isConnected,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Receipt, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Test Receipt")
                }
                OutlinedButton(
                    onClick = onDrawerKick,
                    enabled = isConnected,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Inbox, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Kick Drawer")
                }
            }
        }

        // Manual Plain Text Sender
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Manual Text Test", fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = manualText,
                        onValueChange = onManualTextChange,
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 4
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = onSendText,
                        enabled = isConnected,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Send Plain Text")
                    }
                }
            }
        }

        // Manual Hex ESC/POS Sender
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Manual Hex Sender", fontWeight = FontWeight.Bold)
                    Text(
                        "Space-separated hex bytes (e.g. 1B 40 1B 61 01 0A)",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = manualHex,
                        onValueChange = onManualHexChange,
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = onSendHex,
                        enabled = isConnected,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Send Hex Bytes")
                    }
                }
            }
        }

        // Deep Link Simulator
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Deep Link Simulation", fontWeight = FontWeight.Bold)
                    Text(
                        "Triggers a mock print job from Harsh Apex POS Web App.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = onSimulateJob,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0D9488))
                    ) {
                        Icon(Icons.Default.Send, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Simulate POS Job Deep Link")
                    }
                }
            }
        }
    }
}

@Composable
fun JobsTab(recentJobs: List<PrintJobItem>) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text(
                "Incoming Web Print Jobs",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }

        if (recentJobs.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.History,
                        contentDescription = null,
                        tint = Color.Gray,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("No print jobs received yet.", color = Color.Gray)
                    Text(
                        "Print jobs from Harsh Apex POS will arrive here via harsh-apex-print://",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.Gray
                    )
                }
            }
        } else {
            items(recentJobs) { job ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Job: ${job.id}", fontWeight = FontWeight.Bold)
                            JobStatusBadge(state = job.state)
                        }
                        job.billNumber?.let { Text("Bill: $it", style = MaterialTheme.typography.bodySmall) }
                        job.totalAmount?.let { Text("Total: $it", style = MaterialTheme.typography.bodySmall) }
                        job.byteCount?.let { Text("Bytes: $it", style = MaterialTheme.typography.bodySmall, color = Color.Gray) }
                    }
                }
            }
        }
    }
}

@Composable
fun JobStatusBadge(state: JobState) {
    val (label, bg, fg) = when (state) {
        is JobState.Validating -> Triple("VALIDATING", Color(0xFFFEF3C7), Color(0xFFD97706))
        is JobState.Fetching -> Triple("FETCHING", Color(0xFFDBEAFE), Color(0xFF2563EB))
        is JobState.Printing -> Triple("PRINTING", Color(0xFFDBEAFE), Color(0xFF2563EB))
        is JobState.Completed -> Triple("DONE", Color(0xFFD1FAE5), Color(0xFF059669))
        is JobState.Rejected -> Triple("REJECTED", Color(0xFFFEE2E2), Color(0xFFDC2626))
        is JobState.Failed -> Triple("FAILED", Color(0xFFFEE2E2), Color(0xFFDC2626))
    }

    Surface(
        color = bg,
        shape = RoundedCornerShape(4.dp)
    ) {
        Text(
            text = label,
            color = fg,
            fontWeight = FontWeight.Bold,
            fontSize = 10.sp,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}
