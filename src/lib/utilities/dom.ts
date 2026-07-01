const TOOLBAR_GROUP_SELECTOR = ".css-125dinm";
const TOOLBAR_BTN_CLASS = "css-70zz4x";

export function createToolbarButton(options: {
	id: string;
	title: string;
	icon: SVGSVGElement;
	onClick: (e: MouseEvent) => void;
}): HTMLButtonElement | null {
	if (document.getElementById(options.id)) return null;

	const group = document.querySelector(TOOLBAR_GROUP_SELECTOR);
	if (!group) return null;

	const btn = document.createElement("button");
	btn.id = options.id;
	btn.className = TOOLBAR_BTN_CLASS;
	btn.type = "button";
	btn.title = options.title;
	btn.setAttribute("aria-label", options.title);
	btn.appendChild(options.icon);

	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		options.onClick(e);
	});
	btn.addEventListener("mouseover", () => btn.setAttribute("data-hovered", ""));
	btn.addEventListener("mouseleave", () => btn.removeAttribute("data-hovered"));

	group.appendChild(btn);
	return btn;
}

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

/**
 * Returns a CSS attribute selector string for a `data-testid` attribute.
 *
 * @example
 * dataTestId("my-key") // => '[data-testid="my-key"]'
 */
export function dataTestId(id: string): string {
	return `[data-testid="${id}"]`;
}

/**
 * Creates a MutationObserver that debounces its callback to one call per
 * animation frame. Returns `{ observe, disconnect }` matching the native API.
 */
export function createDebouncedObserver(
	callback: () => void,
	options: MutationObserverInit = { childList: true, subtree: true },
): { observe: (target: Node) => void; disconnect: () => void } {
	let scheduled = false;
	const observer = new MutationObserver(() => {
		if (!scheduled) {
			scheduled = true;
			requestAnimationFrame(() => {
				scheduled = false;
				callback();
			});
		}
	});
	return {
		observe: (target) => observer.observe(target, options),
		disconnect: () => observer.disconnect(),
	};
}

export type DebouncedObserver = ReturnType<typeof createDebouncedObserver>;

export interface WaitForElementOptions {
	/** How many times to retry before giving up. Default: 10 */
	maxRetries?: number;
	/** Milliseconds between retries. Default: 300 */
	interval?: number;
	/** Root element to query within. Default: document */
	root?: ParentNode;
}

/**
 * Polls the DOM until a matching element appears, then resolves with it.
 * Rejects after `maxRetries` attempts.
 */
export function waitForElement(selector: string, options: WaitForElementOptions = {}): Promise<HTMLElement> {
	const { maxRetries = 10, interval = 300, root = document } = options;

	return new Promise((resolve, reject) => {
		let attempts = 0;

		const check = () => {
			const el = root.querySelector<HTMLElement>(selector);
			if (el) {
				resolve(el);
				return;
			}
			attempts++;
			if (attempts >= maxRetries) {
				reject(new Error(`waitForElement: "${selector}" not found after ${maxRetries} attempts`));
				return;
			}
			setTimeout(check, interval);
		};

		check();
	});
}
