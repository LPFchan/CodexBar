import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const DEFAULT_BACKEND_PATH = 'codexbar';
const DEFAULT_CONFIG_DIR = `${GLib.get_home_dir()}/.codexbar`;
const PANEL_METER_WIDTH = 32;
const MENU_METER_WIDTH = 244;

const PROVIDER_META = {
    codex: {label: 'Codex', badge: 'CX', accent: '#74c8ff'},
    claude: {label: 'Claude', badge: 'CL', accent: '#ffb467'},
    copilot: {label: 'Copilot', badge: 'CP', accent: '#7ee787'},
    cursor: {label: 'Cursor', badge: 'CU', accent: '#b88cff'},
    gemini: {label: 'Gemini', badge: 'GE', accent: '#8ab4f8'},
    openai: {label: 'OpenAI', badge: 'OA', accent: '#10a37f'},
    openrouter: {label: 'OpenRouter', badge: 'OR', accent: '#ff7ab6'},
    zai: {label: 'Z.ai', badge: 'ZA', accent: '#5eead4'},
    kilo: {label: 'Kilo', badge: 'KI', accent: '#facc15'},
    kiro: {label: 'Kiro', badge: 'KR', accent: '#fb7185'},
    codebuff: {label: 'Codebuff', badge: 'CB', accent: '#c084fc'},
    deepseek: {label: 'DeepSeek', badge: 'DS', accent: '#60a5fa'},
    windsurf: {label: 'Windsurf', badge: 'WS', accent: '#22d3ee'},
    mistral: {label: 'Mistral', badge: 'MI', accent: '#f97316'},
    perplexity: {label: 'Perplexity', badge: 'PX', accent: '#2dd4bf'},
};

const STATUS_META = {
    none: {label: 'Operational', color: '#7ee787'},
    minor: {label: 'Minor incident', color: '#f2cc60'},
    major: {label: 'Major incident', color: '#ff8e72'},
    critical: {label: 'Critical incident', color: '#ff6b81'},
    maintenance: {label: 'Maintenance', color: '#8ea6ff'},
    unknown: {label: 'Unknown', color: '#9aa4b2'},
};

