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

/**
 * Subscribes to DOM changes, invoking `listener` immediately and again on every
 * subsequent mutation. Without a `target`, all callers share one observer on
 * `document.body`. Passing a `target` gets that node its own dedicated observer
 * (deduped by target — the first caller's `options` win if targets collide).
 */
export function watchDom(listener: Listener, target?: Node, options?: MutationObserverInit): () => void {
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
