<script lang="ts" module>
	export interface BreakdownTotals {
		toBudget: number;
		available: number;
		budgeted: number;
		overspent: number;
		nextMonth: number;
	}
</script>

<script lang="ts">
	import { fmtMoney } from "@lib/utilities/currency";

	const {
		anchors,
		sheet,
		totals,
	}: {
		/** What opens the popover on hover: Actual's To Budget block, and the month card's bar. */
		anchors: Element[];
		sheet: string;
		totals: BreakdownTotals;
	} = $props();

	const WIDTH = 260;

	// Kept after hiding so the popover fades out in place instead of jumping to 0,0.
	let at = $state({ top: 0, left: 0 });
	let open = $state(false);

	// The month cards clip overflow and slide with a transform, so the popover lives on <body>.
	$effect(() => {
		const show = (e: Event) => {
			const r = (e.currentTarget as Element).getBoundingClientRect();
			at = { top: r.bottom + 6, left: r.left };
			open = true;
		};
		const hide = () => (open = false);
		for (const el of anchors) {
			el.addEventListener("mouseenter", show);
			el.addEventListener("mouseleave", hide);
		}
		return () => {
			for (const el of anchors) {
				el.removeEventListener("mouseenter", show);
				el.removeEventListener("mouseleave", hide);
			}
			hide();
		};
	});

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}

	const prevMonthName = $derived.by(() => {
		const y = Number(sheet.slice(6, 10));
		const m = Number(sheet.slice(10, 12));
		return new Date(y, m - 2, 1).toLocaleString(undefined, { month: "short" });
	});
</script>

<div
	class="bd abt-popover abt-stack abt-gap-2"
	class:is-open={open}
	role="tooltip"
	use:portal
	style:top="{at.top}px"
	style:left="{at.left}px"
	style:width="{WIDTH}px"
>
	<div class="bd__line abt-repel">
		<span>Available funds</span><span class="abt-privacy-number">{fmtMoney(totals.available)}</span>
	</div>
	<!-- In the month cards' bar order, with its colours. -->
	<div class="bd__line abt-repel">
		<span class="abt-cluster abt-gap-3"><i class="bd__dot is-budgeted"></i>Budgeted</span><span
			class="abt-privacy-number">−{fmtMoney(totals.budgeted)}</span
		>
	</div>
	{#if totals.overspent}
		<div class="bd__line abt-repel is-bad">
			<span class="abt-cluster abt-gap-3"
				><i class="bd__dot is-overspent"></i>Overspent in {prevMonthName}</span
			><span class="abt-privacy-number">−{fmtMoney(totals.overspent)}</span>
		</div>
	{/if}
	{#if totals.nextMonth}
		<div class="bd__line abt-repel">
			<span class="abt-cluster abt-gap-3"><i class="bd__dot is-next"></i>For next month</span><span
				class="abt-privacy-number">−{fmtMoney(totals.nextMonth)}</span
			>
		</div>
	{/if}
	<div class="bd__line abt-repel is-total">
		<span class="abt-cluster abt-gap-3"><i class="bd__dot is-left"></i>To Budget</span><span
			class="abt-privacy-number">{fmtMoney(totals.toBudget)}</span
		>
	</div>
</div>

<style>
	.bd {
		position: fixed;
		z-index: 10000;
		box-sizing: border-box;
		padding: var(--abt-space-3) var(--abt-space-4);
		opacity: 0;
		pointer-events: none;
		transform: translateY(-4px);
		transition:
			opacity 0.12s,
			transform 0.12s;
	}

	.bd.is-open {
		opacity: 1;
		transform: none;
	}

	.bd__line {
		line-height: 20px;
		font-size: var(--abt-text-md);
		font-variant-numeric: tabular-nums;
		color: var(--abt-muted);
	}

	.bd__line > span:last-child {
		color: var(--color-pageText);
	}

	.bd__line.is-bad > span:last-child {
		color: var(--color-errorText);
	}

	.bd__line.is-total {
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--color-tableBorder);
		font-weight: 600;
		color: var(--color-pageText);
	}

	/* The month card bar's colours, so the two read as one key. */
	.bd__dot {
		width: 7px;
		height: 7px;
		border-radius: 2px;
	}

	.bd__dot.is-budgeted {
		background: var(--abt-accent);
	}

	.bd__dot.is-overspent {
		background: var(--color-errorText);
	}

	.bd__dot.is-next {
		background: var(--color-warningText);
	}

	.bd__dot.is-left {
		background: var(--abt-ink-4);
	}
</style>
