const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

function graphemes(text: string): string[] {
	return Array.from(
		new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
		(s) => s.segment,
	);
}

/** The first emoji in a name, which people often add to stand in for an icon. */
export function nameEmoji(name: string): string | undefined {
	return graphemes(name).find((g) => EMOJI.test(g));
}

/** Up to two letters from a name's first words, or from a single word's start. */
export function initials(name: string, singleWord = 2): string {
	const words = name
		.split(/\s+/)
		.map((w) => w.replace(/[^\p{L}\p{M}\p{N}]/gu, ""))
		.filter(Boolean);
	if (words.length >= 2) {
		return (graphemes(words[0])[0] + graphemes(words[1])[0]).toUpperCase();
	}
	return graphemes(words[0] ?? "")
		.slice(0, singleWord)
		.join("")
		.toUpperCase();
}
