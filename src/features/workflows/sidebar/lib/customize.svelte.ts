import type { Shortcut } from "@features/appearance/sidebar-shortcuts/types";

export type CustomizePane = "main" | "add-shortcut" | "groups";

/** The live sidebar's edit mode, with the Customize panel open beside it. */
export const customizeState = $state({
	editing: false,
	pane: "main" as CustomizePane,
	/** The catalog entry being looked at, drawn translucent at the end of the shortcuts bar. */
	ghost: null as Shortcut | null,
});

export function customizeSidebar({ pane = "main" }: { pane?: CustomizePane } = {}): void {
	customizeState.pane = pane;
	customizeState.editing = true;
}

export function finishCustomizing(): void {
	customizeState.editing = false;
	customizeState.pane = "main";
	customizeState.ghost = null;
}
