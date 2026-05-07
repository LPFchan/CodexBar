import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

#if os(macOS)
import AppKit

public struct CodexWebDashboardStrategy: ProviderFetchStrategy {
    public let id: String = "codex.web.dashboard"
    public let kind: ProviderFetchKind = .webDashboard

    public init() {}

    public func isAvailable(_ context: ProviderFetchContext) async -> Bool {
        context.sourceMode.usesWeb &&
            !Self.managedAccountStoreIsUnreadable(context) &&
            !Self.managedAccountTargetIsUnavailable(context)
    }

    public func fetch(_ context: ProviderFetchContext) async throws -> ProviderFetchResult {
        guard !Self.managedAccountStoreIsUnreadable(context) else {
            // A fail-closed placeholder CODEX_HOME does not identify a target account. If the managed store
            // itself is unreadable, web import must not fall back to "any signed-in browser account".
            throw OpenAIDashboardFetcher.FetchError.loginRequired
        }
        guard !Self.managedAccountTargetIsUnavailable(context) else {
            // If the selected managed account no longer exists in a readable store, web import must not
            // fall back to "any signed-in browser account" for that stale selection.
            throw OpenAIDashboardFetcher.FetchError.loginRequired
        }

        // Ensure AppKit is initialized before using WebKit in a CLI.
        await MainActor.run {
            _ = NSApplication.shared
        }

        let options = OpenAIWebOptions(
            timeout: context.webTimeout,
            debugDumpHTML: context.webDebugDumpHTML,
            verbose: context.verbose)
        let result = try await Self.fetchOpenAIWebCodex(
            context: context,
            options: options,
            browserDetection: context.browserDetection)
        return self.makeResult(
            usage: result.usage,
            credits: result.credits,
            dashboard: result.dashboard,
            sourceLabel: "openai-web")
    }

    public func shouldFallback(on error: Error, context: ProviderFetchContext) -> Bool {
        _ = error
        return context.sourceMode == .auto
    }

    private static func managedAccountStoreIsUnreadable(_ context: ProviderFetchContext) -> Bool {
        context.settings?.codex?.managedAccountStoreUnreadable == true
    }

    private static func managedAccountTargetIsUnavailable(_ context: ProviderFetchContext) -> Bool {
        context.settings?.codex?.managedAccountTargetUnavailable == true
    }
}

struct OpenAIWebCodexResult {
    let usage: UsageSnapshot
    let credits: CreditsSnapshot?
    let dashboard: OpenAIDashboardSnapshot
}

enum OpenAIWebCodexError: LocalizedError, Equatable {
    case missingUsage
    case policyRejected(CodexDashboardAuthorityDecision)

    var errorDescription: String? {
        switch self {
        case .missingUsage:
            return "OpenAI web dashboard did not include usage limits."
        case let .policyRejected(decision):
            switch decision.reason {
            case let .wrongEmail(expected, actual):
                var details: [String] = []
                if let expected {
                    details.append("expected \(expected)")
                }
                if let actual {
                    details.append("got \(actual)")
                }
                if details.isEmpty {
                    return "OpenAI web dashboard belonged to the wrong account."
                }
                return "OpenAI web dashboard belonged to the wrong account (\(details.joined(separator: ", ")))."
            case .unresolvedWithoutTrustedEvidence:
                return "Active Codex identity is unresolved and no trusted auth-backed continuity exists."
            case .providerAccountMissingScopedEmail:
                return "Active Codex provider account is missing its scoped email, " +
                    "so dashboard ownership cannot be proven."
            case .providerAccountLacksExactOwnershipProof:
                return "OpenAI web dashboard could not be proven to belong to the active provider account."
            case .missingDashboardSignedInEmail:
                return "OpenAI web dashboard did not expose a signed-in email."
            case let .sameEmailAmbiguity(email):
                return "OpenAI web dashboard email \(email) is ambiguous across multiple known owners."
            default:
                return "OpenAI web dashboard was rejected by Codex dashboard authority."
            }
        }
    }
}

private struct OpenAIWebOptions {
    let timeout: TimeInterval
    let debugDumpHTML: Bool
    let verbose: Bool
}

@MainActor
private final class WebLogBuffer {
    private var lines: [String] = []
    private let maxCount: Int
    private let verbose: Bool
    private let logger = CodexBarLog.logger(LogCategories.openAIWeb)

