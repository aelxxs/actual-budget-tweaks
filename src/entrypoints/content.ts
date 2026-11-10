import "@lib/styles/ui.css";
import { settingsAnchor } from "@lib/utilities/settings-page";
import { getBaseUrl } from "@lib/utilities/store";
import type { PublicPath } from "wxt/browser";

const contentCssPath = "/content-scripts/content.css" as unknown as PublicPath;

export default defineContentScript({
	matches: ["<all_urls>"],
	cssInjectionMode: "manual",
	main(ctx) {
		function isContextInvalidated(): boolean {
			try {
				return !browser.runtime?.id;
			} catch {
				return true;
			}
		}

		// Module-level imports of Svelte (and modules that pull it in)
		// trigger Svelte's TrustedTypePolicy registration the moment the
		// content script loads — on every <all_urls> page. Sites with strict
		// trusted-types CSP (e.g. Outlook Web) reject this. Lazy-load
		// everything Svelte-adjacent only after the URL check passes.
		let mounted = false;

		async function checkAndMount() {
			if (isContextInvalidated()) {
				return;
			}

			const baseUrl = await getBaseUrl();
			if (!baseUrl || !window.location.href.startsWith(baseUrl)) {
				return;
			}

			// Already mounted — subsequent locationchange events are handled
			// by the route listeners inside each script (pushState patching).
			if (mounted) {
				return;
			}
			mounted = true;

			const { isAbtEnabled, ABT_ENABLED_KEY } = await import("@lib/utilities/abt-enabled");
			const enabled = await isAbtEnabled();
			// Turning ABT on or off reloads, as core scripts and themes have no teardown.
			function onToggle(changes: Record<string, unknown>, areaName: string) {
				if (areaName === "local" && `local:${ABT_ENABLED_KEY}` in changes) {
					location.reload();
				}
			}
			browser.storage.onChanged.addListener(onToggle);
			ctx.onInvalidated(() => browser.storage.onChanged.removeListener(onToggle));
			if (!enabled) {
				await mountOff();
				return;
			}

			// The bridge's own content script only checks the address at page load, so a page
			// enabled from the popup afterwards would have none; injecting twice is a no-op.
			const { injectMainWorldScript } = await import("@lib/utilities/inject-main-world");
			void injectMainWorldScript("/actual-api-bridge-main.js");

			const [
				{ default: Settings },
				{ scripts, coreScripts },
				{ createElement },
				{ mount, unmount },
				{ bootstrapSettings },
				{ startSettingsSync },
			] = await Promise.all([
				import("@lib/components/ActualSettings.svelte"),
				import("@features/index"),
				import("@lib/utilities/dom"),
				import("svelte"),
				import("@features/runtime"),
				import("@features/settings-sync"),
			]);

			let baseCss: string;
			let componentCss: string;
			try {
				baseCss = browser.runtime.getURL("/css/base.css");
				componentCss = browser.runtime.getURL(contentCssPath);
			} catch {
				return; // Extension context invalidated
			}

			// The sidecar has already linked these in the page it serves.
			const linked = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
				(link) => link.href,
			);
			for (const href of [baseCss, componentCss]) {
				if (!linked.includes(new URL(href, location.href).href)) {
					document.body.appendChild(createElement("link", { rel: "stylesheet", href }));
				}
			}

			// Not awaited: the settings panel only needs to read persisted values
			// from storage to render, not wait for every feature to finish
			// activating. bootstrapSettings uses Promise.all internally, so one
			// feature's slow/hung init() would otherwise block the panel from
			// ever mounting.
			const all = [...coreScripts, ...scripts.flat()];
			bootstrapSettings(all);
			ctx.onInvalidated(startSettingsSync(all));
			const ui = createIntegratedUi(ctx, {
				position: "inline",
				anchor: settingsAnchor,
				onMount: (container) => {
					const parent = container.parentElement;
					if (parent) {
						parent.replaceChildren();
						return mount(Settings, { target: parent });
					}
				},
				onRemove: (app) => {
					if (app) {
						unmount(app);
					}
				},
			});

			ui.autoMount();
		}

		// Off, ABT keeps only its settings tab, which says so and turns it back on.
		async function mountOff() {
			const [{ default: AbtOff }, { settingsTab }, { createElement }, { mount, unmount }] =
				await Promise.all([
					import("@lib/components/AbtOff.svelte"),
					import("@features/core/settings-tab"),
					import("@lib/utilities/dom"),
					import("svelte"),
				]);
			try {
				const href = browser.runtime.getURL(contentCssPath);
				document.body.appendChild(createElement("link", { rel: "stylesheet", href }));
			} catch {
				return;
			}
			ctx.onInvalidated(settingsTab.init());
			const ui = createIntegratedUi(ctx, {
				position: "inline",
				anchor: settingsAnchor,
				onMount: (container) => {
					const parent = container.parentElement;
					if (parent) {
						parent.replaceChildren();
						return mount(AbtOff, { target: parent });
					}
				},
				onRemove: (app) => {
					if (app) {
						unmount(app);
					}
				},
			});
			ui.autoMount();
		}

		checkAndMount();
		ctx.addEventListener(window, "wxt:locationchange", () => {
			checkAndMount();
		});

		// Re-check immediately when the configured Actual URL changes (e.g. saved
		// from the popup), instead of waiting for the next full page reload.
		function handleStorageChange(changes: Record<string, unknown>, areaName: string) {
			if (areaName === "local" && "local:user-link" in changes) {
				checkAndMount();
			}
		}
		browser.storage.onChanged.addListener(handleStorageChange);
		ctx.onInvalidated(() => browser.storage.onChanged.removeListener(handleStorageChange));
	},
});
