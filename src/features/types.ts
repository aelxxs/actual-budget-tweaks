import type { Component } from "svelte";
import type { IconName } from "@lib/utilities/icons";

/** Actual's desktop view, its mobile view (below 512px, a separate component tree), or both. */
export type Platform = "desktop" | "mobile" | "all";

export interface SettingContext {
	key: string;
	defaultValue: unknown;
	[key: string]: unknown;
}

export type SettingType = "select" | "checkbox" | "custom" | "core";

/** Known subgroup labels settings can be grouped under within a section. Add new values here as needed. */
export type SettingGroup =
	| "General"
	| "Budget"
	| "Transactions"
	| "Categories"
	| "Sidebar"
	| "Accounts"
	| "Reports"
	| "Mobile";

export type Cleanup = void | (() => void | Promise<void>);

export interface BaseSetting<C extends SettingContext> {
	type: SettingType;
	label: string;
	/** Optional one-line explanation shown under the label wherever this setting is rendered. */
	description?: string;
	/** Optional icon shown before the label wherever this setting is rendered. */
	icon?: IconName;
	/** Optional subgroup label — settings sharing the same group render under one subheading within their section. */
	group?: SettingGroup;
	/** What this tweak can change in the budget, and on which action. Marks it in settings and on the website. */
	writes?: string;
	context: C;
	/** Static/derived CSS applied by the runtime on activate and cleared on deactivate. */
	css?: (ctx: C & { value: unknown }) => string;
	/** Optional mock of the tweak, opened from an eye button on the setting's row. */
	preview?: Component;
	/** Which of Actual's views it runs in; desktop by default, since most features anchor on its markup. */
	platform?: Platform;
	/** Built on To Budget and its envelope cells, so it stands down on tracking budgets. */
	envelopeOnly?: boolean;
	/** Runs when the setting is activated; return a cleanup for teardown on deactivate. Omit if `css` alone covers the feature. */
	init?: (ctx: C & { value: unknown }) => Cleanup | Promise<Cleanup>;
}

export interface SelectSetting<C extends SettingContext> extends BaseSetting<C> {
	type: "select";
	/** An option's `description` replaces the setting's while that option is picked. */
	options: { value: string; label: string; description?: string }[];
	/** Shows the options as a segmented control in place of the dropdown, for a few short labels. */
	segmented?: boolean;
	/** Optional visual picker shown in place of the dropdown; the runtime still applies `css`. */
	picker?: Component<{
		options: { value: string; label: string }[];
		selected: string;
		onPick: (value: string) => void;
	}>;
}

export interface CheckboxSetting<C extends SettingContext> extends BaseSetting<C> {
	type: "checkbox";
}

export interface CustomSetting<C extends SettingContext> {
	type: "custom";
	label: string;
	/** Optional one-line explanation shown under the label wherever this setting is rendered. */
	description?: string;
	/** Optional subgroup label — settings sharing the same group render under one subheading within their section. */
	group?: SettingGroup;
	context: C;
	/** Where it's listed in the settings page; see BaseSetting.platform. */
	platform?: Platform;
	component?: Component<{ ctx: C }>;
	/** The component draws the whole row, label included. */
	bare?: boolean;
	init: (ctx: C) => Promise<void> | void;
}
export interface CoreSetting {
	type: "core";
	init: () => Promise<void> | void;
}

export type Setting<C extends SettingContext = SettingContext> =
	SelectSetting<C> | CheckboxSetting<C> | CustomSetting<C> | CoreSetting;

/**
 * `label`/`description`/`icon`/`group`/`writes` must be plain string literals in the
 * object passed here, not computed expressions — `scripts/generate-features-manifest.mjs`
 * reads them via AST parsing (to build the website's features list without
 * importing Svelte/browser code into a Node script), and a non-literal value
 * comes back empty with no error, silently dropping the setting from that list.
 */
export function defineSetting<C extends SettingContext, S extends Setting<C>>(
	setting: S & { context: C },
): S {
	return setting;
}
