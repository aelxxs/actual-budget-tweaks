// @ts-nocheck
export default defineUnlistedScript(async () => {
	function waitForApi(cb, retries = 50) {
		if (window.$q && window.$query && window.$send) return cb();
		if (retries <= 0) return;
		setTimeout(() => waitForApi(cb, retries - 1), 200);
	}

	function parseDetail(e) {
		const raw = e.detail;
		return typeof raw === "string" ? JSON.parse(raw) : raw;
	}

	function respond(id, data, error) {
		document.dispatchEvent(
			new CustomEvent("abt:api:response", {
				detail: JSON.stringify({ id, data, error }),
			}),
		);
	}

	document.addEventListener("abt:api:query", (e) => {
		const { id, table, filter, select } = parseDetail(e);
		if (!id || !table) return;

		waitForApi(async () => {
			try {
				let q = window.$q(table);
				if (filter) q = q.filter(filter);
				q = q.select(select || "*");
				const result = await window.$query(q);
				respond(id, result.data || [], null);
			} catch (err) {
				respond(id, [], String(err));
			}
		});
	});

	document.addEventListener("abt:api:send", (e) => {
		const { id, method, args } = parseDetail(e);
		if (!id || !method) return;

		waitForApi(async () => {
			try {
				const result = await window.$send(method, args);
				respond(id, result, null);
			} catch (err) {
				respond(id, null, String(err));
			}
		});
	});

	document.addEventListener("abt:api:navigate", (e) => {
		const { path, options } = parseDetail(e);
		if (path && typeof window.__navigate === "function") {
			window.__navigate(path, options);
		}
	});
});
