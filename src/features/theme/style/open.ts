import { sidepanel } from "@features/core/side-panel";
import { type Mounted, mountToPanelBody } from "@lib/utilities/svelte";
import StylePanel from "./StylePanel.svelte";

// Kept apart from the settings card that opens it, which a settings search can unmount.
let mounted: Mounted | null = null;

export function openStylePanel(): void {
	mounted ??= mountToPanelBody(StylePanel, {});
	sidepanel.open({ title: "Style", bodyNode: mounted.node, key: "theme-style", width: 360 });
}
