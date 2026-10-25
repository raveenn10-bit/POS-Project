package lk.harshapex.posprinter

import java.io.ByteArrayOutputStream
import java.nio.charset.Charset
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * High-performance ESC/POS byte builder and receipt formatter for Kotlin / Android.
 * Supports standard 58mm (32 column) and 80mm (48 column) thermal printers.
 */
class EscPosUtil {

    private val outputStream = ByteArrayOutputStream()
    private val charsetWindows1252 = Charset.forName("windows-1252")

    companion object {
        // Standard ESC/POS Control Bytes
        const val ESC: Byte = 0x1B
        const val FS: Byte = 0x1C
        const val GS: Byte = 0x1D
        const val LF: Byte = 0x0A
        const val CR: Byte = 0x0D
        const val DLE: Byte = 0x10

        // Alignment Constants
        const val ALIGN_LEFT: Byte = 0
        const val ALIGN_CENTER: Byte = 1
        const val ALIGN_RIGHT: Byte = 2

        // Font Selection
        const val FONT_A: Byte = 0 // Standard (12x24 dots)
        const val FONT_B: Byte = 1 // Compact (9x17 dots)

        // Standard SPP UUID
        const val SPP_UUID_STRING = "00001101-0000-1000-8000-00805F9B34FB"
    }

    /**
     * Clears print buffer and resets printer hardware to factory defaults (ESC @)
     */
    fun initialize(): EscPosUtil {
        outputStream.write(byteArrayOf(ESC, 0x40))
        return this
    }

    /**
     * Set text alignment (ESC a n: 0=Left, 1=Center, 2=Right)
     */
    fun align(alignment: Byte): EscPosUtil {
        outputStream.write(byteArrayOf(ESC, 0x61, alignment))
        return this
    }

    /**
     * Set font type (ESC M n)
     */
    fun font(fontType: Byte): EscPosUtil {
        outputStream.write(byteArrayOf(ESC, 0x4D, fontType))
        return this
    }

    /**
     * Toggle Bold text (ESC E n)
     */
    fun bold(enable: Boolean): EscPosUtil {
        outputStream.write(byteArrayOf(ESC, 0x45, if (enable) 1 else 0))
        return this
    }

    /**
     * Toggle Underline (ESC - n)
     */
    fun underline(enable: Boolean, thick: Boolean = false): EscPosUtil {
        val mode: Byte = if (enable) (if (thick) 2 else 1) else 0
        outputStream.write(byteArrayOf(ESC, 0x2D, mode))
        return this
    }

    /**
     * Toggle Inverse (White on Black) printing (GS B n)
     */
    fun invert(enable: Boolean): EscPosUtil {
        outputStream.write(byteArrayOf(GS, 0x42, if (enable) 1 else 0))
        return this
    }

    /**
     * Set text size multiplier (GS ! n)
     * @param widthMultiplier 1..8
     * @param heightMultiplier 1..8
     */
    fun textSize(widthMultiplier: Int, heightMultiplier: Int): EscPosUtil {
        val w = (widthMultiplier.coerceIn(1, 8) - 1).toByte()
        val h = (heightMultiplier.coerceIn(1, 8) - 1).toByte()
        val n = ((w.toInt() shl 4) or h.toInt()).toByte()
        outputStream.write(byteArrayOf(GS, 0x21, n))
        return this
    }

    /**
     * Reset text size to normal 1x1
     */
    fun normalSize(): EscPosUtil {
        return textSize(1, 1)
    }

    /**
     * Append text with fallback encoding
     */
    fun text(string: String): EscPosUtil {
        val bytes = try {
            string.toByteArray(charsetWindows1252)
        } catch (e: Exception) {
            string.toByteArray(Charsets.UTF_8)
        }
        outputStream.write(bytes)
        return this
    }

    /**
     * Append text followed by a newline (LF)
     */
    fun line(string: String = ""): EscPosUtil {
        text(string)
        outputStream.write(LF.toInt())
        return this
    }

    /**
     * Feeds n blank lines (ESC d n)
     */
    fun feed(lines: Int = 1): EscPosUtil {
        val n = lines.coerceIn(1, 255).toByte()
        outputStream.write(byteArrayOf(ESC, 0x64, n))
        return this
    }

    /**
     * Paper cut command (GS V 66 n: partial cut with paper feed)
     */
    fun cut(full: Boolean = false, feedLines: Int = 3): EscPosUtil {
        feed(feedLines)
        val mode: Byte = if (full) 65 else 66
        outputStream.write(byteArrayOf(GS, 0x56, mode, 0x00))
        return this
    }

