/**
 * Marks a run of budget edits made in many calls (covering overspending category by category),
 * so live views hold their refreshes and catch up once at the end instead of after every step.
 */
let depth = 0;
const endListeners = new Set<() => void>();

export function isBulkEditing(): boolean {
	return depth > 0;
}

export async function bulkEdit<T>(edits: () => Promise<T>): Promise<T> {
	depth++;
	try {
		return await edits();
	} finally {
		depth--;
		if (depth === 0) for (const listener of endListeners) listener();
	}
}

/** Calls back each time a bulk edit finishes; returns an unsubscribe. */
export function onBulkEditEnd(listener: () => void): () => void {
	endListeners.add(listener);
	return () => endListeners.delete(listener);
}
