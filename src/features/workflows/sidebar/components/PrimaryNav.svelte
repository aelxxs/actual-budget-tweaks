<script lang="ts">
	import {
		closeCalendar,
		isCalendarOpen,
		openCalendar,
	} from "@features/workflows/spending-calendar";
	import { navigate } from "@lib/utilities/actual-api";
	import { watchDom } from "@lib/utilities/dom-watcher";
	import { Page, matchesPage } from "@lib/utilities/pages";
	import { getValue, setValue } from "@lib/utilities/store";
	import { CalendarDays, ChevronDown, Ellipsis } from "lucide-svelte";
	import { moreItems, navItems } from "../lib/nav";

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
		if (covered) closeCalendar();
		// The page under the calendar is already showing; navigating again makes Actual remount it.
		if (covered && matchesPage(page)) return;
		navigate(`/${page}`);
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

	// Content scripts run in an isolated JS world — patching `history.pushState`
	// there (what `watchRoute` relies on) never sees Actual's own React-Router
	// navigation, which calls pushState in the main world. DOM mutations,
	// though, are genuinely shared across both worlds, so watching for those
	// is what actually catches route changes here (same pattern already used
	// elsewhere in this extension, e.g. account-icon-picker).
	//
	// A fresh object each time, not a counter: a naive `tick += 1` would read
	// `tick` during this same effect's synchronous execution (since the
	// listener fires immediately on subscribe) — making the effect depend on
	// the very value it writes, and re-triggering itself forever. Reassigning
	// to a new object is a pure write, so the effect never tracks `tick`.
	let tick = $state({});

	$effect(() => {
		return watchDom(() => (tick = {}));
	});

	// Svelte 5 tracks dependencies per-expression, not per enclosing block —
	// a sibling `{@const _ = tick}` doesn't make THIS expression re-run just
	// because it's nearby. `tick` has to be read inside the same expression
	// that's actually reactive here; `tick` is always truthy (a plain `{}`),
	// so this reduces to `matchesPage(page)` while still tracking `tick`.
	function isActive(page: Page): boolean {
		return Boolean(tick) && matchesPage(page);
	}
</script>

<nav class="nav">
	{#each navItems as item (item.page)}
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

	<button type="button" class="nav-link" aria-expanded={moreExpanded} onclick={toggleMore}>
		<span class="nav-icon"><Ellipsis strokeWidth={1.5} /></span>
		<span class="nav-label">More</span>
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
			{#each moreItems as sub (sub.page)}
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

	/* "More" disclosure caret + sub-links */
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
	.nav-sublink {
		gap: 11px;
		padding: calc(var(--sb-row-pad-y, 5px) + 1px) 8px;
	}
	.nav-sublink .nav-icon {
		width: 16px;
		height: 16px;
	}
	.nav-sublink .nav-icon :global(svg) {
		width: 15px;
		height: 15px;
	}
	.nav-sublink .nav-label {
		font-size: var(--abt-text-lg);
	}
</style>