    /**
     * Pulse cash drawer connector pin to open cash drawer (ESC p m t1 t2)
     */
    fun kickCashDrawer(pin: Byte = 0, onTimeMs: Byte = 30, offTimeMs: Byte = 250.toByte()): EscPosUtil {
        outputStream.write(byteArrayOf(ESC, 0x70, pin, onTimeMs, offTimeMs))
        return this
    }

    /**
     * Print horizontal divider line, e.g. "--------------------------------"
     */
    fun divider(char: Char = '-', totalWidth: Int = 32): EscPosUtil {
        line(char.toString().repeat(totalWidth))
        return this
    }

    /**
     * Formats a 2-column key-value row with space padding
     */
    fun twoColumnRow(left: String, right: String, totalWidth: Int = 32): EscPosUtil {
        if (left.length + right.length >= totalWidth) {
            line(left)
            val spaces = (totalWidth - right.length).coerceAtLeast(0)
            line(" ".repeat(spaces) + right)
        } else {
            val spaces = totalWidth - (left.length + right.length)
            line(left + " ".repeat(spaces) + right)
        }
        return this
    }

    /**
     * Formats a 4-column item row for 80mm receipts
     */
    fun fourColumnRow(col1: String, col2: String, col3: String, col4: String, widths: IntArray = intArrayOf(20, 6, 10, 12)): EscPosUtil {
        val sb = StringBuilder()
        val cols = arrayOf(col1, col2, col3, col4)
        for (i in cols.indices) {
            val w = widths[i]
            val text = cols[i]
            if (i == cols.size - 1) {
                val spaces = (w - text.length).coerceAtLeast(0)
                sb.append(" ".repeat(spaces)).append(text)
            } else {
                val truncated = if (text.length > w) text.substring(0, w) else text
                val spaces = (w - truncated.length).coerceAtLeast(0)
                sb.append(truncated).append(" ".repeat(spaces))
            }
        }
        line(sb.toString())
        return this
    }

    /**
     * Prints a standard CODE128 1D Barcode
     */
    fun barcode128(data: String, height: Byte = 64, width: Byte = 2): EscPosUtil {
        val barcodeBytes = data.toByteArray(Charsets.US_ASCII)
        outputStream.write(byteArrayOf(GS, 0x68, height)) // Barcode height
        outputStream.write(byteArrayOf(GS, 0x77, width))  // Barcode width
        outputStream.write(byteArrayOf(GS, 0x48, 0x02))   // Text position below
        outputStream.write(byteArrayOf(GS, 0x6B, 73, barcodeBytes.size.toByte())) // CODE128
        outputStream.write(barcodeBytes)
        outputStream.write(LF.toInt())
        return this
    }

    /**
     * Prints a 2D QR Code using standard ESC/POS GS ( k commands
     */
    fun qrCode(data: String, moduleSize: Int = 6): EscPosUtil {
        val qrBytes = data.toByteArray(Charsets.UTF_8)
        val numBytes = qrBytes.size + 3
        val pL = (numBytes and 0xFF).toByte()
        val pH = ((numBytes shr 8) and 0xFF).toByte()

        // 1. Set model (Model 2)
        outputStream.write(byteArrayOf(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00))

        // 2. Set module size (1 to 16)
        val clampedSize = moduleSize.coerceIn(1, 16).toByte()
        outputStream.write(byteArrayOf(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, clampedSize))

        // 3. Set error correction level (Level M: 15%)
        outputStream.write(byteArrayOf(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 49))

        // 4. Store data in symbol storage area
        outputStream.write(byteArrayOf(GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30))
        outputStream.write(qrBytes)

        // 5. Print the QR symbol
        outputStream.write(byteArrayOf(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30))
        outputStream.write(LF.toInt())
        return this
    }

    /**
     * Append raw byte array
     */
    fun appendRaw(bytes: ByteArray): EscPosUtil {
        outputStream.write(bytes)
        return this
    }

    /**
     * Build and return final ESC/POS byte array
     */
    fun build(): ByteArray {
        return outputStream.toByteArray()
    }

    // =========================================================================
    // High-Level Receipt Builder for Harsh Apex POS
    // =========================================================================

