let reqId = 0;

function request<T>(event: string, detail: Record<string, unknown>): Promise<T> {
	const id = `abt-api-${++reqId}-${Date.now()}`;
	return new Promise((resolve, reject) => {
		function onResponse(e: Event) {
			const raw = (e as CustomEvent).detail;
			const d = typeof raw === "string" ? JSON.parse(raw) : raw;
			if (d.id !== id) return;
			document.removeEventListener("abt:api:response", onResponse);
			if (d.error) reject(new Error(d.error));
			else resolve(d.data as T);
		}
		document.addEventListener("abt:api:response", onResponse);
		document.dispatchEvent(new CustomEvent(event, { detail: JSON.stringify({ id, ...detail }) }));
		setTimeout(() => {
			document.removeEventListener("abt:api:response", onResponse);
			reject(new Error("API bridge timeout"));
		}, 10000);
	});
}

export function query<T = unknown[]>(
	table: string,
	options?: { filter?: Record<string, unknown>; select?: string },
): Promise<T> {
	return request<T>("abt:api:query", { table, filter: options?.filter, select: options?.select });
}

export function send<T = unknown>(method: string, args?: unknown): Promise<T> {
	return request<T>("abt:api:send", { method, args });
}

export function navigate(path: string, options?: Record<string, unknown>): void {
	document.dispatchEvent(new CustomEvent("abt:api:navigate", { detail: JSON.stringify({ path, options }) }));
}
