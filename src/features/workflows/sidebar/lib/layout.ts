export type SidebarLayout = "standard" | "split";

export const LAYOUT_KEY = "experimental-sidebar-layout-mode";

// Older builds stored "full" / "vscode".
export function toLayout(value: unknown): SidebarLayout {
	return value === "split" || value === "vscode" ? "split" : "standard";
}
