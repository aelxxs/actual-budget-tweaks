<script lang="ts">
	import Badge from "@lib/components/panel/Badge.svelte";
	import Callout from "@lib/components/panel/Callout.svelte";
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import { dispatch } from "@lib/utilities/actual-api";
	import { fmtMoney } from "@lib/utilities/currency";
	import { formatDate, formatDayMonth } from "@lib/utilities/date-format.svelte";
	import Icon from "@lib/components/Icon.svelte";
	import { inspect, type Inspection, type Phrase, type RuleSummary } from "./data";
	import { inspector } from "./state.svelte";

	// How far from the payee's average an amount reads as unusual.
	const UNUSUAL = 0.25;

	let data = $state<Inspection | null>(null);
	let loading = $state(false);
	let failed = $state(false);

	$effect(() => {
		const id = inspector.transactionId;
		if (!id) {
			data = null;
			return;
		}
		let stale = false;
		loading = true;
		failed = false;
		inspect(id)
			.then((result) => {
				if (!stale) data = result;
			})
			.catch(() => {
				if (!stale) failed = true;
			})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => {
			stale = true;
		};
	});

	const tx = $derived(data?.tx);
	const history = $derived(data?.history);
	const unusual = $derived.by(() => {
		if (!tx || !history || history.count < 3 || history.average === 0) return null;
		const ratio = tx.amount / history.average - 1;
		return Math.abs(ratio) >= UNUSUAL ? Math.round(ratio * 100) : null;
	});

	const ownRules = $derived(data?.rules.filter((r) => !r.schedule) ?? []);
	const scheduleRules = $derived(data?.rules.filter((r) => r.schedule) ?? []);

	/** "a, b and c" from phrases, keeping amounts apart for privacy mode. */
	function joiner(i: number, count: number, word: string): string {
		if (i === 0) return "";
		return i === count - 1 ? ` ${word} ` : ", ";
	}

	function every(days: number): string {
		if (days <= 1) return "Daily";
		if (days >= 6 && days <= 8) return "About weekly";
		if (days >= 13 && days <= 16) return "About every two weeks";
		if (days >= 27 && days <= 32) return "About monthly";
		if (days >= 85 && days <= 95) return "About quarterly";
		if (days >= 355 && days <= 375) return "About yearly";
		return `About every ${days} days`;
	}

	function createRule() {
		if (!tx) return;
		const conditions = tx.payeeId
			? [{ op: "is", field: "payee", value: tx.payeeId, type: "id" }]
			: tx.importedPayee
				? [{ op: "contains", field: "imported_payee", value: tx.importedPayee, type: "string" }]
				: [];
		const actions = tx.categoryId
			? [{ op: "set", field: "category", value: tx.categoryId, type: "id" }]
			: [];
		void dispatch("pushModal", {
			modal: {
				name: "edit-rule",
				options: { rule: { stage: null, conditionsOp: "and", conditions, actions } },
			},
		});
	}

	function editRule(raw: unknown) {
		void dispatch("pushModal", { modal: { name: "edit-rule", options: { rule: raw } } });
	}

	function openSchedule(id: string) {
		void dispatch("pushModal", { modal: { name: "schedule-edit", options: { id } } });
	}
</script>

