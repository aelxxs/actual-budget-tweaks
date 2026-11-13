import { invalidateQueries, markMenuKeys, query, send } from "@lib/actual/actual-api";

/*
 * The widget is a Text widget whose content is this placeholder, so Actual saves, places and
 * resizes it like its own; ABT draws the chart over it.
 */
export const PLACEHOLDER = "placeholder — extension will render here";
export const DEFAULT_NAME = "Income Breakdown";
const ADD_MENU_KEYS = ["cash-flow-card", "net-worth-card", "markdown-card", "custom-report"];
const OUR_KEY = "income-breakdown";

export interface WidgetRecord {
	id: string;
	type: string;
	x: number;
	y: number;
	dashboard_page_id: string;
	meta: unknown;
}

export interface DashboardPage {
	id: string;
	name: string;
}

function metaOf(record: WidgetRecord): Record<string, unknown> {
	if (typeof record.meta !== "string") {
		return (record.meta as Record<string, unknown>) ?? {};
	}
	try {
		return JSON.parse(record.meta) ?? {};
	} catch {
		return {};
	}
}

export function widgetName(record: WidgetRecord): string {
	return String(metaOf(record).name || DEFAULT_NAME);
}

function currentDashboardId(pages: DashboardPage[]): string | null {
	const match = location.pathname.match(/^\/reports\/([^/?#]+)/);
	return match ? decodeURIComponent(match[1]) : (pages[0]?.id ?? null);
}

export function loadPages(): Promise<DashboardPage[]> {
	return query<DashboardPage[]>("dashboard_pages");
}

/** This dashboard's Income Breakdown widgets, in reading order like their grid items. */
export async function loadWidgets(): Promise<WidgetRecord[]> {
	const [widgets, pages] = await Promise.all([query<WidgetRecord[]>("dashboard"), loadPages()]);
	const dashboardId = currentDashboardId(pages);
	return widgets
		.filter(
			(w) =>
				w.type === "markdown-card" &&
				String(metaOf(w).content ?? "").includes(PLACEHOLDER) &&
				(!dashboardId || w.dashboard_page_id === dashboardId),
		)
		.sort((a, b) => a.y - b.y || a.x - b.x);
}

async function mutate(method: string, args: unknown): Promise<void> {
	await send(method, args);
	invalidateQueries(["dashboards"]);
}

export function renameWidget(record: WidgetRecord, name: string): Promise<void> {
	record.meta = { ...metaOf(record), name };
	return mutate("dashboard-update-widget", { id: record.id, meta: record.meta });
}

export function removeWidget(record: WidgetRecord): Promise<void> {
	return mutate("dashboard-remove-widget", record.id);
}

export function copyWidget(record: WidgetRecord, pageId: string): Promise<void> {
	return mutate("dashboard-copy-widget", { id: record.id, targetDashboardPageId: pageId });
}

async function addWidget(): Promise<void> {
	const dashboardId = currentDashboardId(await loadPages());
	if (!dashboardId) {
		return;
	}
	await mutate("dashboard-add-widget", {
		type: "markdown-card",
		width: 8,
		height: 4,
		meta: { content: PLACEHOLDER, name: DEFAULT_NAME },
		dashboard_page_id: dashboardId,
	});
}

/** Adds "Income Breakdown" after "Text widget" in the dashboard's Add widget menu, once. */
export function extendAddMenu(): void {
	const menus = document.querySelectorAll<HTMLElement>("[data-popover]");
	if (!menus.length) {
		return;
	}
	markMenuKeys();
	for (const menu of menus) {
		const item = (key: string) =>
			menu.querySelector<HTMLButtonElement>(`button[data-abt-menu-key="${key}"]`);
		const anchor = item("markdown-card");
		if (!anchor || item(OUR_KEY) || !ADD_MENU_KEYS.every(item)) {
			continue;
		}
		anchor.after(menuItem(anchor));
	}
}

// A copy of Actual's own item, so it takes its look. Its hover is React state, so it's redrawn here.
function menuItem(template: HTMLButtonElement): HTMLButtonElement {
	const button = template.cloneNode(false) as HTMLButtonElement;
	for (const attr of [...button.attributes]) {
		if (attr.name.startsWith("aria-") || attr.name.startsWith("data-") || attr.name === "id") {
			button.removeAttribute(attr.name);
		}
	}
	button.type = "button";
	button.dataset.abtMenuKey = OUR_KEY;
	button.textContent = DEFAULT_NAME;
	button.addEventListener("pointerenter", () => {
		button.style.backgroundColor = "var(--color-menuItemBackgroundHover)";
		button.style.color = "var(--color-menuItemTextHover)";
	});
	button.addEventListener("pointerleave", () => {
		button.style.removeProperty("background-color");
		button.style.removeProperty("color");
	});
	button.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		// Actual's menu closes on Escape.
		button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		void addWidget();
	});
	return button;
}
