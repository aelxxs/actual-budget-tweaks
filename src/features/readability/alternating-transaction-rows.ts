import { defineSetting } from "@features/types";
import AlternatingRowsPreview from "./previews/AlternatingRows.svelte";

// Actual (v26.6+) paints odd rows with this token and layers selection/hover on top.
// Doubled :root outranks the theme stylesheet's own :root default.
const CSS = `
	:root:root {
		--color-tableRowBackgroundAlternate: color-mix(
			in srgb,
			var(--color-tableText) 6%,
			var(--color-tableBackground)
		);
	}
`;

export const alternatingTransactionRows = defineSetting({
	type: "checkbox",
	label: "Striped rows",
	description: "Shades every other row in the transaction table.",
	group: "Transactions",
	icon: "rows",
	preview: AlternatingRowsPreview,
	context: {
		key: "alternating-transaction-rows",
		defaultValue: false,
	},
	css: () => CSS,
});
