<script lang="ts">
	import { scaleBand, scaleLinear } from "d3";
	import { fmtMoney } from "@lib/utilities/currency";
	import type { MonthTrend } from "./state.svelte";

	interface Props {
		trend: MonthTrend[];
		valueKey: "spent" | "budgeted";
		currentMonthKey: string;
		barColor: string;
		barColorDim: string;
		higherIsBad?: boolean;
	}

	let { trend, valueKey, currentMonthKey, barColor, barColorDim, higherIsBad = false }: Props =
		$props();

	const CHART_H = 80;
	const LABEL_H = 16;
	const R = 4;
	const TIP_W = 88;
	const TIP_H = 32;

	let w = $state(0);
	let hovered = $state<number | null>(null);

	const xScale = $derived.by(() => {
		if (w <= 0) return null;
		return scaleBand<string>()
			.domain(trend.map((t) => t.monthKey))
			.range([0, w])
			.paddingInner(0.3)
			.paddingOuter(0.1);
	});

	const maxVal = $derived(Math.max(...trend.map((t) => t[valueKey]), 1));

	const yScale = $derived(scaleLinear().domain([0, maxVal]).range([CHART_H, 0]).nice());

	function bar(x: number, bw: number, top: number, h: number): string {
		const safeH = Math.max(h, 2);
		const r = Math.min(R, safeH, bw / 2);
		if (safeH <= r * 2) return `M${x},${top + safeH} h${bw} v${-safeH} h${-bw}z`;
		return `M${x},${top + safeH} v${-(safeH - r)} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${safeH - r}z`;
	}

	function shortMonth(key: string): string {
		const [y, m] = key.split("-").map(Number);
		return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "short" });
	}

	function longMonth(key: string): string {
		const [y, m] = key.split("-").map(Number);
		return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
	}

	const currVal = $derived(trend.find((t) => t.monthKey === currentMonthKey)?.[valueKey] ?? 0);
	const prevVal = $derived(trend[trend.length - 2]?.[valueKey] ?? 0);
	const deltaPct = $derived(
		prevVal > 0 ? Math.round(((currVal - prevVal) / prevVal) * 100) : null,
	);
	const nonZero = $derived(trend.filter((t) => t[valueKey] > 0));
	const avg = $derived(
		nonZero.length > 0
			? nonZero.reduce((s, t) => s + t[valueKey], 0) / nonZero.length
			: 0,
	);
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
			{#each trend as point, i}
				{@const x = xScale(point.monthKey) ?? 0}
				{@const bw = xScale.bandwidth()}
				{@const top = yScale(point[valueKey])}
				{@const h = CHART_H - top}
				{@const curr = point.monthKey === currentMonthKey}
				{@const isHovered = hovered === i}
				<path
					d={bar(x, bw, top, h)}
					fill={curr ? barColor : barColorDim}
					opacity={hovered !== null && !isHovered ? 0.45 : 1}
					style="transition:opacity 0.1s"
				/>
				<!-- Full-column hover target -->
				<rect
					x={x} y={0} width={bw} height={CHART_H}
					fill="transparent"
					role="presentation"
					style="cursor:default"
					onmouseenter={() => (hovered = i)}
				/>
				<text
					x={x + bw / 2}
					y={CHART_H + LABEL_H - 2}
					text-anchor="middle"
					font-size="10"
					font-family="inherit"
					fill="currentColor"
					opacity={hovered !== null ? (isHovered ? 0.9 : 0.2) : curr ? 0.75 : 0.35}
					style="transition:opacity 0.1s"
				>{shortMonth(point.monthKey)}</text>
			{/each}

			<!-- Tooltip -->
			{#if hovered !== null && xScale}
				{@const point = trend[hovered]}
				{@const x = xScale(point.monthKey) ?? 0}
				{@const bw = xScale.bandwidth()}
				{@const barTop = yScale(point[valueKey])}
				{@const tipCX = Math.max(TIP_W / 2 + 2, Math.min(w - TIP_W / 2 - 2, x + bw / 2))}
				{@const tipY = Math.max(TIP_H + 4, barTop) - TIP_H - 6}
				<g transform="translate({tipCX}, {tipY})" pointer-events="none">
					<rect
						x={-TIP_W / 2} y={0}
						width={TIP_W} height={TIP_H}
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
					>{longMonth(point.monthKey)}</text>
					<text
						y={25}
						text-anchor="middle"
						font-size="11"
						font-weight="700"
						font-family="inherit"
						style="font-variant-numeric:tabular-nums"
						fill="white"
					>{fmtMoney(point[valueKey])}</text>
				</g>
			{/if}
		</svg>
	{/if}
</div>

<div class="abt-tab-overview-chart-footer">
	<span class="abt-privacy-number" style="font-weight:600;font-variant-numeric:tabular-nums"
		>{fmtMoney(currVal)}</span
	>
	{#if deltaPct !== null}
		<span
			class="abt-tab-overview-chart-delta"
			data-sign={deltaPct === 0
				? "neutral"
				: (deltaPct > 0) === higherIsBad
					? "neg"
					: "pos"}
		>{deltaPct > 0 ? "↑" : "↓"}{Math.abs(deltaPct)}%</span>
	{/if}
	<span class="abt-tab-overview-chart-avg abt-privacy-number">6-mo avg {fmtMoney(avg)}</span>
</div>
