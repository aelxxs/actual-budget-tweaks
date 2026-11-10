<script lang="ts">
	import type { Thumb } from "./thumbs";

	/** A small sketch of the app in a theme's colors: sidebar, a page heading, and a card with a chart and a button. */
	const { thumb }: { thumb: Thumb } = $props();
</script>

<span
	class="thumb"
	style:--m-side={thumb.side}
	style:--m-page={thumb.page}
	style:--m-card={thumb.card}
	style:--m-text={thumb.text}
	style:--m-accent={thumb.accent}
	aria-hidden="true"
>
	<span class="side">
		<i class="item selected"></i>
		<i class="item"></i>
		<i class="item short"></i>
		<i class="item"></i>
	</span>
	<span class="page">
		<i class="heading"></i>
		<span class="card">
			<span class="bars">
				<i style:height="45%"></i>
				<i style:height="80%"></i>
				<i style:height="60%"></i>
				<i style:height="100%"></i>
				<i style:height="35%"></i>
			</span>
			<span class="foot">
				<i class="line"></i>
				<i class="button"></i>
			</span>
		</span>
	</span>
</span>

<style>
	.thumb {
		display: grid;
		grid-template-columns: 28% 1fr;
		width: 100%;
		aspect-ratio: 16 / 10;
		overflow: hidden;
		border-radius: inherit;
		container-type: inline-size;
	}
	span,
	i {
		display: block;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 3.5cqw;
		padding: 6cqw 4.5cqw 0;
		background: var(--m-side);
	}
	.item {
		width: 70%;
		height: 2cqw;
		border-radius: 2px;
		background: var(--m-text);
		opacity: 0.35;
	}
	.item.selected {
		width: 90%;
		background: var(--m-accent);
		opacity: 1;
	}
	.item.short {
		width: 50%;
	}
	.page {
		display: flex;
		flex-direction: column;
		gap: 4cqw;
		padding: 6cqw 6cqw 6cqw;
		background: var(--m-page);
	}
	.heading {
		flex: none;
		width: 40%;
		height: 2.5cqw;
		border-radius: 2px;
		background: var(--m-text);
		opacity: 0.7;
	}
	.card {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 4cqw;
		padding: 5cqw;
		border-radius: 2cqw;
		background: var(--m-card);
	}
	.bars {
		display: flex;
		flex: 1;
		align-items: flex-end;
		gap: 2.5cqw;
	}
	.bars i {
		flex: 1;
		border-radius: 1px 1px 0 0;
		background: var(--m-accent);
		opacity: 0.55;
	}
	.bars i:nth-child(4) {
		opacity: 1;
	}
	.foot {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: space-between;
		gap: 4cqw;
	}
	.line {
		width: 45%;
		height: 2cqw;
		border-radius: 2px;
		background: var(--m-text);
		opacity: 0.5;
	}
	.button {
		width: 30%;
		height: 5cqw;
		border-radius: 1.2cqw;
		background: var(--m-accent);
	}
</style>
