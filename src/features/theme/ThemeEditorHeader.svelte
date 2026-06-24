<!-- ThemeEditorHeader.svelte -->
<script lang="ts">
	import { editorState } from "./editor-state.svelte";

	let { onReset, onExport }: { onReset: () => void; onExport: () => string } = $props();

	let exportLabel = $state("Copy CSS");

	async function handleExport() {
		const css = onExport();
		if (!css) return;
		try {
			await navigator.clipboard.writeText(css);
			exportLabel = "Copied!";
			setTimeout(() => (exportLabel = "Copy CSS"), 1500);
		} catch {
			const blob = new Blob([css], { type: "text/css" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "actual.css";
			a.click();
			URL.revokeObjectURL(url);
		}
	}
</script>

<div class="editor__top">
	<div class="editor__meta">
		<span class="editor__icon">◈</span>
		<div>
			<p class="editor__title">Token Editor</p>
			<p class="editor__sub">{editorState.isSaving ? "saving…" : editorState.isDirty ? "unsaved" : "saved"}</p>
		</div>
	</div>
	<div class="editor__actions">
		<button class="editor__export" onclick={handleExport}>{exportLabel}</button>
		<button class="editor__reset" onclick={onReset}>↺ Reset</button>
	</div>
</div>

<style>
	.editor__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
		width: 100%;
	}

	.editor__meta {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.editor__icon {
		font-size: 18px;
		color: var(--color-sidebarItemAccentSelected);
		line-height: 1;
	}

	.editor__title {
		margin: 0;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-pageText);
	}

	.editor__sub {
		margin: 2px 0 0;
		font-size: 10px;
		color: var(--color-pageTextSubdued);
		letter-spacing: 0.04em;
	}

	.editor__actions {
		display: flex;
		gap: 6px;
	}

	.editor__export {
		font-family: inherit;
		font-size: 11px;
		padding: 4px 10px;
		border-radius: 6px;
		border: var(--border);
		background: var(--color-buttonNormalBackground);
		color: var(--color-sidebarItemAccentSelected);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.editor__export:hover {
		border-color: var(--color-sidebarItemAccentSelected);
	}

	.editor__reset {
		font-family: inherit;
		font-size: 11px;
		padding: 4px 10px;
		border-radius: 6px;
		border: var(--border);
		background: var(--color-buttonNormalBackground);
		color: var(--color-pageTextSubdued);
		cursor: pointer;
		transition:
			border-color 0.15s,
			color 0.15s;
	}

	.editor__reset:hover {
		border-color: var(--color-errorBorder);
		color: var(--color-errorText);
	}
</style>
