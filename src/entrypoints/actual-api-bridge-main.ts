// @ts-nocheck
import { createLogger } from "@lib/logger";
import { closestFiber, closestProps, propsUnderRoot } from "@lib/actual/react-fiber";
import {
	ACCOUNT_CELL,
	CATEGORY_CELL,
	CATEGORY_ITEM,
	ROW,
	TRANSACTION_TABLE,
} from "@lib/actual-dom";

const log = createLogger("bridge");

export default defineUnlistedScript(async () => {
	function waitForApi(cb, onFail, retries = 50) {
		if (window.$q && window.$query && window.$send) {
			return cb();
		}
		if (retries <= 0) {
			return onFail();
		}
		setTimeout(() => waitForApi(cb, onFail, retries - 1), 200);
	}

	function waitForActions(cb, onFail, retries = 50) {
		if (window.__actionsForMenu) {
			return cb();
		}
		if (retries <= 0) {
			return onFail();
		}
		setTimeout(() => waitForActions(cb, onFail, retries - 1), 200);
	}

	// The client re-dispatches until acked, so the same id can arrive more than once.
	const accepted = new Set();
	function accept(id) {
		if (accepted.has(id)) {
			return false;
		}
		accepted.add(id);
		document.dispatchEvent(new CustomEvent("abt:api:ack", { detail: JSON.stringify({ id }) }));
		return true;
	}

	// Any script on the page can dispatch these events; a malformed one is ignored, not thrown.
	function parseDetail(e) {
		let detail = e.detail;
		if (typeof detail === "string") {
			try {
				detail = JSON.parse(detail);
			} catch {
				log.warn(`ignored "${e.type}": detail isn't JSON`);
				return {};
			}
		}
		return detail && typeof detail === "object" ? detail : {};
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
		if (!id || !table || !accept(id)) {
			return;
		}

		waitForApi(
			async () => {
				try {
					let q = window.$q(table);
					if (filter) {
						q = q.filter(filter);
					}
					if (options) {
						q = q.options(options);
					}
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
		if (!id || !method || !accept(id)) {
			return;
		}

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

	document.addEventListener("abt:api:cells", (e) => {
		const { id, cells } = parseDetail(e);
		if (!id || !Array.isArray(cells) || !accept(id)) {
			return;
		}

		waitForApi(
			async () => {
				const values = await Promise.all(
					cells.map(([sheetName, name]) =>
						window.$send("get-cell", { sheetName, name }).then(
							(res) => res?.value ?? null,
							() => null,
						),
					),
				);
				respond(id, values, null);
			},
			() => respond(id, null, "Actual API unavailable"),
		);
	});

	document.addEventListener("abt:api:dispatch", (e) => {
		const { id, action, args } = parseDetail(e);
		if (!id || !action || !accept(id)) {
			return;
		}

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
		if (!id || !key || !notification || !accept(id)) {
			return;
		}
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
		if (!id || !name || !accept(id)) {
			return;
		}

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
		const props = root && propsUnderRoot(root, (p) => typeof p.store?.subscribe === "function");
		return props?.store ?? null;
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
			if (state.account?.accountsSyncing?.length) {
				return;
			}
			if (!pending.added.length && !pending.matched.length) {
				return;
			}
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
				// Actual restyles the rows with a class swap, which the shared DOM watcher doesn't see.
				if (tx.newTransactions !== prev.transactions?.newTransactions) {
					requestAnimationFrame(() => {
						document.dispatchEvent(new CustomEvent("abt:api:new-rows-changed"));
					});
				}
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
			if (syncing) {
				return;
			}
			if (wasSyncing || pending.added.length || pending.matched.length) {
				clearTimeout(timer);
				timer = setTimeout(flush, 400);
			}
		});
	}

	// Actual's account view only reloads its table after its own edits; this has it reload after ours.
	// Answers false when the view isn't found, so the caller can fall back.
	document.addEventListener("abt:api:refetch-transactions", (e) => {
		const { id } = parseDetail(e);
		if (!id || !accept(id)) {
			return;
		}
		const table = document.querySelector(TRANSACTION_TABLE);
		const view = table
			? closestFiber(
					table,
					(f) =>
						typeof (f.stateNode as { refetchTransactions?: unknown })?.refetchTransactions ===
						"function",
					150,
				)?.stateNode
			: null;
		if (!view) {
			respond(id, false, null);
			return;
		}
		Promise.resolve(view.refetchTransactions()).then(
			() => respond(id, true, null),
			(err) => respond(id, null, String(err)),
		);
	});

	// Marks the transaction rows Actual shows as new from a sync or import. That's its rows'
	// `added` prop, which lives in React, out of content scripts' reach; its styling is a generated class.
	document.addEventListener("abt:api:mark-new-rows", () => {
		const rows = document.querySelectorAll(`${TRANSACTION_TABLE} ${ROW}`);
		for (const row of rows) {
			const added = !!closestProps(row, (p) => "added" in p)?.added;
			if (added !== row.hasAttribute("data-abt-tx-new")) {
				row.toggleAttribute("data-abt-tx-new", added);
			}
		}
	});

	// Reports privacy mode as Actual's own store has it; no element on the page reliably reflects it.
	function watchPrivacy(store) {
		let last = null;
		const report = () => {
			const on = String(store.getState().prefs?.synced?.isPrivacyEnabled) === "true";
			if (on === last) {
				return;
			}
			last = on;
			document.dispatchEvent(
				new CustomEvent("abt:api:privacy", { detail: JSON.stringify({ on }) }),
			);
		};
		report();
		store.subscribe(report);
	}

	// Reports each synced pref a content script asked for, then every change to it.
	const watchedPrefs = new Map();
	let prefStore = null;
	function reportPref(key) {
		const value = prefStore?.getState().prefs?.synced?.[key] ?? null;
		if (watchedPrefs.get(key) === value) {
			return;
		}
		watchedPrefs.set(key, value);
		document.dispatchEvent(
			new CustomEvent("abt:api:synced-pref", { detail: JSON.stringify({ key, value }) }),
		);
	}
	document.addEventListener("abt:api:synced-pref-request", (e) => {
		const { key } = parseDetail(e);
		if (typeof key === "string") {
			watchedPrefs.set(key, undefined);
			reportPref(key);
		}
	});
	function watchSyncedPrefs(store) {
		prefStore = store;
		const report = () => {
			for (const key of watchedPrefs.keys()) {
				reportPref(key);
			}
		};
		report();
		store.subscribe(report);
	}

	// Reports which accounts are bank-syncing. Actual keeps that only in its store; the result
	// is saved to the accounts table when each finishes.
	function watchSyncing(store) {
		let last = null;
		const report = () => {
			const ids = store.getState().account?.accountsSyncing ?? [];
			const key = ids.join(",");
			if (key === last) {
				return;
			}
			last = key;
			document.dispatchEvent(
				new CustomEvent("abt:api:syncing", { detail: JSON.stringify({ ids }) }),
			);
		};
		report();
		store.subscribe(report);
		// A listener that arrives later asks for the current set.
		document.addEventListener("abt:api:syncing-request", () => {
			last = null;
			report();
		});
	}

	// Reports each of Actual's lists (accounts, categories, payees...) it refetches, which it does
	// after any change to them, from its own UI, a bank sync or another device.
	function watchLists() {
		window.__TANSTACK_QUERY_CLIENT__?.getQueryCache?.().subscribe((event) => {
			const [scope, kind] = event.query?.queryKey ?? [];
			// Budget bounds (actualbudget/actual#9293) grow as months are budgeted; it isn't a list.
			const watched = kind === "lists" || scope === "budget-bounds";
			if (event.type !== "updated" || event.action?.type !== "success" || !watched) {
				return;
			}
			document.dispatchEvent(
				new CustomEvent("abt:api:lists", { detail: JSON.stringify({ scope }) }),
			);
		});
	}

	(function attachStore(retries = 50) {
		const store = findStore();
		if (store) {
			watchImports(store);
			watchPrivacy(store);
			watchSyncing(store);
			watchSyncedPrefs(store);
			// Actual creates its query client before rendering, so it's there once the store is.
			watchLists();
			return;
		}
		if (retries > 0) {
			setTimeout(() => attachStore(retries - 1), 200);
		}
		// Found through React's internals, so an Actual update can hide it; Sync recap and privacy then stop following.
		else {
			log.warn("Couldn't find Actual's store: Sync recap and privacy mode won't update live.");
		}
	})();

	// Actual's lists live in TanStack Query; a write it didn't make itself needs them refetched.
	document.addEventListener("abt:api:invalidate", (e) => {
		const { queryKey } = parseDetail(e);
		window.__TANSTACK_QUERY_CLIENT__?.invalidateQueries?.({ queryKey });
	});

	// Tags each open menu's items with its React key (Actual's own item names), which content
	// scripts can't read; the labels are translated, the keys aren't.
	document.addEventListener("abt:api:mark-menu-keys", () => {
		for (const button of document.querySelectorAll(
			"[data-popover] button:not([data-abt-menu-key])",
		)) {
			const key = closestFiber(button, (f) => typeof f.key === "string", 12)?.key;
			if (key) {
				button.dataset.abtMenuKey = key.replace(/^\.?\$/, "");
			}
		}
	});

	// Tags a cell with the id only React has. Only real id cells have a formatter: transfers' hold
	// display text in `value`, and split parents' hold nothing.
	function tagCell(cell, name, key) {
		const props = closestProps(cell, (p) => p.name === name && "value" in p);
		const id = props?.formatter ? props.value : null;
		if (id) {
			if (cell.dataset[key] !== id) {
				cell.dataset[key] = id;
			}
		} else if (cell.dataset[key]) {
			delete cell.dataset[key];
		}
	}

	document.addEventListener("abt:api:mark-account-ids", () => {
		for (const cell of document.querySelectorAll(ACCOUNT_CELL)) {
			tagCell(cell, "account", "abtAccountId");
		}
	});

	document.addEventListener("abt:api:mark-category-ids", () => {
		for (const cell of document.querySelectorAll(CATEGORY_CELL)) {
			tagCell(cell, "category", "abtCategoryId");
		}
		// Keyed by category, so a row never changes to another one.
		for (const row of document.querySelectorAll(`${CATEGORY_ITEM}:not([data-abt-category-id])`)) {
			const id = closestProps(row, (p) => p.item?.id)?.item.id;
			if (id) {
				row.dataset.abtCategoryId = id;
			}
		}
	});

	document.addEventListener("abt:api:navigate", (e) => {
		const { path, options } = parseDetail(e);
		if (path && typeof window.__navigate === "function") {
			window.__navigate(path, options);
		}
	});

	// Listening now: subscriptions sent before this loaded were lost, so content scripts send them again.
	document.dispatchEvent(new CustomEvent("abt:api:ready"));
});
