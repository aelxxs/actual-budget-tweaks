<script lang="ts">
	import { fmtMoney } from "@lib/format/currency";
	import { sankey, sankeyJustify, sankeyLinkHorizontal } from "d3-sankey";
	import { type SankeyLink, type SankeyNode, SUMMARY_NODES } from "./data";

	const {
		nodes,
		links,
		total,
		interactive,
		onpick,
	}: {
		nodes: SankeyNode[];
		links: SankeyLink[];
		/** Everything flowing into the budget, for each link's share. */
		total: number;
		/** Off while the dashboard is being arranged, so drags aren't taken as clicks. */
		interactive: boolean;
		onpick: (node: SankeyNode, x: number, y: number) => void;
	} = $props();

	let width = $state(0);
	let height = $state(0);
	let root = $state<HTMLElement | null>(null);
	let tip = $state<{ x: number; y: number; title: string; amount: string; hint: boolean } | null>(
		null,
	);

	type IndexedLink = { source: number; target: number; value: number };

	const graph = $derived.by(() => {
		if (width <= 0 || height <= 0 || !links.length) {
			return null;
		}
		const index = new Map(nodes.map((n, i) => [n.id, i]));
		return sankey<SankeyNode, IndexedLink>()
			.nodeId((d) => d.index)
			.nodeWidth(8)
			.nodePadding(10)
			.nodeAlign(sankeyJustify)
			.extent([
				[1, 10],
				[width - 1, height - 10],
			])({
			nodes: nodes.map((n) => ({ ...n })),
			links: links.map((l) => ({
				source: index.get(l.source)!,
				target: index.get(l.target)!,
				value: l.value,
			})),
		});
	});

	// The theme's own chart palette, as Actual's reports use it.
	const QUALITATIVE = 9;

	function colorOf(node: SankeyNode & { index: number }): string {
		if (node.id === "budget") {
			return "var(--color-reportsGray)";
		}
		if (node.id === "net-gain" || node.id === "positive-cats") {
			return "var(--color-reportsGreen)";
		}
		if (node.id === "net-loss") {
			return "var(--color-reportsRed)";
		}
		return `var(--color-chartQual${(node.index % QUALITATIVE) + 1})`;
	}

	const linkPath = sankeyLinkHorizontal();
	type Laid = NonNullable<typeof graph>;
	type LaidLink = Laid["links"][number];

	// A link opens its more specific end: the payee or category, not the budget in the middle.
	const endOf = (link: LaidLink) => (link.target.id === "budget" ? link.source : link.target);
	const pickable = (node: SankeyNode) => !SUMMARY_NODES.has(node.id);

	// An id, not the node: a node kept in $state is a proxy, never === the layout's own.
	let hoveredId = $state<string | null>(null);

	function show(e: MouseEvent, title: string, value: number, node: SankeyNode, share?: boolean) {
		if (!interactive || !root) {
			return;
		}
		const rect = root.getBoundingClientRect();
		const pct = share && total > 0 ? ` (${((value / total) * 100).toFixed(1)}%)` : "";
		tip = {
			x: e.clientX - rect.left + 12,
			y: e.clientY - rect.top - 10,
			title,
			amount: fmtMoney(value) + pct,
			hint: pickable(node),
		};
	}

	function pick(e: MouseEvent | KeyboardEvent, node: SankeyNode) {
		tip = null;
		if (!interactive || !pickable(node)) {
			return;
		}
		const at =
			e instanceof MouseEvent
				? { x: e.clientX, y: e.clientY }
				: (() => {
						const r = (e.currentTarget as Element).getBoundingClientRect();
						return { x: r.left + r.width / 2, y: r.top };
					})();
		onpick(node, at.x, at.y);
	}

	const onKey = (node: SankeyNode) => (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			pick(e, node);
		}
	};
</script>

