import { PRIORITY_CACHE_MS, PRIORITY_MODE, REMAINDER_PRIORITY, comparePriority, priorityKey } from "./constants";
import { amountToCents } from "./money";
import type { TemplateEntry, TemplatePriority } from "./templates";
import { isBudgetTemplate, isRemainderTemplate } from "./templates";

// ── Types ────────────────────────────────────────────────────────────

type Status = "full" | "partial" | "none";
type Priority = TemplatePriority;

export interface Category {
	id: string;
	name: string;
	group_name: string;
	sort_order: number;
	group_sort_order: number;
	hidden?: boolean;
}

interface DemandRow {
	catId: string;
	catName: string;
	groupName: string;
	sortOrder: number;
	groupSortOrder: number;
	priority: Priority;
	requestedCents: number;
	allocatedCents: number;
	currentCents: number;
	gapCents: number;
	priorities: Priority[];
	templateCount: number;
	rawTemplates: unknown[];
	source?: string;
	remainderWeight?: number;
	remainderCapCents?: number | null;
}

interface TierRow {
	catId: string;
	catName: string;
	priority: Priority;
	requestedCents: number | null;
	allocatedCents: number;
	status: Status;
}

interface PriorityTier {
	priority: Priority;
	requestedCents: number;
	hasUnknownDemand: boolean;
	allocatedCents: number;
	rows: TierRow[];
	status?: Status;
}

interface SummaryTier {
	priority: Priority;
	requestedCents: number;
	allocatedCents: number;
	gapCents: number;
	rows: DemandRow[];
	status?: Status;
}

interface BreakdownSummary {
	sheet: string;
	month: string;
	totalAllocatedCents: number;
	tiers: PriorityTier[];
}

interface PriorityCache {
	ok: boolean;
	reason?: string;
	sheet?: string;
	month?: string;
	availableCents?: number;
	toBudgetCents?: number;
	budgetableCents?: number;
	currentTemplateBudgetCents?: number;
	tiers?: SummaryTier[];
	totalRequestedCents?: number;
	totalAllocatedCents?: number;
	gapCents?: number;
	remainingCents?: number;
	mode?: string;
	usedDryRun?: boolean;
	fallbackCount?: number;
	watermark?: Priority;
	highestFundedPriority?: Priority;
	computedAt: number;
}

interface DiffRow {
	id: string;
	name: string;
	delta: number;
	before?: number;
}

interface DiffGroup {
	rows?: DiffRow[];
}

interface Diff {
	groups?: DiffGroup[];
}

interface DryRunResult {
	perTemplate: number[];
}

interface DryRunOutput {
	result: DryRunResult;
	engineEntries: TemplateEntry[];
}

interface PriorityPlannerDeps {
	getCurrentSheet: () => string;
	isBudgetPage: () => boolean;
	loadCategories: () => Promise<Category[]>;
	loadTemplatesByCategoryId: () => Promise<Map<string, TemplateEntry[]>>;
	getCells: (sheet: string, cellNames: string[]) => Promise<Map<string, number>>;
	sheetToMonthKey: (sheet: string) => string;
	sheetToMonthLabel: (sheet: string) => string;
}

