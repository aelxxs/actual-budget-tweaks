<script lang="ts">
	import { scriptSections } from "../features";
	import CheckboxOption from "./components/Checkbox.svelte";
	import SelectOption from "./components/Select.svelte";

	const REPO_URL = "https://github.com/aelxxs/actual-budget-tweaks";

	let query = $state("");
	let collapsed = $state<Record<string, boolean>>({});

	let showBugModal = $state(false);
	let bugFeature = $state("");
	let bugDescription = $state("");

	function openBugReport() {
		bugFeature = "";
		bugDescription = "";
		showBugModal = true;
	}

	function closeBugReport() {
		showBugModal = false;
	}

	function submitBugReport() {
		const title = bugFeature ? `[Bug] ${bugFeature}` : "[Bug] General issue";
		const body = [
			bugFeature ? `**Feature:** ${bugFeature}` : "",
			"",
			"**Description:**",
			bugDescription || "_No description provided._",
			"",
			"---",
			"_Reported via Actual Budget Tweaks settings_",
		]
			.filter((line, i) => i > 0 || line)
			.join("\n");

		const url = `${REPO_URL}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=bug`;
		window.open(url, "_blank", "noopener,noreferrer");
		closeBugReport();
	}

	const normalizedQuery = $derived(query.trim().toLowerCase());
	const filteredSections = $derived.by(() => {
		if (!normalizedQuery) return scriptSections;

		return scriptSections
			.map((section) => ({
				...section,
				items: section.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
			}))
			.filter((section) => section.items.length > 0);
	});

	const totalVisibleSettings = $derived(filteredSections.reduce((count, section) => count + section.items.length, 0));

	function toggleSection(title: string) {
		collapsed[title] = !collapsed[title];
	}

	function isSectionCollapsed(title: string) {
		// When searching, force all sections open
		return !normalizedQuery && !!collapsed[title];
	}

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			},
		};
	}
</script>

