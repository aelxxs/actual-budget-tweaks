import { mount, unmount, type Component } from "svelte";
import { createElement } from "./dom";

/** A mounted component and its node; `destroy` unmounts it and removes the node. */
export interface Mounted {
	node: HTMLDivElement;
	instance: any;
	destroy: () => void;
}

export function mountToNodeWithReturn<T extends Record<string, unknown>>(
	component: Component<T>,
	props: T,
	node: HTMLDivElement = document.createElement("div"),
): Mounted {
	const instance = mount(component, { target: node, props: props as never });
	return {
		node,
		instance,
		destroy: () => {
			void unmount(instance);
			node.remove();
		},
	};
}

/**
 * Mounts a component as a side panel's `bodyNode`, filling the panel and scrolling inside
 * itself; otherwise the panel's own scroller moves the whole drawer, header included.
 */
export function mountToPanelBody<T extends Record<string, unknown>>(
	component: Component<T>,
	props: T,
): Mounted {
	const node = createElement("div", {
		style: {
			display: "flex",
			flex: "1",
			flexDirection: "column",
			height: "100%",
			minHeight: "0px",
			overflow: "hidden",
		},
	}) as HTMLDivElement;
	return mountToNodeWithReturn(component, props, node);
}
