<script lang="ts">
	import { storedValue } from "@lib/stored.svelte";
	import { setValue } from "@lib/store";
	import { DEFAULT_FUTURE_COLOR, FUTURE_COLOR_KEY, isHexColor } from "./color";

	const stored = storedValue<unknown>(FUTURE_COLOR_KEY, DEFAULT_FUTURE_COLOR);
	const color = $derived(isHexColor(stored.current) ? stored.current : DEFAULT_FUTURE_COLOR);
</script>

<div class="abt-cluster fc">
	<label class="fc__pick">
		<input
			class="fc__input"
			type="color"
			value={color}
			aria-label="Future transaction color"
			onchange={(e) => setValue(FUTURE_COLOR_KEY, e.currentTarget.value)}
		/>
		<span>Color</span>
	</label>
	{#if color.toLowerCase() !== DEFAULT_FUTURE_COLOR}
		<button
			type="button"
			class="abt-btn abt-btn--sm abt-btn--ghost"
			onclick={() => setValue(FUTURE_COLOR_KEY, DEFAULT_FUTURE_COLOR)}
		>
			Reset
		</button>
	{/if}
</div>

<style>
	.fc {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	.fc__pick {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		cursor: pointer;
	}

	.fc__input {
		width: 28px;
		height: 22px;
		padding: 0;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
		background: none;
		cursor: pointer;
	}
</style>
