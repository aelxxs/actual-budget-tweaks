export default defineBackground(() => {
	browser.runtime.onMessage.addListener((message) => {
		if (message.type === "fetch") {
			return fetch(message.url)
				.then(async (res) => {
					if (!res.ok) return { ok: false, status: res.status };
					const text = await res.text();
					const data = message.responseType === "json" ? JSON.parse(text) : text;
					return { ok: true, data };
				})
				.catch(() => ({ ok: false, status: 0 }));
		}
	});
});
