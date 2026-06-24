<script lang="ts">
	let { themeName, mode, isEditing, onSave, onDelete, onNameChange, onModeChange }: {
		themeName: string;
		mode: "dark" | "light";
		isEditing: boolean;
		onSave: () => void;
		onDelete: () => void;
		onNameChange: (name: string) => void;
		onModeChange: (mode: "dark" | "light") => void;
	} = $props();
</script>

<div class="creator-header">
	<div class="creator-header__meta">
		<input
			class="creator-header__name"
			type="text"
			value={themeName}
			placeholder="Theme name"
			oninput={(e) => onNameChange((e.target as HTMLInputElement).value)}
		/>
		<select
			class="creator-header__mode"
			value={mode}
			onchange={(e) => onModeChange((e.target as HTMLSelectElement).value as "dark" | "light")}
		>
			<option value="dark">Dark</option>
			<option value="light">Light</option>
		</select>
	</div>
	<div class="creator-header__actions">
		{#if isEditing}
			<button class="creator-header__delete" onclick={onDelete}>Delete</button>
		{/if}
		<button class="creator-header__save" onclick={onSave}>Save</button>
	</div>
</div>

<style>
	.creator-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		gap: 8px;
	}

	.creator-header__meta {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}

	.creator-header__name {
		font-family: inherit;
		font-size: 12px;
		font-weight: 600;
		padding: 4px 8px;
		border-radius: 6px;
		border: var(--border);
		background: var(--color-formInputBackground);
		color: var(--color-formInputText);
		outline: none;
		flex: 1;
		min-width: 0;
	}

	.creator-header__name:focus {
		border-color: var(--color-formInputBorderSelected);
	}

	.creator-header__mode {
		font-family: inherit;
		font-size: 10px;
		padding: 4px 6px;
		border-radius: 6px;
		border: var(--border);
		background: var(--color-formInputBackground);
		color: var(--color-formInputText);
		cursor: pointer;
	}

	.creator-header__actions {
		display: flex;
		gap: 6px;
	}

	.creator-header__delete,
	.creator-header__save {
		font-family: inherit;
		font-size: 11px;
		padding: 4px 10px;
		border-radius: 6px;
		border: var(--border);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.creator-header__delete {
		background: var(--color-buttonNormalBackground);
		color: var(--color-pageTextSubdued);
	}

	.creator-header__delete:hover {
		border-color: var(--color-errorBorder);
		color: var(--color-errorText);
	}

	.creator-header__save {
		background: var(--color-buttonPrimaryBackground);
		color: var(--color-buttonPrimaryText);
		border-color: var(--color-buttonPrimaryBackground);
	}

	.creator-header__save:hover {
		filter: brightness(1.1);
	}
</style>
