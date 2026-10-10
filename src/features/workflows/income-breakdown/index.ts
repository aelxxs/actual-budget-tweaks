import { defineSetting } from "@features/types";
import { injectMainWorldScript } from "@lib/utilities/inject-main-world";

/*
 * The Income Breakdown dashboard widget lives in a legacy script in Actual's own page world
 * (src/lib/main-world/legacy/income-breakdown.ts). It starts and stops on this attribute.
 */
const ON_ATTR = "data-abt-income-breakdown";
const CSS_ID = "abt-income-breakdown-css";

export const incomeBreakdown = defineSetting({
	type: "checkbox",
	label: "Income Breakdown widget",
	description: "Adds an Income Breakdown chart to the Reports dashboard's Add widget menu.",
	group: "Reports",
	icon: "trendingUp",
	context: {
		key: "income-breakdown",
		defaultValue: true,
	},
	init: async () => {
		if (!document.getElementById(CSS_ID)) {
			const link = document.createElement("link");
			link.id = CSS_ID;
			link.rel = "stylesheet";
			link.href = browser.runtime.getURL("/css/income-breakdown.css");
			document.documentElement.appendChild(link);
		}
		document.documentElement.setAttribute(ON_ATTR, "");
		await injectMainWorldScript("/income-breakdown-main.js");
		return () => {
			document.documentElement.removeAttribute(ON_ATTR);
			document.getElementById(CSS_ID)?.remove();
		};
	},
});