    init(maxCount: Int = 300, verbose: Bool) {
        self.maxCount = maxCount
        self.verbose = verbose
    }

    func append(_ line: String) {
        self.lines.append(line)
        if self.lines.count > self.maxCount {
            self.lines.removeFirst(self.lines.count - self.maxCount)
        }
        if self.verbose {
            self.logger.verbose(line)
        }
    }

    func snapshot() -> [String] {
        self.lines
    }
}

extension CodexWebDashboardStrategy {
    @MainActor
    fileprivate static func fetchOpenAIWebCodex(
        context: ProviderFetchContext,
        options: OpenAIWebOptions,
        browserDetection: BrowserDetection) async throws -> OpenAIWebCodexResult
    {
        let logger = WebLogBuffer(verbose: options.verbose)
        let log: @MainActor (String) -> Void = { line in
            logger.append(line)
        }
        do {
            let result = try await Self.fetchOpenAIWebDashboard(
                context: context,
                options: options,
                browserDetection: browserDetection,
                preferCachedCookieHeader: true,
                logger: log)
            return try Self.makeAuthorizedDashboardResult(
                dashboard: result.dashboard,
                context: context,
                routingTargetEmail: result.routingTargetEmail)
        } catch {
            guard Self.shouldRetryWithFreshBrowserImport(after: error) else {
                throw error
            }
            log("Retrying OpenAI web dashboard with a fresh browser cookie import.")
            let result = try await Self.fetchOpenAIWebDashboard(
                context: context,
                options: options,
                browserDetection: browserDetection,
                preferCachedCookieHeader: false,
                logger: log)
            return try Self.makeAuthorizedDashboardResult(
                dashboard: result.dashboard,
                context: context,
                routingTargetEmail: result.routingTargetEmail)
        }
    }

    nonisolated static func shouldRetryWithFreshBrowserImport(after error: Error) -> Bool {
        if error is OpenAIWebCodexError {
            return error as? OpenAIWebCodexError == .missingUsage
        }
        if case OpenAIDashboardFetcher.FetchError.noDashboardData = error {
            return true
        }
        return false
    }

    @MainActor
    static func makeAuthorizedDashboardResultForTesting(
        dashboard: OpenAIDashboardSnapshot,
        context: ProviderFetchContext,
        routingTargetEmail: String?)
        throws -> OpenAIWebCodexResult
    {
        try self.makeAuthorizedDashboardResult(
            dashboard: dashboard,
            context: context,
            routingTargetEmail: routingTargetEmail)
    }

    @MainActor
    private static func makeAuthorizedDashboardResult(
        dashboard: OpenAIDashboardSnapshot,
        context: ProviderFetchContext,
        routingTargetEmail: String?) throws -> OpenAIWebCodexResult
    {
        let input = CodexCLIDashboardAuthorityContext.makeLiveWebInput(
            dashboard: dashboard,
            context: context,
            routingTargetEmail: routingTargetEmail)
        let decision = CodexDashboardAuthority.evaluate(input)

        switch decision.disposition {
        case .attach:
            let attachedAccountEmail = CodexCLIDashboardAuthorityContext.attachmentEmail(from: input)
            guard let usage = dashboard.toUsageSnapshot(provider: .codex, accountEmail: attachedAccountEmail) else {
                throw OpenAIWebCodexError.missingUsage
            }
            let credits = dashboard.toCreditsSnapshot()
            if let attachedAccountEmail {
                OpenAIDashboardCacheStore.save(OpenAIDashboardCache(
                    accountEmail: attachedAccountEmail,
                    snapshot: dashboard))
            }
            return OpenAIWebCodexResult(usage: usage, credits: credits, dashboard: dashboard)
        case .displayOnly:
            if decision.cleanup.contains(.dashboardCache) {
                OpenAIDashboardCacheStore.clear()
            }
            throw CodexDashboardPolicyError.displayOnly(decision)
        case .failClosed:
            if decision.cleanup.contains(.dashboardCache) {
                OpenAIDashboardCacheStore.clear()
            }
            throw OpenAIWebCodexError.policyRejected(decision)
        }
    }

    private struct OpenAIWebDashboardFetchResult {
        let dashboard: OpenAIDashboardSnapshot
        let routingTargetEmail: String?
    }

