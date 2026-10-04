export const summaryState = $state({
	/** Per month ("budget202609"), bumped when its cells change, so only its views re-read. */
	versions: {} as Record<string, number>,
});
