import { isRunning } from "@features/runtime";
import { openThemeStudio } from "@features/theme/studio/open";
import { modernReconcile, reconcileAccount } from "@features/workflows/reconcile";
import { toggleSidebar } from "@features/workflows/sidebar/lib/collapse";
import { openInsights, templatePlan } from "@features/workflows/template-plan";
import { navigate } from "@lib/actual/actual-api";
import { Page, currentAccountId, matchesPage, pagePath } from "@lib/actual/pages";
import type { ShortcutId } from "./bindings.svelte";

interface Action {
	label: string;
	/** Runs it; false when it can't here, so the key goes on to Actual. */
	run: () => boolean;
}

export const ACTIONS: Record<ShortcutId, Action> = {
	sidebar: { label: "Collapse or expand the sidebar", run: toggleSidebar },
	insights: {
		label: "Open Insights",
		run: () => {
			if (!isRunning(templatePlan)) {
				return false;
			}
			openInsights();
			if (!matchesPage(Page.Budget)) {
				navigate(pagePath(Page.Budget));
			}
			return true;
		},
	},
	reconcile: {
		label: "Reconcile this account",
		run: () => {
			const id = currentAccountId();
			if (!id || !isRunning(modernReconcile)) {
				return false;
			}
			reconcileAccount(id);
			return true;
		},
	},
	studio: {
		label: "Open Theme Studio",
		run: () => {
			openThemeStudio();
			return true;
		},
	},
};
