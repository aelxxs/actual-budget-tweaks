import { isTrackingBudget, onBudgetType } from "@lib/actual/budget-type";
import { applyGlobalCSS } from "@lib/dom/dom";
import { createLogger } from "@lib/logger";
import { getValue, setValue } from "@lib/store";
import { labelWatchers } from "@lib/dom/watch-timing";
import { DESKTOP_QUERY, desktopOnly, mobileOnly } from "@lib/actual/pages";
import type { Platform, Setting, SettingContext } from "./types";

const log = createLogger("runtime");

interface DeactivateOptions {
	/** Skip clearing CSS — used when an activate() with new CSS is about to immediately follow. */
	preserveCss?: boolean;
}

interface Active {
	setting: Setting;
	ctx: SettingContext & { value: unknown };
	/** Set while init has run; null while the window is in a view the setting doesn't run in. */
	stop: (() => void | Promise<void>) | null;
}

const active = new Map<string, Active>();
const desktop = matchMedia(DESKTOP_QUERY);

function shouldRun(setting: Setting, value: unknown): boolean {
	return setting.type === "checkbox" ? Boolean(value) : true;
}

function platformOf(setting: Setting): Platform {
	return ("platform" in setting && setting.platform) || "desktop";
}

/** Whether the setting runs in the view Actual shows now. */
function runsHere(setting: Setting): boolean {
	const platform = platformOf(setting);
	return platform === "all" || (platform === "desktop") === desktop.matches;
}

function scopedCss(setting: Setting, css: string): string {
	const platform = platformOf(setting);
	return platform === "all" ? css : platform === "mobile" ? mobileOnly(css) : desktopOnly(css);
}

/** An envelope-only feature on a tracking budget: kept enabled, but with no CSS and not started. */
function standsDown(setting: Setting): boolean {
	return "envelopeOnly" in setting && !!setting.envelopeOnly && isTrackingBudget();
}

function applyCss(entry: Active): void {
	const { setting } = entry;
	if (setting.type === "core" || setting.type === "custom" || !setting.css) {
		return;
	}
	applyGlobalCSS(
		standsDown(setting) ? "" : scopedCss(setting, setting.css(entry.ctx)),
		entry.ctx.key,
	);
}

async function start(entry: Active): Promise<void> {
	if (entry.setting.type === "core" || entry.setting.type === "custom") {
		return;
	}
	const { setting, ctx } = entry;
	const cleanup = await labelWatchers(ctx.key, () => setting.init?.(ctx));
	entry.stop = typeof cleanup === "function" ? cleanup : () => {};
}

async function stop(entry: Active): Promise<void> {
	const fn = entry.stop;
	entry.stop = null;
	await fn?.();
}

async function activate(setting: Setting, value: unknown) {
	if (setting.type === "core" || setting.type === "custom") {
		return;
	}

	const ctx = { ...setting.context, value };
	const key = ctx.key;
	const entry: Active = { setting, ctx, stop: null };

	try {
		// The media query keeps CSS out of the other view without a re-render on resize.
		applyCss(entry);
		active.set(key, entry);
		if (runsHere(setting) && !standsDown(setting)) {
			await start(entry);
		}
		log.info(`enabled "${key}"`);
	} catch (err) {
		log.error(`failed to enable "${key}"`, err);
		active.delete(key);
		if (setting.css) {
			applyGlobalCSS("", key);
		}
	}
}

async function deactivate(key: string, opts?: DeactivateOptions) {
	const entry = active.get(key);
	active.delete(key);
	if (!entry) {
		return;
	}
	try {
		if (entry.setting.type !== "core" && entry.setting.type !== "custom") {
			if (entry.setting.css && !opts?.preserveCss) {
				applyGlobalCSS("", key);
			}
		}
		await stop(entry);
		if (!opts?.preserveCss) {
			log.info(`disabled "${key}"`);
		}
	} catch (err) {
		log.error(`cleanup threw for "${key}"`, err);
	}
}

/** Starts or stops features as the window crosses Actual's mobile breakpoint. */
function onViewportChange(): void {
	for (const [key, entry] of active) {
		if (entry.setting.type === "core" || entry.setting.type === "custom") {
			continue;
		}
		if (platformOf(entry.setting) === "all" || standsDown(entry.setting)) {
			continue;
		}
		const run = runsHere(entry.setting) ? !entry.stop && start(entry) : entry.stop && stop(entry);
		if (run) {
			run.catch((err) => log.error(`viewport change failed for "${key}"`, err));
		}
	}
}

/** Stands envelope-only features down on a tracking budget, and back up on an envelope one. */
function onBudgetTypeChange(): void {
	for (const [key, entry] of active) {
		const { setting } = entry;
		if (setting.type === "core" || setting.type === "custom" || !setting.envelopeOnly) {
			continue;
		}
		applyCss(entry);
		const down = standsDown(setting);
		const run = down ? entry.stop && stop(entry) : !entry.stop && runsHere(setting) && start(entry);
		if (run) {
			run.catch((err) => log.error(`budget type change failed for "${key}"`, err));
		}
	}
}

/** Called by settings-panel UI (Checkbox/Select) when the user changes a value. */
export async function applySettingChange(setting: Setting, newValue: unknown) {
	if (setting.type === "core" || setting.type === "custom") {
		return;
	}

	await setValue(setting.context.key, newValue);
	await reapplySetting(setting, newValue);
}

/** Brings a running setting to a value that's already stored, e.g. one synced from Actual. */
export async function reapplySetting(setting: Setting, value: unknown) {
	if (setting.type === "core" || setting.type === "custom") {
		return;
	}
	const willReactivate = shouldRun(setting, value);
	await deactivate(setting.context.key, { preserveCss: willReactivate });
	if (willReactivate) {
		await activate(setting, value);
	}
}

async function bootstrapOne(setting: Setting): Promise<void> {
	if (setting.type === "core") {
		try {
			await labelWatchers("core", () => setting.init());
		} catch (err) {
			log.error("core setting failed to init", err);
		}
		return;
	}

	if (setting.type === "custom") {
		try {
			await labelWatchers(setting.context.key, () => setting.init(setting.context));
		} catch (err) {
			log.error(`custom setting "${setting.context.key}" failed to init`, err);
		}
		return;
	}

	const value = await getValue(setting.context.key, setting.context.defaultValue);
	if (shouldRun(setting, value)) {
		await activate(setting, value);
	}
}

/**
 * Called once at content-script startup to bring every setting to its persisted
 * state. Each setting bootstraps independently and concurrently — one feature's
 * slow storage read or init() must not delay another feature's CSS from applying.
 */
export async function bootstrapSettings(settings: Setting[]) {
	log.info(`bootstrapping ${settings.length} settings`);
	desktop.addEventListener("change", onViewportChange);
	onBudgetType(onBudgetTypeChange);
	await Promise.all(settings.map(bootstrapOne));
	log.info("bootstrap complete");
}
