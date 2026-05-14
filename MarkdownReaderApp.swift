import AppKit
import UniformTypeIdentifiers
import WebKit

private let readableExtensions = [
    "md",
    "markdown",
    "mdown",
    "mkdn",
    "txt",
    "csv",
    "tsv",
    "xls",
    "xlsx",
]

private let readableContentTypes = readableExtensions.compactMap {
    UTType(filenameExtension: $0)
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var pageLoaded = false
    private var readerLoadStarted = false
    private var pendingURLs: [URL] = []
    private var isDeliveringFile = false

    func applicationWillFinishLaunching(_ notification: Notification) {
        UserDefaults.standard.set(true, forKey: "ApplePersistenceIgnoreState")
        UserDefaults.standard.set(false, forKey: "NSQuitAlwaysKeepsWindows")
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenu()
        ensureWindow()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
            self?.loadReaderIfNeeded()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        pendingURLs.removeAll()
        isDeliveringFile = false
        webView?.stopLoading()
        webView?.navigationDelegate = nil
        webView?.uiDelegate = nil
        return .terminateNow
    }

    func application(_ application: NSApplication, shouldSaveSecureApplicationState coder: NSCoder) -> Bool {
        false
    }

    func application(_ application: NSApplication, shouldRestoreSecureApplicationState coder: NSCoder) -> Bool {
        false
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }

    func application(_ sender: NSApplication, openFiles filenames: [String]) {
        openURLs(filenames.map { URL(fileURLWithPath: $0) })
        sender.reply(toOpenOrPrint: .success)
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        openURLs(urls)
    }

    private func installMenu() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(
            NSMenuItem(
                title: "Quit Markdown Reader",
                action: #selector(NSApplication.terminate(_:)),
                keyEquivalent: "q"
            )
        )
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(
            NSMenuItem(
                title: "Undo",
                action: Selector(("undo:")),
                keyEquivalent: "z"
            )
        )
        let redoItem = NSMenuItem(
            title: "Redo",
            action: Selector(("redo:")),
            keyEquivalent: "Z"
        )
        redoItem.keyEquivalentModifierMask = [.command, .shift]
        editMenu.addItem(redoItem)
        editMenu.addItem(.separator())
        editMenu.addItem(
            NSMenuItem(
                title: "Cut",
                action: #selector(NSText.cut(_:)),
                keyEquivalent: "x"
            )
        )
        editMenu.addItem(
            NSMenuItem(
                title: "Copy",
                action: #selector(NSText.copy(_:)),
                keyEquivalent: "c"
            )
        )
        editMenu.addItem(
            NSMenuItem(
                title: "Paste",
                action: #selector(NSText.paste(_:)),
                keyEquivalent: "v"
            )
        )
        editMenu.addItem(
            NSMenuItem(
                title: "Select All",
                action: #selector(NSText.selectAll(_:)),
                keyEquivalent: "a"
            )
        )
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        let fileMenuItem = NSMenuItem()
        let fileMenu = NSMenu(title: "File")
        fileMenu.addItem(
            NSMenuItem(
                title: "Open...",
                action: #selector(openDocument(_:)),
                keyEquivalent: "o"
            )
        )
        fileMenuItem.submenu = fileMenu
        mainMenu.addItem(fileMenuItem)

        NSApp.mainMenu = mainMenu
    }

    private func ensureWindow() {
        if window != nil, webView != nil {
            return
        }

        let configuration = WKWebViewConfiguration()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Markdown Reader"
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.isRestorable = false
        window.center()
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func loadReaderIfNeeded() {
        guard !readerLoadStarted else {
            return
        }

        ensureWindow()
        readerLoadStarted = true

        guard let resourcesURL = Bundle.main.resourceURL else {
            return
        }

        let readerURL = resourcesURL.appendingPathComponent("reader", isDirectory: true)
        let indexURL = readerURL.appendingPathComponent("index.html")

        let bootstrapScript: String
        if !pendingURLs.isEmpty {
            let initialURL = pendingURLs.removeFirst()
            if let json = payloadJSON(for: initialURL) {
                bootstrapScript = """
                window.__MARKDOWN_READER_NATIVE__ = true;
                window.__MARKDOWN_READER_BOOTSTRAP__ = \(json);
                """
            } else {
                bootstrapScript = "window.__MARKDOWN_READER_NATIVE__ = true;"
            }
        } else {
            bootstrapScript = "window.__MARKDOWN_READER_NATIVE__ = true;"
        }

        webView.configuration.userContentController.removeAllUserScripts()
        webView.configuration.userContentController.addUserScript(
            WKUserScript(source: bootstrapScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        webView.loadFileURL(indexURL, allowingReadAccessTo: readerURL)
    }

    @objc private func openDocument(_ sender: Any?) {
        let panel = NSOpenPanel()
        panel.title = "Open Markdown or Spreadsheet"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = true
        panel.allowedContentTypes = readableContentTypes

        if panel.runModal() == .OK {
            openURLs(panel.urls)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageLoaded = true
        flushPendingURLs()
    }

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.allowedContentTypes = readableContentTypes

        completionHandler(panel.runModal() == .OK ? panel.urls : nil)
    }

    private func openURLs(_ urls: [URL]) {
        let readableURLs = urls.filter { isReadableFile($0) }
        guard !readableURLs.isEmpty else {
            bringWindowForward()
            return
        }

        pendingURLs.append(contentsOf: readableURLs)
        loadReaderIfNeeded()
        flushPendingURLs()
        bringWindowForward()
    }

    private func flushPendingURLs() {
        guard pageLoaded, !isDeliveringFile else {
            return
        }

        deliverNextPendingURL()
    }

    private func deliverNextPendingURL() {
        guard pageLoaded else {
            isDeliveringFile = false
            return
        }

        guard !pendingURLs.isEmpty else {
            isDeliveringFile = false
            return
        }

        isDeliveringFile = true
        let nextURL = pendingURLs.removeFirst()
        sendFileToReader(nextURL) { [weak self] in
            self?.deliverNextPendingURL()
        }
    }

    private func sendFileToReader(_ url: URL, completion: @escaping () -> Void) {
        guard let json = payloadJSON(for: url) else {
            completion()
            return
        }

        let script = """
        if (window.markdownReaderOpenFile) {
          window.markdownReaderOpenFile(\(json));
        }
        """

        webView.evaluateJavaScript(script) { _, _ in
            completion()
        }
    }

    private func payloadJSON(for url: URL) -> String? {
        guard let data = try? Data(contentsOf: url) else {
            return nil
        }

        let attributes = (try? FileManager.default.attributesOfItem(atPath: url.path)) ?? [:]
        let size = (attributes[.size] as? NSNumber)?.intValue ?? data.count
        let modifiedDate = attributes[.modificationDate] as? Date
        let modified = Int(modifiedDate?.timeIntervalSince1970 ?? 0)

        let payload: [String: Any] = [
            "base64": data.base64EncodedString(),
            "name": url.lastPathComponent,
            "path": url.path,
            "size": size,
            "modified": modified,
        ]

        guard
            let jsonData = try? JSONSerialization.data(withJSONObject: payload),
            let json = String(data: jsonData, encoding: .utf8)
        else {
            return nil
        }

        return json
    }

    private func bringWindowForward() {
        ensureWindow()

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func isReadableFile(_ url: URL) -> Bool {
        let allowedExtensions = Set(readableExtensions)
        return allowedExtensions.contains(url.pathExtension.lowercased())
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.run()
