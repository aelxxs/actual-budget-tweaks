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
	label: "Alternating Transaction Row Colors",
	description: "Zebra-stripe the transaction table for easier scanning.",
	group: "Transactions",
	icon: "rows",
	preview: AlternatingRowsPreview,
	context: {
		key: "alternating-transaction-rows",
		defaultValue: false,
	},
	css: () => CSS,
});