    @MainActor
    private static func fetchOpenAIWebDashboard(
        context: ProviderFetchContext,
        options: OpenAIWebOptions,
        browserDetection: BrowserDetection,
        preferCachedCookieHeader: Bool,
        logger: @MainActor @escaping (String) -> Void) async throws -> OpenAIWebDashboardFetchResult
    {
        let auth = context.fetcher.loadAuthBackedCodexAccount()
        let routingTargetEmail = auth.email?.trimmingCharacters(in: .whitespacesAndNewlines)
        let allowAnyAccount = routingTargetEmail == nil

        let importResult = try await OpenAIDashboardBrowserCookieImporter(browserDetection: browserDetection)
            .importBestCookies(
                intoAccountEmail: routingTargetEmail,
                allowAnyAccount: allowAnyAccount,
                preferCachedCookieHeader: preferCachedCookieHeader,
                logger: logger)
        let effectiveEmail = routingTargetEmail ?? importResult.signedInEmail?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let dashboard = try await OpenAIDashboardFetcher().loadLatestDashboard(
            accountEmail: effectiveEmail,
            logger: logger,
            debugDumpHTML: options.debugDumpHTML,
            timeout: options.timeout)
        return OpenAIWebDashboardFetchResult(
            dashboard: dashboard,
            routingTargetEmail: routingTargetEmail)
    }
}
#else
public struct CodexWebDashboardStrategy: ProviderFetchStrategy {
    public let id: String = "codex.web.dashboard"
    public let kind: ProviderFetchKind = .webDashboard

    public init() {}

    public func isAvailable(_ context: ProviderFetchContext) async -> Bool {
        context.sourceMode.usesWeb &&
            !Self.managedAccountStoreIsUnreadable(context) &&
            !Self.managedAccountTargetIsUnavailable(context)
    }

    public func fetch(_ context: ProviderFetchContext) async throws -> ProviderFetchResult {
        guard !Self.managedAccountStoreIsUnreadable(context),
              !Self.managedAccountTargetIsUnavailable(context)
        else {
            throw LinuxOpenAIWebFetchError.loginRequired
        }

        let log: (String) -> Void = { message in
            if context.verbose {
                CodexBarLog.logger(LogCategories.openAIWeb).debug("\(message)")
            }
        }
        let auth = context.fetcher.loadAuthBackedCodexAccount()
        let targetEmail = auth.email?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let cached = CookieHeaderCache.load(provider: .codex),
           !cached.cookieHeader.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        {
            do {
                return try await self.fetchWithCookieHeader(
                    cached.cookieHeader,
                    sourceLabel: cached.sourceLabel,
                    targetEmail: targetEmail,
                    sourceMode: context.sourceMode,
                    logger: log)
            } catch let error as LinuxOpenAIWebFetchError {
                switch error {
                case .loginRequired, .noUsageData, .wrongAccount:
                    CookieHeaderCache.clear(provider: .codex)
                default:
                    throw error
                }
            } catch {
                throw error
            }
        }

        let reader = LinuxBrowserCookieReader()
        let candidates = reader.cookies(
            matchingDomains: ["chatgpt.com", "openai.com"],
            logger: log)
        guard !candidates.isEmpty else {
            throw LinuxOpenAIWebFetchError.noCookiesFound
        }

        var mismatches: [String] = []
        var lastError: Error?
        for candidate in candidates where self.hasSessionCookie(candidate) {
            do {
                let result = try await self.fetchWithCookieHeader(
                    candidate.cookieHeader,
                    sourceLabel: candidate.sourceLabel,
                    targetEmail: targetEmail,
                    sourceMode: context.sourceMode,
                    logger: log)
                CookieHeaderCache.store(
                    provider: .codex,
                    cookieHeader: candidate.cookieHeader,
                    sourceLabel: candidate.sourceLabel)
                return result
            } catch let error as LinuxOpenAIWebFetchError {
                lastError = error
                if case let .wrongAccount(expected, actual) = error {
                    mismatches.append("expected \(expected), got \(actual)")
                }
                continue
            } catch {
                lastError = error
                continue
            }
        }

        if !mismatches.isEmpty {
            throw LinuxOpenAIWebFetchError.noMatchingAccount(mismatches.joined(separator: "; "))
        }
        if let lastError {
            throw lastError
        }
        throw LinuxOpenAIWebFetchError.noSessionCookie
    }

