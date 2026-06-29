let reqId = 0;

const RETRY_INTERVAL = 1000;
const MAX_RETRIES = 15;

function request<T>(event: string, detail: Record<string, unknown>): Promise<T> {
	const id = `abt-api-${++reqId}-${Date.now()}`;
	return new Promise((resolve, reject) => {
		let resolved = false;
		let retries = 0;
		let retryTimer: ReturnType<typeof setTimeout> | null = null;

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
			if (resolved) return;
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
			if (retryTimer) clearTimeout(retryTimer);
		}

		document.addEventListener("abt:api:response", onResponse);
		dispatch();
		retryTimer = setTimeout(retry, RETRY_INTERVAL);
	});
}

export async function query<T = unknown[]>(
	table: string,
	options?: { filter?: Record<string, unknown>; select?: string },
): Promise<T> {
	await waitForBudget();
	return request<T>("abt:api:query", { table, filter: options?.filter, select: options?.select });
}

export async function send<T = unknown>(method: string, args?: unknown): Promise<T> {
	await waitForBudget();
	return request<T>("abt:api:send", { method, args });
}

export function navigate(path: string, options?: Record<string, unknown>): void {
	document.dispatchEvent(new CustomEvent("abt:api:navigate", { detail: JSON.stringify({ path, options }) }));
}

let budgetReadyPromise: Promise<void> | null = null;

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
