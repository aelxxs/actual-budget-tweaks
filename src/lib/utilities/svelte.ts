import { mount, type Component } from "svelte";
import { createElement } from "./dom";

export function mountToNode<T extends Record<string, unknown>>(
	component: Component<T>,
	props: T,
	target?: HTMLElement,
): HTMLDivElement;
export function mountToNode(component: Component, props?: undefined, target?: HTMLElement): HTMLDivElement;
export function mountToNode(
	component: Component,
	props?: Record<string, unknown>,
	target?: HTMLElement,
): HTMLDivElement {
	const container =
		target ??
		createElement("div", {
			style: { display: "flex", flex: "1" },
		});
	mount(component, { target: container, props: props as never });
	return container as HTMLDivElement;
}

// utilities/svelte.ts — add:
export function mountToNodeWithReturn<T extends Record<string, unknown>>(
	component: Component<T>,
	props: T,
): { node: HTMLDivElement; instance: any } {
	const node = document.createElement("div");
	const instance = mount(component, { target: node, props: props as never });
	return { node, instance };
}

/**
 * Mounts a component into a container sized/clipped to fill its parent and
 * scroll internally — for content passed as a side panel's `bodyNode`
 * (directly, or via `SidePanelContent` itself). Without this, the panel's
 * own outer scroll container ends up scrolling the whole drawer (header
 * included) instead of just the mounted content's internal scroll region.
 */
export function mountToPanelBody<T extends Record<string, unknown>>(component: Component<T>, props?: T): HTMLDivElement {
	const container = createElement("div", {
		style: {
			display: "flex",
			flex: "1",
			flexDirection: "column",
			height: "100%",
			minHeight: "0px",
			overflow: "hidden",
		},
	});
	return mountToNode(component, props as never, container);
}
