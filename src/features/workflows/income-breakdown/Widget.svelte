<script lang="ts">
	import Tick from "@lib/components/Tick.svelte";
	import { navigate } from "@lib/actual/actual-api";
	import { createLogger } from "@lib/logger";
	import { onOutsideClick } from "@lib/dom/popover";
	import { portal } from "@lib/dom/svelte";
	import { EllipsisVertical } from "@lucide/svelte";
	import Chart from "./Chart.svelte";
	import {
		copyWidget,
		type DashboardPage,
		DEFAULT_NAME,
		loadPages,
		removeWidget,
		renameWidget,
		type WidgetRecord,
		widgetName,
	} from "./dashboard";
	import {
		accountFilters,
		type Breakdown,
		type BreakdownOptions,
		buildSankey,
		loadBreakdown,
		PRESETS,
		rangeOf,
		type SankeyNode,
		transactionsFor,
	} from "./data";
	import { breakdown, setOptions } from "./state.svelte";
	import Transactions from "./Transactions.svelte";

	const log = createLogger("income-breakdown");

	const { record }: { record: WidgetRecord } = $props();

	const options = $derived(breakdown.options);
	const range = $derived(rangeOf(options));
	let data = $state<Breakdown | null>(null);
	let failed = $state(false);
	const graph = $derived(data ? buildSankey(data, options) : null);

	let name = $derived(widgetName(record));
	let renaming = $state(false);
	let menu = $state<{ x: number; y: number; pages: DashboardPage[] | null } | null>(null);
	let menuEl = $state<HTMLElement | null>(null);
	let picked = $state<{ node: SankeyNode; at: { x: number; y: number } } | null>(null);

	// Only the dates refetch; the toggles reshape what's loaded.
	$effect(() => {
		const { start, end } = range;
		let stale = false;
		loadBreakdown(start, end)
			.then((loaded) => {
				if (!stale) {
					data = loaded;
					failed = false;
				}
			})
			.catch((err) => {
				log.error("Couldn't load transactions:", err);
				if (!stale) {
					failed = true;
				}
			});
		return () => {
			stale = true;
		};
	});

	// Arranging the dashboard closes what's open, so a drag isn't taken for a click.
	$effect(() => {
		if (breakdown.editing) {
			picked = null;
		}
	});

	$effect(() => {
		if (!menu || !menuEl) {
			return;
		}
		const stop = onOutsideClick(menuEl, () => (menu = null));
		return stop;
	});

	const toggles: { key: keyof BreakdownOptions; label: string }[] = [
		{ key: "showIncome", label: "Income" },
		{ key: "showExpense", label: "Expenses" },
		{ key: "showSubCategories", label: "Subcategories" },
		{ key: "showLossGain", label: "Net gain/loss" },
		{ key: "groupPositive", label: "Group positive" },
	];

	function openMenu(x: number, y: number) {
		menu = {
			x: Math.min(x, window.innerWidth - 220),
			y: Math.min(y, window.innerHeight - 160),
			pages: null,
		};
	}

	async function run(action: () => Promise<void>) {
		menu = null;
		try {
			await action();
		} catch (err) {
			log.error("Dashboard action failed:", err);
		}
	}

	function finishRename(save: boolean, value: string) {
		if (!renaming) {
			return;
		}
		renaming = false;
		const next = value.trim() || DEFAULT_NAME;
		if (save && next !== name) {
			name = next;
			void run(() => renameWidget(record, next));
		}
	}

	// A mouse shortcut for the menu button, which keyboards reach.
	function rightClickMenu(node: HTMLElement) {
		const onContextMenu = (e: MouseEvent) => {
			e.preventDefault();
			openMenu(e.clientX, e.clientY);
		};
		node.addEventListener("contextmenu", onContextMenu);
		return { destroy: () => node.removeEventListener("contextmenu", onContextMenu) };
	}

	function focusSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

