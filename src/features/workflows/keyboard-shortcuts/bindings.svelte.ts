// No feature imports: the command palette reads these for its hints, and the actions import the palette's features.

export type ShortcutId = "sidebar" | "insights" | "reconcile" | "studio";

export interface Binding {
	/** `KeyboardEvent.key`, lowercase for letters. */
	key: string;
	shift?: boolean;
}

// Keys Actual leaves free: it binds bare letters on the transaction list and ⌘/Ctrl chords app-wide.
export const BINDINGS: Record<ShortcutId, Binding> = {
	sidebar: { key: "[" },
	insights: { key: "i" },
	reconcile: { key: "r", shift: true },
	studio: { key: "s", shift: true },
};

export const shortcutsState = $state({ on: false });

export function matches(e: KeyboardEvent, b: Binding): boolean {
	return e.key.toLowerCase() === b.key && e.shiftKey === !!b.shift;
}

/** The keys to show for a shortcut, e.g. ["Shift", "R"]. */
export function keyLabels(id: ShortcutId): string[] {
	const b = BINDINGS[id];
	return [...(b.shift ? ["Shift"] : []), b.key.toUpperCase()];
}