const CodexBarGnomeIndicator = GObject.registerClass(
class CodexBarGnomeIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'CodexBar-Gnome');

        this._extension = extension;
        this._settings = extension.getSettings();
        this._settingsSignals = [];
        this._timeoutId = 0;
        this._refreshInFlight = false;
        this._lastPayload = null;
        this._lastError = null;
        this._providerButtons = new Map();
        this._providerSwitcherKey = '';

        this._buildPanel();
        this._buildMenu();
        this._connectSettings();
        this._scheduleRefresh();
        this.refresh();
    }

    destroy() {
        this._disconnectSettings();
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }
        super.destroy();
    }

    _buildPanel() {
        this._panelBox = new St.BoxLayout({
            style_class: 'panel-status-menu-box codexbar-panel-box',
        });

        this._panelMeters = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-panel-meters',
        });
        this._panelSessionMeter = this._createMeter('codexbar-panel-meter codexbar-panel-meter-primary');
        this._panelWeeklyMeter = this._createMeter('codexbar-panel-meter codexbar-panel-meter-secondary');
        this._panelMeters.add_child(this._panelSessionMeter.track);
        this._panelMeters.add_child(this._panelWeeklyMeter.track);

        this._panelBox.add_child(this._panelMeters);
        this.add_child(this._panelBox);
    }

    _buildMenu() {
        this._cardItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        this._cardItem.add_style_class_name('codexbar-card-item');

        this._card = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-card',
            x_expand: true,
        });
        this._cardItem.add_child(this._card);

        this._header = this._buildHeader();
        this._errorBanner = this._buildErrorBanner();
        this._usageSection = this._buildUsageSection();
        this._creditsSection = this._buildCreditsSection();
        this._factsSection = this._buildFactsSection();
        this._actionsSection = this._buildActionsSection();

        this._card.add_child(this._header.box);
        this._card.add_child(this._errorBanner.box);
        this._card.add_child(this._usageSection.box);
        this._card.add_child(this._creditsSection.box);
        this._card.add_child(this._factsSection.box);
        this._card.add_child(this._actionsSection.box);

        this.menu.addMenuItem(this._cardItem);
    }

    _buildHeader() {
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-card-header',
        });

        const topRow = new St.BoxLayout({
            style_class: 'codexbar-card-header-top',
        });
        const identityColumn = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'codexbar-card-identity-column',
        });
        const titleRow = new St.BoxLayout({
            style_class: 'codexbar-card-title-row',
        });

        const chip = new St.BoxLayout({
            style_class: 'codexbar-provider-chip',
        });
        const chipLabel = new St.Label({
            text: 'CX',
            style_class: 'codexbar-provider-chip-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        chip.add_child(chipLabel);
        const providerName = new St.Label({
            text: 'Codex',
            style_class: 'codexbar-provider-name',
        });
        titleRow.add_child(chip);
        titleRow.add_child(providerName);

        const identity = new St.Label({
            text: 'Waiting for provider data…',
            style_class: 'codexbar-card-identity',
        });
        const subtitle = new St.Label({
            text: 'Backend is starting',
            style_class: 'codexbar-card-subtitle',
        });

        identityColumn.add_child(titleRow);
        identityColumn.add_child(identity);
        identityColumn.add_child(subtitle);

        const heroValue = new St.Label({
            text: '--%',
            style_class: 'codexbar-card-hero',
            x_align: Clutter.ActorAlign.END,
        });

        topRow.add_child(identityColumn);
        topRow.add_child(heroValue);
        box.add_child(topRow);

        return {
            box,
            chip,
            chipLabel,
            providerName,
            identity,
            subtitle,
            heroValue,
        };
    }

    _buildErrorBanner() {
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-error-banner',
        });
        const title = new St.Label({
            text: 'Backend error',
            style_class: 'codexbar-error-title',
        });
        const body = new St.Label({
            text: '',
            style_class: 'codexbar-error-body',
        });
        box.add_child(title);
        box.add_child(body);
        box.visible = false;
        return {box, body};
    }

    _buildUsageSection() {
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-section codexbar-usage-section',
        });
        const title = new St.Label({
            text: 'Usage',
            style_class: 'codexbar-section-title',
        });
        const surface = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-section-surface codexbar-usage-surface',
        });
        box.add_child(title);

        const session = this._createMetricRow('Session');
        const weekly = this._createMetricRow('Weekly');
        const tertiary = this._createMetricRow('Model cap');

        surface.add_child(session.item);
        surface.add_child(weekly.item);
        surface.add_child(tertiary.item);
        box.add_child(surface);

        return {box, surface, session, weekly, tertiary};
    }

    _buildCreditsSection() {
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-credits-section',
        });
        const surface = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-section-surface codexbar-credits-surface',
        });

        const titleRow = new St.BoxLayout({
            style_class: 'codexbar-credits-header',
        });
        const title = new St.Label({
            text: 'Credits',
            style_class: 'codexbar-section-title',
        });
        const value = new St.Label({
            text: '--',
            style_class: 'codexbar-credits-value',
        });
        titleRow.add_child(title);
        titleRow.add_child(this._spacer());
        titleRow.add_child(value);

        const hint = new St.Label({
            text: 'Current balance',
            style_class: 'codexbar-credits-hint',
        });

        surface.add_child(titleRow);
        surface.add_child(hint);
        box.add_child(surface);
        box.visible = false;

        return {box, surface, value, hint};
    }

    _buildFactsSection() {
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-section codexbar-facts-section',
        });
        const title = new St.Label({
            text: 'Details',
            style_class: 'codexbar-section-title',
        });
        const surface = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-section-surface codexbar-facts-surface',
        });

        const plan = this._createFactRow('Plan');
        const source = this._createFactRow('Source');
        const status = this._createFactRow('Status');
        const updated = this._createFactRow('Updated');

        surface.add_child(plan.item);
        surface.add_child(source.item);
        surface.add_child(status.item);
        surface.add_child(updated.item);
        box.add_child(title);
        box.add_child(surface);

        return {box, surface, plan, source, status, updated};
    }

    _buildActionsSection() {
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-actions-section',
            x_expand: true,
        });

        const switcher = new St.BoxLayout({
            style_class: 'codexbar-switcher-row',
            x_expand: true,
        });

        const tools = new St.BoxLayout({
            style_class: 'codexbar-tools-row',
            x_expand: true,
        });
        this._refreshButton = this._createActionButton('Refresh', () => this.refresh(true), 'utility');
        this._prefsButton = this._createActionButton('Prefs', () => {
            this._spawnDetached(['gnome-extensions', 'prefs', this._extension.uuid]);
        }, 'utility');
        this._configButton = this._createActionButton('Config', () => {
            const path = this._lastPayload?.config_path ?? DEFAULT_CONFIG_DIR;
            const target = path.endsWith('.json') ? GLib.path_get_dirname(path) : path;
            this._spawnDetached(['xdg-open', target]);
        }, 'utility');
        tools.add_child(this._refreshButton);
        tools.add_child(this._prefsButton);
        tools.add_child(this._configButton);

        box.add_child(this._createDivider('codexbar-inline-divider codexbar-actions-divider'));
        box.add_child(switcher);
        box.add_child(tools);
        return {box, switcher};
    }

    _createMetricRow(titleText) {
        const item = new St.BoxLayout({
            vertical: true,
            style_class: 'codexbar-metric-row',
        });

        const topRow = new St.BoxLayout({
            style_class: 'codexbar-metric-top',
        });
        const title = new St.Label({
            text: titleText,
            style_class: 'codexbar-metric-title',
        });
        const percent = new St.Label({
            text: '--',
            style_class: 'codexbar-metric-percent',
        });
        topRow.add_child(title);
        topRow.add_child(this._spacer());
        topRow.add_child(percent);

        const meter = this._createMeter('codexbar-progress-track');
        const detail = new St.Label({
            text: 'Waiting for data…',
            style_class: 'codexbar-metric-detail',
        });

        item.add_child(topRow);
        item.add_child(meter.track);
        item.add_child(detail);

        return {item, percent, detail, meter};
    }

    _createFactRow(labelText) {
        const item = new St.BoxLayout({
            style_class: 'codexbar-fact-row',
        });
        const label = new St.Label({
            text: labelText,
            style_class: 'codexbar-fact-label',
        });
        const value = new St.Label({
            text: '--',
            style_class: 'codexbar-fact-value',
            x_align: Clutter.ActorAlign.END,
        });
        item.add_child(label);
        item.add_child(this._spacer());
        item.add_child(value);
        return {item, value};
    }

    _createActionButton(text, handler, variant = 'switcher', activeTheme = null) {
        const button = new St.Button({
            label: text,
            style_class: `codexbar-action-button codexbar-action-button-${variant}`,
            x_expand: true,
            can_focus: true,
            reactive: true,
            track_hover: true,
        });
        button._codexbarActionTheme = activeTheme;
        button.connect('clicked', handler);
        return button;
    }

    _createMeter(trackClass) {
        const track = new St.Bin({
            style_class: trackClass,
            x_expand: true,
        });
        const fill = new St.Widget({
            style_class: 'codexbar-progress-fill',
            x_expand: false,
            y_expand: true,
        });
        track.set_child(fill);
        return {track, fill};
    }

    _createDivider(extraClass = '') {
        const divider = new St.Widget({
            style_class: `codexbar-divider ${extraClass}`.trim(),
            x_expand: true,
        });
        return divider;
    }

    _spacer() {
        return new St.Widget({x_expand: true});
    }

    _setText(actor, text) {
        if (actor.text !== text)
            actor.text = text;
    }

    _setVisible(actor, visible) {
        if (actor.visible !== visible)
            actor.visible = visible;
    }

    _setWidth(actor, width) {
        if (actor._codexbarWidth === width)
            return;
        actor._codexbarWidth = width;
        actor.set_width(width);
    }

    _setOpacity(actor, opacity) {
        if (actor.opacity !== opacity)
            actor.opacity = opacity;
    }

    _setVariantClass(actor, slot, className) {
        const property = `_codexbarVariantClass_${slot}`;
        const previous = actor[property];
        if (previous === className)
            return;

        if (previous)
            actor.remove_style_class_name(previous);
        if (className)
            actor.add_style_class_name(className);

        actor[property] = className;
    }

    _providerMeta(provider) {
        if (PROVIDER_META[provider])
            return PROVIDER_META[provider];

        const normalized = provider || 'unknown';
        const badge = normalized.slice(0, 2).toUpperCase().padEnd(2, '?');
        const label = normalized
            .split(/[\s_-]+/)
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || 'Unknown';
        return {
            label,
            badge,
            accent: this._deterministicProviderColor(normalized),
        };
    }

    _deterministicProviderColor(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i++)
            hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
        return `hsl(${hash % 360}, 72%, 64%)`;
    }

    _themeVariant(provider, isError) {
        if (isError)
            return 'error';
        return provider ?? 'unknown';
    }

    _connectSettings() {
        const reloadKeys = [
            'backend-path',
            'default-provider',
            'refresh-interval',
            'show-percentage',
            'keep-last-good-value',
        ];

        for (const key of reloadKeys) {
            const id = this._settings.connect(`changed::${key}`, () => {
                if (key === 'refresh-interval')
                    this._scheduleRefresh();

                this._render();
                if (key === 'backend-path')
                    this.refresh(true);
            });
            this._settingsSignals.push(id);
        }
    }

    _disconnectSettings() {
        for (const id of this._settingsSignals)
            this._settings.disconnect(id);
        this._settingsSignals = [];
    }

    _scheduleRefresh() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }

        const interval = Math.max(15, this._settings.get_uint('refresh-interval'));
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            this.refresh();
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
        const process = Gio.Subprocess.new(
            [backendPath, 'usage', '--format', 'json', '--source', 'auto', '--provider', 'all'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        process.communicate_utf8_async(null, null, (_process, result) => {
            try {
                const [, stdout, stderr] = process.communicate_utf8_finish(result);
                this._refreshInFlight = false;

                if (stdout?.trim()) {
                    this._lastPayload = this._translateCliPayload(JSON.parse(stdout));
                    this._lastError = null;
                    this._render();
                    return;
                }

                if (!process.get_successful()) {
                    const message = stderr?.trim() || 'Backend exited with a non-zero status.';
                    this._handleRefreshError(message);
                    return;
                }

                this._handleRefreshError('Backend returned no JSON output.');
            } catch (error) {
                this._refreshInFlight = false;
                this._handleRefreshError(error instanceof Error ? error.message : `${error}`);
            }
        });
    }

    _handleRefreshError(message) {
        this._lastError = message;
        if (!this._settings.get_boolean('keep-last-good-value'))
            this._lastPayload = null;
        this._render();
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

    _translateCliPayload(payload) {
        const entries = Array.isArray(payload) ? payload : [];
        const updatedAt = GLib.DateTime.new_now_local().to_unix();
        return {
            config_path: DEFAULT_CONFIG_DIR,
            updated_at_epoch_seconds: updatedAt,
            snapshots: entries.map(entry => this._translateProviderPayload(entry, updatedAt)),
        };
    }

    _translateProviderPayload(entry, fallbackUpdatedAt) {
        const usage = entry?.usage ?? null;
        const identity = usage?.identity ?? {};
        const error = this._errorMessage(entry?.error);
        return {
            provider: entry?.provider ?? 'unknown',
            account: entry?.account ?? null,
            version: entry?.version ?? null,
            source: entry?.source ?? null,
            state: error ? 'error' : 'ready',
            error,
            indicator: entry?.status?.indicator ?? 'unknown',
            status: entry?.status ?? null,
            usage: usage ? {
                primary: this._translateWindow(usage.primary),
                secondary: this._translateWindow(usage.secondary),
                tertiary: this._translateWindow(usage.tertiary),
                updated_at_epoch_seconds: this._epochSeconds(usage.updatedAt) ?? fallbackUpdatedAt,
            } : null,
            credits: entry?.credits ?? null,
            identity: {
                account_email: identity.accountEmail ?? null,
                account_organization: identity.accountOrganization ?? null,
                login_method: identity.loginMethod ?? null,
            },
        };
    }

    _translateWindow(window) {
        if (!window)
            return null;

        const usedPercent = this._numberOrNull(window.usedPercent ?? window.used_percent) ?? 0;
        const resetISO = window.resetsAt ?? window.reset_at_iso8601 ?? null;
        return {
            used_percent: usedPercent,
            remaining_percent: Math.max(0, Math.min(100, 100 - usedPercent)),
            reset_at_epoch_seconds: this._epochSeconds(resetISO),
            reset_at_iso8601: resetISO,
            reset_description: window.resetDescription ?? window.reset_description ?? null,
            window_minutes: window.windowMinutes ?? window.window_minutes ?? null,
        };
    }

    _errorMessage(error) {
        if (!error)
            return null;
        if (typeof error === 'string')
            return error;
        return error.message ?? `${error}`;
    }

    _epochSeconds(value) {
        if (!value)
            return null;
        if (typeof value === 'number')
            return value;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
    }

    _numberOrNull(value) {
        if (typeof value === 'number')
            return value;
        if (typeof value === 'string' && value.trim().length > 0) {
            const parsed = Number(value);
            return Number.isNaN(parsed) ? null : parsed;
        }
        return null;
    }

    _selectedProvider(snapshots = this._lastPayload?.snapshots ?? []) {
        const selected = this._settings.get_string('default-provider').trim().toLowerCase();
        if (selected && snapshots.some(snapshot => snapshot.provider === selected))
            return selected;
        return snapshots[0]?.provider ?? (selected || 'codex');
    }

    _currentSnapshot() {
        const snapshots = this._lastPayload?.snapshots ?? [];
        if (snapshots.length === 0)
            return null;

        const selected = this._selectedProvider(snapshots);
        return snapshots.find(snapshot => snapshot.provider === selected) ?? snapshots[0];
    }

    _render() {
        const snapshots = this._lastPayload?.snapshots ?? [];
        const snapshot = this._currentSnapshot();
        const effectiveProvider = snapshot?.provider ?? this._selectedProvider(snapshots);
        const meta = this._providerMeta(effectiveProvider);
        const statusMeta = this._statusMeta(snapshot);
        const primary = snapshot?.usage?.primary ?? null;
        const secondary = snapshot?.usage?.secondary ?? null;
        const tertiary = snapshot?.usage?.tertiary ?? null;
        const error = this._resolvedError(snapshot);
        const isError = Boolean(error);
        const themeVariant = this._themeVariant(effectiveProvider, isError);

        this._applyProviderTheme(themeVariant);

        this._setText(this._header.chipLabel, meta.badge);
        this._setText(this._header.providerName, meta.label);
        this._setText(this._header.heroValue, primary ? `${Math.round(primary.remaining_percent)}% left` : 'Offline');
        this._setText(this._header.identity, this._identityText(snapshot));
        this._setText(this._header.subtitle, this._subtitleText(snapshot, error));

        this._syncMeter(this._panelSessionMeter, primary?.remaining_percent, PANEL_METER_WIDTH, themeVariant);
        this._syncMeter(this._panelWeeklyMeter, secondary?.remaining_percent, PANEL_METER_WIDTH, themeVariant, true);

        this._syncMetricRow(this._usageSection.session, primary, themeVariant);
        this._syncMetricRow(this._usageSection.weekly, secondary, themeVariant);
        this._syncMetricRow(this._usageSection.tertiary, tertiary, themeVariant);
        this._setVisible(this._usageSection.box, Boolean(primary || secondary || tertiary));

        const hasCredits = snapshot?.credits?.remaining === 0 || Boolean(snapshot?.credits?.remaining);
        this._setVisible(this._creditsSection.box, Boolean(hasCredits));
        if (hasCredits) {
            this._setText(this._creditsSection.value, `${snapshot.credits.remaining.toFixed(2)} remaining`);
            this._setText(this._creditsSection.hint, snapshot?.source === 'oauth'
                ? 'Current Codex balance from OAuth usage'
                : 'Current credit balance');
        }

        this._setText(this._factsSection.plan.value, this._displayLoginMethod(snapshot?.identity?.login_method) ?? 'Unavailable');
        this._setText(this._factsSection.source.value, this._displayLabel(snapshot?.source) ?? 'Unavailable');
        this._setText(this._factsSection.status.value, statusMeta.label);
        this._setVariantClass(this._factsSection.status.value, 'status', `codexbar-status-${statusMeta.indicator}`);
        this._setText(this._factsSection.updated.value, this._updatedSummary(snapshot));

        this._setVisible(this._errorBanner.box, isError);
        this._setText(this._errorBanner.body, error ?? '');

        this._setOpacity(this._panelBox, isError ? 199 : 255);
        this._syncProviderSwitcher(snapshots, effectiveProvider);
    }

    _syncProviderSwitcher(snapshots, effectiveProvider) {
        const providers = snapshots
            .map(snapshot => snapshot.provider)
            .filter((provider, index, all) => provider && all.indexOf(provider) === index);
        this._setVisible(this._actionsSection.switcher, providers.length > 1);

        const key = providers.join('|');
        if (key !== this._providerSwitcherKey) {
            for (const child of this._actionsSection.switcher.get_children())
                child.destroy();
            this._providerButtons = new Map();
            for (const provider of providers) {
                const meta = this._providerMeta(provider);
                const button = this._createActionButton(meta.label, () => {
                    this._settings.set_string('default-provider', provider);
                }, 'switcher', provider);
                this._actionsSection.switcher.add_child(button);
                this._providerButtons.set(provider, button);
            }
            this._providerSwitcherKey = key;
        }

        for (const [provider, button] of this._providerButtons)
            this._setButtonActive(button, provider === effectiveProvider);
    }

    _syncMetricRow(metric, window, themeVariant) {
        const visible = Boolean(window);
        this._setVisible(metric.item, visible);
        if (!visible)
            return;

        const remaining = Math.round(window.remaining_percent);
        this._setText(metric.percent, `${remaining}% left`);
        this._setText(metric.detail, this._windowDetail(window));
        this._setVariantClass(metric.item, 'metric', `codexbar-metric-row-theme-${themeVariant}`);
        this._syncMeter(metric.meter, window.remaining_percent, MENU_METER_WIDTH, themeVariant);
    }

    _syncMeter(meter, remainingPercent, width, themeVariant, thin = false) {
        const normalized = typeof remainingPercent === 'number'
            ? Math.max(0, Math.min(100, remainingPercent))
            : 0;
        const fillWidth = normalized > 0 ? Math.max(2, Math.round(width * normalized / 100)) : 0;
        const trackVariant = themeVariant === 'error' ? 'error' : 'ok';

        this._setWidth(meter.fill, fillWidth);
        this._setVariantClass(meter.track, 'track', `codexbar-progress-track-${trackVariant}`);
        this._setVariantClass(meter.fill, 'fill', `codexbar-progress-fill-${themeVariant}`);

        if (thin)
            meter.track.add_style_class_name('codexbar-progress-track-thin');
        else
            meter.track.remove_style_class_name('codexbar-progress-track-thin');
    }

    _applyProviderTheme(themeVariant) {
        this._setVariantClass(this._card, 'card', `codexbar-card-theme-${themeVariant}`);
        this._setVariantClass(this._header.chip, 'chip', `codexbar-provider-chip-theme-${themeVariant}`);
        this._setVariantClass(this._header.heroValue, 'hero', `codexbar-hero-theme-${themeVariant}`);
        this._setVariantClass(this._creditsSection.value, 'credits', `codexbar-credits-theme-${themeVariant}`);
    }

    _setButtonActive(button, active) {
        if (active)
            button.add_style_class_name('codexbar-action-button-active');
        else
            button.remove_style_class_name('codexbar-action-button-active');

        this._setVariantClass(
            button,
            'action-theme',
            active && button._codexbarActionTheme
                ? `codexbar-action-button-active-${button._codexbarActionTheme}`
                : null
        );
    }

    _statusMeta(snapshot) {
        const indicator = snapshot?.indicator ?? snapshot?.status?.indicator ?? 'unknown';
        return {
            indicator,
            ...(STATUS_META[indicator] ?? STATUS_META.unknown),
        };
    }

    _resolvedError(snapshot) {
        return this._lastError || snapshot?.error || null;
    }

    _identityText(snapshot) {
        const email = snapshot?.identity?.account_email?.trim();
        if (email)
            return email;

        const source = this._displayLabel(snapshot?.source);
        if (source)
            return `${source} source connected`;

        return 'Waiting for provider data…';
    }

    _subtitleText(snapshot, error) {
        if (error)
            return 'Showing degraded state until refresh succeeds';

        const parts = [];
        const loginMethod = this._displayLoginMethod(snapshot?.identity?.login_method);
        if (loginMethod)
            parts.push(loginMethod);
        const statusMeta = this._statusMeta(snapshot);
        if (statusMeta.indicator !== 'unknown')
            parts.push(statusMeta.label);
        if (parts.length === 0)
            parts.push('Backend connected');
        return parts.join(' · ');
    }

    _displayLoginMethod(rawValue) {
        return this._displayLabel(rawValue);
    }

    _displayLabel(rawValue) {
        if (!rawValue)
            return null;

        return rawValue
            .split(/[\s_-]+/)
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    _windowDetail(window) {
        const parts = [];
        const resetText = this._formatReset(window);
        if (resetText)
            parts.push(`Resets ${resetText}`);
        if (window?.window_minutes)
            parts.push(this._windowDuration(window.window_minutes));
        return parts.join(' · ') || 'Usage window';
    }

    _windowDuration(windowMinutes) {
        if (windowMinutes >= 10080)
            return '7d window';
        if (windowMinutes >= 1440)
            return `${Math.round(windowMinutes / 1440)}d window`;
        if (windowMinutes >= 60)
            return `${Math.round(windowMinutes / 60)}h window`;
        return `${windowMinutes}m window`;
    }

    _updatedSummary(snapshot) {
        const updatedAt = snapshot?.usage?.updated_at_epoch_seconds ?? this._lastPayload?.updated_at_epoch_seconds;
        if (!updatedAt)
            return 'Unavailable';

        const delta = Math.max(0, Math.floor(GLib.DateTime.new_now_local().to_unix() - updatedAt));
        if (delta < 10)
            return 'Just now';
        if (delta < 60)
            return `${delta}s ago`;
        if (delta < 3600)
            return `${Math.floor(delta / 60)}m ago`;
        return `${Math.floor(delta / 3600)}h ago`;
    }

    _formatReset(window) {
        if (window?.reset_description)
            return window.reset_description;

        let dateTime = null;
        if (window?.reset_at_epoch_seconds) {
            dateTime = GLib.DateTime.new_from_unix_local(window.reset_at_epoch_seconds);
        } else if (window?.reset_at_iso8601) {
            dateTime = GLib.DateTime.new_from_iso8601(window.reset_at_iso8601, null);
        }

        return dateTime ? dateTime.format('%b %e %H:%M') : null;
    }

    _spawnDetached(argv) {
        try {
            Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
        } catch (error) {
            this._handleRefreshError(error instanceof Error ? error.message : `${error}`);
        }
    }
});

export default class CodexBarGnomeExtension extends Extension {
    enable() {
        this._indicator = new CodexBarGnomeIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
