<script lang="ts">
	import CategoryIcon from "@lib/components/CategoryIcon.svelte";
	import { fmtMoney } from "@lib/format/currency";
	import { onOutsideClick } from "@lib/dom/popover";
	import { portal } from "@lib/dom/svelte";
	import { Check, Lock, X } from "@lucide/svelte";
	import type { BreakdownTransaction } from "./data";

	const {
		title,
		transactions,
		categoryName,
		at,
		onclose,
		onview,
	}: {
		title: string;
		transactions: BreakdownTransaction[];
		categoryName: (id: string | null) => string;
		/** The click that opened it, in viewport coordinates. */
		at: { x: number; y: number };
		onclose: () => void;
		/** Opens All Accounts filtered to these transactions. */
		onview: () => void;
	} = $props();

	let el = $state<HTMLElement | null>(null);
	const rows = $derived([...transactions].sort((a, b) => b.date.localeCompare(a.date)));
	const total = $derived(transactions.reduce((sum, t) => sum + t.amount, 0));

	const shortDate = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(2, 4)}`;

	// Above the click if it fits, else below; always inside the viewport.
	$effect(() => {
		if (!el) {
			return;
		}
		const { width, height } = el.getBoundingClientRect();
		let top = at.y - height - 8;
		if (top < 8) {
			top = Math.min(at.y + 12, window.innerHeight - height - 8);
		}
		el.style.top = `${Math.max(8, top)}px`;
		el.style.left = `${Math.max(8, Math.min(at.x - width / 2, window.innerWidth - width - 8))}px`;
	});

	$effect(() => {
		if (!el) {
			return;
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onclose();
			}
		};
		document.addEventListener("keydown", onKey);
		// Clicks on the chart reach its own handlers, which open another list or close this one.
		const stop = onOutsideClick(
			[el, ...document.querySelectorAll<HTMLElement>(".ib-chart")],
			onclose,
		);
		return () => {
			stop();
			document.removeEventListener("keydown", onKey);
		};
	});
</script>

<div class="tx abt-popover" role="dialog" aria-label={title} use:portal bind:this={el}>
	<header class="tx__head">
		<span class="tx__title">{title}</span>
		<span class="tx__total abt-privacy-number" class:is-neg={total < 0}>{fmtMoney(total)}</span>
		<span class="tx__count">
			{transactions.length}
			{transactions.length === 1 ? "transaction" : "transactions"}
		</span>
		<button type="button" class="abt-btn abt-btn--sm abt-tone-accent" onclick={onview}>
			View in Accounts
		</button>
		<button
			type="button"
			class="abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
			aria-label="Close"
			onclick={onclose}
		>
			<X size={14} />
		</button>
	</header>
	<div class="tx__scroll">
		<table>
			<thead>
				<tr>
					<th class="tx__date">Date</th>
					<th>Account</th>
					<th>Payee</th>
					<th>Category</th>
					<th class="tx__notes">Notes</th>
					<th class="tx__amount">Amount</th>
					<th class="tx__status" aria-label="Status"></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as tx (tx.id)}
					<tr>
						<td>{shortDate(tx.date)}</td>
						<td>{tx.accountName ?? "—"}</td>
						<td>{tx.payeeName ?? "—"}</td>
						<td
							><span class="tx__cat"
								><CategoryIcon id={tx.category} size={12} />{categoryName(tx.category)}</span
							></td
						>
						<td class="tx__notes">{tx.notes ?? ""}</td>
						<td class="tx__amount abt-privacy-number" class:is-neg={tx.amount < 0}
							>{fmtMoney(tx.amount)}</td
						>
						<td class="tx__status">
							{#if tx.reconciled}
								<Lock size={12} aria-label="Reconciled" />
							{:else if tx.cleared}
								<Check size={12} aria-label="Cleared" class="is-cleared" />
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.tx {
		position: fixed;
		z-index: 10000;
		display: flex;
		flex-direction: column;
		width: min(900px, calc(100vw - 40px));
		max-height: 320px;
		overflow: hidden;
	}

	.tx__head {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3) var(--abt-space-4);
		border-bottom: 1px solid var(--abt-line);
	}

	.tx__title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--abt-text-lg);
		font-weight: 500;
	}

	.tx__total {
		flex: 1;
		font-weight: 600;
		color: var(--color-noticeTextLight);
	}

	.tx__count {
		font-size: var(--abt-text-base);
		color: var(--abt-muted);
		white-space: nowrap;
	}

	.tx__scroll {
		overflow-y: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		font-size: var(--abt-text-base);
	}

	thead {
		position: sticky;
		top: 0;
		background: var(--abt-popover-bg);
	}

	th {
		padding: var(--abt-space-2) var(--abt-space-3);
		font-size: var(--abt-text-sm);
		font-weight: 500;
		text-align: left;
		color: var(--abt-muted);
		border-bottom: 1px solid var(--abt-line);
	}

	td {
		overflow: hidden;
		padding: var(--abt-space-2) var(--abt-space-3);
		border-bottom: 1px solid var(--abt-line);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	tbody tr:hover {
		background: var(--abt-fill);
	}

	.tx__date {
		width: 72px;
	}

	.tx__notes {
		width: 28%;
		color: var(--abt-muted);
	}

	.tx__amount {
		width: 90px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	td.tx__amount {
		color: var(--color-noticeTextLight);
	}

	.tx .is-neg {
		color: var(--color-errorText);
	}

	.tx__status {
		width: 28px;
		text-align: center;
		color: var(--abt-muted);
	}

	.tx__status :global(.is-cleared) {
		color: var(--color-noticeTextLight);
	}

	.tx__cat {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
	}
</style>
