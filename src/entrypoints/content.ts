import { getBaseUrl } from "@/lib/utilities/store";

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
		async function checkAndMount() {
			if (isContextInvalidated()) return;

			const baseUrl = await getBaseUrl();
			if (!baseUrl || !window.location.href.startsWith(baseUrl)) return;

			const [
				{ default: Settings },
				{ scripts },
				{ createElement },
				{ mount, unmount },
			] = await Promise.all([
				import("@/lib/ActualSettings.svelte"),
				import("@/lib/scripts"),
				import("@/lib/utilities/dom"),
				import("svelte"),
			]);

			let baseCss: string;
			let componentCss: string;
			try {
				baseCss = browser.runtime.getURL("/css/base.css");
				componentCss = browser.runtime.getURL(
					"/content-scripts/content.css"
				);
			} catch {
				return; // Extension context invalidated
			}

			document.body.appendChild(
				createElement("link", {
					rel: "stylesheet",
					href: baseCss,
				})
			);
			document.body.appendChild(
				createElement("link", {
					rel: "stylesheet",
					href: componentCss,
				})
			);

			for (const setting of scripts.flat()) {
				if (setting.init) {
					// @ts-ignore -- TODO: fix this type error
					setting.init(setting.context);
				}
			}

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
	},
});
