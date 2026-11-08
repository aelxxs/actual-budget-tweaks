import { defineSetting } from "@features/types";

/** The cards that can fill the summary row's two middle slots. */
export const SLOT_CARDS = [
	{ id: "spent", label: "Spent" },
	{ id: "targets", label: "Targets funded" },
	{ id: "runway", label: "Months ahead" },
	{ id: "pinned", label: "Pinned category" },
	{ id: "income", label: "Income" },
	{ id: "change", label: "Biggest change" },
] as const;

export type SlotCardId = (typeof SLOT_CARDS)[number]["id"];

export interface SummarySlots {
	cards: [SlotCardId, SlotCardId];
	/** The Pinned category card's category. */
	pinned: string | null;
}

export const SLOTS_KEY = "summary-slots";

export const defaultSlots = (): SummarySlots => ({ cards: ["spent", "targets"], pinned: null });

const isCard = (id: unknown): id is SlotCardId => SLOT_CARDS.some((card) => card.id === id);

/** A saved choice, with unknown cards back to their defaults. */
export function toSlots(raw: unknown): SummarySlots {
	const saved = (raw ?? {}) as Partial<Record<keyof SummarySlots, unknown>>;
	const fallback = defaultSlots();
	const cards = Array.isArray(saved.cards) ? saved.cards : [];
	const first = isCard(cards[0]) ? cards[0] : fallback.cards[0];
	let second = isCard(cards[1]) ? cards[1] : fallback.cards[1];
	if (second === first) {
		second = SLOT_CARDS.find((card) => card.id !== first)!.id;
	}
	return {
		cards: [first, second],
		pinned: typeof saved.pinned === "string" ? saved.pinned : null,
	};
}

export const slotLabel = (id: SlotCardId) => SLOT_CARDS.find((card) => card.id === id)!.label;

/** Listed for settings sync only; it's edited from the summary row's cards. */
export const summarySlots = defineSetting({
	type: "custom",
	label: "Summary row cards",
	context: {
		key: SLOTS_KEY,
		defaultValue: null,
	},
	init: () => {},
});
