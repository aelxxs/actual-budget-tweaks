<script lang="ts">
	const {
		checked,
		onCheckedChange,
		disabled = false,
	}: {
		checked: boolean;
		onCheckedChange: (checked: boolean) => void;
		disabled?: boolean;
	} = $props();
</script>

<span class="switch">
	<input
		type="checkbox"
		class="switch__input"
		{checked}
		{disabled}
		onchange={(e) => onCheckedChange(e.currentTarget.checked)}
	/>
	<span class="switch__track">
		<span class="switch__thumb"></span>
	</span>
</span>

<style>
	.switch {
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
		width: 28px;
		height: 16px;
	}

	.switch__input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.switch__input:disabled {
		cursor: not-allowed;
	}

	.switch__track {
		position: absolute;
		inset: 0;
		border-radius: var(--abt-radius-pill);
		background-color: var(--color-checkboxToggleBackground);
		transition: background-color 0.15s;
	}

	.switch__thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: var(--abt-radius-pill);
		background: white;
		transition: transform 0.15s;
	}

	.switch__input:checked ~ .switch__track {
		background-color: var(--color-checkboxToggleBackgroundSelected);
	}

	.switch__input:checked ~ .switch__track .switch__thumb {
		transform: translateX(12px);
	}

	.switch__input:disabled ~ .switch__track {
		background-color: var(--color-checkboxToggleDisabled);
	}

	.switch__input:focus-visible ~ .switch__track {
		outline: 2px solid var(--color-formInputBorderSelected);
		outline-offset: 2px;
	}
</style>
