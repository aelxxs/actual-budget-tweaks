import { BUDGET_LINK } from "@lib/actual-dom";
import { loadCurrentBudgetId } from "./actual-api";
import { watchDom } from "@lib/dom/dom-watcher";
import { getValue, setValue, watchValue } from "@lib/store";

export interface BudgetValue {
	/** Saves under the open budget; does nothing with no budget open. */
	save: (value: unknown) => Promise<void>;
	stop: () => void;
}

/**
 * A value kept per budget, under `${base}:${budgetId}`, so nothing carries from one budget to
 * another. Calls back with the open budget's value (null when it has none, or none is open),
 * again whenever it changes, and when another budget opens.
 */
export function followBudgetValue(base: string, set: (value: unknown) => void): BudgetValue {
	let id: string | undefined;
	let stopWatch: (() => void) | null = null;
	let open = false;
	let seq = 0;

	function detach(): void {
		seq++;
		stopWatch?.();
		stopWatch = null;
		id = undefined;
		set(null);
	}

	async function attach(): Promise<void> {
		const mine = ++seq;
		const next = await loadCurrentBudgetId().catch(() => undefined);
		if (mine !== seq || !next) {
			return;
		}
		stopWatch?.();
		id = next;
		const key = `${base}:${next}`;
		stopWatch = watchValue<unknown>(key, (value) => set(value ?? null));
		const value = await getValue<unknown>(key, null);
		if (mine === seq) {
			set(value);
		}
	}

	// A budget opening, or switching to another (which closes the first), is the cue to re-read.
	const unwatch = watchDom(() => {
		const now = !!document.querySelector(BUDGET_LINK);
		if (now && !open) {
			void attach();
		} else if (!now && open) {
			detach();
		}
		open = now;
	});

	return {
		save: async (value) => {
			if (id) {
				await setValue(`${base}:${id}`, value);
			}
		},
		stop: () => {
			unwatch();
			seq++;
			stopWatch?.();
			stopWatch = null;
		},
	};
}