<div class="ib" class:is-editing={breakdown.editing} use:rightClickMenu>
	<header class="ib__head">
		<div class="ib__titles">
			{#if renaming}
				<input
					class="ib__rename abt-input non-draggable-area"
					value={name}
					aria-label="Widget name"
					use:focusSelect
					onkeydown={(e) => {
						if (e.key === "Enter" || e.key === "Escape") {
							e.preventDefault();
							finishRename(e.key === "Enter", e.currentTarget.value);
						}
					}}
					onblur={(e) => finishRename(true, e.currentTarget.value)}
				/>
			{:else}
				<h2 class="ib__title">{name}</h2>
			{/if}
			<span class="ib__range">{range.start} – {range.end}</span>
		</div>
		<button
			type="button"
			class="ib__menu-btn abt-btn abt-btn--icon abt-btn--ghost non-draggable-area"
			aria-label="Widget menu"
			aria-haspopup="menu"
			aria-expanded={!!menu}
			onclick={(e) => {
				const r = e.currentTarget.getBoundingClientRect();
				openMenu(r.right - 200, r.bottom + 4);
			}}
		>
			<EllipsisVertical size={16} />
		</button>
	</header>

	<div class="ib__controls non-draggable-area">
		<div class="ib__presets abt-seg abt-seg--sm" role="group" aria-label="Period">
			{#each PRESETS as preset (preset.label)}
				<button
					type="button"
					aria-pressed={options.preset === preset.label}
					onclick={() => setOptions({ preset: preset.label })}>{preset.label}</button
				>
			{/each}
		</div>
		<div class="ib__row">
			<label class="ib__field">
				From
				<input
					type="date"
					class="abt-input"
					value={range.start}
					onchange={(e) => setOptions({ preset: "", start: e.currentTarget.value, end: range.end })}
				/>
			</label>
			<label class="ib__field">
				To
				<input
					type="date"
					class="abt-input"
					value={range.end}
					onchange={(e) =>
						setOptions({ preset: "", start: range.start, end: e.currentTarget.value })}
				/>
			</label>
		</div>
		<div class="ib__row">
			{#each toggles as toggle (toggle.key)}
				{@const id = `ib-${record.id}-${toggle.key}`}
				{@const disabled = toggle.key === "showSubCategories" && !options.showExpense}
				<label class="ib__toggle" class:is-disabled={disabled} for={id}>
					<Tick
						{id}
						{disabled}
						checked={options[toggle.key] as boolean}
						onCheckedChange={(checked) => setOptions({ [toggle.key]: checked })}
					/>
					{toggle.label}
				</label>
			{/each}
		</div>
	</div>

	{#if failed}
		<p class="ib__status">Couldn't load transactions.</p>
	{:else if !graph}
		<p class="ib__status">Loading…</p>
	{:else}
		<Chart
			nodes={graph.nodes}
			links={graph.links}
			total={graph.total}
			interactive={!breakdown.editing}
			onpick={(node, x, y) => {
				picked = picked?.node.id === node.id ? null : { node, at: { x, y } };
			}}
		/>
	{/if}
</div>

{#if picked && data}
	{@const loaded = data}
	{@const node = picked.node}
	<Transactions
		title={node.name}
		transactions={transactionsFor(loaded, node.id)}
		categoryName={(id) => (id && loaded.categories.get(id)?.name) || "—"}
		at={picked.at}
		onclose={() => (picked = null)}
		onview={() => {
			// Before closing: `node` is read from `picked`, which closing clears.
			const filterConditions = accountFilters(loaded, range, node.id);
			picked = null;
			navigate("/accounts", { state: { goBack: true, filterConditions } });
		}}
	/>
{/if}

{#if menu}
	<div
		class="ib-menu abt-popover abt-menu"
		role="menu"
		use:portal
		bind:this={menuEl}
		style:left="{menu.x}px"
		style:top="{menu.y}px"
	>
		{#if menu.pages}
			<div class="abt-menu__heading">Copy to dashboard</div>
			{#each menu.pages as page (page.id)}
				<button
					type="button"
					class="abt-menu__item"
					role="menuitem"
					onclick={() => run(() => copyWidget(record, page.id))}
				>
					{page.name || "Untitled dashboard"}
				</button>
			{:else}
				<p class="ib-menu__empty">No dashboards</p>
			{/each}
		{:else}
			<button
				type="button"
				class="abt-menu__item"
				role="menuitem"
				onclick={() => {
					menu = null;
					renaming = true;
				}}>Rename</button
			>
			<button
				type="button"
				class="abt-menu__item"
				role="menuitem"
				onclick={() => run(() => removeWidget(record))}>Remove</button
			>
			<button
				type="button"
				class="abt-menu__item"
				role="menuitem"
				onclick={async () => {
					const pages = await loadPages();
					if (menu) {
						menu = { ...menu, pages };
					}
				}}>Copy to dashboard…</button
			>
		{/if}
	</div>
{/if}

<style>
	/* Over the Text widget it lives in, filling its grid cell. */
	.ib {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-4);
		padding: var(--abt-space-5);
		overflow: hidden;
		border-radius: var(--abt-radius);
		background: var(--color-tableBackground);
		color: var(--color-pageText);
	}

	.ib.is-editing {
		cursor: move;
		filter: grayscale(1);
	}

	.ib__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--abt-space-3);
	}

	.ib__titles {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		min-width: 0;
	}

	.ib__title {
		margin: 0;
		font-size: var(--abt-text-lg);
		font-weight: 500;
		line-height: 1.2;
	}

	.ib__rename {
		--abt-btn-h: 26px;
		width: min(28ch, 100%);
	}

	.ib__range {
		color: var(--abt-muted);
	}

	/* Like Actual's own widgets, the menu shows while the dashboard is being arranged. */
	.ib__menu-btn {
		opacity: 0;
		transition: opacity 0.15s;
	}

	.ib.is-editing:hover .ib__menu-btn,
	.ib__menu-btn:focus-visible,
	.ib__menu-btn[aria-expanded="true"] {
		opacity: 1;
	}

	.ib__controls {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
		cursor: default;
	}

	.ib__presets {
		flex-wrap: wrap;
		height: auto;
		align-self: flex-start;
	}

	.ib__presets > button {
		height: 22px;
	}

	.ib__row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--abt-space-3) var(--abt-space-5);
	}

	.ib__field {
		--abt-btn-h: 26px;
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		color: var(--abt-muted);
	}

	.ib__toggle {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		cursor: pointer;
		user-select: none;
	}

	.ib__toggle.is-disabled {
		opacity: 0.4;
		cursor: default;
	}

	.ib__status {
		display: grid;
		flex: 1;
		place-items: center;
		margin: 0;
		color: var(--abt-muted);
	}

	.ib-menu {
		position: fixed;
		z-index: 10000;
		min-width: 200px;
	}

	.ib-menu__empty {
		margin: 0;
		padding: var(--abt-space-3);
		color: var(--abt-muted);
	}
</style>
