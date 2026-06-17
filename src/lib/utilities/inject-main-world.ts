import type { PublicPath } from "wxt/browser";
import { createElement } from "./dom";

export async function injectMainWorldScript(path: string): Promise<void> {
	const id = path.replace(/^\/|\.js$/g, "");

	if (document.getElementById(id)) return;

	const scriptUrl = browser.runtime.getURL(path as unknown as PublicPath);

	const script = createElement("script", {
		id,
		src: scriptUrl,
		async: false,
		type: "module",
	});

	await new Promise<void>((resolve, reject) => {
		script.addEventListener("load", () => resolve(), { once: true });
		script.addEventListener("error", () => reject(new Error(`Failed to inject script: ${path}`)), { once: true });
		(document.head || document.documentElement).appendChild(script);
	});
}
