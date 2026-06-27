<script lang="ts">
	import { onMount } from "svelte";
	import { getFaviconUrl } from "@lib/utilities/favicon";
	import type { AccountIconData } from "./index";
	import {
		EMOJI_CATEGORIES,
		getEmojiAssetUrl,
		guessBank,
		loadIconCache,
		splitEmojiGraphemes,
	} from "./index";

	const { accountId, accountName, hasIcon, onSave, onRemove, onClose } = $props<{
		accountId: string;
		accountName: string;
		hasIcon: boolean;
		onSave: (iconData: AccountIconData) => Promise<void>;
		onRemove: () => Promise<void>;
		onClose: () => void;
	}>();

	type Tab = "auto" | "upload" | "emoji";
	let activeTab = $state<Tab>("auto");
	let hasIconActual = $state(hasIcon);

	// Upload tab
	let uploadedDataUrl = $state<string | null>(null);
	let isDragOver = $state(false);
	let fileInputEl: HTMLInputElement;

	// Auto tab
	const guessedDomain = guessBank(accountName);
	let autoDomain = $state(guessedDomain ?? "");
	let autoLogoUrl = $state<string | null>(
		guessedDomain ? getFaviconUrl(guessedDomain) : null,
	);
	let autoLogoLoaded = $state(false);
	let autoLogoError = $state(false);

	onMount(async () => {
		const icons = await loadIconCache();
		hasIconActual = Boolean(icons[accountId]);
	});

	function fetchLogo(): void {
		const domain = autoDomain.trim().toLowerCase();
		if (!domain) {
			autoLogoUrl = null;
			autoLogoLoaded = false;
			autoLogoError = false;
			return;
		}
		autoLogoUrl = getFaviconUrl(domain);
		autoLogoLoaded = false;
		autoLogoError = false;
	}

	async function handleEmojiClick(emoji: string): Promise<void> {
		await onSave({ type: "emoji", value: emoji });
	}

	async function handleAutoUse(): Promise<void> {
		if (autoLogoUrl) {
			await onSave({ type: "url", value: autoLogoUrl });
		}
	}

	async function handleSave(): Promise<void> {
		if (uploadedDataUrl) {
			await onSave({ type: "dataUrl", value: uploadedDataUrl });
		} else {
			onClose();
		}
	}

	function handleFileChange(event: Event): void {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) readFile(file);
	}

	function handleDrop(event: DragEvent): void {
		event.preventDefault();
		isDragOver = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) readFile(file);
	}

	function readFile(file: File): void {
		if (!file.type.startsWith("image/")) {
			alert("Please select an image file");
			return;
		}
		const reader = new FileReader();
		reader.onload = (e) => {
			uploadedDataUrl = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}
</script>

<div class="modal">
	<div class="backdrop" role="presentation" onclick={onClose}></div>
	<div class="content">
		<button class="close" onclick={onClose}>✕</button>
		<div class="header">Set icon for {accountName}</div>

		<div class="tabs">
			<div class="tab-buttons">
				<button class="tab-btn" class:active={activeTab === "auto"} onclick={() => (activeTab = "auto")}
					>Auto</button
				>
				<button class="tab-btn" class:active={activeTab === "upload"} onclick={() => (activeTab = "upload")}
					>Upload</button
				>
				<button class="tab-btn" class:active={activeTab === "emoji"} onclick={() => (activeTab = "emoji")}
					>Emoji</button
				>
			</div>

			{#if activeTab === "auto"}
				<div class="tab-pane">
					<div class="auto-container">
						<div class="input-group">
							<input
								type="text"
								class="domain-input"
								placeholder="e.g., bankofamerica.com"
								bind:value={autoDomain}
							/>
							<button class="fetch-btn" onclick={fetchLogo}>Fetch Logo</button>
						</div>
						<div class="preview">
							{#if autoLogoUrl && !autoLogoError}
								<img
									src={autoLogoUrl}
									alt="Bank logo"
									class="logo-img"
									onload={() => {
										autoLogoLoaded = true;
										autoLogoError = false;
									}}
									onerror={() => {
										autoLogoLoaded = false;
										autoLogoError = true;
									}}
								/>
							{:else if autoLogoError}
								<p class="hint">Could not load logo for {autoDomain.trim().toLowerCase()}</p>
							{:else}
								<p class="hint">Enter a domain to fetch its favicon</p>
							{/if}
						</div>
						{#if autoLogoLoaded}
							<button class="use-btn" onclick={handleAutoUse}>Use this logo</button>
						{/if}
					</div>
				</div>
			{:else if activeTab === "upload"}
				<div class="tab-pane">
					<input
						type="file"
						accept="image/*"
						class="file-input"
						bind:this={fileInputEl}
						onchange={handleFileChange}
					/>
					<div
						class="upload-area"
						class:drag-over={isDragOver}
						role="button"
						tabindex="0"
						onclick={() => fileInputEl.click()}
						onkeydown={(e) => e.key === "Enter" && fileInputEl.click()}
						ondragover={(e) => {
							e.preventDefault();
							isDragOver = true;
						}}
						ondragleave={() => {
							isDragOver = false;
						}}
						ondrop={handleDrop}
					>
						{#if uploadedDataUrl}
							<img src={uploadedDataUrl} alt="preview" class="upload-preview" />
						{:else}
							<span class="upload-label">Drag &amp; drop an image or click to browse</span>
						{/if}
					</div>
				</div>
			{:else}
				<div class="tab-pane emoji-pane">
					<div class="emoji-grid">
						{#each Object.entries(EMOJI_CATEGORIES) as [category, emojis]}
							<div class="category">
								<div class="category-title">{category}</div>
								<div class="category-emojis">
									{#each splitEmojiGraphemes(emojis) as emoji}
										<button
											class="emoji-btn"
											title={emoji}
											aria-label={emoji}
											onclick={() => handleEmojiClick(emoji)}
										>
											{emoji}
											<img
												src={getEmojiAssetUrl(emoji)}
												alt=""
												class="emoji-img"
												onload={(e) => {
													const img = e.currentTarget as HTMLImageElement;
													img.style.opacity = "1";
													(img.parentElement as HTMLElement).style.color = "transparent";
												}}
												onerror={(e) => (e.currentTarget as HTMLElement).remove()}
											/>
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="actions">
				{#if hasIconActual}
					<button class="remove-btn" onclick={onRemove}>Remove icon</button>
				{/if}
				<button class="save-btn" style={hasIconActual ? "" : "grid-column: 1 / -1"} onclick={handleSave}
					>Save</button
				>
			</div>
		</div>
	</div>
</div>

<style>
	.modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.backdrop {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.3);
	}

	.content {
		position: relative;
		background: var(--color-modalBackground);
		border: var(--border);
		border-radius: var(--border-radius);
		padding: 1.5rem;
		width: 600px;
		max-height: 80vh;
		overflow-y: auto;
		z-index: 10001;
	}

	.close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-tooltipText);
		font-size: 18px;
		cursor: pointer;
		z-index: 10002;
	}

	.close:hover {
		color: var(--color-buttonNormalText);
	}

	.header {
		text-align: center;
		font-weight: bold;
		color: var(--color-tooltipText);
		margin-bottom: 1.5rem;
	}

	.tabs {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.tab-buttons {
		display: flex;
		gap: 0.5rem;
		border-bottom: var(--border);
		padding-bottom: 0.5rem;
	}

	.tab-btn {
		padding: 0.5rem 1rem;
		border: 0;
		background: transparent;
		color: var(--color-formLabelText);
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		border-bottom: 2px solid transparent;
		transition: all 0.2s;
	}

	.tab-btn:hover {
		color: var(--color-buttonNormalText);
	}

	.tab-btn.active {
		color: var(--color-buttonPrimaryBackground);
		border-bottom-color: var(--color-buttonPrimaryBackground);
	}

	.tab-pane {
		min-height: 200px;
	}

	.auto-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		min-height: 200px;
	}

	.input-group {
		display: flex;
		gap: 0.5rem;
		width: 100%;
		box-sizing: border-box;
	}

	.domain-input {
		padding: 0.5rem;
		border-radius: var(--border-radius);
		border: var(--border);
		background: var(--color-formInputBackground);
		color: var(--color-formInputText);
		flex: 1;
		box-sizing: border-box;
	}

	.fetch-btn {
		padding: 0.5rem 1rem;
		border-radius: var(--border-radius);
		border: var(--border);
		background: var(--color-buttonPrimaryBackground);
		color: var(--color-buttonPrimaryText);
		cursor: pointer;
		white-space: nowrap;
	}

	.preview {
		min-height: 100px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1rem;
	}

	.logo-img {
		max-width: 100%;
		max-height: 120px;
		border-radius: 8px;
	}

	.hint {
		color: var(--color-formLabelText);
		margin: 0;
	}

	.use-btn {
		padding: 0.5rem 1rem;
		border-radius: var(--border-radius);
		border: var(--border);
		background: var(--color-buttonNormalBackground);
		color: var(--color-buttonNormalText);
		cursor: pointer;
		width: 100%;
	}

	.file-input {
		display: none;
	}

	.upload-area {
		border: 2px dashed var(--color-tableBorder);
		border-radius: var(--border-radius);
		padding: 2rem;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s;
		background: transparent;
		min-height: 150px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	.upload-area:hover,
	.upload-area.drag-over {
		border-color: var(--color-buttonPrimaryBackground);
		background: var(--color-formInputBackgroundSelected);
	}

	.upload-label {
		color: var(--color-formLabelText);
		font-size: 14px;
	}

	.upload-preview {
		max-width: 100%;
		max-height: 200px;
		border-radius: var(--border-radius);
	}

	.emoji-pane {
		overflow: hidden;
	}

	.emoji-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.category {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.category-title {
		font-size: 12px;
		font-weight: bold;
		color: var(--color-formLabelText);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.category-emojis {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
		gap: 0.5rem;
	}

	.emoji-btn {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		padding: 0;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--border-radius);
		background: var(--color-tableBackground);
		color: inherit;
		font-size: 20px;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.emoji-btn:hover {
		background: var(--color-tableRowBackgroundHover);
		border-color: var(--color-tableBorderHover);
		transform: scale(1.05);
	}

	.emoji-img {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 24px;
		height: 24px;
		object-fit: contain;
		pointer-events: none;
		opacity: 0;
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.save-btn {
		width: 100%;
		padding: 0.75rem;
		border: var(--border);
		border-radius: var(--border-radius);
		background: var(--color-buttonPrimaryBackground);
		color: var(--color-buttonPrimaryText);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.save-btn:hover {
		background: var(--color-buttonPrimaryBackgroundHover);
	}

	.remove-btn {
		width: 100%;
		padding: 0.75rem;
		border: var(--border);
		border-radius: var(--border-radius);
		background: var(--color-buttonNormalBackground);
		color: var(--color-buttonNormalText);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.remove-btn:hover {
		background: var(--color-buttonNormalBackgroundHover);
	}
</style>
