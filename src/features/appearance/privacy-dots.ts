import { defineSetting } from "@features/types";

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
 * The same four dots for every amount, so their length doesn't hint at their size. Drawn over
 * the hidden text, aligned like it; four tight dots fit even the narrowest amount ("0.00").
 */
const FIXED = `
	${ABT_AMOUNTS},
	${REDACTED_COPY} :not(:has(*)) {
		position: relative;
		-webkit-text-fill-color: transparent;
		user-select: none;
	}

	${REDACTED_COPY} {
		font-family: inherit !important;
	}

	:is(${ABT_AMOUNTS}, ${REDACTED_COPY} :not(:has(*)))::after {
		content: "••••" / "";
		position: absolute;
		inset: 0;
		overflow: hidden;
		text-align: inherit;
		white-space: nowrap;
		letter-spacing: -0.06em;
		-webkit-text-fill-color: currentColor;
	}

	.abt-privacy-enabled .abt-privacy-number:hover {
		-webkit-text-fill-color: inherit;
	}

	.abt-privacy-enabled .abt-privacy-number:hover::after {
		content: none;
	}
`;

export const privacyStyle = defineSetting({
	type: "select",
	label: "Privacy Style",
	description: "How amounts look while privacy mode hides them.",
	group: "General",
	icon: "eyeOff",
	context: {
		key: "privacy-style",
		defaultValue: "dots",
	},
	options: [
		{ value: "dots", label: "Dots per digit" },
		// { value: "fixed", label: "Fixed dots (hides length)" },
		{ value: "script", label: "Scribbled (Actual's default)" },
	],
	css: ({ value }) => (value === "fixed" ? FIXED : value === "script" ? "" : PER_DIGIT),
});
