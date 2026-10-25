//
//  EscPosFormatter.swift
//  HarshApexPrinter
//
//  Created for Harsh Apex POS Companion on iOS.
//  High-performance ESC/POS byte builder for thermal receipt printers.
//

import Foundation

public final class EscPosFormatter {

    // MARK: - Standard ESC/POS Command Constants
    public static let ESC: UInt8 = 0x1B
    public static let FS:  UInt8 = 0x1C
    public static let GS:  UInt8 = 0x1D
    public static let LF:  UInt8 = 0x0A
    public static let CR:  UInt8 = 0x0D
    public static let HT:  UInt8 = 0x09
    public static let DLE: UInt8 = 0x10

    // MARK: - Enums
    public enum Alignment: UInt8 {
        case left   = 0
        case center = 1
        case right  = 2
    }

    public enum FontType: UInt8 {
        case fontA = 0 // Typically 12x24 dots (32 chars on 58mm, 48 on 80mm)
        case fontB = 1 // Typically 9x17 dots (42 chars on 58mm, 64 on 80mm)
    }

    public enum TextSize: UInt8 {
        case normal     = 0x00
        case doubleHeight = 0x01
        case doubleWidth  = 0x10
        case doubleBoth   = 0x11
        case tripleBoth   = 0x22
        case quadBoth     = 0x33
    }

    public enum QrErrorCorrection: UInt8 {
        case levelL = 48 // 7%
        case levelM = 49 // 15%
        case levelQ = 50 // 25%
        case levelH = 51 // 30%
    }

    public enum CashDrawerPin: UInt8 {
        case pin2 = 0 // Connector pin 2
        case pin5 = 1 // Connector pin 5
    }

    // MARK: - Buffer
    private var buffer = Data()

    public init() {
        initialize()
    }

    // MARK: - Core Control Commands

    /// Clears data in print buffer and resets printer modes to defaults (ESC @)
    @discardableResult
    public func initialize() -> EscPosFormatter {
        buffer.append(contentsOf: [EscPosFormatter.ESC, 0x40])
        return self
    }

    /// Set text alignment (ESC a n)
    @discardableResult
    public func align(_ alignment: Alignment) -> EscPosFormatter {
        buffer.append(contentsOf: [EscPosFormatter.ESC, 0x61, alignment.rawValue])
        return self
    }

    /// Set font type A or B (ESC M n)
    @discardableResult
    public func font(_ type: FontType) -> EscPosFormatter {
        buffer.append(contentsOf: [EscPosFormatter.ESC, 0x4D, type.rawValue])
        return self
    }

    /// Turn bold mode on/off (ESC E n)
    @discardableResult
    public func bold(_ enabled: Bool) -> EscPosFormatter {
        buffer.append(contentsOf: [EscPosFormatter.ESC, 0x45, enabled ? 1 : 0])
        return self
    }

    /// Turn underline mode on/off (ESC - n)
    @discardableResult
    public func underline(_ enabled: Bool, thick: Bool = false) -> EscPosFormatter {
        let val: UInt8 = enabled ? (thick ? 2 : 1) : 0
        buffer.append(contentsOf: [EscPosFormatter.ESC, 0x2D, val])
        return self
    }

