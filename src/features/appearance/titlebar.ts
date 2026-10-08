import { defineSetting } from "@features/types";
import { type IconName, icon } from "@lib/icons";
import { watchDom } from "@lib/utilities/dom-watcher";

/*
 * Adapter CSS for Actual's titlebar cluster (uncategorized, privacy, notifications, sync,
 * server status, help). Its buttons carry translated labels, so they're told apart by
 * structure instead. Tooltips wrap their button in a div; Help has a test id, the sync icon sits
 * in a spinning wrapper, and the uncategorized link (no tooltip, so unwrapped) and the server
 * status (inside a View) are the text-only buttons.
 */
const BAR_ATTR = "data-abt-titlebar";
// Marked in JS: as a :has() anchor, Firefox tested it up the tree from every button with an svg
// in the transaction rows, and blanked the table while restyling on fast scroll.
const BAR = `[${BAR_ATTR}]`;
const HELP = `${BAR} > div > [data-testid="help-menu-button"]`;
const UNCATEGORIZED = `${BAR} > button:not(:has(svg))`;
const STATUS = `${BAR} > div > div > button:not(:has(svg))`;
// While syncing, Actual swaps the status for a bare "Connecting…" that fades in after a delay.
const CONNECTING = `${BAR} > span`;
const SYNC = `${BAR} > div > button:has(> div > svg)`;
const ONLINE = `${BAR}:has(> div > button:not([aria-disabled="true"]) > div > svg)`;

function mask(name: IconName): string {
	const svg = icon(name, { size: 24 }).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Swaps a native glyph for ours by masking the svg itself, so React keeps owning its nodes.
function swap(button: string, name: IconName): string {
	return `
		${button} svg {
			background: currentColor;
			mask: ${mask(name)} center / contain no-repeat;
		}
		${button} svg > * {
			display: none;
		}
	`;
}

const CSS = `
	${BAR} {
		gap: var(--abt-space-2) !important;
	}

	/* Actions stay on the left; the bell and Help move to the end, behind a divider. */
	${BAR}::before {
		content: "";
		order: 1;
		width: 1px;
		height: 16px;
		/* Wider on the right to match the space the status chip's min-width leaves on the left. */
		margin-inline: var(--abt-space-2) var(--abt-space-4);
		background: var(--abt-line);
	}

	${BAR} > div:has([data-testid="notifications-button"]),
	${BAR} > div:has(> [data-testid="help-menu-button"]) {
		order: 2;
	}

	${BAR} button:has(svg) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border-radius: var(--abt-radius);
		color: var(--abt-muted);
	}

	${BAR} button:has(svg)[data-hovered] {
		background: var(--abt-fill-hover);
		color: var(--color-pageText);
	}

	${BAR} button:has(svg) svg {
		width: 16px;
		height: 16px;
	}

	${SYNC} svg {
		width: 15px;
		height: 15px;
	}

	/* Help keeps its label for screen readers via the button, but shows only the icon. */
	${HELP} {
		gap: 0 !important;
		font-size: 0;
	}

	${swap(`${BAR} button:has(path[d^="M.2 10a11"])`, "eye")}
	${swap(`${BAR} button:has(path[d^="m12.81 4.36"])`, "eyeOff")}
	${swap(`${BAR} [data-testid="notifications-button"]`, "bell")}
	${swap(SYNC, "refreshCw")}
	${swap(HELP, "helpCircle")}

	[data-testid="notifications-unseen-count"] {
		top: 1px !important;
		right: 0 !important;
		min-width: 14px !important;
		height: 14px !important;
		padding: 0 3px !important;
		line-height: 14px !important;
		font-size: 9px !important;
	}

	${UNCATEGORIZED},
	${STATUS},
	${CONNECTING} {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 24px;
		padding: 0 var(--abt-space-3);
		border-radius: 999px;
		font-size: var(--abt-text-md);
		font-weight: 500;
	}

	${UNCATEGORIZED}::before,
	${STATUS}::before,
	${CONNECTING}::before {
		content: "";
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}

	${UNCATEGORIZED} {
		margin-right: var(--abt-space-4);
		/* Actual's bare-button hover would swap the red for its default text colour. */
		color: var(--color-errorText) !important;
		background: color-mix(in srgb, var(--color-errorText) 12%, transparent) !important;
	}

	${UNCATEGORIZED}[data-hovered] {
		background: color-mix(in srgb, var(--color-errorText) 20%, transparent) !important;
	}

	/*
	 * The pill sits on the titlebar's otherwise empty left side, after whatever page content
	 * Actual puts there. The cluster grows (out-weighing Actual's flex: 1 spacer) and stays
	 * right-aligned; the pill's auto margin takes it to the far left.
	 */
	${BAR} {
		flex: 1000 1 auto;
		justify-content: flex-end;
	}

	${UNCATEGORIZED} {
		order: -1;
		margin-right: auto;
	}

	${STATUS},
	${CONNECTING} {
		/* Fits "Server online", "Server offline" and "Connecting…", so swapping between them doesn't
		   nudge the row; min-width rather than width so longer translations aren't clipped. */
		min-width: 116px;
		box-sizing: border-box;
		justify-content: flex-start !important;
		color: var(--abt-muted);
	}

	/* Shown at once, so the chip doesn't blink out for the length of the sync. */
	${CONNECTING} {
		font-style: normal !important;
		opacity: 1 !important;
		animation: none !important;
	}

	${CONNECTING}::before {
		background: var(--color-warningText);
		animation: abt-titlebar-pulse 0.8s ease-in-out infinite alternate;
	}

	@keyframes abt-titlebar-pulse {
		to {
			opacity: 0.3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		${CONNECTING}::before {
			animation: none;
		}
	}

	${STATUS}[data-hovered] {
		background: var(--abt-fill-hover);
		color: var(--color-pageText);
	}

	/* Offline, sync errors, and local-only files all fall back to the warning dot. */
	${STATUS}::before {
		background: var(--color-warningText);
	}

	${ONLINE} > div > div > button:not(:has(svg))::before {
		background: var(--color-noticeTextLight);
	}
`;

export const modernTitlebar = defineSetting({
	type: "checkbox",
	label: "Modern Titlebar",
	description: "Restyles the top bar's buttons with matching icons and status chips.",
	group: "General",
	icon: "layout",
	context: {
		key: "modern-titlebar",
		defaultValue: true,
	},
	css: () => CSS,
	init: () => {
		let bar: Element | null = null;

		const unwatch = watchDom(() => {
			const next =
				document.querySelector('[data-testid="help-menu-button"]')?.parentElement?.parentElement ?? null;
			if (next === bar) return;
			bar?.removeAttribute(BAR_ATTR);
			bar = next;
			bar?.setAttribute(BAR_ATTR, "");
		});

		return () => {
			unwatch();
			bar?.removeAttribute(BAR_ATTR);
			bar = null;
		};
	},
});
