import { REMAINDER_PRIORITY } from "./constants";

export type TemplatePriority = number | null | undefined;

export interface TemplateEntry {
	priority: TemplatePriority;
	kind?: string;
	amount?: number;
	cap?: number;
	weight?: number;
	raw?: unknown;
	engineTemplate?: unknown;
}

// ── Type definitions ─────────────────────────────────────────────
export type TemplateKind =
	| "goal"
	| "schedule"
	| "remainder"
	| "upto"
	| "average"
	| "copy"
	| "percentage"
	| "simple"
	| "periodic"
	| "by"
	| "spend"
	| "unknown";

interface AmountToken {
	amount: number;
	rest: string;
}

interface Limit {
	amount: number;
	hold: boolean;
	period: string;
	start?: string;
}

interface Adjustment {
	adjustment: number;
	adjustmentType: "percent" | "fixed";
}

interface Repeat {
	annual: boolean;
	repeat?: number;
}

interface PeriodCount {
	period: string;
	amount: number;
}

// ── Template parser ──────────────────────────────────────────────────
function parseAmountToken(text: string): AmountToken | null {
	const s = (text || "").trim();
	const m = s.match(/^(?:\p{Sc}\s*)?(-?\d+(?:\.\d{1,2})?)(?=\s|$)(.*)$/u);
	if (!m) return null;
	return { amount: parseFloat(m[1]), rest: (m[2] || "").trim() };
}

function parseLimit(text: string): Limit | null {
	const parsed = parseAmountToken((text || "").replace(/^up\s+to\b/i, "").trim());
	if (!parsed) return null;
	let tail = parsed.rest;
	const hold = /\bhold\b/i.test(tail);
	tail = tail.replace(/\bhold\b/gi, "").trim();

	let period = "monthly";
	let start = null;
	if (tail) {
		const weekly = tail.match(/^per\s+week\s+starting\s+(\d{4}-\d{2}-\d{2})$/i);
		const daily = tail.match(/^per\s+day$/i);
		if (weekly) {
			period = "weekly";
			start = weekly[1];
		} else if (daily) {
			period = "daily";
		} else {
			return null;
		}
	}

	return {
		amount: parsed.amount,
		hold,
		period,
		...(start ? { start } : {}),
	};
}

function parseAdjustment(text: string): Adjustment | null {
	if (!text) return null;
	const m = text.match(/^\[\s*(increase|decrease)\s+(\d+(?:\.\d+)?)(%)?\s*\]$/i);
	if (!m) return null;
	const sign = m[1].toLowerCase() === "increase" ? 1 : -1;
	return {
		adjustment: sign * parseFloat(m[2]),
		adjustmentType: m[3] ? "percent" : "fixed",
	};
}

function parseRepeat(text: string): Repeat | null {
	const s = (text || "").trim().toLowerCase();
	if (s === "month") return { annual: false };
	if (s === "year") return { annual: true };
	let m = s.match(/^(\d+)\s+months?$/);
	if (m) return { annual: false, repeat: parseInt(m[1], 10) };
	m = s.match(/^(\d+)\s+years?$/);
	if (m) return { annual: true, repeat: parseInt(m[1], 10) };
	return null;
}

function parsePeriodCount(text: string): PeriodCount | null {
	const s = (text || "").trim().toLowerCase();
	if (s === "day") return { period: "day", amount: 1 };
	if (s === "week") return { period: "week", amount: 1 };
	if (s === "month") return { period: "month", amount: 1 };
	if (s === "year") return { period: "year", amount: 1 };
	const m = s.match(/^(\d+)\s+(days?|weeks?|months?|years?)$/);
	if (!m) return null;
	const unit = m[2].replace(/s$/, "");
	return { period: unit, amount: parseInt(m[1], 10) };
}

function makeTemplateLine(
	kind: TemplateKind,
	priority: number,
	raw: string,
	engineTemplate: any,
	extra?: Record<string, any>,
): TemplateEntry {
	return Object.assign(
		{
			kind,
			priority,
			raw,
			engineTemplate: engineTemplate || null,
		},
		extra || {},
	);
}

