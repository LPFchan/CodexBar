import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const UUID = 'codexbar-gnome@gnome.codexbar';
const DEFAULT_BACKEND_PATH = 'codexbar';
const DEFAULT_CONFIG_DIR = GLib.build_filenamev([GLib.get_home_dir(), '.codexbar']);
const MENU_CARD_BASE_WIDTH = 310;
const MENU_CARD_MAX_WIDTH = 360;
const PANEL_BAR_WIDTH = 15;
const PANEL_BAR_HEIGHT = 6;
const MENU_PROGRESS_WIDTH = 278;
const MENU_PROGRESS_HEIGHT = 6;
const MAX_LOADING_SECONDS = 30;
const LOADING_FPS_MS = 33;
const BLINK_DURATION_MS = 360;
const OVERVIEW_PROVIDER_LIMIT = 3;

const REFRESH_SECONDS = {
    manual: 0,
    oneMinute: 60,
    twoMinutes: 120,
    fiveMinutes: 300,
    fifteenMinutes: 900,
    thirtyMinutes: 1800,
};

const DISPLAY_MODES = {
    percent: 'percent',
    pace: 'pace',
    both: 'both',
};

const METRIC_PREFERENCES = {
    automatic: 'automatic',
    primary: 'primary',
    secondary: 'secondary',
    tertiary: 'tertiary',
    extraUsage: 'extraUsage',
    average: 'average',
};

const LOADING_PATTERNS = ['knightRider', 'cylon', 'outsideIn', 'race', 'pulse', 'unbraid'];

const PROVIDERS = [
    'codex', 'claude', 'cursor', 'opencode', 'opencodego', 'alibaba', 'factory', 'gemini',
    'antigravity', 'copilot', 'zai', 'minimax', 'kimi', 'kilo', 'kiro', 'vertexai',
    'augment', 'jetbrains', 'kimik2', 'amp', 'ollama', 'synthetic', 'warp', 'openrouter',
    'windsurf', 'perplexity', 'abacus', 'mistral', 'deepseek', 'codebuff',
];

