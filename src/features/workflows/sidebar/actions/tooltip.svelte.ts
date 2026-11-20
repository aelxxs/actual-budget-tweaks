import { TIP_HINT_ATTR, TIP_KEYS_ATTR, TIP_SIDE_ATTR, TIP_TEXT_ATTR } from "@features/core/tooltip";

type TipPlacement = "right" | "left" | "top" | "bottom";
type TipOpts = {
	text: string;
	placement?: TipPlacement;
	/** A muted second line. */
	hint?: string;
	/** Shortcut keys, space-separated, shown as chips. */
	keys?: string;
};

function apply(node: HTMLElement, param: string | TipOpts) {
	const o = typeof param === "string" ? { text: param } : param;
	const set = (attr: string, value: string | undefined) =>
		value ? node.setAttribute(attr, value) : node.removeAttribute(attr);
	set(TIP_TEXT_ATTR, o.text);
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
			for (const attr of [TIP_TEXT_ATTR, TIP_SIDE_ATTR, TIP_HINT_ATTR, TIP_KEYS_ATTR]) {
				node.removeAttribute(attr);
			}
		},
	};
}
