import CodexBarCore
import Testing

@Suite
struct PlatformGatingTests {
    @Test
    func claudeWebFetcher_parsesManualSessionKeyOnLinux() throws {
        #if os(Linux)
        let info = try ClaudeWebAPIFetcher.sessionKeyInfo(cookieHeader: "sessionKey=sk-ant-test")
        #expect(info.key == "sk-ant-test")
        #expect(info.sourceLabel == "Manual")
        #else
        #expect(Bool(true))
        #endif
    }

    @Test
    func claudeWebFetcher_hasSessionKeyChecksManualCookieHeader() {
        #expect(ClaudeWebAPIFetcher.hasSessionKey(cookieHeader: nil) == false)
        #expect(ClaudeWebAPIFetcher.hasSessionKey(cookieHeader: "sessionKey=not-valid") == false)
        #expect(ClaudeWebAPIFetcher.hasSessionKey(cookieHeader: "sessionKey=sk-ant-test") == true)
    }

    @Test
    func claudeWebFetcher_sessionKeyInfoThrowsWithoutCookie() {
        let error = #expect(throws: ClaudeWebAPIFetcher.FetchError.self) {
            _ = try ClaudeWebAPIFetcher.sessionKeyInfo(cookieHeader: "other=value")
        }
        let isExpectedError = error.map { thrown in
            if case .noSessionKeyFound = thrown { return true }
            return false
        } ?? false
        #expect(isExpectedError)
    }
}
