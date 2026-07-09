const CUSTOM_WIDGET_ATTR = "data-abt-custom-dashboard-widget";
const MENU_SELECTOR = "[data-popover]";
const ADD_WIDGET_MENU_KEYS = ["cash-flow-card", "net-worth-card", "markdown-card", "custom-report"] as const;
const MENU_ITEM_HOVER_BACKGROUND =
	"var(--color-menuItemBackgroundHover, var(--color-buttonBareBackgroundHover, rgba(200, 200, 200, .25)))";
const MENU_ITEM_HOVER_TEXT = "var(--color-menuItemTextHover, var(--color-buttonBareTextHover, inherit))";

export interface DashboardWidgetRecord {
	type?: string;
	meta?: unknown;
}

export interface DashboardWidgetPayload {
	type: "markdown-card";
	width: number;
	height: number;
	meta: Record<string, unknown>;
	dashboard_page_id: string;
}

export interface DashboardWidgetDefinition {
	key: string;
	label: string;
	matchesRecord(widget: DashboardWidgetRecord): boolean;
	buildWidgetPayload(dashboardPageId: string): DashboardWidgetPayload;
}

export interface CreateMarkdownWidgetDefinitionArgs {
	key: string;
	label: string;
	placeholderText: string;
	width: number;
	height: number;
	meta?: Record<string, unknown>;
}

export interface EnhanceAddWidgetMenuArgs {
	widgetDefinitions: Array<DashboardWidgetDefinition | null | undefined>;
	onWidgetSelected(definition: DashboardWidgetDefinition): Promise<void> | void;
	dismissNativeMenu?: (anchor: HTMLElement) => void;
	menuSelector?: string;
	logger?: Pick<Console, "error">;
}

function parseMeta(meta: unknown): Record<string, unknown> {
	if (!meta) return {};
	if (typeof meta === "string") {
		try {
			return (JSON.parse(meta) as Record<string, unknown>) || {};
		} catch {
			return {};
		}
	}
	return typeof meta === "object" && meta !== null ? (meta as Record<string, unknown>) : {};
}

export function createMarkdownWidgetDefinition({
	key,
	label,
	placeholderText,
	width,
	height,
	meta = {},
}: CreateMarkdownWidgetDefinitionArgs): DashboardWidgetDefinition {
	return {
		key,
		label,
		matchesRecord(widget) {
			const widgetMeta = parseMeta(widget?.meta);
			return widget?.type === "markdown-card" && String(widgetMeta.content || "").includes(placeholderText);
		},
		buildWidgetPayload(dashboardPageId) {
			return {
				type: "markdown-card",
				width,
				height,
				meta: {
					...meta,
					content: placeholderText,
					name: label,
				},
				dashboard_page_id: dashboardPageId,
			};
		},
	};
}

// Reads React's internal fiber pointer off the DOM element directly. This
// works from an isolated-world content script because content scripts share
// the actual DOM node objects with the page (only the page's own JS
// globals/closures are off-limits) — no main-world bridge needed.
function getReactFiber(element: HTMLElement) {
	const key = Object.keys(element).find(
		(name) => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"),
	);
	return key ? (element as HTMLElement & Record<string, unknown>)[key] : null;
}

function normalizeReactKey(key: unknown): string | null {
	if (typeof key !== "string") return null;
	return key.replace(/^\.\$/, "").replace(/^\$/, "");
}

export function getNativeMenuItemName(button: HTMLElement): string | null {
	let fiber = getReactFiber(button);
	while (fiber) {
		const key = normalizeReactKey((fiber as { key?: unknown }).key);
		if (key) return key;
		fiber = (fiber as { return?: unknown }).return ?? null;
	}
	return null;
}

function isVisibleButton(button: HTMLButtonElement): boolean {
	const style = window.getComputedStyle?.(button);
	return !button.disabled && style?.display !== "none" && style?.visibility !== "hidden";
}

function getMenuButtons(menu: Element): HTMLButtonElement[] {
	return Array.from(menu.querySelectorAll("button")).filter(isVisibleButton);
}

function getButtonByMenuItemName(menu: Element, itemName: string): HTMLButtonElement | undefined {
	return getMenuButtons(menu).find((button) => getNativeMenuItemName(button) === itemName);
}