interface LineItem {
	entry: TemplateEntry | null;
	index: number;
	priority: Priority;
	requestedCents: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

function rowSort(a: DemandRow, b: DemandRow): number {
	return (
		a.groupSortOrder - b.groupSortOrder ||
		a.groupName.localeCompare(b.groupName) ||
		a.sortOrder - b.sortOrder ||
		a.catName.localeCompare(b.catName)
	);
}

export function statusFor(requestedCents: number | null | undefined, allocatedCents: number): Status {
	if (requestedCents == null) return allocatedCents > 0 ? "partial" : "none";
	if (requestedCents <= 0) return "full";
	if (allocatedCents >= requestedCents) return "full";
	if (allocatedCents > 0) return "partial";
	return "none";
}

function addDemandRow(rowMap: Map<string, DemandRow>, row: DemandRow): DemandRow {
	const key = `${priorityKey(row.priority)}:${row.catId}`;
	const existing = rowMap.get(key);
	if (existing) {
		existing.requestedCents += row.requestedCents;
		existing.templateCount += row.templateCount || 1;
		existing.rawTemplates.push(...(row.rawTemplates || []));
		existing.priorities = Array.from(new Set([...existing.priorities, ...(row.priorities || [row.priority])])).sort(
			comparePriority,
		);
		return existing;
	}
	row.rawTemplates = row.rawTemplates || [];
	row.priorities = row.priorities || [row.priority];
	row.templateCount = row.templateCount || 1;
	rowMap.set(key, row);
	return row;
}

function parsedTemplateDemandCents(entry: TemplateEntry): number | null {
	if (!entry) return null;
	if (entry.kind === "simple" && Number.isFinite(entry.amount)) {
		return amountToCents(entry.amount!);
	}
	return null;
}

function breakdownTemplateDemandCents(
	entry: TemplateEntry,
	runningBudgetCents: number,
	dryRunCents: number | undefined,
): number | null {
	if (!entry) return null;
	if (Number.isFinite(dryRunCents) && dryRunCents! > 0) {
		return Math.max(0, Math.round(dryRunCents!));
	}
	if (entry.kind === "upto" && Number.isFinite(entry.cap)) {
		return Math.max(0, amountToCents(entry.cap!) - runningBudgetCents);
	}
	if (entry.kind === "simple" && Number.isFinite(entry.amount)) {
		const amountCents = amountToCents(entry.amount!);
		if (Number.isFinite(entry.cap)) {
			return Math.min(amountCents, Math.max(0, amountToCents(entry.cap!) - runningBudgetCents));
		}
		return amountCents;
	}
	if ((entry.kind === "periodic" || entry.kind === "by" || entry.kind === "spend") && Number.isFinite(entry.amount)) {
		return amountToCents(entry.amount!);
	}
	return null;
}

function capDemandRowsToGoal<T extends { requestedCents: number | null }>(
	rows: T[],
	goalCents: number | null | undefined,
): T[] {
	if (!goalCents || goalCents <= 0) return rows;
	const targetCents = Math.max(0, Math.round(goalCents));
	const knownTotal = rows.reduce((sum, row) => {
		return row.requestedCents == null ? sum : sum + Math.max(0, row.requestedCents);
	}, 0);
	const unknownRows = rows.filter((row) => row.requestedCents == null);
	if (unknownRows.length > 0 && knownTotal < targetCents) {
		const unknownTarget = targetCents - knownTotal;
		let remainingUnknownTarget = unknownTarget;
		let unknownIndex = 0;
		const withResiduals: T[] = [];
		for (const row of rows) {
			if (row.requestedCents == null) {
				const isLastUnknown = unknownIndex === unknownRows.length - 1;
				const requested = isLastUnknown
					? remainingUnknownTarget
					: Math.round(unknownTarget / unknownRows.length);
				const capped = Math.min(requested, remainingUnknownTarget);
				unknownIndex += 1;
				remainingUnknownTarget -= capped;
				if (capped > 0) {
					withResiduals.push(Object.assign({}, row, { requestedCents: capped }));
				}
				continue;
			}
			if (row.requestedCents > 0) withResiduals.push(row);
		}
		return withResiduals;
	}

	let remainingGoal = targetCents;
	const capped: T[] = [];
	for (const row of rows) {
		if (remainingGoal <= 0) break;
		if (row.requestedCents == null) continue;
		const requested = Math.min(row.requestedCents, remainingGoal);
		if (requested <= 0) continue;
		capped.push(Object.assign({}, row, { requestedCents: requested }));
		remainingGoal -= requested;
	}
	return capped;
}

function addBreakdownPriorityTier(tierMap: Map<string, PriorityTier>, item: TierRow): void {
	const key = priorityKey(item.priority);
	if (!tierMap.has(key)) {
		tierMap.set(key, {
			priority: item.priority,
			requestedCents: 0,
			hasUnknownDemand: false,
			allocatedCents: 0,
			rows: [],
		});
	}
	const tier = tierMap.get(key)!;
	tier.allocatedCents += item.allocatedCents;
	if (item.requestedCents == null) tier.hasUnknownDemand = true;
	else tier.requestedCents += item.requestedCents;
	tier.rows.push(item);
}

// ── Planner factory ──────────────────────────────────────────────────

export function createPriorityPlanner({
	getCurrentSheet,
	isBudgetPage,
	loadCategories,
	loadTemplatesByCategoryId,
	getCells,
	sheetToMonthKey,
	sheetToMonthLabel,
}: PriorityPlannerDeps) {
	async function buildBreakdownPrioritySummary(sheet: string, diff: Diff): Promise<BreakdownSummary | null> {
		if (!sheet || !diff) return null;
		const monthKey = sheetToMonthKey(sheet);
		const positiveRows: DiffRow[] = [];
		for (const group of diff.groups || []) {
			for (const row of group.rows || []) {
				if (row.delta > 0) positiveRows.push(row);
			}
		}
		if (positiveRows.length === 0) return null;

		let templatesByCat: Map<string, TemplateEntry[]>;
		try {
			templatesByCat = await loadTemplatesByCategoryId();
		} catch {
			return null;
		}

		const tierMap = new Map<string, PriorityTier>();
		let mappedCents = 0;
		const categories = await loadCategories();
		const catMap = new Map(categories.map((cat) => [cat.id, cat]));
		const goalCells = await getCells(
			sheet,
			positiveRows.map((row) => "goal-" + row.id),
		);

		await mapWithConcurrency(positiveRows, 6, async (row) => {
			const templates = (templatesByCat.get(row.id) || []).filter(isBudgetTemplate);
			if (templates.length === 0) return;

			const regularTemplates = templates.filter((t) => !isRemainderTemplate(t));
			const remainderTemplates = templates.filter(isRemainderTemplate);
			const monthGoalCents = goalCells.get("goal-" + row.id) || 0;
			const cat: Category = catMap.get(row.id) || {
				id: row.id,
				name: row.name,
				group_name: "",
				sort_order: 0,
				group_sort_order: 0,
			};
			const dryAmounts = new Map<TemplateEntry, number>();
			const dry = await dryRunCategory(monthKey, row.id, templates);
			if (dry) {
				dry.engineEntries.forEach((entry, index) => {
					dryAmounts.set(entry, Math.max(0, dry.result.perTemplate[index] || 0));
				});
			}

			let lineItems: LineItem[] = regularTemplates
				.map((entry, index) => ({
					entry,
					index,
					priority: entry.priority,
					requestedCents: breakdownTemplateDemandCents(
						entry,
						Math.max(0, row.before || 0),
						dryAmounts.get(entry),
					),
				}))
				.sort((a, b) => comparePriority(a.priority, b.priority) || a.index - b.index);

			if (!dry) {
				const fallbackRows = new Map<string, DemandRow>();
				const priorities = Array.from(
					new Set(regularTemplates.map((t) => t.priority).filter((p) => p != null)),
				).sort(comparePriority);
				addFallbackDemandRows(
					fallbackRows,
					cat,
					templates,
					monthGoalCents,
					Math.max(0, row.before || 0),
					priorities,
				);
				lineItems = [...fallbackRows.values()]
					.map((fallback, index) => ({
						entry: null,
						index,
						priority: fallback.priority,
						requestedCents: fallback.requestedCents,
					}))
					.sort((a, b) => comparePriority(a.priority, b.priority) || a.index - b.index);
			}

			lineItems = capDemandRowsToGoal(lineItems, monthGoalCents);

			let remainingDelta = row.delta;
			let alreadyFundedCents = Math.max(0, row.before || 0);
			for (const item of lineItems) {
				if (remainingDelta <= 0) break;
				let requested = item.requestedCents;
				if (requested != null) {
					const fundedBefore = Math.min(alreadyFundedCents, requested);
					alreadyFundedCents -= fundedBefore;
					requested = Math.max(0, requested - fundedBefore);
				}
				if (requested === 0) continue;
				const allocated = requested == null ? remainingDelta : Math.min(requested, remainingDelta);
				if (allocated <= 0) continue;
				remainingDelta -= allocated;
				mappedCents += allocated;
				addBreakdownPriorityTier(tierMap, {
					priority: item.priority,
					catId: row.id,
					catName: row.name,
					requestedCents: requested,
					allocatedCents: allocated,
					status: statusFor(requested, allocated),
				});
			}

			if (remainingDelta > 0 && remainderTemplates.length > 0) {
				mappedCents += remainingDelta;
				addBreakdownPriorityTier(tierMap, {
					priority: REMAINDER_PRIORITY,
					catId: row.id,
					catName: row.name,
					requestedCents: null,
					allocatedCents: remainingDelta,
					status: "partial",
				});
			}
		});

		const tiers = [...tierMap.values()]
			.filter((tier) => tier.allocatedCents > 0)
			.sort((a, b) => comparePriority(a.priority, b.priority));
		for (const tier of tiers) {
			tier.rows.sort((a, b) => a.catName.localeCompare(b.catName));
			tier.status = tier.hasUnknownDemand ? "partial" : statusFor(tier.requestedCents, tier.allocatedCents);
		}

		if (tiers.length === 0) return null;
		return {
			sheet,
			month: sheetToMonthLabel(sheet),
			totalAllocatedCents: mappedCents,
			tiers,
		};
	}

	function addFallbackDemandRow(
		rowMap: Map<string, DemandRow>,
		cat: Category,
		entry: TemplateEntry,
		requestedCents: number,
		currentCents: number,
		priorities: Priority[],
		source: string,
	): void {
		if (requestedCents <= 0) return;
		addDemandRow(rowMap, {
			catId: cat.id,
			catName: cat.name,
			groupName: cat.group_name,
			sortOrder: cat.sort_order,
			groupSortOrder: cat.group_sort_order,
			priority: entry.priority,
			requestedCents,
			allocatedCents: 0,
			currentCents,
			gapCents: 0,
			priorities,
			templateCount: 1,
			rawTemplates: [entry.raw],
			source,
		});
	}

	function addFallbackDemandRows(
		rowMap: Map<string, DemandRow>,
		cat: Category,
		templates: TemplateEntry[],
		goalCents: number,
		currentCents: number,
		priorities: Priority[],
	): void {
		const regular = templates
			.filter((t) => !isRemainderTemplate(t))
			.map((entry, index) => ({
				entry,
				index,
				estimateCents: parsedTemplateDemandCents(entry),
			}))
			.sort((a, b) => comparePriority(a.entry.priority, b.entry.priority) || a.index - b.index);
		if (regular.length === 0) return;

		const targetCents = Math.max(0, goalCents || 0);
		let remainingTarget = targetCents;
		let knownTotalCents = 0;
		let lastKnown: (typeof regular)[number] | null = null;
		const unknown: (typeof regular)[number][] = [];

		for (const item of regular) {
			const estimateCents = item.estimateCents;
			if (estimateCents == null || estimateCents <= 0) {
				unknown.push(item);
				continue;
			}
			const requestedCents = targetCents > 0 ? Math.min(estimateCents, remainingTarget) : estimateCents;
			addFallbackDemandRow(rowMap, cat, item.entry, requestedCents, currentCents, priorities, "parsed-amount");
			knownTotalCents += requestedCents;
			remainingTarget = Math.max(0, remainingTarget - requestedCents);
			lastKnown = item;
		}

		if (targetCents <= 0) return;

		const residualCents = Math.max(0, targetCents - knownTotalCents);
		if (residualCents <= 0) return;

		if (unknown.length > 0) {
			let remainingResidual = residualCents;
			for (let i = 0; i < unknown.length; i++) {
				const isLast = i === unknown.length - 1;
				const requestedCents = isLast ? remainingResidual : Math.round(residualCents / unknown.length);
				addFallbackDemandRow(
					rowMap,
					cat,
					unknown[i].entry,
					Math.min(requestedCents, remainingResidual),
					currentCents,
					priorities,
					"goal-residual",
				);
				remainingResidual -= requestedCents;
			}
			return;
		}

		if (lastKnown) {
			addFallbackDemandRow(
				rowMap,
				cat,
				lastKnown.entry,
				residualCents,
				currentCents,
				priorities,
				"goal-residual",
			);
			return;
		}

		addFallbackDemandRow(rowMap, cat, regular[0].entry, targetCents, currentCents, priorities, "goal-cell");
	}

	async function dryRunCategory(
		month: string,
		catId: string,
		entries: TemplateEntry[],
	): Promise<DryRunOutput | null> {
		const engineEntries = entries.filter((t) => t.engineTemplate);
		if (engineEntries.length === 0) return null;
		try {
			const result = await (window as any).$send("budget/dry-run-category-template", {
				month,
				categoryId: catId,
				templates: engineEntries.map((t) => t.engineTemplate),
			});
			if (!result || !Array.isArray(result.perTemplate)) return null;
			return { result, engineEntries };
		} catch {
			return null;
		}
	}

	async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
		let index = 0;
		const workerCount = Math.min(limit, items.length);
		const workers = Array.from({ length: workerCount }, async () => {
			while (index < items.length) {
				const item = items[index++];
				await fn(item);
			}
		});
		await Promise.all(workers);
	}

