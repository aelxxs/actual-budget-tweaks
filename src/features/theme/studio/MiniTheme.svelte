<script lang="ts">
	import type { Generated } from "./generator";

	const { g }: { g: Generated } = $props();
</script>

<span
	class="mini"
	style:--m-side={g.sidebar.bg}
	style:--m-page={g.colours.crust}
	style:--m-card={g.colours.mantle}
	style:--m-text={g.colours.text}
	style:--m-accent={g.sidebar.sel}
	aria-hidden="true"
>
	<i class="side"></i>
	<i class="page"></i>
</span>

<style>
	.mini {
		display: grid;
		grid-template-columns: 30% 1fr;
		width: 100%;
		aspect-ratio: 16 / 10;
		overflow: hidden;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
	}
	i {
		position: relative;
		display: block;
	}
	.side {
		background: var(--m-side);
	}
	/* The selected sidebar item. */
	.side::after {
		content: "";
		position: absolute;
		top: 24%;
		left: 18%;
		width: 55%;
		height: 3px;
		border-radius: 2px;
		background: var(--m-accent);
	}
	.page {
		background: var(--m-page);
	}
	.page::before {
		content: "";
		position: absolute;
		inset: 24% 10% 16%;
		border-radius: 2px;
		background: var(--m-card);
	}
	.page::after {
		content: "";
		position: absolute;
		top: 36%;
		left: 18%;
		width: 40%;
		height: 3px;
		border-radius: 2px;
		background: var(--m-text);
		opacity: 0.6;
	}
</style>
