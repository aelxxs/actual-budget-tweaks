import { GLYPHS, type Glyph } from "./glyphs";

const SVG_NS = "http://www.w3.org/2000/svg";
const byName = new Map(GLYPHS.map((g) => [g.name, g]));

/** Stored as `glyph:<name>`, so a glyph and an image URL share one string. */
export const GLYPH_PREFIX = "glyph:";

export function glyphNamed(value: string | null | undefined): Glyph | undefined {
	return value?.startsWith(GLYPH_PREFIX) ? byName.get(value.slice(GLYPH_PREFIX.length)) : undefined;
}

/** Lucide's drawing on its 24-unit grid, a touch lighter than its 2-unit stroke at row size. */
const ROOT_ATTRS: Record<string, string> = {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	"stroke-width": "1.85",
	"stroke-linecap": "round",
	"stroke-linejoin": "round",
};

/** For DOM outside Svelte: built from elements, never markup, as the name comes from synced storage. */
export function glyphElement(glyph: Glyph, size: number): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, "svg");
	for (const [k, v] of Object.entries({
		...ROOT_ATTRS,
		width: String(size),
		height: String(size),
	})) {
		svg.setAttribute(k, v);
	}
	svg.setAttribute("aria-hidden", "true");
	for (const [tag, attrs] of glyph.node) {
		const el = document.createElementNS(SVG_NS, tag);
		for (const [k, v] of Object.entries(attrs)) {
			el.setAttribute(k, v);
		}
		svg.appendChild(el);
	}
	return svg;
}

/** As an image, where only a URL fits (an SVG `<image>`): the colour is fixed when it's made. */
export function glyphDataUrl(glyph: Glyph, color: string): string {
	const attrs = Object.entries({ ...ROOT_ATTRS, stroke: color, xmlns: SVG_NS })
		.map(([k, v]) => `${k}="${escapeAttr(v)}"`)
		.join(" ");
	const body = glyph.node
		.map(
			([tag, a]) =>
				`<${tag} ${Object.entries(a)
					.map(([k, v]) => `${k}="${escapeAttr(v)}"`)
					.join(" ")}/>`,
		)
		.join("");
	return `data:image/svg+xml,${encodeURIComponent(`<svg ${attrs}>${body}</svg>`)}`;
}

const escapeAttr = (v: string) =>
	v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