    /// Turn white/black inverted printing mode on/off (GS B n)
    @discardableResult
    public func invert(_ enabled: Bool) -> EscPosFormatter {
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x42, enabled ? 1 : 0])
        return self
    }

    /// Set character size multiplier (GS ! n)
    @discardableResult
    public func size(_ size: TextSize) -> EscPosFormatter {
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x21, size.rawValue])
        return self
    }

    /// Set custom character width & height multipliers (1...8)
    @discardableResult
    public func customSize(widthMultiplier: Int, heightMultiplier: Int) -> EscPosFormatter {
        let w = UInt8(clamping: max(0, min(7, widthMultiplier - 1)))
        let h = UInt8(clamping: max(0, min(7, heightMultiplier - 1)))
        let n = (w << 4) | h
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x21, n])
        return self
    }

    /// Append raw text encoded in ASCII / Windows-1252 / UTF-8
    @discardableResult
    public func text(_ string: String, encoding: String.Encoding = .windowsCP1252) -> EscPosFormatter {
        if let encoded = string.data(using: encoding, allowLossyConversion: true) {
            buffer.append(encoded)
        } else if let utf8 = string.data(using: .utf8) {
            buffer.append(utf8)
        }
        return self
    }

    /// Append text followed by a Line Feed
    @discardableResult
    public func line(_ string: String = "", encoding: String.Encoding = .windowsCP1252) -> EscPosFormatter {
        text(string, encoding: encoding)
        buffer.append(EscPosFormatter.LF)
        return self
    }

    /// Feeds n lines (ESC d n)
    @discardableResult
    public func feed(lines: Int = 1) -> EscPosFormatter {
        let n = UInt8(clamping: max(1, min(255, lines)))
        buffer.append(contentsOf: [EscPosFormatter.ESC, 0x64, n])
        return self
    }

    /// Cut paper (GS V 66 n: partial cut with paper feed)
    @discardableResult
    public func cut(full: Bool = false, feedLines: Int = 3) -> EscPosFormatter {
        feed(lines: feedLines)
        let mode: UInt8 = full ? 65 : 66
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x56, mode, 0x00])
        return self
    }

    /// Pulse cash drawer connector pin to open cash drawer (ESC p m t1 t2)
    @discardableResult
    public func kickCashDrawer(pin: CashDrawerPin = .pin2, onTimeMs: UInt8 = 30, offTimeMs: UInt8 = 250) -> EscPosFormatter {
        buffer.append(contentsOf: [EscPosFormatter.ESC, 0x70, pin.rawValue, onTimeMs, offTimeMs])
        return self
    }

    // MARK: - Tabular Layout Helpers

    /// Creates a full-width separator line, e.g. "--------------------------------"
    @discardableResult
    public func divider(character: Character = "-", totalWidth: Int = 32) -> EscPosFormatter {
        let str = String(repeating: character, count: totalWidth)
        return line(str)
    }

    /// Formats a 2-column key-value row with automatic space padding, e.g.:
    /// "Subtotal:              Rs. 1,450.00"
    @discardableResult
    public func twoColumnRow(left: String, right: String, totalWidth: Int = 32) -> EscPosFormatter {
        let leftLen = left.count
        let rightLen = right.count
        if leftLen + rightLen >= totalWidth {
            // Left text wraps to its own line if it exceeds available space
            line(left)
            let spaces = max(0, totalWidth - rightLen)
            let paddedRight = String(repeating: " ", count: spaces) + right
            return line(paddedRight)
        } else {
            let spaces = totalWidth - (leftLen + rightLen)
            let row = left + String(repeating: " ", count: spaces) + right
            return line(row)
        }
    }

    /// Formats a 3-column receipt row (Item Name, Qty x Price, Line Total)
    @discardableResult
    public func threeColumnRow(col1: String, col2: String, col3: String, totalWidth: Int = 32) -> EscPosFormatter {
        let rightPart = col2 + "  " + col3
        return twoColumnRow(left: col1, right: rightPart, totalWidth: totalWidth)
    }

    // MARK: - Barcode & QR Code

    /// Prints a standard CODE128 1D Barcode
    @discardableResult
    public func barcode128(data: String, height: UInt8 = 64, width: UInt8 = 2) -> EscPosFormatter {
        guard let barcodeData = data.data(using: .ascii) else { return self }
        // Set barcode height
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x68, height])
        // Set barcode module width
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x77, width])
        // Print HRI characters below barcode
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x48, 0x02])
        // Print CODE128: GS k 73 [len] [bytes]
        let length = UInt8(clamping: barcodeData.count)
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x6B, 73, length])
        buffer.append(barcodeData)
        buffer.append(EscPosFormatter.LF)
        return self
    }

    /// Prints a 2D QR Code using standard ESC/POS GS ( k commands
    @discardableResult
    public func qrCode(data: String, moduleSize: UInt8 = 6, errorCorrection: QrErrorCorrection = .levelM) -> EscPosFormatter {
        guard let qrBytes = data.data(using: .utf8) else { return self }
        let numBytes = qrBytes.count + 3
        let pL = UInt8(numBytes & 0xFF)
        let pH = UInt8((numBytes >> 8) & 0xFF)

        // 1. Set model (Model 2)
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00])

        // 2. Set module size (1 to 16)
        let clampedSize = max(1, min(16, moduleSize))
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, clampedSize])

        // 3. Set error correction level
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, errorCorrection.rawValue])

        // 4. Store data in symbol storage area
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30])
        buffer.append(qrBytes)

        // 5. Print the QR symbol
        buffer.append(contentsOf: [EscPosFormatter.GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30])
        buffer.append(EscPosFormatter.LF)
        return self
    }

    // MARK: - Output Data
    public func build() -> Data {
        return buffer
    }

    public func appendRaw(_ data: Data) -> EscPosFormatter {
        buffer.append(data)
        return self
    }
}

