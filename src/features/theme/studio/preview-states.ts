import { getPrivacyMode } from "@features/core/privacy-mode";
import { BUDGET_TABLE, LEFTOVER_CELL, TO_BUDGET_CELL } from "@lib/actual-dom";
import { dispatch } from "@lib/utilities/actual-api";
import { applyGlobalCSS, createElement } from "@lib/utilities/dom";
import { watchDom } from "@lib/utilities/dom-watcher";

export type PreviewState = "healthy" | "overspent" | "privacy";

const STYLE_ID = "theme-studio-preview";
const SAMPLE_ATTR = "data-abt-sample";
const TONE_ATTR = "data-abt-sample-tone";

// Every few balances, cycling: overspent, low, overspent again, then left alone.
const SAMPLES: ([string, "negative" | "warning"] | null)[] = [
	["-38.40", "negative"],
	null,
	["2.15", "warning"],
	null,
	["-120.00", "negative"],
	null,
];

/*
 * Sample values are drawn over Actual's own text, which is hidden, not replaced: React keeps
 * rendering the real figures underneath, and clearing the marks puts them straight back.
 */
const CSS = `
	/* Visible overflow: Actual clips each figure to its own width, which cut off a longer sample. */
	[${SAMPLE_ATTR}] {
		position: relative;
		overflow: visible !important;
		color: transparent !important;
	}
	[${SAMPLE_ATTR}] * {
		color: transparent !important;
	}
	/* From the right edge and as wide as it needs: a sample can be longer than the real figure. */
	[${SAMPLE_ATTR}]::after {
		content: attr(${SAMPLE_ATTR});
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	[${TONE_ATTR}="negative"]::after {
		color: var(--color-budgetNumberNegative, var(--color-errorText));
	}
	[${TONE_ATTR}="warning"]::after {
		color: var(--color-warningText);
	}
	[${TONE_ATTR}="to-budget"]::after {
		right: auto;
		left: 0;
		color: var(--color-errorText);
	}
	.abt-sample-banner {
		position: fixed;
		z-index: 250;
		transform: translateX(-50%);
		padding: 3px 10px;
		border-radius: var(--abt-radius-pill);
		background: var(--color-warningBackground, var(--abt-ink-3));
		color: var(--color-warningText);
		border: 1px solid color-mix(in srgb, var(--color-warningText) 40%, transparent);
		font-size: var(--abt-text-sm);
		font-weight: 600;
		pointer-events: none;
	}
`;

let state: PreviewState = "healthy";
let stopWatching: (() => void) | null = null;
let banner: HTMLElement | null = null;
/** Whether the preview turned privacy mode on, and so has to turn it back off. */
let turnedPrivacyOn = false;

// As the command palette's "Hide amounts" does.
function setPrivacy(on: boolean): void {
	dispatch("saveSyncedPrefs", { prefs: { isPrivacyEnabled: String(on) } });
}

export function setPreviewState(next: PreviewState): void {
	if (next === state) {
		return;
	}
	clearPreviewState();
	state = next;
	if (next === "healthy") {
		return;
	}
	if (next === "privacy") {
		turnedPrivacyOn = !getPrivacyMode();
		if (turnedPrivacyOn) {
			setPrivacy(true);
		}
		return;
	}
	applyGlobalCSS(CSS, STYLE_ID);
	markSamples();
	stopWatching = watchDom(markSamples);
	window.addEventListener("resize", placeBanner);
}

/** Back to the real data. */
export function clearPreviewState(): void {
	if (turnedPrivacyOn) {
		turnedPrivacyOn = false;
		setPrivacy(false);
	}
	state = "healthy";
	stopWatching?.();
	stopWatching = null;
	window.removeEventListener("resize", placeBanner);
	banner?.remove();
	banner = null;
	for (const el of document.querySelectorAll(`[${SAMPLE_ATTR}]`)) {
		el.removeAttribute(SAMPLE_ATTR);
		el.removeAttribute(TONE_ATTR);
	}
	applyGlobalCSS("", STYLE_ID);
}

function markSamples(): void {
	const table = document.querySelector(BUDGET_TABLE);
	if (!table) {
		banner?.remove();
		banner = null;
		return;
	}
	const cells = table.querySelectorAll(LEFTOVER_CELL);
	cells.forEach((cell, i) => {
		const sample = SAMPLES[i % SAMPLES.length];
		if (!sample) {
			return;
		}
		if (cell.getAttribute(SAMPLE_ATTR) !== sample[0]) {
			cell.setAttribute(SAMPLE_ATTR, sample[0]);
			cell.setAttribute(TONE_ATTR, sample[1]);
		}
	});
	// One per month card, and the summary card's.
	for (const toBudget of document.querySelectorAll(TO_BUDGET_CELL)) {
		if (!toBudget.hasAttribute(SAMPLE_ATTR)) {
			toBudget.setAttribute(SAMPLE_ATTR, "-245.00");
			toBudget.setAttribute(TONE_ATTR, "to-budget");
		}
	}
	if (!banner) {
		banner = createElement("div", { className: "abt-sample-banner" });
		banner.textContent = "Sample data";
		document.body.append(banner);
	}
	placeBanner();
}

function placeBanner(): void {
	const table = document.querySelector(BUDGET_TABLE);
	if (!banner || !table) {
		return;
	}
	// Low over the table, clear of the summary cards and the header.
	const r = table.getBoundingClientRect();
	banner.style.bottom = `${Math.max(12, window.innerHeight - r.bottom + 12)}px`;
	banner.style.left = `${r.left + r.width / 2}px`;
}
