/*
 * The loan's settings, kept as one line in the account's note so scripts using Actual's API can
 * read them too:
 *
 *   loan: rate=0.0514 daycount=act365 interestDay=20 payment=1860 paymentDay=23 interestPayee=RBC
 *
 * No imports and no DOM, so the unit test can load it as it is.
 */

export interface LoanConfig {
	/** Annual rate as a fraction: 0.0514 for 5.14%. */
	rate?: number;
	daycount?: "act365" | "monthly";
	interestDay?: number;
	/** In the currency's main unit (1860.5), not cents, so the line reads naturally. */
	payment?: number;
	paymentDay?: number;
	/** The payee interest charges are posted under. */
	interestPayee?: string;
}

const LINE = /^\s*loan:(.*)$/i;
// key=value, or key="a value with spaces"
const PAIR = /([A-Za-z][\w-]*)=("[^"]*"|\S*)/g;
const KEYS = ["rate", "daycount", "interestDay", "payment", "paymentDay", "interestPayee"];

function pairs(line: string): [key: string, value: string][] {
	return [...line.matchAll(PAIR)].map((m) => [m[1], m[2].replace(/^"(.*)"$/, "$1")]);
}

function findLine(lines: string[]): number {
	return lines.findIndex((line) => LINE.test(line));
}

function number(value: string | undefined, min: number, max: number): number | undefined {
	const n = value === undefined || value === "" ? NaN : Number(value);
	return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function day(value: string | undefined): number | undefined {
	const n = number(value, 1, 31);
	return n === undefined ? undefined : Math.round(n);
}

/** The settings on the note's `loan:` line; null when it has none. Values that don't parse are left out. */
export function readLoan(note: string | null | undefined): LoanConfig | null {
	const lines = (note ?? "").split("\n");
	const at = findLine(lines);
	if (at === -1) {
		return null;
	}
	const found = new Map(pairs(lines[at].match(LINE)![1]));
	const daycount = found.get("daycount")?.toLowerCase();
	const config: LoanConfig = {
		rate: number(found.get("rate"), 0, 10),
		daycount: daycount === "act365" || daycount === "monthly" ? daycount : undefined,
		interestDay: day(found.get("interestDay")),
		payment: number(found.get("payment"), 0, Number.MAX_SAFE_INTEGER),
		paymentDay: day(found.get("paymentDay")),
		interestPayee: found.get("interestPayee") || undefined,
	};
	for (const key of Object.keys(config) as (keyof LoanConfig)[]) {
		if (config[key] === undefined) {
			delete config[key];
		}
	}
	return config;
}

function format(value: string | number): string {
	const text = String(value);
	return /\s/.test(text) ? `"${text.replace(/"/g, "")}"` : text;
}

/**
 * The note with its `loan:` line set to `config`, added at the end if it had none. The rest of
 * the note, and any keys on the line this doesn't know, stay as they were.
 */
export function writeLoan(note: string | null | undefined, config: LoanConfig): string {
	const lines = note ? note.split("\n") : [];
	const at = findLine(lines);
	const unknown =
		at === -1 ? [] : pairs(lines[at].match(LINE)![1]).filter(([k]) => !KEYS.includes(k));
	const known = KEYS.flatMap((key): [string, string | number][] => {
		const value = config[key as keyof LoanConfig];
		return value === undefined || value === "" ? [] : [[key, value]];
	});
	const line = `loan: ${[...known, ...unknown].map(([k, v]) => `${k}=${format(v)}`).join(" ")}`;
	if (at === -1) {
		// Its own line, after whatever the note already says.
		while (lines.length && lines[lines.length - 1].trim() === "") {
			lines.pop();
		}
		lines.push(line);
	} else {
		lines[at] = line;
	}
	return lines.join("\n");
}

/** The note without its `loan:` line; the rest stays as it was. */
export function removeLoan(note: string | null | undefined): string {
	const lines = (note ?? "").split("\n");
	const at = findLine(lines);
	if (at !== -1) {
		lines.splice(at, 1);
	}
	return lines.join("\n");
}
