import { defineSetting } from "@features/types";
import { ACTIONS } from "./actions";
import { BINDINGS, type ShortcutId, matches, shortcutsState } from "./bindings.svelte";
import ShortcutList from "./ShortcutList.svelte";

function isTyping(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || !!target.closest("input, textarea, select"))
	);
}

function onKeyDown(e: KeyboardEvent): void {
	if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) {
		return;
	}
	if (isTyping(e.target) || document.querySelector('[aria-modal="true"]')) {
		return;
	}
	const id = (Object.keys(BINDINGS) as ShortcutId[]).find((k) => matches(e, BINDINGS[k]));
	if (id && ACTIONS[id].run()) {
		e.preventDefault();
	}
}

export const keyboardShortcuts = defineSetting({
	type: "checkbox",
	label: "Keyboard shortcuts",
	description:
		"Single keys for the sidebar, Insights, Reconcile and Theme Studio. Ignored while you type.",
	icon: "keyboard",
	context: {
		key: "keyboard-shortcuts",
		defaultValue: false,
	},
	details: ShortcutList,
	init: () => {
		shortcutsState.on = true;
		document.addEventListener("keydown", onKeyDown);
		return () => {
			shortcutsState.on = false;
			document.removeEventListener("keydown", onKeyDown);
		};
	},
});