const PROVIDER_META = {
    abacus: {
        id: 'abacus',
        displayName: 'Abacus AI',
        sessionLabel: 'Credits',
        weeklyLabel: 'Weekly',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'AB',
        accent: '#4e9a06',
        iconStyle: 'combined',
        cliName: 'abacusai',
        dashboardURL: 'https://apps.abacus.ai/chatllm/admin/compute-points-usage',
        statusURL: null,
        creditsHint: '',
    },
    alibaba: {
        id: 'alibaba',
        displayName: 'Alibaba',
        sessionLabel: '5-hour',
        weeklyLabel: 'Weekly',
        opusLabel: 'Monthly',
        supportsOpus: true,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'AL',
        accent: '#ff6a00',
        iconStyle: 'combined',
        cliName: 'alibaba-coding-plan',
        dashboardURL: 'https://bailian.console.aliyun.com/',
        statusURL: 'https://status.aliyun.com',
        creditsHint: '',
    },
    amp: {
        id: 'amp',
        displayName: 'Amp',
        sessionLabel: 'Amp Free',
        weeklyLabel: 'Balance',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'AM',
        accent: '#ff5f57',
        iconStyle: 'combined',
        cliName: 'amp',
        dashboardURL: 'https://ampcode.com/settings',
        statusURL: null,
        creditsHint: '',
    },
    antigravity: {
        id: 'antigravity',
        displayName: 'Antigravity',
        sessionLabel: 'Claude',
        weeklyLabel: 'Gemini Pro',
        opusLabel: 'Gemini Flash',
        supportsOpus: true,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'AG',
        accent: '#6f42c1',
        iconStyle: 'antigravity',
        cliName: 'antigravity',
        dashboardURL: null,
        statusURL: 'https://www.google.com/appsstatus/dashboard/products/npdyhgECDJ6tB66MxXyo/history',
        creditsHint: '',
    },
    augment: {
        id: 'augment',
        displayName: 'Augment',
        sessionLabel: 'Credits',
        weeklyLabel: 'Usage',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: true,
        defaultEnabled: false,
        badge: 'AU',
        accent: '#2aa198',
        iconStyle: 'combined',
        cliName: 'augment',
        dashboardURL: 'https://app.augmentcode.com/account/subscription',
        statusURL: null,
        creditsHint: 'Augment Code credits for AI-powered coding assistance.',
    },
    claude: {
        id: 'claude',
        displayName: 'Claude',
        sessionLabel: 'Session',
        weeklyLabel: 'Weekly',
        opusLabel: 'Sonnet',
        supportsOpus: true,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'CL',
        accent: '#d97757',
        iconStyle: 'claude',
        cliName: 'claude',
        dashboardURL: 'https://console.anthropic.com/settings/billing',
        statusURL: 'https://status.claude.com/',
        creditsHint: '',
    },
    codebuff: {
        id: 'codebuff',
        displayName: 'Codebuff',
        sessionLabel: 'Credits',
        weeklyLabel: 'Weekly',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: true,
        defaultEnabled: false,
        badge: 'CB',
        accent: '#3584e4',
        iconStyle: 'combined',
        cliName: 'codebuff',
        dashboardURL: 'https://www.codebuff.com/usage',
        statusURL: null,
        creditsHint: 'Credit balance from the Codebuff API',
    },
    codex: {
        id: 'codex',
        displayName: 'Codex',
        sessionLabel: 'Session',
        weeklyLabel: 'Weekly',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: true,
        defaultEnabled: true,
        badge: 'CX',
        accent: '#10a37f',
        iconStyle: 'codex',
        cliName: 'codex',
        dashboardURL: 'https://chatgpt.com/codex/settings/usage',
        statusURL: 'https://status.openai.com/',
        creditsHint: 'Credits unavailable; keep Codex running to refresh.',
    },
    copilot: {
        id: 'copilot',
        displayName: 'Copilot',
        sessionLabel: 'Premium',
        weeklyLabel: 'Chat',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'CP',
        accent: '#6e7681',
        iconStyle: 'combined',
        cliName: 'copilot',
        dashboardURL: 'https://github.com/settings/copilot',
        statusURL: 'https://www.githubstatus.com/',
        creditsHint: '',
    },
    cursor: {
        id: 'cursor',
        displayName: 'Cursor',
        sessionLabel: 'Total',
        weeklyLabel: 'Auto',
        opusLabel: 'API',
        supportsOpus: true,
        supportsCredits: true,
        defaultEnabled: false,
        badge: 'CU',
        accent: '#0f766e',
        iconStyle: 'combined',
        cliName: 'cursor',
        dashboardURL: 'https://cursor.com/dashboard?tab=usage',
        statusURL: 'https://status.cursor.com',
        creditsHint: 'On-demand usage beyond included plan limits.',
    },
    deepseek: {
        id: 'deepseek',
        displayName: 'DeepSeek',
        sessionLabel: 'Balance',
        weeklyLabel: 'Balance',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'DS',
        accent: '#2563eb',
        iconStyle: 'combined',
        cliName: 'deepseek',
        dashboardURL: 'https://platform.deepseek.com/usage',
        statusURL: 'https://status.deepseek.com',
        creditsHint: '',
    },
    factory: {
        id: 'factory',
        displayName: 'Droid',
        sessionLabel: 'Standard',
        weeklyLabel: 'Premium',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'DR',
        accent: '#e5a50a',
        iconStyle: 'factory',
        cliName: 'factory',
        dashboardURL: 'https://app.factory.ai/settings/billing',
        statusURL: 'https://status.factory.ai',
        creditsHint: '',
    },
    gemini: {
        id: 'gemini',
        displayName: 'Gemini',
        sessionLabel: 'Pro',
        weeklyLabel: 'Flash',
        opusLabel: 'Flash Lite',
        supportsOpus: true,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'GE',
        accent: '#4285f4',
        iconStyle: 'gemini',
        cliName: 'gemini',
        dashboardURL: 'https://gemini.google.com',
        statusURL: 'https://www.google.com/appsstatus/dashboard/products/npdyhgECDJ6tB66MxXyo/history',
        creditsHint: '',
    },
    jetbrains: {
        id: 'jetbrains',
        displayName: 'JetBrains AI',
        sessionLabel: 'Current',
        weeklyLabel: 'Refill',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'JB',
        accent: '#ff2d55',
        iconStyle: 'combined',
        cliName: 'jetbrains',
        dashboardURL: null,
        statusURL: null,
        creditsHint: '',
    },
    kilo: {
        id: 'kilo',
        displayName: 'Kilo',
        sessionLabel: 'Credits',
        weeklyLabel: 'Kilo Pass',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'KI',
        accent: '#26a269',
        iconStyle: 'combined',
        cliName: 'kilo',
        dashboardURL: 'https://app.kilo.ai/usage',
        statusURL: null,
        creditsHint: '',
    },
    kimi: {
        id: 'kimi',
        displayName: 'Kimi',
        sessionLabel: 'Weekly',
        weeklyLabel: 'Rate Limit',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'KM',
        accent: '#0891b2',
        iconStyle: 'combined',
        cliName: 'kimi',
        dashboardURL: 'https://www.kimi.com/code/console',
        statusURL: null,
        creditsHint: '',
    },
    kimik2: {
        id: 'kimik2',
        displayName: 'Kimi K2',
        sessionLabel: 'Credits',
        weeklyLabel: 'Credits',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'K2',
        accent: '#06b6d4',
        iconStyle: 'combined',
        cliName: 'kimik2',
        dashboardURL: 'https://kimi-k2.ai/my-credits',
        statusURL: null,
        creditsHint: '',
    },
    kiro: {
        id: 'kiro',
        displayName: 'Kiro',
        sessionLabel: 'Credits',
        weeklyLabel: 'Bonus',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'KR',
        accent: '#fb923c',
        iconStyle: 'combined',
        cliName: 'kiro',
        dashboardURL: 'https://app.kiro.dev/account/usage',
        statusURL: 'https://health.aws.amazon.com/health/status',
        creditsHint: '',
    },
    minimax: {
        id: 'minimax',
        displayName: 'MiniMax',
        sessionLabel: 'Prompts',
        weeklyLabel: 'Window',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'MM',
        accent: '#f97316',
        iconStyle: 'combined',
        cliName: 'minimax',
        dashboardURL: 'https://platform.minimax.io/user-center/payment/coding-plan?cycle_type=3',
        statusURL: null,
        creditsHint: '',
    },
    mistral: {
        id: 'mistral',
        displayName: 'Mistral',
        sessionLabel: 'Monthly',
        weeklyLabel: '',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'MI',
        accent: '#ff7000',
        iconStyle: 'combined',
        cliName: 'mistral',
        dashboardURL: 'https://admin.mistral.ai/organization/usage',
        statusURL: 'https://status.mistral.ai',
        creditsHint: '',
    },
    ollama: {
        id: 'ollama',
        displayName: 'Ollama',
        sessionLabel: 'Session',
        weeklyLabel: 'Weekly',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'OL',
        accent: '#77767b',
        iconStyle: 'combined',
        cliName: 'ollama',
        dashboardURL: 'https://ollama.com/settings',
        statusURL: null,
        creditsHint: '',
    },
    opencode: {
        id: 'opencode',
        displayName: 'OpenCode',
        sessionLabel: '5-hour',
        weeklyLabel: 'Weekly',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'OC',
        accent: '#1c71d8',
        iconStyle: 'opencode',
        cliName: 'opencode',
        dashboardURL: 'https://opencode.ai',
        statusURL: null,
        creditsHint: '',
    },
    opencodego: {
        id: 'opencodego',
        displayName: 'OpenCode Go',
        sessionLabel: '5-hour',
        weeklyLabel: 'Weekly',
        opusLabel: 'Monthly',
        supportsOpus: true,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'OG',
        accent: '#0ea5e9',
        iconStyle: 'opencodego',
        cliName: 'opencodego',
        dashboardURL: 'https://opencode.ai',
        statusURL: null,
        creditsHint: '',
    },
    openrouter: {
        id: 'openrouter',
        displayName: 'OpenRouter',
        sessionLabel: 'Credits',
        weeklyLabel: 'Usage',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: true,
        defaultEnabled: false,
        badge: 'OR',
        accent: '#0f172a',
        iconStyle: 'openrouter',
        cliName: 'openrouter',
        dashboardURL: 'https://openrouter.ai/settings/credits',
        statusURL: 'https://status.openrouter.ai',
        creditsHint: 'Credit balance from OpenRouter API',
    },
    perplexity: {
        id: 'perplexity',
        displayName: 'Perplexity',
        sessionLabel: 'Credits',
        weeklyLabel: 'Bonus credits',
        opusLabel: 'Purchased',
        supportsOpus: true,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'PX',
        accent: '#20b2aa',
        iconStyle: 'combined',
        cliName: 'perplexity',
        dashboardURL: 'https://www.perplexity.ai/account/usage',
        statusURL: 'https://status.perplexity.com/',
        creditsHint: '',
    },
    synthetic: {
        id: 'synthetic',
        displayName: 'Synthetic',
        sessionLabel: 'Five-hour quota',
        weeklyLabel: 'Weekly tokens',
        opusLabel: 'Search hourly',
        supportsOpus: true,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'SY',
        accent: '#8b5cf6',
        iconStyle: 'combined',
        cliName: 'synthetic',
        dashboardURL: null,
        statusURL: null,
        creditsHint: 'Weekly token quota regenerates continuously.',
    },
    vertexai: {
        id: 'vertexai',
        displayName: 'Vertex AI',
        sessionLabel: 'Requests',
        weeklyLabel: 'Tokens',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'VA',
        accent: '#34a853',
        iconStyle: 'combined',
        cliName: 'vertexai',
        dashboardURL: 'https://console.cloud.google.com/vertex-ai',
        statusURL: 'https://status.cloud.google.com',
        creditsHint: '',
    },
    warp: {
        id: 'warp',
        displayName: 'Warp',
        sessionLabel: 'Credits',
        weeklyLabel: 'Add-on credits',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'WA',
        accent: '#7c3aed',
        iconStyle: 'warp',
        cliName: 'warp',
        dashboardURL: 'https://docs.warp.dev/reference/cli/api-keys',
        statusURL: null,
        creditsHint: '',
    },
    windsurf: {
        id: 'windsurf',
        displayName: 'Windsurf',
        sessionLabel: 'Daily',
        weeklyLabel: 'Weekly',
        opusLabel: null,
        supportsOpus: false,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'WS',
        accent: '#00a6a6',
        iconStyle: 'combined',
        cliName: 'windsurf',
        dashboardURL: 'https://windsurf.com/subscription/usage',
        statusURL: null,
        creditsHint: '',
    },
    zai: {
        id: 'zai',
        displayName: 'z.ai',
        sessionLabel: 'Tokens',
        weeklyLabel: 'MCP',
        opusLabel: '5-hour',
        supportsOpus: true,
        supportsCredits: false,
        defaultEnabled: false,
        badge: 'ZA',
        accent: '#16a34a',
        iconStyle: 'zai',
        cliName: 'zai',
        dashboardURL: 'https://z.ai/manage-apikey/subscription',
        statusURL: null,
        creditsHint: '',
    },
};

function clamp(value, min = 0, max = 100) {
    if (Number.isNaN(value) || value === null || value === undefined)
        return min;
    return Math.min(max, Math.max(min, Number(value)));
}

function cleanString(value) {
    if (typeof value !== 'string')
        return '';
    return value.trim();
}

