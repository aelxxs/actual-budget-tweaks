import { getValue, setValue, watchValue } from "@lib/utilities/store";
import type { Effects } from "./studio/generator";

const KEY = "theme-effects";

/** Glow and grain per theme key, for every theme but Studio ones, whose recipe holds them. */
export const effectsState = $state<{ byTheme: Record<string, Effects> }>({ byTheme: {} });

export const NO_EFFECTS: Effects = {
	glow: { on: false, lights: [] },
	grain: { amount: 0, size: "fine" },
};

let loading: Promise<void> | null = null;
export function loadThemeEffects(): Promise<void> {
	loading ??= getValue<Record<string, Effects>>(KEY, {}).then((v) => {
		effectsState.byTheme = v ?? {};
		watchValue<Record<string, Effects>>(KEY, (next) => (effectsState.byTheme = next ?? {}));
	});
	return loading;
}

export function effectsFor(key: string): Effects {
	return effectsState.byTheme[key] ?? NO_EFFECTS;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

/** Takes effect at once; the write waits for a pause, so dragging a light doesn't flood sync. */
export function setThemeEffects(key: string, effects: Effects): void {
	const plain: Effects = JSON.parse(JSON.stringify(effects));
	const next = { ...effectsState.byTheme };
	if (!plain.glow.on && plain.grain.amount === 0) {
		delete next[key];
	} else {
		next[key] = plain;
	}
	effectsState.byTheme = next;
	clearTimeout(persistTimer);
	persistTimer = setTimeout(() => void setValue(KEY, effectsState.byTheme), 400);
}