// MARK: - Harsh Apex POS Models & Receipt Generator
public struct ReceiptItem: Codable {
    public let name: String
    public let qty: Double
    public let price: Double
    public let total: Double?

    public init(name: String, qty: Double, price: Double, total: Double? = nil) {
        self.name = name
        self.qty = qty
        self.price = price
        self.total = total ?? (qty * price)
    }
}

public struct ShopInfo: Codable {
    public let name: String
    public let address: String?
    public let phone: String?
    public let regNo: String?
    public let receiptFooter: String?
    public let receiptWidth: String? // "58mm" or "80mm"

    public init(name: String, address: String? = nil, phone: String? = nil, regNo: String? = nil, receiptFooter: String? = nil, receiptWidth: String? = "58mm") {
        self.name = name
        self.address = address
        self.phone = phone
        self.regNo = regNo
        self.receiptFooter = receiptFooter
        self.receiptWidth = receiptWidth
    }
}

public struct SalePayload: Codable {
    public let number: String
    public let at: Double // Unix timestamp in ms
    public let method: String
    public let items: [ReceiptItem]
    public let subtotal: Double
    public let discount: Double
    public let total: Double
    public let received: Double
    public let change: Double
    public let isCredit: Bool?
    public let creditSettled: Bool?
    public let creditCustomer: String?
    public let creditPhone: String?
    public let status: String?
    public let shop: ShopInfo?
    public let verificationUrl: String?

    public init(
        number: String,
        at: Double,
        method: String,
        items: [ReceiptItem],
        subtotal: Double,
        discount: Double,
        total: Double,
        received: Double,
        change: Double,
        isCredit: Bool? = false,
        creditSettled: Bool? = false,
        creditCustomer: String? = nil,
        creditPhone: String? = nil,
        status: String? = nil,
        shop: ShopInfo? = nil,
        verificationUrl: String? = nil
    ) {
        self.number = number
        self.at = at
        self.method = method
        self.items = items
        self.subtotal = subtotal
        self.discount = discount
        self.total = total
        self.received = received
        self.change = change
        self.isCredit = isCredit
        self.creditSettled = creditSettled
        self.creditCustomer = creditCustomer
        self.creditPhone = creditPhone
        self.status = status
        self.shop = shop
        self.verificationUrl = verificationUrl
    }
}

extension EscPosFormatter {

