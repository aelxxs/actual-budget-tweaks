/** Overview's cards that can be moved and hidden; Overspent stays first, as an alert. */
export const OVERVIEW_CARDS = [
	{ id: "this-month", label: "This Month" },
	{ id: "income", label: "Income" },
	{ id: "next-month", label: "Next Month" },
	{ id: "goals", label: "Targets to Fund" },
	{ id: "long-goals", label: "Long-term Goals" },
	{ id: "trend", label: "Over / Under Budget" },
	{ id: "moves", label: "Reassigned" },
	{ id: "coming-up", label: "Coming Up" },
] as const;

export type CardId = (typeof OVERVIEW_CARDS)[number]["id"];

/** The Apply bar above the cards: it can be hidden, but stays on top. */
export const TEMPLATES_BAR = "templates";

type Hideable = CardId | typeof TEMPLATES_BAR;

/** Every card in its place; hidden ones keep theirs for when they're shown again. */
export interface CardLayout {
	order: CardId[];
	hidden: Hideable[];
}

export const CARDS_KEY = "insights-cards";

const isCard = (id: unknown): id is CardId => OVERVIEW_CARDS.some((card) => card.id === id);
const isHideable = (id: unknown): id is Hideable => id === TEMPLATES_BAR || isCard(id);

export const defaultLayout = (): CardLayout => ({
	order: OVERVIEW_CARDS.map((card) => card.id),
	hidden: [],
});

/** A saved layout, with unknown cards dropped and cards added since appended, shown. */
export function toLayout(raw: unknown): CardLayout {
	const saved = (raw ?? {}) as Partial<Record<keyof CardLayout, unknown>>;
	const order = [...new Set(Array.isArray(saved.order) ? saved.order.filter(isCard) : [])];
	for (const card of OVERVIEW_CARDS) {
		if (!order.includes(card.id)) {
			order.push(card.id);
		}
	}
	const hidden = Array.isArray(saved.hidden) ? saved.hidden.filter(isHideable) : [];
	return { order, hidden: [...new Set(hidden)] };
}

export const cardLabel = (id: CardId) => OVERVIEW_CARDS.find((card) => card.id === id)?.label ?? id;
