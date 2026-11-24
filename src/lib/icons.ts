import {
	Columns3,
	Keyboard,
	AppWindow,
	Archive,
	ArrowDownAZ,
	BadgeAlert,
	Bell,
	Bug,
	Calculator,
	Calendar,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleCheck,
	CircleDollarSign,
	CircleQuestionMark,
	Copy,
	DollarSign,
	Download,
	Ellipsis,
	Eye,
	EyeOff,
	FileText,
	Flag,
	Funnel,
	Hash,
	Heading,
	Image,
	Layers,
	LayoutDashboard,
	List,
	ListChecks,
	Lock,
	Maximize2,
	MessageSquare,
	Minimize2,
	Minus,
	Network,
	Palette,
	PanelBottom,
	PanelLeft,
	PanelRight,
	PanelTop,
	PanelsTopLeft,
	Pencil,
	Percent,
	Plus,
	Power,
	RectangleEllipsis,
	RefreshCw,
	RotateCcw,
	Rows3,
	Scale,
	Scan,
	Search,
	Settings,
	Shield,
	Shuffle,
	Sigma,
	Settings2,
	Smartphone,
	BrushCleaning,
	Square,
	SquarePlus,
	SquareRoundCorner,
	Star,
	Target,
	TrendingUp,
	TriangleAlert,
	UnfoldVertical,
	Upload,
	Wallet,
	X,
	type LucideIcon,
} from "@lucide/svelte";

interface IconOptions {
	size?: number;
	strokeWidth?: number;
	class?: string;
}

interface DrawnIcon {
	viewBox: string;
	body: string;
	/** "stroke" (fill=none, stroke=currentColor, default) or "fill" (fill=currentColor). */
	variant?: "stroke" | "fill";
	strokeWidth?: number;
}

/** Lucide icons by ABT's names, with the stroke each was drawn at. */
const LUCIDE = {
	chevronDown: { component: ChevronDown, strokeWidth: 2 },
	chevronRight: { component: ChevronRight, strokeWidth: 2 },
	chevronLeft: { component: ChevronLeft, strokeWidth: 2 },
	filter: { component: Funnel, strokeWidth: 1.5 },
	palette: { component: Palette, strokeWidth: 1.5 },
	square: { component: Square, strokeWidth: 1.5 },
	note: { component: FileText, strokeWidth: 1.5 },
	layout: { component: PanelLeft, strokeWidth: 1.5 },
	search: { component: Search, strokeWidth: 1.75 },
	star: { component: Star, strokeWidth: 1.5 },
	image: { component: Image, strokeWidth: 1.5 },
	cog: { component: Settings, strokeWidth: 1.5 },
	keyboard: { component: Keyboard, strokeWidth: 1.5 },
	pencil: { component: Pencil },
	shuffle: { component: Shuffle, strokeWidth: 1.75 },
	calculator: { component: Calculator, strokeWidth: 1.5 },
	stock: { component: TrendingUp, strokeWidth: 1.5 },
	networth: { component: DollarSign, strokeWidth: 1.5 },
	interest: { component: Percent, strokeWidth: 1.5 },
	calendar: { component: Calendar, strokeWidth: 1.5 },
	eye: { component: Eye, strokeWidth: 1.75 },
	eyeOff: { component: EyeOff, strokeWidth: 1.75 },
	sliders: { component: Settings2, strokeWidth: 1.75 },
	target: { component: Target, strokeWidth: 1.75 },
	alert: { component: TriangleAlert, strokeWidth: 1.75 },
	shield: { component: Shield, strokeWidth: 1.75 },
	cleanup: { component: BrushCleaning, strokeWidth: 1.75 },
	copy: { component: Copy, strokeWidth: 1.75 },
	trendingUp: { component: TrendingUp, strokeWidth: 1.75 },
	power: { component: Power, strokeWidth: 1.75 },
	rotateCcw: { component: RotateCcw, strokeWidth: 1.75 },
	refreshCw: { component: RefreshCw, strokeWidth: 1.75 },
	bell: { component: Bell, strokeWidth: 1.75 },
	helpCircle: { component: CircleQuestionMark, strokeWidth: 1.75 },
	close: { component: X, strokeWidth: 2 },
	upload: { component: Upload, strokeWidth: 1.5 },
	download: { component: Download, strokeWidth: 1.5 },
	plus: { component: Plus, strokeWidth: 1.75 },
	lock: { component: Lock, strokeWidth: 1.75 },
	minimize: { component: Minimize2, strokeWidth: 1.75 },
	maximize: { component: Maximize2, strokeWidth: 1.75 },
	moreHorizontal: { component: Ellipsis, strokeWidth: 2 },
	listChecks: { component: ListChecks, strokeWidth: 1.75 },
	checkCircle: { component: CircleCheck, strokeWidth: 1.75 },
	bug: { component: Bug, strokeWidth: 2.25 },
	panelTop: { component: PanelTop, strokeWidth: 1.5 },
	heading: { component: Heading, strokeWidth: 1.5 },
	rectangleEllipsis: { component: RectangleEllipsis, strokeWidth: 1.5 },
	messageSquare: { component: MessageSquare, strokeWidth: 1.5 },
	panelsTopLeft: { component: PanelsTopLeft, strokeWidth: 1.5 },
	columns3: { component: Columns3, strokeWidth: 1.5 },
	appWindow: { component: AppWindow, strokeWidth: 1.5 },
	panelBottom: { component: PanelBottom, strokeWidth: 1.5 },
	smartphone: { component: Smartphone, strokeWidth: 1.5 },
	panelRight: { component: PanelRight, strokeWidth: 1.5 },
	layoutDashboard: { component: LayoutDashboard, strokeWidth: 1.5 },
	layers: { component: Layers, strokeWidth: 1.5 },
	squarePlus: { component: SquarePlus, strokeWidth: 1.5 },
	sigma: { component: Sigma, strokeWidth: 1.5 },
	archive: { component: Archive, strokeWidth: 1.5 },
	flag: { component: Flag, strokeWidth: 1.5 },
	badgeAlert: { component: BadgeAlert, strokeWidth: 1.5 },
	circleDollarSign: { component: CircleDollarSign, strokeWidth: 1.5 },
	hash: { component: Hash, strokeWidth: 1.5 },
	wallet: { component: Wallet, strokeWidth: 1.5 },
	list: { component: List, strokeWidth: 1.5 },
	sortAlpha: { component: ArrowDownAZ, strokeWidth: 1.5 },
	network: { component: Network, strokeWidth: 1.5 },
	minus: { component: Minus, strokeWidth: 1.5 },
	scan: { component: Scan, strokeWidth: 1.5 },
	squareRoundCorner: { component: SquareRoundCorner },
	unfoldVertical: { component: UnfoldVertical },
	rows3: { component: Rows3 },
	scale: { component: Scale },
} as const satisfies Record<string, { component: LucideIcon; strokeWidth?: number }>;

