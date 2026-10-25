//
//  DeepLinkPrintHandler.swift
//  HarshApexPrinter
//
//  Created for Harsh Apex POS Companion on iOS.
//  Parses deep links (e.g. harsh-apex-print://job?id=...&token=...),
//  validates short-lived tokens, prevents replay attacks, decodes or fetches receipts,
//  and orchestrates printing via BLEPrinterManager.
//

import Foundation
import Combine
import CryptoKit

public enum PrintJobStatus: Equatable {
    case received
    case validating
    case fetching
    case printing
    case completed
    case rejected(reason: String)
    case failed(error: String)
}

public struct IncomingPrintJob: Identifiable, Equatable {
    public let id: String
    public let timestamp: Date
    public var status: PrintJobStatus
    public var billNumber: String?
    public var totalAmount: String?
    public var rawByteCount: Int?

    public static func == (lhs: IncomingPrintJob, rhs: IncomingPrintJob) -> Bool {
        lhs.id == rhs.id && lhs.status == rhs.status
    }
}

public final class DeepLinkPrintHandler: ObservableObject {

    // MARK: - Published State
    @Published public private(set) var recentJobs: [IncomingPrintJob] = []
    @Published public var activeAlertMessage: String? = nil
    @Published public var showJobNotification: Bool = false

    // MARK: - Replay Attack Prevention Cache
    /// Thread-safe in-memory cache of processed job IDs with timestamps
    private var processedJobIds: [String: Date] = [:]
    private let cacheLock = NSLock()
    private let maxCacheAgeSeconds: TimeInterval = 3600 // 1 hour retention
    private let maxAllowedTokenDriftSeconds: TimeInterval = 300 // 5 minutes max expiration window

    // MARK: - Optional Shared Secret for HMAC Verification (configured by POS merchant)
    public var hmacSecret: String = "apex-pos-secure-ble-key-2026"

    public init() {
        startCacheJanitor()
    }

    // MARK: - Deep Link Parsing Entry Point

    /// Handles incoming deep links: harsh-apex-print://job?... or harsh-apex-print://print?...
    public func handleDeepLink(url: URL, printer: BLEPrinterManager) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
              components.scheme?.lowercased() == "harsh-apex-print" else {
            notifyError("Invalid URL scheme. Expected 'harsh-apex-print://'")
            return
        }

        let host = components.host?.lowercased()
        let queryItems = components.queryItems ?? []
        let params = Dictionary(uniqueKeysWithValues: queryItems.compactMap { item in
            item.value != nil ? (item.name, item.value!) : nil
        })

