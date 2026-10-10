import type { IconPickerResult } from "@lib/components/IconPickerPopover.svelte";
import { dispatch, loadCurrentBudgetId, send } from "@lib/utilities/actual-api";
import { getValue, setValue, watchValue } from "@lib/utilities/store";

export type FileState = "local" | "remote" | "synced" | "detached" | "broken" | "unknown";

export interface BudgetFile {
	id?: string;
	cloudFileId?: string;
	groupId?: string;
	name: string;
	state: FileState;
}

interface RawBudget {
	id: string;
	cloudFileId?: string;
	groupId?: string;
	name: string;
}

// Actual's `get-remote-files` result — its cloud id field is `fileId`, not
// `cloudFileId` (that's the *local* record's own reference name, see
// RawBudget above).
interface RawRemoteFile {
	fileId: string;
	groupId: string;
	name: string;
	deleted?: boolean;
}

// Mirrors budgetfilesSlice.ts's reconcileFiles() — matches local budgets
// against the remote list to determine each one's real sync state.
function reconcileFiles(
	localFiles: RawBudget[],
	remoteFiles: RawRemoteFile[] | null,
): BudgetFile[] {
	const reconciled = new Set<string>();

	const files: BudgetFile[] = localFiles.map((local) => {
		if (!local.cloudFileId || !local.groupId) {
			return { id: local.id, name: local.name, state: "local" };
		}
		if (remoteFiles == null) {
			return {
				id: local.id,
				cloudFileId: local.cloudFileId,
				groupId: local.groupId,
				name: local.name,
				state: "unknown",
			};
		}
		const remote = remoteFiles.find((f) => f.fileId === local.cloudFileId);
		if (!remote) {
			return {
				id: local.id,
				cloudFileId: local.cloudFileId,
				groupId: local.groupId,
				name: local.name,
				state: "broken",
			};
		}
		reconciled.add(remote.fileId);
		return {
			id: local.id,
			cloudFileId: local.cloudFileId,
			groupId: local.groupId,
			name: remote.name,
			state: remote.groupId === local.groupId ? "synced" : "detached",
		};
	});

	const remoteOnly: BudgetFile[] = (remoteFiles || [])
		.filter((f) => !reconciled.has(f.fileId) && !f.deleted)
		.map((f) => ({
			cloudFileId: f.fileId,
			groupId: f.groupId,
			name: f.name,
			state: "remote" as const,
		}));

	return [...files, ...remoteOnly].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadBudgetFiles(): Promise<BudgetFile[]> {
	const [budgets, remoteFiles] = await Promise.all([
		send<RawBudget[]>("get-budgets"),
		send<RawRemoteFile[]>("get-remote-files").catch(() => null),
	]);
	return reconcileFiles(budgets, remoteFiles);
}

/** The currently open budget's display name — resolved from the same file
 * list/id pair the header's switcher already loads (loadBudgetFiles's `name`
 * is real and current, confirmed against live output), rather than a
 * separate guess at load-prefs's shape or scraping it off the native DOM. */
export async function loadCurrentBudgetName(): Promise<string> {
	const [id, files] = await Promise.all([loadCurrentBudgetId(), loadBudgetFiles()]);
	return files.find((f) => f.id === id)?.name || "Budget";
}

export async function selectBudgetFile(file: BudgetFile): Promise<void> {
	if (file.id) {
		await dispatch("closeAndLoadBudget", { fileId: file.id });
	} else if (file.cloudFileId) {
		// `fileId`, matching closeAndLoadBudget's convention above.
		await dispatch("closeAndDownloadBudget", { fileId: file.cloudFileId });
	}
}

/** Returns to the file-picker screen — matches the native panel's "Switch file". */
export async function closeToFileList(): Promise<void> {
	await dispatch("closeBudget");
}

export async function renameBudget(name: string): Promise<void> {
	await dispatch("savePrefs", { prefs: { budgetName: name } });
}

export type BudgetIcon = IconPickerResult;

const BUDGET_ICON_STORAGE_KEY = "abt-budget-icons";

let iconCache: Record<string, BudgetIcon> | null = null;
// Settings sync can replace the map; a stale cache would write the old one back.
watchValue<Record<string, BudgetIcon>>(BUDGET_ICON_STORAGE_KEY, (icons) => {
	iconCache = icons ?? {};
});

async function loadBudgetIcons(): Promise<Record<string, BudgetIcon>> {
	if (!iconCache) {
		iconCache = (await getValue(
			BUDGET_ICON_STORAGE_KEY,
			{} as Record<string, BudgetIcon>,
		)) as Record<string, BudgetIcon>;
	}
	return iconCache;
}

export async function loadBudgetIcon(budgetId: string): Promise<BudgetIcon | undefined> {
	const icons = await loadBudgetIcons();
	return icons[budgetId];
}

export async function setBudgetIcon(budgetId: string, icon: BudgetIcon): Promise<void> {
	const icons = await loadBudgetIcons();
	icons[budgetId] = icon;
	await setValue(BUDGET_ICON_STORAGE_KEY, icons);
}

export async function removeBudgetIcon(budgetId: string): Promise<void> {
	const icons = await loadBudgetIcons();
	delete icons[budgetId];
	await setValue(BUDGET_ICON_STORAGE_KEY, icons);
}
