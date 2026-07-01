import { defineSetting } from "@features/types";
import { watchDom } from "@lib/utilities/dom-watcher";
import { createLogger } from "@lib/utilities/logger";
import { Page, matchesPage } from "@lib/utilities/pages";

const log = createLogger("alternating-transaction-rows");
const CSS = `
	[data-testid="row"].abt-stripe {
		background: color-mix(in srgb, var(--color-tableText) 6%, transparent) !important;
	}
	[data-testid="row"].abt-stripe:hover {
		background: color-mix(in srgb, var(--color-tableText) 4%, transparent) !important;
	}
`;

function markRows() {
	if (!matchesPage(Page.Accounts)) return;

	const table = document.querySelector('[data-testid="transaction-table"]');

	if (!table) {
		return log.debug("failed to find [data-testid='transaction-table']");
	}

	const rows = Array.from(table.querySelectorAll<HTMLElement>('[data-testid="row"]'));

	// stable index that doesn't shift as the user scrolls
	const positions = rows.map((row) => {
		const parent = row.closest<HTMLElement>('[style*="--pos:"]');
		return {
			row,
			pos: parseFloat(parent ? parent.style.getPropertyValue("--pos") : ""),
		};
	});

	if (positions.length >= 2 && positions.every((r) => !isNaN(r.pos))) {
		positions.sort((a, b) => a.pos - b.pos);
		const rowHeight = positions[1].pos - positions[0].pos;
		if (rowHeight > 0) {
			positions.forEach(({ row, pos }) =>
				row.classList.toggle("abt-stripe", Math.round(pos / rowHeight) % 2 === 1),
			);
			return;
		}
	}

	// Fallback for non-virtualised views
	rows.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
	rows.forEach((row, i) => row.classList.toggle("abt-stripe", i % 2 === 1));
}

function cleanup() {
	for (const el of document.querySelectorAll<HTMLElement>(".abt-stripe")) {
		el.classList.remove("abt-stripe");
	}
}

export const alternatingTransactionRows = defineSetting({
	type: "checkbox",
	label: "Alternating Transaction Row Colors",
	context: {
		key: "alternating-transaction-rows",
		defaultValue: false,
	},
	css: () => CSS,
	init: () => {
		const unwatch = watchDom(markRows);

		return () => {
			unwatch();
			cleanup();
		};
	},
});
