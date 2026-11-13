import { onSyncedPref, query } from "./actual-api";
import { numberPrefs } from "./number-format.svelte";

let loaded = false;
let loadGeneration = 0;
let watching = false;

/** Sets the currency and how many minor units it has, falling back to USD for a code Intl rejects. */
function setCurrency(code: string): void {
	if (!code) {
		numberPrefs.currency = "";
		numberPrefs.scale = 100;
		return;
	}
	try {
		const opts = new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: code,
		}).resolvedOptions();
		const digits = Number.isFinite(opts.maximumFractionDigits)
			? (opts.maximumFractionDigits ?? 2)
			: 2;
		numberPrefs.currency = code;
		numberPrefs.scale = Math.pow(10, digits);
	} catch {
		numberPrefs.currency = "USD";
		numberPrefs.scale = 100;
	}
}

/** Follows the number format and currency as they change in Actual's settings, so a reload isn't needed. */
function watchNumberFormat(): void {
	if (watching) {
		return;
	}
	watching = true;
	onSyncedPref("numberFormat", (value) => {
		if (value) {
			numberPrefs.format = value;
		}
	});
	onSyncedPref("defaultCurrencyCode", (value) => {
		if (value != null) {
			setCurrency(value);
		}
	});
	onSyncedPref("hideFraction", (value) => {
		if (value != null) {
			numberPrefs.hideFraction = value === "true";
		}
	});
}

export async function loadCurrency(force = false): Promise<void> {
	if (loaded && !force) {
		return;
	}
	if (force) {
		setCurrency("");
		loaded = false;
	}
	watchNumberFormat();
	const generation = ++loadGeneration;
	try {
		const rows = await query<{ id: string; value: string }[]>("preferences", {
			filter: { id: { $oneof: ["defaultCurrencyCode", "numberFormat", "hideFraction"] } },
		});
		if (generation !== loadGeneration) {
			return;
		}
		const format = rows?.find((r) => r.id === "numberFormat")?.value;
		numberPrefs.hideFraction = rows?.find((r) => r.id === "hideFraction")?.value === "true";
		if (format) {
			numberPrefs.format = format;
		}
		const code = rows?.find((r) => r.id === "defaultCurrencyCode")?.value;
		if (code && typeof code === "string") {
			setCurrency(code);
		}
	} catch {
		// fallback to USD
	}
	if (generation === loadGeneration) {
		loaded = true;
	}
}

/** The budget's currency code, or "" when none is set (call loadCurrency first). */
export function getCurrencyCode(): string {
	return numberPrefs.currency;
}

// The locale Actual formats each of its number formats with (its getNumberFormat), so ABT's
// amounts group and separate digits the same way rather than by the browser's language.
const FORMAT_LOCALES: Record<string, string> = {
	"comma-dot": "en-US",
	"dot-comma": "de-DE",
	"space-comma": "fr-FR",
	"apostrophe-dot": "de-CH",
	"comma-dot-in": "en-IN",
};

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(locale: string | undefined, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
	const key = `${locale}|${JSON.stringify(opts)}`;
	let found = formatters.get(key);
	if (!found) {
		found = new Intl.NumberFormat(locale, opts);
		formatters.set(key, found);
	}
	return found;
}

/** A plain number in Actual's number format, e.g. 1'234.5 for apostrophe-dot. */
export function fmtNumber(n: number, digits: { min?: number; max?: number } = {}): string {
	return formatter(FORMAT_LOCALES[numberPrefs.format] ?? "en-US", {
		minimumFractionDigits: digits.min ?? 0,
		maximumFractionDigits: digits.max ?? 2,
	}).format(n);
}

/** Puts the currency symbol around already-formatted digits where the browser's locale puts it. */
function withSymbol(digits: string): string {
	if (!numberPrefs.currency) {
		return digits;
	}
	const parts = formatter(undefined, {
		style: "currency",
		currency: numberPrefs.currency,
		maximumFractionDigits: 0,
	}).formatToParts(1);
	let out = "";
	let placed = false;
	for (const part of parts) {
		if (["integer", "group", "decimal", "fraction"].includes(part.type)) {
			if (!placed) {
				out += digits;
				placed = true;
			}
		} else {
			out += part.value;
		}
	}
	return out;
}

export function fmtMoney(cents: number, opts?: { sign?: boolean; short?: boolean }): string {
	const n = (cents || 0) / numberPrefs.scale;
	const abs = Math.abs(n);
	const noDecimals = numberPrefs.hideFraction || Math.round(numberPrefs.scale) === 1;
	// Rounded away, a sign would read as "-$0".
	const zero = noDecimals && Math.round(abs) === 0;
	const decimals = noDecimals ? 0 : Math.round(Math.log10(numberPrefs.scale));

	const str =
		opts?.short && abs >= 1000
			? withSymbol(`${fmtNumber(abs / 1000, { min: 1, max: 1 })}k`)
			: withSymbol(fmtNumber(abs, { min: decimals, max: decimals }));

	if (zero) {
		return str;
	}
	if (opts?.sign && cents > 0) {
		return "+" + str;
	}
	if (n < 0) {
		return "-" + str;
	}
	return str;
}

/** An amount as plain editable text in Actual's number format: no grouping, its decimal mark. */
export function formatMoneyInput(cents: number): string {
	const digits = Math.round(Math.log10(numberPrefs.scale));
	const text = (cents / numberPrefs.scale).toFixed(digits);
	return numberPrefs.format.endsWith("-comma") ? text.replace(".", ",") : text;
}

/** Parses an amount typed in Actual's number format to minor units, or null if it isn't one. */
export function parseMoney(text: string): number | null {
	const decimal = numberPrefs.format.endsWith("-comma") ? "," : ".";
	const negative = /^\s*[-−(]/.test(text);
	const cleaned = text.replace(new RegExp(`[^0-9${decimal === "," ? "," : "."}]`, "g"), "");
	const normalized = decimal === "," ? cleaned.replace(",", ".") : cleaned;
	if (!/^\d*\.?\d*$/.test(normalized) || !/\d/.test(normalized)) {
		return null;
	}
	const cents = amountToCents(parseFloat(normalized));
	return negative ? -cents : cents;
}

export function amountToCents(amount: number): number {
	if (!Number.isFinite(amount)) {
		return 0;
	}
	return Math.round(amount * numberPrefs.scale);
}
