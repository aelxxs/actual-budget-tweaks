import { accountIconPicker } from "@features/appearance/account-icon-picker";
import { sidebarSearch } from "@features/appearance/sidebar-search";
import { sidebarShortcuts, sidebarShortcutsAddTile } from "@features/appearance/sidebar-shortcuts";
import ShortcutsEditor from "@features/appearance/sidebar-shortcuts/components/ShortcutsEditor.svelte";
import { colorNegativeBalances } from "@features/readability/color-negative-balances";
import type { Setting } from "@features/types";
import { experimentalSidebar, experimentalSidebarLayout } from "@features/workflows/sidebar";
import GroupsEditor from "@features/workflows/sidebar/components/GroupsEditor.svelte";
import SettingsDialog, { type SettingsTab } from "@lib/components/SettingsDialog.svelte";
import { openDialog } from "@lib/utilities/dialog";

export type SidebarSettingsTab = "general" | "shortcuts" | "groups";

let liveSidebarBudget: string | undefined;

/** The Live sidebar registers its open budget, whose groups the Groups tab edits. */
export function setLiveSidebarBudget(budgetId: string | undefined): void {
	liveSidebarBudget = budgetId;
}

/** Every sidebar setting in one dialog, opened from the live sidebar or its shortcuts bar. */
export function openSidebarSettings({ tab }: { tab?: SidebarSettingsTab } = {}): void {
	const budgetId = liveSidebarBudget;
	// Built on open, not at import: the sidebar features import this module back.
	const tabs: SettingsTab[] = [
		{
			value: "general",
			label: "General",
			groups: [
				{
					heading: "Live sidebar",
					settings: [experimentalSidebar, experimentalSidebarLayout] as Setting[],
				},
				{
					heading: "Appearance",
					settings: [sidebarSearch] as Setting[],
				},
				{
					heading: "Accounts",
					settings: [accountIconPicker, colorNegativeBalances] as Setting[],
				},
			],
		},
		{
			value: "shortcuts",
			label: "Shortcuts",
			bleed: true,
			groups: [{ settings: [sidebarShortcuts, sidebarShortcutsAddTile] as Setting[] }],
			content: { component: ShortcutsEditor },
		},
	];

	if (budgetId) {
		tabs.push({
			value: "groups",
			label: "Groups",
			content: { component: GroupsEditor, props: { budgetId } },
		});
	}

	openDialog("sidebar-settings", SettingsDialog, {
		title: "Sidebar settings",
		tabs,
		initialTab: tab === "groups" && !budgetId ? undefined : tab,
	});
}
