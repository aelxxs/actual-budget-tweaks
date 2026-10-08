<script lang="ts">
	import { sidepanel } from "@features/core/side-panel";
	import Icon from "@lib/components/Icon.svelte";
	import Callout from "@lib/components/panel/Callout.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import RollingNumber from "@lib/components/RollingNumber.svelte";
	import { formatMoneyInput, fmtMoney, parseMoney } from "@lib/utilities/currency";
	import { formatDayMonth, loadDatePrefs } from "@lib/utilities/date-format.svelte";
	import { onMount } from "svelte";
	import { closePanel } from "./panel";
	import { relativeTime } from "./relative-time";
	import {
		addAdjustment,
		back,
		cancel,
		clearTransaction,
		finish,
		loadAccount,
		reconcile,
		refreshTotals,
		start,
	} from "./state.svelte";

	const { accountId }: { accountId: string } = $props();

	const SHOWN = 60;
	const RING_R = 20;
	const RING_CIRC = 2 * Math.PI * RING_R;

	const started = $derived(reconcile.target != null && reconcile.accountId === accountId);
	const diff = $derived((reconcile.target ?? 0) - reconcile.cleared);
	const balanced = $derived(started && diff === 0);
	const uncleared = $derived(reconcile.unclearedRows.length);
	const total = $derived(reconcile.checked + uncleared);
	const progress = $derived(balanced ? 1 : total ? reconcile.checked / total : 0);
	const lastReconciled = $derived(
		reconcile.lastReconciled
			? `Last reconciled ${relativeTime(Number(reconcile.lastReconciled))}`
			: "Never reconciled",
	);

	let text = $state("");
	const parsed = $derived(parseMoney(text));
	let editing = $state(false);
	let clearing = $state<Set<string>>(new Set());

	onMount(async () => {
		void loadDatePrefs();
		await loadAccount(accountId);
		sidepanel.setTitle(reconcile.accountName);
		text = formatMoneyInput(reconcile.target ?? reconcile.cleared);
	});

	function begin(e: SubmitEvent) {
		e.preventDefault();
		if (parsed != null) start(parsed);
	}

	function edit() {
		text = formatMoneyInput(reconcile.target ?? 0);
		editing = true;
	}

	function commitEdit() {
		if (parsed != null) start(parsed);
		editing = false;
	}

	async function clear(id: string) {
		clearing = new Set(clearing).add(id);
		try {
			await clearTransaction(id);
		} finally {
			clearing.delete(id);
			clearing = new Set(clearing);
		}
	}

	async function done() {
		await finish();
		if (reconcile.target == null) closePanel();
	}

	function stop() {
		cancel();
		closePanel();
	}

	function goBack() {
		text = formatMoneyInput(reconcile.target ?? reconcile.cleared);
		editing = false;
		back();
	}

	function select(node: HTMLInputElement) {
		node.select();
	}

	// Ticking a transaction in the table re-renders its row, so the table's mutations drive the totals.
	$effect(() => {
		if (!started) return;
		const table = document.querySelector('[data-testid="transaction-table"]');
		if (!table) return;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const observer = new MutationObserver(() => {
			clearTimeout(timer);
			timer = setTimeout(() => void refreshTotals(), 150);
		});
		observer.observe(table, { childList: true, subtree: true, attributes: true });
		return () => {
			observer.disconnect();
			clearTimeout(timer);
		};
	});
</script>

