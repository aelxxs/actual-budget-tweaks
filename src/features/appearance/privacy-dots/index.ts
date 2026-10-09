import { defineSetting } from "@features/types";
import PrivacyPicker from "./Picker.svelte";

/*
 * How hidden amounts look in privacy mode, for ABT's numbers and Actual's own. Actual's privacy
 * filter overlays a copy of each amount in a redacted script, revealed on hover; the copy is its
 * wrapper's second, aria-hidden child.
 */
const REDACTED_COPY = `.abt-privacy-enabled
	div:has(> div:first-child + div[aria-hidden="true"]:last-child)
	> div[aria-hidden="true"]`;

const ABT_AMOUNTS = `.abt-privacy-enabled .abt-privacy-number,
	.abt-ib-privacy .abt-ib-private,
	.abt-ib-privacy .abt-ib-label-amount`;

// Inputs can't draw an ::after mark, so they keep their width and hide each character instead.
const FIXED_AMOUNTS = ABT_AMOUNTS.replace(".abt-privacy-number", ".abt-privacy-number:not(input)");

/** One dot per character: keeps each amount's shape, hides its digits. */
const PER_DIGIT = `
	${ABT_AMOUNTS},
	${REDACTED_COPY} {
		font-family: inherit !important;
		-webkit-text-security: disc;
	}

	.abt-privacy-enabled .abt-privacy-number:hover {
		-webkit-text-security: none;
	}

	/*
	 * A dot is wider than a comma or a 1, so a run of them can outgrow the amount's box, and the
	 * table's cells cut the last one in half. Dots that don't fit wrap to a hidden second line
	 * instead, so only whole dots show. Set on the element holding the text, so the line height
	 * is its own (To Budget's large text sits inside smaller wrappers).
	 */
	${REDACTED_COPY} :not(:has(*)) {
		display: inline-block;
		max-width: 100%;
		max-height: 1lh;
		overflow: hidden;
		vertical-align: top;
		/* Actual's cells don't wrap, which would keep the half dot on the visible line. */
		white-space: normal;
		word-break: break-all;
	}
`;

/**
 * The same mark for every amount, so its length doesn't hint at its size. Drawn over the hidden
 * text, aligned like it; four characters fit even the narrowest amount ("0.00").
 */
function fixed(style: "dots" | "script"): string {
	const dots = style === "dots";
	return `
	${FIXED_AMOUNTS},
	${REDACTED_COPY} :not(:has(*)) {
		position: relative;
		-webkit-text-fill-color: transparent;
		user-select: none;
	}

	${
		dots
			? `${ABT_AMOUNTS},
	${REDACTED_COPY} {
		font-family: inherit !important;
	}`
			: ""
	}

	:is(${FIXED_AMOUNTS}, ${REDACTED_COPY} :not(:has(*)))::after {
		content: "${dots ? "••••" : "0000"}" / "";
		position: absolute;
		inset: 0;
		overflow: hidden;
		text-align: inherit;
		white-space: nowrap;
		letter-spacing: ${dots ? "-0.06em" : "normal"};
		-webkit-text-fill-color: currentColor;
	}

	.abt-privacy-enabled .abt-privacy-number:hover {
		-webkit-text-fill-color: inherit;
	}

	/* The account header's balance is a button, which centres its text; the amount reads from the left. */
	.abt-privacy-enabled [data-testid="account-balance"] div[aria-hidden="true"] :not(:has(*))::after {
		text-align: left !important;
	}

	/* ABT's amounts shrink to the mark's measured width, so they sit where the number would. */
	.abt-privacy-enabled .abt-privacy-number:not(:hover, input) {
		width: ${dots ? "2em" : "2.36em"};
		overflow: hidden;
		/* Otherwise longer text, like a transaction's notes, wraps into a tall column. */
		white-space: nowrap;
		vertical-align: bottom;
	}

	.abt-privacy-enabled .abt-privacy-number:not(:hover, .rn, input) {
		display: inline-block;
	}

	${
		dots
			? `.abt-privacy-enabled input.abt-privacy-number:not(:hover, :focus) {
		-webkit-text-security: disc;
	}`
			: ""
	}

	/* !important: the ::after rule above carries the redacted copy's much higher specificity. */
	.abt-privacy-enabled .abt-privacy-number:hover::after {
		content: none !important;
	}
`;
}

const STYLES: Record<string, string> = {
	script: "",
	dots: PER_DIGIT,
	"script-fixed": fixed("script"),
	// "fixed" predates fixed scribbles; kept so saved choices carry over.
	fixed: fixed("dots"),
};

export const privacyStyle = defineSetting({
	type: "select",
	label: "Privacy Style",
	description: "How amounts look while privacy mode hides them.",
	group: "General",
	icon: "eyeOff",
	mobile: true,
	context: {
		key: "privacy-style",
		defaultValue: "script",
	},
	options: [
		{ value: "script", label: "Scribbled" },
		{ value: "dots", label: "Dots" },
		{ value: "script-fixed", label: "Scribbled, fixed length" },
		{ value: "fixed", label: "Dots, fixed length" },
	],
	picker: PrivacyPicker,
	css: ({ value }) => STYLES[value as string] ?? "",
});