// Parse a single note line. Returns null for non-template lines.
// Mirrors Actual's notes parser by considering text after the first '#'.
function parseTemplateLine(rawLine: string): TemplateEntry | null {
	const raw = rawLine || "";
	const hashIndex = raw.indexOf("#");
	if (hashIndex < 0) return null;
	const line = raw.slice(hashIndex).trim();
	if (!line) return null;

	// #goal N — indicator only (no budgeting)
	const gm = line.match(/^#goal\b\s*(-?\d+(?:\.\d{1,2})?)?\s*$/i);
	if (gm) {
		const amount = gm[1] ? parseFloat(gm[1]) : null;
		return makeTemplateLine(
			"goal",
			REMAINDER_PRIORITY,
			line,
			amount == null ? null : { type: "goal", directive: "goal", amount },
			{ amount },
		);
	}

	const prefix = line.match(/^#template\b/i);
	if (!prefix) return null;
	let rest = line.slice(prefix[0].length).trim();
	let priority = 0;
	const prioMatch = rest.match(/^-(\d+)\b\s*/);
	if (prioMatch) {
		priority = parseInt(prioMatch[1], 10);
		rest = rest.slice(prioMatch[0].length).trim();
	}
	const base = { directive: "template", priority };
	if (!rest) return makeTemplateLine("unknown", typeof priority === "number" ? priority : 0, line, null);

	// schedule [full] NAME [adjustments]
	const sm = rest.match(/^schedule\s+(?:(full)\s+)?(.+?)(?:\s+(\[(?:increase|decrease)\s+\d+(?:\.\d+)?%?\]))?\s*$/i);
	if (sm) {
		const adjust = parseAdjustment(sm[3]);
		const engineTemplate = Object.assign(
			{
				type: "schedule",
				name: sm[2].trim(),
				full: !!sm[1],
			},
			base,
			adjust || {},
		);
		return makeTemplateLine("schedule", priority, line, engineTemplate, {
			full: !!sm[1],
			name: sm[2].trim(),
			adjust: sm[3] ? sm[3].trim() : null,
		});
	}

	// remainder always runs after normal priority passes in Actual.
	if (/^remainder\b/i.test(rest)) {
		const rem = rest.replace(/^remainder\b/i, "").trim();
		const weightMatch = rem.match(/^(\d+)?\s*(.*)$/);
		const weight = weightMatch && weightMatch[1] ? parseInt(weightMatch[1], 10) : 1;
		const limitText = weightMatch ? (weightMatch[2] || "").trim() : "";
		const limit = limitText ? parseLimit(limitText) : null;
		if (limitText && !limit) {
			return makeTemplateLine("unknown", REMAINDER_PRIORITY, line, null);
		}
		return makeTemplateLine(
			"remainder",
			REMAINDER_PRIORITY,
			line,
			Object.assign(
				{
					type: "remainder",
					directive: "template",
					priority: weight,
					weight,
				},
				limit ? { limit } : {},
			),
			{ weight, limit },
		);
	}

	// up to N [per day/week] [hold] — pure cap/refill template.
	if (/^up to\b/i.test(rest)) {
		const limit = parseLimit(rest);
		if (!limit) return makeTemplateLine("unknown", priority, line, null);
		return makeTemplateLine(
			"upto",
			priority,
			line,
			{ type: "simple", monthly: null, limit, ...base },
			{ cap: limit.amount, hold: limit.hold, per: limit.period },
		);
	}

	const avg = rest.match(/^average\s+(\d+)\s+months?\s*(\[(?:increase|decrease)\s+\d+(?:\.\d+)?%?\])?\s*$/i);
	if (avg) {
		const adjust = parseAdjustment(avg[2]);
		return makeTemplateLine(
			"average",
			priority,
			line,
			Object.assign({ type: "average", numMonths: parseInt(avg[1], 10) }, base, adjust || {}),
		);
	}
	const copy = rest.match(/^copy\s+from\s+(\d+)\s+months\s+ago(?:\s+(up\s+to\b.*))?\s*$/i);
	if (copy) {
		const limit = copy[2] ? parseLimit(copy[2]) : null;
		if (copy[2] && !limit) return makeTemplateLine("unknown", priority, line, null);
		return makeTemplateLine(
			"copy",
			priority,
			line,
			Object.assign({ type: "copy", lookBack: parseInt(copy[1], 10) }, base, limit ? { limit } : {}),
		);
	}

	// N% of X  or  N% of previous X
	const pm = rest.match(/^([\d.]+)%\s+of\s+(previous\s+)?(.+?)\s*$/i);
	if (pm) {
		return makeTemplateLine(
			"percentage",
			priority,
			line,
			{
				type: "percentage",
				percent: parseFloat(pm[1]),
				previous: !!pm[2],
				category: pm[3].trim(),
				...base,
			},
			{
				percent: parseFloat(pm[1]),
				previous: !!pm[2],
				source: pm[3].trim(),
			},
		);
	}

	// N ... (simple, simple+cap, by-date, periodic)
	const amountParsed = parseAmountToken(rest);
	if (amountParsed) {
		const amount = amountParsed.amount;
		const modifier = amountParsed.rest;
		if (!modifier) {
			return makeTemplateLine("simple", priority, line, { type: "simple", monthly: amount, ...base }, { amount });
		}

		if (/^up to\b/i.test(modifier)) {
			const limit = parseLimit(modifier);
			if (!limit) return makeTemplateLine("unknown", priority, line, null);
			return makeTemplateLine(
				"simple",
				priority,
				line,
				{ type: "simple", monthly: amount, limit, ...base },
				{ amount, cap: limit.amount },
			);
		}

		const periodic = modifier.match(
			/^repeat\s+every\s+(.+?)\s+starting\s+(\d{4}-\d{2}-\d{2})(?:\s+(up\s+to\b.*))?\s*$/i,
		);
		if (periodic) {
			const period = parsePeriodCount(periodic[1]);
			const limit = periodic[3] ? parseLimit(periodic[3]) : null;
			if (!period || (periodic[3] && !limit)) return makeTemplateLine("unknown", priority, line, null);
			return makeTemplateLine(
				"periodic",
				priority,
				line,
				Object.assign(
					{
						type: "periodic",
						amount,
						period,
						starting: periodic[2],
					},
					base,
					limit ? { limit } : {},
				),
				{ amount },
			);
		}

		const by = modifier.match(
			/^by\s+(\d{4}-\d{2})(?:\s+spend\s+from\s+(\d{4}-\d{2}))?(?:\s+repeat\s+every\s+(.+))?\s*$/i,
		);
		if (by) {
			const repeat = by[3] ? parseRepeat(by[3]) : null;
			if (by[3] && !repeat) return makeTemplateLine("unknown", priority, line, null);
			const type = by[2] ? "spend" : "by";
			return makeTemplateLine(
				type,
				priority,
				line,
				Object.assign(
					{
						type,
						amount,
						month: by[1],
					},
					base,
					by[2] ? { from: by[2] } : {},
					repeat || {},
				),
				{ amount, targetMonth: by[1], repeat },
			);
		}

		return makeTemplateLine("unknown", priority, line, null);
	}

	return makeTemplateLine("unknown", priority, line, null);
}

export function parseNoteTemplates(note: string): TemplateEntry[] {
	if (!note) return [];
	const out = [];
	for (const line of note.split(/\r?\n/)) {
		const t = parseTemplateLine(line);
		if (t) out.push(t);
	}
	return out;
}

export function isBudgetTemplate(t: TemplateEntry): boolean {
	return t && t.kind !== "goal";
}

export function isRemainderTemplate(t: TemplateEntry): boolean {
	return t && t.kind === "remainder";
}
