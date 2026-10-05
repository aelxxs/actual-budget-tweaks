import { getValue, setValue, watchValue } from "@lib/utilities/store";

// Sub-category grouping is entirely extension-local — Actual only has
// On/Off Budget/Closed natively.
export interface AccountGroup {
	id: string;
	label: string;
	section: "onbudget" | "offbudget";
	order: number;
}

const GROUPS_KEY = "experimental-sidebar-groups";
const ASSIGNMENTS_KEY = "experimental-sidebar-account-groups";

// Account ids aren't unique across budget files, so this is scoped per
// budget — otherwise switching budgets showed the previous one's
// (now-empty) categories.
function scopedKey(base: string, budgetId: string | undefined): string {
	return budgetId ? `${base}:${budgetId}` : base;
}

export async function loadGroups(
	budgetId: string | undefined,
): Promise<Record<string, AccountGroup>> {
	return getValue<Record<string, AccountGroup>>(scopedKey(GROUPS_KEY, budgetId), {});
}

export function saveGroups(
	budgetId: string | undefined,
	groups: Record<string, AccountGroup>,
): void {
	setValue(scopedKey(GROUPS_KEY, budgetId), groups);
}

/** Follows group edits made elsewhere, such as the sidebar settings dialog. */
export function watchGroups(
	budgetId: string | undefined,
	callback: (groups: Record<string, AccountGroup>) => void,
): () => void {
	return watchValue<Record<string, AccountGroup>>(scopedKey(GROUPS_KEY, budgetId), (v) =>
		callback(v ?? {}),
	);
}

export function watchAssignments(
	budgetId: string | undefined,
	callback: (assignments: Record<string, string>) => void,
): () => void {
	return watchValue<Record<string, string>>(scopedKey(ASSIGNMENTS_KEY, budgetId), (v) =>
		callback(v ?? {}),
	);
}

export async function loadAssignments(
	budgetId: string | undefined,
): Promise<Record<string, string>> {
	return getValue<Record<string, string>>(scopedKey(ASSIGNMENTS_KEY, budgetId), {});
}

export function saveAssignments(
	budgetId: string | undefined,
	assignments: Record<string, string>,
): void {
	setValue(scopedKey(ASSIGNMENTS_KEY, budgetId), assignments);
}

export function nextGroupId(): string {
	return `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createGroup(
	groups: Record<string, AccountGroup>,
	section: "onbudget" | "offbudget",
): { id: string; groups: Record<string, AccountGroup> } {
	const id = nextGroupId();
	const order = Object.values(groups).filter((g) => g.section === section).length;
	return { id, groups: { ...groups, [id]: { id, label: "New Category", section, order } } };
}

export function renameGroup(
	groups: Record<string, AccountGroup>,
	id: string,
	label: string,
): Record<string, AccountGroup> {
	const trimmed = label.trim();
	if (!trimmed || !groups[id]) return groups;
	return { ...groups, [id]: { ...groups[id], label: trimmed } };
}

/** Deletes a group; accounts assigned to it fall back to the section's ungrouped bucket. */
export function removeGroup(
	groups: Record<string, AccountGroup>,
	assignments: Record<string, string>,
	id: string,
): { groups: Record<string, AccountGroup>; assignments: Record<string, string> } {
	const nextGroups = { ...groups };
	delete nextGroups[id];
	const nextAssignments = { ...assignments };
	for (const accountId of Object.keys(nextAssignments)) {
		if (nextAssignments[accountId] === id) delete nextAssignments[accountId];
	}
	return { groups: nextGroups, assignments: nextAssignments };
}

export function assignAccount(
	assignments: Record<string, string>,
	accountId: string,
	groupId: string | null,
): Record<string, string> {
	const next = { ...assignments };
	if (groupId) next[accountId] = groupId;
	else delete next[accountId];
	return next;
}
