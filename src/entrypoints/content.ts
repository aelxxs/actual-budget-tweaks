import Settings from "@/lib/ActualSettings.svelte";
import { scripts } from "@/lib/scripts";
import { createElement } from "@/lib/utilities/dom";
import { getBaseUrl } from "@/lib/utilities/store";
import { mount, unmount } from "svelte";

export default defineContentScript({
	matches: ["<all_urls>"],
	main(ctx) {
		async function checkAndMount() {
			const baseUrl = await getBaseUrl();
			if (baseUrl && window.location.href.startsWith(baseUrl)) {
				const css = browser.runtime.getURL("/css/base.css");

				document.body.appendChild(
					createElement("link", {
						rel: "stylesheet",
						href: css,
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
							parent.innerHTML = "";
							return mount(Settings, { target: parent });
						}
					},
					onRemove: (app) => {
						if (app) unmount(app);
					},
				});

				ui.autoMount();
			}
		}

		checkAndMount();
		ctx.addEventListener(window, "wxt:locationchange", () => {
			checkAndMount();
		});
	},
});
