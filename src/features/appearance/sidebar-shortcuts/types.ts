export type ShortcutSize = "small" | "half" | "wide";

export interface Shortcut {
	id: string;
	label: string;
	icon: string;
	url: string;
	type: "external" | "tool" | "widget";
	size: ShortcutSize;
	config?: Record<string, string>;
}

export type ToolId = "calculator" | "currency-converter" | "interest-calculator";
export type WidgetId = "stock-tracker" | "upcoming-schedules" | "rsu-tracker";

export interface BuiltinTool {
	id: ToolId;
	label: string;
	icon: string;
}

export interface BuiltinWidget {
	id: WidgetId;
	label: string;
	icon: string;
}
