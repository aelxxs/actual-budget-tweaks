<script lang="ts">
	import { fmtMoney } from "@lib/format/currency";
	import { addMonths } from "@lib/format/months";
	import type { BalancePoint } from "./amortize";
	import { monthName } from "./format";

	/** The first series is the plan itself; any after it are alternatives drawn behind it. */
	const { series }: { series: { label: string; points: BalancePoint[] }[] } = $props();

	const months = $derived.by(() => {
		const first = series[0]?.points[0]?.month;
		if (!first) {
			return [];
		}
		const last = series.reduce((max, s) => {
			const end = s.points[s.points.length - 1].month;
			return end > max ? end : max;
		}, first);
		const all = [first];
		while (all[all.length - 1] < last) {
			all.push(addMonths(all[all.length - 1], 1));
		}
		return all;
	});
	// Each series on every month: carried over a month without a payment, nothing once paid off.
	const lines = $derived(
		series.map((s) => {
			const byMonth = new Map(s.points.map((p) => [p.month, p.balance]));
			const end = s.points[s.points.length - 1].month;
			let balance = s.points[0].balance;
			return months.map((month) => {
				balance = month > end ? 0 : (byMonth.get(month) ?? balance);
				return balance;
			});
		}),
	);
	const top = $derived(Math.max(1, ...lines.map((line) => line[0] ?? 0)));
	const x = (i: number): number => (months.length > 1 ? (i / (months.length - 1)) * 100 : 0);
	const y = (balance: number): number => (1 - balance / top) * 100;
	const path = (line: number[]): string =>
		line
			.map((balance, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(balance).toFixed(2)}`)
			.join("");

	let hovered = $state<number | null>(null);
	const at = $derived(hovered != null && hovered < months.length ? hovered : null);

	function point(e: PointerEvent) {
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const part = box.width ? (e.clientX - box.left) / box.width : 0;
		hovered = Math.round(Math.min(1, Math.max(0, part)) * (months.length - 1));
	}
</script>

{#if months.length > 1}
	<figure class="pc" aria-label="What's owed from now until it's paid off">
		<figcaption class="pc__legend">
			{#each series as s, i (s.label)}
				<span class="pc__key">
					<span class="pc__swatch" class:is-alt={i > 0} aria-hidden="true"></span>
					<span>{s.label}</span>
					{#if at != null}
						<span class="pc__value abt-privacy-number">{fmtMoney(lines[i][at])}</span>
					{/if}
				</span>
			{/each}
		</figcaption>
		<div
			class="pc__plot"
			role="presentation"
			onpointermove={point}
			onpointerleave={() => (hovered = null)}
		>
			<span class="pc__top abt-privacy-number">{fmtMoney(top, { short: true })}</span>
			<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
				<path class="pc__area" d="{path(lines[0])}L100,100L0,100Z" />
				{#each lines.slice(1) as line, i (i)}
					<path class="pc__line is-alt" d={path(line)} />
				{/each}
				<path class="pc__line" d={path(lines[0])} />
			</svg>
			{#if at != null}
				<span class="pc__cross" style:left="{x(at)}%"></span>
				{#each lines as line, i (i)}
					<span
						class="pc__dot"
						class:is-alt={i > 0}
						style:left="{x(at)}%"
						style:top="{y(line[at])}%"
					></span>
				{/each}
			{/if}
		</div>
		<div class="pc__axis">
			<span>{monthName(months[0])}</span>
			{#if at != null}<span class="pc__now">{monthName(months[at])}</span>{/if}
			<span>{monthName(months[months.length - 1])}</span>
		</div>
	</figure>
{/if}

<style>
	.pc {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		margin: 0;
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}

	/* One row a series, its value at the far end, so hovering fills a gap rather than moving the labels. */
	.pc__legend {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
	}

	.pc__key {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		white-space: nowrap;
	}

	/* A short sample of the line it names: solid for the plan, dashed for an alternative. */
	.pc__swatch {
		width: 14px;
		border-top: 2px solid var(--abt-data);
	}
	.pc__swatch.is-alt {
		border-top: 2px dashed var(--abt-muted);
	}

	.pc__value {
		margin-left: auto;
		color: var(--abt-ink);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.pc__plot {
		position: relative;
		height: 110px;
		border-top: 1px solid var(--abt-ink-2);
		border-bottom: 1px solid var(--abt-line);
		touch-action: none;
	}

	.pc__plot svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	/* What the top gridline stands for. */
	.pc__top {
		position: absolute;
		top: var(--abt-space-1);
		right: 0;
		font-variant-numeric: tabular-nums;
		pointer-events: none;
	}

	.pc__line {
		fill: none;
		stroke: var(--abt-data);
		stroke-width: 2;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}
	.pc__line.is-alt {
		stroke: var(--abt-muted);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
	}

	.pc__area {
		fill: var(--abt-data-1);
	}

	.pc__cross {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--abt-ink-4);
		pointer-events: none;
	}

	/* Ringed in the surface colour so it stays readable where the lines cross. */
	.pc__dot {
		position: absolute;
		width: 8px;
		height: 8px;
		margin: -5px 0 0 -5px;
		border: 2px solid var(--abt-panel-surface);
		border-radius: var(--abt-radius-pill);
		background: var(--abt-data);
		pointer-events: none;
	}
	.pc__dot.is-alt {
		background: var(--abt-muted);
	}

	.pc__axis {
		display: flex;
		justify-content: space-between;
		font-variant-numeric: tabular-nums;
	}

	.pc__now {
		color: var(--abt-ink);
		font-weight: 600;
	}
</style>
