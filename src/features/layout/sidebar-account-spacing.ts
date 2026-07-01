import { defineSetting } from "@features/types";

export const sidebarAccountSpacing = defineSetting({
	type: "select",
	label: "Sidebar Account Spacing",
	options: [
		{ value: ".05rem", label: "Slim" },
		{ value: ".15rem", label: "Normal (Default)" },
		{ value: ".25rem", label: "Relaxed" },
	],
	context: {
		key: "actual-sidebar-account-spacing",
		defaultValue: ".15rem",
	},
	css: (ctx) => `
        /* sidebar -- section title */
        .css-hfi7l9 {
            border-bottom: 2.5px solid var(--ctp-blue);
            padding-bottom: ${ctx.value};
        }

        /* sidebar -- acct title */
        .css-15e1mkk {
            padding-block: ${ctx.value};
        }

        /* sidebar -- small link */
        .css-13d5vlg,
        .css-e5dykp {
            padding-block: .55rem;
        }
	`,
});
