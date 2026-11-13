/** Charges a payee needs before it can count as a steady bill. */
const MIN_HISTORY = 4;
/** A payee whose charges sit this close to their median is a steady bill, like a subscription. */
const STEADY_SPREAD = 0.1;
/** Billing rhythms a steady bill keeps, as days between charges: monthly, quarterly, yearly. */
const BILL_CYCLES: [number, number][] = [
	[27, 32],
	[85, 95],
	[350, 380],
];

/** How far from a steady bill's usual a charge has to be to count as a price change. */
export const PRICE_CHANGE = 0.25;

export function median(list: number[]): number {
	if (!list.length) {
		return 0;
	}
	const sorted = [...list].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The median gap in days between distinct dates; null with fewer than three. */
export function typicalInterval(dates: string[]): number | null {
	const days = [...new Set(dates)]
		.map((d) => Date.parse(`${d}T00:00:00Z`) / 86_400_000)
		.sort((a, b) => b - a);
	if (days.length < 3) {
		return null;
	}
	const gaps = days
		.slice(1)
		.map((d, i) => days[i] - d)
		.sort((a, b) => a - b);
	return Math.round(gaps[Math.floor(gaps.length / 2)]);
}

export interface PayeeStats {
	/** The median: one odd charge doesn't drag it the way it drags an average. */
	usual: number;
	/** Keeps both its price and a billing rhythm, as a bill does; a shop's amounts vary too much. */
	steady: boolean;
	/** Typical days between charges, when there are enough to tell. */
	interval: number | null;
}

/** One payee's amounts and dates, in any order. */
export function payeeStats(amounts: number[], dates: string[]): PayeeStats {
	const usual = median(amounts);
	const interval = typicalInterval(dates);
	const onCycle =
		interval != null && BILL_CYCLES.some(([lo, hi]) => interval >= lo && interval <= hi);
	const spread = median(amounts.map((a) => Math.abs(a - usual)));
	return {
		usual,
		interval,
		steady:
			amounts.length >= MIN_HISTORY &&
			usual !== 0 &&
			onCycle &&
			spread / Math.abs(usual) <= STEADY_SPREAD,
	};
}
