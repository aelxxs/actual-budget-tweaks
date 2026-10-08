/**
 * Shared `$state` here (rather than component-local) since every row/nav-link
 * across the sidebar uses `use:tooltip`, but only one tooltip bubble is ever
 * rendered, at the Sidebar root.
 */

export type TipPlacement = "right" | "left" | "top" | "bottom";
type TipOpts = { text: string; placement?: TipPlacement };
type Tip = { text: string; x: number; y: number; placement: TipPlacement } | null;

export const tipState: { value: Tip } = $state({ value: null });

let tipTimer: ReturnType<typeof setTimeout> | null = null;
const TIP_DELAY = 320;

function placeTip(el: HTMLElement, o: Required<TipOpts>) {
	const r = el.getBoundingClientRect();
	const gap = 9;
	let x: number;
	let y: number;
	if (o.placement === "right") {
		x = r.right + gap;
		y = r.top + r.height / 2;
	} else if (o.placement === "left") {
		x = r.left - gap;
		y = r.top + r.height / 2;
	} else if (o.placement === "top") {
		x = r.left + r.width / 2;
		y = r.top - gap;
	} else {
		x = r.left + r.width / 2;
		y = r.bottom + gap;
	}
	tipState.value = { text: o.text, x, y, placement: o.placement };
}

function hideTip() {
	if (tipTimer) {
		clearTimeout(tipTimer);
		tipTimer = null;
	}
	tipState.value = null;
}

function normalize(param: string | TipOpts): Required<TipOpts> {
	const partial = typeof param === "string" ? { text: param } : param;
	return { text: partial.text ?? "", placement: partial.placement ?? "right" };
}

export function tooltip(node: HTMLElement, param: string | TipOpts) {
	let o: Required<TipOpts> = normalize(param);
	const enter = () => {
		if (tipTimer) clearTimeout(tipTimer);
		if (!o.text) return;
		tipTimer = setTimeout(() => placeTip(node, o), TIP_DELAY);
	};
	const leave = () => hideTip();
	// A click focuses the button too; only keyboard focus should bring the tip back.
	const focus = () => {
		if (node.matches(":focus-visible") || node.querySelector(":focus-visible")) enter();
	};
	node.addEventListener("pointerenter", enter);
	node.addEventListener("pointerleave", leave);
	node.addEventListener("pointerdown", leave);
	node.addEventListener("focusin", focus);
	node.addEventListener("focusout", leave);
	return {
		update(next: string | TipOpts) {
			o = normalize(next);
		},
		destroy() {
			node.removeEventListener("pointerenter", enter);
			node.removeEventListener("pointerleave", leave);
			node.removeEventListener("pointerdown", leave);
			node.removeEventListener("focusin", focus);
			node.removeEventListener("focusout", leave);
			leave();
		},
	};
}
