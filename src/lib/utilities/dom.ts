export function createElement<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options?: Omit<Partial<HTMLElementTagNameMap[K]>, "style"> & { style?: Partial<CSSStyleDeclaration> },
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	const resolvedOptions = (options ?? {}) as Omit<Partial<HTMLElementTagNameMap[K]>, "style"> & {
		style?: Partial<CSSStyleDeclaration>;
	};

	if (resolvedOptions.style) {
		Object.assign(el.style, resolvedOptions.style);
		delete resolvedOptions.style;
	}

	Object.assign(el, resolvedOptions);

	return el;
}

export function applyGlobalCSS(cssText: string, styleId = "global-css"): void {
	const prefixedStyleId = `ABT-${styleId}`;
	let styleTag = document.getElementById(prefixedStyleId) as HTMLStyleElement | null;
	if (!styleTag) {
		styleTag = createElement("style", {
			id: prefixedStyleId,
		});
		document.documentElement.appendChild(styleTag);
	}

	styleTag.textContent = cssText;
	if (styleTag && !cssText.length) {
		styleTag.remove();
	}
}
