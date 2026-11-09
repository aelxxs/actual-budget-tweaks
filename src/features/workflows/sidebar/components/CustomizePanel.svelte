<script lang="ts">
	import { accountIconPicker } from "@features/appearance/account-icon-picker";
	import { sidebarClosedAccounts } from "@features/appearance/sidebar-closed-accounts";
	import { sidebarDensity } from "@features/appearance/sidebar-density";
	import { sidebarGroupTotals } from "@features/appearance/sidebar-group-totals";
	import { sidebarSearch } from "@features/appearance/sidebar-search";
	import {
		sidebarShortcuts,
		sidebarShortcutsAddTile,
	} from "@features/appearance/sidebar-shortcuts";
	import ShortcutCatalog from "@features/appearance/sidebar-shortcuts/components/ShortcutCatalog.svelte";
	import {
		loadShortcuts,
		saveShortcuts,
		watchShortcuts,
	} from "@features/appearance/sidebar-shortcuts/store";
	import type { Shortcut } from "@features/appearance/sidebar-shortcuts/types";
	import { applySettingChange } from "@features/runtime";
	import type { CheckboxSetting } from "@features/types";
	import Switch from "@lib/components/Switch.svelte";
	import { applyGlobalCSS } from "@lib/utilities/dom";
	import { getValue, setValue, watchValue } from "@lib/utilities/store";
	import {
		Archive,
		Calculator,
		ChevronLeft,
		FolderTree,
		Image,
		LayoutGrid,
		type LucideIcon,
		Plus,
		Search,
	} from "@lucide/svelte";
	import { onMount } from "svelte";
	import { backOut } from "svelte/easing";
	import { fade, fly } from "svelte/transition";
	import { customizeState, finishCustomizing } from "../lib/customize.svelte";
	import GroupsEditor from "./GroupsEditor.svelte";
	import { LAYOUT_KEY, type SidebarLayout, toLayout } from "../lib/layout";

	const { sidebar, budgetId }: { sidebar: HTMLElement; budgetId: string | undefined } = $props();

	type Toggle = { setting: CheckboxSetting<any>; name: string; icon: LucideIcon };
	const SHOW: Toggle[] = [
		{ setting: sidebarSearch, name: "Search bar", icon: Search },
		{ setting: sidebarShortcuts, name: "Shortcuts bar", icon: LayoutGrid },
		{ setting: sidebarShortcutsAddTile, name: "Add tile", icon: Plus },
		{ setting: sidebarClosedAccounts, name: "Closed accounts", icon: Archive },
	];
	const ACCOUNTS: Toggle[] = [
		{ setting: sidebarGroupTotals, name: "Group totals", icon: Calculator },
		{ setting: accountIconPicker, name: "Account icons", icon: Image },
	];
	const LAYOUTS: { value: SidebarLayout; label: string }[] = [
		{ value: "standard", label: "Standard" },
		{ value: "split", label: "Split" },
	];
	const DENSITIES = [
		{ value: ".05rem", label: "Slim" },
		{ value: ".15rem", label: "Normal" },
		{ value: ".25rem", label: "Relaxed" },
	];

	const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
	// Room for the edge that ties the panel to the sidebar, as Insights' cards menu has.
	const GAP = 32;

	let values = $state<Record<string, boolean>>(
		Object.fromEntries(
			[...SHOW, ...ACCOUNTS].map(({ setting: s }) => [s.context.key, s.context.defaultValue]),
		),
	);
	let layout = $state<SidebarLayout>("split");
	let density = $state(sidebarDensity.context.defaultValue);
	let shortcuts = $state<Shortcut[]>([]);

	let box = $state({ left: 0, top: 0, maxHeight: 0 });
	let titleMid = $state(26);
	let edge = $state<{ sx: number; sy: number; tx: number; ty: number } | null>(null);
	const edgePath = $derived.by(() => {
		if (!edge) {
			return "";
		}
		const { sx, sy, tx, ty } = edge;
		const pull = Math.max(12, (tx - sx) / 2);
		return `M ${sx} ${sy} C ${sx + pull} ${sy}, ${tx - pull} ${ty}, ${tx} ${ty}`;
	});
	// Which way the panes slide: forward into a sub-pane, back out of it.
	let dir = $state(1);

	// The stage takes the newest page's height, so the outgoing one sliding away doesn't hold it open.
	let stageHeight = $state<number | null>(null);
	let sized = $state(false);
	function measure(node: HTMLElement) {
		const observer = new ResizeObserver(() => {
			if (node.isConnected && !node.dataset.leaving) {
				stageHeight = node.offsetHeight;
				requestAnimationFrame(() => (sized = true));
			}
		});
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}
	const leave = (node: HTMLElement, x: number) => {
		node.dataset.leaving = "1";
		return fly(node, slide(x));
	};

	function place() {
		const r = sidebar.getBoundingClientRect();
		const header = sidebar.querySelector(".budget")?.getBoundingClientRect();
		const edgeX = r.right;
		const top = Math.max(8, r.top + 8);
		box = { left: edgeX + GAP, top, maxHeight: innerHeight - top - 8 };
		edge = {
			sx: edgeX,
			sy: header?.height ? header.top + header.height / 2 : r.top + 28,
			tx: box.left,
			ty: top + titleMid,
		};
	}

	onMount(() => {
		// Out to the page itself: an ancestor of the sidebar's slot contains fixed elements, which
		// would measure this layer's position from the slot rather than the window.
		document.body.append(layer);
		const title = panel?.querySelector<HTMLElement>(".title");
		if (title) {
			titleMid = title.offsetTop + title.offsetHeight / 2;
		}
		place();
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		document.addEventListener("keydown", onKey, true);
		const stops = [...SHOW, ...ACCOUNTS].map(({ setting: s }) => {
			const { key, defaultValue } = s.context;
			void getValue<boolean>(key, defaultValue).then((v) => (values[key] = Boolean(v)));
			return watchValue<boolean>(key, (v) => (values[key] = Boolean(v ?? defaultValue)));
		});
		void getValue<unknown>(LAYOUT_KEY, "split").then((v) => (layout = toLayout(v)));
		stops.push(watchValue<unknown>(LAYOUT_KEY, (v) => (layout = toLayout(v))));
		const { key: densityKey, defaultValue: densityDefault } = sidebarDensity.context;
		void getValue<string>(densityKey, densityDefault).then((v) => (density = v ?? densityDefault));
		// The sidebar changes width as the layout switches, and can be dragged wider.
		const resize = new ResizeObserver(place);
		resize.observe(sidebar);
		addEventListener("resize", place);
		return () => {
			stops.forEach((stop) => stop());
			resize.disconnect();
			removeEventListener("resize", place);
			document.removeEventListener("keydown", onKey, true);
			if (opener?.isConnected && !opener.closest(".ctx")) {
				opener.focus({ preventScroll: true });
			}
		};
	});

	$effect(() => {
		const id = budgetId;
		if (!id) {
			return;
		}
		void loadShortcuts(id).then((stored) => (shortcuts = stored));
		const stopShortcuts = watchShortcuts(id, (stored) => (shortcuts = stored));
		return stopShortcuts;
	});

	function toggle(setting: CheckboxSetting<any>, on: boolean) {
		values[setting.context.key] = on;
		void applySettingChange(setting, on);
	}

	function pickLayout(value: SidebarLayout) {
		layout = value;
		void setValue(LAYOUT_KEY, value);
	}

	function pickDensity(value: string) {
		density = value;
		void setValue(sidebarDensity.context.key, value);
		applyGlobalCSS(sidebarDensity.context.css(value), sidebarDensity.context.key);
	}

	function pin(item: Shortcut) {
		shortcuts = [...shortcuts, item];
		if (budgetId) {
			void saveShortcuts(budgetId, shortcuts);
		}
		if (!values[sidebarShortcuts.context.key]) {
			toggle(sidebarShortcuts, true);
		}
	}

	function go(pane: typeof customizeState.pane) {
		dir = pane === "main" ? -1 : 1;
		customizeState.pane = pane;
		customizeState.ghost = null;
	}

	let catalog: { back: () => void } | undefined = $state();
	let panel: HTMLElement | undefined = $state();
	let layer: HTMLElement;

	// Captured before the Insights panel and Actual see it, so Escape only steps this panel back.
	function onKey(e: KeyboardEvent) {
		if (e.key !== "Escape") {
			return;
		}
		// A rename field in the sidebar cancels its own edit.
		const target = e.target as Element | null;
		if (target?.closest?.("input, textarea") && !panel?.contains(target)) {
			return;
		}
		e.stopPropagation();
		e.preventDefault();
		if (customizeState.pane === "add-shortcut" && catalog) {
			catalog.back();
		} else if (customizeState.pane !== "main") {
			go("main");
		} else {
			finishCustomizing();
		}
	}

	// Each page takes focus as it opens, so the keyboard carries on from where it was.
	function focusFirst(node: HTMLElement) {
		requestAnimationFrame(() =>
			node
				.querySelector<HTMLElement>("button:not(:disabled), input, [tabindex='0']")
				?.focus({ preventScroll: true }),
		);
	}

	function pop(_node: Element) {
		return {
			duration: still ? 0 : 280,
			easing: backOut,
			css: (t: number, u: number) =>
				`opacity: ${Math.min(1, t * 1.6)}; transform: translateX(${-u * 18}px) scale(${0.94 + 0.06 * t});`,
		};
	}

	const slide = (x: number) => ({ x: still ? 0 : x * 28, duration: still ? 0 : 220 });