    /// Generates a standardized, beautifully styled Harsh Apex POS thermal receipt
    public static func buildReceipt(sale: SalePayload, is80mm: Bool = false) -> Data {
        let width = is80mm ? 48 : 32
        let shop = sale.shop ?? ShopInfo(name: "Harsh Apex POS", address: "Galle Road, Colombo, Sri Lanka", phone: "+94 77 123 4567")
        let builder = EscPosFormatter()

        // 1. Header
        builder.initialize()
            .align(.center)
            .size(.doubleBoth)
            .bold(true)
            .line(shop.name)
            .size(.normal)
            .bold(false)

        if let address = shop.address, !address.isEmpty {
            builder.line(address)
        }
        if let phone = shop.phone, !phone.isEmpty {
            builder.line("Tel: \(phone)")
        }
        if let regNo = shop.regNo, !regNo.isEmpty {
            builder.line("BRN/Tax: \(regNo)")
        }

        builder.divider(character: "-", totalWidth: width)

        // 2. Bill Meta
        builder.align(.left)
            .bold(true)
            .line("Bill No: \(sale.number)")
            .bold(false)

        let date = Date(timeIntervalSince1970: sale.at > 10000000000 ? sale.at / 1000 : sale.at)
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        builder.line("Date: \(dateFormatter.string(from: date))")
        builder.line("Payment: \(sale.method.uppercased())")

        if sale.isCredit == true {
            builder.bold(true)
                .line("*** CREDIT BILL (\(sale.creditSettled == true ? "SETTLED" : "UNPAID")) ***")
                .bold(false)
            if let customer = sale.creditCustomer {
                builder.line("Customer: \(customer)")
            }
            if let phone = sale.creditPhone {
                builder.line("Contact: \(phone)")
            }
        }

        if sale.status == "voided" {
            builder.bold(true)
                .invert(true)
                .line(" *** VOIDED / RETURNED BILL *** ")
                .invert(false)
                .bold(false)
        }

        builder.divider(character: "-", totalWidth: width)

        // 3. Items Header
        builder.bold(true)
        if is80mm {
            builder.line(EscPosFormatter.padColumns(["Item", "Qty", "Price", "Amount"], widths: [20, 6, 10, 12]))
        } else {
            builder.twoColumnRow(left: "Item / Qty", right: "Amount (Rs.)", totalWidth: width)
        }
        builder.bold(false)
        builder.divider(character: "-", totalWidth: width)

        // 4. Item List
        for item in sale.items {
            let itemTotal = item.total ?? (item.qty * item.price)
            let formattedTotal = String(format: "%.2f", itemTotal)

            if is80mm {
                let qtyStr = String(format: item.qty.truncatingRemainder(dividingBy: 1) == 0 ? "%.0f" : "%.2f", item.qty)
                let priceStr = String(format: "%.2f", item.price)
                builder.line(EscPosFormatter.padColumns([item.name, qtyStr, priceStr, formattedTotal], widths: [20, 6, 10, 12]))
            } else {
                builder.bold(true).line(item.name).bold(false)
                let qtyStr = String(format: item.qty.truncatingRemainder(dividingBy: 1) == 0 ? "%.0f" : "%.2f", item.qty)
                let detail = "  \(qtyStr) x \(String(format: "%.2f", item.price))"
                builder.twoColumnRow(left: detail, right: formattedTotal, totalWidth: width)
            }
        }

        builder.divider(character: "-", totalWidth: width)

        // 5. Totals
        builder.twoColumnRow(left: "Subtotal:", right: String(format: "Rs. %.2f", sale.subtotal), totalWidth: width)
        if sale.discount > 0 {
            builder.twoColumnRow(left: "Discount:", right: String(format: "- Rs. %.2f", sale.discount), totalWidth: width)
        }

        builder.bold(true)
            .size(.doubleHeight)
            .twoColumnRow(left: "Grand Total:", right: String(format: "Rs. %.2f", sale.total), totalWidth: width)
            .size(.normal)
            .bold(false)

        builder.twoColumnRow(left: "Amount Paid:", right: String(format: "Rs. %.2f", sale.received), totalWidth: width)
        builder.twoColumnRow(left: "Change/Bal:", right: String(format: "Rs. %.2f", sale.change), totalWidth: width)

        builder.divider(character: "-", totalWidth: width)

        // 6. QR Code (if verification URL or bill number available)
        let qrPayload = sale.verificationUrl ?? "harsh-apex-verify://bill/\(sale.number)"
        builder.align(.center)
            .qrCode(data: qrPayload, moduleSize: is80mm ? 6 : 5)
            .line("Scan to verify receipt")
            .feed(lines: 1)

        // 7. Footer
        if let footer = shop.receiptFooter, !footer.isEmpty {
            builder.line(footer)
        } else {
            builder.line("Thank you for your business!")
        }
        builder.line("Powered by Harsh Apex POS")

        // 8. Cut and Kick Drawer
        builder.cut(full: false, feedLines: 3)
        builder.kickCashDrawer()

        return builder.build()
    }

    private static func padColumns(_ cols: [String], widths: [Int]) -> String {
        var result = ""
        for (i, col) in cols.enumerated() {
            let w = widths[i]
            let isLast = i == cols.count - 1
            if isLast {
                let spaces = max(0, w - col.count)
                result += String(repeating: " ", count: spaces) + col
            } else {
                let truncated = String(col.prefix(w))
                let spaces = max(0, w - truncated.count)
                result += truncated + String(repeating: " ", count: spaces)
            }
        }
        return result
    }
}
