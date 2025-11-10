import { applyGlobalCSS } from "../utilities/dom";
import { getValue, setValue } from "../utilities/store";
import { CheckboxSetting } from "./types";

export const modernSidebarStates: CheckboxSetting = {
	type: "checkbox",
	label: "Pill Sidebar States",
	context: {
		key: "improvedSidebarStates",
		defaultValue: true,
		css: () => `
            .active {
                background-color: var(--color-sidebarItemBackgroundHover);
            }
            .css-1y6zg9g { margin-top: 15px; }
            .css-3klntp,
            .css-1lwtqiv,
            .css-1y6zg9g,
            .css-1k2zg4y,
            .css-1s4ggjo,
            .css-11jfeu7,
            .css-e5dykp,
            .css-13d5vlg,
            .css-1trtw0g,
            .css-7iovzr {
                font-size: 14px;
                border-radius: var(--border-radius);
                margin-inline: 0.5rem;
                border-left: 0px;
                padding-inline: 1rem;
            }
            .css-1lwtqiv:hover,
            .css-1y6zg9g:hover,
            .css-1s4ggjo:hover,
            .css-e5dykp:hover,
            .css-1trtw0g:hover,
            .css-7iovzr:hover {
                border-radius: var(--border-radius);
            }
            .css-ri4zoe {
                background-color: transparent;
                border: 0px;
                color: inherit;
                padding: 9px 10px 9px 15px;
            }
            .css-u3p89x {
                padding: 9px 10px 9px 15px;
            }
            .css-u3p89x:hover {
                background-color: transparent;
                opacity: 0.75;
            }
            .css-1y6zg9g.active {
                background-color: transparent !important;
            }
            .css-ifjmjt {
                left: 10px !important;
            }
            .css-3klntp,
            .css-1lwtqiv,
            .css-1y6zg9g,
            .css-1k2zg4y,
            .css-1s4ggjo,
            .css-11jfeu7,
            .css-e5dykp,
            .css-13d5vlg,
            .css-1trtw0g,
            .css-7iovzr {
                margin-inline: 0.5rem !important;
            }
        `,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (enabled && ctx.css) applyGlobalCSS(ctx.css(), ctx.key);
	},
	onChange: async (val, ctx) => {
		await setValue(ctx.key, val);
		if (val && ctx.css) {
			applyGlobalCSS(ctx.css(), ctx.key);
		} else {
			const styleTag = document.getElementById(ctx.key);
			if (styleTag) styleTag.remove();
		}
	},
};
