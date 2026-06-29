import { defineSetting } from "@features/types";
import { applyGlobalCSS } from "@lib/utilities/dom";
import { getValue, setValue } from "@lib/utilities/store";

const CSS = `
	[data-testid="row"].abt-uncategorized {
		background: color-mix(in srgb, var(--color-warningText) 12%, transparent) !important;
	}

	[data-testid="row"].abt-uncategorized > div {
		border-color: transparent !important;
	}
`;

function markRows() {
	for (const row of document.querySelectorAll<HTMLElement>('[data-testid="row"]')) {
		const catCell = row.querySelector('[data-testid="category"]');
		if (!catCell) continue;
		const text = catCell.textContent?.trim() || "";
		row.classList.toggle("abt-uncategorized", text === "Categorize" || text === "");
	}
}

function clearRows() {
	for (const el of document.querySelectorAll(".abt-uncategorized")) {
		el.classList.remove("abt-uncategorized");
	}
}

export const highlightUncategorized = defineSetting({
	type: "checkbox",
	label: "Highlight Uncategorized Transactions",
	context: {
		key: "highlight-uncategorized",
		defaultValue: true,
		_observer: null as MutationObserver | null,
	},
	init: async (ctx) => {
		const enabled = await getValue(ctx.key, ctx.defaultValue);
		if (!enabled) return;
		applyGlobalCSS(CSS, ctx.key);
		markRows();
		let scheduled = false;
		const observer = new MutationObserver(() => {
			if (!scheduled) {
				scheduled = true;
				requestAnimationFrame(() => {
					markRows();
					scheduled = false;
				});
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		ctx._observer = observer;
	},
	onChange: async (value, ctx) => {
		await setValue(ctx.key, value);
		if (value) {
			applyGlobalCSS(CSS, ctx.key);
			markRows();
			let scheduled = false;
			const observer = new MutationObserver(() => {
				if (!scheduled) {
					scheduled = true;
					requestAnimationFrame(() => {
						markRows();
						scheduled = false;
					});
				}
			});
			observer.observe(document.body, { childList: true, subtree: true });
			ctx._observer = observer;
		} else {
			applyGlobalCSS("", ctx.key);
			ctx._observer?.disconnect();
			ctx._observer = null;
			clearRows();
		}
	},
});
