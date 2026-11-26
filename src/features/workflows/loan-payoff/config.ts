/*
 * A loan's settings as they're stored, one per account. No imports and no DOM, so the unit test
 * can load it as it is.
 */

export interface LoanConfig {
	/** Annual rate as a fraction: 0.0514 for 5.14%. */
	rate?: number;
	daycount?: "act365" | "monthly";
	interestDay?: number;
	/** In the currency's main unit (1860.5), not cents. */
	payment?: number;
	paymentDay?: number;
	/** The payee interest charges are posted under. */
	interestPayee?: string;
}

function number(value: unknown, min: number, max: number): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
		? value
		: undefined;
}

function day(value: unknown): number | undefined {
	const n = number(value, 1, 31);
	return n === undefined ? undefined : Math.round(n);
}

/**
 * A stored value as settings, or null when it isn't any. Values that don't hold up are left out,
 * and the keys come back in one order, whatever order storage kept them in, so two can be
 * compared as text.
 */
export function toConfig(raw: unknown): LoanConfig | null {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		return null;
	}
	const stored = raw as Record<string, unknown>;
	const config: LoanConfig = {
		rate: number(stored.rate, 0, 10),
		daycount:
			stored.daycount === "act365" || stored.daycount === "monthly" ? stored.daycount : undefined,
		interestDay: day(stored.interestDay),
		payment: number(stored.payment, 0, Number.MAX_SAFE_INTEGER),
		paymentDay: day(stored.paymentDay),
		interestPayee:
			typeof stored.interestPayee === "string" && stored.interestPayee.trim()
				? stored.interestPayee.trim()
				: undefined,
	};
	for (const key of Object.keys(config) as (keyof LoanConfig)[]) {
		if (config[key] === undefined) {
			delete config[key];
		}
	}
	return config;
}