function titleCaseProvider(id) {
    return id.split(/[-_]/)
        .filter(part => part.length > 0)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function deterministicColor(input) {
    let hash = 0;
    for (let idx = 0; idx < input.length; idx++)
        hash = ((hash << 5) - hash + input.charCodeAt(idx)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 62%, 45%)`;
}

function providerMeta(id) {
    if (PROVIDER_META[id])
        return PROVIDER_META[id];
    return {
        id,
        displayName: titleCaseProvider(id),
        sessionLabel: 'Primary',
        weeklyLabel: 'Secondary',
        opusLabel: 'Tertiary',
        supportsOpus: true,
        supportsCredits: false,
        defaultEnabled: false,
        badge: id.slice(0, 2).toUpperCase(),
        accent: deterministicColor(id),
        iconStyle: 'combined',
        cliName: id,
        dashboardURL: null,
        statusURL: null,
        creditsHint: '',
    };
}

function formatPercent(value) {
    return `${Math.round(clamp(value))}%`;
}

function formatCurrency(value, currencyCode = 'USD') {
    const amount = Number(value);
    if (!Number.isFinite(amount))
        return '';
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currencyCode || 'USD',
            maximumFractionDigits: amount >= 10 ? 0 : 2,
        }).format(amount);
    } catch (_) {
        return `${currencyCode || 'USD'} ${amount.toFixed(2)}`;
    }
}

function formatNumber(value, maximumFractionDigits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number))
        return '';
    return new Intl.NumberFormat(undefined, {maximumFractionDigits}).format(number);
}

function parseDate(value) {
    if (!value)
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    return date;
}

function relativeUpdatedText(value, now = new Date()) {
    const date = parseDate(value);
    if (!date)
        return 'Not fetched yet';
    const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
    if (seconds < 45)
        return 'Updated just now';
    if (seconds < 3600)
        return `Updated ${Math.round(seconds / 60)}m ago`;
    if (seconds < 86400)
        return `Updated ${Math.round(seconds / 3600)}h ago`;
    return `Updated ${Math.round(seconds / 86400)}d ago`;
}

function durationText(seconds) {
    const absolute = Math.max(0, Math.round(seconds));
    if (absolute < 60)
        return 'now';
    const minutes = Math.round(absolute / 60);
    if (minutes < 60)
        return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    if (hours < 24)
        return restMinutes > 0 ? `${hours}h ${restMinutes}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    return restHours > 0 ? `${days}d ${restHours}h` : `${days}d`;
}

function resetText(window, absolute, now = new Date()) {
    const description = cleanString(window?.resetDescription);
    if (description)
        return description;
    const date = parseDate(window?.resetsAt);
    if (!date)
        return null;
    if (absolute) {
        return `Resets ${new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit',
        }).format(date)}`;
    }
    const seconds = (date.getTime() - now.getTime()) / 1000;
    return `Resets in ${durationText(seconds)}`;
}

function rateRemaining(window) {
    if (!window)
        return null;
    return clamp(100 - Number(window.usedPercent ?? 0));
}

function ratePercent(window, showUsed) {
    if (!window)
        return null;
    return showUsed ? clamp(window.usedPercent) : rateRemaining(window);
}

function windowForPreference(provider, usage, preference) {
    if (!usage)
        return null;
    const meta = providerMeta(provider);
    if (preference === METRIC_PREFERENCES.extraUsage)
        return extraUsageWindow(usage);
    if (preference === METRIC_PREFERENCES.primary)
        return orderedWindow(provider, usage, ['primary', 'secondary', 'tertiary']);
    if (preference === METRIC_PREFERENCES.secondary)
        return orderedWindow(provider, usage, provider === 'perplexity'
            ? ['secondary', 'tertiary', 'primary']
            : ['secondary', 'primary', 'tertiary']);
    if (preference === METRIC_PREFERENCES.tertiary)
        return orderedWindow(provider, usage, ['tertiary', 'secondary', 'primary']);
    if (preference === METRIC_PREFERENCES.average) {
        if (meta.supportsOpus && usage.primary && usage.secondary) {
            return {
                usedPercent: (Number(usage.primary.usedPercent ?? 0) + Number(usage.secondary.usedPercent ?? 0)) / 2,
                windowMinutes: null,
                resetsAt: null,
                resetDescription: null,
            };
        }
        return usage.primary ?? usage.secondary ?? usage.tertiary ?? null;
    }
    return automaticWindow(provider, usage);
}

function orderedWindow(_provider, usage, lanes) {
    for (const lane of lanes) {
        if (usage[lane])
            return usage[lane];
    }
    return null;
}

function automaticWindow(provider, usage) {
    if (!usage)
        return null;
    if (provider === 'perplexity')
        return perplexityAutomaticWindow(usage);
    if (provider === 'zai')
        return mostConstrained([usage.primary, usage.tertiary]) ?? usage.secondary ?? null;
    if (provider === 'factory' || provider === 'kimi')
        return usage.secondary ?? usage.primary ?? null;
    if (provider === 'copilot' && usage.primary && usage.secondary)
        return Number(usage.primary.usedPercent ?? 0) >= Number(usage.secondary.usedPercent ?? 0)
            ? usage.primary
            : usage.secondary;
    if (provider === 'cursor' || provider === 'antigravity')
        return mostConstrained([usage.primary, usage.secondary, usage.tertiary]);
    return usage.primary ?? usage.secondary ?? usage.tertiary ?? null;
}

function perplexityAutomaticWindow(usage) {
    const primary = usage.primary;
    const fallbacks = [usage.tertiary, usage.secondary].filter(Boolean);
    if (!primary)
        return fallbacks[0] ?? null;
    if (rateRemaining(primary) > 0 || fallbacks.length === 0)
        return primary;
    return fallbacks.find(window => rateRemaining(window) > 0) ?? fallbacks[0] ?? primary;
}

function mostConstrained(windows) {
    const present = windows.filter(Boolean);
    if (present.length === 0)
        return null;
    return present.reduce((best, window) => Number(window.usedPercent ?? 0) > Number(best.usedPercent ?? 0) ? window : best);
}

function extraUsageWindow(usage) {
    const cost = usage?.providerCost;
    if (!cost || Number(cost.limit ?? 0) <= 0)
        return null;
    return {
        usedPercent: clamp(Number(cost.used ?? 0) / Number(cost.limit) * 100),
        windowMinutes: null,
        resetsAt: cost.resetsAt ?? null,
        resetDescription: null,
    };
}

function errorMessage(error) {
    if (!error)
        return '';
    if (typeof error === 'string')
        return error;
    return cleanString(error.message) || cleanString(error.description) || JSON.stringify(error);
}

function sourceSubtitle(source, plan, status) {
    const parts = [];
    if (source)
        parts.push(source);
    if (plan)
        parts.push(plan);
    if (status && status.indicator && status.indicator !== 'none')
        parts.push(status.description || status.indicator);
    return parts.join(' · ');
}

function redacted(text, enabled) {
    if (!enabled || !text)
        return text || '';
    return `${text}`.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, 'Hidden');
}

function makePace(window, showUsed, now = new Date()) {
    const reset = parseDate(window?.resetsAt);
    const minutes = Number(window?.windowMinutes ?? 0);
    if (!reset || !Number.isFinite(minutes) || minutes <= 0)
        return null;
    const start = reset.getTime() - minutes * 60 * 1000;
    const elapsed = now.getTime() - start;
    const expectedUsed = clamp(elapsed / (minutes * 60 * 1000) * 100);
    const used = clamp(window.usedPercent ?? 0);
    const delta = used - expectedUsed;
    let leftLabel = 'On pace';
    if (Math.abs(delta) >= 4)
        leftLabel = delta > 0 ? `${Math.round(Math.abs(delta))}% in deficit` : `${Math.round(Math.abs(delta))}% in reserve`;

    let rightLabel = 'Lasts until reset';
    if (delta > 4) {
        const usedPerSecond = used / Math.max(1, elapsed / 1000);
        const secondsToRunout = (100 - used) / Math.max(0.001, usedPerSecond);
        rightLabel = `Runs out in ${durationText(secondsToRunout)}`;
        if (delta > 20)
            rightLabel = `${rightLabel} · ≈ ${Math.round(Math.min(95, delta * 2) / 5) * 5}% run-out risk`;
    }

    return {
        leftLabel: `Pace: ${leftLabel} · Expected ${Math.round(expectedUsed)}% used`,
        rightLabel,
        expectedUsedPercent: expectedUsed,
        pacePercent: showUsed ? expectedUsed : 100 - expectedUsed,
        paceOnTop: delta <= 0,
    };
}

