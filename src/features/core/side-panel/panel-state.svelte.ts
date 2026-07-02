/** Live content for the currently mounted side panel — updating this in place avoids tearing down and remounting the panel just to swap its title/body/header. */
export const panelState = $state({
	title: "Side Panel",
	bodyNode: null as Node | null,
	headerNode: null as Node | null,
});
