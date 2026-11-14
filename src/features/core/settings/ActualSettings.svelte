<script lang="ts">
	import { onOutsideClick } from "@lib/dom/popover";
	import { takeTweaksSearch } from "@lib/actual/settings-page";
	import {
		ArrowUpRight,
		Bug,
		Power,
		RotateCcw,
		Coffee,
		Download,
		Ellipsis,
		Heart,
		Sparkles,
		Star,
		Upload,
	} from "@lucide/svelte";
	import { onMount, tick } from "svelte";
	import {
		FEATURES_TITLE,
		scriptSections,
		sectionItems,
		settingRequires,
		type PageSetting,
	} from "@features/index";
	import { exportSettings, pickSettingsFile, resetToDefaults } from "./backup";
	import Icon from "@lib/components/Icon.svelte";
	import BugReportDialog from "./BugReportDialog.svelte";
	import { showReleaseNotes } from "@features/core/release-notification";
	import Dialog from "@lib/components/Dialog.svelte";
	import SettingRow from "./SettingRow.svelte";
	import Switch from "@lib/components/Switch.svelte";
	import WritesMark from "@lib/components/WritesMark.svelte";
	import { applySettingChange } from "@features/runtime";
	import { setAbtEnabled } from "@lib/abt-enabled";
	import { watchDom } from "@lib/dom/dom-watcher";
	import { DESKTOP_QUERY } from "@lib/actual/pages";
	import { TWEAKS_SECTIONS_ATTR, takeTweaksSection } from "@lib/actual/settings-page";

	const REPO_URL = "https://github.com/aelxxs/actual-budget-tweaks";
	const SPONSOR_URL = "https://github.com/sponsors/aelxxs";
	const KOFI_URL = "https://ko-fi.com/aelxxs";
	const ACTUAL_SUPPORT_URL = "https://opencollective.com/actual";
	const version = browser.runtime.getManifest().version;
	// Nightly edge builds (1.2.3-edge.sha) have no release notes.
	const hasNotes = !version.includes("-");
	const logoUrl = browser.runtime.getURL("/icon.svg");

	let query = $state(takeTweaksSearch());
	let collapsed = $state<Record<string, boolean>>({});
	let changedOnly = $state(false);
	let activeSection = $state(scriptSections[0]?.title ?? "");

	let showBugModal = $state(false);
	let importStatus = $state<"" | "success" | "error">("");
	let showResetDialog = $state(false);
	let showOffDialog = $state(false);
	let moreOpen = $state(false);
	let moreActionsEl: HTMLDivElement;
	/** Where the support popover is open from: the header's menu or the footer link. */
	let supportOpen = $state<"header" | "footer" | null>(null);
	let supportEl: HTMLDivElement;
	let turningOff = $state(false);

	$effect(() => {
		if (moreOpen) {
			return onOutsideClick(moreActionsEl, () => (moreOpen = false));
		}
	});

	$effect(() => {
		if (!supportOpen) {
			return;
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				supportOpen = null;
			}
		};
		document.addEventListener("keydown", onKey);
		const anchor = supportOpen === "header" ? moreActionsEl : supportEl;
		const stop = onOutsideClick(anchor, () => (supportOpen = null));
		return () => {
			document.removeEventListener("keydown", onKey);
			stop();
		};
	});

	async function turnOff() {
		turningOff = true;
		await setAbtEnabled(false);
		location.reload();
	}
	let resetting = $state(false);

	// Each view lists the settings that run in it; ones for both show in both.
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
			if (area !== "local") {
				return;
			}
			const next = { ...stored };
			for (const [key, change] of Object.entries(changes)) {
				next[key] = change.newValue;
			}
			stored = next;
		};
		browser.storage.onChanged.addListener(onChanged);
		return () => browser.storage.onChanged.removeListener(onChanged);
	});

	// With every feature already on, there's nothing to find there, so it doesn't push the page down.
	let featuresDecided = false;
	$effect(() => {
		if (featuresDecided || !Object.keys(stored).length) {
			return;
		}
		featuresDecided = true;
		const section = scriptSections.find((s) => s.title === FEATURES_TITLE);
		if (section && sectionItems(section).every(storedOn)) {
			collapsed[FEATURES_TITLE] = true;
		}
	});

	function isChanged(item: PageSetting): boolean {
		const key = `local:${item.context.key}`;
		if (stored[key] === undefined) {
			return false;
		}
		return JSON.stringify(stored[key]) !== JSON.stringify(item.context.defaultValue);
	}

	function isUnmet(item: PageSetting): PageSetting | undefined {
		const parent = settingRequires.get(item);
		if (!parent) {
			return undefined;
		}
		const value = stored[`local:${parent.context.key}`] ?? parent.context.defaultValue;
		return value === false ? parent : undefined;
	}

	const normalizedQuery = $derived(query.trim().toLowerCase());

	function isVisible(item: PageSetting): boolean {
		const platform = item.platform ?? "desktop";
		if (platform !== "all" && (platform === "desktop") !== isDesktop) {
			return false;
		}
		if (changedOnly && !isChanged(item)) {
			return false;
		}
		if (!normalizedQuery) {
			return true;
		}
		const text = `${item.label} ${"description" in item ? (item.description ?? "") : ""}`;
		return text.toLowerCase().includes(normalizedQuery);
	}

	const filteredSections = $derived.by(() =>
		scriptSections
			.filter((section) => !section.elsewhere || normalizedQuery || changedOnly)
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
	// Every setting a search can reach on this device, and how many differ from their default.
	const onThisDevice = $derived(
		scriptSections.flatMap(sectionItems).filter((item) => {
			const platform = item.platform ?? "desktop";
			return platform === "all" || (platform === "desktop") === isDesktop;
		}),
	);
	const changedCount = $derived(onThisDevice.filter(isChanged).length);

	function toggleSection(title: string) {
		collapsed[title] = !collapsed[title];
	}

	function storedOn(item: PageSetting): boolean {
		return Boolean(stored[`local:${item.context.key}`] ?? item.context.defaultValue);
	}

	function isSectionCollapsed(title: string) {
		// Searching or filtering shows every match, so nothing stays collapsed.
		return !normalizedQuery && !changedOnly && !!collapsed[title];
	}

	// Actual's titlebar strip is sticky too, so the toolbar pins just below it; Actual's settings
	// nav scrolls its pane under the titlebar instead, where the toolbar pins at the top.
	let stickyTop = $state(0);
	$effect(() => {
		let strip: Element | null = null;
		const observer = new ResizeObserver(() => {
			stickyTop = getScroller()?.contains(strip) ? (strip as HTMLElement).offsetHeight : 0;
		});
		// The titlebar can render after this page, so keep looking until it appears.
		const stop = watchDom(() => {
			const found = document.querySelector("[data-abt-header]");
			if (found === strip) {
				return;
			}
			if (strip) {
				observer.unobserve(strip);
			}
			strip = found;
			if (strip) {
				observer.observe(strip);
			}
		});
		return () => {
			stop();
			observer.disconnect();
		};
	});

	// In ABT's tab under Actual's settings nav, the nav lists the sections and the toolbar keeps to
	// one row; elsewhere the toolbar carries the title and a row of section chips.
	let sectionSlot = $state<Element | null>(null);
	$effect(() =>
		watchDom(() => {
			const found = document.querySelector(`[${TWEAKS_SECTIONS_ATTR}]`);
			if (found !== sectionSlot) {
				sectionSlot = found;
			}
		}),
	);

	function moveInto(node: HTMLElement, target: Element) {
		target.append(node);
		return { update: (next: Element) => next.append(node) };
	}

	const sectionEls = $state<Record<string, HTMLElement>>({});

	let toolbarEl = $state<HTMLElement>();
	let navEl = $state<HTMLElement>();
	let navOverflows = $state(false);

	// Fades the chip row's right edge only while more chips sit past it.
	$effect(() => {
		const nav = navEl;
		if (!nav) {
			return;
		}
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
		if (!activeSection) {
			return;
		}
		const chip = navEl?.querySelector<HTMLElement>(".section-chip.active");
		if (!navEl || !chip) {
			return;
		}
		const left = chip.offsetLeft - navEl.offsetLeft;
		const right = left + chip.offsetWidth;
		if (left < navEl.scrollLeft) {
			navEl.scrollTo({ left, behavior: "smooth" });
		} else if (right > navEl.scrollLeft + navEl.clientWidth) {
			navEl.scrollTo({ left: right - navEl.clientWidth + 32, behavior: "smooth" });
		}
	});
	let scroller: HTMLElement | null = null;
	let jumping = false;
	// A click mid-scroll starts a new jump; only the latest one settles the position.
	let jumpId = 0;

	function getScroller(): HTMLElement | null {
		if (scroller?.isConnected) {
			return scroller;
		}
		let el = toolbarEl?.parentElement ?? null;
		while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) {
			el = el.parentElement;
		}
		scroller = el;
		return el;
	}

	/** Where a section's top lands: just under the toolbar once it's pinned, wherever it is now. */
	function pinnedBottom(sc: HTMLElement): number {
		return sc.getBoundingClientRect().top + stickyTop + (toolbarEl?.offsetHeight ?? 0) + 8;
	}

	// Picked from the nav's list while the tab was closed.
	onMount(() => {
		const title = takeTweaksSection();
		if (title) {
			void tick().then(() => jumpTo(title));
		}
	});

	async function jumpTo(title: string) {
		collapsed[title] = false;
		activeSection = title;
		await tick();
		const el = sectionEls[title];
		const sc = getScroller();
		if (!el || !sc) {
			return;
		}
		jumping = true;
		const id = ++jumpId;
		const done = () => {
			sc.removeEventListener("scrollend", done);
			if (!jumping || id !== jumpId) {
				return;
			}
			jumping = false;
			// Content above can still resize mid-scroll; settle on the exact spot.
			const off = el.getBoundingClientRect().top - pinnedBottom(sc);
			if (Math.abs(off) > 2) {
				sc.scrollBy({ top: off });
			}
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
		if (!sc) {
			return;
		}
		let frame = 0;
		const update = () => {
			frame = 0;
			if (jumping) {
				return;
			}
			const line = pinnedBottom(sc) + 1;
			const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
			let current = titles[0];
			for (const title of titles) {
				const el = sectionEls[title];
				if (el?.isConnected && el.getBoundingClientRect().top <= line) {
					current = title;
				}
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

	function importSettings() {
		pickSettingsFile((ok) => {
			importStatus = ok ? "success" : "error";
			if (ok) {
				setTimeout(() => location.reload(), 1000);
			} else {
				setTimeout(() => (importStatus = ""), 3000);
			}
		});
	}

	async function resetSettings() {
		resetting = true;
		await resetToDefaults();
		location.reload();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key !== "Escape") {
			return;
		}
		moreOpen = false;
	}}
/>

{#snippet menuItem(IconComponent: typeof Upload, label: string, action: () => void, danger = false)}
	<button
		type="button"
		class="abt-menu__item"
		class:more-menu__danger={danger}
		role="menuitem"
		onclick={() => {
			moreOpen = false;
			action();
		}}
	>
		<IconComponent size={14} strokeWidth={1.5} />
		{label}
	</button>
{/snippet}

{#snippet supportPopover(direction: "up" | "down")}
	<div
		class="abt-popover support-pop support-pop--{direction}"
		role="dialog"
		aria-label="Support ABT"
	>
		<div class="support-pop__head">
			<img class="support-pop__logo" src={logoUrl} alt="" />
			<p class="support-pop__lead">ABT is free and always will be</p>
		</div>
		<p class="support-pop__text">
			If it's made budgeting a little nicer, here are a few ways to help. Thanks for using it.
			<span class="support-pop__sign">Alexis</span>
		</p>
		<div class="support-pop__tiles">
			{@render supportTile(SPONSOR_URL, Heart, "Sponsor", "GitHub", "sponsor")}
			{@render supportTile(KOFI_URL, Coffee, "Tip", "Ko-fi", "tip")}
			{@render supportTile(REPO_URL, Star, "Star", "Free", "star")}
		</div>
		<div class="support-pop__actual">
			<span>Built on Actual</span>
			<a href={ACTUAL_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
				Support Actual <ArrowUpRight size={13} />
			</a>
		</div>
	</div>
{/snippet}

{#snippet supportTile(
	href: string,
	IconComponent: typeof Upload,
	label: string,
	where: string,
	tone: string,
)}
	<a class="support-tile support-tile--{tone}" {href} target="_blank" rel="noopener noreferrer">
		<IconComponent size={20} strokeWidth={1.75} />
		<span class="support-tile__label">{label}</span>
		<span class="support-tile__where">{where}</span>
	</a>
{/snippet}

{#snippet headerActions()}
	{#if importStatus === "success"}
		<span class="import-status import-status--ok">Imported, reloading…</span>
	{:else if importStatus === "error"}
		<span class="import-status import-status--err">Invalid settings file</span>
	{/if}
	<div class="more-actions" bind:this={moreActionsEl}>
		<button
			type="button"
			class="abt-btn abt-btn--icon abt-btn--sm"
			aria-haspopup="menu"
			aria-expanded={moreOpen}
			aria-label="More settings actions"
			title="More settings actions"
			onclick={() => {
				supportOpen = null;
				moreOpen = !moreOpen;
			}}
		>
			<Ellipsis size={15} />
		</button>
		{#if moreOpen}
			<div class="abt-popover abt-menu more-menu" role="menu" aria-label="More settings actions">
				{@render menuItem(Upload, "Export settings…", () => void exportSettings())}
				{@render menuItem(Download, "Import settings…", importSettings)}
				<div class="abt-menu__sep"></div>
				{#if hasNotes}
					{@render menuItem(Sparkles, "What's new", () => void showReleaseNotes(version))}
				{/if}
				{@render menuItem(Bug, "Report a bug", () => (showBugModal = true))}
				{@render menuItem(Heart, "Support ABT", () => (supportOpen = "header"))}
				<div class="abt-menu__sep"></div>
				{@render menuItem(RotateCcw, "Reset to defaults…", () => (showResetDialog = true))}
				{@render menuItem(Power, "Turn off ABT", () => (showOffDialog = true), true)}
			</div>
		{/if}
		{#if supportOpen === "header"}
			{@render supportPopover("down")}
		{/if}
	</div>
{/snippet}

{#snippet filterControls()}
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
		Changed · {changedCount}
	</button>
	{#if normalizedQuery}
		<span class="search-meta">{totalVisibleSettings} of {onThisDevice.length}</span>
	{/if}
{/snippet}

{#snippet pageTitle()}
	<div class="page-title">
		<img class="title-logo" src={logoUrl} alt="" />
		<h2>Actual Budget Tweaks</h2>
		{#if hasNotes}
			<button
				type="button"
				class="version-tag"
				title="See what's new"
				onclick={() => void showReleaseNotes(version)}
			>
				v{version}
			</button>
		{:else}
			<span class="version-tag">v{version}</span>
		{/if}
	</div>
{/snippet}

<div class="settings-page">
	{#if sectionSlot}
		<div class="settings-toolbar" bind:this={toolbarEl} style="top: {stickyTop}px;">
			<header class="page-header">
				{@render pageTitle()}
			</header>
			<div class="search-row">
				{@render filterControls()}
				<div class="header-actions">
					{@render headerActions()}
				</div>
			</div>
		</div>
		<nav class="nav-sections" use:moveInto={sectionSlot} aria-label="Settings sections">
			{#each filteredSections as section (section.title)}
				<button
					type="button"
					class="nav-section"
					class:active={activeSection === section.title}
					onclick={() => jumpTo(section.title)}
				>
					<span class="nav-section-label">{section.title}</span>
					<span class="nav-section-count abt-num">{sectionItems(section).length}</span>
				</button>
			{/each}
		</nav>
	{:else}
		<div class="settings-toolbar" bind:this={toolbarEl} style="top: {stickyTop}px;">
			<header class="page-header">
				{@render pageTitle()}
				<div class="header-actions">
					{@render headerActions()}
				</div>
			</header>
			<div class="search-row">
				{@render filterControls()}
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
	{/if}
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
				{#if section.headerSlot}
					<div class="section-toggle section-fixed">
						<h3 class="section-title">{section.title}</h3>
						<span class="section-slot" data-section-slot></span>
					</div>
				{:else if section.switch}
					{@const master = section.switch}
					<div class="section-toggle section-fixed">
						<h3 class="section-title">
							{section.title}{#if "writes" in master && master.writes}<WritesMark
									writes={master.writes}
								/>{/if}
						</h3>
						<!-- A label, so a click anywhere on the switch reaches its checkbox. -->
						<label class="section-switch" aria-label={master.label}>
							<Switch
								checked={storedOn(master)}
								onCheckedChange={(on) => applySettingChange(master, on)}
							/>
						</label>
					</div>
					{#if !storedOn(master) && master.description}
						<p class="section-off">{master.description}</p>
					{/if}
				{:else}
					<button
						type="button"
						class="section-toggle"
						onclick={() => toggleSection(section.title)}
						aria-expanded={!isCollapsed}
					>
						<h3 class="section-title">{section.title}</h3>
						{#if isCollapsed && section.title === FEATURES_TITLE}
							{@const items = sectionItems(section)}
							{@const on = items.filter(storedOn).length}
							<span class="section-count" class:is-all={on === items.length}>
								{on === items.length ? "All on" : `${on} of ${items.length} on`}
							</span>
						{/if}
						{#if section.elsewhere}<span class="section-elsewhere">Also in {section.elsewhere}</span
							>{/if}
						<Icon name="chevronDown" strokeWidth={1.5} class="chevron" />
					</button>
				{/if}
				{#if section.headerSlot || (section.switch ? storedOn(section.switch) : !isCollapsed)}
					<div class="settings-list">
						{#each section.groups as group (group.label ?? "__ungrouped__")}
							<div class="settings-subgroup">
								{#if group.label}
									<h4 class="abt-label">{group.label}</h4>
								{/if}
								<div>
									{#each group.items.filter((i) => i !== section.switch) as item (item.context.key)}
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
	<footer class="page-footer">
		<span class="version-chip">
			v{version}
			{#if hasNotes}
				<span aria-hidden="true">·</span>
				<button type="button" class="whats-new" onclick={() => showReleaseNotes(version)}>
					See what's new
				</button>
			{/if}
		</span>
		<nav class="footer-links" aria-label="About ABT">
			<a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
			<button type="button" onclick={() => (showBugModal = true)}>Report a bug</button>
			<div class="support-wrap" bind:this={supportEl}>
				<button
					type="button"
					class="support"
					aria-haspopup="dialog"
					aria-expanded={supportOpen === "footer"}
					onclick={() => (supportOpen = supportOpen === "footer" ? null : "footer")}
				>
					♡ Support
				</button>
				{#if supportOpen === "footer"}
					{@render supportPopover("up")}
				{/if}
			</div>
		</nav>
	</footer>
</div>

{#if showResetDialog}
	<Dialog
		title="Reset to defaults?"
		label="Reset to defaults"
		alert
		busy={resetting}
		onClose={() => (showResetDialog = false)}
	>
		<div class="abt-dialog__body dialog-text">
			<p>
				Every ABT setting goes back to its default, in this browser and in the budget's synced copy.
				Account icons, category colours, account groups, shortcuts and custom themes stay.
			</p>
			<p>Export your settings first if you might want them back. The page reloads afterwards.</p>
		</div>
		{#snippet footer()}
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
		{/snippet}
	</Dialog>
{/if}

{#if showBugModal}
	<BugReportDialog repoUrl={REPO_URL} onClose={() => (showBugModal = false)} />
{/if}

{#if showOffDialog}
	<Dialog
		title="Turn off Actual Budget Tweaks?"
		label="Turn off ABT"
		alert
		busy={turningOff}
		onClose={() => (showOffDialog = false)}
	>
		<div class="abt-dialog__body dialog-text">
			<p>
				Actual reloads without any tweaks, in this browser only. Your settings stay as they are.
			</p>
			<p>Turn it back on from this page or from the extension's popup.</p>
		</div>
		{#snippet footer()}
			<button
				type="button"
				class="abt-btn"
				disabled={turningOff}
				onclick={() => (showOffDialog = false)}
			>
				Cancel
			</button>
			<button type="button" class="abt-btn abt-tone-danger" disabled={turningOff} onclick={turnOff}>
				{turningOff ? "Turning off…" : "Turn off"}
			</button>
		{/snippet}
	</Dialog>
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

	button.version-tag {
		font-family: inherit;
		cursor: pointer;
	}
	button.version-tag:hover {
		background: var(--abt-accent-3);
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

	.page-footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--abt-space-3);
		padding: var(--abt-space-6) var(--abt-space-4);
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	/* Only the footer's own links, not those in the support popover it opens. */
	.footer-links > :is(a, button),
	.support-wrap > button,
	.version-chip button {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-decoration: none;
		cursor: pointer;
	}
	.footer-links > :is(a, button):hover,
	.version-chip button:hover {
		color: var(--abt-ink);
	}
	.version-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
		padding: var(--abt-space-1) var(--abt-space-3);
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-pill);
		font-variant-numeric: tabular-nums;
	}
	.page-footer .whats-new {
		color: var(--color-pageTextLink);
	}
	.page-footer .whats-new:hover {
		color: var(--color-pageTextLink);
		text-decoration: underline;
	}
	.footer-links {
		display: flex;
		align-items: center;
		gap: var(--abt-space-5);
	}
	.support-wrap {
		position: relative;
	}
	.support-pop {
		position: absolute;
		right: 0;
		z-index: 5;
		width: 340px;
		/* Visible for the caret; it never needs to scroll. */
		overflow: visible;
		padding: var(--abt-space-5);
		border-radius: calc(var(--abt-radius) + 4px);
		box-shadow: var(--abt-shadow-lg);
		color: var(--abt-ink);
		text-align: left;
	}
	/* A caret pointing at what opened it: the popover's corner, turned, under its own edge. */
	.support-pop::after {
		content: "";
		position: absolute;
		width: 8px;
		height: 8px;
		background: var(--abt-popover-bg);
		border: 1px solid var(--color-tableBorder);
		rotate: 45deg;
	}
	/* From the footer it opens upward, as the footer sits at the bottom of the page. */
	.support-pop--up {
		bottom: calc(100% + var(--abt-space-3));
	}
	.support-pop--up::after {
		bottom: -5px;
		border-bottom-right-radius: 2px;
		right: var(--abt-space-6);
		border-top-color: transparent;
		border-left-color: transparent;
	}
	/* Past the ⋯ button's edge, so the caret clears the rounded corner and still points at it. */
	.support-pop--down {
		top: calc(100% + var(--abt-space-3));
		right: calc(-1 * var(--abt-space-3));
	}
	.support-pop--down::after {
		top: -5px;
		border-top-left-radius: 2px;
		right: var(--abt-space-5);
		border-bottom-color: transparent;
		border-right-color: transparent;
	}
	.support-pop p {
		margin: 0;
	}
	.support-pop__head {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}
	.support-pop__logo {
		width: 32px;
		height: 32px;
		border-radius: var(--abt-radius);
	}
	.support-pop__lead {
		font-size: var(--abt-text-lg);
		font-weight: 600;
	}
	.support-pop__text {
		margin-top: var(--abt-space-4) !important;
		color: var(--abt-muted);
		line-height: 1.5;
	}
	.support-pop__sign {
		color: var(--abt-ink);
		font-weight: 500;
	}
	.support-pop__tiles {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--abt-space-3);
		margin: var(--abt-space-5) 0 var(--abt-space-4);
	}
	.support-tile {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px; /* raw: label hugs its subtitle */
		padding: var(--abt-space-4);
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius);
		background: var(--abt-ink-1);
		color: var(--abt-ink);
		text-decoration: none;
		transition:
			background 0.12s,
			border-color 0.12s,
			translate 0.12s;
	}
	.support-tile:hover {
		background: var(--abt-ink-2);
		border-color: var(--abt-ink-4);
		translate: 0 -1px;
	}
	@media (prefers-reduced-motion: reduce) {
		.support-tile:hover {
			translate: none;
		}
	}
	.support-tile :global(svg) {
		margin-bottom: var(--abt-space-3);
	}
	.support-tile__label {
		font-size: var(--abt-text-base);
		font-weight: 600;
	}
	.support-tile__where {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	/* The one that keeps ABT going, so it carries its colour into the subtitle too. */
	.support-tile--sponsor :global(svg),
	.support-tile--sponsor .support-tile__where {
		color: var(--color-errorText);
	}
	/* Between the theme's warning and error colours: an orange in any theme. */
	.support-tile--tip :global(svg) {
		color: color-mix(in srgb, var(--color-warningText) 60%, var(--color-errorText));
	}
	.support-tile--star :global(svg) {
		color: var(--color-warningText);
	}
	.support-pop__actual {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: var(--abt-space-4);
		border-top: 1px solid var(--abt-line);
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	.support-pop__actual a {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-1);
		color: var(--abt-muted);
		text-decoration: none;
	}
	.support-pop__actual a:hover {
		color: var(--abt-ink);
	}

	/* Only colour sets it apart from the other links. */
	.page-footer .support,
	.page-footer .support:hover {
		color: var(--abt-accent-text);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		margin-left: auto;
	}

	.more-actions {
		position: relative;
	}

	.more-menu {
		position: absolute;
		top: calc(100% + var(--abt-space-2));
		right: 0;
		z-index: 5;
		min-width: 190px;
	}

	.more-menu .abt-menu__item {
		align-items: center;
	}
	.more-menu .more-menu__danger {
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
		padding-block: var(--abt-space-3) var(--abt-space-5);
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
		color: var(--abt-muted);
	}

	/* Listed under ABT's tab in Actual's settings nav, indented to the tab's label. */
	.nav-sections {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.nav-section {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		padding: 5px var(--abt-space-3) 5px var(--abt-space-6);
		border: none;
		border-radius: var(--abt-radius-sm);
		background: transparent;
		color: var(--color-settingsNavItemText);
		font: inherit;
		font-size: var(--abt-text-base);
		text-align: left;
		cursor: pointer;
	}

	.nav-section:hover {
		background: var(--color-settingsNavItemBackgroundHover);
	}

	.nav-section.active {
		color: var(--color-settingsNavItemTextSelected);
		font-weight: 600;
	}

	.nav-section-label {
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}

	.nav-section-count {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	/* One row that scrolls sideways, so the pinned bar stays short. */
	.section-nav {
		display: flex;
		gap: var(--abt-space-2);
		overflow-x: auto;
		/* Room for a chip's focus ring, which the sideways scroll would otherwise clip. */
		padding: var(--abt-space-1);
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

	/* Only headers that collapse their section react to hover. */
	.section-toggle:not(.section-fixed):hover {
		background: var(--abt-fill-hover);
	}

	.section-fixed {
		cursor: default;
	}

	.section-slot {
		display: contents;
	}

	.section-switch {
		display: inline-flex;
		cursor: pointer;
	}

	.section-fixed .section-title {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}

	.section-off {
		margin: calc(-1 * var(--abt-space-3)) 0 0;
		padding: 0 var(--abt-space-5) var(--abt-space-4);
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	.section-title {
		flex: 1 0 auto;
		min-width: 0;
		margin: 0;
		font-size: var(--abt-text-lg);
		font-weight: 600;
	}

	.section-count {
		padding: 1px var(--abt-space-3);
		border-radius: var(--abt-radius-pill);
		background: var(--abt-fill);
		color: var(--abt-muted);
		font-size: var(--abt-text-xs);
		white-space: nowrap;
	}

	.section-count.is-all {
		background: var(--abt-accent-2);
		color: var(--abt-accent-text);
	}

	.section-elsewhere {
		overflow: hidden;
		min-width: 0;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: var(--abt-text-xs);
		color: var(--abt-muted);
	}

	.settings-section :global(.chevron) {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		color: var(--abt-muted);
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
		color: var(--abt-muted);
	}

	.empty {
		margin: 0;
		font-size: var(--abt-text-md);
		color: var(--abt-muted);
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
</style>
