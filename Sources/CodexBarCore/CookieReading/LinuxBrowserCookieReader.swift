#if os(Linux)
import Foundation
#if canImport(CSQLite)
import CSQLite
#else
import SQLite3
#endif

public struct LinuxBrowserCookieReader {
    public struct CookieRecord: Equatable, Sendable {
        public let name: String
        public let value: String
        public let domain: String
        public let path: String
        public let sourceLabel: String

        public init(name: String, value: String, domain: String, path: String, sourceLabel: String) {
            self.name = name
            self.value = value
            self.domain = domain
            self.path = path
            self.sourceLabel = sourceLabel
        }
    }

    public struct CookieResult: Sendable {
        public let sourceLabel: String
        public let records: [CookieRecord]

        public init(sourceLabel: String, records: [CookieRecord]) {
            self.sourceLabel = sourceLabel
            self.records = records
        }

        public var valuesByName: [String: String] {
            var values: [String: String] = [:]
            for record in self.records {
                values[record.name] = record.value
            }
            return values
        }

        public var cookieHeader: String {
            self.records
                .filter { !$0.name.isEmpty && !$0.value.isEmpty }
                .map { "\($0.name)=\($0.value)" }
                .joined(separator: "; ")
        }
    }

    public enum ReadError: LocalizedError, Sendable {
        case sqliteOpenFailed(String)
        case sqlitePrepareFailed(String)

        public var errorDescription: String? {
            switch self {
            case let .sqliteOpenFailed(message):
                "Could not open browser cookie database: \(message)"
            case let .sqlitePrepareFailed(message):
                "Could not query browser cookie database: \(message)"
            }
        }
    }

    private struct ChromiumRoot {
        let label: String
        let rootURL: URL
        let secretApplications: [String]
    }

    private struct CookieStore {
        let label: String
        let databaseURL: URL
        let rootURL: URL?
        let engine: Engine

        enum Engine {
            case chromium
            case firefox
        }
    }

    private let homeDirectory: URL
    private let fileManager: FileManager

    public init(
        homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser,
        fileManager: FileManager = .default)
    {
        self.homeDirectory = homeDirectory
        self.fileManager = fileManager
    }

    public func cookies(
        matchingDomains domains: [String],
        names: Set<String>? = nil,
        logger: ((String) -> Void)? = nil) -> [CookieResult]
    {
        let normalizedDomains = domains
            .map(Self.normalizedDomain)
            .filter { !$0.isEmpty }
        guard !normalizedDomains.isEmpty else { return [] }

        var results: [CookieResult] = []
        for store in self.discoverCookieStores() {
            do {
                let records: [CookieRecord]
                switch store.engine {
                case .chromium:
                    records = try self.readChromiumCookies(
                        from: store,
                        domains: normalizedDomains,
                        names: names,
                        logger: logger)
                case .firefox:
                    records = try self.readFirefoxCookies(
                        from: store,
                        domains: normalizedDomains,
                        names: names)
                }
                if !records.isEmpty {
                    results.append(CookieResult(sourceLabel: store.label, records: records))
                }
            } catch {
                logger?("Linux cookie read failed for \(store.label): \(error.localizedDescription)")
            }
        }
        return results
    }

    public func firstCookie(
        named name: String,
        matchingDomains domains: [String],
        logger: ((String) -> Void)? = nil) -> (record: CookieRecord, result: CookieResult)?
    {
        for result in self.cookies(matchingDomains: domains, names: [name], logger: logger) {
            if let record = result.records.first(where: { $0.name == name }) {
                return (record, result)
            }
        }
        return nil
    }

    // MARK: - Discovery

    private func discoverCookieStores() -> [CookieStore] {
        var stores: [CookieStore] = []
        for root in self.chromiumRoots() {
            stores.append(contentsOf: self.discoverChromiumStores(root))
        }
        stores.append(contentsOf: self.discoverFirefoxStores())
        return stores
    }

