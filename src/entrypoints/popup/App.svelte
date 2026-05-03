<script lang="ts">
	import { getValue, normalizeBaseUrl, setValue } from "@/lib/utilities/store";
	import { onMount } from "svelte";

	let userLink = $state("");
	let savedUserLink = $state("");
	let activeTabUrl = $state<string | null>(null);
	let justSaved = $state(false);

	const savedBaseUrl = $derived(normalizeBaseUrl(savedUserLink));
	const pendingBaseUrl = $derived(normalizeBaseUrl(userLink));
	const isDirty = $derived(userLink.trim() !== savedUserLink.trim());
	const canSave = $derived(isDirty);

	const status = $derived.by<"active" | "inactive" | "unconfigured">(() => {
		if (!savedBaseUrl) return "unconfigured";
		if (activeTabUrl && activeTabUrl.startsWith(savedBaseUrl)) return "active";
		return "inactive";
	});

	const statusLabel = $derived(
		status === "active"
			? "Active on this tab"
			: status === "inactive"
				? "Not active on this tab"
				: "Not configured",
	);

	onMount(async () => {
		const saved = ((await getValue("user-link", "")) as string) ?? "";
		userLink = saved;
		savedUserLink = saved;

		try {
			const tabs = await browser.tabs.query({ active: true, currentWindow: true });
			activeTabUrl = tabs[0]?.url ?? null;
		} catch {
			activeTabUrl = null;
		}
	});

	function onInput(event: Event) {
		userLink = (event.target as HTMLInputElement).value;
		justSaved = false;
	}

	async function save() {
		if (!canSave) return;
		const toStore = userLink.trim() === "" ? "" : (pendingBaseUrl ?? userLink.trim());
		await setValue("user-link", toStore);
		userLink = toStore;
		savedUserLink = toStore;
		justSaved = true;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			void save();
		}
	}

	async function openActual() {
		if (!savedBaseUrl) return;
		await browser.tabs.create({ url: savedBaseUrl });
	}
</script>

<main>
	<header>
		<h1>Actual Budget Tweaks</h1>
		<div class="status" data-status={status} role="status" aria-live="polite">
			<span class="dot" aria-hidden="true"></span>
			<span>{statusLabel}</span>
		</div>
	</header>

	<div class="field">
		<label for="user-link-input">Actual URL</label>
		<div class="input-row">
			<input
				id="user-link-input"
				type="url"
				placeholder="https://budget.example.com/"
				value={userLink}
				oninput={onInput}
				onkeydown={onKeydown}
				autocomplete="off"
				spellcheck="false"
				aria-describedby="user-link-hint"
			/>
			<button type="button" class="secondary" onclick={save} disabled={!canSave}>Save</button>
		</div>
		{#if justSaved && !isDirty}
			<p id="user-link-hint" class="hint saved">Saved.</p>
		{:else}
			<p id="user-link-hint" class="hint">
				Point this at your Actual server (e.g. <code>https://huge-chinchilla.pikapod.net/</code>).
			</p>
		{/if}
	</div>

	<button type="button" class="primary" onclick={openActual} disabled={!savedBaseUrl}>
		Open Actual
	</button>

	<p class="footnote">Per-tweak settings live inside Actual → Settings.</p>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	header {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	h1 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--fg-muted);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--fg-muted);
	}

	.status[data-status="active"] .dot {
		background: var(--ok);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--ok) 20%, transparent);
	}

	.status[data-status="unconfigured"] .dot {
		background: var(--warn);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	label {
		font-size: 13px;
		font-weight: 600;
		color: var(--fg);
	}

	.input-row {
		display: flex;
		gap: 6px;
		align-items: stretch;
	}

	.input-row input {
		flex: 1;
		min-width: 0;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		padding: 7px 9px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font: inherit;
		color: var(--fg);
		background: var(--surface);
		outline: none;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent);
	}

	input::placeholder {
		color: var(--fg-muted);
	}

	.hint {
		margin: 0;
		font-size: 12px;
		color: var(--fg-muted);
	}

	.hint.saved {
		color: var(--ok);
	}

	.hint code {
		padding: 1px 4px;
		border-radius: 3px;
		background: var(--surface);
		font-size: 11px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.primary {
		appearance: none;
		width: 100%;
		padding: 8px 10px;
		border: 1px solid transparent;
		border-radius: 6px;
		font: inherit;
		font-weight: 600;
		color: var(--accent-contrast);
		background: var(--accent);
		cursor: pointer;
		transition:
			filter 0.15s,
			box-shadow 0.15s;
	}

	.primary:hover:not(:disabled) {
		filter: brightness(1.05);
	}

	.primary:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 35%, transparent);
	}

	.primary:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.secondary {
		appearance: none;
		padding: 0 12px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font: inherit;
		font-weight: 600;
		color: var(--fg);
		background: var(--surface);
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
	}

	.secondary:hover:not(:disabled) {
		border-color: var(--border-strong);
	}

	.secondary:focus-visible {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent);
	}

	.secondary:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.footnote {
		margin: 0;
		font-size: 12px;
		color: var(--fg-muted);
		text-align: center;
	}
</style>
