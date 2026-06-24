<script lang="ts">
	let { label, value, onHexInput, onPickerChange }: {
		label: string;
		value: string;
		onHexInput: (value: string) => void;
		onPickerChange: (value: string) => void;
	} = $props();

	const pickerValue = $derived(/^#[0-9a-f]{3,6}$/i.test(value) ? value : "#000000");
</script>

<div class="color-row">
	<div class="color-row__swatch" style="background: {pickerValue}"></div>
	<span class="color-row__label" title={label}>{label}</span>
	<div class="color-row__inputs">
		<input
			class="color-row__hex"
			type="text"
			{value}
			spellcheck="false"
			oninput={(e) => onHexInput((e.target as HTMLInputElement).value)}
		/>
		<input
			class="color-row__picker"
			type="color"
			value={pickerValue}
			oninput={(e) => onPickerChange((e.target as HTMLInputElement).value)}
		/>
	</div>
</div>

<style>
	.color-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px;
		transition: background 0.1s;
	}

	.color-row:hover {
		background: var(--color-tableRowBackgroundHover);
	}

	.color-row__swatch {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		flex-shrink: 0;
		border: var(--border);
	}

	.color-row__label {
		flex: 1;
		font-size: 11px;
		color: var(--color-pageTextLight);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.color-row__inputs {
		display: flex;
		align-items: center;
		gap: 5px;
		flex-shrink: 0;
	}

	.color-row__hex {
		font-family: "Fira Code", "Cascadia Code", "JetBrains Mono", monospace;
		font-size: 10px;
		width: 68px;
		padding: 3px 5px;
		border-radius: 4px;
		border: var(--border);
		background: var(--color-formInputBackground);
		color: var(--color-formInputText);
		outline: none;
		transition: border-color 0.15s;
	}

	.color-row__hex:focus {
		border-color: var(--color-formInputBorderSelected);
	}

	.color-row__picker {
		-webkit-appearance: none;
		appearance: none;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		border: var(--border);
		background: none;
		cursor: pointer;
		padding: 0;
		overflow: hidden;
	}

	.color-row__picker::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	.color-row__picker::-webkit-color-swatch {
		border: none;
		border-radius: 3px;
	}

	.color-row__picker::-moz-color-swatch {
		border: none;
		border-radius: 3px;
	}
</style>