{#snippet adjustRow(prompt: string)}
	<div class="rp__adjust">
		<span class="rp__muted">{prompt}</span>
		<button
			type="button"
			class="abt-btn abt-btn--sm"
			disabled={reconcile.busy}
			onclick={addAdjustment}
		>
			<Icon name="plus" size={13} />
			<span class="abt-privacy-number">{fmtMoney(diff, { sign: true })}</span> adjustment
		</button>
	</div>
{/snippet}

<div class="rp">
	<div class="rp__scroll">
		{#if !started}
			<Section title="Statement balance" collapsible={false}>
				<form class="rp__start" onsubmit={begin}>
					<input
						class="rp__big-input abt-input abt-privacy-number"
						inputmode="decimal"
						autocomplete="off"
						aria-label="Statement balance"
						bind:value={text}
						use:select
						aria-invalid={parsed == null}
					/>
					<span class="rp__muted">The ending balance on your statement or in your bank's app.</span>
					{#if reconcile.bankBalance != null}
						<button
							type="button"
							class="rp__chip"
							onclick={() => (text = formatMoneyInput(reconcile.bankBalance ?? 0))}
						>
							<Icon name="refreshCw" size={13} />
							<span>Use bank's synced balance</span>
							<span class="abt-privacy-number">{fmtMoney(reconcile.bankBalance)}</span>
						</button>
					{/if}
					<button type="submit" class="abt-btn abt-tone-accent" disabled={parsed == null}>
						Start reconciling
					</button>
				</form>
			</Section>

			<Section title="Since last reconcile" collapsible={false}>
				<div class="rp__rows">
					<div class="rp__line">
						<span class="rp__line-label">Cleared balance</span>
						<span class="rp__line-val abt-privacy-number">{fmtMoney(reconcile.cleared)}</span>
					</div>
					<div class="rp__line">
						<span class="rp__line-label">Cleared transactions</span>
						<span class="rp__line-val">{reconcile.checked}</span>
					</div>
					<div class="rp__line">
						<span class="rp__line-label">Not cleared</span>
						<span class="rp__line-val">{uncleared}</span>
					</div>
				</div>
				<Callout>{lastReconciled}</Callout>
			</Section>
		{:else}
			<Section title="Progress" collapsible={false}>
				<div class="rp__hero" class:is-balanced={balanced}>
					<div class="rp__ring" aria-hidden="true">
						<svg width="48" height="48" viewBox="0 0 48 48">
							<circle
								cx="24"
								cy="24"
								r={RING_R}
								fill="none"
								stroke="var(--abt-panel-track)"
								stroke-width="5"
							/>
							<circle
								class="rp__ring-fill"
								cx="24"
								cy="24"
								r={RING_R}
								fill="none"
								stroke-width="5"
								stroke-linecap="round"
								stroke-dasharray={RING_CIRC}
								stroke-dashoffset={RING_CIRC * (1 - progress)}
								transform="rotate(-90 24 24)"
							/>
						</svg>
						<span
							class="rp__ring-label"
							title="{reconcile.checked} of {total} transactions cleared"
						>
							{#if balanced}<Icon name="checkCircle" size={18} />{:else if uncleared === 0}<Icon
									name="alert"
									size={16}
								/>{:else}{Math.floor(progress * 100)}%{/if}
						</span>
					</div>
					<div class="rp__hero-info">
						<span class="rp__hero-label">{balanced ? "All matched" : "Left to match"}</span>
						{#if balanced}
							<span class="rp__hero-amount rp__hero-amount--done">Balanced</span>
						{:else}
							<RollingNumber
								value={diff}
								format={(v) => fmtMoney(v, { sign: true })}
								resetKey={accountId}
								class="rp__hero-amount abt-privacy-number"
							/>
						{/if}
					</div>
				</div>

				<div class="rp__rows">
					<div class="rp__line">
						<span class="rp__line-op">→</span>
						<span class="rp__line-label">Statement balance</span>
						{#if editing}
							<input
								class="rp__edit abt-input abt-privacy-number"
								inputmode="decimal"
								aria-label="Statement balance"
								bind:value={text}
								use:select
								onblur={commitEdit}
								onkeydown={(e) => {
									if (e.key === "Enter") commitEdit();
									if (e.key === "Escape") editing = false;
								}}
							/>
						{:else}
							<button
								type="button"
								class="rp__edit-btn"
								title="Edit statement balance"
								onclick={edit}
							>
								<Icon name="pencil" size={11} />
								<span class="abt-privacy-number">{fmtMoney(reconcile.target ?? 0)}</span>
							</button>
						{/if}
					</div>
					<div class="rp__line">
						<span class="rp__line-op">−</span>
						<span class="rp__line-label">Cleared balance</span>
						<RollingNumber
							value={reconcile.cleared}
							resetKey={accountId}
							class="rp__line-val abt-privacy-number"
						/>
					</div>
					<div class="rp__line rp__line--total">
						<span class="rp__line-op">=</span>
						<span class="rp__line-label">Difference</span>
						<RollingNumber
							value={diff}
							format={(v) => fmtMoney(v, { sign: true })}
							resetKey={accountId}
							class="rp__line-val abt-privacy-number"
						/>
					</div>
				</div>

				{#if balanced}
					<Callout tone="positive">
						Matches your statement. Finishing locks {reconcile.checked}
						{reconcile.checked === 1 ? "transaction" : "transactions"}.
					</Callout>
				{:else if uncleared === 0}
					<Callout tone="warning">
						Everything's cleared but it's still off, so a transaction may be missing from Actual.
					</Callout>
					{@render adjustRow("Or close the gap")}
				{/if}
			</Section>

			<Section title="Not cleared" count={uncleared}>
				{#if uncleared === 0}
					<p class="rp__muted">Nothing left to clear.</p>
				{:else}
					<ul class="rp__list">
						{#each reconcile.unclearedRows.slice(0, SHOWN) as row (row.id)}
							<li class="rp__item">
								<button
									type="button"
									class="rp__check"
									title="Mark cleared"
									aria-label="Mark cleared"
									disabled={clearing.has(row.id)}
									onclick={() => clear(row.id)}
								>
									<Icon name="checkCircle" size={16} />
								</button>
								<span class="rp__item-main">
									<span class="rp__item-payee">{row.payee || row.notes || "No payee"}</span>
									<span class="rp__muted">{formatDayMonth(row.date)}</span>
								</span>
								<span class="rp__item-amount abt-privacy-number" class:is-pos={row.amount > 0}>
									{fmtMoney(row.amount, { sign: true })}
								</span>
							</li>
						{/each}
					</ul>
					{#if uncleared > SHOWN}
						<p class="rp__muted rp__more">{uncleared - SHOWN} older ones are in the table.</p>
					{/if}
					{#if !balanced}
						{@render adjustRow("Can't find the difference?")}
					{/if}
				{/if}
			</Section>
		{/if}
	</div>

	{#if started}
		<footer class="rp__footer">
			<button type="button" class="abt-btn abt-btn--sm abt-btn--ghost" onclick={goBack}>
				<Icon name="chevronLeft" size={13} />
				Back
			</button>
			<button type="button" class="abt-btn abt-btn--sm abt-btn--ghost rp__cancel" onclick={stop}
				>Cancel</button
			>
			<button
				type="button"
				class="abt-btn abt-btn--sm abt-tone-accent"
				disabled={!balanced || reconcile.busy}
				title={balanced ? undefined : "Finish once the difference is zero"}
				onclick={done}
			>
				<Icon name="lock" size={13} />
				Finish reconciling
			</button>
		</footer>
	{/if}
</div>

<style>
	.rp {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}

	/* Like Insights' body: the sections bring their own inset and spacing. */
	.rp__scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 6px 0;
	}

	.rp__muted {
		margin: 0;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	/* Start */
	.rp__start {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
	}

	.rp__big-input {
		height: 44px;
		font-size: 20px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.rp__big-input[aria-invalid="true"] {
		border-color: color-mix(in srgb, var(--color-errorText) 60%, transparent);
	}

	.rp__chip {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3);
		border: 1px dashed var(--abt-line);
		border-radius: var(--abt-radius);
		background: none;
		color: var(--color-pageText);
		font: inherit;
		font-size: var(--abt-text-md);
		cursor: pointer;
		transition:
			background 0.1s,
			border-color 0.1s;
	}

	.rp__chip:hover {
		border-color: color-mix(in srgb, var(--abt-accent) 45%, transparent);
		background: color-mix(in srgb, var(--abt-accent) 8%, transparent);
	}

	.rp__chip :global(svg) {
		color: var(--abt-accent-text);
	}

	.rp__chip span:last-child {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	/* Progress hero, like Insights' month breakdown */
	.rp__hero {
		display: flex;
		align-items: center;
		gap: var(--abt-space-4);
		margin-bottom: var(--abt-space-4);
		--rp-tone: var(--color-warningText);
	}

	.rp__hero.is-balanced {
		--rp-tone: var(--color-noticeTextLight);
	}

	.rp__ring {
		position: relative;
		flex-shrink: 0;
		width: 48px;
		height: 48px;
	}

	.rp__ring-fill {
		stroke: var(--rp-tone);
		transition:
			stroke-dashoffset 0.55s cubic-bezier(0.2, 0.8, 0.2, 1),
			stroke 0.2s;
	}

	@media (prefers-reduced-motion: reduce) {
		.rp__ring-fill {
			transition: none;
		}
	}

	.rp__ring-label {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 9px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--rp-tone);
	}

	.rp__hero-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.rp__hero-label {
		font-size: var(--abt-text-xs);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--abt-muted);
	}

	.rp__hero :global(.rp__hero-amount) {
		font-size: 22px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		line-height: 1.15;
		color: var(--rp-tone);
	}

	/* Breakdown rows, like Insights' */
	.rp__rows {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.rp__line {
		display: grid;
		grid-template-columns: 14px 1fr auto;
		align-items: center;
		gap: var(--abt-space-2);
		min-height: 26px;
		font-size: var(--abt-text-md);
	}

	.rp__rows > .rp__line:not(:has(.rp__line-op)) {
		grid-template-columns: 1fr auto;
	}

	.rp__line-op {
		color: var(--abt-muted);
		text-align: center;
	}

	.rp__line-label {
		color: var(--abt-muted);
	}

	.rp__line :global(.rp__line-val) {
		font-variant-numeric: tabular-nums;
	}

	.rp__line--total {
		margin-top: var(--abt-space-2);
		padding-top: var(--abt-space-2);
		border-top: 1px solid var(--abt-panel-border);
		font-weight: 600;
	}

	.rp__line--total .rp__line-label {
		color: var(--color-pageText);
	}

	.rp__edit-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
		margin-right: calc(-1 * var(--abt-space-2));
		padding: 2px var(--abt-space-2);
		border: 1px solid transparent;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--color-pageText);
		font: inherit;
		font-variant-numeric: tabular-nums;
		cursor: text;
	}

	.rp__edit-btn :global(svg) {
		color: var(--abt-muted);
		opacity: 0;
		transition: opacity 0.1s;
	}

	.rp__edit-btn:hover {
		border-color: var(--abt-line);
	}

	.rp__edit-btn:hover :global(svg) {
		opacity: 1;
	}

	.rp__edit {
		--abt-btn-h: 26px;
		width: 120px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.rp__adjust {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
		margin-top: var(--abt-space-3);
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-panel-border);
	}

	/* Uncleared list */

	.rp__list {
		display: flex;
		flex-direction: column;
		margin: calc(-1 * var(--abt-space-2)) 0;
		padding: 0;
		list-style: none;
	}

	.rp__item {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		padding: var(--abt-space-2) 0;
	}

	.rp__item + .rp__item {
		border-top: 1px solid var(--abt-panel-border);
	}

	.rp__check {
		display: inline-flex;
		flex-shrink: 0;
		padding: 3px;
		border: none;
		border-radius: 999px;
		background: none;
		color: var(--abt-muted);
		cursor: pointer;
		transition:
			color 0.1s,
			background 0.1s;
	}

	.rp__check:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-noticeTextLight) 15%, transparent);
		color: var(--color-noticeTextLight);
	}

	.rp__check:disabled {
		color: var(--color-noticeTextLight);
		cursor: default;
	}

	.rp__item-main {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		font-size: var(--abt-text-md);
	}

	.rp__item-payee {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rp__item-amount {
		flex-shrink: 0;
		font-size: var(--abt-text-md);
		font-variant-numeric: tabular-nums;
	}

	.rp__item-amount.is-pos {
		color: var(--color-noticeTextLight);
	}

	.rp__more {
		margin-top: var(--abt-space-3);
	}

	.rp__footer {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3) var(--abt-space-4);
		border-top: 1px solid var(--abt-panel-border);
	}

	.rp__cancel {
		margin-left: auto;
	}
</style>
