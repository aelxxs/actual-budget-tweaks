import type { ActualTable, SendMethodMap, TableName } from "@lib/types/actual-schema";

let reqId = 0;

// Retries only until the main-world bridge acks receipt, so a short interval
// can't duplicate a slow in-flight request.
const RETRY_INTERVAL = 100;
const MAX_RETRIES = 150;

function request<T>(event: string, detail: Record<string, unknown>): Promise<T> {
	const id = `abt-api-${++reqId}-${Date.now()}`;
	return new Promise((resolve, reject) => {
		let resolved = false;
		let acked = false;
		let retries = 0;
		let retryTimer: ReturnType<typeof setTimeout> | null = null;

		function onAck(e: Event) {
			const raw = (e as CustomEvent).detail;
			const d = typeof raw === "string" ? JSON.parse(raw) : raw;
			if (d.id !== id) return;
			acked = true;
			document.removeEventListener("abt:api:ack", onAck);
			if (retryTimer) clearTimeout(retryTimer);
			retryTimer = null;
		}

		function onResponse(e: Event) {
			const raw = (e as CustomEvent).detail;
			const d = typeof raw === "string" ? JSON.parse(raw) : raw;
			if (d.id !== id) return;
			resolved = true;
			cleanup();
			if (d.error) reject(new Error(d.error));
			else resolve(d.data as T);
		}

		function dispatch() {
			document.dispatchEvent(new CustomEvent(event, { detail: JSON.stringify({ id, ...detail }) }));
		}

		function retry() {
			if (resolved || acked) return;
			if (++retries >= MAX_RETRIES) {
				cleanup();
				reject(new Error("API bridge timeout"));
				return;
			}
			dispatch();
			retryTimer = setTimeout(retry, RETRY_INTERVAL);
		}

		function cleanup() {
			document.removeEventListener("abt:api:response", onResponse);
			document.removeEventListener("abt:api:ack", onAck);
			if (retryTimer) clearTimeout(retryTimer);
		}

		document.addEventListener("abt:api:response", onResponse);
		document.addEventListener("abt:api:ack", onAck);
		dispatch();
		retryTimer = setTimeout(retry, RETRY_INTERVAL);
	});
}

/**
 * Query an Actual Budget table via the API bridge.
 *
 * @example
 * // Typed via table name — returns Category[]
 * const cats = await query("categories");
 *
 * // Narrowed to specific fields
 * const accounts = await query("accounts", { filter: { tombstone: false } });
 */
export async function query<K extends TableName>(
	table: K,
	options?: {
		filter?: Record<string, unknown>;
		/** Field names, or `{ alias: "payee.name" }` for joined fields. */
		select?: (string | Record<string, string>)[];
		options?: Record<string, unknown>;
	},
): Promise<ActualTable[K][]>;
export async function query<T>(
	table: string,
	options?: {
		filter?: Record<string, unknown>;
		/** Field names, or `{ alias: "payee.name" }` for joined fields. */
		select?: (string | Record<string, string>)[];
		options?: Record<string, unknown>;
	},
): Promise<T>;
export async function query(
	table: string,
	options?: {
		filter?: Record<string, unknown>;
		/** Field names, or `{ alias: "payee.name" }` for joined fields. */
		select?: (string | Record<string, string>)[];
		options?: Record<string, unknown>;
	},
): Promise<unknown> {
	await waitForBudget();
	return request("abt:api:query", {
		table,
		filter: options?.filter,
		select: options?.select,
		options: options?.options,
	});
}

/**
 * Send a command to Actual Budget via the API bridge.
 * Typed overloads for known internal methods.
 *
 * @example
 * const cell = await send("get-cell", { sheetName: "budget202506", name: "available-funds" });
 * cell.value; // AmountInCents
 */
export async function send<M extends keyof SendMethodMap>(
	method: M,
	args: SendMethodMap[M]["args"],
): Promise<SendMethodMap[M]["result"]>;
export async function send<T = unknown>(method: string, args?: unknown): Promise<T>;
export async function send(method: string, args?: unknown): Promise<unknown> {
	await waitForBudget();
	return request("abt:api:send", { method, args });
}

/**
 * Dispatch one of Actual Budget's internal action-creators (e.g. pushModal) via the API bridge.
 *
 * @example
 * await dispatch("pushModal", { modal: { name: "add-account", options: {} } });
 */
export async function dispatch<T = unknown>(action: string, args?: unknown): Promise<T> {
	await waitForBudget();
	return request("abt:api:dispatch", { action, args });
}