<!-- ib-chart: the transaction list leaves clicks here to the chart. -->
<div class="chart ib-chart" bind:this={root} bind:clientWidth={width} bind:clientHeight={height}>
	{#if !links.length}
		<p class="chart__empty">No data for this period</p>
	{:else if graph}
		<svg {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label="Income breakdown">
			<g class="chart__links" fill="none">
				{#each graph.links as link, i (i)}
					{@const end = endOf(link)}
					<path
						d={linkPath(link)}
						style:stroke={colorOf(end)}
						stroke-width={Math.max(1, link.width)}
						class:is-dim={hoveredId && link.source.id !== hoveredId && link.target.id !== hoveredId}
						class:is-lit={hoveredId &&
							(link.source.id === hoveredId || link.target.id === hoveredId)}
						role="button"
						tabindex="-1"
						aria-label="{link.source.name} to {link.target.name}"
						aria-disabled={!pickable(end)}
						onmouseenter={(e) =>
							show(e, `${link.source.name} → ${link.target.name}`, link.value, end, true)}
						onmousemove={(e) =>
							show(e, `${link.source.name} → ${link.target.name}`, link.value, end, true)}
						onmouseleave={() => (tip = null)}
						onclick={(e) => pick(e, end)}
						onkeydown={onKey(end)}
					/>
				{/each}
			</g>
			<g>
				{#each graph.nodes as node (node.id)}
					<rect
						x={node.x0}
						y={node.y0}
						width={node.x1 - node.x0}
						height={Math.max(1, node.y1 - node.y0)}
						style:fill={colorOf(node)}
						class="chart__node"
						role="button"
						tabindex={interactive && pickable(node) ? 0 : -1}
						aria-label="{node.name}, {fmtMoney(node.value)}"
						aria-disabled={!pickable(node)}
						onmouseenter={(e) => {
							hoveredId = node.id;
							show(e, node.name, node.value, node);
						}}
						onmousemove={(e) => show(e, node.name, node.value, node)}
						onmouseleave={() => {
							hoveredId = null;
							tip = null;
						}}
						onclick={(e) => pick(e, node)}
						onkeydown={onKey(node)}
					/>
				{/each}
			</g>
			<g class="chart__labels" aria-hidden="true">
				{#each graph.nodes as node (node.id)}
					{@const left = node.x0 < width / 2}
					<text
						x={left ? node.x1 + 6 : node.x0 - 6}
						y={(node.y1 + node.y0) / 2}
						dy="0.35em"
						text-anchor={left ? "start" : "end"}
						>{node.name}<tspan class="chart__amount abt-privacy-number" dx="6"
							>{fmtMoney(node.value)}</tspan
						></text
					>
				{/each}
			</g>
		</svg>
		{#if tip}
			<div class="chart__tip abt-popover" style:left="{tip.x}px" style:top="{tip.y}px">
				<span>{tip.title}</span>
				<strong class="abt-privacy-number">{tip.amount}</strong>
				{#if tip.hint}
					<span class="chart__hint">Click to see transactions</span>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.chart {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	svg {
		display: block;
	}

	.chart__empty {
		display: grid;
		place-items: center;
		height: 100%;
		margin: 0;
		color: var(--abt-muted);
	}

	.chart__links path {
		stroke-opacity: 0.35;
		cursor: pointer;
		transition: stroke-opacity 0.12s;
	}

	.chart__links path:hover,
	.chart__links path.is-lit {
		stroke-opacity: 0.6;
	}

	.chart__links path.is-dim {
		stroke-opacity: 0.15;
	}

	.chart__node {
		opacity: 0.9;
		cursor: pointer;
	}

	.chart__node:hover,
	.chart__node:focus-visible {
		opacity: 1;
	}

	/* The browser's ring outlines a flow's whole bounding box; keyboard focus is shown on the bar. */
	.chart__links path:focus,
	.chart__node:focus {
		outline: none;
	}

	.chart__node:focus-visible {
		stroke: var(--color-pageText);
		stroke-width: 2px;
	}

	[aria-disabled="true"] {
		cursor: default;
	}

	.chart__labels text {
		fill: var(--color-pageText);
		font-size: var(--abt-text-sm);
		pointer-events: none;
	}

	/* The name's colour, quieter: a subdued colour vanishes where the label crosses a flow. */
	.chart__amount {
		fill-opacity: 0.7;
		font-size: var(--abt-text-xs);
	}

	.chart__tip {
		position: absolute;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		padding: var(--abt-space-3) var(--abt-space-4);
		font-size: var(--abt-text-base);
		white-space: nowrap;
		pointer-events: none;
	}

	.chart__hint {
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}
</style>
