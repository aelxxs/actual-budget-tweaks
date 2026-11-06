import { mount, unmount } from "svelte";
import ToolPopover from "./components/ToolPopover.svelte";
import type { ToolId } from "./types";

let closeOpen: (() => void) | null = null;

/** Opens a tool at a screen position, replacing any tool already open. */
export function openTool(
	toolId: ToolId,
	title: string,
	anchorX: number,
	anchorY: number,
	centered = false,
): void {
	closeOpen?.();
	const container = document.createElement("div");
	container.dataset.abtModal = "tool-popover";
	document.body.appendChild(container);

	const close = () => {
		unmount(instance);
		container.remove();
		closeOpen = null;
	};
	const instance = mount(ToolPopover, {
		target: container,
		props: { toolId, title, anchorX, anchorY, centered, onClose: close },
	});
	closeOpen = close;
}
