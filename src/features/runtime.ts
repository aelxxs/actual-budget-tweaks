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

function usesLegacyLifecycle(setting: Setting): setting is Setting & { onChange: NonNullable<unknown> } {
	return setting.type !== "core" && setting.type !== "custom" && Boolean((setting as { onChange?: unknown }).onChange);
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

	if (usesLegacyLifecycle(setting)) {
		try {
			await setting.onChange(newValue, setting.context);
		} catch (err) {
			log.error(`legacy onChange threw for "${setting.context.key}"`, err);
		}
		return;
	}

	await setValue(setting.context.key, newValue);
	const willReactivate = shouldRun(setting, newValue);
	await deactivate(setting.context.key, { preserveCss: willReactivate });
	if (willReactivate) await activate(setting, newValue);
}

/** Called once at content-script startup to bring every setting to its persisted state. */
export async function bootstrapSettings(settings: Setting[]) {
	log.info(`bootstrapping ${settings.length} settings`);

	for (const setting of settings) {
		if (setting.type === "core") {
			try {
				await setting.init();
			} catch (err) {
				log.error("core setting failed to init", err);
			}
			continue;
		}

		if (setting.type === "custom") {
			try {
				await setting.init(setting.context);
			} catch (err) {
				log.error(`custom setting "${setting.context.key}" failed to init`, err);
			}
			continue;
		}

		if (usesLegacyLifecycle(setting)) {
			// legacy init() reads storage and checks enabled state internally
			try {
				await setting.init?.({ ...setting.context, value: undefined });
			} catch (err) {
				log.error(`legacy init threw for "${setting.context.key}"`, err);
			}
			continue;
		}

		const value = await getValue(setting.context.key, setting.context.defaultValue);
		if (shouldRun(setting, value)) await activate(setting, value);
	}

	log.info("bootstrap complete");
}
