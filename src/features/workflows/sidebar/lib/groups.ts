import { invalidateQueries, onListChange, send } from "@lib/utilities/actual-api";
import { getValue, setValue, watchValue } from "@lib/utilities/store";

export type Section = "onbudget" | "offbudget";

export interface AccountGroup {
	id: string;
	label: string;
	/** For a native group, only where it shows while it has no accounts. */
	section: Section;
	order: number;
	/** Stored in the budget (Actual 26.10+), and shown in every section it has accounts in. */
	native?: boolean;
}

export interface GroupState {
	groups: Record<string, AccountGroup>;
	assignments: Record<string, string>;
	native: boolean;
	/** ABT-only groups that could be moved into Actual, which has none yet. */
	importable: boolean;
}

const GROUPS_KEY = "experimental-sidebar-groups";
const ASSIGNMENTS_KEY = "experimental-sidebar-account-groups";
const COLLAPSED_KEY = "experimental-sidebar-collapsed-groups";
const HOMES_KEY = "experimental-sidebar-group-sections";
const NEW_GROUP_LABEL = "New Category";
const CHANGED_EVENT = "abt:account-groups-changed";

interface NativeGroup {
	id: string;
	name: string;
	sort_order: number;
}

interface NativeAccount {
	id: string;
	offbudget: boolean | number;
	account_group_id?: string | null;
}

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

async function loadNative(): Promise<{
	groups: NativeGroup[];
	accounts: NativeAccount[];
} | null> {
	let groups: NativeGroup[];
	try {
		groups = await send<NativeGroup[]>("account-groups-get");
	} catch {
		return null;
	}
	if (!Array.isArray(groups)) {
		return null;
	}
	const accounts = await send<NativeAccount[]>("accounts-get");
	return { groups, accounts: Array.isArray(accounts) ? accounts : [] };
}

/** Actual's own groups when it has them, otherwise ABT's. Older Actual always gets ABT's. */
export async function loadGroupState(budgetId: string | undefined): Promise<GroupState> {
	const [groups, assignments, native] = await Promise.all([
		loadGroups(budgetId),
		loadAssignments(budgetId),
		loadNative(),
	]);
	if (!native || (native.groups.length === 0 && Object.keys(groups).length > 0)) {
		return { groups, assignments, native: false, importable: !!native };
	}
	const homes = await getValue<Record<string, Section>>(scopedKey(HOMES_KEY, budgetId), {});
	return {
		groups: Object.fromEntries(
			native.groups.map((g) => [
				g.id,
				{
					id: g.id,
					label: g.name,
					section: homes[g.id] ?? "onbudget",
					order: g.sort_order,
					native: true,
				},
			]),
		),
		assignments: Object.fromEntries(
			native.accounts.flatMap((a) => (a.account_group_id ? [[a.id, a.account_group_id]] : [])),
		),
		native: true,
		importable: false,
	};
}

/** Follows group edits from ABT's other views, Actual's own UI, and other devices. */
export function watchGroupState(
	budgetId: string | undefined,
	callback: (state: GroupState) => void,
): () => void {
	let latest = 0;
	const reload = () => {
		const run = ++latest;
		void loadGroupState(budgetId).then((state) => {
			if (run === latest) {
				callback(state);
			}
		});
	};
	reload();
	const stops = [
		watchGroups(budgetId, reload),
		watchAssignments(budgetId, reload),
		watchValue(scopedKey(HOMES_KEY, budgetId), reload),
		onListChange("account-groups", reload),
		onListChange("accounts", reload),
	];
	// Actual only refetches its group list while its own sidebar shows it.
	document.addEventListener(CHANGED_EVENT, reload);
	return () => {
		latest = -1;
		document.removeEventListener(CHANGED_EVENT, reload);
		for (const stop of stops) {
			stop();
		}
	};
}

async function setHome(budgetId: string | undefined, id: string, section: Section | null) {
	const key = scopedKey(HOMES_KEY, budgetId);
	const homes = { ...(await getValue<Record<string, Section>>(key, {})) };
	if (section) {
		homes[id] = section;
	} else {
		delete homes[id];
	}
	await setValue(key, homes);
}

