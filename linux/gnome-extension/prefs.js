import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const UUID = 'linuxcodexbar';
const AUTOSTART_FILE = GLib.build_filenamev([GLib.get_user_config_dir(), 'autostart', 'linuxcodexbar.desktop']);
const PROVIDERS = [
    ['codex', 'Codex', true],
    ['claude', 'Claude', false],
    ['cursor', 'Cursor', false],
    ['opencode', 'OpenCode', false],
    ['opencodego', 'OpenCode Go', false],
    ['alibaba', 'Alibaba', false],
    ['factory', 'Droid', false],
    ['gemini', 'Gemini', false],
    ['antigravity', 'Antigravity', false],
    ['copilot', 'Copilot', false],
    ['zai', 'z.ai', false],
    ['minimax', 'MiniMax', false],
    ['kimi', 'Kimi', false],
    ['kilo', 'Kilo', false],
    ['kiro', 'Kiro', false],
    ['vertexai', 'Vertex AI', false],
    ['augment', 'Augment', false],
    ['jetbrains', 'JetBrains AI', false],
    ['kimik2', 'Kimi K2', false],
    ['amp', 'Amp', false],
    ['ollama', 'Ollama', false],
    ['synthetic', 'Synthetic', false],
    ['warp', 'Warp', false],
    ['openrouter', 'OpenRouter', false],
    ['windsurf', 'Windsurf', false],
    ['perplexity', 'Perplexity', false],
    ['abacus', 'Abacus AI', false],
    ['mistral', 'Mistral', false],
    ['deepseek', 'DeepSeek', false],
    ['codebuff', 'Codebuff', false],
];

const UPSTREAM_DEFAULTS = {
    refreshFrequency: 'fiveMinutes',
    launchAtLogin: false,
    debugMenuEnabled: false,
    debugFileLoggingEnabled: false,
    debugLogLevel: 'verbose',
    debugLoadingPattern: '',
    debugKeepCLISessionsAlive: false,
    statusChecksEnabled: true,
    sessionQuotaNotificationsEnabled: true,
    usageBarsShowUsed: false,
    resetTimesShowAbsolute: false,
    menuBarShowsBrandIconWithPercent: false,
    menuBarDisplayMode: 'percent',
    historicalTrackingEnabled: false,
    showAllTokenAccountsInMenu: false,
    menuBarMetricPreferences: {},
    costUsageEnabled: false,
    hidePersonalInfo: false,
    randomBlinkEnabled: false,
    confettiOnWeeklyLimitResetsEnabled: false,
    menuBarShowsHighestUsage: false,
    claudeWebExtrasEnabled: false,
    claudePeakHoursEnabled: true,
    showOptionalCreditsAndExtraUsage: true,
    openAIWebAccessEnabled: false,
    openAIWebBatterySaverEnabled: false,
    providerStorageFootprintsEnabled: false,
    jetbrainsIDEBasePath: '',
    mergeIcons: true,
    switcherShowsIcons: true,
    mergedMenuLastSelectedWasOverview: false,
    mergedOverviewSelectedProviders: [],
    selectedMenuProvider: 'codex',
    providerDetectionCompleted: false,
};

const REFRESH_OPTIONS = [
    ['manual', 'Manual'],
    ['oneMinute', '1 min'],
    ['twoMinutes', '2 min'],
    ['fiveMinutes', '5 min'],
    ['fifteenMinutes', '15 min'],
    ['thirtyMinutes', '30 min'],
];

const DISPLAY_MODE_OPTIONS = [
    ['percent', 'Percent'],
    ['pace', 'Pace'],
    ['both', 'Both'],
];

const METRIC_OPTIONS = [
    ['automatic', 'Automatic'],
    ['primary', 'Primary'],
    ['secondary', 'Secondary'],
    ['tertiary', 'Tertiary'],
    ['extraUsage', 'Extra usage'],
    ['average', 'Average'],
];

const SOURCE_OPTIONS = [
    ['auto', 'Auto'],
    ['web', 'Web'],
    ['oauth', 'OAuth'],
    ['cli', 'CLI'],
    ['api', 'API'],
];

