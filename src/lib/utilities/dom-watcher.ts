import { createDebouncedObserver } from "./dom";

type Listener = () => void;

interface Entry {
	observer: ReturnType<typeof createDebouncedObserver> | null;
	listeners: Set<Listener>;
}

const bodyEntry: Entry = { observer: null, listeners: new Set() };
const scoped = new Map<Node, Entry>();

function dispatch(entry: Entry) {
	for (const listener of entry.listeners) listener();
}

function subscribe(entry: Entry, target: Node, listener: Listener, options?: MutationObserverInit) {
	listener();
	entry.listeners.add(listener);
	if (!entry.observer) {
		entry.observer = createDebouncedObserver(() => dispatch(entry), options);
		entry.observer.observe(target);
	}
}

const elementWatchers = new Map<string, { current: Element | null; listeners: Set<Listener> }>();
let elementObserver: MutationObserver | null = null;

/**
 * Calls `listener` whenever the first element matching `selector` appears, goes, or is replaced.
 * Unlike watchDom this runs before the next paint, so Actual's new markup never shows unstyled.
 */
export function watchElement(selector: string, listener: Listener): () => void {
	let entry = elementWatchers.get(selector);
	if (!entry) {
		entry = { current: document.querySelector(selector), listeners: new Set() };
		elementWatchers.set(selector, entry);
	}
	entry.listeners.add(listener);
	elementObserver ??= new MutationObserver(() => {
		for (const [sel, watcher] of elementWatchers) {
			const el = document.querySelector(sel);
			if (el === watcher.current) continue;
			watcher.current = el;
			for (const l of watcher.listeners) l();
		}
	});
	elementObserver.observe(document.body, { childList: true, subtree: true });
	return () => {
		entry!.listeners.delete(listener);
		if (entry!.listeners.size === 0) elementWatchers.delete(selector);
		if (elementWatchers.size === 0) {
			elementObserver?.disconnect();
			elementObserver = null;
		}
	};
}

/**
 * Subscribes to DOM changes, invoking `listener` immediately and again on every
 * subsequent mutation. Without a `target`, all callers share one observer on
 * `document.body`. Passing a `target` gets that node its own dedicated observer
 * (deduped by target — the first caller's `options` win if targets collide).
 */
export function watchDom(
	listener: Listener,
	target?: Node,
	options?: MutationObserverInit,
): () => void {
	if (!target) {
		subscribe(bodyEntry, document.body, listener);
		return () => {
			bodyEntry.listeners.delete(listener);
			if (bodyEntry.listeners.size === 0) {
				bodyEntry.observer?.disconnect();
				bodyEntry.observer = null;
			}
		};
	}

	let entry = scoped.get(target);
	if (!entry) {
		entry = { observer: null, listeners: new Set() };
		scoped.set(target, entry);
	}
	subscribe(entry, target, listener, options);

	return () => {
		entry!.listeners.delete(listener);
		if (entry!.listeners.size === 0) {
			entry!.observer?.disconnect();
			scoped.delete(target);
		}
	};
}
