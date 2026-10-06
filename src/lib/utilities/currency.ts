import { query } from "./actual-api";

let currencyCode: string | null = null;
// Actual's own number format, e.g. "comma-dot" (1,234.56) or "dot-comma" (1.234,56).
let numberFormat = "comma-dot";
let currencyScale = 100;
let loaded = false;
let loadGeneration = 0;

export async function loadCurrency(force = false): Promise<void> {
	if (loaded && !force) return;
	if (force) {
		currencyCode = null;
		currencyScale = 100;
		loaded = false;
	}
	const generation = ++loadGeneration;
	try {
		const rows = await query<{ id: string; value: string }[]>("preferences", {
			filter: { id: { $oneof: ["defaultCurrencyCode", "numberFormat"] } },
		});
		if (generation !== loadGeneration) return;
		const format = rows?.find((r) => r.id === "numberFormat")?.value;
		if (format) numberFormat = format;
		const code = rows?.find((r) => r.id === "defaultCurrencyCode")?.value;
		if (code && typeof code === "string") {
			currencyCode = code;
			try {
				const opts = new Intl.NumberFormat(undefined, {
					style: "currency",
					currency: code,
				}).resolvedOptions();
				const digits = Number.isFinite(opts.maximumFractionDigits)
					? (opts.maximumFractionDigits ?? 2)
					: 2;
				currencyScale = Math.pow(10, digits);
			} catch {
				currencyCode = "USD";
				currencyScale = 100;
			}
		}
	} catch {
		// fallback to USD
	}
	if (generation === loadGeneration) loaded = true;
}

/** The budget's currency code, or "" when none is set (call loadCurrency first). */
export function getCurrencyCode(): string {
	return currencyCode ?? "";
}

export function fmtMoney(cents: number, opts?: { sign?: boolean; short?: boolean }): string {
	const n = (cents || 0) / currencyScale;
	const abs = Math.abs(n);
	const noDecimals = Math.round(currencyScale) === 1;

	const fmtOpts: Intl.NumberFormatOptions = currencyCode
		? { style: "currency", currency: currencyCode }
		: { style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 };

	if (noDecimals) {
		fmtOpts.minimumFractionDigits = 0;
		fmtOpts.maximumFractionDigits = 0;
	}

	let str: string;
	if (opts?.short && abs >= 1000) {
		const k = abs / 1000;
		str =
			new Intl.NumberFormat(undefined, {
				...fmtOpts,
				minimumFractionDigits: 1,
				maximumFractionDigits: 1,
			}).format(k) + "k";
	} else {
		str = new Intl.NumberFormat(undefined, fmtOpts).format(abs);
	}

	if (opts?.sign && cents > 0) return "+" + str;
	if (n < 0) return "-" + str;
	return str;
}

/** An amount as plain editable text in Actual's number format: no grouping, its decimal mark. */
export function formatMoneyInput(cents: number): string {
	const digits = Math.round(Math.log10(currencyScale));
	const text = (cents / currencyScale).toFixed(digits);
	return numberFormat.endsWith("-comma") ? text.replace(".", ",") : text;
}

/** Parses an amount typed in Actual's number format to minor units, or null if it isn't one. */
export function parseMoney(text: string): number | null {
	const decimal = numberFormat.endsWith("-comma") ? "," : ".";
	const negative = /^\s*[-−(]/.test(text);
	const cleaned = text.replace(new RegExp(`[^0-9${decimal === "," ? "," : "."}]`, "g"), "");
	const normalized = decimal === "," ? cleaned.replace(",", ".") : cleaned;
	if (!/^\d*\.?\d*$/.test(normalized) || !/\d/.test(normalized)) return null;
	const cents = amountToCents(parseFloat(normalized));
	return negative ? -cents : cents;
}

export function amountToCents(amount: number): number {
	if (!Number.isFinite(amount)) return 0;
	return Math.round(amount * currencyScale);
}