{#snippet sentence(parts: Phrase[], word: string)}
	{#each parts as part, i (i)}{joiner(i, parts.length, word)}{part.text}{part.amount
			? " "
			: ""}{#if part.amount}<span class="abt-privacy-number">{part.amount}</span>{/if}{/each}
{/snippet}

{#snippet ruleItem(rule: RuleSummary)}
	<li class="rule">
		<div class="rule__body">
			{#if rule.schedule}
				<span class="rule__schedule"><Icon name="calendar" size={12} />{rule.schedule.name}</span>
			{/if}
			<p class="rule__line">
				<span class="rule__kw">When</span>
				<span
					>{#if rule.when.length}{@render sentence(
							rule.when,
							rule.matchAll ? "and" : "or",
						)}{:else}any transaction from this payee{/if}</span
				>
			</p>
			{#if rule.actions.length}
				<p class="rule__line">
					<span class="rule__kw">Then</span>
					<span>{@render sentence(rule.actions, "and")}</span>
				</p>
			{/if}
			{#if rule.stage}
				<span class="rule__stage"
					>{rule.stage === "pre" ? "Runs before other rules" : "Runs after other rules"}</span
				>
			{/if}
		</div>
		<button
			type="button"
			class="abt-btn abt-btn--sm abt-btn--ghost edit"
			title={rule.schedule ? "Edit schedule" : "Edit rule"}
			aria-label={rule.schedule ? "Edit schedule" : "Edit rule"}
			onclick={() => (rule.schedule ? openSchedule(rule.schedule.id) : editRule(rule.raw))}
		>
			<Icon name="pencil" size={13} />
		</button>
	</li>
{/snippet}

<div class="shell">
	<div class="body">
		{#if !inspector.transactionId}
			<p class="empty">Select a transaction to inspect it.</p>
		{:else if failed}
			<div class="message"><Callout tone="negative">Couldn't load this transaction.</Callout></div>
		{:else if !tx}
			{#if !loading}<p class="empty">This transaction is no longer here.</p>{/if}
		{:else}
			<div class="summary" class:loading>
				<div class="line">
					<span class="payee abt-privacy-number">{tx.payee}</span>
					<span class="amount abt-privacy-number" class:positive={tx.amount > 0}
						>{fmtMoney(tx.amount)}</span
					>
				</div>
				<div class="meta">
					{formatDate(tx.date)} · {tx.accountName}{tx.category ? ` · ${tx.category}` : ""}
				</div>
				{#if tx.notes}<div class="notes abt-privacy-number">{tx.notes}</div>{/if}
				{#if tx.isParent || tx.isChild || tx.transfer || unusual != null}
					<div class="badges">
						{#if tx.isParent}<Badge tone="positive">Split</Badge>{/if}
						{#if tx.isChild}<Badge tone="positive">Part of a split</Badge>{/if}
						{#if tx.transfer}<Badge tone="positive">Transfer</Badge>{/if}
						{#if unusual != null}
							<Badge tone="warning">{unusual > 0 ? "+" : ""}{unusual}% vs usual</Badge>
						{/if}
					</div>
				{/if}
			</div>

			{#if data?.changes.length}
				<Section title="Your rules would change" collapsible={false}>
					{#each data.changes as change (change.field)}
						<Row name={change.field} value={`${change.from} → ${change.to}`} tone="warning" />
					{/each}
					<Callout tone="warning">
						Rules run when a transaction is added, so this was likely changed by hand or added
						before the rule.
					</Callout>
				</Section>
			{/if}

			{#if history && history.count > 0}
				<Section title="Payee history" count={history.count}>
					{#if history.count > 1}
						<Row name="Average" value={fmtMoney(history.average)} />
					{/if}
					{#if history.interval != null}
						<Row name="Usually" value={every(history.interval)} />
					{/if}
					<div class="recent">
						{#each history.recent as item (item.id)}
							<Row
								name={formatDayMonth(item.date)}
								meta={[item.accountName, item.category].filter(Boolean).join(" · ")}
								value={fmtMoney(item.amount)}
								tone={item.amount > 0 ? "positive" : undefined}
								strong={item.id === tx.id}
							/>
						{/each}
					</div>
				</Section>
			{/if}

			{#if data?.schedule}
				<Section title="Schedule" collapsible={false}>
					<div class="schedule">
						<Icon name="calendar" size={12} />
						<span class="schedule__name">{data.schedule.name || "Unnamed schedule"}</span>
						{#if data.schedule.nextDate}
							<span class="schedule__next">next {formatDayMonth(data.schedule.nextDate)}</span>
						{/if}
						<button
							type="button"
							class="abt-btn abt-btn--sm abt-btn--ghost edit"
							title="Edit schedule"
							aria-label="Edit schedule"
							onclick={() => openSchedule(data!.schedule!.id)}
						>
							<Icon name="pencil" size={13} />
						</button>
					</div>
				</Section>
			{/if}

			<Section title="Rules for this payee" count={data?.rules.length || undefined}>
				{#if data?.rules.length}
					{#if ownRules.length}
						<ul class="rules">
							{#each ownRules as rule (rule.id)}{@render ruleItem(rule)}{/each}
						</ul>
					{/if}
					{#if scheduleRules.length}
						<span class="abt-label group" class:first={!ownRules.length}>From schedules</span>
						<ul class="rules">
							{#each scheduleRules as rule (rule.id)}{@render ruleItem(rule)}{/each}
						</ul>
					{/if}
				{:else}
					<p class="none">No rules mention this payee.</p>
				{/if}
			</Section>
		{/if}
	</div>
	{#if tx}
		<div class="footer">
			<button type="button" class="abt-btn abt-tone-accent create" onclick={createRule}
				>Create rule from this…</button
			>
		</div>
	{/if}
</div>

<style>
	.shell {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
	/* Sections inset themselves, as in the other panels; only the summary and messages need it. */
	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--abt-space-3) 0;
		overflow-y: auto;
		min-height: 0;
	}
	.message {
		padding: 0 var(--abt-space-4);
	}
	.footer {
		flex-shrink: 0;
		padding: var(--abt-space-3) var(--abt-space-4);
		border-top: 1px solid var(--abt-ink-2);
	}
	.create {
		width: 100%;
	}
	.empty,
	.none {
		margin: 0;
		color: var(--abt-subtle);
		font-size: var(--abt-text-sm);
	}
	.empty {
		padding: var(--abt-space-4) 0;
		text-align: center;
	}
	.summary {
		padding: var(--abt-space-2) var(--abt-space-4);
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		transition: opacity 0.15s;
	}
	.summary.loading {
		opacity: 0.5;
	}
	.line {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--abt-space-3);
		font-size: var(--abt-text-lg);
		font-weight: 600;
	}
	.payee {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.amount {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}
	.amount.positive {
		color: var(--color-noticeTextLight);
	}
	.meta {
		font-size: var(--abt-text-sm);
		color: var(--abt-subtle);
	}
	.notes {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--abt-space-2);
	}
	.recent:not(:first-child) {
		margin-top: var(--abt-space-2);
		padding-top: var(--abt-space-2);
		border-top: 1px solid var(--abt-ink-2);
	}
	.rules {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.rule {
		display: flex;
		align-items: flex-start;
		gap: var(--abt-space-2);
		padding: var(--abt-space-3) 0;
		border-top: 1px solid var(--abt-ink-2);
	}
	.rule:first-child {
		border-top: none;
		padding-top: 0;
	}
	.rule__body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		font-size: var(--abt-text-sm);
		line-height: 1.45;
	}
	/* The keyword gets its own column, so a wrapped condition stays indented under its text. */
	.rule__line {
		display: grid;
		grid-template-columns: 2.75em 1fr;
		column-gap: var(--abt-space-3);
		margin: 0;
	}
	.rule__kw {
		color: var(--abt-subtle);
		font-weight: 600;
	}
	.rule__schedule {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
		font-weight: 600;
	}
	.rule__stage {
		font-size: var(--abt-text-xs);
		color: var(--abt-subtle);
	}
	.edit {
		flex-shrink: 0;
		margin-left: auto;
		color: var(--abt-subtle);
	}
	.schedule {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		font-size: var(--abt-text-sm);
	}
	.schedule__name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	.schedule__next {
		flex-shrink: 0;
		color: var(--abt-subtle);
	}
	.group {
		display: block;
		margin: var(--abt-space-4) 0 var(--abt-space-2);
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-ink-2);
	}
	.group.first {
		margin-top: 0;
		padding-top: 0;
		border-top: none;
	}
</style>
