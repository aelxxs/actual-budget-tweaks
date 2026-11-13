<script lang="ts">
	let { initialCss, onCssApply }: { initialCss: string; onCssApply: (css: string) => void } =
		$props();

	let cssInput = $derived(initialCss);

	function applyCss() {
		const trimmed = cssInput.trim();
		if (trimmed) {
			onCssApply(trimmed);
		}
	}
</script>

<div class="creator">
	<div class="creator__css">
		<textarea
			class="creator__css-input"
			placeholder={`:root {\n  --color-pageBackground: #1e1e2e;\n  --color-pageText: #cdd6f4;\n  /* ... all color tokens */\n}`}
			bind:value={cssInput}
			rows="16"></textarea>
		<button class="creator__css-apply" onclick={applyCss}>Apply CSS</button>
	</div>
</div>

<style>
	.creator {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		color: var(--color-pageText);
	}

	.creator__css {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
	}

	.creator__css-input {
		flex: 1;
		font-family: "Fira Code", "Cascadia Code", "JetBrains Mono", monospace;
		font-size: var(--abt-text-sm);
		padding: 10px;
		border-radius: var(--abt-radius-sm);
		border: var(--border);
		background: var(--color-formInputBackground);
		color: var(--color-formInputText);
		resize: none;
		outline: none;
	}

	.creator__css-input:focus {
		border-color: var(--color-formInputBorderSelected);
	}

	.creator__css-input::placeholder {
		color: var(--color-formInputTextPlaceholder);
	}

	.creator__css-apply {
		font-family: inherit;
		font-size: var(--abt-text-sm);
		padding: 7px 12px;
		border-radius: var(--abt-radius-sm);
		border: none;
		background: var(--color-buttonPrimaryBackground);
		color: var(--color-buttonPrimaryText);
		cursor: pointer;
		align-self: flex-end;
	}

	.creator__css-apply:hover {
		filter: brightness(1.1);
	}
</style>