	interface RemainderItem {
		row: DemandRow;
		weight: number;
		cap: number | null | undefined;
		allocated: number;
	}

	function allocateRemainderRows(remainderRows: DemandRow[], startingFunds: number): number {
		let funds = Math.max(0, startingFunds);
		const active: RemainderItem[] = remainderRows.map((row) => ({
			row,
			weight: row.remainderWeight || 1,
			cap: row.remainderCapCents,
			allocated: 0,
		}));

		while (funds > 0 && active.length > 0) {
			const available = active.filter((item) => item.cap == null || item.allocated < item.cap);
			if (available.length === 0) break;
			const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
			if (totalWeight <= 0) break;
			const before = funds;
			for (let i = 0; i < available.length && funds > 0; i++) {
				const item = available[i];
				const isLast = i === available.length - 1;
				let share = isLast ? funds : Math.round((before * item.weight) / totalWeight);
				if (item.cap != null) {
					share = Math.min(share, Math.max(0, item.cap - item.allocated));
				}
				share = Math.max(0, Math.min(share, funds));
				item.allocated += share;
				item.row.allocatedCents += share;
				item.row.requestedCents += share;
				funds -= share;
			}
			if (funds === before) break;
		}

		return funds;
	}

	// ── Priority computation ─────────────────────────────────────────────
	// Builds an overwrite-style plan: start with To Budget plus the current
	// budgets for templated categories, then run requested template demand by
	// priority. Actual's category dry-run endpoint supplies per-template demand
	// where available; older Actual builds fall back to goal-cell rollups.
	//
	// Tier shape:
	//   { priority, requestedCents, allocatedCents, gapCents,
	//     status: 'full'|'partial'|'none', rows: [...] }
	// Row shape:
	//   { catId, catName, groupName, sortOrder, groupSortOrder,
	//     requestedCents, allocatedCents, gapCents, priorities: number[] }
	let priorityCache: PriorityCache | null = null;
	let priorityPromise: Promise<PriorityCache> | null = null;
	let priorityPromiseSheet: string | null = null;

