let currencyCode: string = "USD";
let currencyScale: number = 100;

// ── Currency formatting ───────────────────────────────────────────────
export function configureCurrency(code: string | null | undefined): void {
	if (!code || typeof code !== "string") return;
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

export async function loadCurrencyPreference(): Promise<void> {
	try {
		const res = await window.$query(window.$q("preferences").filter({ id: "defaultCurrencyCode" }).select("*"));
		const row = res?.data?.[0];
		configureCurrency(row?.value);
	} catch {
		configureCurrency("USD");
	}
}

interface FmtMoneyOptions {
	sign?: boolean;
}

export function fmtMoney(cents: number, opts?: FmtMoneyOptions): string {
	const sign = opts?.sign;
	const n = (cents || 0) / currencyScale;
	const abs = Math.abs(n);
	const noDecimals = Math.round(currencyScale) === 1;
	const str = new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: currencyCode,
		minimumFractionDigits: noDecimals ? 0 : undefined,
		maximumFractionDigits: noDecimals ? 0 : undefined,
	}).format(abs);
	if (sign && cents > 0) return "+" + str;
	if (n < 0) return "−" + str;
	return str;
}

export function amountToCents(amount: number): number {
	if (!Number.isFinite(amount)) return 0;
	return Math.max(0, Math.round(amount * currencyScale));
}
