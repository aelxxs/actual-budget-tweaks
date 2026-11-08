import { defaultSlots, type SummarySlots } from "./slots";

export const summaryState = $state({
	/** Per month ("budget202609"), bumped when its cells change, so only its views re-read. */
	versions: {} as Record<string, number>,
	/** Which cards fill the row's two middle slots. */
	slots: defaultSlots() as SummarySlots,
});
