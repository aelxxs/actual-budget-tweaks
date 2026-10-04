export const budgetNav = $state({
	/** "YYYY-MM" keys of the months Actual is showing, in order. */
	months: [] as string[],
	/** Most months that fit, per Actual's titlebar selector. */
	displayMax: 1,
});