<div class="settings-page stack" style="--space: 1rem;">
	<div class="header stack" style="--space: 0.6rem;">
		<div class="title-row cluster" style="--gutter: 0.5rem; --align: center; --justify: space-between;">
			<span><strong>Interface Settings</strong> — Configure Actual</span>
			<button class="bug-report-btn" onclick={openBugReport} title="Report a bug">
				<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
					<path
						d="M4.72.22a.75.75 0 0 1 1.06 0l1.204 1.203A3.98 3.98 0 0 1 8 1.25c.357 0 .7.047 1.016.134L10.22.22a.75.75 0 1 1 1.06 1.06l-.96.96A3.99 3.99 0 0 1 11.95 4.5h.55a.75.75 0 0 1 0 1.5h-.337a5.03 5.03 0 0 1 .088.86v.39H13a.75.75 0 0 1 0 1.5h-.749v.39c0 .318-.03.63-.088.86H13a.75.75 0 0 1 0 1.5h-.55a3.99 3.99 0 0 1-1.63 1.96l.96.96a.75.75 0 1 1-1.06 1.06l-1.204-1.203A3.98 3.98 0 0 1 8 14.75a3.98 3.98 0 0 1-1.016-.134L5.78 15.78a.75.75 0 0 1-1.06-1.06l.96-.96A3.99 3.99 0 0 1 4.05 11.5H3.5a.75.75 0 0 1 0-1.5h.337a5.03 5.03 0 0 1-.088-.86v-.39H3a.75.75 0 0 1 0-1.5h.749v-.39c0-.318.03-.63.088-.86H3.5a.75.75 0 0 1 0-1.5h.55a3.99 3.99 0 0 1 1.63-1.96l-.96-.96A.75.75 0 0 1 4.72.22ZM6.173 5a2.5 2.5 0 0 0-.672 1.25h5a2.5 2.5 0 0 0-.673-1.25H6.173ZM5.5 7.75v.39a3.51 3.51 0 0 0 .586 1.935l.064.085A2.5 2.5 0 0 0 8 11.25a2.5 2.5 0 0 0 1.85-1.09l.064-.085A3.51 3.51 0 0 0 10.5 8.14v-.39h-5Z"
					/>
				</svg>
				Report Bug
			</button>
		</div>
		<div class="search-row cluster" style="--gutter: 0.5rem; --align: center;">
			<input
				type="search"
				class="search-input"
				placeholder="Filter settings"
				bind:value={query}
				aria-label="Filter settings"
			/>
			<span class="search-meta">{totalVisibleSettings} visible</span>
		</div>
	</div>

	{#if filteredSections.length === 0}
		<p class="empty">No settings matched "{query}".</p>
	{:else}
		{#each filteredSections as section (section.title)}
			{@const isCollapsed = isSectionCollapsed(section.title)}
			<section class="settings-section" class:collapsed={isCollapsed}>
				<button
					class="section-toggle"
					onclick={() => toggleSection(section.title)}
					aria-expanded={!isCollapsed}
				>
					<div class="section-header">
						<h3>{section.title}</h3>
						<p>{section.description}</p>
					</div>
					<svg class="chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<path
							d="M4 6l4 4 4-4"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
				{#if !isCollapsed}
					<div class="settings-list stack" style="--space: 0.55rem;">
						{#each section.items as item (item.context.key)}
							{#if item.type === "select"}
								<SelectOption
									labelText={item.label}
									options={item.options}
									ctx={item.context}
									onChange={item.onChange}
								/>
							{:else if item.type === "custom"}
								{#if item.component}
									{@const C = item.component}
									<div class="custom-setting" data-testid={item.context.key}>
										<span class="setting-label">{item.label}</span>
										<C ctx={item.context} />
									</div>
								{:else}
									<div data-testid={item.context.key}></div>
								{/if}
							{:else if item.type === "checkbox"}
								<CheckboxOption labelText={item.label} ctx={item.context} onChange={item.onChange} />
							{/if}
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	{/if}
</div>

{#if showBugModal}
	<div class="bug-modal" use:portal>
		<div class="bug-backdrop" role="presentation" onclick={closeBugReport}></div>
		<div class="bug-content">
			<button class="bug-close" onclick={closeBugReport}>&times;</button>
			<h3 class="bug-title">Report a Bug</h3>

			<label class="bug-label" for="bug-feature">Affected Feature</label>
			<select id="bug-feature" class="bug-select" bind:value={bugFeature}>
				<option value="">General / Not sure</option>
				{#each scriptSections as section}
					<optgroup label={section.title}>
						{#each section.items as item}
							{#if item.label}
								<option value={item.label}>{item.label}</option>
							{:else}
								<option value={section.title}>{section.title}</option>
							{/if}
						{/each}
					</optgroup>
				{/each}
			</select>

			<label class="bug-label" for="bug-description">What happened?</label>
			<textarea
				id="bug-description"
				class="bug-textarea"
				rows="4"
				placeholder="Describe what you expected vs. what actually happened..."
				bind:value={bugDescription}
			></textarea>

			<div class="bug-actions">
				<button class="bug-cancel" onclick={closeBugReport}>Cancel</button>
				<button class="bug-submit" onclick={submitBugReport}>
					Open on GitHub
					<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<path
							d="M4.5 2.5h9m0 0v9m0-9L4 12"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global {
		.cluster {
			display: flex;
			flex-wrap: var(--wrap, wrap);
			justify-content: var(--justify, flex-start);
			align-items: var(--align, center);
			gap: var(--gutter, 1rem);
		}

		.stack {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
		}

		.stack > * {
			margin-block: 0;
		}

		.stack > * + * {
			margin-block-start: var(--space, 0.5rem);
		}

		.settings-page {
			width: 100%;
			box-sizing: border-box;
			padding: 0.75rem 0;
			color: var(--color-pageText);
		}

		.search-input {
			min-width: min(420px, 100%);
			width: min(420px, 100%);
			padding: 0.45rem 0.7rem;
			font-size: 0.95rem;
			border-radius: 6px;
			border: var(--border);
			background: var(--color-formInputBackground);
			color: var(--color-formInputText);
		}

		.search-input::placeholder {
			color: var(--color-formInputTextPlaceholder);
		}

		.search-input:focus-visible {
			outline: none;
			border-color: var(--color-formInputBorderSelected);
			box-shadow: 0 0 0 1px var(--color-formInputBorderSelected);
		}

		.search-meta {
			color: var(--color-pageTextSubdued);
			font-size: 0.85rem;
		}

		.settings-section {
			padding: 0;
			width: 100%;
			box-sizing: border-box;
			border-radius: var(--border-radius);
			border: var(--border);
			background: var(--color-cardBackground);
			overflow: hidden;
		}

		.section-toggle {
			display: flex;
			align-items: center;
			justify-content: space-between;
			width: 100%;
			padding: 0.85rem 1rem;
			background: none;
			border: none;
			cursor: pointer;
			text-align: left;
			color: inherit;
			gap: 0.5rem;
		}

		.section-toggle:hover {
			background: var(--color-tableRowBackgroundHover);
		}

		.section-header {
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
			flex: 1;
			min-width: 0;
		}

		.section-header h3 {
			font-size: 1rem;
			font-weight: 600;
			margin: 0;
		}

		.section-header p {
			font-size: 0.85rem;
			color: var(--color-pageTextSubdued);
			margin: 0;
		}

		.chevron {
			width: 16px;
			height: 16px;
			flex-shrink: 0;
			color: var(--color-pageTextSubdued);
			transition: transform 0.15s ease;
		}

		.settings-section.collapsed .chevron {
			transform: rotate(-90deg);
		}

		.settings-list {
			padding: 0 1rem 0.85rem;
		}

		.custom-setting {
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
		}

		.setting-label {
			font-weight: 500;
		}

		.bug-report-btn {
			display: inline-flex;
			align-items: center;
			gap: 0.35rem;
			font-size: 0.8rem;
			color: var(--color-pageTextSubdued);
			padding: 0.3rem 0.6rem;
			border-radius: 6px;
			border: var(--border);
			background: none;
			cursor: pointer;
			transition:
				color 0.15s,
				border-color 0.15s;
		}

		.bug-report-btn:hover {
			color: var(--color-errorText);
			border-color: var(--color-errorBorder);
		}

		.bug-report-btn svg {
			width: 14px;
			height: 14px;
			flex-shrink: 0;
		}

		.bug-modal {
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

		.bug-backdrop {
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.3);
		}

		.bug-content {
			position: relative;
			background: var(--color-modalBackground);
			border: var(--border);
			border-radius: var(--border-radius);
			padding: 1.5rem;
			width: 460px;
			max-height: 80vh;
			overflow-y: auto;
			z-index: 10001;
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
		}

		.bug-close {
			position: absolute;
			top: 0.75rem;
			right: 0.75rem;
			width: 24px;
			height: 24px;
			padding: 0;
			border: 0;
			background: transparent;
			color: var(--color-pageTextSubdued);
			font-size: 18px;
			cursor: pointer;
		}

		.bug-close:hover {
			color: var(--color-pageText);
		}

		.bug-title {
			margin: 0;
			font-size: 1.05rem;
			font-weight: 600;
			color: var(--color-pageText);
		}

		.bug-label {
			font-size: 0.85rem;
			font-weight: 500;
			color: var(--color-pageText);
		}

		.bug-select,
		.bug-textarea {
			width: 100%;
			padding: 0.45rem 0.7rem;
			font-size: 0.9rem;
			border-radius: 6px;
			border: var(--border);
			background: var(--color-formInputBackground);
			color: var(--color-formInputText);
			font-family: inherit;
			box-sizing: border-box;
		}

		.bug-select:focus-visible,
		.bug-textarea:focus-visible {
			outline: none;
			border-color: var(--color-formInputBorderSelected);
			box-shadow: 0 0 0 1px var(--color-formInputBorderSelected);
		}

		.bug-textarea {
			resize: vertical;
			min-height: 80px;
		}

		.bug-textarea::placeholder {
			color: var(--color-formInputTextPlaceholder);
		}

		.bug-actions {
			display: flex;
			justify-content: flex-end;
			gap: 0.5rem;
			margin-top: 0.25rem;
		}

		.bug-cancel,
		.bug-submit {
			padding: 0.4rem 0.8rem;
			font-size: 0.85rem;
			border-radius: 6px;
			cursor: pointer;
			border: var(--border);
		}

		.bug-cancel {
			background: none;
			color: var(--color-pageText);
		}

		.bug-cancel:hover {
			background: var(--color-tableRowBackgroundHover);
		}

		.bug-submit {
			display: inline-flex;
			align-items: center;
			gap: 0.35rem;
			background: var(--color-buttonPrimaryBackground);
			color: var(--color-buttonPrimaryText);
			border-color: var(--color-buttonPrimaryBackground);
		}

		.bug-submit:hover {
			filter: brightness(1.1);
		}

		.bug-submit svg {
			width: 13px;
			height: 13px;
		}

		.empty {
			font-size: 0.95rem;
			color: var(--color-pageTextSubdued);
		}
	}
</style>
