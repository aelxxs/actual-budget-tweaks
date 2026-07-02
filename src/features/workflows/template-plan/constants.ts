export type TriggerAction = "apply" | "overwrite" | "apply-single" | "apply-group";

// Menu-item button labels we hook. The app's React layer calls the backend
// via an internal `send()` (not our bridge), so wrapping it misses these —
// we hook the click instead.
export const TRIGGER_LABELS = new Map<string, TriggerAction>([
	["apply budget template", "apply"],
	["apply budget templates", "apply"],
	["overwrite with budget template", "overwrite"],
	["overwrite with budget templates", "overwrite"],
	["apply template", "apply-single"], // single-category context menu
	["overwrite with template", "apply-single"],
	["overwrite with templates", "apply-group"],
]);

export const BREAKDOWN_STORAGE_KEY = "template-plan-breakdown";
export const TAB_STORAGE_KEY = "template-plan-active-tab";
export const PRIO_COLLAPSE_STORAGE_KEY = "template-plan-prio-collapse";
export const SIDE_PANEL_WIDTH = 350;
