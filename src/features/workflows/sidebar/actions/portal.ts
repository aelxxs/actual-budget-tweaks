// Carries the `.sidebar` class so the --sb-* tokens still cascade;
// `display: contents` (see styles/layout.css) strips its own box so it can't clip
// its children.
let portalRoot: HTMLElement | null = null;

function getPortalRoot(): HTMLElement {
	if (portalRoot?.isConnected) return portalRoot;
	portalRoot = document.createElement("div");
	portalRoot.className = "sidebar sb-portal-root";
	document.body.appendChild(portalRoot);
	return portalRoot;
}

// Reparents a fixed-position overlay (tooltip, context menu) into the
// shared portal root so `.sidebar`'s own `overflow: hidden` can't clip it.
export function portal(node: HTMLElement) {
	getPortalRoot().appendChild(node);
	return {
		destroy() {
			node.remove();
		},
	};
}