    private func chromiumRoots() -> [ChromiumRoot] {
        let home = self.homeDirectory
        return [
            ChromiumRoot(
                label: "chrome-linux",
                rootURL: home.appendingPathComponent(".config/google-chrome", isDirectory: true),
                secretApplications: ["chrome", "google-chrome", "chromium"]),
            ChromiumRoot(
                label: "chromium-linux",
                rootURL: home.appendingPathComponent(".config/chromium", isDirectory: true),
                secretApplications: ["chromium", "chrome"]),
            ChromiumRoot(
                label: "edge-linux",
                rootURL: home.appendingPathComponent(".config/microsoft-edge", isDirectory: true),
                secretApplications: ["microsoft-edge", "chromium"]),
            ChromiumRoot(
                label: "edge-beta-linux",
                rootURL: home.appendingPathComponent(".config/microsoft-edge-beta", isDirectory: true),
                secretApplications: ["microsoft-edge", "chromium"]),
            ChromiumRoot(
                label: "edge-dev-linux",
                rootURL: home.appendingPathComponent(".config/microsoft-edge-dev", isDirectory: true),
                secretApplications: ["microsoft-edge", "chromium"]),
            ChromiumRoot(
                label: "brave-linux",
                rootURL: home.appendingPathComponent(".config/BraveSoftware/Brave-Browser", isDirectory: true),
                secretApplications: ["brave", "chromium"]),
            ChromiumRoot(
                label: "chrome-flatpak",
                rootURL: home.appendingPathComponent(
                    ".var/app/com.google.Chrome/config/google-chrome",
                    isDirectory: true),
                secretApplications: ["chrome", "google-chrome", "chromium"]),
            ChromiumRoot(
                label: "chromium-flatpak",
                rootURL: home.appendingPathComponent(
                    ".var/app/org.chromium.Chromium/config/chromium",
                    isDirectory: true),
                secretApplications: ["chromium", "chrome"]),
            ChromiumRoot(
                label: "edge-flatpak",
                rootURL: home.appendingPathComponent(
                    ".var/app/com.microsoft.Edge/config/microsoft-edge",
                    isDirectory: true),
                secretApplications: ["microsoft-edge", "chromium"]),
        ]
    }

    private func discoverChromiumStores(_ root: ChromiumRoot) -> [CookieStore] {
        guard self.fileManager.fileExists(atPath: root.rootURL.path) else { return [] }
        let profileURLs = self.chromiumProfileURLs(rootURL: root.rootURL)
        var stores: [CookieStore] = []

        for profileURL in profileURLs {
            let profileLabel = profileURL.lastPathComponent
            let candidates = [
                profileURL.appendingPathComponent("Network/Cookies"),
                profileURL.appendingPathComponent("Cookies"),
            ]
            for databaseURL in candidates where self.fileManager.fileExists(atPath: databaseURL.path) {
                stores.append(CookieStore(
                    label: "\(root.label):\(profileLabel)",
                    databaseURL: databaseURL,
                    rootURL: root.rootURL,
                    engine: .chromium))
            }
        }

        return stores
    }

    private func chromiumProfileURLs(rootURL: URL) -> [URL] {
        guard let contents = try? self.fileManager.contentsOfDirectory(
            at: rootURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles])
        else {
            return []
        }

        let profiles = contents.filter { url in
            guard (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true else { return false }
            let name = url.lastPathComponent
            return name == "Default" ||
                name == "Guest Profile" ||
                name.hasPrefix("Profile ") ||
                name.hasPrefix("Person ")
        }

        return profiles.sorted { lhs, rhs in
            Self.profileSortKey(lhs.lastPathComponent) < Self.profileSortKey(rhs.lastPathComponent)
        }
    }