const LOG_LEVEL_OPTIONS = [
    ['trace', 'Trace'],
    ['verbose', 'Verbose'],
    ['debug', 'Debug'],
    ['info', 'Info'],
    ['warning', 'Warning'],
    ['error', 'Error'],
    ['critical', 'Critical'],
];

const LOADING_PATTERN_OPTIONS = [
    ['', 'Random'],
    ['knightRider', 'Knight Rider'],
    ['cylon', 'Cylon'],
    ['outsideIn', 'Outside-In'],
    ['race', 'Race'],
    ['pulse', 'Pulse'],
    ['unbraid', 'Unbraid'],
];

function stringList(labels) {
    const list = new Gtk.StringList();
    for (const label of labels)
        list.append(label);
    return list;
}

function optionIndex(options, value) {
    const index = options.findIndex(([key]) => key === value);
    return index >= 0 ? index : 0;
}

function strvSet(settings, key) {
    return new Set(settings.get_strv(key));
}

function setStrvSet(settings, key, set) {
    settings.set_strv(key, Array.from(set));
}

function dictValue(settings, key) {
    return settings.get_value(key).deep_unpack();
}

function setDictValue(settings, key, object) {
    const variant = new GLib.Variant('a{ss}', object);
    settings.set_value(key, variant);
}

function addSwitch(group, settings, key, title, subtitle = null, onChanged = null) {
    const row = new Adw.ActionRow({title, subtitle: subtitle || ''});
    const toggle = new Gtk.Switch({
        active: settings.get_boolean(key),
        valign: Gtk.Align.CENTER,
    });
    row.add_suffix(toggle);
    row.activatable_widget = toggle;
    toggle.connect('notify::active', () => {
        settings.set_boolean(key, toggle.active);
        if (onChanged)
            onChanged(toggle.active);
    });
    settings.connect(`changed::${key}`, () => {
        if (toggle.active !== settings.get_boolean(key))
            toggle.active = settings.get_boolean(key);
    });
    group.add(row);
    return row;
}

function addCombo(group, settings, key, title, subtitle, options) {
    const row = new Adw.ComboRow({
        title,
        subtitle: subtitle || '',
        model: stringList(options.map(([, label]) => label)),
        selected: optionIndex(options, settings.get_string(key)),
    });
    row.connect('notify::selected', () => {
        const selected = options[row.selected]?.[0] ?? options[0][0];
        settings.set_string(key, selected);
    });
    settings.connect(`changed::${key}`, () => {
        const index = optionIndex(options, settings.get_string(key));
        if (row.selected !== index)
            row.selected = index;
    });
    group.add(row);
    return row;
}

function addEntry(group, settings, key, title, subtitle, secure = false) {
    const row = new Adw.ActionRow({title, subtitle: subtitle || ''});
    const entry = new Gtk.Entry({
        text: settings.get_string(key),
        hexpand: true,
        valign: Gtk.Align.CENTER,
        visibility: !secure,
    });
    entry.set_width_chars(30);
    entry.connect('changed', () => settings.set_string(key, entry.text));
    settings.connect(`changed::${key}`, () => {
        if (entry.text !== settings.get_string(key))
            entry.text = settings.get_string(key);
    });
    row.add_suffix(entry);
    group.add(row);
    return entry;
}

function addButtonRow(group, title, subtitle, buttonLabel, callback) {
    const row = new Adw.ActionRow({title, subtitle: subtitle || ''});
    const button = new Gtk.Button({label: buttonLabel, valign: Gtk.Align.CENTER});
    button.connect('clicked', callback);
    row.add_suffix(button);
    group.add(row);
    return row;
}

function notify(message) {
    const dialog = new Gtk.MessageDialog({
        text: message,
        modal: true,
        buttons: Gtk.ButtonsType.OK,
    });
    dialog.connect('response', () => dialog.destroy());
    dialog.present();
}