/**
 * Drawn by hand: ABT's own glyphs, and the icons Actual's pages take as markup (icon(), iconMask()),
 * which a Svelte component can't render into. Svelte uses Lucide for the rest.
 */
const DRAWN = {
	rows: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<rect x="3" y="5" width="18" height="4" rx="1"/><rect x="3" y="11" width="18" height="4" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/>',
	},
	gauge: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M21 12a9 9 0 0 0-9-9" opacity="0.35"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M12 12l3.5-3.5"/>',
	},
	progressRing: {
		viewBox: "0 0 16 16",
		strokeWidth: 2.5,
		body: '<circle class="track" cx="8" cy="8" r="6"/><circle class="fill" cx="8" cy="8" r="6" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90 8 8)"/>',
	},
	currencyConvert: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
	},
	rsu: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/><circle cx="12" cy="14" r="2"/><path d="M12 16v2"/>',
	},
	faceGrinning: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<path d="M15 10V9"/><path d="M7.084 14.302a5.12 5.12 0 009.833 0 .24.24 0 00-.235-.302H7.32a.24.24 0 00-.235.302"/><path d="M9 10V9"/><circle cx="12" cy="12" r="10"/>',
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
	bell: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>',
	},
	refreshCw: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
	},
	helpCircle: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
	},
	download: {
		viewBox: "0 0 16 16",
		strokeWidth: 1.5,
		body: '<path d="M2 10v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3"/><path d="M8 2v8m0 0L5 7m3 3 3-3"/>',
	},
	plus: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<path d="M5 12h14"/><path d="M12 5v14"/>',
	},
	filter: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/>',
	},
	search: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
	},
	lock: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
	},
	minimize: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
	},
	maximize: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
	},
	moreHorizontal: {
		viewBox: "0 0 24 24",
		strokeWidth: 2,
		body: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
	},
	chevronDown: {
		viewBox: "0 0 16 16",
		body: '<path d="M4 6l4 4 4-4"/>',
		strokeWidth: 2,
	},
	calculator: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/>',
	},
	stock: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
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
	network: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
	},
	sliders: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.75,
		body: '<path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
	},
	arrowDown: {
		viewBox: "0 0 24 24",
		strokeWidth: 2,
		body: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
	},
	chevronLeft: {
		viewBox: "0 0 16 16",
		body: '<path d="M10 4l-4 4 4 4"/>',
		strokeWidth: 2,
	},
	note: {
		viewBox: "0 0 24 24",
		strokeWidth: 1.5,
		body: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
	},
} as const satisfies Record<string, DrawnIcon>;

export type IconName = keyof typeof LUCIDE | keyof typeof DRAWN;
/** The icons available as markup, for Actual's own pages. */
export type DrawnIconName = keyof typeof DRAWN;

/** The Lucide component and its stroke for a name, or null for one of ABT's own drawings. */
export function lucideIcon(name: IconName): { component: LucideIcon; strokeWidth?: number } | null {
	return name in LUCIDE ? LUCIDE[name as keyof typeof LUCIDE] : null;
}

/** An icon as SVG markup, for Actual's own pages where a Svelte component can't go. */
export function icon(name: DrawnIconName, opts: IconOptions = {}): string {
	const def: DrawnIcon = DRAWN[name];
	const size = opts.size ?? 16;
	const classAttr = opts.class ? ` class="${opts.class}"` : "";
	if (def.variant === "fill") {
		return `<svg width="${size}" height="${size}" viewBox="${def.viewBox}" fill="currentColor" aria-hidden="true"${classAttr}>${def.body}</svg>`;
	}
	const strokeWidth = opts.strokeWidth ?? def.strokeWidth ?? 2;
	return `<svg width="${size}" height="${size}" viewBox="${def.viewBox}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${classAttr}>${def.body}</svg>`;
}

/** An icon as a CSS `url()`, for `mask` over a native glyph so React keeps owning its nodes. */
export function iconMask(name: DrawnIconName): string {
	const svg = icon(name, { size: 24 }).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
