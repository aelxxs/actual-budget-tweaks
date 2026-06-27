export default defineBackground(() => {
	browser.runtime.onMessage.addListener((message) => {
		if (message.type === "fetch") {
			const headers: Record<string, string> = {
				"User-Agent": "Mozilla/5.0",
				...(message.headers || {}),
			};
			return fetch(message.url, { headers })
				.then(async (res) => {
					if (!res.ok) return { ok: false, status: res.status };
					const text = await res.text();
					const data = message.responseType === "json" ? JSON.parse(text) : text;
					return { ok: true, data };
				})
				.catch((err) => {
					console.warn("[ABT Background] fetch error", message.url, err);
					return { ok: false, status: 0 };
				});
		}
	});
});