</script>

{#snippet toggles(list: Toggle[])}
	{#each list as { setting, name, icon: ItemIcon } (setting.context.key)}
		{@const on = values[setting.context.key]}
		{@const nested = setting === sidebarShortcutsAddTile}
		{#if !nested || values[sidebarShortcuts.context.key]}
			<label class="row" class:nested>
				<span class="tile" data-off={!on || undefined}><ItemIcon size={14} /></span>
				<span class="name">{name}</span>
				<Switch checked={on} onCheckedChange={(next) => toggle(setting, next)} />
			</label>
		{/if}
	{/each}
{/snippet}

<div bind:this={layer} class="layer">
	<svg class="edge" aria-hidden="true" transition:fade={{ duration: still ? 0 : 150 }}>
		{#if edge}
			<path d={edgePath} pathLength="1" />
			<circle cx={edge.sx} cy={edge.sy} r="3.5" />
			<circle cx={edge.tx} cy={edge.ty} r="3.5" />
		{/if}
	</svg>

	<div
		bind:this={panel}
		class="panel abt-popover"
		style:left="{box.left}px"
		style:top="{box.top}px"
		style:max-height="{box.maxHeight}px"
		role="dialog"
		aria-label="Customize sidebar"
		transition:pop
	>
		<div
			class="stage"
			class:sized={sized && !still}
			style:height={stageHeight === null ? null : `${stageHeight}px`}
		>
			{#if customizeState.pane === "main"}
				<div class="pane" use:measure use:focusFirst in:fly={slide(-dir)} out:leave={dir}>
					<div class="head">
						<span class="title">Customize sidebar</span>
					</div>

					<div class="choice">
						<span class="choice__label">Layout</span>
						<div class="abt-seg abt-seg--sm" role="group" aria-label="Layout">
							{#each LAYOUTS as opt (opt.value)}
								<button
									type="button"
									aria-pressed={layout === opt.value}
									onclick={() => pickLayout(opt.value)}>{opt.label}</button
								>
							{/each}
						</div>
					</div>
					<div class="choice">
						<span class="choice__label">Density</span>
						<div class="abt-seg abt-seg--sm" role="group" aria-label="Density">
							{#each DENSITIES as opt (opt.value)}
								<button
									type="button"
									aria-pressed={density === opt.value}
									onclick={() => pickDensity(opt.value)}>{opt.label}</button
								>
							{/each}
						</div>
					</div>

					<div class="divider"></div>
					<span class="abt-label heading">Show</span>
					{@render toggles(SHOW)}
					<button type="button" class="row link" onclick={() => go("add-shortcut")}>
						<span class="tile"><Plus size={14} /></span>
						<span class="name">Add a shortcut</span>
						<ChevronLeft size={14} class="chev" />
					</button>

					<div class="divider"></div>
					<span class="abt-label heading">Accounts</span>
					{@render toggles(ACCOUNTS)}
					<button type="button" class="row link" onclick={() => go("groups")}>
						<span class="tile"><FolderTree size={14} /></span>
						<span class="name">Account groups</span>
						<ChevronLeft size={14} class="chev" />
					</button>

					<div class="foot">
						<button type="button" class="abt-btn abt-btn--sm" onclick={finishCustomizing}
							>Done</button
						>
					</div>
				</div>
			{:else if customizeState.pane === "groups"}
				<div class="pane" use:measure use:focusFirst in:fly={slide(dir)} out:leave={-dir}>
					<button type="button" class="back" onclick={() => go("main")}>
						<ChevronLeft size={16} />
						<span class="back__title">Account groups</span>
					</button>
					<GroupsEditor {budgetId} />
				</div>
			{:else}
				<div class="pane" use:measure use:focusFirst in:fly={slide(dir)} out:leave={-dir}>
					<ShortcutCatalog
						bind:this={catalog}
						items={shortcuts}
						onPin={pin}
						onGhost={(ghost) => (customizeState.ghost = ghost)}
						onExit={() => go("main")}
					/>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.edge {
		position: fixed;
		inset: 0;
		/* Over the panel, so the port sits whole on its border. */
		z-index: 1001;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}

	.edge path {
		fill: none;
		stroke: var(--abt-accent);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-dasharray: 1;
		animation: abt-edge-draw 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) 0.1s both;
	}

	.edge circle {
		fill: var(--color-pageBackground);
		stroke: var(--abt-accent);
		stroke-width: 1.5;
		animation: abt-edge-port 0.2s ease-out 0.1s both;
	}

	@keyframes abt-edge-draw {
		from {
			stroke-dashoffset: 1;
		}
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes abt-edge-port {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.edge path,
		.edge circle {
			animation: none;
		}
	}

	.panel {
		position: fixed;
		z-index: 1000;
		width: 288px;
		padding: var(--abt-space-3);
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.stage {
		display: grid;
		align-items: start;
		overflow: hidden;
	}

	.stage.sized {
		transition: height 0.22s cubic-bezier(0.2, 0.7, 0.3, 1);
	}

	.pane {
		grid-area: 1 / 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		padding: var(--abt-space-1) var(--abt-space-2) var(--abt-space-3);
	}

	.title {
		font-size: var(--abt-text-md);
		font-weight: 600;
	}

	.choice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-2);
		padding: var(--abt-space-2);
	}

	.choice__label {
		font-size: var(--abt-text-md);
	}

	.heading {
		padding: var(--abt-space-2) var(--abt-space-2) var(--abt-space-1);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		padding: var(--abt-space-2);
		border-radius: var(--abt-radius-sm);
		cursor: pointer;
		transition: background 0.12s;
	}

	.row:hover {
		background: var(--abt-fill);
	}

	.row.nested {
		padding-left: calc(var(--abt-space-2) + 18px);
	}

	.row.link {
		width: 100%;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
	}

	.row.link:hover {
		background: var(--abt-fill);
	}

	.row.link :global(.chev) {
		transform: rotate(180deg);
		color: var(--abt-subtle);
	}

	.tile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 26px;
		height: 26px;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-accent-2);
		color: var(--abt-accent);
		transition:
			background 0.2s,
			color 0.2s;
	}

	.tile[data-off] {
		background: var(--abt-ink-2);
		color: var(--abt-subtle);
	}

	.name {
		flex: 1;
		min-width: 0;
		font-size: var(--abt-text-md);
	}

	.tile[data-off] + .name {
		color: var(--color-pageTextSubdued);
	}

	.divider {
		height: 1px;
		margin: var(--abt-space-2);
		background: var(--abt-line);
	}

	.foot {
		display: flex;
		justify-content: flex-end;
		padding: var(--abt-space-3) var(--abt-space-2) var(--abt-space-1);
	}

	/* As the summary row's Pin a category step heads its page. */
	.back {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		width: 100%;
		padding: var(--abt-space-2) var(--abt-space-3) var(--abt-space-4);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.back :global(svg) {
		color: var(--abt-subtle);
	}

	.back__title {
		font-size: var(--abt-text-md);
		font-weight: 600;
	}
</style>
