import { defineSetting } from "@features/types";
import { applyGlobalCSS, createDebouncedObserver, DebouncedObserver } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";

let observer: DebouncedObserver | null = null;

const CSS = `
	[data-testid="row"].abt-stripe {
		background: color-mix(in srgb, var(--color-tableText) 6%, transparent) !important;
	}
	[data-testid="row"].abt-stripe:hover {
		background: color-mix(in srgb, var(--color-tableText) 4%, transparent) !important;
	}
`;

function markRows() {
	const table = document.querySelector('[data-testid="transaction-table"]');

	if (!table) {
		return console.debug("[ABT] alternating-transaction-rows: failed to find [data-testid='transaction-table']");
	}

	const rows = Array.from(table.querySelectorAll<HTMLElement>('[data-testid="row"]'));

	// stable index that doesn't shift as the user scrolls
	const positions = rows.map((row, i) => {
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

export const alternatingTransactionRows = defineSetting({
	type: "checkbox",
	label: "Alternating Transaction Row Colors",
	context: {
		key: "alternating-transaction-rows",
		defaultValue: false,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (!enabled) return;
		applyGlobalCSS(CSS, ctx.key);
		markRows();

		observer = createDebouncedObserver(markRows);
		observer.observe(document.body);
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		observer?.disconnect();
		if (value) {
			applyGlobalCSS(CSS, ctx.key);
			markRows();
			observer = createDebouncedObserver(markRows);
			observer.observe(document.body);
		} else {
			applyGlobalCSS("", ctx.key);
			for (const el of document.querySelectorAll<HTMLElement>(".abt-stripe")) {
				el.classList.remove("abt-stripe");
			}
		}
	},
});
