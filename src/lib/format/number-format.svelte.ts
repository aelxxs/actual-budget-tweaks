/**
 * How Actual shows amounts, as reactive state: anything that formats an amount while drawing
 * redraws when the user changes these in Actual's settings.
 */
export const numberPrefs = $state({
	// e.g. "comma-dot" (1,234.56) or "apostrophe-dot" (1'234.56).
	format: "comma-dot",
	hideFraction: false,
	/** The budget's currency code, e.g. "USD"; empty when none is set, which shows no symbol. */
	currency: "",
	/** Minor units per whole unit for that currency: 100 for cents, 1 for yen. */
	scale: 100,
});
