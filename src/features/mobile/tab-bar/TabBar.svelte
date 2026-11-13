<script lang="ts">
	import { MOBILE_NAV } from "@lib/actual-dom";
	import { navigate } from "@lib/utilities/actual-api";
	import { watchDom, watchElement } from "@lib/utilities/dom-watcher";
	import { Ellipsis, Plus } from "@lucide/svelte";
	import MoreSheet from "./MoreSheet.svelte";
	import { ADD_PATH, isActive, type NavLink, PRIMARY, readLinks, TAB_BAR_ATTR } from "./nav";

	let native = $state<HTMLElement | null>(document.querySelector<HTMLElement>(MOBILE_NAV));
	let links = $state<NavLink[]>([]);
	let hidden = $state(false);
	let path = $state(location.pathname);
	let moreOpen = $state(false);

	$effect(() =>
		watchElement(MOBILE_NAV, () => (native = document.querySelector<HTMLElement>(MOBILE_NAV))),
	);
	// Actual's own navigation slips past history watching, but always re-renders the page.
	$effect(() =>
		watchDom(() => {
			if (path !== location.pathname) {
				path = location.pathname;
			}
		}),
	);

	// Actual still tracks scrolling on its hidden drawer, so the bar follows its state.
	$effect(() => {
		const nav = native;
		if (!nav) {
			moreOpen = false;
			return;
		}
		return watchDom(
			() => {
				links = readLinks(nav);
				hidden = nav.dataset.navbarState === "hidden";
			},
			nav,
			{ attributes: true, attributeFilter: ["data-navbar-state"], childList: true, subtree: true },
		);
	});

	$effect(() => {
		if (!native) {
			return;
		}
		document.documentElement.setAttribute(TAB_BAR_ATTR, "");
		return () => document.documentElement.removeAttribute(TAB_BAR_ATTR);
	});

	const primary = $derived(PRIMARY.flatMap((p) => links.filter((l) => l.path === p)));
	const add = $derived(links.find((l) => l.path === ADD_PATH));
	const more = $derived(links.filter((l) => !PRIMARY.includes(l.path) && l.path !== ADD_PATH));
	const moreActive = $derived(more.some((l) => isActive(l.path, path)));

	function go(e: MouseEvent, to: string) {
		e.preventDefault();
		moreOpen = false;
		if (to !== location.pathname) {
			navigate(to);
		}
	}
</script>

{#snippet tab(link: NavLink)}
	<a
		class="tabbar__tab"
		class:is-active={!moreOpen && isActive(link.path, path)}
		href={link.path}
		aria-current={isActive(link.path, path) ? "page" : undefined}
		onclick={(e) => go(e, link.path)}
	>
		<span class="tabbar__icon"><link.icon size={22} strokeWidth={1.75} /></span>
		<span>{link.label}</span>
	</a>
{/snippet}

{#if native}
	<nav class="tabbar" class:is-hidden={hidden && !moreOpen} aria-label="Pages">
		{#each primary.slice(0, 2) as link (link.path)}
			{@render tab(link)}
		{/each}
		{#if add}
			<a
				class="tabbar__add"
				href={add.path}
				aria-label={add.label}
				onclick={(e) => go(e, add.path)}
			>
				<span class="tabbar__add-tile"><Plus size={22} strokeWidth={2.25} /></span>
			</a>
		{/if}
		{#each primary.slice(2) as link (link.path)}
			{@render tab(link)}
		{/each}
		<button
			type="button"
			class="tabbar__tab"
			class:is-active={moreOpen || moreActive}
			aria-expanded={moreOpen}
			onclick={() => (moreOpen = !moreOpen)}
		>
			<span class="tabbar__icon"><Ellipsis size={22} strokeWidth={1.75} /></span>
			<span>More</span>
		</button>
	</nav>
	{#if moreOpen}
		<MoreSheet
			links={more}
			current={path}
			onpick={(e, to) => go(e, to)}
			onclose={() => (moreOpen = false)}
		/>
	{/if}
{/if}

<style>
	.tabbar {
		position: fixed;
		inset: auto 0 0;
		z-index: 100;
		display: flex;
		padding: 0 var(--abt-space-2) env(safe-area-inset-bottom);
		background: color-mix(in srgb, var(--color-mobileNavBackground) 85%, transparent);
		backdrop-filter: blur(20px) saturate(1.5);
		border-top: 1px solid var(--color-menuBorder);
		transition: transform 0.25s ease;
	}

	.tabbar.is-hidden {
		transform: translateY(100%);
	}

	.tabbar__tab {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--abt-space-1);
		height: 56px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--abt-muted);
		font: inherit;
		font-size: var(--abt-text-xs);
		font-weight: 500;
		text-decoration: none;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
	}

	.tabbar__tab.is-active {
		color: var(--abt-accent);
	}

	/* The selected tab's icon sits on the accent tint; the add tile is the same tint, so the two
	   read as one system. */
	.tabbar__icon {
		display: grid;
		place-items: center;
		width: 52px;
		height: 28px;
		border-radius: var(--abt-radius-pill);
		transition: background-color 0.15s ease;
	}

	.tabbar__tab.is-active .tabbar__icon {
		background: var(--abt-accent-2);
	}

	.tabbar__add {
		flex: 1;
		display: grid;
		place-items: center;
		-webkit-tap-highlight-color: transparent;
	}

	.tabbar__add-tile {
		display: grid;
		place-items: center;
		width: 48px;
		height: 38px;
		box-sizing: border-box;
		border: 1px solid var(--abt-accent-3);
		border-radius: var(--abt-radius-lg);
		background: var(--abt-accent-2);
		color: var(--abt-accent);
		transition: transform 0.12s ease;
	}

	.tabbar__add:active .tabbar__add-tile {
		transform: scale(0.94);
	}

	@media (prefers-reduced-motion: reduce) {
		.tabbar,
		.tabbar__icon,
		.tabbar__add-tile {
			transition: none;
		}
	}
</style>
