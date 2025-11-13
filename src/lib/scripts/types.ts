export interface SettingContext {
	key: string;
	defaultValue: unknown;
	[key: string]: unknown;
}

export type SettingType = "select" | "checkbox";

export interface BaseSetting<C extends SettingContext> {
	type: SettingType;
	label: string;
	context: C;
	init: (ctx: C) => Promise<void> | void;
	onChange: (value: any, ctx: C) => Promise<void> | void;
}

export interface SelectSetting<C extends SettingContext> extends BaseSetting<C> {
	type: "select";
	options: { value: string; label: string }[];
	onChange: (value: C["defaultValue"], ctx: C) => Promise<void> | void;
}

export interface CheckboxSetting<C extends SettingContext> extends BaseSetting<C> {
	type: "checkbox";
	onChange: (value: boolean, ctx: C) => Promise<void> | void;
}

export type Setting<C extends SettingContext = SettingContext> = SelectSetting<C> | CheckboxSetting<C>;

export function defineSetting<C extends SettingContext, S extends Setting<C>>(setting: S & { context: C }): S {
	return setting;
}
