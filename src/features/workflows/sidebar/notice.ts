import { applySettingChange } from "@features/runtime";
import { notify } from "@lib/utilities/actual-api";
import { getValue, hasValue, setValue } from "@lib/utilities/store";
import { experimentalSidebar } from "./index";

const SEEN_KEY = "live-sidebar-notice-seen";

async function maybeShow(): Promise<void> {
	const { key } = experimentalSidebar.context;
	// Only people who turned it off; everyone else already has it by default.
	if (!(await hasValue(key)) || (await getValue(key, true))) return;
	if (await getValue(SEEN_KEY, false)) return;
	await notify(
		{
			title: "Try ABT's live sidebar",
			message: "Live balances, account groups, search and shortcuts, in place of Actual's sidebar.",
			sticky: true,
		},
		{ title: "Turn on", action: () => applySettingChange(experimentalSidebar, true) },
	);
	await setValue(SEEN_KEY, true);
}

/** Suggests the live sidebar once to people who have it off. */
export const liveSidebarNotice = {
	type: "core" as const,
	// Not awaited: notify waits for a budget to open, which mustn't hold up the other features.
	init: () => void maybeShow(),
};
