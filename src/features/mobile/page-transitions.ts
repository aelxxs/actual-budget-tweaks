import { defineSetting } from "@features/types";
import { MAIN } from "@lib/actual-dom";

// Each page renders its own role="main" body (the header stays mounted), so an animation on it
// plays as each new page appears. A slide or zoom moves the page's fixed bars with it while it runs.
const KEYFRAMES: Record<string, string> = {
	fade: "opacity: 0;",
	slide: "opacity: 0; translate: 0 24px;",
	zoom: "opacity: 0; scale: 0.98;",
};

export const mobilePageTransitions = defineSetting({
	type: "select",
	label: "Page transitions",
	description: "How each page appears as you move between them.",
	group: "Mobile",
	platform: "mobile",
	icon: "layers",
	context: {
		key: "mobile-page-transitions",
		defaultValue: "off",
	},
	options: [
		{ value: "off", label: "Off" },
		{ value: "fade", label: "Fade" },
		{ value: "slide", label: "Slide up" },
		{ value: "zoom", label: "Zoom" },
	],
	css: ({ value }) => {
		const from = KEYFRAMES[value as string];
		if (!from) {
			return "";
		}
		return `
			${MAIN} {
				animation: abt-page-in ${value === "fade" ? "160ms ease-out" : "220ms cubic-bezier(0.2, 0.8, 0.2, 1)"};
			}

			@keyframes abt-page-in {
				from {
					${from}
				}
			}

			@media (prefers-reduced-motion: reduce) {
				${MAIN} {
					animation: none;
				}
			}
		`;
	},
});