        if host == "job" {
            processJobLink(params: params, printer: printer)
        } else if host == "print" {
            processDirectPrintLink(params: params, printer: printer)
        } else {
            notifyError("Unknown deep link action: \(host ?? "nil")")
        }
    }

    // MARK: - Job Workflow (harsh-apex-print://job?id=...&token=...&ts=...&payload=...)

    private func processJobLink(params: [String: String], printer: BLEPrinterManager) {
        guard let jobId = params["id"], !jobId.isEmpty else {
            notifyError("Missing required 'id' parameter in print job.")
            return
        }

        // 1. Replay Attack Prevention
        if isReplayAttack(jobId: jobId) {
            recordJob(id: jobId, status: .rejected(reason: "Replay attack detected: Job ID '\(jobId)' has already been printed."))
            notifyError("Duplicate Print Job Blocked: Replay attack prevention active for ID \(jobId).")
            return
        }

        // 2. Short-lived Security Token & Timestamp Validation
        let token = params["token"]
        let timestampStr = params["ts"]
        if let validationError = validateSecurityToken(jobId: jobId, token: token, timestampStr: timestampStr) {
            recordJob(id: jobId, status: .rejected(reason: validationError))
            notifyError("Security Verification Failed: \(validationError)")
            return
        }

        // Mark Job ID as processed to lock against concurrent replay
        markJobProcessed(jobId: jobId)

        let is80mm = (params["width"]?.lowercased() == "80mm")

        // 3. Process Payload or Remote Endpoint
        if let base64Payload = params["payload"], !base64Payload.isEmpty {
            parseAndPrintPayload(jobId: jobId, base64: base64Payload, is80mm: is80mm, printer: printer)
        } else if let endpointUrlStr = params["endpoint"], let endpointUrl = URL(string: endpointUrlStr) {
            fetchRemoteJobAndPrint(jobId: jobId, url: endpointUrl, token: token, is80mm: is80mm, printer: printer)
        } else {
            let error = "No payload or endpoint provided for job ID \(jobId)."
            recordJob(id: jobId, status: .rejected(reason: error))
            notifyError(error)
        }
    }

    // MARK: - Direct Print Workflow (harsh-apex-print://print?raw=<base64-esc-pos>)

    private func processDirectPrintLink(params: [String: String], printer: BLEPrinterManager) {
        guard let base64Raw = params["raw"],
              let rawData = Data(base64Encoded: base64Raw) else {
            notifyError("Invalid or missing base64 raw ESC/POS payload.")
            return
        }

        let jobId = "RAW-\(Int(Date().timeIntervalSince1970))"
        recordJob(id: jobId, status: .printing, rawByteCount: rawData.count)

        executePrint(data: rawData, jobId: jobId, printer: printer)
    }

    // MARK: - Security & Validation Logic

    private func validateSecurityToken(jobId: String, token: String?, timestampStr: String?) -> String? {
        guard let token = token, !token.isEmpty else {
            return "Security token is missing from the print request."
        }

        // Validate timestamp freshness if provided
        if let tsStr = timestampStr, let tsUnix = TimeInterval(tsStr) {
            let now = Date().timeIntervalSince1970
            let diff = abs(now - tsUnix)
            if diff > maxAllowedTokenDriftSeconds {
                return "Token expired: Request timestamp is older than \(Int(maxAllowedTokenDriftSeconds))s (drift: \(Int(diff))s)."
            }
        }

        // Validate HMAC signature if token matches "hmac.<signature>"
        if token.hasPrefix("hmac.") {
            let signature = String(token.dropFirst(5))
            let dataToSign = "\(jobId):\(timestampStr ?? "")"
            let key = SymmetricKey(data: hmacSecret.data(using: .utf8)!)
            let expectedHmac = HMAC<SHA256>.authenticationCode(for: dataToSign.data(using: .utf8)!, using: key)
            let expectedHex = expectedHmac.map { String(format: "%02x", $0) }.joined()

            if signature.lowercased() != expectedHex.lowercased() {
                return "Invalid HMAC cryptographic signature."
            }
        }

        return nil
    }

    private func isReplayAttack(jobId: String) -> Bool {
        cacheLock.lock()
        defer { cacheLock.unlock() }
        return processedJobIds[jobId] != nil
    }

    private func markJobProcessed(jobId: String) {
        cacheLock.lock()
        defer { cacheLock.unlock() }
        processedJobIds[jobId] = Date()
    }

    // MARK: - Payload Processing

    private func parseAndPrintPayload(jobId: String, base64: String, is80mm: Bool, printer: BLEPrinterManager) {
        guard let payloadData = Data(base64Encoded: base64) else {
            let error = "Malformed base64 payload."
            recordJob(id: jobId, status: .rejected(reason: error))
            notifyError(error)
            return
        }

        // Try JSON decoding into SalePayload
        let decoder = JSONDecoder()
        if let sale = try? decoder.decode(SalePayload.self, from: payloadData) {
            let formattedReceipt = EscPosFormatter.buildReceipt(sale: sale, is80mm: is80mm)
            recordJob(
                id: jobId,
                status: .printing,
                billNumber: sale.number,
                totalAmount: String(format: "Rs. %.2f", sale.total),
                rawByteCount: formattedReceipt.count
            )
            executePrint(data: formattedReceipt, jobId: jobId, printer: printer)
        } else {
            // Assume raw ESC/POS bytes if not JSON
            recordJob(id: jobId, status: .printing, rawByteCount: payloadData.count)
            executePrint(data: payloadData, jobId: jobId, printer: printer)
        }
    }

    private func fetchRemoteJobAndPrint(jobId: String, url: URL, token: String?, is80mm: Bool, printer: BLEPrinterManager) {
        recordJob(id: jobId, status: .fetching)

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let t = token {
            request.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }

            DispatchQueue.main.async {
                if let err = error {
                    let msg = "Network fetch error: \(err.localizedDescription)"
                    self.updateJobStatus(id: jobId, status: .failed(error: msg))
                    self.notifyError(msg)
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode),
                      let responseData = data else {
                    let msg = "HTTP error fetching job from server."
                    self.updateJobStatus(id: jobId, status: .failed(error: msg))
                    self.notifyError(msg)
                    return
                }

                let decoder = JSONDecoder()
                if let sale = try? decoder.decode(SalePayload.self, from: responseData) {
                    let receiptData = EscPosFormatter.buildReceipt(sale: sale, is80mm: is80mm)
                    self.updateJobStatus(
                        id: jobId,
                        status: .printing,
                        billNumber: sale.number,
                        totalAmount: String(format: "Rs. %.2f", sale.total),
                        rawByteCount: receiptData.count
                    )
                    self.executePrint(data: receiptData, jobId: jobId, printer: printer)
                } else {
                    let msg = "Could not parse server response as valid sale receipt."
                    self.updateJobStatus(id: jobId, status: .failed(error: msg))
                    self.notifyError(msg)
                }
            }
        }.resume()
    }

    // MARK: - Execute Print via BLE

    private func executePrint(data: Data, jobId: String, printer: BLEPrinterManager) {
        printer.sendData(data) { [weak self] result in
            guard let self = self else { return }
            DispatchQueue.main.async {
                switch result {
                case .success:
                    self.updateJobStatus(id: jobId, status: .completed)
                    self.activeAlertMessage = "Receipt #\(jobId) printed successfully!"
                    self.showJobNotification = true
                case .failure(let error):
                    let msg = "Print failed: \(error.localizedDescription)"
                    self.updateJobStatus(id: jobId, status: .failed(error: msg))
                    self.notifyError(msg)
                }
            }
        }
    }

    // MARK: - State & Cache Management

    private func recordJob(id: String, status: PrintJobStatus, billNumber: String? = nil, totalAmount: String? = nil, rawByteCount: Int? = nil) {
        let job = IncomingPrintJob(
            id: id,
            timestamp: Date(),
            status: status,
            billNumber: billNumber,
            totalAmount: totalAmount,
            rawByteCount: rawByteCount
        )
        recentJobs.insert(job, at: 0)
        if recentJobs.count > 30 {
            recentJobs.removeLast()
        }
    }

    private func updateJobStatus(id: String, status: PrintJobStatus, billNumber: String? = nil, totalAmount: String? = nil, rawByteCount: Int? = nil) {
        if let idx = recentJobs.firstIndex(where: { $0.id == id }) {
            recentJobs[idx].status = status
            if let bill = billNumber { recentJobs[idx].billNumber = bill }
            if let total = totalAmount { recentJobs[idx].totalAmount = total }
            if let bytes = rawByteCount { recentJobs[idx].rawByteCount = bytes }
        }
    }

    private func notifyError(_ message: String) {
        activeAlertMessage = message
        showJobNotification = true
    }

    private func startCacheJanitor() {
        Timer.scheduledTimer(withTimeInterval: 600, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.cacheLock.lock()
            defer { self.cacheLock.unlock() }
            let cutoff = Date().addingTimeInterval(-self.maxCacheAgeSeconds)
            self.processedJobIds = self.processedJobIds.filter { $0.value > cutoff }
        }
    }
}
