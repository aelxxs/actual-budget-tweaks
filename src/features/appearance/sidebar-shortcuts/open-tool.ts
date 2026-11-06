import { getValue, setValue } from "@lib/utilities/store";
import { mount, unmount } from "svelte";
import ToolPopover from "./components/ToolPopover.svelte";
import type { ToolId } from "./types";

type Positions = Partial<Record<ToolId, { x: number; y: number }>>;

const POSITIONS_KEY = "abt-tool-positions";

let openId: ToolId | null = null;
let closeOpen: (() => void) | null = null;

export const isToolOpen = (toolId: ToolId) => openId === toolId;

export function closeTool(): void {
	closeOpen?.();
}

/**
 * Opens a tool where it was last left, or else at a screen position, replacing any tool already
 * open. `centered` treats `anchorX` as the tool's middle.
 */
export async function openTool(
	toolId: ToolId,
	title: string,
	anchorX: number,
	anchorY: number,
	centered = false,
): Promise<void> {
	closeTool();
	const positions = (await getValue<Positions>(POSITIONS_KEY, {})) ?? {};
	closeTool();
	const saved = positions[toolId];

	const container = document.createElement("div");
	container.dataset.abtModal = "tool-popover";
	document.body.appendChild(container);

	const close = () => {
		if (closeOpen !== close) {
			return;
		}
		closeOpen = null;
		openId = null;
		unmount(instance);
		container.remove();
	};
	const instance = mount(ToolPopover, {
		target: container,
		props: {
			toolId,
			title,
			anchorX: saved?.x ?? anchorX,
			anchorY: saved?.y ?? anchorY,
			centered: !saved && centered,
			onClose: close,
			onMoved: (x: number, y: number) =>
				void setValue(POSITIONS_KEY, { ...positions, [toolId]: { x, y } }),
		},
	});
	closeOpen = close;
	openId = toolId;
}