	function priorityCacheIsFreshForSheet(sheet: string): boolean {
		return (
			!!sheet &&
			!!priorityCache &&
			priorityCache.sheet === sheet &&
			Date.now() - priorityCache.computedAt < PRIORITY_CACHE_MS
		);
	}

	function priorityCacheMatchesSheet(sheet: string): boolean {
		return !!sheet && !!priorityCache && priorityCache.sheet === sheet;
	}

	function invalidatePriorityStatus(): void {
		priorityCache = null;
		priorityPromise = null;
	}

	function getCache(): PriorityCache | null {
		return priorityCache;
	}

	async function computePriorityStatus(force?: boolean): Promise<PriorityCache> {
		const sheet = isBudgetPage() ? getCurrentSheet() : null;
		if (!force && sheet && priorityCacheIsFreshForSheet(sheet)) {
			return priorityCache!;
		}
		if (!force && priorityPromise && priorityPromiseSheet === sheet) return priorityPromise;
		priorityPromiseSheet = sheet;
		priorityPromise = (async (): Promise<PriorityCache> => {
			try {
				if (!isBudgetPage()) {
					return { ok: false, reason: "not on budget page", computedAt: Date.now() };
				}
				if (!sheet) {
					return { ok: false, reason: "no visible sheet", computedAt: Date.now() };
				}
				const cats = await loadCategories();
				const templatesByCat = await loadTemplatesByCategoryId();

				const catById = new Map(cats.map((c) => [c.id, c]));
				const eligibleCats: { cat: Category; templates: TemplateEntry[] }[] = [];
				for (const [catId, tpls] of templatesByCat.entries()) {
					const cat = catById.get(catId);
					if (!cat || cat.hidden) continue;
					const budgetTpls = tpls.filter(isBudgetTemplate);
					if (budgetTpls.length === 0) continue;
					eligibleCats.push({ cat, templates: budgetTpls });
				}

				const cellNames: string[] = ["available-funds", "to-budget"];
				for (const { cat } of eligibleCats) {
					cellNames.push("goal-" + cat.id);
					cellNames.push("budget-" + cat.id);
				}
				const cellMap = await getCells(sheet, cellNames);
				const availableCents = cellMap.get("available-funds") || 0;
				const toBudgetCents = cellMap.get("to-budget") || 0;

				const rowMap = new Map<string, DemandRow>();
				const remainderMap = new Map<string, DemandRow>();
				let currentTemplateBudgetCents = 0;
				let usedDryRun = false;
				let fallbackCount = 0;

				await mapWithConcurrency(eligibleCats, 8, async ({ cat, templates }) => {
					const catId = cat.id;
					const currentCents = cellMap.get("budget-" + catId) || 0;
					const goalCents = cellMap.get("goal-" + catId) || 0;
					currentTemplateBudgetCents += currentCents;
					const priorities = Array.from(
						new Set(templates.filter((t) => !isRemainderTemplate(t)).map((t) => t.priority)),
					).sort(comparePriority);

					const dry = await dryRunCategory(sheetToMonthKey(sheet), catId, templates);
					if (dry) {
						usedDryRun = true;
						const dryDemandRows: {
							entry: TemplateEntry;
							index: number;
							priority: Priority;
							requestedCents: number;
						}[] = [];
						dry.engineEntries.forEach((entry, i) => {
							const amount = Math.max(0, dry.result.perTemplate[i] || 0);
							if (isRemainderTemplate(entry)) {
								const key = `${catId}:remainder`;
								const existing = remainderMap.get(key);
								const cap = amount > 0 ? amount : null;
								if (existing) {
									existing.remainderWeight = (existing.remainderWeight || 1) + (entry.weight || 1);
									if (cap != null) {
										existing.remainderCapCents =
											existing.remainderCapCents == null ? cap : existing.remainderCapCents + cap;
									}
									existing.rawTemplates.push(entry.raw);
									existing.templateCount += 1;
								} else {
									remainderMap.set(key, {
										catId,
										catName: cat.name,
										groupName: cat.group_name,
										sortOrder: cat.sort_order,
										groupSortOrder: cat.group_sort_order,
										priority: REMAINDER_PRIORITY,
										requestedCents: 0,
										allocatedCents: 0,
										currentCents,
										gapCents: 0,
										priorities: [REMAINDER_PRIORITY],
										templateCount: 1,
										rawTemplates: [entry.raw],
										remainderWeight: entry.weight || 1,
										remainderCapCents: cap,
										source: "dry-run",
									});
								}
								return;
							}
							if (amount <= 0) return;
							dryDemandRows.push({ entry, index: i, priority: entry.priority, requestedCents: amount });
						});

						const cappedDemandRows = capDemandRowsToGoal(
							dryDemandRows.sort((a, b) => comparePriority(a.priority, b.priority) || a.index - b.index),
							goalCents,
						);
						for (const demand of cappedDemandRows) {
							addDemandRow(rowMap, {
								catId,
								catName: cat.name,
								groupName: cat.group_name,
								sortOrder: cat.sort_order,
								groupSortOrder: cat.group_sort_order,
								priority: demand.priority,
								requestedCents: demand.requestedCents,
								allocatedCents: 0,
								currentCents,
								gapCents: 0,
								priorities,
								templateCount: 1,
								rawTemplates: [demand.entry.raw],
								source: "dry-run",
							});
						}
						return;
					}

					fallbackCount += 1;
					addFallbackDemandRows(rowMap, cat, templates, goalCents, currentCents, priorities);
					for (const entry of templates.filter(isRemainderTemplate)) {
						remainderMap.set(`${catId}:remainder`, {
							catId,
							catName: cat.name,
							groupName: cat.group_name,
							sortOrder: cat.sort_order,
							groupSortOrder: cat.group_sort_order,
							priority: REMAINDER_PRIORITY,
							requestedCents: 0,
							allocatedCents: 0,
							currentCents,
							gapCents: 0,
							priorities: [REMAINDER_PRIORITY],
							templateCount: 1,
							rawTemplates: [entry.raw],
							remainderWeight: entry.weight || 1,
							remainderCapCents: null,
							source: "parsed",
						});
					}
				});

				const regularRows = [...rowMap.values()].sort(
					(a, b) => comparePriority(a.priority, b.priority) || rowSort(a, b),
				);

				let budgetableCents = toBudgetCents;
				if (PRIORITY_MODE === "overwrite") {
					budgetableCents += currentTemplateBudgetCents;
				}

				let remainingCents = budgetableCents;
				for (const row of regularRows) {
					if (row.priority === 0) {
						row.allocatedCents = row.requestedCents;
					} else {
						row.allocatedCents = Math.max(0, Math.min(row.requestedCents, remainingCents));
					}
					row.gapCents = Math.max(0, row.requestedCents - row.allocatedCents);
					remainingCents -= row.allocatedCents;
				}

				const remainderRows = [...remainderMap.values()].sort(rowSort);
				remainingCents = allocateRemainderRows(remainderRows, remainingCents);

				const tierMap = new Map<string, SummaryTier>();
				for (const row of [...regularRows, ...remainderRows]) {
					const key = priorityKey(row.priority);
					if (!tierMap.has(key)) {
						tierMap.set(key, {
							priority: row.priority,
							requestedCents: 0,
							allocatedCents: 0,
							gapCents: 0,
							rows: [],
						});
					}
					const tier = tierMap.get(key)!;
					tier.rows.push(row);
					tier.requestedCents += row.requestedCents;
					tier.allocatedCents += row.allocatedCents;
					tier.gapCents += row.gapCents;
				}

				const sortedTiers = [...tierMap.values()].sort((a, b) => comparePriority(a.priority, b.priority));
				for (const tier of sortedTiers) {
					tier.status = statusFor(tier.requestedCents, tier.allocatedCents);
					tier.rows.sort(rowSort);
				}

				const watermarkTier = sortedTiers.find((t) => t.gapCents > 0);
				const highestFunded = [...sortedTiers]
					.reverse()
					.find((t) => t.status === "full" && t.requestedCents > 0 && t.priority != null);

				const totalRequestedCents = sortedTiers.reduce((a, t) => a + t.requestedCents, 0);
				const totalAllocatedCents = sortedTiers.reduce((a, t) => a + t.allocatedCents, 0);
				const totalGapCents = sortedTiers.reduce((a, t) => a + t.gapCents, 0);

				if (getCurrentSheet() !== sheet) {
					return { ok: false, reason: "month changed", sheet, computedAt: Date.now() };
				}

				priorityCache = {
					ok: true,
					sheet,
					month: sheetToMonthLabel(sheet),
					availableCents,
					toBudgetCents,
					budgetableCents,
					currentTemplateBudgetCents,
					tiers: sortedTiers,
					totalRequestedCents,
					totalAllocatedCents,
					gapCents: totalGapCents,
					remainingCents,
					mode: PRIORITY_MODE,
					usedDryRun,
					fallbackCount,
					watermark: watermarkTier ? watermarkTier.priority : undefined,
					highestFundedPriority: highestFunded ? highestFunded.priority : null,
					computedAt: Date.now(),
				};
				return priorityCache;
			} finally {
				priorityPromise = null;
				priorityPromiseSheet = null;
			}
		})();
		return priorityPromise;
	}

	return {
		computePriorityStatus,
		buildBreakdownPrioritySummary,
		priorityCacheIsFreshForSheet,
		priorityCacheMatchesSheet,
		invalidatePriorityStatus,
		getCache,
	};
}
