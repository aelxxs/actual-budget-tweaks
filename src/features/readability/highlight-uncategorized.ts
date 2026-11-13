import { watchDom } from "@lib/utilities/dom-watcher";
import { CATEGORY_CELL, ROW } from "@lib/actual-dom";

export const UNCATEGORIZED_CSS = `
	${ROW}.abt-uncategorized {
		background: color-mix(in srgb, var(--color-warningText) 12%, transparent) !important;
	}

	${ROW}.abt-uncategorized > div {
		border-color: transparent !important;
	}
`;

function markRows() {
	// From the category cells, so the budget table's rows (which have none) aren't visited.
	for (const catCell of document.querySelectorAll(`${ROW} ${CATEGORY_CELL}`)) {
		const row = catCell.closest(ROW);
		const text = catCell.textContent?.trim() || "";
		row?.classList.toggle("abt-uncategorized", text === "Categorize" || text === "");
	}
}

function cleanup() {
	for (const el of document.querySelectorAll(".abt-uncategorized")) {
		el.classList.remove("abt-uncategorized");
	}
}

export function startHighlightUncategorized(): () => void {
	const unwatch = watchDom(markRows);
	return () => {
		unwatch();
		cleanup();
	};
}