function loadingValue(pattern, phase) {
    let value = 0;
    if (pattern === 'knightRider')
        value = 0.5 + 0.5 * Math.sin(phase);
    else if (pattern === 'cylon')
        value = (phase % (Math.PI * 2)) / (Math.PI * 2);
    else if (pattern === 'outsideIn')
        value = Math.abs(Math.cos(phase));
    else if (pattern === 'race')
        value = ((phase * 1.2) % (Math.PI * 2)) / (Math.PI * 2);
    else if (pattern === 'pulse')
        value = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(phase));
    else
        value = 0.5 + 0.5 * Math.sin(phase);
    return clamp(value * 100);
}

function loadingSecondaryOffset(pattern) {
    if (pattern === 'knightRider' || pattern === 'outsideIn')
        return Math.PI;
    if (pattern === 'cylon' || pattern === 'pulse' || pattern === 'unbraid')
        return Math.PI / 2;
    return Math.PI / 3;
}

function launchURI(uri) {
    if (!uri)
        return;
    try {
        Gio.AppInfo.launch_default_for_uri(uri, global.create_app_launch_context(0, -1));
    } catch (error) {
        Main.notify('CodexBar', `Could not open ${uri}: ${error.message}`);
    }
}

function clearChildren(actor) {
    for (const child of actor.get_children())
        child.destroy();
}

function styleAccent(color) {
    return `background-color: ${color};`;
}

function menuItemWithActor(actor, reactive = false) {
    const item = new PopupMenu.PopupBaseMenuItem({
        reactive,
        can_focus: reactive,
        style_class: 'codexbar-menu-item',
    });
    item.add_child(actor);
    return item;
}

