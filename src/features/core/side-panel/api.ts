export const SIDEBAR_ATTR = "data-abt-side-drawer-sidebar";

export const PANEL_OPEN_EVENT = "abt:sidepanel:open";
export const PANEL_CLOSE_EVENT = "abt:sidepanel:close";
export const PANEL_DISMISS_EVENT = "abt:sidepanel:dismiss";
export const PANEL_SET_TITLE_EVENT = "abt:sidepanel:set-title";

export type OpenOptions = {
	title?: string;
	bodyNode?: unknown;
	headerNode?: Node | null;
	persist?: boolean;
	/** Suggested initial width in px. Only applied the first time the panel is ever opened — ignored once the user has manually resized it. */
	width?: number;
};

export type SidePanelApi = {
	open: (options?: OpenOptions) => void;
	close: () => void;
	dismiss: () => void;
	setTitle: (title: string) => void;
	isOpen: () => boolean;
};

/**
 * Public side panel API. Dispatches events on `document` rather than calling the
 * feature's internals directly, since the legacy main-world scripts (a separate JS
 * bundle that can't import this module) also drive the panel this same way.
 */
export const sidepanel: SidePanelApi = {
	open: (options) => {
		document.dispatchEvent(new CustomEvent(PANEL_OPEN_EVENT, { detail: options }));
	},
	close: () => {
		document.dispatchEvent(new CustomEvent(PANEL_CLOSE_EVENT));
	},
	dismiss: () => {
		document.dispatchEvent(new CustomEvent(PANEL_DISMISS_EVENT));
	},
	setTitle: (title) => {
		document.dispatchEvent(new CustomEvent(PANEL_SET_TITLE_EVENT, { detail: { title } }));
	},
	isOpen: () => {
		return !!document.querySelector(`[${SIDEBAR_ATTR}]`);
	},
};