function isDashboardAddWidgetMenu(menu: Element): boolean {
	const itemNames = new Set(getMenuButtons(menu).map(getNativeMenuItemName).filter(Boolean));
	return ADD_WIDGET_MENU_KEYS.every((key) => itemNames.has(key));
}

function removeClonedButtonState(button: HTMLButtonElement) {
	[
		"id",
		"aria-controls",
		"aria-describedby",
		"aria-expanded",
		"aria-labelledby",
		"data-focused",
		"data-focus-visible",
		"data-hovered",
		"data-pressed",
		"disabled",
	].forEach((attr) => button.removeAttribute(attr));
}

function bindMenuButtonInteractionState(button: HTMLButtonElement) {
	const normalBackground = button.style.backgroundColor;
	const normalColor = button.style.color;

	function setHovered() {
		button.setAttribute("data-hovered", "");
		button.style.backgroundColor = MENU_ITEM_HOVER_BACKGROUND;
		button.style.color = MENU_ITEM_HOVER_TEXT;
	}

	function clearHovered() {
		button.removeAttribute("data-hovered");
		button.removeAttribute("data-pressed");
		button.style.backgroundColor = normalBackground;
		button.style.color = normalColor;
	}

	function setPressed() {
		button.setAttribute("data-pressed", "");
	}

	function clearPressed() {
		button.removeAttribute("data-pressed");
	}

	button.addEventListener("pointerenter", setHovered);
	button.addEventListener("pointerleave", clearHovered);
	button.addEventListener("pointerdown", setPressed);
	button.addEventListener("pointerup", clearPressed);
	button.addEventListener("pointercancel", clearPressed);
	button.addEventListener("focus", () => button.setAttribute("data-focused", ""));
	button.addEventListener("blur", () => {
		button.removeAttribute("data-focused");
		clearHovered();
	});
	button.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") setPressed();
	});
	button.addEventListener("keyup", clearPressed);
}

function createCustomMenuButton(
	templateButton: HTMLButtonElement,
	widgetDefinition: DashboardWidgetDefinition,
	onSelect: (definition: DashboardWidgetDefinition, button: HTMLButtonElement) => Promise<void> | void,
	logger?: Pick<Console, "error">,
): HTMLButtonElement {
	const button = templateButton.cloneNode(false) as HTMLButtonElement;
	removeClonedButtonState(button);
	button.type = "button";
	button.dataset.abtCustomDashboardWidget = widgetDefinition.key;
	button.replaceChildren();

	const label = document.createElement("span");
	label.textContent = widgetDefinition.label;
	label.title = widgetDefinition.label;
	button.appendChild(label);

	const spacer = document.createElement("span");
	spacer.style.flex = "1";
	button.appendChild(spacer);

	button.addEventListener("click", async (event) => {
		event.preventDefault();
		event.stopPropagation();
		try {
			await onSelect(widgetDefinition, button);
		} catch (err) {
			logger?.error?.("[ABT Dashboard Widgets] Failed to add custom widget:", err);
		}
	});

	bindMenuButtonInteractionState(button);
	return button;
}

export function enhanceAddWidgetMenu({
	widgetDefinitions,
	onWidgetSelected,
	dismissNativeMenu,
	menuSelector = MENU_SELECTOR,
	logger = console,
}: EnhanceAddWidgetMenuArgs) {
	if (!Array.isArray(widgetDefinitions) || typeof onWidgetSelected !== "function") {
		return;
	}

	Array.from(document.querySelectorAll(menuSelector))
		.filter(isDashboardAddWidgetMenu)
		.forEach((menu) => {
			let anchor = getButtonByMenuItemName(menu, "markdown-card");
			if (!anchor) return;

			widgetDefinitions.forEach((widgetDefinition) => {
				if (!widgetDefinition?.key || !widgetDefinition?.label) return;
				if (menu.querySelector(`[${CUSTOM_WIDGET_ATTR}="${widgetDefinition.key}"]`)) return;

				const button = createCustomMenuButton(
					anchor!,
					widgetDefinition,
					async (definition, menuButton) => {
						dismissNativeMenu?.(menuButton);
						await onWidgetSelected(definition);
					},
					logger,
				);
				anchor!.insertAdjacentElement("afterend", button);
				anchor = button;
			});
		});
}
