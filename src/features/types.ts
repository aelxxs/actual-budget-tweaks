import type { Component } from "svelte";
import type { IconName } from "@lib/icons";

export interface SettingContext {
	key: string;
	defaultValue: unknown;
	[key: string]: unknown;
}

export type SettingType = "select" | "checkbox" | "custom" | "core";

/** Known subgroup labels settings can be grouped under within a section. Add new values here as needed. */
export type SettingGroup =
	"General" | "Budget" | "Transactions" | "Categories" | "Sidebar" | "Accounts" | "Reports";

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
	context: C;
	/** Static/derived CSS applied by the runtime on activate and cleared on deactivate. */
	css?: (ctx: C & { value: unknown }) => string;
	/** Optional mock of the tweak, opened from an eye button on the setting's row. */
	preview?: Component;
	/** Also runs in Actual's mobile view. Off by default: most features anchor on desktop markup. */
	mobile?: boolean;
	/** Runs when the setting is activated; return a cleanup for teardown on deactivate. Omit if `css` alone covers the feature. */
	init?: (ctx: C & { value: unknown }) => Cleanup | Promise<Cleanup>;
}

export interface SelectSetting<C extends SettingContext> extends BaseSetting<C> {
	type: "select";
	options: { value: string; label: string }[];
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
	/** Shown in Actual's mobile view; see BaseSetting.mobile. */
	mobile?: boolean;
	component?: Component<{ ctx: C }>;
	init: (ctx: C) => Promise<void> | void;
}
export interface CoreSetting {
	type: "core";
	init: () => Promise<void> | void;
}

export type Setting<C extends SettingContext = SettingContext> =
	SelectSetting<C> | CheckboxSetting<C> | CustomSetting<C> | CoreSetting;

/**
 * `label`/`description`/`icon`/`group` must be plain string literals in the
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
