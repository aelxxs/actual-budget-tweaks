import { type Component, mount, unmount } from "svelte";

/**
 * Mounts a dialog component on the body, replacing any open dialog with the same key. The
 * component gets an `onClose` that tears it down; the returned function does the same.
 */
export function openDialog<P extends { onClose: () => void }>(
	key: string,
	component: Component<P>,
	props: Omit<P, "onClose">,
): () => void {
	document.querySelectorAll(`[data-abt-modal="${key}"]`).forEach((el) => el.remove());

	const container = document.createElement("div");
	container.dataset.abtModal = key;
	let instance: ReturnType<typeof mount> | null = null;

	const close = () => {
		if (!instance) return;
		unmount(instance);
		instance = null;
		container.remove();
	};

	instance = mount(component, { target: container, props: { ...props, onClose: close } as P });
	document.body.appendChild(container);
	return close;
}