/** The open budget's local id, which differs on every device. It's file metadata, so AQL can't read it. */
export async function loadCurrentBudgetId(): Promise<string | undefined> {
	return (await send<{ id?: string }>("load-prefs"))?.id;
}

export interface Toast {
	type?: "message" | "error" | "warning";
	title?: string;
	message: string;
	/** Preformatted details shown under the message. */
	pre?: string;
	sticky?: boolean;
	/** Milliseconds; Actual's default is 6500. */
	timeout?: number;
}

const toastActions = new Map<string, () => unknown>();

function onToastEvent(e: Event) {
	const { key, kind } = JSON.parse((e as CustomEvent).detail);
	const action = toastActions.get(key);
	toastActions.delete(key);
	if (kind === "press") action?.();
}

/**
 * Show one of Actual's own notification toasts, optionally with a button. Resolves to its key,
 * for dismissNotification.
 *
 * @example
 * await notify({ message: "Budget copied" }, { title: "Undo", action: () => send("undo") });
 */
export async function notify(
	toast: Toast,
	button?: { title: string; action: () => unknown },
): Promise<string> {
	await waitForBudget();
	const key = `abt-toast-${++reqId}-${Date.now()}`;
	if (button) {
		if (!toastActions.size) document.addEventListener("abt:api:notify-event", onToastEvent);
		toastActions.set(key, button.action);
		// Actual only reports manual closes, so forget actions once the toast times out.
		if (!toast.sticky) setTimeout(() => toastActions.delete(key), (toast.timeout ?? 6500) + 1000);
	}
	await request("abt:api:notify", { key, notification: toast, button: button?.title });
	return key;
}

/** Removes a toast shown by notify, e.g. one a newer toast replaces. */
export async function dismissNotification(key: string): Promise<void> {
	toastActions.delete(key);
	await dispatch("removeNotification", { id: key });
}

/**
 * Run an aggregate over an Actual table via the API bridge.
 *
 * @example
 * const cleared = await calculate<number>("transactions", { $sum: "$amount" }, {
 *   filter: { account: id, cleared: true },
 *   options: { splits: "none" },
 * });
 */
export async function calculate<T = number>(
	table: string,
	expression: Record<string, unknown>,
	opts?: { filter?: Record<string, unknown>; options?: Record<string, unknown> },
): Promise<T> {
	await waitForBudget();
	return request("abt:api:query", {
		table,
		filter: opts?.filter,
		options: opts?.options,
		calculate: expression,
	});
}

/**
 * Set one of Actual's per-budget local prefs so its UI follows live.
 *
 * @example
 * await setLocalPref("budget.startMonth", "2026-10");
 */
export async function setLocalPref(name: string, value: unknown): Promise<void> {
	await waitForBudget();
	await request("abt:api:local-pref", { name, value });
}

/**
 * Navigate Actual Budget's own router via the API bridge (SPA navigation,
 * not a full page load).
 *
 * @example
 * navigate("/accounts/" + accountId);
 */
/** `path` may also be a history step, like -1 to go back. */
export function navigate(path: string | number, options?: Record<string, unknown>): void {
	document.dispatchEvent(
		new CustomEvent("abt:api:navigate", { detail: JSON.stringify({ path, options }) }),
	);
}

let budgetReadyPromise: Promise<void> | null = null;

/**
 * Resolves once a budget is open (detected via the sidebar's `/budget` link),
 * since `query`/`send` calls made before then have nothing to act on.
 * `query` and `send` already await this internally — most callers won't need
 * to call it directly.
 */
export function waitForBudget(): Promise<void> {
	if (document.querySelector('a[href="/budget"]')) return Promise.resolve();
	if (budgetReadyPromise) return budgetReadyPromise;
	budgetReadyPromise = new Promise((resolve) => {
		const obs = new MutationObserver(() => {
			if (document.querySelector('a[href="/budget"]')) {
				obs.disconnect();
				budgetReadyPromise = null;
				resolve();
			}
		});
		obs.observe(document.body, { childList: true, subtree: true });
	});
	return budgetReadyPromise;
}

export interface ImportResult {
	/** Transactions the bank sync or file import added. */
	added: string[];
	/** Existing transactions it matched. */
	matched: string[];
	/** Accounts whose last bank sync failed. */
	failed: string[];
}

/** Calls back after each bank sync or file import that added or matched transactions. */
export function onImported(callback: (result: ImportResult) => void): () => void {
	const listener = (e: Event) => {
		const raw = (e as CustomEvent).detail;
		callback(typeof raw === "string" ? JSON.parse(raw) : raw);
	};
	document.addEventListener("abt:api:imported", listener);
	return () => document.removeEventListener("abt:api:imported", listener);
}