const CodexBarIndicator = GObject.registerClass(
class CodexBarIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'CodexBar');
        this._extension = extension;
        this._settings = extension.getSettings();
        this._payload = [];
        this._models = [];
        this._selectedProvider = this._settings.get_string('selected-menu-provider') || 'codex';
        this._lastError = '';
        this._refreshInFlight = false;
        this._refreshTimer = 0;
        this._animationTimer = 0;
        this._blinkTimer = 0;
        this._blinkFrameTimer = 0;
        this._animationPhase = 0;
        this._loadingStartedAt = 0;
        this._blinkAmount = 0;
        this._motionAmount = 0;
        this._injectedError = '';
        this._settingsSignals = [];

        this._panelBox = new St.BoxLayout({
            style_class: 'codexbar-panel-box',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._panelBox);

        this._connectSettings();
        this._rebuildPanel();
        this._scheduleRefresh();
        this._scheduleBlink();
        this.refresh(true);
    }

    destroy() {
        this._disconnectSettings();
        this._clearTimer('_refreshTimer');
        this._clearTimer('_animationTimer');
        this._clearTimer('_blinkTimer');
        this._clearTimer('_blinkFrameTimer');
        super.destroy();
    }

    _connectSettings() {
        const keys = [
            'backend-path',
            'refresh-frequency',
            'refresh-interval',
            'usage-bars-show-used',
            'reset-times-show-absolute',
            'menu-bar-shows-brand-icon-with-percent',
            'menu-bar-display-mode',
            'menu-bar-shows-highest-usage',
            'random-blink-enabled',
            'switcher-shows-icons',
            'merge-icons',
            'selected-menu-provider',
            'merged-menu-last-selected-was-overview',
            'merged-overview-selected-providers',
            'show-optional-credits-and-extra-usage',
            'show-all-token-accounts-in-menu',
            'hide-personal-info',
            'enabled-providers',
            'debug-loading-pattern',
            'debug-injected-error',
        ];
        for (const key of keys) {
            const signal = this._settings.connect(`changed::${key}`, () => {
                if (key === 'refresh-frequency' || key === 'refresh-interval')
                    this._scheduleRefresh();
                if (key === 'selected-menu-provider')
                    this._selectedProvider = this._settings.get_string('selected-menu-provider') || this._selectedProvider;
                if (key === 'random-blink-enabled')
                    this._scheduleBlink();
                this._models = this._payload.map(entry => this._makeModel(entry));
                this._rebuildPanel();
                this._rebuildMenu();
            });
            this._settingsSignals.push(signal);
        }
    }

    _disconnectSettings() {
        for (const signal of this._settingsSignals)
            this._settings.disconnect(signal);
        this._settingsSignals = [];
    }

    _clearTimer(name) {
        if (this[name]) {
            GLib.Source.remove(this[name]);
            this[name] = 0;
        }
    }

    _scheduleRefresh() {
        this._clearTimer('_refreshTimer');
        const seconds = this._refreshSeconds();
        if (seconds <= 0)
            return;
        this._refreshTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this.refresh(false);
            return GLib.SOURCE_CONTINUE;
        });
    }

    _refreshSeconds() {
        const raw = this._settings.get_string('refresh-frequency');
        if (REFRESH_SECONDS[raw] !== undefined)
            return REFRESH_SECONDS[raw];
        const legacy = this._settings.get_uint('refresh-interval');
        return legacy > 0 ? legacy : REFRESH_SECONDS.fiveMinutes;
    }

    _scheduleBlink() {
        this._clearTimer('_blinkTimer');
        this._clearTimer('_blinkFrameTimer');
        if (!this._settings.get_boolean('random-blink-enabled'))
            return;
        const seconds = 3 + Math.floor(Math.random() * 10);
        this._blinkTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._runBlink();
            return GLib.SOURCE_REMOVE;
        });
    }

    _runBlink() {
        this._clearTimer('_blinkFrameTimer');
        const provider = this._primaryProvider()?.provider ?? 'codex';
        const claudeMotion = provider === 'claude';
        const started = GLib.get_monotonic_time() / 1000;
        this._blinkFrameTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, LOADING_FPS_MS, () => {
            const elapsed = GLib.get_monotonic_time() / 1000 - started;
            if (elapsed >= BLINK_DURATION_MS) {
                this._blinkAmount = 0;
                this._motionAmount = 0;
                this._rebuildPanel();
                this._blinkFrameTimer = 0;
                this._scheduleBlink();
                return GLib.SOURCE_REMOVE;
            }
            const progress = elapsed / BLINK_DURATION_MS;
            const symmetric = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
            this._blinkAmount = Math.pow(symmetric, 2.2);
            this._motionAmount = claudeMotion
                ? Math.sin(progress * Math.PI * 4) * 2
                : Math.sin(progress * Math.PI) * 4;
            this._rebuildPanel();
            return GLib.SOURCE_CONTINUE;
        });
    }

    refresh(force = false) {
        if (this._refreshInFlight && !force)
            return;
        const backendPath = this._resolveBackendPath();
        if (!backendPath) {
            this._handleRefreshError(`Backend not found in PATH: ${DEFAULT_BACKEND_PATH}`);
            return;
        }

        this._refreshInFlight = true;
        this._lastError = '';
        this._startLoadingAnimation();
        this._rebuildPanel();
        const argv = [backendPath, 'usage', '--format', 'json', '--source', 'auto', '--provider', 'all'];
        const process = Gio.Subprocess.new(
            argv,
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        process.communicate_utf8_async(null, null, (_process, result) => {
            try {
                const [, stdout, stderr] = process.communicate_utf8_finish(result);
                this._refreshInFlight = false;
                this._stopLoadingAnimation();
                if (stdout && stdout.trim()) {
                    const parsed = JSON.parse(stdout);
                    this._payload = this._filterPayload(Array.isArray(parsed) ? parsed : []);
                    this._models = this._payload.map(entry => this._makeModel(entry));
                    this._ensureSelectedProvider();
                    this._rebuildPanel();
                    this._rebuildMenu();
                    return;
                }
                const message = stderr?.trim() || 'Backend returned no JSON output.';
                this._handleRefreshError(message);
            } catch (error) {
                this._refreshInFlight = false;
                this._stopLoadingAnimation();
                this._handleRefreshError(error instanceof Error ? error.message : `${error}`);
            }
        });
    }

    _resolveBackendPath() {
        const configured = this._settings.get_string('backend-path').trim();
        const command = configured.length > 0 ? configured : DEFAULT_BACKEND_PATH;
        if (command.includes('/')) {
            return GLib.file_test(command, GLib.FileTest.EXISTS | GLib.FileTest.IS_EXECUTABLE)
                ? command
                : null;
        }
        return GLib.find_program_in_path(command);
    }

    _filterPayload(payload) {
        const enabled = new Set(this._settings.get_strv('enabled-providers'));
        if (enabled.size === 0)
            return payload;
        const filtered = payload.filter(entry => enabled.has(entry.provider));
        return filtered.length > 0 ? filtered : payload;
    }

    _handleRefreshError(message) {
        this._lastError = message;
        this._rebuildPanel();
        this._rebuildMenu();
    }

    _startLoadingAnimation() {
        this._clearTimer('_animationTimer');
        this._animationPhase = 0;
        this._loadingStartedAt = GLib.get_monotonic_time() / 1000000;
        this._animationTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, LOADING_FPS_MS, () => {
            const elapsed = GLib.get_monotonic_time() / 1000000 - this._loadingStartedAt;
            if (elapsed > MAX_LOADING_SECONDS) {
                this._stopLoadingAnimation();
                return GLib.SOURCE_REMOVE;
            }
            this._animationPhase += 0.16;
            this._rebuildPanel();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopLoadingAnimation() {
        this._clearTimer('_animationTimer');
        this._animationPhase = 0;
        this._loadingStartedAt = 0;
    }

    _ensureSelectedProvider() {
        if (this._models.some(model => model.provider === this._selectedProvider))
            return;
        const stored = this._settings.get_string('selected-menu-provider');
        if (this._models.some(model => model.provider === stored)) {
            this._selectedProvider = stored;
            return;
        }
        this._selectedProvider = this._models[0]?.provider ?? 'codex';
    }

    _activeModels() {
        if (this._models.length > 0)
            return this._models;
        return [];
    }

    _selectedModel() {
        const active = this._activeModels();
        return active.find(model => model.provider === this._selectedProvider) ?? active[0] ?? null;
    }

    _primaryProvider() {
        const active = this._activeModels();
        if (active.length === 0)
            return null;
        if (this._settings.get_boolean('menu-bar-shows-highest-usage')) {
            return active.reduce((best, model) => {
                const score = model.iconWindow ? Number(model.iconWindow.usedPercent ?? 0) : -1;
                const bestScore = best.iconWindow ? Number(best.iconWindow.usedPercent ?? 0) : -1;
                return score > bestScore ? model : best;
            });
        }
        return this._selectedModel() ?? active[0];
    }

    _makeModel(entry) {
        const provider = entry.provider ?? 'unknown';
        const meta = providerMeta(provider);
        const usage = entry.usage ?? null;
        const status = entry.status ?? null;
        const error = errorMessage(entry.error);
        const injected = this._settings.get_string('debug-injected-error').trim();
        const lastError = injected || error;
        const showUsed = this._settings.get_boolean('usage-bars-show-used');
        const absoluteReset = this._settings.get_boolean('reset-times-show-absolute');
        const hidePersonal = this._settings.get_boolean('hide-personal-info');
        const now = new Date();
        const identity = usage?.identity ?? {};
        const email = redacted(identity.accountEmail ?? usage?.accountEmail ?? entry.account ?? '', hidePersonal);
        const plan = cleanString(identity.loginMethod ?? usage?.loginMethod ?? '');
        const source = cleanString(entry.source ?? '');
        const statusSubtitle = sourceSubtitle(source, plan, status);
        let subtitleText = lastError || statusSubtitle || (usage ? relativeUpdatedText(usage.updatedAt, now) : 'Not fetched yet');
        let subtitleStyle = lastError ? 'error' : (this._refreshInFlight ? 'loading' : 'info');
        if (this._refreshInFlight && !usage && !lastError)
            subtitleText = 'Refreshing...';
        subtitleText = redacted(subtitleText, hidePersonal);
        const metrics = this._metrics(provider, meta, usage, showUsed, absoluteReset, now);
        const credits = this._credits(entry, meta);
        const providerCost = this._providerCost(provider, usage);
        const tokenUsage = this._tokenUsage(entry);
        const iconPreference = this._metricPreference(provider);
        const iconWindow = windowForPreference(provider, usage, iconPreference);
        const iconPercent = ratePercent(iconWindow, showUsed);
        const iconPace = makePace(iconWindow, showUsed, now);
        const placeholder = !usage && !this._refreshInFlight && !lastError ? 'No usage yet' : null;
        return {
            provider,
            providerName: meta.displayName,
            email,
            subtitleText,
            subtitleStyle,
            planText: plan || null,
            metrics,
            usageNotes: this._usageNotes(provider, usage),
            creditsText: credits.text,
            creditsRemaining: credits.remaining,
            creditsHintText: credits.hint,
            creditsHintCopyText: credits.hint,
            providerCost,
            tokenUsage,
            placeholder,
            progressColor: meta.accent,
            status,
            source,
            version: entry.version ?? '',
            account: entry.account ?? '',
            error: lastError,
            raw: entry,
            usage,
            iconWindow,
            iconPercent,
            iconPace,
            meta,
        };
    }

    _metricPreference(provider) {
        const raw = this._settings.get_value('menu-bar-metric-preferences').deep_unpack();
        return raw[provider] || METRIC_PREFERENCES.automatic;
    }

    _metrics(provider, meta, usage, showUsed, absoluteReset, now) {
        if (!usage)
            return [];
        const percentStyle = showUsed ? 'used' : 'left';
        const metrics = [];
        const pushMetric = (id, title, window, options = {}) => {
            if (!window)
                return;
            const pace = makePace(window, showUsed, now);
            metrics.push({
                id,
                title,
                percent: ratePercent(window, showUsed),
                percentStyle,
                statusText: options.statusText ?? null,
                resetText: options.resetText ?? resetText(window, absoluteReset, now),
                detailText: options.detailText ?? null,
                detailLeftText: options.detailLeftText ?? pace?.leftLabel ?? null,
                detailRightText: options.detailRightText ?? pace?.rightLabel ?? null,
                pacePercent: pace?.pacePercent ?? null,
                paceOnTop: pace?.paceOnTop ?? true,
            });
        };

        if (provider === 'antigravity') {
            pushMetric('primary', meta.sessionLabel, usage.primary);
            pushMetric('secondary', meta.weeklyLabel, usage.secondary);
            pushMetric('tertiary', meta.opusLabel ?? 'Tertiary', usage.tertiary);
            return metrics;
        }

        pushMetric('primary', provider === 'openrouter' ? 'API key limit' : meta.sessionLabel, usage.primary);
        if (provider !== 'codex')
            pushMetric('secondary', meta.weeklyLabel || 'Weekly', usage.secondary);
        if (meta.supportsOpus)
            pushMetric('tertiary', meta.opusLabel || 'Sonnet', usage.tertiary);
        for (const namedWindow of usage.extraRateWindows ?? [])
            pushMetric(namedWindow.id, namedWindow.title, namedWindow.window);

        if (provider === 'kilo') {
            metrics.sort((lhs, rhs) => {
                const order = {secondary: 0, primary: 1};
                return (order[lhs.id] ?? 99) - (order[rhs.id] ?? 99);
            });
        }
        return metrics;
    }

    _usageNotes(provider, usage) {
        if (provider === 'claude')
            return [this._claudePeakHoursLabel()];
        if (provider === 'kilo') {
            const login = cleanString(usage?.identity?.loginMethod ?? usage?.loginMethod);
            if (!login)
                return [];
            return login.split('·').map(part => part.trim()).filter(Boolean).slice(1);
        }
        const quota = usage?.openRouterUsage?.keyQuotaStatus;
        if (provider === 'openrouter' && quota === 'noLimitConfigured')
            return ['No limit set for the API key'];
        if (provider === 'openrouter' && quota === 'unavailable')
            return ['API key limit unavailable right now'];
        return [];
    }

    _claudePeakHoursLabel() {
        if (!this._settings.get_boolean('claude-peak-hours-enabled'))
            return '';
        const hour = new Date().getHours();
        if (hour >= 9 && hour < 17)
            return 'Peak hours: usage may deplete faster';
        return 'Off peak: usage usually lasts longer';
    }

    _credits(entry, meta) {
        if (!this._settings.get_boolean('show-optional-credits-and-extra-usage'))
            return {text: null, remaining: null, hint: null};
        if (!entry.credits)
            return {text: null, remaining: null, hint: null};
        const remaining = Number(entry.credits.remaining);
        const text = Number.isFinite(remaining) ? `${formatNumber(remaining)} remaining` : 'Credits unavailable';
        return {
            text,
            remaining: Number.isFinite(remaining) ? remaining : null,
            hint: meta.creditsHint || null,
        };
    }

    _providerCost(provider, usage) {
        if (provider !== 'claude' && provider !== 'cursor')
            return null;
        if (!this._settings.get_boolean('show-optional-credits-and-extra-usage'))
            return null;
        const cost = usage?.providerCost;
        if (!cost || Number(cost.limit ?? 0) <= 0)
            return null;
        const used = Number(cost.used ?? 0);
        const limit = Number(cost.limit ?? 0);
        return {
            title: provider === 'claude' ? 'Extra usage' : 'On-demand usage',
            percentUsed: clamp(used / limit * 100),
            spendLine: `${formatCurrency(used, cost.currencyCode)} of ${formatCurrency(limit, cost.currencyCode)}${cost.period ? ` ${cost.period.toLowerCase()}` : ''}`,
        };
    }

    _tokenUsage(entry) {
        if (!this._settings.get_boolean('cost-usage-enabled'))
            return null;
        const token = entry.tokenUsage ?? entry.usage?.tokenUsage ?? null;
        if (!token)
            return null;
        return {
            sessionLine: token.sessionLine ?? token.todayLine ?? '',
            monthLine: token.monthLine ?? token.lastThirtyDaysLine ?? '',
            hintLine: token.hintLine ?? null,
            errorLine: token.errorLine ?? null,
            errorCopyText: token.errorCopyText ?? token.errorLine ?? null,
        };
    }

    _rebuildPanel() {
        clearChildren(this._panelBox);
        const model = this._primaryProvider();
        if (!model) {
            this._panelBox.add_child(this._makePanelCritter('codex', null, null, 'none', '#77767b'));
            return;
        }
        const showUsed = this._settings.get_boolean('usage-bars-show-used');
        const brandMode = this._settings.get_boolean('menu-bar-shows-brand-icon-with-percent');
        if (brandMode) {
            this._panelBox.add_child(this._makeProviderBadge(model, true));
            const text = this._displayText(model, showUsed);
            if (text) {
                this._panelBox.add_child(new St.Label({
                    text,
                    y_align: Clutter.ActorAlign.CENTER,
                    style_class: 'codexbar-panel-label',
                }));
            }
        } else {
            const primary = this._refreshInFlight ? this._loadingPercent(false) : ratePercent(model.iconWindow, showUsed);
            const secondary = this._refreshInFlight ? this._loadingPercent(true) : this._switcherMetricPercent(model, showUsed);
            this._panelBox.add_child(this._makePanelCritter(
                model.provider,
                primary,
                secondary,
                model.status?.indicator ?? 'none',
                model.progressColor));
        }
    }

    _loadingPattern() {
        const forced = this._settings.get_string('debug-loading-pattern');
        if (LOADING_PATTERNS.includes(forced))
            return forced;
        return 'knightRider';
    }

    _loadingPercent(secondary) {
        const pattern = this._loadingPattern();
        const phase = this._animationPhase + (secondary ? loadingSecondaryOffset(pattern) : 0);
        return loadingValue(pattern, phase);
    }

    _displayText(model, showUsed) {
        const mode = this._settings.get_string('menu-bar-display-mode') || DISPLAY_MODES.percent;
        const percent = model.iconWindow ? `${formatPercent(ratePercent(model.iconWindow, showUsed))}` : null;
        const pace = model.iconPace ? this._paceDeltaText(model.iconWindow) : null;
        if (mode === DISPLAY_MODES.pace)
            return pace;
        if (mode === DISPLAY_MODES.both && percent && pace)
            return `${percent} · ${pace}`;
        return percent;
    }

    _paceDeltaText(window) {
        const pace = makePace(window, false);
        if (!pace)
            return null;
        const expected = pace.expectedUsedPercent;
        const used = clamp(window?.usedPercent ?? 0);
        const delta = Math.round(Math.abs(used - expected));
        return `${used >= expected ? '+' : '-'}${delta}%`;
    }

    _switcherMetricPercent(model, showUsed) {
        const window = model.usage ? (model.usage.primary ?? model.usage.secondary ?? model.usage.tertiary) : null;
        return ratePercent(window, showUsed);
    }

    _makePanelCritter(provider, primary, secondary, indicator, accent) {
        const meta = providerMeta(provider);
        const icon = new St.BoxLayout({
            vertical: true,
            style_class: `codexbar-panel-critter codexbar-icon-style-${meta.iconStyle}`,
            y_align: Clutter.ActorAlign.CENTER,
        });
        if (this._motionAmount !== 0)
            icon.set_translation(this._motionAmount / 2, 0, 0);
        icon.add_child(this._makePanelBar(primary, true, accent));
        icon.add_child(this._makePanelBar(secondary, false, accent));
        if (indicator && indicator !== 'none')
            icon.add_child(new St.Widget({style_class: `codexbar-status-overlay codexbar-status-${indicator}`}));
        return icon;
    }

    _makePanelBar(percent, top, accent) {
        const track = new St.Widget({
            style_class: `codexbar-panel-bar ${top ? 'codexbar-panel-bar-top' : 'codexbar-panel-bar-bottom'}`,
            layout_manager: new Clutter.FixedLayout(),
        });
        track.set_size(PANEL_BAR_WIDTH, PANEL_BAR_HEIGHT);
        const fill = new St.Widget({style_class: 'codexbar-panel-bar-fill'});
        fill.set_size(Math.round(PANEL_BAR_WIDTH * clamp(percent ?? 0) / 100), PANEL_BAR_HEIGHT);
        fill.set_style(styleAccent(accent));
        track.add_child(fill);
        if (top && this._blinkAmount > 0) {
            const blink = new St.Widget({style_class: 'codexbar-panel-blink'});
            blink.set_size(PANEL_BAR_WIDTH, Math.max(1, Math.round(PANEL_BAR_HEIGHT * this._blinkAmount)));
            blink.set_position(0, 0);
            track.add_child(blink);
        }
        return track;
    }

    _makeProviderBadge(model, small = false) {
        const badge = new St.Label({
            text: model.meta.badge,
            style_class: `codexbar-provider-badge ${small ? 'codexbar-provider-badge-small' : ''}`,
            y_align: Clutter.ActorAlign.CENTER,
        });
        badge.set_style(`background-color: ${model.progressColor}; color: white;`);
        return badge;
    }

    _rebuildMenu() {
        this.menu.removeAll();
        const active = this._activeModels();
        if (this._lastError && active.length === 0) {
            this.menu.addMenuItem(menuItemWithActor(this._makeBackendErrorOnly()));
            this._addActions(null);
            return;
        }
        if (active.length === 0) {
            this.menu.addMenuItem(menuItemWithActor(this._makePlaceholder('No provider data yet.')));
            this._addActions(null);
            return;
        }

        this._addSwitcher(active);
        if (this._settings.get_boolean('merged-menu-last-selected-was-overview')) {
            this._addOverview(active);
            this._addActions(this._selectedModel());
            return;
        }

        const model = this._selectedModel();
        this._addMenuCardSections(model);
        this._addFacts(model);
        this._addActions(model);
    }

    _makeBackendErrorOnly() {
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-card'});
        box.add_child(new St.Label({text: 'Backend error', style_class: 'codexbar-section-title'}));
        box.add_child(new St.Label({
            text: this._lastError,
            style_class: 'codexbar-error-body',
            x_expand: true,
        }));
        return box;
    }

    _makePlaceholder(text) {
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-card'});
        box.add_child(new St.Label({text, style_class: 'codexbar-placeholder'}));
        return box;
    }

    _addSwitcher(models) {
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-switcher'});
        const includesOverview = this._overviewProviders(models).length > 0;
        const segments = includesOverview
            ? [{kind: 'overview', title: 'Overview', model: null}, ...models.map(model => ({kind: 'provider', title: model.providerName, model}))]
            : models.map(model => ({kind: 'provider', title: model.providerName, model}));
        const rows = this._switcherRows(segments);
        for (const row of rows) {
            const rowBox = new St.BoxLayout({style_class: 'codexbar-switcher-row'});
            for (const segment of row)
                rowBox.add_child(this._makeSwitcherButton(segment));
            box.add_child(rowBox);
        }
        this.menu.addMenuItem(menuItemWithActor(box));
    }

    _switcherRows(segments) {
        if (segments.length <= 3)
            return [segments];
        const perRow = segments.length <= 6 ? 3 : 4;
        const rows = [];
        for (let idx = 0; idx < segments.length; idx += perRow)
            rows.push(segments.slice(idx, idx + perRow));
        return rows;
    }

    _makeSwitcherButton(segment) {
        const selected = segment.kind === 'overview'
            ? this._settings.get_boolean('merged-menu-last-selected-was-overview')
            : !this._settings.get_boolean('merged-menu-last-selected-was-overview') && segment.model.provider === this._selectedProvider;
        const button = new St.Button({
            style_class: `codexbar-switcher-button ${selected ? 'selected' : ''}`,
            x_expand: true,
            can_focus: true,
            reactive: true,
        });
        if (selected && segment.model)
            button.set_style(`background-color: ${segment.model.progressColor}; color: white;`);
        const content = new St.BoxLayout({vertical: true, x_expand: true});
        const line = new St.BoxLayout({
            style_class: 'codexbar-switcher-content',
            x_align: Clutter.ActorAlign.CENTER,
        });
        if (this._settings.get_boolean('switcher-shows-icons')) {
            const badge = segment.kind === 'overview'
                ? new St.Label({text: 'OV', style_class: 'codexbar-switcher-overview-badge'})
                : this._makeProviderBadge(segment.model, true);
            line.add_child(badge);
        }
        line.add_child(new St.Label({
            text: segment.title,
            style_class: 'codexbar-switcher-title',
            y_align: Clutter.ActorAlign.CENTER,
        }));
        content.add_child(line);
        if (segment.model) {
            const percent = this._switcherMetricPercent(segment.model, this._settings.get_boolean('usage-bars-show-used'));
            content.add_child(this._makeWeeklyIndicator(percent, segment.model.progressColor));
        }
        button.set_child(content);
        button.connect('clicked', () => {
            if (segment.kind === 'overview') {
                this._settings.set_boolean('merged-menu-last-selected-was-overview', true);
            } else {
                this._selectedProvider = segment.model.provider;
                this._settings.set_string('selected-menu-provider', segment.model.provider);
                this._settings.set_boolean('merged-menu-last-selected-was-overview', false);
            }
            this._rebuildPanel();
            this._rebuildMenu();
        });
        return button;
    }

    _makeWeeklyIndicator(percent, accent) {
        const track = new St.Widget({
            style_class: 'codexbar-weekly-track',
            layout_manager: new Clutter.FixedLayout(),
        });
        track.set_size(42, 3);
        const fill = new St.Widget({style_class: 'codexbar-weekly-fill'});
        fill.set_size(Math.round(42 * clamp(percent ?? 0) / 100), 3);
        fill.set_style(styleAccent(accent));
        track.add_child(fill);
        return track;
    }

    _overviewProviders(models) {
        const configured = this._settings.get_strv('merged-overview-selected-providers');
        const selected = configured.length > 0
            ? models.filter(model => configured.includes(model.provider))
            : models;
        return selected.slice(0, OVERVIEW_PROVIDER_LIMIT);
    }

    _addOverview(models) {
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-card'});
        box.add_child(new St.Label({text: 'Overview', style_class: 'codexbar-section-title'}));
        for (const model of this._overviewProviders(models)) {
            const row = new St.BoxLayout({style_class: 'codexbar-overview-row', x_expand: true});
            row.add_child(this._makeProviderBadge(model, true));
            row.add_child(new St.Label({
                text: model.providerName,
                style_class: 'codexbar-overview-name',
                x_expand: true,
            }));
            const percent = model.iconWindow ? ratePercent(model.iconWindow, this._settings.get_boolean('usage-bars-show-used')) : null;
            row.add_child(new St.Label({
                text: percent === null ? 'No data' : formatPercent(percent),
                style_class: 'codexbar-overview-percent',
            }));
            box.add_child(row);
            box.add_child(this._makeProgressBar(percent, model.progressColor, null, true));
        }
        this.menu.addMenuItem(menuItemWithActor(box));
    }

    _addMenuCardSections(model) {
        this.menu.addMenuItem(menuItemWithActor(this._makeHeader(model)));
        if (model.error)
            this.menu.addMenuItem(menuItemWithActor(this._makeErrorBanner(model.error)));
        if (model.metrics.length > 0 || model.placeholder || model.usageNotes.length > 0)
            this.menu.addMenuItem(menuItemWithActor(this._makeUsageSection(model)));
        if (model.creditsText || model.providerCost || model.tokenUsage)
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        if (model.creditsText)
            this.menu.addMenuItem(menuItemWithActor(this._makeCreditsSection(model)));
        if (model.providerCost)
            this.menu.addMenuItem(menuItemWithActor(this._makeExtraUsageSection(model)));
        if (model.tokenUsage)
            this.menu.addMenuItem(menuItemWithActor(this._makeCostSection(model)));
    }

    _makeHeader(model) {
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-card codexbar-header'});
        const top = new St.BoxLayout({x_expand: true});
        top.add_child(new St.Label({
            text: model.providerName,
            style_class: 'codexbar-header-title',
            x_expand: true,
        }));
        top.add_child(new St.Label({
            text: model.email,
            style_class: 'codexbar-header-email',
        }));
        box.add_child(top);

        const bottom = new St.BoxLayout({x_expand: true});
        bottom.add_child(new St.Label({
            text: model.subtitleText,
            style_class: `codexbar-header-subtitle codexbar-subtitle-${model.subtitleStyle}`,
            x_expand: true,
        }));
        if (model.planText) {
            bottom.add_child(new St.Label({
                text: model.planText,
                style_class: 'codexbar-plan-badge',
            }));
        }
        const hero = this._displayText(model, this._settings.get_boolean('usage-bars-show-used'));
        if (hero) {
            bottom.add_child(new St.Label({
                text: hero,
                style_class: 'codexbar-hero-value',
            }));
        }
        box.add_child(bottom);
        return box;
    }

    _makeErrorBanner(text) {
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-card codexbar-error-banner'});
        const row = new St.BoxLayout({x_expand: true});
        row.add_child(new St.Label({text: 'Backend error', style_class: 'codexbar-section-title', x_expand: true}));
        const copy = new St.Button({style_class: 'codexbar-copy-button', label: 'Copy'});
        copy.connect('clicked', () => this._copyText(text));
        row.add_child(copy);
        box.add_child(row);
        box.add_child(new St.Label({text, style_class: 'codexbar-error-body'}));
        return box;
    }

    _makeUsageSection(model) {
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-card codexbar-usage'});
        if (model.placeholder) {
            box.add_child(new St.Label({text: model.placeholder, style_class: 'codexbar-placeholder'}));
            return box;
        }
        for (const note of model.usageNotes.filter(Boolean))
            box.add_child(new St.Label({text: note, style_class: 'codexbar-note'}));
        for (const metric of model.metrics)
            box.add_child(this._makeMetricRow(metric, model.progressColor));
        return box;
    }

    _makeMetricRow(metric, accent) {
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-metric'});
        box.add_child(new St.Label({text: metric.title, style_class: 'codexbar-metric-title'}));
        if (metric.statusText) {
            box.add_child(new St.Label({text: metric.statusText, style_class: 'codexbar-secondary'}));
            return box;
        }
        box.add_child(this._makeProgressBar(metric.percent, accent, metric));
        const row = new St.BoxLayout({x_expand: true});
        row.add_child(new St.Label({
            text: `${formatPercent(metric.percent)} ${metric.percentStyle}`,
            style_class: 'codexbar-metric-percent',
            x_expand: true,
        }));
        if (metric.resetText)
            row.add_child(new St.Label({text: metric.resetText, style_class: 'codexbar-secondary'}));
        box.add_child(row);
        if (metric.detailLeftText || metric.detailRightText) {
            const detail = new St.BoxLayout({x_expand: true});
            if (metric.detailLeftText)
                detail.add_child(new St.Label({text: metric.detailLeftText, style_class: 'codexbar-detail-left', x_expand: true}));
            if (metric.detailRightText)
                detail.add_child(new St.Label({text: metric.detailRightText, style_class: 'codexbar-secondary'}));
            box.add_child(detail);
        }
        if (metric.detailText)
            box.add_child(new St.Label({text: metric.detailText, style_class: 'codexbar-secondary'}));
        return box;
    }

    _makeProgressBar(percent, accent, metric = null, compact = false) {
        const width = compact ? 278 : MENU_PROGRESS_WIDTH;
        const track = new St.Widget({
            style_class: 'codexbar-progress-track',
            layout_manager: new Clutter.FixedLayout(),
            x_expand: true,
        });
        track.set_size(width, MENU_PROGRESS_HEIGHT);
        const fill = new St.Widget({style_class: 'codexbar-progress-fill'});
        fill.set_size(Math.round(width * clamp(percent ?? 0) / 100), MENU_PROGRESS_HEIGHT);
        fill.set_style(styleAccent(accent));
        track.add_child(fill);
        if (metric?.pacePercent !== null && metric?.pacePercent !== undefined) {
            const tip = new St.Widget({
                style_class: `codexbar-pace-tip ${metric.paceOnTop ? 'on-top' : 'deficit'}`,
            });
            tip.set_size(2, MENU_PROGRESS_HEIGHT + 4);
            tip.set_position(Math.round(width * clamp(metric.pacePercent) / 100), -2);
            track.add_child(tip);
        }
        return track;
    }

    _makeCreditsSection(model) {
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-card'});
        box.add_child(new St.Label({text: 'Credits', style_class: 'codexbar-section-title'}));
        if (model.creditsRemaining !== null && model.creditsRemaining !== undefined) {
            const percent = clamp(Number(model.creditsRemaining) / 1000 * 100);
            box.add_child(this._makeProgressBar(percent, model.progressColor));
            const row = new St.BoxLayout({x_expand: true});
            row.add_child(new St.Label({text: model.creditsText, style_class: 'codexbar-metric-percent', x_expand: true}));
            row.add_child(new St.Label({text: '1,000 tokens', style_class: 'codexbar-secondary'}));
            box.add_child(row);
        } else {
            box.add_child(new St.Label({text: model.creditsText, style_class: 'codexbar-secondary'}));
        }
        if (model.creditsHintText)
            box.add_child(new St.Label({text: model.creditsHintText, style_class: 'codexbar-note'}));
        if (model.provider === 'codex') {
            const buy = new St.Button({label: 'Buy Credits...', style_class: 'codexbar-link-button'});
            buy.connect('clicked', () => launchURI('https://chatgpt.com/settings/usage'));
            box.add_child(buy);
        }
        return box;
    }

    _makeExtraUsageSection(model) {
        const section = model.providerCost;
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-card'});
        box.add_child(new St.Label({text: section.title, style_class: 'codexbar-section-title'}));
        box.add_child(this._makeProgressBar(section.percentUsed, model.progressColor));
        const row = new St.BoxLayout({x_expand: true});
        row.add_child(new St.Label({text: section.spendLine, style_class: 'codexbar-metric-percent', x_expand: true}));
        row.add_child(new St.Label({text: `${formatPercent(section.percentUsed)} used`, style_class: 'codexbar-secondary'}));
        box.add_child(row);
        return box;
    }

    _makeCostSection(model) {
        const token = model.tokenUsage;
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-card'});
        box.add_child(new St.Label({text: 'Cost', style_class: 'codexbar-section-title'}));
        if (token.sessionLine)
            box.add_child(new St.Label({text: token.sessionLine, style_class: 'codexbar-cost-line'}));
        if (token.monthLine)
            box.add_child(new St.Label({text: token.monthLine, style_class: 'codexbar-cost-line'}));
        if (token.hintLine)
            box.add_child(new St.Label({text: token.hintLine, style_class: 'codexbar-note'}));
        if (token.errorLine) {
            const row = new St.BoxLayout({x_expand: true});
            row.add_child(new St.Label({text: token.errorLine, style_class: 'codexbar-error-body', x_expand: true}));
            const copy = new St.Button({label: 'Copy', style_class: 'codexbar-copy-button'});
            copy.connect('clicked', () => this._copyText(token.errorCopyText ?? token.errorLine));
            row.add_child(copy);
            box.add_child(row);
        }
        return box;
    }

    _addFacts(model) {
        const box = new St.BoxLayout({vertical: true, style_class: 'codexbar-card codexbar-facts'});
        const rows = [
            ['State', model.error ? 'Error' : (model.usage ? 'Ready' : 'No data')],
            ['Source', model.source || 'auto'],
            ['Version', model.version || 'Unknown'],
            ['Updated', model.usage?.updatedAt ? relativeUpdatedText(model.usage.updatedAt) : 'Never'],
            ['Status', model.status?.description || model.status?.indicator || 'Unknown'],
            ['Account', model.email || model.account || 'None'],
            ['Plan', model.planText || 'Unknown'],
        ];
        for (const [label, value] of rows)
            box.add_child(this._factRow(label, value));
        this.menu.addMenuItem(menuItemWithActor(box));
    }

    _factRow(label, value) {
        const row = new St.BoxLayout({x_expand: true, style_class: 'codexbar-fact-row'});
        row.add_child(new St.Label({text: label, style_class: 'codexbar-fact-label'}));
        row.add_child(new St.Label({text: value, style_class: 'codexbar-fact-value', x_expand: true}));
        return row;
    }

    _addActions(model) {
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addAction('Refresh', () => this.refresh(true));
        if (model?.meta?.dashboardURL)
            this._addAction('Dashboard', () => launchURI(model.meta.dashboardURL));
        if (model?.meta?.statusURL)
            this._addAction('Status Page', () => launchURI(model.meta.statusURL));
        if (model)
            this._addAction('Add / Switch Account', () => this._runLogin(model.provider));
        if (model)
            this._addAction('Open Terminal', () => this._openTerminal(model.provider));
        this._addAction('Settings', () => this._openPreferences());
        this._addAction('About', () => Main.notify('CodexBar', 'May your tokens never run out—keep agent limits in view.'));
    }

    _addAction(label, callback) {
        const item = new PopupMenu.PopupMenuItem(label);
        item.connect('activate', callback);
        this.menu.addMenuItem(item);
    }

    _runLogin(provider) {
        const backend = this._resolveBackendPath();
        if (!backend) {
            Main.notify('CodexBar', 'codexbar CLI not found.');
            return;
        }
        try {
            Gio.Subprocess.new([backend, 'login', '--provider', provider], Gio.SubprocessFlags.NONE);
        } catch (error) {
            this._openTerminal(provider, `login --provider ${provider}`);
        }
    }

    _openTerminal(provider, command = `usage --source auto --provider ${provider} --format json --pretty`) {
        const backend = this._resolveBackendPath() ?? DEFAULT_BACKEND_PATH;
        const shellCommand = `${GLib.shell_quote(backend)} ${command}; echo; read -r -p "Press Enter to close..."`;
        const terminals = [
            ['gnome-terminal', '--', 'bash', '-lc', shellCommand],
            ['kgx', '--', 'bash', '-lc', shellCommand],
            ['xterm', '-e', `bash -lc ${GLib.shell_quote(shellCommand)}`],
        ];
        for (const argv of terminals) {
            if (!GLib.find_program_in_path(argv[0]))
                continue;
            try {
                Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
                return;
            } catch (_) {
                continue;
            }
        }
        Main.notify('CodexBar', 'No supported terminal launcher found.');
    }

    _openPreferences() {
        try {
            Gio.Subprocess.new(['gnome-extensions', 'prefs', UUID], Gio.SubprocessFlags.NONE);
        } catch (error) {
            Main.notify('CodexBar', `Could not open preferences: ${error.message}`);
        }
    }

    _copyText(text) {
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text || '');
    }
});

export default class CodexBarExtension extends Extension {
    enable() {
        this._indicator = new CodexBarIndicator(this);
        Main.panel.addToStatusArea(UUID, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
