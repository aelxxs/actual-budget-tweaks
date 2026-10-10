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
		const { id, table, filter, select, calculate, options } = parseDetail(e);
		if (!id || !table || !accept(id)) return;

		waitForApi(
			async () => {
				try {
					let q = window.$q(table);
					if (filter) q = q.filter(filter);
					if (options) q = q.options(options);
					q = calculate ? q.calculate(calculate) : q.select(select || "*");
					const result = await window.$query(q);
					respond(id, calculate ? result.data : result.data || [], null);
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

	// Actual keeps its Redux store off window; the <Provider> near the React root holds it.
	function findStore() {
		const root = document.getElementById("root");
		const key = root && Object.keys(root).find((k) => k.startsWith("__reactContainer$"));
		const stack = key ? [root[key]] : [];
		for (let i = 0; stack.length && i < 200; i++) {
			const fiber = stack.pop();
			const store = fiber?.memoizedProps?.store;
			if (store && typeof store.subscribe === "function") return store;
			if (fiber?.sibling) stack.push(fiber.sibling);
			if (fiber?.child) stack.push(fiber.child);
		}
		return null;
	}

	// Reports the transactions a bank sync or file import added, once it has finished. Actual
	// appends to newTransactions for the whole session, so only ids not seen before count.
	function watchImports(store) {
		const seen = new Set(store.getState().transactions?.newTransactions ?? []);
		let pending = { added: [], matched: [] };
		let prev = store.getState();
		let timer = null;
		const flush = () => {
			timer = null;
			const state = store.getState();
			if (state.account?.accountsSyncing?.length) return;
			if (!pending.added.length && !pending.matched.length) return;
			const detail = {
				...pending,
				failed: Object.keys(state.account?.failedAccounts ?? {}),
			};
			pending = { added: [], matched: [] };
			document.dispatchEvent(
				new CustomEvent("abt:api:imported", { detail: JSON.stringify(detail) }),
			);
		};
		store.subscribe(() => {
			const state = store.getState();
			const tx = state.transactions;
			if (tx && tx !== prev.transactions) {
				for (const id of tx.newTransactions ?? []) {
					if (!seen.has(id)) {
						seen.add(id);
						pending.added.push(id);
					}
				}
				for (const id of tx.matchedTransactions ?? []) {
					if (!seen.has(id)) {
						seen.add(id);
						pending.matched.push(id);
					}
				}
			}
			const syncing = state.account?.accountsSyncing?.length > 0;
			const wasSyncing = prev.account?.accountsSyncing?.length > 0;
			prev = state;
			// A file import never sets accountsSyncing, so settle briefly before reporting.
			if (syncing) return;
			if (wasSyncing || pending.added.length || pending.matched.length) {
				clearTimeout(timer);
				timer = setTimeout(flush, 400);
			}
		});
	}

	// Marks the transaction rows Actual shows as new from a sync or import. That's its rows'
	// `added` prop, which lives in React, out of content scripts' reach; its styling is a generated class.
	document.addEventListener("abt:api:mark-new-rows", () => {
		const rows = document.querySelectorAll('[data-testid="transaction-table"] [data-testid="row"]');
		for (const row of rows) {
			const key = Object.keys(row).find((k) => k.startsWith("__reactFiber$"));
			let fiber = key ? row[key] : null;
			let added = false;
			for (let i = 0; i < 8 && fiber; i++) {
				const props = fiber.memoizedProps;
				if (props && "added" in props) {
					added = !!props.added;
					break;
				}
				fiber = fiber.return;
			}
			if (added !== row.hasAttribute("data-abt-tx-new"))
				row.toggleAttribute("data-abt-tx-new", added);
		}
	});

	// Reports privacy mode as Actual's own store has it; no element on the page reliably reflects it.
	function watchPrivacy(store) {
		let last = null;
		const report = () => {
			const on = String(store.getState().prefs?.synced?.isPrivacyEnabled) === "true";
			if (on === last) return;
			last = on;
			document.dispatchEvent(
				new CustomEvent("abt:api:privacy", { detail: JSON.stringify({ on }) }),
			);
		};
		report();
		store.subscribe(report);
	}

	(function attachStore(retries = 50) {
		const store = findStore();
		if (store) {
			watchImports(store);
			watchPrivacy(store);
			return;
		}
		if (retries > 0) setTimeout(() => attachStore(retries - 1), 200);
		// Found through React's internals, so an Actual update can hide it; Sync recap and privacy then stop following.
		else
			console.warn(
				"[ABT] Couldn't find Actual's store: Sync recap and privacy mode won't update live.",
			);
	})();

	document.addEventListener("abt:api:navigate", (e) => {
		const { path, options } = parseDetail(e);
		if (path && typeof window.__navigate === "function") {
			window.__navigate(path, options);
		}
	});
});