    private func discoverFirefoxStores() -> [CookieStore] {
        let roots = [
            (label: "firefox-linux", url: self.homeDirectory.appendingPathComponent(".mozilla/firefox", isDirectory: true)),
            (
                label: "firefox-flatpak",
                url: self.homeDirectory.appendingPathComponent(
                    ".var/app/org.mozilla.firefox/.mozilla/firefox",
                    isDirectory: true)
            ),
        ]

        var stores: [CookieStore] = []
        for root in roots where self.fileManager.fileExists(atPath: root.url.path) {
            for profile in self.firefoxProfileURLs(rootURL: root.url) {
                let databaseURL = profile.appendingPathComponent("cookies.sqlite")
                guard self.fileManager.fileExists(atPath: databaseURL.path) else { continue }
                stores.append(CookieStore(
                    label: "\(root.label):\(profile.lastPathComponent)",
                    databaseURL: databaseURL,
                    rootURL: nil,
                    engine: .firefox))
            }
        }
        return stores
    }

    private func firefoxProfileURLs(rootURL: URL) -> [URL] {
        let profilesIniURL = rootURL.appendingPathComponent("profiles.ini")
        if let contents = try? String(contentsOf: profilesIniURL, encoding: .utf8) {
            let profiles = Self.parseFirefoxProfilesINI(contents, rootURL: rootURL)
            if !profiles.isEmpty { return profiles }
        }

        guard let contents = try? self.fileManager.contentsOfDirectory(
            at: rootURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles])
        else {
            return []
        }
        return contents
            .filter { url in
                guard (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true else { return false }
                let name = url.lastPathComponent.lowercased()
                return name.contains(".default") || name.contains("default-release")
            }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    private static func parseFirefoxProfilesINI(_ contents: String, rootURL: URL) -> [URL] {
        struct Section {
            var name: String
            var values: [String: String]
        }

        var sections: [Section] = []
        var current = Section(name: "", values: [:])
        for rawLine in contents.split(whereSeparator: \.isNewline) {
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty, !line.hasPrefix(";"), !line.hasPrefix("#") else { continue }
            if line.hasPrefix("["), line.hasSuffix("]") {
                if !current.name.isEmpty { sections.append(current) }
                current = Section(name: String(line.dropFirst().dropLast()), values: [:])
                continue
            }
            guard let equals = line.firstIndex(of: "=") else { continue }
            let key = line[..<equals].trimmingCharacters(in: .whitespacesAndNewlines)
            let value = line[line.index(after: equals)...].trimmingCharacters(in: .whitespacesAndNewlines)
            current.values[String(key)] = String(value)
        }
        if !current.name.isEmpty { sections.append(current) }

        let profileSections = sections
            .filter { $0.name.lowercased().hasPrefix("profile") && $0.values["Path"] != nil }
            .sorted { lhs, rhs in
                let lhsDefault = lhs.values["Default"] == "1" ? 0 : 1
                let rhsDefault = rhs.values["Default"] == "1" ? 0 : 1
                if lhsDefault != rhsDefault { return lhsDefault < rhsDefault }
                return lhs.name < rhs.name
            }

        return profileSections.compactMap { section in
            guard let path = section.values["Path"], !path.isEmpty else { return nil }
            if section.values["IsRelative"] == "1" {
                return rootURL.appendingPathComponent(path, isDirectory: true)
            }
            return URL(fileURLWithPath: path, isDirectory: true)
        }
    }

    private static func profileSortKey(_ name: String) -> String {
        switch name {
        case "Default":
            "000-\(name)"
        case "Guest Profile":
            "998-\(name)"
        default:
            "100-\(name)"
        }
    }

    // MARK: - SQLite reads

    private func readChromiumCookies(
        from store: CookieStore,
        domains: [String],
        names: Set<String>?,
        logger: ((String) -> Void)?) throws -> [CookieRecord]
    {
        let decryptor = ChromiumCookieDecryptor(
            rootURL: store.rootURL,
            sourceLabel: store.label,
            logger: logger)
        return try self.withReadableDatabaseCopy(store.databaseURL) { databaseURL in
            var db: OpaquePointer?
            guard sqlite3_open_v2(databaseURL.path, &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK
            else {
                let message = db.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "unknown error"
                sqlite3_close(db)
                throw ReadError.sqliteOpenFailed(message)
            }
            defer { sqlite3_close(db) }
            sqlite3_busy_timeout(db, 250)

            let sql = "SELECT host_key, name, value, encrypted_value, path FROM cookies"
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                let message = db.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "unknown error"
                throw ReadError.sqlitePrepareFailed(message)
            }
            defer { sqlite3_finalize(stmt) }

            var records: [CookieRecord] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let host = Self.text(stmt, 0)
                guard Self.host(host, matchesAny: domains) else { continue }
                let name = Self.text(stmt, 1)
                guard names == nil || names?.contains(name) == true else { continue }
                let plaintext = Self.text(stmt, 2)
                let encrypted = Self.blob(stmt, 3)
                let path = Self.text(stmt, 4)
                let value = !plaintext.isEmpty
                    ? plaintext
                    : decryptor.decrypt(encrypted, hostKey: host)
                guard let value, !value.isEmpty else { continue }
                records.append(CookieRecord(
                    name: name,
                    value: value,
                    domain: host,
                    path: path.isEmpty ? "/" : path,
                    sourceLabel: store.label))
            }
            return records
        }
    }

