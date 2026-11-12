import { TIP_HINT_ATTR, TIP_KEYS_ATTR, TIP_SIDE_ATTR } from "@features/core/tooltip";

export type TipPlacement = "right" | "left" | "top" | "bottom";
type TipOpts = {
	text: string;
	placement?: TipPlacement;
	/** A muted second line. */
	hint?: string;
	/** Shortcut keys, space-separated, shown as chips. */
	keys?: string;
};

// ABT's tooltip (core/tooltip.ts) reads these, as it does every `title` on the page.
const ORIG_TITLE_ATTR = "data-abt-title";

function apply(node: HTMLElement, param: string | TipOpts) {
	const o = typeof param === "string" ? { text: param } : param;
	// While its tooltip shows, the title waits in data-abt-title; a changed text goes there too.
	const titleAttr = node.hasAttribute(ORIG_TITLE_ATTR) ? ORIG_TITLE_ATTR : "title";
	if (o.text) {
		node.setAttribute(titleAttr, o.text);
	} else {
		node.removeAttribute(titleAttr);
	}
	const set = (attr: string, value: string | undefined) =>
		value ? node.setAttribute(attr, value) : node.removeAttribute(attr);
	set(TIP_SIDE_ATTR, o.placement ?? "right");
	set(TIP_HINT_ATTR, o.hint);
	set(TIP_KEYS_ATTR, o.keys);
}

export function tooltip(node: HTMLElement, param: string | TipOpts) {
	apply(node, param);
	return {
		update(next: string | TipOpts) {
			apply(node, next);
		},
		destroy() {
			for (const attr of ["title", ORIG_TITLE_ATTR, TIP_SIDE_ATTR, TIP_HINT_ATTR, TIP_KEYS_ATTR]) {
				node.removeAttribute(attr);
			}
		},
	};
}
