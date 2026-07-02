export interface IconOptions {
	size?: number;
	strokeWidth?: number;
	class?: string;
}

interface IconDef {
	viewBox: string;
	body: string;
	/** "stroke" (fill=none, stroke=currentColor, default) or "fill" (fill=currentColor). */
	variant?: "stroke" | "fill";
	strokeWidth?: number;
}

const ICONS = {
	chevronDown: {
		viewBox: "0 0 16 16",
		body: '<path d="M4 6l4 4 4-4"/>',
		strokeWidth: 2,
	},
	chevronRight: {
		viewBox: "0 0 16 16",
		body: '<path d="M6 4l4 4-4 4"/>',
		strokeWidth: 2,
	},
	palette: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<path d="M12 22a10 10 0 1 1 10-10c0 1.5-.5 3-2 3h-3a2 2 0 0 0-2 2v.5a2.5 2.5 0 0 1-2.5 2.5"/><circle cx="6.5" cy="11.5" r="1.2"/><circle cx="9.5" cy="7.5" r="1.2"/><circle cx="14.5" cy="7.5" r="1.2"/><circle cx="17.5" cy="11.5" r="1.2"/>',
	},
	rows: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<rect x="3" y="5" width="18" height="4" rx="1"/><rect x="3" y="11" width="18" height="4" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/>',
	},
	square: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<rect x="3" y="3" width="18" height="18" rx="2"/>',
	},
	layout: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>',
	},
	search: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
	},
	star: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
	},
	image: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
	},
	cog: {
		// Matches Actual's own settings-nav glyph for visual consistency.
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
	},
	chevronLeft: {
		viewBox: "0 0 16 16",
		body: '<path d="M10 4l-4 4 4 4"/>',
		strokeWidth: 2,
	},
	pencil: {
		variant: "fill",
		viewBox: "0 0 16 16",
		body: '<path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064l6.286-6.286Z"/>',
	},
	shuffle: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
	},
	calculator: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/>',
	},
	currencyConvert: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
	},
	stock: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
	},
	networth: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
	},
	interest: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
	},
	calendar: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
	},
	rsu: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/><circle cx="12" cy="14" r="2"/><path d="M12 16v2"/>',
	},
	eye: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>',
	},
	eyeOff: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
	},
	close: {
		viewBox: "0 0 24 24",
		strokeWidth: 2,
		body: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
	},
	upload: {
		viewBox: "0 0 16 16",
		strokeWidth: 1.5,
		body: '<path d="M2 10v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3"/><path d="M8 10V2m0 0L5 5m3-3 3 3"/>',
	},
	download: {
		viewBox: "0 0 16 16",
		strokeWidth: 1.5,
		body: '<path d="M2 10v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3"/><path d="M8 2v8m0 0L5 7m3 3 3-3"/>',
	},
	bug: {
		viewBox: "0 0 24 24",
		strokeWidth: 2.25,
		body: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
	},
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

/** Renders a shared icon to an SVG markup string, for both vanilla-DOM and Svelte call sites. */
export function icon(name: IconName, opts: IconOptions = {}): string {
	const def: IconDef = ICONS[name];
	const size = opts.size ?? 16;
	const classAttr = opts.class ? ` class="${opts.class}"` : "";

	if (def.variant === "fill") {
		return `<svg width="${size}" height="${size}" viewBox="${def.viewBox}" fill="currentColor" aria-hidden="true"${classAttr}>${def.body}</svg>`;
	}

	const strokeWidth = opts.strokeWidth ?? def.strokeWidth ?? 2;
	return `<svg width="${size}" height="${size}" viewBox="${def.viewBox}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${classAttr}>${def.body}</svg>`;
}