    private func readFirefoxCookies(
        from store: CookieStore,
        domains: [String],
        names: Set<String>?) throws -> [CookieRecord]
    {
        try self.withReadableDatabaseCopy(store.databaseURL) { databaseURL in
            var db: OpaquePointer?
            guard sqlite3_open_v2(databaseURL.path, &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK
            else {
                let message = db.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "unknown error"
                sqlite3_close(db)
                throw ReadError.sqliteOpenFailed(message)
            }
            defer { sqlite3_close(db) }
            sqlite3_busy_timeout(db, 250)

            let sql = "SELECT host, name, value, path FROM moz_cookies"
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                let message = db.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "unknown error"
                throw ReadError.sqlitePrepareFailed(message)
            }
            defer { sqlite3_finalize(stmt) }

            var records: [CookieRecord] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let host = Self.text(stmt, 0)
                guard Self.host(host, matchesAny: domains) else { continue }
                let name = Self.text(stmt, 1)
                guard names == nil || names?.contains(name) == true else { continue }
                let value = Self.text(stmt, 2)
                guard !value.isEmpty else { continue }
                let path = Self.text(stmt, 3)
                records.append(CookieRecord(
                    name: name,
                    value: value,
                    domain: host,
                    path: path.isEmpty ? "/" : path,
                    sourceLabel: store.label))
            }
            return records
        }
    }

    private func withReadableDatabaseCopy<T>(_ databaseURL: URL, body: (URL) throws -> T) throws -> T {
        let tempRoot = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
            .appendingPathComponent("codexbar-cookies-\(UUID().uuidString)", isDirectory: true)
        try self.fileManager.createDirectory(at: tempRoot, withIntermediateDirectories: true)
        defer { try? self.fileManager.removeItem(at: tempRoot) }

        let copiedURL = tempRoot.appendingPathComponent(databaseURL.lastPathComponent)
        try self.fileManager.copyItem(at: databaseURL, to: copiedURL)
        self.copySQLiteSidecarIfPresent(databaseURL, suffix: "-wal", copiedURL: copiedURL)
        self.copySQLiteSidecarIfPresent(databaseURL, suffix: "-shm", copiedURL: copiedURL)
        return try body(copiedURL)
    }

    private func copySQLiteSidecarIfPresent(_ databaseURL: URL, suffix: String, copiedURL: URL) {
        let source = URL(fileURLWithPath: databaseURL.path + suffix)
        guard self.fileManager.fileExists(atPath: source.path) else { return }
        let destination = URL(fileURLWithPath: copiedURL.path + suffix)
        try? self.fileManager.copyItem(at: source, to: destination)
    }

    private static func text(_ stmt: OpaquePointer?, _ index: Int32) -> String {
        guard sqlite3_column_type(stmt, index) != SQLITE_NULL,
              let cString = sqlite3_column_text(stmt, index)
        else {
            return ""
        }
        return String(cString: cString)
    }

    private static func blob(_ stmt: OpaquePointer?, _ index: Int32) -> Data {
        guard sqlite3_column_type(stmt, index) != SQLITE_NULL,
              let bytes = sqlite3_column_blob(stmt, index)
        else {
            return Data()
        }
        return Data(bytes: bytes, count: Int(sqlite3_column_bytes(stmt, index)))
    }

    private static func host(_ host: String, matchesAny domains: [String]) -> Bool {
        let normalizedHost = self.normalizedDomain(host)
        guard !normalizedHost.isEmpty else { return false }
        return domains.contains { domain in
            normalizedHost == domain || normalizedHost.hasSuffix(".\(domain)")
        }
    }

    private static func normalizedDomain(_ domain: String) -> String {
        domain
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "."))
            .lowercased()
    }
}

