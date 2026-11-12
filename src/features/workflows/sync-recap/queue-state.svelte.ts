import { type BudgetValue, followBudgetValue } from "@lib/utilities/budget-value";
import { emptyQueue, QUEUE_KEY, type ReviewQueue, sameQueue, toQueue } from "./queue";

/** The open budget's review queue, kept live while Sync recap is on. */
export const reviewState = $state<{ queue: ReviewQueue }>({ queue: emptyQueue() });

let followed: BudgetValue | null = null;

export function followQueue(): () => void {
	followed = followBudgetValue(QUEUE_KEY, (value) => (reviewState.queue = toQueue(value)));
	return () => {
		followed?.stop();
		followed = null;
		reviewState.queue = emptyQueue();
	};
}

/** Saves the queue as `change` leaves it; a change that alters nothing writes nothing. */
export async function updateQueue(change: (queue: ReviewQueue) => ReviewQueue): Promise<void> {
	const next = change(reviewState.queue);
	if (sameQueue(next, reviewState.queue)) {
		return;
	}
	reviewState.queue = next;
	await followed?.save(next);
}
