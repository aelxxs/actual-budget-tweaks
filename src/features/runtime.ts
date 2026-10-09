import { applyGlobalCSS } from "@lib/utilities/dom";
import { createLogger } from "@lib/utilities/logger";
import { getValue, setValue } from "@lib/utilities/store";
import { DESKTOP_QUERY, desktopOnly } from "@lib/utilities/pages";
import type { Setting, SettingContext } from "./types";

const log = createLogger("runtime");

interface DeactivateOptions {
	/** Skip clearing CSS — used when an activate() with new CSS is about to immediately follow. */
	preserveCss?: boolean;
}

interface Active {
	setting: Setting;
	ctx: SettingContext & { value: unknown };
	/** Set while init has run; null while the window is in Actual's mobile view. */
	stop: (() => void | Promise<void>) | null;
}

const active = new Map<string, Active>();
const desktop = matchMedia(DESKTOP_QUERY);

function shouldRun(setting: Setting, value: unknown): boolean {
	return setting.type === "checkbox" ? Boolean(value) : true;
}

function scopedCss(setting: Setting, css: string): string {
	return "mobile" in setting && setting.mobile ? css : desktopOnly(css);
}

async function start(entry: Active): Promise<void> {
	if (entry.setting.type === "core" || entry.setting.type === "custom") return;
	const cleanup = await entry.setting.init?.(entry.ctx);
	entry.stop = typeof cleanup === "function" ? cleanup : () => {};
}

async function stop(entry: Active): Promise<void> {
	const fn = entry.stop;
	entry.stop = null;
	await fn?.();
}

async function activate(setting: Setting, value: unknown) {
	if (setting.type === "core" || setting.type === "custom") return;

	const ctx = { ...setting.context, value };
	const key = ctx.key;
	const entry: Active = { setting, ctx, stop: null };

	try {
		// The media query keeps desktop-only CSS off mobile without a re-render on resize.
		if (setting.css) applyGlobalCSS(scopedCss(setting, setting.css(ctx)), key);
		active.set(key, entry);
		if (setting.mobile || desktop.matches) await start(entry);
		log.info(`enabled "${key}"`);
	} catch (err) {
		log.error(`failed to enable "${key}"`, err);
		active.delete(key);
		if (setting.css) applyGlobalCSS("", key);
	}
}

async function deactivate(key: string, opts?: DeactivateOptions) {
	const entry = active.get(key);
	active.delete(key);
	if (!entry) return;
	try {
		if (entry.setting.type !== "core" && entry.setting.type !== "custom") {
			if (entry.setting.css && !opts?.preserveCss) applyGlobalCSS("", key);
		}
		await stop(entry);
		if (!opts?.preserveCss) log.info(`disabled "${key}"`);
	} catch (err) {
		log.error(`cleanup threw for "${key}"`, err);
	}
}

/** Starts or stops desktop-only features as the window crosses Actual's mobile breakpoint. */
function onViewportChange(): void {
	for (const [key, entry] of active) {
		if (entry.setting.type === "core" || entry.setting.type === "custom") continue;
		if (entry.setting.mobile) continue;
		const run = desktop.matches ? !entry.stop && start(entry) : entry.stop && stop(entry);
		if (run) run.catch((err) => log.error(`viewport change failed for "${key}"`, err));
	}
}

/** Called by settings-panel UI (Checkbox/Select) when the user changes a value. */
export async function applySettingChange(setting: Setting, newValue: unknown) {
	if (setting.type === "core" || setting.type === "custom") return;

	await setValue(setting.context.key, newValue);
	await reapplySetting(setting, newValue);
}

/** Brings a running setting to a value that's already stored, e.g. one synced from Actual. */
export async function reapplySetting(setting: Setting, value: unknown) {
	if (setting.type === "core" || setting.type === "custom") return;
	const willReactivate = shouldRun(setting, value);
	await deactivate(setting.context.key, { preserveCss: willReactivate });
	if (willReactivate) await activate(setting, value);
}

async function bootstrapOne(setting: Setting): Promise<void> {
	if (setting.type === "core") {
		try {
			await setting.init();
		} catch (err) {
			log.error("core setting failed to init", err);
		}
		return;
	}

	if (setting.type === "custom") {
		try {
			await setting.init(setting.context);
		} catch (err) {
			log.error(`custom setting "${setting.context.key}" failed to init`, err);
		}
		return;
	}

	const value = await getValue(setting.context.key, setting.context.defaultValue);
	if (shouldRun(setting, value)) await activate(setting, value);
}

/**
 * Called once at content-script startup to bring every setting to its persisted
 * state. Each setting bootstraps independently and concurrently — one feature's
 * slow storage read or init() must not delay another feature's CSS from applying.
 */
export async function bootstrapSettings(settings: Setting[]) {
	log.info(`bootstrapping ${settings.length} settings`);
	desktop.addEventListener("change", onViewportChange);
	await Promise.all(settings.map(bootstrapOne));
	log.info("bootstrap complete");
}