    public func shouldFallback(on _: Error, context: ProviderFetchContext) -> Bool {
        context.sourceMode == .auto
    }

    private static func managedAccountStoreIsUnreadable(_ context: ProviderFetchContext) -> Bool {
        context.settings?.codex?.managedAccountStoreUnreadable == true
    }

    private static func managedAccountTargetIsUnavailable(_ context: ProviderFetchContext) -> Bool {
        context.settings?.codex?.managedAccountTargetUnavailable == true
    }

    private func hasSessionCookie(_ result: LinuxBrowserCookieReader.CookieResult) -> Bool {
        for record in result.records {
            let name = record.name.lowercased()
            if name.contains("session-token") || name.contains("authjs") || name.contains("next-auth") {
                return true
            }
            if name == "_account" { return true }
        }
        return false
    }

    private func fetchWithCookieHeader(
        _ cookieHeader: String,
        sourceLabel: String,
        targetEmail: String?,
        sourceMode: ProviderSourceMode,
        logger: @escaping (String) -> Void) async throws -> ProviderFetchResult
    {
        guard !cookieHeader.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw LinuxOpenAIWebFetchError.noSessionCookie
        }
        let usageResponse = try await Self.fetchUsageResponse(cookieHeader: cookieHeader, logger: logger)
        let signedInEmail = await Self.fetchSignedInEmail(cookieHeader: cookieHeader, logger: logger)
        if let targetEmail,
           let signedInEmail,
           !targetEmail.isEmpty,
           !signedInEmail.isEmpty,
           targetEmail.lowercased() != signedInEmail.lowercased()
        {
            throw LinuxOpenAIWebFetchError.wrongAccount(expected: targetEmail, actual: signedInEmail)
        }

        let updatedAt = Date()
        let identity = ProviderIdentitySnapshot(
            providerID: .codex,
            accountEmail: signedInEmail ?? targetEmail,
            accountOrganization: nil,
            loginMethod: usageResponse.planType?.rawValue)
        let primary = Self.makeWindow(usageResponse.rateLimit?.primaryWindow)
        let secondary = Self.makeWindow(usageResponse.rateLimit?.secondaryWindow)
        let credits = Self.makeCredits(usageResponse.credits, updatedAt: updatedAt)

        guard let reconciled = CodexReconciledState.fromCLI(
            primary: primary,
            secondary: secondary,
            identity: identity,
            updatedAt: updatedAt)
        else {
            guard sourceMode != .auto, credits != nil else {
                throw LinuxOpenAIWebFetchError.noUsageData
            }
            let usage = UsageSnapshot(
                primary: nil,
                secondary: nil,
                tertiary: nil,
                updatedAt: updatedAt,
                identity: identity)
            let dashboard = Self.makeDashboard(
                signedInEmail: signedInEmail ?? targetEmail,
                usageResponse: usageResponse,
                primary: primary,
                secondary: secondary,
                updatedAt: updatedAt)
            return self.makeResult(
                usage: usage,
                credits: credits,
                dashboard: dashboard,
                sourceLabel: "openai-web")
        }