function refreshNative() {
	invalidateQueries(["account-groups"]);
	invalidateQueries(["accounts"]);
	document.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

/** Creates an empty group and returns its id. */
export async function addGroup(
	budgetId: string | undefined,
	state: GroupState,
	section: Section,
): Promise<string> {
	if (!state.native) {
		const created = createGroup(state.groups, section);
		saveGroups(budgetId, created.groups);
		return created.id;
	}
	const id = await send<string>("account-group-create", { name: NEW_GROUP_LABEL });
	await setHome(budgetId, id, section);
	refreshNative();
	return id;
}

export async function renameGroupTo(
	budgetId: string | undefined,
	state: GroupState,
	id: string,
	label: string,
): Promise<void> {
	const next = renameGroup(state.groups, id, label);
	if (next === state.groups) {
		return;
	}
	if (!state.native) {
		saveGroups(budgetId, next);
		return;
	}
	await send("account-group-update", { id, name: next[id].label });
	refreshNative();
}

/** Deletes a group; its accounts go back to their section's ungrouped list. */
export async function deleteGroup(
	budgetId: string | undefined,
	state: GroupState,
	id: string,
): Promise<void> {
	if (!state.native) {
		const result = removeGroup(state.groups, state.assignments, id);
		saveGroups(budgetId, result.groups);
		saveAssignments(budgetId, result.assignments);
		return;
	}
	await send("account-group-delete", { id });
	await setHome(budgetId, id, null);
	refreshNative();
}

export async function moveToGroup(
	budgetId: string | undefined,
	state: GroupState,
	accountId: string,
	groupId: string | null,
): Promise<void> {
	if (!state.native) {
		saveAssignments(budgetId, assignAccount(state.assignments, accountId, groupId));
		return;
	}
	await send("account-update", { id: accountId, account_group_id: groupId });
	refreshNative();
}

/** A section's groups with `id` moved in front of `beforeId`, or to the end when it's null. */
export function reorderGroups(
	list: AccountGroup[],
	id: string,
	beforeId: string | null,
): AccountGroup[] {
	const moving = list.find((g) => g.id === id);
	if (!moving) {
		return list;
	}
	const rest = list.filter((g) => g.id !== id);
	const at = beforeId ? rest.findIndex((g) => g.id === beforeId) : -1;
	rest.splice(at === -1 ? rest.length : at, 0, moving);
	return rest.map((g, order) => ({ ...g, order }));
}

export async function moveGroup(
	budgetId: string | undefined,
	state: GroupState,
	reordered: AccountGroup[],
	id: string,
	beforeId: string | null,
): Promise<void> {
	if (!state.native) {
		saveGroups(budgetId, {
			...state.groups,
			...Object.fromEntries(reordered.map((g) => [g.id, g])),
		});
		return;
	}
	await send("account-group-move", { id, targetId: beforeId });
	refreshNative();
}

/**
 * Moves ABT's groups into the budget, merging same-named ones across sections, then clears ABT's
 * copy so they can't come back if every native group is later deleted.
 */
export async function importGroups(budgetId: string | undefined): Promise<void> {
	const [groups, assignments, native] = await Promise.all([
		loadGroups(budgetId),
		loadAssignments(budgetId),
		loadNative(),
	]);
	if (!native || native.groups.length > 0) {
		return;
	}
	const byName = new Map<string, string>();
	const nativeIds = new Map<string, string>();
	const sorted = Object.values(groups).sort(
		(a, b) => a.section.localeCompare(b.section) || a.order - b.order,
	);
	for (const group of sorted) {
		const name = group.label.trim() || NEW_GROUP_LABEL;
		let id = byName.get(name.toLowerCase());
		if (!id) {
			id = await send<string>("account-group-create", { name });
			byName.set(name.toLowerCase(), id);
			await setHome(budgetId, id, group.section);
		}
		nativeIds.set(group.id, id);
	}
	for (const account of native.accounts) {
		const local = groupOf({ id: account.id, offbudget: !!account.offbudget }, assignments, groups);
		const id = local ? nativeIds.get(local) : undefined;
		if (id) {
			await send("account-update", { id: account.id, account_group_id: id });
		}
	}
	saveGroups(budgetId, {});
	saveAssignments(budgetId, {});
	refreshNative();
}

/**
 * The groups shown in a section: a native one wherever it has open accounts, or in its own section
 * while it has none; an ABT one only in its own.
 */
export function groupsIn(
	section: Section,
	state: Pick<GroupState, "groups" | "assignments">,
	accounts: { id: string; offbudget: boolean; closed?: boolean }[],
): AccountGroup[] {
	const sides = new Map<string, Set<Section>>();
	for (const account of accounts) {
		const id = !account.closed && groupOf(account, state.assignments, state.groups);
		if (id) {
			const side = account.offbudget ? "offbudget" : "onbudget";
			sides.set(id, (sides.get(id) ?? new Set()).add(side));
		}
	}
	return Object.values(state.groups)
		.filter((g) =>
			g.native && sides.has(g.id) ? sides.get(g.id)!.has(section) : g.section === section,
		)
		.sort((a, b) => a.order - b.order);
}

export function nextGroupId(): string {
	return `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createGroup(
	groups: Record<string, AccountGroup>,
	section: Section,
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
	if (!trimmed || !groups[id]) {
		return groups;
	}
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
		if (nextAssignments[accountId] === id) {
			delete nextAssignments[accountId];
		}
	}
	return { groups: nextGroups, assignments: nextAssignments };
}

/**
 * The group an account shows under. Only a group in its own section counts: one left from the other
 * section (the account moved on or off budget) would otherwise hide it from both.
 */
export function groupOf(
	account: { id: string; offbudget: boolean },
	assignments: Record<string, string>,
	groups: Record<string, AccountGroup>,
): string | null {
	const group = groups[assignments[account.id]];
	if (!group) {
		return null;
	}
	return group.native || group.section === (account.offbudget ? "offbudget" : "onbudget")
		? group.id
		: null;
}

export function assignAccount(
	assignments: Record<string, string>,
	accountId: string,
	groupId: string | null,
): Record<string, string> {
	const next = { ...assignments };
	if (groupId) {
		next[accountId] = groupId;
	} else {
		delete next[accountId];
	}
	return next;
}

/** Which groups are collapsed, shared by the account list and the rail. */
export async function loadCollapsedGroups(): Promise<Record<string, boolean>> {
	return getValue<Record<string, boolean>>(COLLAPSED_KEY, {});
}

export function saveCollapsedGroups(collapsed: Record<string, boolean>): void {
	setValue(COLLAPSED_KEY, collapsed);
}

export function watchCollapsedGroups(
	callback: (collapsed: Record<string, boolean>) => void,
): () => void {
	return watchValue<Record<string, boolean>>(COLLAPSED_KEY, (v) => callback(v ?? {}));
}
