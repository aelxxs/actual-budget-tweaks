<script lang="ts">
	import { dispatch } from "@lib/utilities/actual-api";
	import { PanelLeftClose, Plus, Redo2, Undo2 } from "lucide-svelte";
	import { tooltip } from "../actions/tooltip.svelte";
	import { isMac } from "../lib/search";

	const { onCollapse }: { onCollapse?: () => void } = $props();

	const undoShortcut = $derived(isMac() ? "⌘Z" : "Ctrl+Z");
	const redoShortcut = $derived(isMac() ? "⌘⇧Z" : "Ctrl+Shift+Z");

	async function addAccount() {
		await dispatch("pushModal", { modal: { name: "add-account", options: {} } });
	}

	async function undo() {
		await dispatch("undo");
	}

	async function redo() {
		await dispatch("redo");
	}
</script>

<div class="footer">
	<button type="button" class="add-account" onclick={addAccount}>
		<Plus class="plus" strokeWidth={2.2} />
		<span>Add account</span>
	</button>
	<div class="footer-actions">
		<button
			type="button"
			class="collapse"
			aria-label="Undo {undoShortcut}"
			use:tooltip={{ text: `Undo ${undoShortcut}`, placement: "top" }}
			onclick={undo}
		>
			<Undo2 strokeWidth={1.5} />
		</button>
		<button
			type="button"
			class="collapse"
			aria-label="Redo {redoShortcut}"
			use:tooltip={{ text: `Redo ${redoShortcut}`, placement: "top" }}
			onclick={redo}
		>
			<Redo2 strokeWidth={1.5} />
		</button>
		{#if onCollapse}
			<button
				type="button"
				class="collapse"
				aria-label="Collapse sidebar"
				use:tooltip={{ text: "Collapse sidebar", placement: "top" }}
				onclick={onCollapse}
			>
				<PanelLeftClose strokeWidth={1.5} />
			</button>
		{/if}
	</div>
</div>
