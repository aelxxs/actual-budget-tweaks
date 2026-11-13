import { BUDGET_TABLE, MAIN, TRANSACTION_TABLE } from "@lib/actual-dom";
/*
 * Dev builds only: times each DOM watcher run, named by the feature that started it. Slow runs
 * show as "abt:" marks in the browser's performance profile; for the totals, run
 * `document.dispatchEvent(new Event("abt:perf"))` in the page console (`abt:perf-reset` clears them).
 * `abt:perf-css` times restyling the open page with each of ABT's stylesheets switched off in turn.
 * `abt:perf` also lists bridge requests: how many, how many cells they read, and how long they took.
 */
type Listener = () => void;

interface Stat {
	runs: number;
	total: number;
	max: number;
}

// Runs under this are left out of the profile, which keeps every mark there; totals count them all.
const MARK_MS = 1;

let current: string | null = null;
const names = new WeakMap<Listener, string>();
const stats = new Map<string, Stat>();
const requests = new Map<string, Stat & { items: number; first: number; last: number }>();
let listening = false;

/** Names the watchers started while `fn` runs synchronously after `feature`. */
export function labelWatchers<T>(feature: string, fn: () => T): T {
	if (!import.meta.env.DEV) {
		return fn();
	}
	const prev = current;
	current = feature;
	try {
		return fn();
	} finally {
		current = prev;
	}
}

/** Remembers which feature a new watcher belongs to. */
export function nameWatcher(listener: Listener, feature = current): void {
	if (!import.meta.env.DEV) {
		return;
	}
	names.set(listener, `${feature ?? "?"}${listener.name ? ` · ${listener.name}` : ""}`);
	listen();
}

export function runWatcher(listener: Listener): void {
	if (!import.meta.env.DEV) {
		listener();
		return;
	}
	const start = performance.now();
	try {
		listener();
	} finally {
		const ms = performance.now() - start;
		const name = names.get(listener) ?? "?";
		const stat = stats.get(name) ?? { runs: 0, total: 0, max: 0 };
		stat.runs++;
		stat.total += ms;
		stat.max = Math.max(stat.max, ms);
		stats.set(name, stat);
		if (ms >= MARK_MS) {
			performance.measure(`abt: ${name}`, { start, duration: ms });
		}
	}
}

/** Counts a bridge request and times it until it settles; `items` is how many cells it reads. */
export function timeRequest<T>(name: string, items: number, promise: Promise<T>): Promise<T> {
	if (!import.meta.env.DEV) {
		return promise;
	}
	listen();
	const start = performance.now();
	const done = () => {
		const ms = performance.now() - start;
		const r = requests.get(name) ?? {
			runs: 0,
			items: 0,
			total: 0,
			max: 0,
			first: start,
			last: start,
		};
		r.last = Math.max(r.last, start);
		r.runs++;
		r.items += items;
		r.total += ms;
		r.max = Math.max(r.max, ms);
		requests.set(name, r);
	};
	promise.then(done, done);
	return promise;
}

function listen(): void {
	if (listening) {
		return;
	}
	listening = true;
	document.addEventListener("abt:perf", () => {
		const rows = [...stats]
			.sort(([, a], [, b]) => b.total - a.total)
			.map(([watcher, s]) => ({
				watcher,
				runs: s.runs,
				"total ms": +s.total.toFixed(1),
				"avg ms": +(s.total / s.runs).toFixed(3),
				"max ms": +s.max.toFixed(1),
			}));
		console.table(rows);
		console.table(
			[...requests]
				.sort(([, a], [, b]) => a.first - b.first)
				.map(([request, r]) => ({
					request,
					count: r.runs,
					items: r.items,
					"total ms": +r.total.toFixed(1),
					"max ms": +r.max.toFixed(1),
					// Since the page started loading.
					"first sent s": +(r.first / 1000).toFixed(2),
					"last sent s": +(r.last / 1000).toFixed(2),
				})),
		);
	});
	document.addEventListener("abt:perf-css", () => console.table(timeStylesheets()));
	document.addEventListener("abt:perf-reset", () => {
		stats.clear();
		requests.clear();
		performance.clearMeasures();
	});
}

const PAGE = `${TRANSACTION_TABLE}, ${BUDGET_TABLE}, ${MAIN}`;

/** Median time to restyle `el` from scratch: hidden then shown, then a style-only flush. */
function restyle(el: HTMLElement): number {
	const runs: number[] = [];
	for (let i = 0; i < 5; i++) {
		el.style.display = "none";
		void getComputedStyle(el).display;
		el.style.display = "";
		const start = performance.now();
		void getComputedStyle(el).display;
		runs.push(performance.now() - start);
	}
	return median(runs);
}

function median(values: number[]): number {
	return values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

/** On and off measured in alternation, so drift and warm-up hit both sides alike. */
function compare(el: HTMLElement, sheets: HTMLStyleElement[]): { on: number; off: number } {
	const on: number[] = [];
	const off: number[] = [];
	for (let i = 0; i < 7; i++) {
		sheets.forEach((sheet) => (sheet.disabled = true));
		off.push(restyle(el));
		sheets.forEach((sheet) => (sheet.disabled = false));
		on.push(restyle(el));
	}
	return { on: median(on), off: median(off) };
}

function timeStylesheets() {
	const el = document.querySelector<HTMLElement>(PAGE) ?? document.body;
	const sheets = [...document.querySelectorAll<HTMLStyleElement>('style[id^="ABT-"]')];
	restyle(el);
	const total = compare(el, sheets);
	const rows = sheets.map((sheet) => {
		const { on, off } = compare(el, [sheet]);
		return { sheet: sheet.id.slice(4), "costs ms": +(on - off).toFixed(2) };
	});
	rows.sort((a, b) => b["costs ms"] - a["costs ms"]);
	const target = el.dataset.testid ?? el.getAttribute("role") ?? "body";
	rows.unshift(
		{ sheet: `(restyling ${target}, all ABT sheets on)`, "costs ms": +total.on.toFixed(2) },
		{ sheet: "(all ABT sheets off)", "costs ms": +total.off.toFixed(2) },
	);
	return rows;
}
