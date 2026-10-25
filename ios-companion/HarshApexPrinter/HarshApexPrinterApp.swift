//
//  HarshApexPrinterApp.swift
//  HarshApexPrinter
//
//  Created for Harsh Apex POS Companion on iOS.
//  SwiftUI App entry point with deep link interception.
//

import SwiftUI

@main
struct HarshApexPrinterApp: App {
    @StateObject private var printerManager = BLEPrinterManager()
    @StateObject private var deepLinkHandler = DeepLinkPrintHandler()

    var body: some Scene {
        WindowGroup {
            ContentView(
                printerManager: printerManager,
                deepLinkHandler: deepLinkHandler
            )
            .onOpenURL { incomingUrl in
                print("[HarshApexPrinterApp] Received deep link: \(incomingUrl)")
                deepLinkHandler.handleDeepLink(url: incomingUrl, printer: printerManager)
            }
        }
    }
}