        let dashboard = Self.makeDashboard(
            signedInEmail: signedInEmail ?? targetEmail,
            usageResponse: usageResponse,
            primary: primary,
            secondary: secondary,
            updatedAt: updatedAt)
        return self.makeResult(
            usage: reconciled.toUsageSnapshot(),
            credits: credits,
            dashboard: dashboard,
            sourceLabel: "openai-web")
    }

    private static func fetchUsageResponse(
        cookieHeader: String,
        logger: @escaping (String) -> Void) async throws -> CodexUsageResponse
    {
        var request = URLRequest(url: URL(string: "https://chatgpt.com/backend-api/wham/usage")!)
        request.httpMethod = "GET"
        request.timeoutInterval = 12
        request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("en-US,en;q=0.9", forHTTPHeaderField: "Accept-Language")
        request.setValue("CodexBar", forHTTPHeaderField: "User-Agent")

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? -1
        logger("OpenAI usage API status=\(status)")
        switch status {
        case 200..<300:
            return try JSONDecoder().decode(CodexUsageResponse.self, from: data)
        case 401, 403:
            throw LinuxOpenAIWebFetchError.loginRequired
        default:
            let body = String(data: data.prefix(300), encoding: .utf8)
            throw LinuxOpenAIWebFetchError.serverError(status: status, body: body)
        }
    }

    private static func fetchSignedInEmail(
        cookieHeader: String,
        logger: @escaping (String) -> Void) async -> String?
    {
        let endpoints = [
            "https://chatgpt.com/backend-api/me",
            "https://chatgpt.com/api/auth/session",
        ]
        for endpoint in endpoints {
            guard let url = URL(string: endpoint) else { continue }
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.timeoutInterval = 8
            request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue("en-US,en;q=0.9", forHTTPHeaderField: "Accept-Language")
            request.setValue("CodexBar", forHTTPHeaderField: "User-Agent")
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                let status = (response as? HTTPURLResponse)?.statusCode ?? -1
                logger("OpenAI identity API \(url.path) status=\(status)")
                guard status >= 200, status < 300 else { continue }
                if let email = Self.findFirstEmail(inJSONData: data) {
                    return email.trimmingCharacters(in: .whitespacesAndNewlines)
                }
            } catch {
                logger("OpenAI identity API \(url.path) failed: \(error.localizedDescription)")
            }
        }
        return nil
    }

    private static func makeWindow(_ window: CodexUsageResponse.WindowSnapshot?) -> RateWindow? {
        guard let window else { return nil }
        let resetDate = Date(timeIntervalSince1970: TimeInterval(window.resetAt))
        return RateWindow(
            usedPercent: Double(window.usedPercent),
            windowMinutes: window.limitWindowSeconds / 60,
            resetsAt: resetDate,
            resetDescription: UsageFormatter.resetDescription(from: resetDate))
    }

    private static func makeCredits(
        _ credits: CodexUsageResponse.CreditDetails?,
        updatedAt: Date) -> CreditsSnapshot?
    {
        guard let credits, let balance = credits.balance else { return nil }
        return CreditsSnapshot(remaining: balance, events: [], updatedAt: updatedAt)
    }

    private static func makeDashboard(
        signedInEmail: String?,
        usageResponse: CodexUsageResponse,
        primary: RateWindow?,
        secondary: RateWindow?,
        updatedAt: Date) -> OpenAIDashboardSnapshot
    {
        OpenAIDashboardSnapshot(
            signedInEmail: signedInEmail,
            codeReviewRemainingPercent: nil,
            creditEvents: [],
            dailyBreakdown: [],
            usageBreakdown: [],
            creditsPurchaseURL: nil,
            primaryLimit: primary,
            secondaryLimit: secondary,
            creditsRemaining: usageResponse.credits?.balance,
            accountPlan: usageResponse.planType?.rawValue,
            updatedAt: updatedAt)
    }

    private static func findFirstEmail(inJSONData data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data, options: []) else { return nil }
        var queue: [Any] = [json]
        var seen = 0
        while !queue.isEmpty, seen < 2000 {
            let current = queue.removeFirst()
            seen += 1
            if let string = current as? String, string.contains("@") {
                return string
            }
            if let dictionary = current as? [String: Any] {
                for (key, value) in dictionary {
                    if key.lowercased() == "email",
                       let string = value as? String,
                       string.contains("@")
                    {
                        return string
                    }
                    queue.append(value)
                }
            } else if let array = current as? [Any] {
                queue.append(contentsOf: array)
            }
        }
        return nil
    }
}

private enum LinuxOpenAIWebFetchError: LocalizedError, Sendable {
    case noCookiesFound
    case noSessionCookie
    case noUsageData
    case loginRequired
    case wrongAccount(expected: String, actual: String)
    case noMatchingAccount(String)
    case serverError(status: Int, body: String?)

    var errorDescription: String? {
        switch self {
        case .noCookiesFound:
            return "No ChatGPT/OpenAI browser cookies found."
        case .noSessionCookie:
            return "No authenticated ChatGPT session cookie found."
        case .noUsageData:
            return "OpenAI web usage API did not return usage limits."
        case .loginRequired:
            return "OpenAI web access requires login."
        case let .wrongAccount(expected, actual):
            return "OpenAI web dashboard belonged to the wrong account (expected \(expected), got \(actual))."
        case let .noMatchingAccount(details):
            return "No matching OpenAI web session found in browsers. \(details)"
        case let .serverError(status, body):
            if let body, !body.isEmpty {
                return "OpenAI web usage API error \(status): \(body)"
            }
            return "OpenAI web usage API error \(status)."
        }
    }
}
#endif
