// ── DOM helper ────────────────────────────────────────────────────────
type ElEventHandler = EventListenerOrEventListenerObject;

type ElProps = {
	class?: string;
	style?: Partial<CSSStyleDeclaration>;
	dataset?: Record<string, string>;
	text?: string;
	on?: Record<string, ElEventHandler>;
} & Record<string, unknown>;

type ElChild = Node | string | null | undefined | false;

export function el(tag: string, props?: ElProps | null, children?: ElChild[] | null): HTMLElement {
	const node = document.createElement(tag);
	if (props) {
		for (const k in props) {
			if (k === "class") node.className = String(props[k] ?? "");
			else if (k === "style") Object.assign(node.style, (props.style ?? {}) as Partial<CSSStyleDeclaration>);
			else if (k === "dataset") Object.assign(node.dataset, (props.dataset ?? {}) as Record<string, string>);
			else if (k === "text") node.textContent = String(props[k] ?? "");
			else if (k === "on") {
				for (const ev in props.on) node.addEventListener(ev, props.on[ev]);
			} else node.setAttribute(k, String(props[k]));
		}
	}
	if (children) {
		for (const c of children) {
			if (c == null || c === false) continue;
			node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
		}
	}
	return node;
}