private struct ChromiumCookieDecryptor {
    private let rootURL: URL?
    private let sourceLabel: String
    private let logger: ((String) -> Void)?

    init(rootURL: URL?, sourceLabel: String, logger: ((String) -> Void)?) {
        self.rootURL = rootURL
        self.sourceLabel = sourceLabel
        self.logger = logger
    }

    func decrypt(_ encryptedValue: Data, hostKey: String) -> String? {
        guard !encryptedValue.isEmpty else { return nil }
        if let plaintext = Self.plaintextIfAvailable(encryptedValue) {
            return plaintext
        }

        let keys = self.localStateKeys()
        let passphrases = self.secretToolPassphrases() + ["peanuts"]
        guard !keys.isEmpty || !passphrases.isEmpty else {
            self.logger?("\(self.sourceLabel): no Chromium cookie decryption keys available")
            return nil
        }

        guard let decrypted = Self.decryptWithPython(
            encryptedValue: encryptedValue,
            hostKey: hostKey,
            keys: keys,
            passphrases: passphrases)
        else {
            self.logger?("\(self.sourceLabel): failed to decrypt Chromium cookie for \(hostKey)")
            return nil
        }
        return decrypted
    }

    private static func plaintextIfAvailable(_ data: Data) -> String? {
        if let string = String(data: data, encoding: .utf8),
           self.isLikelyPlaintextCookie(string)
        {
            return string
        }
        if data.count > 3,
           let prefix = String(data: Data(data.prefix(3)), encoding: .utf8),
           (prefix == "v10" || prefix == "v11")
        {
            let payload = Data(data.dropFirst(3))
            if let string = String(data: payload, encoding: .utf8),
               self.isLikelyPlaintextCookie(string)
            {
                return string
            }
        }
        return nil
    }

    private static func isLikelyPlaintextCookie(_ value: String) -> Bool {
        let trimmed = value.trimmingCharacters(in: .controlCharacters)
        guard !trimmed.isEmpty else { return false }
        return trimmed.unicodeScalars.allSatisfy { scalar in
            scalar.value >= 0x20 && scalar.value != 0x7F
        }
    }

    private func localStateKeys() -> [Data] {
        guard let rootURL else { return [] }
        let localStateURL = rootURL.appendingPathComponent("Local State")
        guard let data = try? Data(contentsOf: localStateURL),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let osCrypt = json["os_crypt"] as? [String: Any],
              let encoded = osCrypt["encrypted_key"] as? String,
              let decoded = Data(base64Encoded: encoded)
        else {
            return []
        }

        var candidates: [Data] = [decoded]
        if decoded.starts(with: Data("DPAPI".utf8)) {
            candidates.append(Data(decoded.dropFirst(5)))
        }
        if decoded.starts(with: Data("v10".utf8)) || decoded.starts(with: Data("v11".utf8)) {
            candidates.append(Data(decoded.dropFirst(3)))
        }
        return Self.uniqued(candidates.filter { [16, 24, 32].contains($0.count) })
    }

    private func secretToolPassphrases() -> [String] {
        let applications = [
            "chromium",
            "chrome",
            "google-chrome",
            "brave",
            "microsoft-edge",
        ]
        return Self.uniqued(applications.compactMap { application in
            Self.runCommand("/usr/bin/env", arguments: ["secret-tool", "lookup", "application", application])
        })
    }

