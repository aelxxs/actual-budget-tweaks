import { untrack } from "svelte";
import { getValue, watchValue } from "./store";

type Source<T> = { key: string; defaultValue: T };

/**
 * A stored value that follows later writes from any tab or view; the default until it loads and
 * whenever the key is cleared. Call it while a component initialises. Pass a getter, such as
 * `() => setting.context`, when the key comes from props.
 */
export function storedValue<T>(key: string, defaultValue: T): { readonly current: T };
export function storedValue<T>(source: () => Source<T>): { readonly current: T };
export function storedValue<T>(
	keyOrSource: string | (() => Source<T>),
	defaultValue?: T,
): { readonly current: T } {
	const source = (): Source<T> =>
		typeof keyOrSource === "string"
			? { key: keyOrSource, defaultValue: defaultValue as T }
			: keyOrSource();
	let value = $state(untrack(source).defaultValue);
	$effect(() => {
		const { key, defaultValue: fallback } = source();
		// A write that lands before the first read finishes is newer than what that read returns.
		let changed = false;
		const stop = watchValue<T>(key, (next) => {
			changed = true;
			value = next ?? fallback;
		});
		void getValue(key, fallback).then((stored) => {
			if (!changed) {
				value = stored;
			}
		});
		return () => {
			changed = true;
			stop();
		};
	});
	return {
		get current() {
			return value;
		},
	};
}
