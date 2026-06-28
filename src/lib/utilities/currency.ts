import { query } from "./actual-api";

let currencyCode: string | null = null;
let currencyScale = 100;
let loaded = false;

export async function loadCurrency(): Promise<void> {
	if (loaded) return;
	try {
		const rows = await query<{ id: string; value: string }[]>("preferences", {
			filter: { id: "defaultCurrencyCode" },
		});
		const code = rows?.[0]?.value;
		if (code && typeof code === "string") {
			currencyCode = code;
			try {
				const opts = new Intl.NumberFormat(undefined, {
					style: "currency",
					currency: code,
				}).resolvedOptions();
				const digits = Number.isFinite(opts.maximumFractionDigits) ? (opts.maximumFractionDigits ?? 2) : 2;
				currencyScale = Math.pow(10, digits);
			} catch {
				currencyCode = "USD";
				currencyScale = 100;
			}
		}
	} catch {
		// fallback to USD
	}
	loaded = true;
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
		str = new Intl.NumberFormat(undefined, { ...fmtOpts, minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(k) + "k";
	} else {
		str = new Intl.NumberFormat(undefined, fmtOpts).format(abs);
	}

	if (opts?.sign && cents > 0) return "+" + str;
	if (n < 0) return "-" + str;
	return str;
}
