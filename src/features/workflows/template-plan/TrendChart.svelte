<script lang="ts">
	import { scaleBand, scaleLinear } from "d3";
	import { fmtMoney } from "@lib/format/currency";
	import { currentMonth } from "@lib/format/months";
	import type { MonthTrend } from "./state.svelte";

	interface Props {
		trend: MonthTrend[];
		currentMonthKey: string;
	}

	let { trend, currentMonthKey }: Props = $props();

	const CHART_H = 80;
	const LABEL_H = 16;
	const R = 2;
	const BAR_MAX = 22;
	const TIP_W = 140;
	const TIP_H = 46;
	const UNDER = "color-mix(in srgb, var(--color-budgetNumberPositive) 75%, transparent)"; // raw: a chart fill, near solid
	const OVER = "var(--color-errorText)";

	let w = $state(0);
	let hovered = $state<number | null>(null);

	/** How much of the running month has passed; the rest are whole months. */
	function elapsed(key: string): number {
		if (key !== currentMonth()) {
			return 1;
		}
		const today = new Date();
		return today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
	}

	/**
	 * Budgeted less spent: above the line is money left, below is overspending. The running month
	 * counts only the budget due so far, or it would always tower over the finished ones.
	 */
	const diffs = $derived(trend.map((t) => t.budgeted * elapsed(t.monthKey) - t.spent));

	const xScale = $derived.by(() => {
		if (w <= 0) {
			return null;
		}
		return scaleBand<string>()
			.domain(trend.map((t) => t.monthKey))
			.range([0, w])
			.paddingInner(0.3)
			.paddingOuter(0.1);
	});

	const yScale = $derived(
		scaleLinear()
			.domain([Math.min(0, ...diffs), Math.max(0, ...diffs, 1)])
			.range([CHART_H, 0])
			.nice(),
	);

	/** A bar from the zero line, rounded at its far end, up or down. */
	function bar(x: number, bw: number, diff: number): string {
		const zero = yScale(0);
		const h = Math.max(Math.abs(yScale(diff) - zero), 2);
		const r = Math.min(R, h / 2, bw / 2);
		if (diff >= 0) {
			return `M${x},${zero} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r}z`;
		}
		return `M${x},${zero} v${h - r} a${r},${r} 0 0 0 ${r},${r} h${bw - 2 * r} a${r},${r} 0 0 0 ${r},${-r} v${-(h - r)}z`;
	}

	function shortMonth(key: string): string {
		const [y, m] = key.split("-").map(Number);
		return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "short" });
	}

	function longMonth(key: string): string {
		const [y, m] = key.split("-").map(Number);
		return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
	}
</script>

<div bind:clientWidth={w} style="width:100%;position:relative">
	{#if xScale && w > 0}
		<svg
			width={w}
			height={CHART_H + LABEL_H}
			aria-hidden="true"
			style="display:block;overflow:visible"
			onmouseleave={() => (hovered = null)}
		>
			<line
				x1={0}
				x2={w}
				y1={yScale(0)}
				y2={yScale(0)}
				stroke="var(--abt-ink-4)"
				stroke-width="1"
				shape-rendering="crispEdges"
			/>
			{#each trend as point, i (point.monthKey)}
				{@const band = xScale(point.monthKey) ?? 0}
				{@const bw = Math.min(BAR_MAX, xScale.bandwidth())}
				{@const x = band + (xScale.bandwidth() - bw) / 2}
				{@const curr = point.monthKey === currentMonthKey}
				{@const diff = diffs[i]}
				<!-- The running month is drawn faint: it can still change. -->
				<path
					d={bar(x, bw, diff)}
					fill={diff < 0 ? OVER : UNDER}
					opacity={(hovered !== null && hovered !== i ? 0.45 : 1) *
						(elapsed(point.monthKey) < 1 ? 0.55 : 1)}
					style="transition:opacity 0.1s"
				/>
				<rect
					x={band}
					y={0}
					width={xScale.bandwidth()}
					height={CHART_H}
					fill="transparent"
					role="presentation"
					style="cursor:default"
					onmouseenter={() => (hovered = i)}
				/>
				<text
					x={band + xScale.bandwidth() / 2}
					y={CHART_H + LABEL_H - 2}
					text-anchor="middle"
					font-size="10"
					font-family="inherit"
					fill="currentColor"
					font-weight={curr ? 700 : 400}
					opacity={hovered !== null ? (hovered === i ? 0.9 : 0.2) : curr ? 0.75 : 0.35}
					style="transition:opacity 0.1s">{shortMonth(point.monthKey)}</text
				>
			{/each}

			{#if hovered !== null}
				{@const point = trend[hovered]}
				{@const diff = diffs[hovered]}
				{@const band = xScale(point.monthKey) ?? 0}
				{@const tipCX = Math.max(
					TIP_W / 2 + 2,
					Math.min(w - TIP_W / 2 - 2, band + xScale.bandwidth() / 2),
				)}
				{@const tipY = Math.max(0, Math.min(yScale(Math.max(0, diff)), CHART_H) - TIP_H - 6)}
				<g transform="translate({tipCX}, {tipY})" pointer-events="none">
					<rect
						x={-TIP_W / 2}
						y={0}
						width={TIP_W}
						height={TIP_H}
						rx="5"
						fill="rgba(18,18,28,0.96)"
						stroke="rgba(255,255,255,0.13)"
						stroke-width="1"
					/>
					<text
						y={11}
						text-anchor="middle"
						font-size="9"
						font-family="inherit"
						fill="rgba(255,255,255,0.45)"
						>{longMonth(point.monthKey)}{elapsed(point.monthKey) < 1 ? " · on pace" : ""}</text
					>
					<text
						y={25}
						text-anchor="middle"
						font-size="11"
						font-weight="700"
						font-family="inherit"
						style="font-variant-numeric:tabular-nums"
						fill={diff < 0 ? OVER : "white"}
						>{fmtMoney(Math.abs(diff))} {diff < 0 ? "over" : "under"}</text
					>
					<text
						y={39}
						text-anchor="middle"
						font-size="9"
						font-family="inherit"
						style="font-variant-numeric:tabular-nums"
						fill="rgba(255,255,255,0.55)"
						>{fmtMoney(point.spent)} of {fmtMoney(point.budgeted)}</text
					>
				</g>
			{/if}
		</svg>
	{/if}
</div>
