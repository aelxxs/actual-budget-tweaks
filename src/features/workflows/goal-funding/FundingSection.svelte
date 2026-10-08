<script lang="ts">
	import { notify, send } from "@lib/utilities/actual-api";
	import { fmtMoney } from "@lib/utilities/currency";
	import { formatMonthLabel, sheetToMonthKey } from "@lib/utilities/template-plan/actual-data";
	import { loadGoalState, type GoalState } from "./goal-state";

	const { sheet, categoryId, initial }: { sheet: string; categoryId: string; initial: GoalState } =
		$props();

	const month = sheetToMonthKey(sheet);
	let info = $state<GoalState | null>(initial);
	let assigning = $state(false);
	let assigned = $state<number | null>(null);

	const needed = $derived(info ? Math.max(0, info.goal - info.current) : 0);
	const available = $derived(info?.toBudget == null ? 0 : Math.max(0, info.toBudget));
	const assignable = $derived(Math.min(needed, available));
	const ratio = $derived(info && info.goal > 0 ? Math.min(1, info.current / info.goal) : 0);

	const load = () => loadGoalState(sheet, categoryId);

	// Tops up rather than replacing the budget, so it never lowers what's already
	// assigned. Undoable through Actual's own undo, like any budget edit.
	async function assign() {
		if (assigning || !month) return;
		assigning = true;
		try {
			const fresh = await load();
			if (!fresh) return;
			const amount = Math.min(
				Math.max(0, fresh.goal - fresh.current),
				Math.max(0, fresh.toBudget ?? 0),
			);
			if (amount <= 0) {
				info = fresh;
				return;
			}
			await send("budget/budget-amount", {
				month,
				category: categoryId,
				amount: fresh.budgeted + amount,
			});
			assigned = amount;
			info = await load();
			// No amount: toasts sit outside privacy mode, and the section already shows it.
			void notify({ message: "Assigned to the goal" }, { title: "Undo", action: undoAssign });
		} catch (err) {
			void notify({ type: "error", message: "Couldn't assign to the goal", pre: String(err) });
		} finally {
			assigning = false;
		}
	}

	async function undoAssign() {
		await send("undo");
		assigned = null;
		info = await load();
	}
</script>

{#if info}
	<div class="gf">
		<div class="gf__head">
			<div class="gf__title">{info.isLongGoal ? "Goal" : "Budget goal"}</div>
			<div class="gf__month">{formatMonthLabel(month)}</div>
		</div>

		<div class="gf__bar" class:is-met={needed === 0}>
			<div class="gf__bar-fill" style="width: {ratio * 100}%"></div>
		</div>

		<dl class="gf__rows">
			<div>
				<dt>{info.isLongGoal ? "Goal balance" : "Target this month"}</dt>
				<dd class="abt-privacy-number">{fmtMoney(info.goal)}</dd>
			</div>
			<div>
				<dt>{info.isLongGoal ? "Balance" : "Budgeted"}</dt>
				<dd class="abt-privacy-number">{fmtMoney(info.current)}</dd>
			</div>
			<div>
				<dt>Still needed</dt>
				<dd class="abt-privacy-number" class:is-needed={needed > 0}>{fmtMoney(needed)}</dd>
			</div>
		</dl>

		{#if assigned}
			<div class="gf__done">
				Assigned <span class="abt-privacy-number">{fmtMoney(assigned)}</span>
			</div>
		{/if}

		{#if needed === 0}
			<div class="gf__note gf__note--met">Goal met</div>
		{:else if assignable > 0}
			<button type="button" class="gf__btn" disabled={assigning} onclick={assign}>
				Assign <span class="abt-privacy-number">{fmtMoney(assignable)}</span>
			</button>
			{#if assignable < needed}
				<div class="gf__note">
					Partial: only <span class="abt-privacy-number">{fmtMoney(available)}</span> left to budget
				</div>
			{/if}
		{:else if info.toBudget != null}
			<div class="gf__note">Nothing left to budget</div>
		{/if}
	</div>
{/if}

<style>
	.gf {
		min-width: 240px;
		padding: 12px 12px 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-bottom: 1px solid var(--color-menuBorder);
		color: var(--color-menuItemText);
		font-size: 13px;
	}

	.gf__title {
		font-weight: 600;
	}

	.gf__month {
		font-size: 12px;
		color: var(--color-pageTextSubdued);
	}

	.gf__bar {
		height: 6px;
		border-radius: 999px;
		background: var(--abt-ink-3);
		overflow: hidden;
	}

	.gf__bar-fill {
		height: 100%;
		border-radius: inherit;
		background: var(--color-warningText);
		transition: width 0.2s ease;
	}

	.gf__bar.is-met .gf__bar-fill {
		background: var(--color-noticeTextLight);
	}

	.gf__rows {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.gf__rows > div {
		display: flex;
		justify-content: space-between;
		gap: 16px;
	}

	.gf__rows dt {
		color: var(--color-pageTextSubdued);
	}

	.gf__rows dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.gf__rows dd.is-needed {
		color: var(--color-warningText);
		font-weight: 600;
	}

	/* Tinted rather than solid: no theme-dependent text-on-accent contrast to get wrong. */
	.gf__btn {
		padding: 7px 10px;
		border: 1px solid var(--abt-accent-3);
		border-radius: var(--abt-radius-sm);
		background: var(--abt-accent-2);
		color: var(--abt-accent);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.12s ease,
			border-color 0.12s ease;
	}

	.gf__btn:hover:not(:disabled) {
		background: var(--abt-accent-3);
		border-color: var(--abt-accent-4);
	}

	.gf__btn:focus-visible {
		outline: 2px solid var(--abt-accent);
		outline-offset: 2px;
	}

	.gf__btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.gf__note {
		font-size: 12px;
		color: var(--color-pageTextSubdued);
	}

	.gf__note--met {
		color: var(--color-noticeTextLight);
		font-weight: 600;
	}

	.gf__done {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-noticeTextLight);
	}
</style>
