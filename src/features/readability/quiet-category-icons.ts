import { defineSetting } from "@features/types";
import { CATEGORY_NAME, ROW } from "@lib/actual-dom";
import { watchDom } from "@lib/utilities/dom-watcher";
import { Page, matchesPage } from "@lib/utilities/pages";

const ICON_ATTR = "data-abt-category-icon";
const NOTES_ATTR = "data-abt-has-notes";
// The class each notes button had when last read; Actual swaps it when the button's look changes.
const readClass = new WeakMap<Element, string>();

// visibility, not display, so the row doesn't shift when they appear. Closing a popover hands focus
// back to its button, so only keyboard focus keeps one shown.
const CSS = `
	${ROW}:not(:hover) [${ICON_ATTR}="automation"]:not(:has(:focus-visible)),
	${ROW}:not(:hover) [${ICON_ATTR}="notes"]:not([${NOTES_ATTR}], :has(:focus-visible)) {
		visibility: hidden;
	}
`;

function markIcons() {
	if (!matchesPage(Page.Budget)) {
		return;
	}
	for (const name of document.querySelectorAll(CATEGORY_NAME)) {
		// The menu chevron, then the automations button when Actual's templates UI is on, then notes.
		const icons = [...(name.parentElement?.children ?? [])].filter(
			(el) => el.tagName === "DIV" && el.querySelector("button svg"),
		);
		if (icons.length < 2) {
			continue;
		}
		const notes = icons[icons.length - 1];
		setIcon(notes, "notes");
		if (icons.length > 2) {
			setIcon(icons[icons.length - 2], "automation");
		}
		// Actual dims the notes button to 0.3 as a placeholder when there are none; hover lifts it.
		const button = notes.querySelector("button");
		if (button && !button.matches(":hover") && readClass.get(button) !== button.className) {
			readClass.set(button, button.className);
			notes.toggleAttribute(NOTES_ATTR, Number(getComputedStyle(button).opacity) >= 1);
		}
	}
}

function setIcon(el: Element, kind: string) {
	if (el.getAttribute(ICON_ATTR) !== kind) {
		el.setAttribute(ICON_ATTR, kind);
	}
}

function cleanup() {
	for (const el of document.querySelectorAll(`[${ICON_ATTR}]`)) {
		el.removeAttribute(ICON_ATTR);
		el.removeAttribute(NOTES_ATTR);
	}
}

export const quietCategoryIcons = defineSetting({
	type: "checkbox",
	label: "Quiet Category Icons",
	description:
		"Show the template and notes icons on hover, keeping notes visible where there are some.",
	group: "Categories",
	icon: "note",
	context: {
		key: "quiet-category-icons",
		defaultValue: false,
	},
	css: () => CSS,
	init: () => {
		const unwatch = watchDom(markIcons);
		return () => {
			unwatch();
			cleanup();
		};
	},
});
