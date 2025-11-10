import "../lib/design/css/base.css";

import Settings from "@/lib/ActualSettings.svelte";
import { scripts } from "@/lib/scripts";
import { getValue } from "@/lib/utilities/store";
import { mount, unmount } from "svelte";

export default defineContentScript({
	matches: ["<all_urls>"],
	main(ctx) {
		async function checkAndMount() {
			const userLink = await getValue("user-link", null);
			console.log({ userLink });
			if (userLink && window.location.href.startsWith(userLink)) {
				for (const setting of scripts.flat()) {
					if (setting.init) {
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