function updateAutostart(enabled) {
    const dir = GLib.path_get_dirname(AUTOSTART_FILE);
    GLib.mkdir_with_parents(dir, 0o755);
    if (!enabled) {
        try {
            Gio.File.new_for_path(AUTOSTART_FILE).delete(null);
        } catch (_) {
        }
        return;
    }
    const contents = [
        '[Desktop Entry]',
        'Type=Application',
        'Name=LinuxCodexBar GNOME Extension',
        `Exec=gnome-extensions enable ${UUID}`,
        'X-GNOME-Autostart-enabled=true',
        'NoDisplay=true',
        '',
    ].join('\n');
    GLib.file_set_contents(AUTOSTART_FILE, contents);
}

function launchURI(uri) {
    try {
        Gio.AppInfo.launch_default_for_uri(uri, null);
    } catch (error) {
        notify(`Could not open ${uri}: ${error.message}`);
    }
}

function runCommand(argv) {
    try {
        Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
    } catch (error) {
        notify(error.message);
    }
}

export default class CodexBarPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        window.set_title('LinuxCodexBar');
        window.set_default_size(840, 660);

        this._generalPage(window);
        this._providersPage(window);
        this._displayPage(window);
        this._advancedPage(window);
        this._aboutPage(window);
        this._debugPage(window);
    }

    _generalPage(window) {
        const page = new Adw.PreferencesPage({title: 'General', icon_name: 'preferences-system-symbolic'});
        const startup = new Adw.PreferencesGroup({title: 'Startup'});
        addSwitch(startup, this._settings, 'launch-at-login', 'Start at Login', 'Enable the extension when the GNOME session starts.', updateAutostart);
        page.add(startup);

        const backend = new Adw.PreferencesGroup({title: 'Backend'});
        addEntry(
            backend,
            this._settings,
            'backend-path',
            'Backend Path',
            "Leave empty to resolve the 'codexbar' CLI from $PATH."
        );
        addButtonRow(backend, 'Test CLI', 'Runs codexbar usage with the current backend path.', 'Run', () => {
            const path = this._settings.get_string('backend-path').trim() || 'codexbar';
            runCommand([path, 'usage', '--format', 'json', '--source', 'auto', '--provider', 'all', '--pretty']);
        });
        page.add(backend);

        const refresh = new Adw.PreferencesGroup({title: 'Refresh'});
        addCombo(refresh, this._settings, 'refresh-frequency', 'Refresh cadence', null, REFRESH_OPTIONS);
        addSwitch(refresh, this._settings, 'status-checks-enabled', 'Check provider status', 'Poll provider status pages and surface incidents in the menu.');
        addSwitch(refresh, this._settings, 'session-quota-notifications-enabled', 'Session quota notifications', 'Notify when a 5-hour session quota depletes and when it restores.');
        page.add(refresh);

        const costs = new Adw.PreferencesGroup({title: 'Cost and Storage'});
        addSwitch(costs, this._settings, 'cost-usage-enabled', 'Show cost summary', 'Show today and last-30-day local token cost lines when the CLI provides them.');
        addSwitch(costs, this._settings, 'provider-storage-footprints-enabled', 'Show provider storage usage', 'Reserve menu space for provider disk usage facts when available.');
        page.add(costs);

        window.add(page);
    }

    _providersPage(window) {
        const page = new Adw.PreferencesPage({title: 'Providers', icon_name: 'view-list-symbolic'});
        const enabledGroup = new Adw.PreferencesGroup({
            title: 'Provider List',
            description: 'Provider data still comes from codexbar. These toggles only control which returned providers are shown by the extension.',
        });
        for (const [id, name, enabledDefault] of PROVIDERS)
            this._addProviderEnableRow(enabledGroup, id, name, enabledDefault);
        page.add(enabledGroup);

        const settingsGroup = new Adw.PreferencesGroup({
            title: 'Provider Settings',
            description: 'These mirror upstream row types. Persisted values are available to the extension UI; provider authentication remains owned by the codexbar CLI.',
        });
        for (const [id, name] of PROVIDERS)
            this._addProviderSettingsRow(settingsGroup, id, name);
        page.add(settingsGroup);

        const tokenGroup = new Adw.PreferencesGroup({
            title: 'Token Accounts',
            description: 'Manual token labels are stored for display parity. The CLI token files remain the source of truth.',
        });
        for (const [id, name] of PROVIDERS.slice(0, 12))
            this._addTokenAccountRow(tokenGroup, id, name);
        addButtonRow(tokenGroup, 'Open token directory', 'Open ~/.codexbar for manual token files and config.', 'Open', () => {
            launchURI(`file://${GLib.build_filenamev([GLib.get_home_dir(), '.codexbar'])}`);
        });
        page.add(tokenGroup);

        const codexGroup = new Adw.PreferencesGroup({title: 'Codex Accounts'});
        addCombo(codexGroup, this._settings, 'codex-active-account', 'Active account', 'Coordinator-managed accounts are macOS-only; GNOME stores the preferred label.', [
            ['default', 'Default'],
            ['system', 'System account'],
            ['managed', 'Managed account'],
        ]);
        addButtonRow(codexGroup, 'Add Account', 'Runs codexbar login for Codex.', 'Login', () => {
            const path = this._settings.get_string('backend-path').trim() || 'codexbar';
            runCommand([path, 'login', '--provider', 'codex']);
        });
        page.add(codexGroup);
        window.add(page);
    }

    _addProviderEnableRow(group, id, name, enabledDefault) {
        const enabled = strvSet(this._settings, 'enabled-providers');
        if (enabled.size === 0 && enabledDefault)
            enabled.add(id);
        const row = new Adw.ActionRow({
            title: name,
            subtitle: id,
        });
        const drag = new Gtk.Image({
            icon_name: 'list-drag-handle-symbolic',
            valign: Gtk.Align.CENTER,
        });
        const indicator = new Gtk.Image({
            icon_name: enabled.has(id) ? 'emblem-ok-symbolic' : 'window-close-symbolic',
            valign: Gtk.Align.CENTER,
        });
        const toggle = new Gtk.Switch({
            active: enabled.has(id),
            valign: Gtk.Align.CENTER,
        });
        row.add_prefix(drag);
        row.add_suffix(indicator);
        row.add_suffix(toggle);
        row.activatable_widget = toggle;
        toggle.connect('notify::active', () => {
            const current = strvSet(this._settings, 'enabled-providers');
            if (toggle.active)
                current.add(id);
            else
                current.delete(id);
            setStrvSet(this._settings, 'enabled-providers', current);
            indicator.icon_name = toggle.active ? 'emblem-ok-symbolic' : 'window-close-symbolic';
        });
        group.add(row);
    }

    _addProviderSettingsRow(group, id, name) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 6,
            margin_bottom: 6,
        });
        const title = new Gtk.Label({
            label: name,
            xalign: 0,
            css_classes: ['heading'],
        });
        box.append(title);

        const source = this._dropdownForDict('provider-source-modes', id, SOURCE_OPTIONS);
        const metric = this._dropdownForDict('menu-bar-metric-preferences', id, METRIC_OPTIONS);
        const sourceRow = this._plainRow('Source mode', source);
        const metricRow = this._plainRow('Menu bar metric', metric);
        box.append(sourceRow);
        box.append(metricRow);

        const extras = new Gtk.Switch({
            active: this._providerToggleValue(id),
            valign: Gtk.Align.CENTER,
        });
        extras.connect('notify::active', () => this._setProviderToggleValue(id, extras.active));
        box.append(this._plainRow('Provider options', extras, 'Enable provider-specific optional rows where supported.'));

        const row = new Adw.ActionRow({title: ''});
        row.set_child(box);
        group.add(row);
    }

    _dropdownForDict(key, provider, options) {
        const current = dictValue(this._settings, key);
        const dropdown = new Gtk.DropDown({
            model: stringList(options.map(([, label]) => label)),
            selected: optionIndex(options, current[provider] || options[0][0]),
            valign: Gtk.Align.CENTER,
        });
        dropdown.connect('notify::selected', () => {
            const updated = dictValue(this._settings, key);
            updated[provider] = options[dropdown.selected]?.[0] ?? options[0][0];
            setDictValue(this._settings, key, updated);
        });
        return dropdown;
    }

    _providerToggleValue(provider) {
        const current = dictValue(this._settings, 'provider-option-toggles');
        return current[provider] === 'true';
    }

    _setProviderToggleValue(provider, value) {
        const current = dictValue(this._settings, 'provider-option-toggles');
        current[provider] = value ? 'true' : 'false';
        setDictValue(this._settings, 'provider-option-toggles', current);
    }

    _plainRow(label, widget, subtitle = null) {
        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            hexpand: true,
        });
        const text = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
        });
        text.append(new Gtk.Label({
            label,
            xalign: 0,
            width_chars: 14,
        }));
        if (subtitle) {
            text.append(new Gtk.Label({
                label: subtitle,
                xalign: 0,
                wrap: true,
                css_classes: ['dim-label'],
            }));
        }
        row.append(text);
        row.append(widget);
        return row;
    }

    _addTokenAccountRow(group, id, name) {
        const row = new Adw.ActionRow({
            title: name,
            subtitle: 'Manual label and token entry for parity with upstream token account rows.',
        });
        const label = new Gtk.Entry({
            placeholder_text: 'Label',
            width_chars: 10,
            valign: Gtk.Align.CENTER,
        });
        const token = new Gtk.PasswordEntry({
            placeholder_text: 'Token',
            width_chars: 18,
            valign: Gtk.Align.CENTER,
        });
        const add = new Gtk.Button({label: 'Add', valign: Gtk.Align.CENTER});
        add.connect('clicked', () => {
            const values = dictValue(this._settings, 'provider-token-labels');
            values[id] = label.text || name;
            setDictValue(this._settings, 'provider-token-labels', values);
            token.text = '';
        });
        row.add_suffix(label);
        row.add_suffix(token);
        row.add_suffix(add);
        group.add(row);
    }

    _displayPage(window) {
        const page = new Adw.PreferencesPage({title: 'Display', icon_name: 'preferences-desktop-display-symbolic'});
        const panel = new Adw.PreferencesGroup({title: 'Panel Indicator'});
        addSwitch(panel, this._settings, 'merge-icons', 'Merge Icons', 'GNOME defaults to one merged panel button to preserve panel space.');
        addSwitch(panel, this._settings, 'switcher-shows-icons', 'Switcher shows icons', 'Show 16px provider badges in switcher buttons.');
        addSwitch(panel, this._settings, 'menu-bar-shows-highest-usage', 'Show most-used provider', 'Use the provider closest to its limit for the panel icon.');
        addSwitch(panel, this._settings, 'menu-bar-shows-brand-icon-with-percent', 'Menu bar shows percent', 'Use provider badge plus display text instead of critter bars.');
        addCombo(panel, this._settings, 'menu-bar-display-mode', 'Display mode', null, DISPLAY_MODE_OPTIONS);
        page.add(panel);

        const metrics = new Adw.PreferencesGroup({title: 'Menu Metrics'});
        addSwitch(metrics, this._settings, 'usage-bars-show-used', 'Show usage as used', 'Fill bars as consumed usage instead of remaining quota.');
        addSwitch(metrics, this._settings, 'reset-times-show-absolute', 'Show reset time as clock', 'Use clock labels instead of countdown labels.');
        addSwitch(metrics, this._settings, 'show-optional-credits-and-extra-usage', 'Show credits + extra usage', 'Show Codex credits and Claude extra usage sections.');
        addSwitch(metrics, this._settings, 'show-all-token-accounts-in-menu', 'Show all token accounts', 'Reserve menu layout for stacked token account rows.');
        page.add(metrics);

        const overview = new Adw.PreferencesGroup({
            title: 'Overview Tab Providers',
            description: 'Select up to three providers for the merged overview tab.',
        });
        for (const [id, name] of PROVIDERS)
            this._addOverviewProviderRow(overview, id, name);
        page.add(overview);
        window.add(page);
    }

    _addOverviewProviderRow(group, id, name) {
        const selected = strvSet(this._settings, 'merged-overview-selected-providers');
        const row = new Adw.ActionRow({title: name, subtitle: id});
        const check = new Gtk.CheckButton({
            active: selected.has(id),
            valign: Gtk.Align.CENTER,
        });
        check.connect('toggled', () => {
            const current = this._settings.get_strv('merged-overview-selected-providers');
            const set = new Set(current);
            if (check.active && set.size >= 3 && !set.has(id)) {
                check.active = false;
                return;
            }
            if (check.active)
                set.add(id);
            else
                set.delete(id);
            setStrvSet(this._settings, 'merged-overview-selected-providers', set);
        });
        row.add_suffix(check);
        row.activatable_widget = check;
        group.add(row);
    }

    _advancedPage(window) {
        const page = new Adw.PreferencesPage({title: 'Advanced', icon_name: 'applications-engineering-symbolic'});
        const notes = new Adw.PreferencesGroup({title: 'Platform Notes'});
        notes.add(new Adw.ActionRow({
            title: 'Keyboard shortcut for Open Menu',
            subtitle: 'GNOME Shell extensions cannot register the upstream KeyboardShortcuts binding directly.',
        }));
        notes.add(new Adw.ActionRow({
            title: 'Install CLI',
            subtitle: 'The codexbar CLI is installed separately. Set Backend Path on the General tab for local builds.',
        }));
        page.add(notes);

        const toggles = new Adw.PreferencesGroup({title: 'Advanced Settings'});
        addSwitch(toggles, this._settings, 'debug-menu-enabled', 'Show Debug Settings', 'Expose the Debug preferences tab.');
        addSwitch(toggles, this._settings, 'random-blink-enabled', 'Surprise me', 'Enable idle blink, wiggle, and tilt animation on the panel icon.');
        addSwitch(toggles, this._settings, 'hide-personal-info', 'Hide personal information', 'Replace emails with Hidden in the menu.');
        addSwitch(toggles, this._settings, 'historical-tracking-enabled', 'Historical tracking', 'Reserved for upstream-compatible pace and history data.');
        addSwitch(toggles, this._settings, 'claude-web-extras-enabled', 'Claude web extras', 'Allow optional Claude web usage details when the CLI provides them.');
        addSwitch(toggles, this._settings, 'claude-peak-hours-enabled', 'Claude peak hours', 'Show Claude peak-hour notes in the menu card.');
        addSwitch(toggles, this._settings, 'open-ai-web-access-enabled', 'OpenAI web access', 'Allow OpenAI web data when the CLI supports and returns it.');
        addSwitch(toggles, this._settings, 'open-ai-web-battery-saver-enabled', 'OpenAI web battery saver', 'Prefer lighter OpenAI web refreshes when available.');
        addEntry(toggles, this._settings, 'jetbrains-ide-base-path', 'JetBrains IDE Base Path', 'Optional base path used by JetBrains provider discovery.');
        page.add(toggles);
        window.add(page);
    }

    _aboutPage(window) {
        const page = new Adw.PreferencesPage({title: 'About', icon_name: 'help-about-symbolic'});
        const about = new Adw.PreferencesGroup({title: 'LinuxCodexBar'});
        about.add(new Adw.ActionRow({
            title: 'GNOME Shell extension',
            subtitle: 'May your tokens never run out—keep agent limits in view.',
        }));
        about.add(new Adw.ActionRow({
            title: 'Version',
            subtitle: `${this.metadata.version ?? 1}`,
        }));
        about.add(new Adw.ActionRow({
            title: 'UUID',
            subtitle: UUID,
        }));
        addButtonRow(about, 'GitHub', 'Open the LinuxCodexBar repository.', 'Open', () => {
            launchURI('https://github.com/LPFchan/LinuxCodexBar');
        });
        addButtonRow(about, 'Upstream', 'Open the upstream CodexBar project.', 'Open', () => {
            launchURI('https://github.com/steipete/CodexBar');
        });
        addButtonRow(about, 'Contact', 'Open a mail composer for upstream contact.', 'Email', () => {
            launchURI('mailto:hello@steipete.com');
        });
        page.add(about);

        const updates = new Adw.PreferencesGroup({title: 'Updates'});
        addSwitch(updates, this._settings, 'auto-update-enabled', 'Auto-update', 'GNOME extension updates are managed outside the extension.');
        addCombo(updates, this._settings, 'update-channel', 'Update channel', null, [
            ['stable', 'Stable'],
            ['beta', 'Beta'],
        ]);
        addButtonRow(updates, 'Check for Updates', 'Open the repository releases page.', 'Open', () => {
            launchURI('https://github.com/LPFchan/LinuxCodexBar/releases');
        });
        page.add(updates);
        window.add(page);
    }

    _debugPage(window) {
        const page = new Adw.PreferencesPage({
            title: 'Debug',
            icon_name: 'tools-symbolic',
            visible: this._settings.get_boolean('debug-menu-enabled'),
        });
        this._settings.connect('changed::debug-menu-enabled', () => {
            page.visible = this._settings.get_boolean('debug-menu-enabled');
        });
        const logging = new Adw.PreferencesGroup({title: 'Logging'});
        addSwitch(logging, this._settings, 'debug-file-logging-enabled', 'File logging', 'Mirror upstream file logging preference.');
        addCombo(logging, this._settings, 'debug-log-level', 'Verbosity', null, LOG_LEVEL_OPTIONS);
        addButtonRow(logging, 'Open log file', 'Open ~/.cache/codexbar/codexbar.log if it exists.', 'Open', () => {
            launchURI(`file://${GLib.build_filenamev([GLib.get_home_dir(), '.cache', 'codexbar', 'codexbar.log'])}`);
        });
        page.add(logging);

        const animation = new Adw.PreferencesGroup({title: 'Animation'});
        addCombo(animation, this._settings, 'debug-loading-pattern', 'Loading animation pattern', null, LOADING_PATTERN_OPTIONS);
        addButtonRow(animation, 'Replay loading animation', 'Injects a transient menu error so the panel icon redraws.', 'Replay', () => {
            this._settings.set_string('debug-injected-error', 'Debug animation replay');
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                this._settings.set_string('debug-injected-error', '');
                return GLib.SOURCE_REMOVE;
            });
        });
        addButtonRow(animation, 'Blink now', 'Enables the idle animation path and lets the next shell tick render it.', 'Blink', () => {
            this._settings.set_boolean('random-blink-enabled', true);
        });
        page.add(animation);

        const cache = new Adw.PreferencesGroup({title: 'Cache'});
        addButtonRow(cache, 'Clear cost cache', 'Deletes ~/.cache/codexbar/cost when present.', 'Clear', () => {
            runCommand(['rm', '-rf', GLib.build_filenamev([GLib.get_home_dir(), '.cache', 'codexbar', 'cost'])]);
        });
        addButtonRow(cache, 'Clear cookie cache', 'Deletes ~/.cache/codexbar/cookies when present.', 'Clear', () => {
            runCommand(['rm', '-rf', GLib.build_filenamev([GLib.get_home_dir(), '.cache', 'codexbar', 'cookies'])]);
        });
        addSwitch(cache, this._settings, 'debug-keep-cli-sessions-alive', 'CLI sessions keep-alive', 'Mirror upstream keep-alive debug toggle.');
        page.add(cache);

        const errors = new Adw.PreferencesGroup({title: 'Error Simulation'});
        addEntry(errors, this._settings, 'debug-injected-error', 'Fake menu card error', 'Set text to inject a backend error banner into the menu.');
        addButtonRow(errors, 'Test notification', 'Show depleted/restored-style shell notifications.', 'Notify', () => {
            runCommand(['notify-send', 'LinuxCodexBar', 'Session quota test notification']);
        });
        page.add(errors);

        const paths = new Adw.PreferencesGroup({title: 'CLI Paths'});
        paths.add(new Adw.ActionRow({
            title: 'Effective backend',
            subtitle: this._settings.get_string('backend-path').trim() || 'codexbar from $PATH',
        }));
        paths.add(new Adw.ActionRow({
            title: 'Effective PATH',
            subtitle: GLib.getenv('PATH') || '',
        }));
        window.add(page);
    }
}
