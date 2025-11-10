export interface SettingContext {
	key: string;
	defaultValue: any;
	css?: (value?: any) => string;
	[key: string]: unknown;
	// Additional context fields as needed
}

export type SettingType = "select" | "checkbox";

export interface BaseSetting {
	type: SettingType;
	label: string;
	context: SettingContext;
	init?: (ctx: SettingContext) => Promise<void>;
	onChange?: (value: any, ctx: SettingContext) => Promise<void> | void;
}

export interface SelectSetting extends BaseSetting {
	type: "select";
	options: { value: string; label: string }[];
}

export interface CheckboxSetting extends BaseSetting {
	type: "checkbox";
}

export type Setting = SelectSetting | CheckboxSetting;
