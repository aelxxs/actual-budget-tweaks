<script lang="ts">
	import { Search, X } from "@lucide/svelte";
	import type { HTMLInputAttributes } from "svelte/elements";

	/** A search box with ABT's own clear button, the same in every browser and theme. */
	let {
		value = $bindable(""),
		input = $bindable(null),
		label,
		placeholder = label,
		...rest
	}: Omit<HTMLInputAttributes, "value" | "type"> & {
		value?: string;
		input?: HTMLInputElement | null;
		/** Read out by screen readers, and the placeholder unless one is given. */
		label: string;
	} = $props();

	function clear() {
		value = "";
		input?.focus();
		input?.dispatchEvent(new Event("input", { bubbles: true }));
	}
</script>

<span class="sf">
	<Search size={14} strokeWidth={1.75} aria-hidden="true" />
	<input
		{...rest}
		class="abt-input"
		type="search"
		{placeholder}
		aria-label={label}
		bind:value
		bind:this={input}
	/>
	{#if value}
		<!-- Keeps focus in the field, so a list that closes on blur stays open. -->
		<button
			type="button"
			class="sf__clear"
			aria-label="Clear search"
			onpointerdown={(e) => e.preventDefault()}
			onclick={clear}
		>
			<X size={12} />
		</button>
	{/if}
</span>

<style>
	.sf {
		position: relative;
		display: flex;
		flex: 1 1 auto;
		align-items: center;
		min-width: 0;
		color: var(--abt-muted);
	}
	.sf > :global(svg) {
		position: absolute;
		left: var(--abt-space-3);
		pointer-events: none;
	}
	.sf input {
		flex: 1;
		width: 100%;
		min-width: 0;
		padding-left: calc(var(--abt-space-3) + 20px);
		padding-right: calc(var(--abt-space-2) + 20px);
	}
	/* Chrome's own clear button is blue on every theme, and Firefox has none. */
	.sf input::-webkit-search-cancel-button {
		appearance: none;
	}
	.sf__clear {
		position: absolute;
		right: var(--abt-space-2);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--abt-muted);
		cursor: pointer;
	}
	.sf__clear:hover {
		background: var(--abt-fill-hover);
		color: var(--abt-ink);
	}
</style>
