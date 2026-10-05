export type SidebarLayout = "standard" | "split";

export const LAYOUT_KEY = "experimental-sidebar-layout-mode";

// Older builds stored "full" / "vscode". Anything unset or unknown gets the default, split.
export function toLayout(value: unknown): SidebarLayout {
	return value === "standard" || value === "full" ? "standard" : "split";
}
