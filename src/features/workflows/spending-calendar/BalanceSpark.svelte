<script lang="ts">
	const {
		points,
		selected,
	}: {
		/** Each day's closing balance; future days are projected from schedules. */
		points: { balance: number; future: boolean }[];
		/** Index of the day being viewed. */
		selected: number;
	} = $props();

	const HEIGHT = 40;
	const PAD = 4;

	let width = $state(0);

	const shape = $derived.by(() => {
		if (width <= 0 || points.length < 2) {
			return null;
		}
		const values = points.map((p) => p.balance);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const span = max - min || 1;
		const x = (i: number) => PAD + (i * (width - PAD * 2)) / (points.length - 1);
		const y = (v: number) => PAD + ((max - v) * (HEIGHT - PAD * 2)) / span;
		const line = (from: number, to: number) =>
			points
				.slice(from, to + 1)
				.map((p, i) => `${i ? "L" : "M"}${x(from + i)},${y(p.balance)}`)
				.join("");
		const firstFuture = points.findIndex((p) => p.future);
		const lastPast = firstFuture === -1 ? points.length - 1 : firstFuture - 1;
		return {
			past: lastPast >= 0 ? line(0, lastPast) : "",
			future: firstFuture === -1 ? "" : line(Math.max(0, lastPast), points.length - 1),
			zero: min < 0 && max > 0 ? y(0) : null,
			dot: { x: x(selected), y: y(points[selected].balance) },
		};
	});
</script>

<div class="spark" bind:clientWidth={width}>
	{#if shape}
		<svg {width} height={HEIGHT} viewBox="0 0 {width} {HEIGHT}" aria-hidden="true">
			{#if shape.zero !== null}
				<line class="spark__zero" x1="0" x2={width} y1={shape.zero} y2={shape.zero} />
			{/if}
			<path class="spark__line" d={shape.past} />
			<path class="spark__line is-future" d={shape.future} />
			<circle class="spark__dot" cx={shape.dot.x} cy={shape.dot.y} r="3" />
		</svg>
	{/if}
</div>

<style>
	.spark {
		height: 40px;
	}

	svg {
		display: block;
	}

	.spark__line {
		fill: none;
		stroke: var(--abt-muted);
		stroke-width: 1.5px;
		stroke-linejoin: round;
	}

	/* Projected from schedules, not posted yet. */
	.spark__line.is-future {
		stroke-dasharray: 3 3;
		opacity: 0.6;
	}

	.spark__zero {
		stroke: var(--color-tableBorder);
		stroke-dasharray: 2 2;
	}

	.spark__dot {
		fill: var(--color-sidebarItemAccentSelected);
	}
</style>
