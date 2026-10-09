<script lang="ts">
	import { ExternalLink, X } from "lucide-svelte";
	import { tick } from "svelte";
	import {
		scriptSections,
		scripts,
		sectionItems,
		settingRequires,
		type PageSetting,
	} from "../features";
	import { pushStoredSettings } from "../features/settings-sync";
	import Icon from "./components/Icon.svelte";
	import SettingRow from "./components/SettingRow.svelte";
	import { watchDom } from "./utilities/dom-watcher";
	import { DESKTOP_QUERY } from "./utilities/pages";

	const REPO_URL = "https://github.com/aelxxs/actual-budget-tweaks";
	const version = browser.runtime.getManifest().version;
	const logoUrl = browser.runtime.getURL("/icon.svg");

	let query = $state("");
	let collapsed = $state<Record<string, boolean>>({});
	let changedOnly = $state(false);
	let activeSection = $state(scriptSections[0]?.title ?? "");

	let showBugModal = $state(false);
	let bugFeature = $state("");
	let bugDescription = $state("");
	let importStatus = $state<"" | "success" | "error">("");
	let showResetDialog = $state(false);
	let resetting = $state(false);

	function openBugReport() {
		bugFeature = "";
		bugDescription = "";
		showBugModal = true;
	}

	function closeBugReport() {
		showBugModal = false;
	}

	function submitBugReport() {
		// Field names match .github/ISSUE_TEMPLATE/bug_report.yml's `id`s — the
		// repo has issue forms configured, so /issues/new without `template=`
		// lands on the template chooser instead of prefilling a blank issue.
		const params = new URLSearchParams({
			template: "bug_report.yml",
			title: bugFeature ? `[Bug]: ${bugFeature}` : "[Bug]: ",
			version,
		});
		if (bugFeature) params.set("feature", bugFeature);
		if (bugDescription) params.set("description", bugDescription);

		window.open(`${REPO_URL}/issues/new?${params}`, "_blank", "noopener,noreferrer");
		closeBugReport();
	}

	// Actual's mobile view only lists the settings that run there.
	const desktopQuery = matchMedia(DESKTOP_QUERY);
	let isDesktop = $state(desktopQuery.matches);
	$effect(() => {
		const update = () => (isDesktop = desktopQuery.matches);
		desktopQuery.addEventListener("change", update);
		return () => desktopQuery.removeEventListener("change", update);
	});

	// Stored values, kept live, so "Changed" reflects toggles made on this page or elsewhere.
	let stored = $state<Record<string, unknown>>({});
	$effect(() => {
		browser.storage.local.get(null).then((all) => (stored = all));
		const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
			if (area !== "local") return;
			const next = { ...stored };
			for (const [key, change] of Object.entries(changes)) next[key] = change.newValue;
			stored = next;
		};
		browser.storage.onChanged.addListener(onChanged);
		return () => browser.storage.onChanged.removeListener(onChanged);
	});

	function isChanged(item: PageSetting): boolean {
		const key = `local:${item.context.key}`;
		if (stored[key] === undefined) return false;
		return JSON.stringify(stored[key]) !== JSON.stringify(item.context.defaultValue);
	}

	function isUnmet(item: PageSetting): PageSetting | undefined {
		const parent = settingRequires.get(item);
		if (!parent) return undefined;
		const value = stored[`local:${parent.context.key}`] ?? parent.context.defaultValue;
		return value === false ? parent : undefined;
	}

	const normalizedQuery = $derived(query.trim().toLowerCase());

	function isVisible(item: PageSetting): boolean {
		if (!isDesktop && !("mobile" in item && item.mobile)) return false;
		if (changedOnly && !isChanged(item)) return false;
		if (!normalizedQuery) return true;
		const text = `${item.label} ${"description" in item ? (item.description ?? "") : ""}`;
		return text.toLowerCase().includes(normalizedQuery);
	}

	const filteredSections = $derived.by(() =>
		scriptSections
			.map((section) => ({
				...section,
				groups: section.groups
					.map((group) => ({ ...group, items: group.items.filter(isVisible) }))
					.filter((group) => group.items.length > 0),
			}))
			.filter((section) => section.groups.length > 0),
	);

	const totalVisibleSettings = $derived(
		filteredSections.reduce((count, section) => count + sectionItems(section).length, 0),
	);

	function toggleSection(title: string) {
		collapsed[title] = !collapsed[title];
	}

	function isSectionCollapsed(title: string) {
		// Searching or filtering shows every match, so nothing stays collapsed.
		return !normalizedQuery && !changedOnly && !!collapsed[title];
	}

	// Actual's titlebar strip is sticky too, so the toolbar pins just below it.
	let stickyTop = $state(0);
	$effect(() => {
		let strip: Element | null = null;
		const observer = new ResizeObserver(() => (stickyTop = (strip as HTMLElement).offsetHeight));
		// The titlebar can render after this page, so keep looking until it appears.
		const stop = watchDom(() => {
			const found = document.querySelector("[data-abt-content-grid] > div:first-of-type");
			if (found === strip) return;
			if (strip) observer.unobserve(strip);
			strip = found;
			if (strip) observer.observe(strip);
		});
		return () => {
			stop();
			observer.disconnect();
		};
	});

	const sectionEls: Record<string, HTMLElement> = {};

	let toolbarEl = $state<HTMLElement>();
	let navEl = $state<HTMLElement>();
	let navOverflows = $state(false);

	// Fades the chip row's right edge only while more chips sit past it.
	$effect(() => {
		const nav = navEl;
		if (!nav) return;
		const update = () => (navOverflows = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1);
		const observer = new ResizeObserver(update);
		observer.observe(nav);
		nav.addEventListener("scroll", update, { passive: true });
		update();
		return () => {
			observer.disconnect();
			nav.removeEventListener("scroll", update);
		};
	});

	// Keeps the active chip in view as the page scrolls past later sections.
	$effect(() => {
		if (!activeSection) return;
		const chip = navEl?.querySelector<HTMLElement>(".section-chip.active");
		if (!navEl || !chip) return;
		const left = chip.offsetLeft - navEl.offsetLeft;
		const right = left + chip.offsetWidth;
		if (left < navEl.scrollLeft) navEl.scrollTo({ left, behavior: "smooth" });
		else if (right > navEl.scrollLeft + navEl.clientWidth)
			navEl.scrollTo({ left: right - navEl.clientWidth + 32, behavior: "smooth" });
	});
	let scroller: HTMLElement | null = null;
	let jumping = false;

	function getScroller(): HTMLElement | null {
		if (scroller?.isConnected) return scroller;
		let el = toolbarEl?.parentElement ?? null;
		while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
		scroller = el;
		return el;
	}

	/** Where a section's top lands: just under the toolbar once it's pinned, wherever it is now. */
	function pinnedBottom(sc: HTMLElement): number {
		return sc.getBoundingClientRect().top + stickyTop + (toolbarEl?.offsetHeight ?? 0) + 8;
	}

	async function jumpTo(title: string) {
		collapsed[title] = false;
		activeSection = title;
		await tick();
		const el = sectionEls[title];
		const sc = getScroller();
		if (!el || !sc) return;
		jumping = true;
		const done = () => {
			if (!jumping) return;
			jumping = false;
			sc.removeEventListener("scrollend", done);
			// Content above can still resize mid-scroll; settle on the exact spot.
			const off = el.getBoundingClientRect().top - pinnedBottom(sc);
			if (Math.abs(off) > 2) sc.scrollBy({ top: off });
		};
		sc.addEventListener("scrollend", done);
		// No scroll happens if it's already in place, so don't wait on scrollend forever.
		setTimeout(done, 1000);
		sc.scrollTo({
			top: sc.scrollTop + el.getBoundingClientRect().top - pinnedBottom(sc),
			behavior: "smooth",
		});
	}

	// The active section is the last one whose top has passed under the toolbar.
	$effect(() => {
		const titles = filteredSections.map((section) => section.title);
		const sc = getScroller();
		if (!sc) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			if (jumping) return;
			const line = pinnedBottom(sc) + 1;
			const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
			let current = titles[0];
			for (const title of titles) {
				const el = sectionEls[title];
				if (el?.isConnected && el.getBoundingClientRect().top <= line) current = title;
			}
			activeSection = atBottom ? titles[titles.length - 1] : current;
		};
		const onScroll = () => (frame ||= requestAnimationFrame(update));
		sc.addEventListener("scroll", onScroll, { passive: true });
		update();
		return () => {
			sc.removeEventListener("scroll", onScroll);
			cancelAnimationFrame(frame);
		};
	});

	const AUX_DEFAULTS: Record<string, unknown> = {
		"local:category-colors": {},
		"local:abt-account-icons": {},
		"local:abt-category-icons": {},
		"local:abt-sidebar-shortcuts": [],
		"local:abt-sidebar-groups-collapsed": {},
		"local:user-themes": {},
		"local:side-panel-width": 420,
		"local:side-panel-persist": null,
		"local:theme-auto-switch": false,
		"local:theme-auto-dark": null,
		"local:theme-auto-light": null,
	};

	async function exportSettings() {
		const stored = await browser.storage.local.get(null);
		const data: Record<string, unknown> = { ...AUX_DEFAULTS, ...stored };
		for (const group of scripts) {
			for (const item of group) {
				if ("context" in item && item.context?.key) {
					const storageKey = `local:${item.context.key}`;
					if (!(storageKey in data)) {
						data[storageKey] = item.context.defaultValue;
					}
				}
			}
		}
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `abt-settings-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function importSettings() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json";
		input.style.display = "none";
		input.onchange = async () => {
			const file = input.files?.[0];
			input.remove();
			if (!file) return;
			try {
				const text = await file.text();
				const data = JSON.parse(text);
				if (typeof data !== "object" || data === null || Array.isArray(data)) {
					throw new Error("Invalid format");
				}
				await browser.storage.local.clear();
				await browser.storage.local.set(data);
				// Otherwise the budget's old values would win again after the reload.
				await pushStoredSettings();
				importStatus = "success";
				setTimeout(() => location.reload(), 1000);
			} catch {
				importStatus = "error";
				setTimeout(() => (importStatus = ""), 3000);
			}
		};
		// Some browsers (Firefox, Safari) won't reliably open the native file
		// picker from a detached input's synthetic click.
		document.body.appendChild(input);
		input.click();
	}

	// Writes each default rather than removing the key: removed keys would come back from the
	// budget's synced copy. Icons, colours, groups, shortcuts and custom themes are untouched.
	async function resetSettings() {
		resetting = true;
		const defaults: Record<string, unknown> = {};
		for (const item of scripts.flat()) {
			if (item.type !== "core") defaults[`local:${item.context.key}`] = item.context.defaultValue;
		}
		await browser.storage.local.set(defaults);
		await pushStoredSettings();
		location.reload();
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

<svelte:window
	onkeydown={(e) => {
		if (e.key !== "Escape") return;
		showBugModal = false;
		if (!resetting) showResetDialog = false;
	}}
/>

<div class="settings-page">
	<header class="page-header">
		<div class="page-title">
			<img class="title-logo" src={logoUrl} alt="" />
			<h2>Actual Budget Tweaks</h2>
			<span class="version-tag">v{version}</span>
		</div>
		<div class="header-actions">
			{#if importStatus === "success"}
				<span class="import-status import-status--ok">Imported, reloading…</span>
			{:else if importStatus === "error"}
				<span class="import-status import-status--err">Invalid settings file</span>
			{/if}
			<button
				type="button"
				class="abt-btn abt-btn--icon abt-btn--sm"
				onclick={exportSettings}
				title="Export settings"
				aria-label="Export settings"
			>
				<Icon name="upload" size={14} strokeWidth={1.5} />
			</button>
			<button
				type="button"
				class="abt-btn abt-btn--icon abt-btn--sm"
				onclick={importSettings}
				title="Import settings"
				aria-label="Import settings"
			>
				<Icon name="download" size={14} strokeWidth={1.5} />
			</button>
			<button
				type="button"
				class="abt-btn abt-btn--icon abt-btn--sm"
				onclick={() => (showResetDialog = true)}
				title="Reset to defaults"
				aria-label="Reset to defaults"
			>
				<Icon name="rotateCcw" size={14} strokeWidth={1.5} />
			</button>
			<button
				type="button"
				class="abt-btn abt-btn--icon abt-btn--sm bug-btn"
				onclick={openBugReport}
				title="Report a bug"
				aria-label="Report a bug"
			>
				<Icon name="bug" size={14} />
			</button>
		</div>
	</header>

	<div class="settings-toolbar" bind:this={toolbarEl} style="top: {stickyTop}px;">
		<div class="search-row">
			<input
				type="search"
				class="abt-input search-input"
				placeholder="Filter settings"
				bind:value={query}
				aria-label="Filter settings"
			/>
			<button
				type="button"
				class="abt-btn abt-btn--sm abt-btn--pill"
				class:abt-tone-accent={changedOnly}
				aria-pressed={changedOnly}
				onclick={() => (changedOnly = !changedOnly)}
			>
				Changed
			</button>
			<span class="search-meta">{totalVisibleSettings} visible</span>
		</div>
		<nav
			class="section-nav"
			class:overflows={navOverflows}
			bind:this={navEl}
			aria-label="Settings sections"
		>
			{#each filteredSections as section (section.title)}
				<button
					type="button"
					class="abt-btn abt-btn--sm abt-btn--pill abt-btn--ghost section-chip"
					class:active={activeSection === section.title}
					onclick={() => jumpTo(section.title)}
				>
					{section.title}
					<span class="section-chip-count abt-num">{sectionItems(section).length}</span>
				</button>
			{/each}
		</nav>
	</div>

	{#if filteredSections.length === 0}
		<p class="empty">
			{changedOnly && !normalizedQuery
				? "Nothing has been changed from its default yet."
				: `No settings matched "${query}".`}
		</p>
	{:else}
		{#each filteredSections as section (section.title)}
			{@const isCollapsed = isSectionCollapsed(section.title)}
			<section
				class="settings-section abt-card"
				class:collapsed={isCollapsed}
				data-section={section.title}
				bind:this={sectionEls[section.title]}
			>
				<button
					type="button"
					class="section-toggle"
					onclick={() => toggleSection(section.title)}
					aria-expanded={!isCollapsed}
				>
					<h3 class="section-title">{section.title}</h3>
					<Icon name="chevronDown" strokeWidth={1.5} class="chevron" />
				</button>
				{#if !isCollapsed}
					<div class="settings-list">
						{#each section.groups as group (group.label ?? "__ungrouped__")}
							<div class="settings-subgroup">
								{#if group.label}
									<h4 class="abt-label">{group.label}</h4>
								{/if}
								<div>
									{#each group.items as item (item.context.key)}
										{@const unmet = isUnmet(item)}
										{#if unmet}
											<div class="setting-unmet">
												<div inert><SettingRow setting={item} /></div>
												<p class="setting-unmet__note">Turn on {unmet.label} to use this.</p>
											</div>
										{:else}
											<SettingRow setting={item} />
										{/if}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	{/if}
</div>

{#if showResetDialog}
	<div
		class="abt-dialog-backdrop"
		role="presentation"
		use:portal
		onclick={(e) => e.target === e.currentTarget && !resetting && (showResetDialog = false)}
	>
		<div
			class="abt-dialog abt-popover abt-controls-quiet"
			role="alertdialog"
			aria-modal="true"
			aria-label="Reset to defaults"
		>
			<header class="abt-dialog__header">
				<h3 class="abt-dialog__title">Reset to defaults?</h3>
			</header>
			<div class="abt-dialog__body dialog-text">
				<p>
					Every ABT setting goes back to its default, in this browser and in the budget's synced
					copy. Account icons, category colours, account groups, shortcuts and custom themes stay.
				</p>
				<p>Export your settings first if you might want them back. The page reloads afterwards.</p>
			</div>
			<footer class="abt-dialog__footer">
				<button
					type="button"
					class="abt-btn"
					disabled={resetting}
					onclick={() => (showResetDialog = false)}
				>
					Cancel
				</button>
				<button
					type="button"
					class="abt-btn abt-tone-danger"
					disabled={resetting}
					onclick={resetSettings}
				>
					{resetting ? "Resetting…" : "Reset settings"}
				</button>
			</footer>
		</div>
	</div>
{/if}

{#if showBugModal}
	<div
		class="abt-dialog-backdrop"
		role="presentation"
		use:portal
		onclick={(e) => e.target === e.currentTarget && closeBugReport()}
	>
		<div
			class="abt-dialog abt-popover abt-controls-quiet"
			role="dialog"
			aria-modal="true"
			aria-label="Report a bug"
		>
			<header class="abt-dialog__header">
				<h3 class="abt-dialog__title">Report a bug</h3>
				<button
					type="button"
					class="abt-btn abt-btn--icon abt-btn--ghost"
					aria-label="Close"
					onclick={closeBugReport}
				>
					<X size={16} strokeWidth={1.75} />
				</button>
			</header>
			<div class="abt-dialog__body bug-form">
				<label class="bug-field">
					<span class="abt-label">Affected feature</span>
					<select class="abt-input" bind:value={bugFeature}>
						<option value="">General / Not sure</option>
						{#each scriptSections as section (section.title)}
							<optgroup label={section.title}>
								{#each sectionItems(section) as item (item.context.key)}
									<option value={item.label}>{item.label}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</label>
				<label class="bug-field">
					<span class="abt-label">What happened?</span>
					<textarea
						class="abt-input bug-textarea"
						rows="4"
						placeholder="Describe what you expected vs. what actually happened…"
						bind:value={bugDescription}></textarea>
				</label>
			</div>
			<footer class="abt-dialog__footer">
				<button type="button" class="abt-btn" onclick={closeBugReport}>Cancel</button>
				<button type="button" class="abt-btn abt-tone-accent" onclick={submitBugReport}>
					Open on GitHub
					<ExternalLink size={13} strokeWidth={1.5} />
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	/* Layout helpers other features' components rely on while this page is open. */
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
	}

	/* `inherit` passes the host card's own background down to the pinned toolbar, whatever
	   colour the active theme gives that card. */
	.settings-page {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-4);
		width: 100%;
		box-sizing: border-box;
		color: var(--color-pageText);
		background: inherit;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
		flex-wrap: wrap;
	}

	.page-title {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
	}

	.page-title h2 {
		margin: 0;
		font-size: var(--abt-text-lg);
		font-weight: 600;
	}

	.title-logo {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		border-radius: var(--abt-radius-sm);
	}

	.version-tag {
		padding: 1px var(--abt-space-2);
		border: 1px solid var(--abt-accent-3);
		border-radius: var(--abt-radius-pill);
		background: var(--abt-accent-2);
		color: var(--abt-accent);
		font-size: var(--abt-text-xs);
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		margin-left: auto;
	}

	.bug-btn:hover:not(:disabled) {
		color: var(--color-errorText);
	}

	.import-status {
		font-size: var(--abt-text-sm);
		font-weight: 500;
	}

	.import-status--ok {
		color: var(--color-noticeTextLight);
	}

	.import-status--err {
		color: var(--color-errorText);
	}

	/* Pinned while scrolling. */
	.settings-toolbar {
		position: sticky;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-4);
		padding-block: var(--abt-space-3) var(--abt-space-4);
		/* Its own bottom padding stands in for most of the page gap below it. */
		margin-bottom: calc(-1 * var(--abt-space-4));
		background: inherit;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}

	.search-input {
		flex: 1 1 auto;
	}

	.search-meta {
		flex-shrink: 0;
		white-space: nowrap;
		font-size: var(--abt-text-sm);
		color: var(--color-pageTextSubdued);
	}

	/* One row that scrolls sideways, so the pinned bar stays short. */
	.section-nav {
		display: flex;
		gap: var(--abt-space-2);
		overflow-x: auto;
		/* Room for a chip's focus ring, which the sideways scroll would otherwise clip. */
		padding: 2px;
		margin: -2px;
		scrollbar-width: none;
	}

	.section-nav.overflows {
		mask-image: linear-gradient(to right, #000 calc(100% - 2rem), transparent);
	}

	.section-nav::-webkit-scrollbar {
		display: none;
	}

	.section-chip {
		flex-shrink: 0;
		color: var(--abt-btn-fg, var(--abt-muted));
	}

	/* Ghost buttons drop their fill, so the active one sets its own. */
	.section-chip.active {
		--abt-btn-bg: var(--abt-accent-2);
		--abt-btn-bg-hover: var(--abt-accent-2);
		--abt-btn-fg: var(--abt-accent);
	}

	.section-chip-count {
		font-size: var(--abt-text-xs);
		opacity: 0.7;
	}

	.settings-section {
		--abt-pad: 0;
		overflow: hidden;
	}

	.section-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
		width: 100%;
		padding: var(--abt-space-4) var(--abt-space-5);
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.1s;
	}

	.section-toggle:hover {
		background: var(--abt-fill-hover);
	}

	.section-title {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: var(--abt-text-lg);
		font-weight: 600;
	}

	.settings-section :global(.chevron) {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		color: var(--color-pageTextSubdued);
		transition: transform 0.15s ease;
	}

	.settings-section.collapsed :global(.chevron) {
		transform: rotate(-90deg);
	}

	.settings-list {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-4);
		padding: 0 var(--abt-space-5) var(--abt-space-4);
	}

	.settings-subgroup {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
	}

	.settings-subgroup h4 {
		margin: 0;
	}

	.setting-unmet > div {
		opacity: 0.45;
	}

	.setting-unmet__note {
		margin: calc(-1 * var(--abt-space-2)) 0 var(--abt-space-2);
		font-size: var(--abt-text-xs);
		color: var(--color-pageTextSubdued);
	}

	.empty {
		margin: 0;
		font-size: var(--abt-text-md);
		color: var(--color-pageTextSubdued);
	}

	.dialog-text {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
		font-size: var(--abt-text-md);
		line-height: 1.5;
	}

	.dialog-text p {
		margin: 0;
	}

	.bug-form {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-4);
	}

	.bug-field {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
	}

	.bug-textarea {
		height: auto;
		min-height: 88px;
		padding-block: var(--abt-space-2);
		resize: vertical;
	}
</style>
