export const SIDEBAR_ATTR = "data-abt-side-drawer-sidebar";

export const PANEL_OPEN_EVENT = "abt:sidepanel:open";
export const PANEL_CLOSE_EVENT = "abt:sidepanel:close";
export const PANEL_DISMISS_EVENT = "abt:sidepanel:dismiss";
export const PANEL_SET_TITLE_EVENT = "abt:sidepanel:set-title";
export const PANEL_TOP_EVENT = "abt:sidepanel:top";

export type OpenOptions = {
	title?: string;
	bodyNode?: unknown;
	headerNode?: Node | null;
	persist?: boolean;
	/** Opens over the current panel, which comes back when this one closes. */
	stack?: boolean;
	/** Names the panel, so opening the same one again replaces it instead of stacking. */
	key?: string;
	/**
	 * "page" (the default) belongs to the page it opened on and closes when you leave it; "app"
	 * follows you to every page.
	 */
	scope?: "page" | "app";
};

export type SidePanelApi = {
	open: (options?: OpenOptions) => void;
	/** Closes the panel named `key`, wherever it is in the stack; without one, the top panel. */
	close: (key?: string) => void;
	/** Hides the page's panels, keeping a persisted one to come back; app panels stay. */
	dismiss: () => void;
	/** Renames the base page panel, or with a key, that panel wherever it is in the stack. */
	setTitle: (title: string, key?: string) => void;
	/** Whether the drawer is open; with a key, whether that panel is in it, shown or under another. */
	isOpen: (key?: string) => boolean;
	/** Calls back with the key of the panel on top whenever it changes; null once the drawer closes. */
	onTopChange: (listener: (key: string | null) => void) => () => void;
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
	close: (key) => {
		document.dispatchEvent(new CustomEvent(PANEL_CLOSE_EVENT, { detail: { key } }));
	},
	dismiss: () => {
		document.dispatchEvent(new CustomEvent(PANEL_DISMISS_EVENT));
	},
	setTitle: (title, key) => {
		document.dispatchEvent(new CustomEvent(PANEL_SET_TITLE_EVENT, { detail: { title, key } }));
	},
	isOpen: (key) => {
		return !!document.querySelector(
			key ? `[${SIDEBAR_ATTR}] [data-panel="${key}"]` : `[${SIDEBAR_ATTR}]`,
		);
	},
	onTopChange: (listener) => {
		const handler = (event: Event) => listener((event as CustomEvent<string | null>).detail);
		document.addEventListener(PANEL_TOP_EVENT, handler);
		return () => document.removeEventListener(PANEL_TOP_EVENT, handler);
	},
};
