import type { Theme } from "@lib/design/types";

/** Light, with a dark sidebar. Every text colour meets WCAG AA (4.5:1) on the surfaces it sits on. */
export const daylight = {
	name: "Daylight",
	mode: "light",
	keys: {
		"--ctp-rosewater": "#a14d43",
		"--ctp-flamingo": "#a5404d",
		"--ctp-pink": "#ad2d78",
		"--ctp-mauve": "#6a3fd0",
		"--ctp-red": "#b01b34",
		"--ctp-maroon": "#a8344a",
		"--ctp-peach": "#a14607",
		"--ctp-yellow": "#7a5200",
		"--ctp-green": "#136843",
		"--ctp-teal": "#0b7175",
		"--ctp-sky": "#0a6895",
		"--ctp-sapphire": "#1b6194",
		"--ctp-blue": "#2453c9",
		"--ctp-lavender": "#4f55c4",
		"--ctp-text": "#1d2130",
		"--ctp-subtext1": "#363b4a",
		"--ctp-subtext0": "#454b5c",
		"--ctp-overlay2": "#525969",
		"--ctp-overlay1": "#5d6475",
		"--ctp-overlay0": "#606777",
		"--ctp-surface2": "#b4bac6",
		"--ctp-surface1": "#d0d4dc",
		"--ctp-surface0": "#e4e7ec",
		"--ctp-base": "#f6f7f9",
		"--ctp-mantle": "#ffffff",
		"--ctp-crust": "#eceef2",
	},
	css: `
		:root {
			/* Other months in multi-month view: near-white, a step off the current month's white. */
			--color-budgetOtherMonth: #fbfbfc;
			/* Deep accents wash out at the dark themes' strength. */
			--abt-wash: 22%;
			/* ABT's page accent; the sidebar gets a lifted one below. */
			--abt-accent: var(--ctp-mauve);

			/* A dark sidebar: its colours derive from its background, its accents from the page's. */
			--color-sidebarBackground: #1e1e2e;
			--color-sidebarItemText: oklch(from var(--color-sidebarBackground) 0.97 0.008 h);
			--color-sidebarBudgetName: var(--color-sidebarItemText);
			--color-sidebarHeaderText: var(--color-sidebarItemText);
			--color-sidebarTextSubdued: oklch(from var(--color-sidebarBackground) 0.8 0.02 h);
			--color-sidebarTextMuted: oklch(from var(--color-sidebarBackground) 0.74 0.02 h);
			--color-sidebarBorder: oklch(from var(--color-sidebarBackground) calc(l + 0.08) c h);
			--color-sidebarControlBackground: oklch(from var(--color-sidebarBackground) calc(l + 0.06) c h);
			--color-sidebarItemBackgroundHover: oklch(from var(--color-sidebarBackground) calc(l + 0.07) c h);
			--color-sidebarItemAccentSelected: oklch(from var(--ctp-mauve) 0.78 c h);
			--color-sidebarItemTextSelected: var(--color-sidebarItemAccentSelected);
			--color-sidebarBrand: var(--color-sidebarItemAccentSelected);
			--color-sidebarItemBackgroundSelected: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 18%, transparent);
			--color-sidebarItemTextUpdated: oklch(from var(--ctp-blue) 0.78 c h);
			--color-sidebarItemBackgroundPositive: oklch(from var(--ctp-green) 0.78 c h);
			--color-sidebarTextPositive: var(--color-sidebarItemBackgroundPositive);
			--color-sidebarItemBackgroundFailed: oklch(from var(--ctp-red) 0.72 c h);
			--color-sidebarTextFailed: var(--color-sidebarItemBackgroundFailed);
			--color-sidebarItemBackgroundPending: oklch(from var(--ctp-yellow) 0.82 c h);
		}

		/* Controls sit above the page (light fill, crisp border), not sunk into it. */
		:root,
		.abt-controls-quiet {
			--abt-fill: var(--ctp-base);
			--abt-fill-hover: var(--ctp-surface0);
			--abt-line: var(--ctp-surface1);
		}
	`,
} satisfies Theme;
