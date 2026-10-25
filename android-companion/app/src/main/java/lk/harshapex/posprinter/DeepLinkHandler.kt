package lk.harshapex.posprinter

import android.net.Uri
import android.util.Base64
import android.util.Log
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.util.Date
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.math.abs

private const val TAG = "DeepLinkHandler"

sealed class JobState {
    object Validating : JobState()
    object Fetching : JobState()
    object Printing : JobState()
    object Completed : JobState()
    data class Rejected(val reason: String) : JobState()
    data class Failed(val error: String) : JobState()
}

data class PrintJobItem(
    val id: String,
    val timestamp: Date,
    val state: JobState,
    val billNumber: String? = null,
    val totalAmount: String? = null,
    val byteCount: Int? = null
)

class DeepLinkHandler(
    private val printerManager: BluetoothPrinterManager,
    private val scope: CoroutineScope
) {
    private val gson = Gson()

    // Shared secret for HMAC validation (can be configured)
    var hmacSecret: String = "apex-pos-secure-ble-key-2026"

    private val _recentJobs = MutableStateFlow<List<PrintJobItem>>(emptyList())
    val recentJobs: StateFlow<List<PrintJobItem>> = _recentJobs.asStateFlow()

    private val _notificationMessage = MutableStateFlow<String?>(null)
    val notificationMessage: StateFlow<String?> = _notificationMessage.asStateFlow()

    // Anti-replay cache: Job ID -> Timestamp processed
    private val processedJobs = HashMap<String, Long>()
    private val cacheLock = Any()
    private val maxTokenDriftSeconds = 300L // 5 minutes

    fun clearNotification() {
        _notificationMessage.value = null
    }

    /**
     * Entry point for incoming deep link Uri
     */
    fun handleUri(uri: Uri) {
        val scheme = uri.scheme?.lowercase()
        if (scheme != "harsh-apex-print") {
            postError("Invalid URL scheme: $scheme. Expected 'harsh-apex-print://'")
            return
        }

        val host = uri.host?.lowercase()
        when (host) {
            "job" -> handleJobIntent(uri)
            "print" -> handleDirectPrintIntent(uri)
            else -> postError("Unrecognized deep link action '$host'")
        }
    }

    private fun handleJobIntent(uri: Uri) {
        val jobId = uri.getQueryParameter("id")
        if (jobId.isNullOrBlank()) {
            postError("Missing required 'id' parameter in print job.")
            return
        }

        // 1. Check Replay Attack
        synchronized(cacheLock) {
            if (processedJobs.containsKey(jobId)) {
                val reason = "Replay attack detected: Job ID '$jobId' was already processed."
                recordJob(jobId, JobState.Rejected(reason))
                postError(reason)
                return
            }
            // Mark job as processed
            processedJobs[jobId] = System.currentTimeMillis()
        }

        // 2. Validate Security Token & Timestamp
        val token = uri.getQueryParameter("token")
        val timestampStr = uri.getQueryParameter("ts")
        val validationError = validateToken(jobId, token, timestampStr)
        if (validationError != null) {
            recordJob(jobId, JobState.Rejected(validationError))
            postError("Token Validation Failed: $validationError")
            return
        }

        val width = uri.getQueryParameter("width")
        val is80mm = width?.equals("80mm", ignoreCase = true) == true

        // 3. Process Payload or Remote Endpoint
        val base64Payload = uri.getQueryParameter("payload")
        val endpoint = uri.getQueryParameter("endpoint")

        if (!base64Payload.isNullOrBlank()) {
            processBase64Payload(jobId, base64Payload, is80mm)
        } else if (!endpoint.isNullOrBlank()) {
            fetchRemoteJob(jobId, endpoint, token, is80mm)
        } else {
            val err = "No payload or endpoint provided in job '$jobId'."
            recordJob(jobId, JobState.Rejected(err))
            postError(err)
        }
    }

    private fun handleDirectPrintIntent(uri: Uri) {
        val rawBase64 = uri.getQueryParameter("raw")
        if (rawBase64.isNullOrBlank()) {
            postError("Missing base64 'raw' parameter in print request.")
            return
        }

        val rawBytes = try {
            Base64.decode(rawBase64, Base64.DEFAULT)
        } catch (e: Exception) {
            postError("Malformed base64 raw bytes: ${e.message}")
            return
        }

        val jobId = "RAW-${System.currentTimeMillis() / 1000}"
        recordJob(jobId, JobState.Printing, byteCount = rawBytes.size)

        scope.launch {
            val result = printerManager.printData(rawBytes)
            result.fold(
                onSuccess = {
                    updateJob(jobId, JobState.Completed)
                    _notificationMessage.value = "Raw ESC/POS print job completed!"
                },
                onFailure = { err ->
                    val msg = "Print failed: ${err.localizedMessage}"
                    updateJob(jobId, JobState.Failed(msg))
                    postError(msg)
                }
            )
        }
    }

    // =========================================================================
    // Token Validation & Replay Prevention
    // =========================================================================

    private fun validateToken(jobId: String, token: String?, timestampStr: String?): String? {
        if (token.isNullOrBlank()) {
            return "Security token is missing from the print request."
        }

        // Verify timestamp freshness
        timestampStr?.toLongOrNull()?.let { tsSeconds ->
            val nowSeconds = System.currentTimeMillis() / 1000
            val drift = abs(nowSeconds - tsSeconds)
            if (drift > maxTokenDriftSeconds) {
                return "Token expired: Request is $drift seconds old (max allowable: ${maxTokenDriftSeconds}s)."
            }
        }

        // Verify HMAC if signature token present
        if (token.startsWith("hmac.")) {
            val sig = token.removePrefix("hmac.")
            val dataToSign = "$jobId:${timestampStr ?: ""}"
            try {
                val mac = Mac.getInstance("HmacSHA256")
                val key = SecretKeySpec(hmacSecret.toByteArray(Charsets.UTF_8), "HmacSHA256")
                mac.init(key)
                val expectedBytes = mac.doFinal(dataToSign.toByteArray(Charsets.UTF_8))
                val expectedHex = expectedBytes.joinToString("") { "%02x".format(it) }

                if (!sig.equals(expectedHex, ignoreCase = true)) {
                    return "Invalid HMAC signature."
                }
            } catch (e: Exception) {
                return "HMAC verification error: ${e.message}"
            }
        }

        return null
    }

    // =========================================================================
    // Payload Processing & Remote Fetching
    // =========================================================================

    private fun processBase64Payload(jobId: String, base64: String, is80mm: Boolean) {
        try {
            val decodedBytes = Base64.decode(base64, Base64.DEFAULT)
            val jsonString = String(decodedBytes, Charsets.UTF_8)

            // Try decoding as SaleModel
            val sale = gson.fromJson(jsonString, SaleModel::class.java)
            if (sale?.number != null && sale.items != null) {
                val receiptBytes = EscPosUtil.buildReceipt(sale, is80mm)
                recordJob(
                    id = jobId,
                    state = JobState.Printing,
                    billNumber = sale.number,
                    totalAmount = String.format("Rs. %.2f", sale.total),
                    byteCount = receiptBytes.size
                )
                executePrint(jobId, receiptBytes)
            } else {
                // If not JSON sale, print raw decoded bytes
                recordJob(jobId, JobState.Printing, byteCount = decodedBytes.size)
                executePrint(jobId, decodedBytes)
            }
        } catch (e: Exception) {
            val msg = "Error parsing receipt payload: ${e.localizedMessage}"
            recordJob(jobId, JobState.Failed(msg))
            postError(msg)
        }
    }

    private fun fetchRemoteJob(jobId: String, endpoint: String, token: String?, is80mm: Boolean) {
        recordJob(jobId, JobState.Fetching)

        scope.launch {
            try {
                val json = withContext(Dispatchers.IO) {
                    val url = URL(endpoint)
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "GET"
                    conn.setRequestProperty("Accept", "application/json")
                    if (token != null) {
                        conn.setRequestProperty("Authorization", "Bearer $token")
                    }
                    conn.connectTimeout = 8000
                    conn.readTimeout = 8000

                    if (conn.responseCode !in 200..299) {
                        throw Exception("HTTP Error: ${conn.responseCode} ${conn.responseMessage}")
                    }

                    conn.inputStream.bufferedReader().use { it.readText() }
                }

                val sale = gson.fromJson(json, SaleModel::class.java)
                val receiptBytes = EscPosUtil.buildReceipt(sale, is80mm)

                updateJob(
                    id = jobId,
                    state = JobState.Printing,
                    billNumber = sale.number,
                    totalAmount = String.format("Rs. %.2f", sale.total),
                    byteCount = receiptBytes.size
                )
                executePrint(jobId, receiptBytes)

            } catch (e: Exception) {
                val msg = "Remote fetch failed: ${e.localizedMessage}"
                updateJob(jobId, JobState.Failed(msg))
                postError(msg)
            }
        }
    }

    private fun executePrint(jobId: String, data: ByteArray) {
        scope.launch {
            val result = printerManager.printData(data)
            result.fold(
                onSuccess = {
                    updateJob(jobId, JobState.Completed)
                    _notificationMessage.value = "Receipt #$jobId printed successfully!"
                },
                onFailure = { err ->
                    val msg = "Print failed: ${err.localizedMessage}"
                    updateJob(jobId, JobState.Failed(msg))
                    postError(msg)
                }
            )
        }
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private fun recordJob(id: String, state: JobState, billNumber: String? = null, totalAmount: String? = null, byteCount: Int? = null) {
        val list = _recentJobs.value.toMutableList()
        list.add(0, PrintJobItem(id, Date(), state, billNumber, totalAmount, byteCount))
        if (list.size > 30) list.removeAt(list.size - 1)
        _recentJobs.value = list
    }

    private fun updateJob(id: String, state: JobState, billNumber: String? = null, totalAmount: String? = null, byteCount: Int? = null) {
        val list = _recentJobs.value.toMutableList()
        val index = list.indexOfFirst { it.id == id }
        if (index >= 0) {
            val item = list[index]
            list[index] = item.copy(
                state = state,
                billNumber = billNumber ?: item.billNumber,
                totalAmount = totalAmount ?: item.totalAmount,
                byteCount = byteCount ?: item.byteCount
            )
            _recentJobs.value = list
        }
    }

    private fun postError(msg: String) {
        Log.e(TAG, msg)
        _notificationMessage.value = msg
    }
}
