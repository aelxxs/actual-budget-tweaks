import { HELP_BUTTON } from "@lib/actual-dom";
import { watchDom } from "@lib/utilities/dom-watcher";

/** Actual's own sync status (its redesigned sidebar's line), less "Local file", told from the file. */
export type SyncStatus = "no-server" | "syncing" | "error" | "offline" | "disabled" | "synced";

/*
 * Actual keeps sync state in a hook fed by backend events a content script can't hear, so it's
 * read from the titlebar's sync button, which renders that hook: missing without a server,
 * aria-disabled offline, an alert glyph on error, a "Disabled" label, and a spinning icon.
 */
let current = $state<SyncStatus | null>(null);
let users = 0;
let stopDom: (() => void) | null = null;
let observer: MutationObserver | null = null;
let button: HTMLButtonElement | null = null;

export function syncStatus(): SyncStatus | null {
	return current;
}

// The titlebar cluster holds Help; the sync button is the one whose icon sits in a spinning wrapper.
function findButton(): HTMLButtonElement | null {
	const cluster = document.querySelector(HELP_BUTTON)?.parentElement?.parentElement;
	return (
		cluster?.querySelector<HTMLButtonElement>(":scope > div > button:has(> div > svg)") ?? null
	);
}

function read(): SyncStatus | null {
	if (!button) {
		return document.querySelector(HELP_BUTTON) ? "no-server" : null;
	}
	if (button.getAttribute("aria-disabled") === "true") {
		return "offline";
	}
	// On error the alert glyph replaces the wrapper, so the button found earlier is kept.
	if (button.querySelector(":scope > svg")) {
		return "error";
	}
	if (button.querySelector(":scope > span")?.textContent?.trim()) {
		return "disabled";
	}
	const spinner = button.querySelector(":scope > div");
	if (spinner && getComputedStyle(spinner).animationName !== "none") {
		return "syncing";
	}
	return "synced";
}

function update() {
	const next = read();
	if (next !== current) {
		current = next;
	}
}

function attach() {
	if (button?.isConnected) {
		return;
	}
	observer?.disconnect();
	button = findButton();
	if (button) {
		observer ??= new MutationObserver(update);
		observer.observe(button, {
			attributes: true,
			childList: true,
			subtree: true,
			characterData: true,
		});
	}
}

/** Keeps `syncStatus()` current while a component that reads it is mounted. */
export function trackSyncStatus(): () => void {
	if (users++ === 0) {
		stopDom = watchDom(function syncStatusSignal() {
			attach();
			update();
		});
	}
	return () => {
		if (--users === 0) {
			stopDom?.();
			stopDom = null;
			observer?.disconnect();
			observer = null;
			button = null;
		}
	};
}
