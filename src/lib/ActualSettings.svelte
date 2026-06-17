<script lang="ts">
	import CheckboxOption from "./components/Checkbox.svelte";
	import SelectOption from "./components/Select.svelte";
	import { scriptSections } from "../features";

	let query = $state("");
	let collapsed = $state<Record<string, boolean>>({});

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
</script>

<div class="settings-page stack" style="--space: 1rem;">
	<div class="header stack" style="--space: 0.6rem;">
		<span><strong>Interface Settings</strong> — Configure Actual</span>
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

		.empty {
			font-size: 0.95rem;
			color: var(--color-pageTextSubdued);
		}
	}
</style>
