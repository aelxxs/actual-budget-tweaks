// Hover-intent delay so the card doesn't flash while sweeping the list.
const HOVER_DELAY = 600;
// Once a card has been waited for, the next row's comes quickly, until the pointer has been
// away from the cards for a moment (a tooltip's warm-up and cool-down).
const WARM_DELAY = 80;
const COOL_DOWN = 500;
// The safe triangle: from where the pointer left its row to the card's near corners. Moving
// inside it keeps the card, as crossing other rows on the diagonal would otherwise swap it.
const AIM_SLACK = 6;
// Stopping short of the card for this long counts as giving up on it.
const AIM_GRACE = 300;

type Point = { x: number; y: number };

/** A card that opens beside the row the pointer rests on, and stays while the pointer heads for it. */
export class HoverCard<T extends { id: string }> {
	shown = $state<T | null>(null);
	top = $state(0);
	left = $state(0);
	flip = $state(false);

	#warmUntil = 0;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#aim: Point | null = null;
	#passing: { el: HTMLElement; item: T } | null = null;
	#aimTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private cardSelector: string,
		private width: number,
	) {}

	enter(el: HTMLElement, item: T) {
		// Rows crossed on the way to the open card wait; the one the pointer ends on takes over.
		if (this.#aim) {
			this.#passing = { el, item };
			return;
		}
		this.#start(el, item);
	}

	leave(e: MouseEvent) {
		if (this.#aim) {
			if (this.#passing?.el === e.currentTarget) {
				this.#passing = null;
			}
			return;
		}
		this.#clearTimer();
		if (!this.shown) {
			return;
		}
		// A card is open: the pointer may be on its way to it, so it gets a safe triangle.
		this.#aim = { x: e.clientX, y: e.clientY };
		addEventListener("pointermove", this.#onAimMove);
		this.#restartAimTimer();
	}

	hide = () => {
		this.#clearTimer();
		this.stopAiming();
		if (this.shown) {
			this.#warmUntil = performance.now() + COOL_DOWN;
		}
		this.shown = null;
	};

	/** The pointer reached the card. */
	stopAiming = () => {
		if (this.#aimTimer) {
			clearTimeout(this.#aimTimer);
			this.#aimTimer = null;
		}
		removeEventListener("pointermove", this.#onAimMove);
		this.#aim = null;
		this.#passing = null;
	};

	#start(el: HTMLElement, item: T) {
		const warm = !!this.shown || performance.now() < this.#warmUntil;
		if (this.shown && this.shown.id !== item.id) {
			this.hide();
		}
		this.#clearTimer();
		this.#timer = setTimeout(() => this.#show(el, item), warm ? WARM_DELAY : HOVER_DELAY);
	}

	#show(el: HTMLElement, item: T) {
		const rect = el.getBoundingClientRect();
		this.flip = rect.right + this.width + 16 > window.innerWidth;
		this.left = this.flip ? rect.left - this.width - 10 : rect.right + 10;
		// The card moves itself up once it knows its height, so it never runs off the bottom.
		this.top = rect.top - 6;
		this.shown = item;
	}

	#clearTimer() {
		if (this.#timer) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
	}

	#restartAimTimer() {
		if (this.#aimTimer) {
			clearTimeout(this.#aimTimer);
		}
		this.#aimTimer = setTimeout(this.#giveUpAim, AIM_GRACE);
	}

	#onAimMove = (e: PointerEvent) => {
		const card = document.querySelector(this.cardSelector)?.getBoundingClientRect();
		if (!this.#aim || !card || !inTriangle(this.#aim, card, e.clientX, e.clientY)) {
			this.#giveUpAim();
			return;
		}
		this.#restartAimTimer();
	};

	#giveUpAim = () => {
		const next = this.#passing;
		this.hide();
		if (next) {
			this.#start(next.el, next.item);
		}
	};
}

function inTriangle(apex: Point, card: DOMRect, x: number, y: number) {
	const nearX = apex.x <= card.left ? card.left : card.right;
	const top = { x: nearX, y: card.top - AIM_SLACK };
	const bottom = { x: nearX, y: card.bottom + AIM_SLACK };
	// Nudged away from the card, so a wobble right at the start isn't outside already.
	const a = { x: apex.x + (nearX > apex.x ? -AIM_SLACK : AIM_SLACK), y: apex.y };
	const side = (p: Point, q: Point) => (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x);
	const d1 = side(a, top);
	const d2 = side(top, bottom);
	const d3 = side(bottom, a);
	const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
	const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
	return !(hasNeg && hasPos);
}
