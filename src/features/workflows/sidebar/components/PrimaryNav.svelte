<script lang="ts">
	import {
		closeCalendar,
		isCalendarOpen,
		openCalendar,
	} from "@features/workflows/spending-calendar";
	import { navigate } from "@lib/utilities/actual-api";
	import { Page, matchesPage, pagePath } from "@lib/utilities/pages";
	import { getValue, setValue } from "@lib/utilities/store";
	import { CalendarDays, ChevronDown } from "@lucide/svelte";
	import { settingsItem, settingsMenu } from "../lib/nav";
	import { mainItems, settingsItems, trackSidebarMenu } from "../lib/menu.svelte";
	import { route, trackRoute } from "../lib/route.svelte";

	// Only shown if the user has the Spending Calendar feature enabled — reads
	// its checkbox setting directly (getValue/setValue is a flat 1:1 mapping
	// to storage keyed by the setting's own context.key, per features/runtime.ts,
	// so this is safe to read from an unrelated feature).
	let calendarFeatureEnabled = $state(false);

	$effect(() => {
		getValue<boolean>("spending-calendar-enabled", false).then((v) => (calendarFeatureEnabled = v));
	});

	// The spending calendar isn't a real Actual route — it's a DOM overlay this
	// extension itself manages (see spending-calendar/index.ts) — so opening it
	// goes through its own exported trigger rather than navigate()/__navigate.
	function openSpendingCalendar() {
		openCalendar();
	}

	// Mirrors spending-calendar's own attachCloseListeners(): its overlay only
	// auto-closes on route changes it can detect itself (real browser
	// back/forward) — a real Actual navigation
	// triggered through the bridge's window.__navigate happens in the main
	// world and isn't visible to that check, so anything in this nav that
	// navigates elsewhere has to close the overlay itself first.
	function go(page: Page) {
		const covered = isCalendarOpen();
		if (covered) {
			closeCalendar();
		}
		// The page under the calendar is already showing; navigating again makes Actual remount it.
		if (covered && matchesPage(page)) {
			return;
		}
		navigate(pagePath(page));
	}

	const MORE_KEY = "experimental-sidebar-more-expanded";
	let moreExpanded = $state(false);

	$effect(() => {
		getValue<boolean>(MORE_KEY, false).then((stored) => (moreExpanded = stored));
	});

	function toggleMore() {
		moreExpanded = !moreExpanded;
		setValue(MORE_KEY, moreExpanded);
	}

	$effect(() => trackRoute());
	$effect(() => trackSidebarMenu());

	// `route()` is read in this expression so each binding calling it tracks navigation.
	function isActive(page: Page): boolean {
		return Boolean(route()) && matchesPage(page);
	}

	const inSettings = $derived(settingsMenu().some((item) => isActive(item.page)));

	// Opens on arriving at a settings page, like Actual's own menu; collapsing it there sticks.
	$effect(() => {
		if (inSettings) {
			moreExpanded = true;
		}
	});
</script>

<nav class="nav">
	{#each mainItems() as item (item.page)}
		<button
			type="button"
			class="nav-link"
			class:active={isActive(item.page)}
			onclick={() => go(item.page)}
		>
			<span class="nav-icon"><item.icon strokeWidth={1.5} /></span>
			<span class="nav-label">{item.label}</span>
		</button>
	{/each}

	{#if calendarFeatureEnabled}
		<button
			type="button"
			class="nav-link"
			class:active={isActive(Page.Calendar)}
			onclick={openSpendingCalendar}
		>
			<span class="nav-icon"><CalendarDays strokeWidth={1.5} /></span>
			<span class="nav-label">Calendar</span>
		</button>
	{/if}

	{#if settingsItems().length === 0}
		<button
			type="button"
			class="nav-link"
			class:active={isActive(settingsItem.page)}
			onclick={() => go(settingsItem.page)}
		>
			<span class="nav-icon"><settingsItem.icon strokeWidth={1.5} /></span>
			<span class="nav-label">{settingsItem.label}</span>
		</button>
	{:else}
		<button
			type="button"
			class="nav-link"
			class:active={!moreExpanded && inSettings}
			aria-expanded={moreExpanded}
			onclick={toggleMore}
		>
			<span class="nav-icon"><settingsItem.icon strokeWidth={1.5} /></span>
			<span class="nav-label">{settingsItem.label}</span>
			<span class="nav-caret">
				<ChevronDown
					class={moreExpanded ? "caret" : "caret collapsed"}
					color="var(--abt-ink-5)"
					strokeWidth={3}
				/>
			</span>
		</button>

		{#if moreExpanded}
			<div class="nav-sublist">
				{#each settingsMenu() as sub (sub.page)}
					<button
						type="button"
						class="nav-link nav-sublink"
						class:active={isActive(sub.page)}
						onclick={() => go(sub.page)}
					>
						<span class="nav-icon"><sub.icon strokeWidth={1.5} /></span>
						<span class="nav-label">{sub.label}</span>
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</nav>

<style>
	.nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.nav-link {
		display: flex;
		align-items: center;
		gap: 13px;
		width: 100%;
		padding: calc(var(--sb-row-pad-y, 5px) + 2px) 8px;
		border-radius: var(--abt-radius);
		text-align: left;
		transition: background 0.12s ease;
	}
	.nav-link:hover {
		background: var(--abt-ink-4);
	}
	.nav-link.active {
		background: var(--abt-accent-2);
	}
	.nav-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		color: var(--abt-subtle);
	}
	.nav-icon :global(svg) {
		width: 17px;
		height: 17px;
	}
	.nav-label {
		font-size: var(--abt-text-lg);
		font-weight: 500;
		letter-spacing: 0.16px;
		color: var(--abt-ink);
	}
	.nav-link.active .nav-icon {
		color: var(--abt-accent);
	}
	.nav-link.active .nav-label {
		color: var(--abt-accent);
	}

	/* Settings disclosure caret + sub-links */
	.nav-caret {
		margin-left: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--abt-ink-5);
	}
	.nav .nav-caret :global(.caret) {
		width: 14px;
		height: 14px;
	}
	.nav-sublist {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 2px 0 2px 17px;
		padding-left: 10px;
		border-left: 1px solid var(--abt-ink-3);
	}
	/* A step down from the top-level links, so they read as children of Settings. */
	.nav-sublink {
		gap: 10px;
		padding: var(--sb-row-pad-y, 5px) 8px;
	}
	.nav-sublink .nav-icon {
		width: 15px;
		height: 15px;
	}
	.nav-sublink .nav-icon :global(svg) {
		width: 14px;
		height: 14px;
	}
	.nav-sublink .nav-label {
		font-size: var(--abt-text-md);
	}
</style>
