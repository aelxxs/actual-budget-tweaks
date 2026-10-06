// @ts-nocheck
export default defineUnlistedScript(async () => {
	function waitForApi(cb, onFail, retries = 50) {
		if (window.$q && window.$query && window.$send) return cb();
		if (retries <= 0) return onFail();
		setTimeout(() => waitForApi(cb, onFail, retries - 1), 200);
	}

	function waitForActions(cb, onFail, retries = 50) {
		if (window.__actionsForMenu) return cb();
		if (retries <= 0) return onFail();
		setTimeout(() => waitForActions(cb, onFail, retries - 1), 200);
	}

	// The client re-dispatches until acked, so the same id can arrive more than once.
	const accepted = new Set();
	function accept(id) {
		if (accepted.has(id)) return false;
		accepted.add(id);
		document.dispatchEvent(new CustomEvent("abt:api:ack", { detail: JSON.stringify({ id }) }));
		return true;
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
		if (!id || !table || !accept(id)) return;

		waitForApi(
			async () => {
				try {
					let q = window.$q(table);
					if (filter) q = q.filter(filter);
					q = q.select(select || "*");
					const result = await window.$query(q);
					respond(id, result.data || [], null);
				} catch (err) {
					respond(id, [], String(err));
				}
			},
			() => respond(id, [], "Actual API unavailable"),
		);
	});

	document.addEventListener("abt:api:send", (e) => {
		const { id, method, args } = parseDetail(e);
		if (!id || !method || !accept(id)) return;

		waitForApi(
			async () => {
				try {
					const result = await window.$send(method, args);
					respond(id, result, null);
				} catch (err) {
					respond(id, null, String(err));
				}
			},
			() => respond(id, null, "Actual API unavailable"),
		);
	});

	document.addEventListener("abt:api:dispatch", (e) => {
		const { id, action, args } = parseDetail(e);
		if (!id || !action || !accept(id)) return;

		waitForActions(
			async () => {
				try {
					const result = await window.__actionsForMenu[action](args);
					respond(id, result, null);
				} catch (err) {
					respond(id, null, String(err));
				}
			},
			() => respond(id, null, "Actual actions unavailable"),
		);
	});

	// Functions can't cross the bridge, so the toast's button and close report back by event.
	document.addEventListener("abt:api:notify", (e) => {
		const { id, key, notification, button } = parseDetail(e);
		if (!id || !key || !notification || !accept(id)) return;
		const report = (kind) =>
			document.dispatchEvent(
				new CustomEvent("abt:api:notify-event", { detail: JSON.stringify({ key, kind }) }),
			);

		waitForActions(
			async () => {
				try {
					await window.__actionsForMenu.addNotification({
						notification: {
							...notification,
							id: key,
							onClose: () => report("close"),
							...(button && { button: { title: button, action: () => report("press") } }),
						},
					});
					respond(id, null, null);
				} catch (err) {
					respond(id, null, String(err));
				}
			},
			() => respond(id, null, "Actual actions unavailable"),
		);
	});

	// Actual's useLocalPref is usehooks-ts' useLocalStorage, which re-reads on this event.
	document.addEventListener("abt:api:local-pref", (e) => {
		const { id, name, value } = parseDetail(e);
		if (!id || !name || !accept(id)) return;

		waitForApi(
			async () => {
				try {
					const prefs = await window.$send("load-prefs");
					const key = `${prefs.id}-${name}`;
					localStorage.setItem(key, JSON.stringify(value));
					window.dispatchEvent(new StorageEvent("local-storage", { key }));
					respond(id, null, null);
				} catch (err) {
					respond(id, null, String(err));
				}
			},
			() => respond(id, null, "Actual API unavailable"),
		);
	});

	document.addEventListener("abt:api:navigate", (e) => {
		const { path, options } = parseDetail(e);
		if (path && typeof window.__navigate === "function") {
			window.__navigate(path, options);
		}
	});
});
