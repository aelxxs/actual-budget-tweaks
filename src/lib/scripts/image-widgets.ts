import { getValue, setValue } from "../utilities/store";
import { CheckboxSetting } from "./types";

export const imageWidgets: CheckboxSetting = {
	type: "checkbox",
	label: "Show Images in Report Widgets",
	context: {
		key: "image-widgets",
		defaultValue: true,
	},
	init: async (ctx: { key: "image-widgets"; defaultValue: true }) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (!enabled) return;

		function processContainer(container) {
			const p = container.querySelector("p");
			if (!p) return;

			const oldImg = container.querySelector("img.tampermonkey-widget-image");
			if (oldImg) oldImg.remove();

			const mdImg = p.querySelector("img") || p;
			let url = mdImg.alt || mdImg.textContent || "";
			url = url.trim();
			if (!url) return;
			if (!/^https?:\/\//i.test(url)) url = "https://" + url;

			// GM_xmlhttpRequest({
			// 	method: "GET",
			// 	url,
			// 	responseType: "blob",
			// 	onload: (res) => {
			// 		if (res.status === 200) {
			// 			const img = document.createElement("img");
			// 			img.src = URL.createObjectURL(res.response);
			// 			img.alt = url;
			// 			img.className = "tampermonkey-widget-image";
			// 			img.style.width = "100%";
			// 			img.style.height = "100%";
			// 			img.style.objectFit = "cover";
			// 			img.style.display = "block";

			// 			container.appendChild(img);
			// 			container.style.padding = "0";
			// 			container.style.borderRadius = "var(--border-radius)";
			// 		}
			// 	},
			// 	onerror: (err) => console.error("[Tampermonkey] Image fetch error:", err),
			// });
		}

		function observeContainer(container) {
			const innerObserver = new MutationObserver(() => processContainer(container));
			innerObserver.observe(container, { childList: true, subtree: true });
			container._tampermonkeyObserver = innerObserver;

			processContainer(container);
		}

		// Observe dynamically added containers
		ctx._observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (node.nodeType !== 1) continue;
					if (node.matches && node.matches(".css-u2uvt")) observeContainer(node);
					node.querySelectorAll && node.querySelectorAll(".css-u2uvt").forEach(observeContainer);
				}
			}
		});
		ctx._observer.observe(document.body, { childList: true, subtree: true });
	},
	onChange: async (value: boolean, ctx: { key: "image-widgets"; defaultValue: true }) => {
		await setValue(ctx.key, value);

		// If disabling, remove images and disconnect observers
		if (!value) {
			document.querySelectorAll("img.tampermonkey-widget-image").forEach((img) => img.remove());
			document.querySelectorAll(".css-u2uvt").forEach((container) => {
				if (container._tampermonkeyObserver) {
					container._tampermonkeyObserver.disconnect();
					delete container._tampermonkeyObserver;
				}
			});
		} else {
			// If enabling, rerun init
			if (ctx.init) await ctx.init(ctx);
		}
	},
};
