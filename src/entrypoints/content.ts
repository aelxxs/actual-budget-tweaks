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
			if (isContextInvalidated()) return;

			const baseUrl = await getBaseUrl();
			if (!baseUrl || !window.location.href.startsWith(baseUrl)) return;

			// Already mounted — subsequent locationchange events are handled
			// by the route listeners inside each script (pushState patching).
			if (mounted) return;
			mounted = true;

			const [
				{ default: Settings },
				{ scripts, coreScripts },
				{ createElement },
				{ mount, unmount },
				{ bootstrapSettings },
			] = await Promise.all([
				import("@lib/ActualSettings.svelte"),
				import("@features/index"),
				import("@lib/utilities/dom"),
				import("svelte"),
				import("@features/runtime"),
			]);

			let baseCss: string;
			let componentCss: string;
			try {
				baseCss = browser.runtime.getURL("/css/base.css");
				componentCss = browser.runtime.getURL(contentCssPath);
			} catch {
				return; // Extension context invalidated
			}

			document.body.appendChild(
				createElement("link", {
					rel: "stylesheet",
					href: baseCss,
				}),
			);
			document.body.appendChild(
				createElement("link", {
					rel: "stylesheet",
					href: componentCss,
				}),
			);

			await bootstrapSettings([...coreScripts, ...scripts.flat()]);
			const ui = createIntegratedUi(ctx, {
				position: "inline",
				anchor: "[data-testid='settings'] > :nth-child(2)",
				onMount: (container) => {
					const parent = container.parentElement;
					if (parent) {
						parent.replaceChildren();
						return mount(Settings, { target: parent });
					}
				},
				onRemove: (app) => {
					if (app) unmount(app);
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
