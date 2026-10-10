import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { type Mounted, mountToNodeWithReturn } from "@lib/utilities/svelte";
import FundingSection from "./FundingSection.svelte";
import { loadGoalState, type GoalState } from "./goal-state";

const SECTION_ATTR = "data-abt-goal-funding";
const BALANCE_CELL = '[data-cellname*="!leftover-"]';
/** How long after pressing a balance its popover may still appear. */
const PENDING_MS = 3000;
/** How long Actual's popover stays hidden waiting for goal data before showing anyway. */
const REVEAL_TIMEOUT_MS = 300;

interface Pending {
	sheet: string;
	categoryId: string;
	at: number;
	/** Popovers already open at press time; the balance menu is the one that appears after. */
	existing: Set<Element>;
	/** Started on press, so it's usually resolved by the time the menu opens. */
	data: Promise<GoalState | null>;
}

let pending: Pending | null = null;
let mounted: (Mounted & { popover: Element }) | null = null;
let popoverObserver: MutationObserver | null = null;

// Actual swaps the menu for a non-menu form when you pick Transfer or Cover.
function showsMenu(popover: Element): boolean {
	return !!popover.querySelector('[role="menu"]');
}

function stopObserving(): void {
	popoverObserver?.disconnect();
	popoverObserver = null;
}

// The balance button wraps the spreadsheet cell, whose name carries month and category.
function onPress(e: Event): void {
	if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") {
		return;
	}
	const cell = (e.target as Element | null)?.closest("button")?.querySelector(BALANCE_CELL);
	const match = cell?.getAttribute("data-cellname")?.match(/^(budget\d{6})!leftover-(.+)$/);
	if (!match) {
		return;
	}

	const [, sheet, categoryId] = match;
	pending = {
		sheet,
		categoryId,
		at: Date.now(),
		existing: new Set(document.querySelectorAll("[data-popover]")),
		data: loadGoalState(sheet, categoryId).catch(() => null),
	};
	// Not debounced like watchDom: the observer callback runs before the next
	// paint, so the popover can be hidden before Actual's bare menu ever shows.
	stopObserving();
	popoverObserver = new MutationObserver(attachToNewPopover);
	popoverObserver.observe(document.body, { childList: true, subtree: true });
}

function attachToNewPopover(): void {
	const current = pending;
	if (!current || Date.now() - current.at > PENDING_MS) {
		stopObserving();
		return;
	}
	const popover = [...document.querySelectorAll<HTMLElement>("[data-popover]")].find(
		(p) => !current.existing.has(p) && showsMenu(p),
	);
	if (!popover) {
		return;
	}

	pending = null;
	stopObserving();
	popover.style.visibility = "hidden";
	const reveal = () => popover.style.removeProperty("visibility");
	const timeout = setTimeout(reveal, REVEAL_TIMEOUT_MS);

	void current.data.then((initial) => {
		if (initial && popover.isConnected && showsMenu(popover)) {
			unmountSection();
			const section = mountToNodeWithReturn(FundingSection, {
				sheet: current.sheet,
				categoryId: current.categoryId,
				initial,
			});
			section.node.setAttribute(SECTION_ATTR, "");
			popover.prepend(section.node);
			mounted = { ...section, popover };
		}
		clearTimeout(timeout);
		reveal();
	});
}

function unmountSection(): void {
	if (!mounted) {
		return;
	}
	mounted.destroy();
	mounted = null;
}

// Gone when the popover closes or switches to Actual's transfer/cover view.
function syncMounted(): void {
	if (mounted && (!mounted.node.isConnected || !showsMenu(mounted.popover))) {
		unmountSection();
	}
}

export const goalFunding = defineSetting({
	type: "checkbox",
	label: "Goal Funding",
	description:
		"Click a category's balance to see its goal progress and assign money to an underfunded goal.",
	icon: "interest",
	writes: "Budgets the rest of a goal to its category when you click Assign.",
	context: {
		key: "goal-funding",
		defaultValue: true,
	},
	init: () => {
		document.addEventListener("pointerdown", onPress, true);
		document.addEventListener("keydown", onPress, true);
		const unwatch = watchDom(syncMounted);
		return () => {
			document.removeEventListener("pointerdown", onPress, true);
			document.removeEventListener("keydown", onPress, true);
			unwatch();
			stopObserving();
			unmountSection();
			pending = null;
		};
	},
});