    companion object ReceiptFactory {

        fun buildReceipt(sale: SaleModel, is80mm: Boolean = false): ByteArray {
            val width = if (is80mm) 48 else 32
            val shop = sale.shop ?: ShopInfoModel(
                name = "Harsh Apex POS",
                address = "Galle Road, Colombo, Sri Lanka",
                phone = "+94 77 123 4567"
            )

            val builder = EscPosUtil()

            // 1. Header
            builder.initialize()
                .align(ALIGN_CENTER)
                .textSize(2, 2)
                .bold(true)
                .line(shop.name)
                .normalSize()
                .bold(false)

            shop.address?.takeIf { it.isNotBlank() }?.let { builder.line(it) }
            shop.phone?.takeIf { it.isNotBlank() }?.let { builder.line("Tel: $it") }
            shop.regNo?.takeIf { it.isNotBlank() }?.let { builder.line("BRN/Tax: $it") }

            builder.divider('-', width)

            // 2. Bill Meta
            builder.align(ALIGN_LEFT)
                .bold(true)
                .line("Bill No: ${sale.number}")
                .bold(false)

            val timeMs = if (sale.at > 10000000000L) sale.at else sale.at * 1000L
            val dateStr = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(timeMs))
            builder.line("Date: $dateStr")
            builder.line("Payment: ${sale.method.uppercase()}")

            if (sale.isCredit == true) {
                builder.bold(true)
                    .line("*** CREDIT BILL (${if (sale.creditSettled == true) "SETTLED" else "UNPAID"}) ***")
                    .bold(false)
                sale.creditCustomer?.let { builder.line("Customer: $it") }
                sale.creditPhone?.let { builder.line("Contact: $it") }
            }

            if (sale.status == "voided") {
                builder.bold(true)
                    .invert(true)
                    .line(" *** VOIDED / RETURNED BILL *** ")
                    .invert(false)
                    .bold(false)
            }

            builder.divider('-', width)

            // 3. Items Table
            builder.bold(true)
            if (is80mm) {
                builder.fourColumnRow("Item", "Qty", "Price", "Amount")
            } else {
                builder.twoColumnRow("Item / Qty", "Amount (Rs.)", width)
            }
            builder.bold(false)
            builder.divider('-', width)

            for (item in sale.items) {
                val itemTotal = item.total ?: (item.qty * item.price)
                val totalStr = String.format(Locale.US, "%.2f", itemTotal)
                val qtyStr = if (item.qty % 1.0 == 0.0) item.qty.toInt().toString() else String.format(Locale.US, "%.2f", item.qty)

                if (is80mm) {
                    val priceStr = String.format(Locale.US, "%.2f", item.price)
                    builder.fourColumnRow(item.name, qtyStr, priceStr, totalStr)
                } else {
                    builder.bold(true).line(item.name).bold(false)
                    val detail = "  $qtyStr x ${String.format(Locale.US, "%.2f", item.price)}"
                    builder.twoColumnRow(detail, totalStr, width)
                }
            }

            builder.divider('-', width)

            // 4. Totals (Formatted in Sri Lankan Rupees)
            builder.twoColumnRow("Subtotal:", String.format(Locale.US, "Rs. %.2f", sale.subtotal), width)
            if (sale.discount > 0) {
                builder.twoColumnRow("Discount:", String.format(Locale.US, "- Rs. %.2f", sale.discount), width)
            }

            builder.bold(true)
                .textSize(1, 2)
                .twoColumnRow("Grand Total:", String.format(Locale.US, "Rs. %.2f", sale.total), width)
                .normalSize()
                .bold(false)

            builder.twoColumnRow("Amount Paid:", String.format(Locale.US, "Rs. %.2f", sale.received), width)
            builder.twoColumnRow("Change/Bal:", String.format(Locale.US, "Rs. %.2f", sale.change), width)

            builder.divider('-', width)

            // 5. Verification QR Code
            val qrContent = sale.verificationUrl ?: "harsh-apex-verify://bill/${sale.number}"
            builder.align(ALIGN_CENTER)
                .qrCode(qrContent, moduleSize = if (is80mm) 6 else 5)
                .line("Scan to verify receipt")
                .feed(1)

            // 6. Footer
            val footer = shop.receiptFooter?.takeIf { it.isNotBlank() } ?: "Thank you for your business!"
            builder.line(footer)
            builder.line("Powered by Harsh Apex POS")

            // 7. Cut & Drawer
            builder.cut(full = false, feedLines = 3)
            builder.kickCashDrawer()

            return builder.build()
        }
    }
}

// Data models matching Harsh Apex POS
data class ReceiptItemModel(
    val name: String,
    val qty: Double,
    val price: Double,
    val total: Double? = null
)

data class ShopInfoModel(
    val name: String,
    val address: String? = null,
    val phone: String? = null,
    val regNo: String? = null,
    val receiptFooter: String? = null,
    val receiptWidth: String? = "58mm"
)

data class SaleModel(
    val number: String,
    val at: Long,
    val method: String,
    val items: List<ReceiptItemModel>,
    val subtotal: Double,
    val discount: Double,
    val total: Double,
    val received: Double,
    val change: Double,
    val isCredit: Boolean? = false,
    val creditSettled: Boolean? = false,
    val creditCustomer: String? = null,
    val creditPhone: String? = null,
    val status: String? = null,
    val shop: ShopInfoModel? = null,
    val verificationUrl: String? = null
)
