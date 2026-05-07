import CodexBarCore
import Foundation
import Testing

@Suite
struct LinuxBrowserCookieReaderTests {
    @Test
    func readsPlaintextChromiumCookiesFromFixtureDatabase() throws {
        #if os(Linux)
        let home = try Self.makeFixtureHome()
        defer { try? FileManager.default.removeItem(at: home) }

        let reader = LinuxBrowserCookieReader(homeDirectory: home)
        let claude = reader.cookies(matchingDomains: ["claude.ai"], names: ["sessionKey"])
        #expect(claude.count == 1)
        #expect(claude.first?.valuesByName["sessionKey"] == "sk-ant-test-fixture")
        #expect(claude.first?.sourceLabel == "chrome-linux:Default")

        let chatgpt = reader.cookies(matchingDomains: ["chatgpt.com"])
        #expect(chatgpt.count == 1)
        #expect(chatgpt.first?.cookieHeader.contains("__Secure-next-auth.session-token=chatgpt-session-fixture") == true)
        #expect(chatgpt.first?.valuesByName["sessionKey"] == nil)
        #else
        #expect(Bool(true))
        #endif
    }

    @Test
    func firstCookieFindsNamedCookie() throws {
        #if os(Linux)
        let home = try Self.makeFixtureHome()
        defer { try? FileManager.default.removeItem(at: home) }

        let reader = LinuxBrowserCookieReader(homeDirectory: home)
        let found = reader.firstCookie(named: "sessionKey", matchingDomains: ["claude.ai"])

        #expect(found?.record.value == "sk-ant-test-fixture")
        #expect(found?.result.cookieHeader == "sessionKey=sk-ant-test-fixture")
        #else
        #expect(Bool(true))
        #endif
    }

    #if os(Linux)
    private static func makeFixtureHome() throws -> URL {
        let fixtureURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures/linux-chrome-cookies.sqlite")
        let home = FileManager.default.temporaryDirectory
            .appendingPathComponent("codexbar-cookie-reader-tests-\(UUID().uuidString)", isDirectory: true)
        let profile = home.appendingPathComponent(".config/google-chrome/Default", isDirectory: true)
        try FileManager.default.createDirectory(at: profile, withIntermediateDirectories: true)
        try FileManager.default.copyItem(
            at: fixtureURL,
            to: profile.appendingPathComponent("Cookies"))
        return home
    }
    #endif
}
