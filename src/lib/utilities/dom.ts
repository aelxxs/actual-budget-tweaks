function createElement<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options: Partial<HTMLElementTagNameMap[K]> & { style?: Partial<CSSStyleDeclaration> } = {}
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);

	if (options.style) {
		Object.assign(el.style, options.style);
		delete options.style;
	}

	Object.assign(el, options);

	return el;
}

export function applyGlobalCSS(cssText: string, styleId = "global-css"): void {
	let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;
	if (!styleTag) {
		styleTag = createElement("style", {
			id: styleId,
		});
		document.documentElement.appendChild(styleTag);
	}

	styleTag.textContent = cssText;
	if (styleTag && !cssText.length) {
		styleTag.remove();
	}
}
