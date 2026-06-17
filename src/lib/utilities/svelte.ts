import { mount, type Component } from "svelte";

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
		(() => {
			const div = document.createElement("div");
			div.style.display = "flex";
			div.style.flex = "1";
			return div;
		})();
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