    private static func decryptWithPython(
        encryptedValue: Data,
        hostKey: String,
        keys: [Data],
        passphrases: [String]) -> String?
    {
        let payload: [String: Any] = [
            "encrypted": encryptedValue.base64EncodedString(),
            "host_key": hostKey,
            "keys": keys.map { $0.base64EncodedString() },
            "passphrases": passphrases,
        ]
        guard let input = try? JSONSerialization.data(withJSONObject: payload) else { return nil }
        guard let output = Self.runCommand(
            "/usr/bin/env",
            arguments: ["python3", "-c", Self.pythonDecryptScript],
            input: input)
        else {
            return nil
        }
        let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func runCommand(
        _ executable: String,
        arguments: [String],
        input: Data? = nil) -> String?
    {
        let process = Process()
        let stdout = Pipe()
        let stderr = Pipe()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardOutput = stdout
        process.standardError = stderr
        if input != nil {
            process.standardInput = Pipe()
        }

        do {
            try process.run()
            if let input, let stdin = process.standardInput as? Pipe {
                stdin.fileHandleForWriting.write(input)
                stdin.fileHandleForWriting.closeFile()
            }
            process.waitUntilExit()
        } catch {
            return nil
        }

        guard process.terminationStatus == 0 else { return nil }
        let data = stdout.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func uniqued<T: Hashable>(_ values: [T]) -> [T] {
        var seen = Set<T>()
        var result: [T] = []
        for value in values where seen.insert(value).inserted {
            result.append(value)
        }
        return result
    }

    private static let pythonDecryptScript = #"""
import base64
import hashlib
import json
import string
import sys

try:
    from cryptography.hazmat.primitives import hashes, padding
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except Exception:
    sys.exit(2)

payload = json.loads(sys.stdin.buffer.read().decode("utf-8"))
encrypted = base64.b64decode(payload["encrypted"])
host_key = payload.get("host_key", "").encode("utf-8")
keys = [base64.b64decode(item) for item in payload.get("keys", [])]
passphrases = payload.get("passphrases", [])

def clean(data):
    if host_key:
        digest = hashlib.sha256(host_key).digest()
        if data.startswith(digest):
            data = data[len(digest):]
    for encoding in ("utf-8", "latin-1"):
        try:
            text = data.decode(encoding)
        except Exception:
            continue
        text = text.strip("\x00\r\n\t ")
        if text and all((ch in string.printable and ch not in "\x0b\x0c") for ch in text):
            return text
    return None

def try_gcm(raw_key, payload):
    if len(raw_key) not in (16, 24, 32) or len(payload) <= 28:
        return None
    nonce = payload[:12]
    ciphertext_and_tag = payload[12:]
    try:
        return clean(AESGCM(raw_key).decrypt(nonce, ciphertext_and_tag, None))
    except Exception:
        return None

def try_cbc(raw_key, payload):
    if len(raw_key) not in (16, 24, 32) or len(payload) == 0 or len(payload) % 16 != 0:
        return None
    try:
        cipher = Cipher(algorithms.AES(raw_key), modes.CBC(b" " * 16))
        decryptor = cipher.decryptor()
        padded = decryptor.update(payload) + decryptor.finalize()
        unpadder = padding.PKCS7(128).unpadder()
        return clean(unpadder.update(padded) + unpadder.finalize())
    except Exception:
        return None

versioned = encrypted.startswith(b"v10") or encrypted.startswith(b"v11")
body = encrypted[3:] if versioned else encrypted

plain = clean(body)
if plain:
    print(plain)
    sys.exit(0)

for key in keys:
    plain = try_gcm(key, body) or try_cbc(key, body)
    if plain:
        print(plain)
        sys.exit(0)

for passphrase in passphrases:
    key = hashlib.pbkdf2_hmac("sha1", passphrase.encode("utf-8"), b"saltysalt", 1, dklen=16)
    plain = try_cbc(key, body)
    if plain:
        print(plain)
        sys.exit(0)

sys.exit(1)
"""#
}
#endif
