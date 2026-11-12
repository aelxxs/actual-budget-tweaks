/** Imported transactions waiting for review, kept per budget and shared by everyone who opens it. */
export interface ReviewQueue {
	version: 1;
	/** One batch per sync that imported anything, newest first. */
	batches: ImportBatch[];
}

export interface ImportBatch {
	/** When the sync finished (ms since epoch); also the batch's id. */
	at: number;
	/** How many transactions this sync imported, for "6 imported · 2 left". */
	total: number;
	/** Transaction ids not reviewed yet. The batch is removed once this is empty. */
	pending: string[];
}

export const QUEUE_KEY = "sync-recap-queue";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const emptyQueue = (): ReviewQueue => ({ version: 1, batches: [] });

/** A stored queue, with anything malformed dropped. */
export function toQueue(raw: unknown): ReviewQueue {
	const batches = (raw as { batches?: unknown } | null)?.batches;
	if (!Array.isArray(batches)) {
		return emptyQueue();
	}
	return {
		version: 1,
		batches: batches
			.filter(
				(b): b is ImportBatch =>
					typeof b?.at === "number" &&
					Array.isArray(b.pending) &&
					b.pending.every((id: unknown) => typeof id === "string"),
			)
			.map((b) => ({ at: b.at, total: Number(b.total) || b.pending.length, pending: b.pending }))
			.filter((b) => b.pending.length > 0)
			.sort((a, b) => b.at - a.at),
	};
}

export const pendingIds = (queue: ReviewQueue): string[] => queue.batches.flatMap((b) => b.pending);

/** A sync's imports added at the front; ids already waiting stay in their own batch. */
export function withBatch(queue: ReviewQueue, ids: string[], at: number): ReviewQueue {
	const waiting = new Set(pendingIds(queue));
	const fresh = [...new Set(ids)].filter((id) => !waiting.has(id));
	if (!fresh.length) {
		return queue;
	}
	return {
		version: 1,
		batches: [{ at, total: fresh.length, pending: fresh }, ...queue.batches],
	};
}

/** The queue with these ids reviewed. */
export function without(queue: ReviewQueue, ids: Iterable<string>): ReviewQueue {
	const done = new Set(ids);
	return {
		version: 1,
		batches: queue.batches
			.map((b) => ({ ...b, pending: b.pending.filter((id) => !done.has(id)) }))
			.filter((b) => b.pending.length > 0),
	};
}

/** Drops transactions that no longer exist, and batches past 30 days. */
export function pruned(queue: ReviewQueue, existing: Set<string>, now: number): ReviewQueue {
	return {
		version: 1,
		batches: queue.batches
			.filter((b) => now - b.at < MAX_AGE_MS)
			.map((b) => ({ ...b, pending: b.pending.filter((id) => existing.has(id)) }))
			.filter((b) => b.pending.length > 0),
	};
}

export function sameQueue(a: ReviewQueue, b: ReviewQueue): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}
