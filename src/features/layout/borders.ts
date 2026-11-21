/** The top bar's border: drawn by the titlebar and the modern page headers so they don't float under it. */
export const NAV_BORDER_CSS = `
	[data-abt-header] {
		border-bottom: 1px solid var(--abt-panel-border);
	}
	.abt-side-drawer-sidebar {
		border-top: none;
		border-top-left-radius: 0px;
	}
`;
