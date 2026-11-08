import { defaultSlots, type SummarySlots } from "./slots";

export const summaryState = $state({
	/** Per month ("budget202609"), bumped when its cells change, so only its views re-read. */
	versions: {} as Record<string, number>,
	/** Which cards fill the row's two middle slots. */
	slots: defaultSlots() as SummarySlots,
	/** Summary rows on screen; multi-month views and tracking budgets don't show one. */
	rowsShown: 0,
});

/** Saves the slot choice under the open budget; set while the summary row is on. */
export const slotStore = { save: (_slots: SummarySlots): void => {} };

/** The cards the summary row shows right now, which Insights leaves out or trims to match. */
export const cardsInRow = (): readonly string[] =>
	summaryState.rowsShown > 0 ? summaryState.slots.cards : [];
