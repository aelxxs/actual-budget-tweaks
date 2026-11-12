import { type BudgetValue, followBudgetValue } from "@lib/utilities/budget-value";
import { countByAccount } from "./data";
import { emptyQueue, pendingIds, QUEUE_KEY, type ReviewQueue, sameQueue, toQueue } from "./queue";

/** The open budget's review queue, kept live while Sync recap is on. */
export const reviewState = $state<{ queue: ReviewQueue; byAccount: Record<string, number> }>({
	queue: emptyQueue(),
	byAccount: {},
});

// Read once per queue change, for the sidebar's account cards.
let countSeq = 0;
function recount(queue: ReviewQueue): void {
	const seq = ++countSeq;
	void countByAccount(pendingIds(queue))
		.catch(() => ({}))
		.then((counts) => {
			if (seq === countSeq) {
				reviewState.byAccount = counts;
			}
		});
}

let followed: BudgetValue | null = null;

export function followQueue(): () => void {
	followed = followBudgetValue(QUEUE_KEY, (value) => {
		reviewState.queue = toQueue(value);
		recount(reviewState.queue);
	});
	return () => {
		followed?.stop();
		followed = null;
		countSeq++;
		reviewState.queue = emptyQueue();
		reviewState.byAccount = {};
	};
}

/** Saves the queue as `change` leaves it; a change that alters nothing writes nothing. */
export async function updateQueue(change: (queue: ReviewQueue) => ReviewQueue): Promise<void> {
	const next = change(reviewState.queue);
	if (sameQueue(next, reviewState.queue)) {
		return;
	}
	reviewState.queue = next;
	recount(next);
	await followed?.save(next);
}
