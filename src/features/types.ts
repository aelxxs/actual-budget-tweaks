import type { Component } from "svelte";
import type { IconName } from "@lib/icons";

export interface SettingContext {
	key: string;
	defaultValue: unknown;
	[key: string]: unknown;
}

export type SettingType = "select" | "checkbox" | "custom" | "core";

/** Known subgroup labels settings can be grouped under within a section. Add new values here as needed. */
export type SettingGroup = "General" | "Budget" | "Transactions" | "Categories" | "Sidebar" | "Accounts" | "Reports";

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
	/** Runs when the setting is activated; return a cleanup for teardown on deactivate. Omit if `css` alone covers the feature. */
	init?: (ctx: C & { value: unknown }) => Cleanup | Promise<Cleanup>;
	/**
	 * @deprecated legacy per-feature lifecycle management. Omit this and return
	 * a cleanup from `init` instead — the runtime will handle activate/deactivate.
	 */
	onChange?: (value: any, ctx: C) => Promise<void> | void;
}

export interface SelectSetting<C extends SettingContext> extends BaseSetting<C> {
	type: "select";
	options: { value: string; label: string }[];
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
	component?: Component<{ ctx: C }>;
	init: (ctx: C) => Promise<void> | void;
	onChange?: never;
}
export interface CoreSetting {
	type: "core";
	init: () => Promise<void> | void;
}

export type Setting<C extends SettingContext = SettingContext> =
	| SelectSetting<C>
	| CheckboxSetting<C>
	| CustomSetting<C>
	| CoreSetting;

export function defineSetting<C extends SettingContext, S extends Setting<C>>(setting: S & { context: C }): S {
	return setting;
}
