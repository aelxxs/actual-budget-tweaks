import { applyGlobalCSS } from "@lib/utilities/dom";
import { createLogger } from "@lib/utilities/logger";
import { getValue, setValue } from "@lib/utilities/store";
import type { Setting } from "./types";

const log = createLogger("runtime");

interface DeactivateOptions {
	/** Skip clearing CSS — used when an activate() with new CSS is about to immediately follow. */
	preserveCss?: boolean;
}

const active = new Map<string, (opts?: DeactivateOptions) => void | Promise<void>>();

function shouldRun(setting: Setting, value: unknown): boolean {
	return setting.type === "checkbox" ? Boolean(value) : true;
}

async function activate(setting: Setting, value: unknown) {
	if (setting.type === "core" || setting.type === "custom") return;

	const ctx = { ...setting.context, value };
	const key = ctx.key;

	try {
		if (setting.css) applyGlobalCSS(setting.css(ctx), key);
		const cleanup = await setting.init?.(ctx);

		active.set(key, async (opts) => {
			if (setting.css && !opts?.preserveCss) applyGlobalCSS("", key);
			await cleanup?.();
		});
		log.info(`enabled "${key}"`);
	} catch (err) {
		log.error(`failed to enable "${key}"`, err);
		if (setting.css) applyGlobalCSS("", key);
	}
}

async function deactivate(key: string, opts?: DeactivateOptions) {
	try {
		await active.get(key)?.(opts);
		if (!opts?.preserveCss) log.info(`disabled "${key}"`);
	} catch (err) {
		log.error(`cleanup threw for "${key}"`, err);
	} finally {
		active.delete(key);
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
	await Promise.all(settings.map(bootstrapOne));
	log.info("bootstrap complete");
}
