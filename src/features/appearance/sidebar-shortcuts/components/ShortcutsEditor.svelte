<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { loadCurrentBudgetId } from "@lib/utilities/actual-api";
	import type { IconName } from "@lib/icons";
	import { Check, ChevronLeft, Globe, Plus } from "lucide-svelte";
	import { onMount } from "svelte";
	import {
		BUILTIN_TOOLS as builtinTools,
		BUILTIN_WIDGETS as builtinWidgets,
		loadShortcuts,
		saveShortcuts,
		watchShortcuts,
	} from "../store";
	import type { Shortcut } from "../types";
	import Tiles from "./Tiles.svelte";

	/** Edits save as they happen, like the settings around it. */
	let items = $state<Shortcut[]>([]);
	// The open budget's, like the sidebar bar's; unknown for a moment while it's looked up.
	let budgetId: string | undefined;

	function commit(next: Shortcut[]) {
		items = next;
		if (budgetId) {
			saveShortcuts(budgetId, next);
		}
	}

	// The preview wraps tiles at the sidebar bar's real width; 240px if it isn't on screen.
	let stageWidth = $state(240);

	onMount(() => {
		let stopWatching: (() => void) | undefined;
		let mounted = true;
		void loadCurrentBudgetId().then(async (id) => {
			if (!id || !mounted) {
				return;
			}
			budgetId = id;
			items = await loadShortcuts(id);
			if (!mounted) {
				return;
			}
			stopWatching = watchShortcuts(id, (stored) => (items = stored));
		});
		const bar = document.querySelector<HTMLElement>("[data-abt-shortcuts-tiles] .bar");
		if (bar) {
			const style = getComputedStyle(bar);
			const width =
				bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
			if (width > 0) stageWidth = width;
		}
		return () => {
			mounted = false;
			stopWatching?.();
		};
	});

	/** Catalog entries that need input before they can be added get a form of their own. */
	type FormId = "website" | "stock-tracker" | "rsu-tracker";
	let form = $state<FormId | null>(null);

	const ICONS: Record<string, IconName> = {
		"svg:calc": "calculator",
		"svg:convert": "currencyConvert",
		"svg:stock": "stock",
		"svg:networth": "networth",
		"svg:interest": "interest",
		"svg:calendar": "calendar",
		"svg:rsu": "rsu",
	};

	const DESCRIPTIONS: Record<string, string> = {
		website: "A link that opens in a new tab",
		calculator: "Quick math without leaving Actual",
		"currency-converter": "Convert between currencies",
		"interest-calculator": "See how savings grow with interest",
		"stock-tracker": "Live price for one ticker",
		"rsu-tracker": "What your vesting shares are worth",
		"upcoming-schedules": "Scheduled payments coming up",
	};

	const FORM_TITLES: Record<FormId, string> = {
		website: "Website",
		"stock-tracker": "Stock tracker",
		"rsu-tracker": "RSU tracker",
	};

	interface CatalogEntry {
		id: string;
		label: string;
		icon: string;
		pinned: boolean;
		/** What it would look like pinned, for the preview while hovered. */
		sample: Omit<Shortcut, "id">;
		select: () => void;
	}

	const isPinned = (type: Shortcut["type"], url: string) =>
		items.some((s) => s.type === type && s.url === url);

	const catalog = $derived<CatalogEntry[]>([
		{
			id: "website",
			label: "Website",
			icon: "",
			pinned: false,
			sample: { label: "Website", icon: "", url: "", type: "external", size: "small" },
			select: () => (form = "website"),
		},
		...builtinTools.map((tool) => {
			const sample: Omit<Shortcut, "id"> = {
				label: tool.label,
				icon: tool.icon,
				url: tool.id,
				type: "tool",
				size: "small",
			};
			return {
				id: tool.id,
				label: tool.label,
				icon: tool.icon,
				pinned: isPinned("tool", tool.id),
				sample,
				select: () => pin(sample),
			};
		}),
		...builtinWidgets.map((w) => {
			const bills = w.id === "upcoming-schedules";
			const sample: Omit<Shortcut, "id"> = {
				label: w.label,
				icon: w.icon,
				url: w.id,
				type: "widget",
				size: bills ? "wide" : "half",
			};
			return {
				id: w.id,
				label: w.label,
				icon: w.icon,
				// Trackers can be pinned once per symbol; Upcoming bills only once.
				pinned: bills && isPinned("widget", w.id),
				sample,
				select: () => (bills ? pin(sample) : (form = w.id as FormId)),
			};
		}),
	]);

	let hovered = $state<CatalogEntry | null>(null);

	let addUrl = $state("");
	let addLabel = $state("");
	let symbol = $state("");
	let grantDate = $state("");
	let shares = $state("");

	// The preview follows typing once it pauses, so favicons and quotes aren't fetched per key.
	let settled = $state({ url: "", symbol: "", shares: "", grantDate: "" });
	$effect(() => {
		const next = {
			url: addUrl.trim(),
			symbol: symbol.trim().toUpperCase(),
			shares: shares.trim(),
			grantDate,
		};
		const t = setTimeout(() => (settled = next), 350);
		return () => clearTimeout(t);
	});

	function websiteUrl(raw: string): string {
		return raw && !raw.startsWith("http") ? "https://" + raw : raw;
	}

	function websiteLabel(url: string): string {
		if (!url) return "";
		try {
			return new URL(url).hostname.replace("www.", "");
		} catch {
			return url;
		}
	}

	const draft = $derived.by((): Omit<Shortcut, "id"> | null => {
		if (form === "website") {
			const url = websiteUrl(settled.url);
			return {
				label: addLabel.trim() || websiteLabel(url) || "Website",
				icon: "",
				url,
				type: "external",
				size: "small",
			};
		}
		if (form === "stock-tracker") {
			return {
				label: settled.symbol || "Stock",
				icon: "svg:stock",
				url: form,
				type: "widget",
				size: "half",
				config: { symbol: settled.symbol } as Record<string, string>,
			};
		}
		if (form === "rsu-tracker") {
			return {
				label: `${settled.symbol} RSU`,
				icon: "svg:rsu",
				url: form,
				type: "widget",
				size: "half",
				config: {
					symbol: settled.symbol,
					startDate: settled.grantDate,
					count: settled.shares || "0",
				},
			};
		}
		return null;
	});

	const ghost = $derived<Shortcut | null>(
		draft
			? { id: "ghost", ...draft }
			: hovered && !hovered.pinned
				? { id: "ghost", ...hovered.sample }
				: null,
	);

	const formValid = $derived(
		form === "website"
			? addUrl.trim() !== ""
			: form === "stock-tracker"
				? symbol.trim() !== ""
				: form === "rsu-tracker"
					? symbol.trim() !== "" && shares.trim() !== ""
					: false,
	);

	function genId(): string {
		return `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
	}

	function pin(item: Omit<Shortcut, "id">) {
		commit([...items, { id: genId(), ...item }]);
		hovered = null;
	}

	function submitForm() {
		if (!formValid) return;
		if (form === "website") {
			const url = websiteUrl(addUrl.trim());
			pin({
				label: addLabel.trim() || websiteLabel(url),
				icon: "",
				url,
				type: "external",
				size: "small",
			});
		} else {
			const sym = symbol.trim().toUpperCase();
			pin(
				form === "rsu-tracker"
					? {
							label: `${sym} RSU`,
							icon: "svg:rsu",
							url: form,
							type: "widget",
							size: "half",
							config: { symbol: sym, startDate: grantDate, count: shares.trim() },
						}
					: {
							label: sym,
							icon: "svg:stock",
							url: "stock-tracker",
							type: "widget",
							size: "half",
							config: { symbol: sym },
						},
			);
		}
		closeForm();
	}

	function closeForm() {
		form = null;
		addUrl = addLabel = symbol = grantDate = shares = "";
		settled = { url: "", symbol: "", shares: "", grantDate: "" };
	}

	// Escape leaves a form first; only from the catalog does it reach the dialog and close it.
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== "Escape" || !form) return;
		e.stopPropagation();
		closeForm();
	}

	function autofocus(node: HTMLInputElement) {
		node.focus();
	}
</script>

{#snippet entryIcon(iconKey: string)}
	{#if ICONS[iconKey]}
		<Icon name={ICONS[iconKey]} size={16} />
	{:else}
		<Globe size={16} strokeWidth={1.75} />
	{/if}
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="layout" onkeydown={onKeydown}>
	<!-- The sidebar's own bar, at its real width, edited in place. -->
	<section class="stage" aria-label="Sidebar preview">
		<span class="stage__label">Your sidebar</span>
		<div class="stage__bar" style:width="{stageWidth}px">
			{#if items.length === 0 && !ghost}
				<div class="stage__empty">Pick something on the right to pin it here</div>
			{:else}
				<Tiles
					{items}
					mode="edit"
					{ghost}
					onReorder={commit}
					onRemove={(id) => commit(items.filter((s) => s.id !== id))}
				/>
			{/if}
		</div>
		{#if items.length > 0}
			<p class="stage__hint">Drag to reorder · hover a tile to remove it</p>
		{/if}
	</section>

	<section class="side">
		{#if form}
			<form
				class="abt-stack abt-gap-4"
				onsubmit={(e) => {
					e.preventDefault();
					submitForm();
				}}
			>
				<div class="abt-cluster abt-gap-2">
					<button
						type="button"
						class="abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
						aria-label="Back to all shortcuts"
						onclick={closeForm}
					>
						<ChevronLeft size={16} strokeWidth={1.75} />
					</button>
					<h4 class="side__title">{FORM_TITLES[form]}</h4>
				</div>

				{#if form === "website"}
					<label class="field">
						<span class="field__label">Address</span>
						<input
							class="abt-input"
							type="text"
							placeholder="bank.com"
							bind:value={addUrl}
							use:autofocus
						/>
					</label>
					<label class="field">
						<span class="field__label">Name</span>
						<input
							class="abt-input"
							type="text"
							placeholder={websiteLabel(websiteUrl(addUrl.trim())) || "Defaults to the site's name"}
							bind:value={addLabel}
						/>
					</label>
				{:else}
					<label class="field">
						<span class="field__label">Symbol</span>
						<input
							class="abt-input symbol"
							type="text"
							placeholder="AAPL"
							bind:value={symbol}
							use:autofocus
						/>
					</label>
					{#if form === "rsu-tracker"}
						<div class="field-pair">
							<label class="field">
								<span class="field__label">Grant date</span>
								<input class="abt-input date" type="date" bind:value={grantDate} />
							</label>
							<label class="field">
								<span class="field__label">Shares</span>
								<input
									class="abt-input"
									type="text"
									inputmode="numeric"
									placeholder="100"
									bind:value={shares}
								/>
							</label>
						</div>
					{/if}
				{/if}

				<p class="side__note">The preview updates as you type.</p>

				<button type="submit" class="abt-btn add-btn" disabled={!formValid}>
					<Plus size={14} strokeWidth={2} /> Add to sidebar
				</button>
			</form>
		{:else}
			<h4 class="abt-label">Add to sidebar</h4>
			<ul class="catalog">
				{#each catalog as entry (entry.id)}
					<li>
						<button
							type="button"
							class="entry"
							disabled={entry.pinned}
							onclick={entry.select}
							onmouseenter={() => (hovered = entry)}
							onmouseleave={() => hovered === entry && (hovered = null)}
							onfocus={() => (hovered = entry)}
							onblur={() => hovered === entry && (hovered = null)}
						>
							<span class="entry__icon">{@render entryIcon(entry.icon)}</span>
							<span class="entry__text">
								<span class="entry__title">{entry.label}</span>
								<span class="entry__meta">{DESCRIPTIONS[entry.id]}</span>
							</span>
							<span class="entry__action">
								{#if entry.pinned}
									<Check size={14} strokeWidth={2} />
								{:else}
									<Plus size={14} strokeWidth={2} />
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	h4 {
		margin: 0;
	}

	.layout {
		display: flex;
		flex: 1;
		min-height: 0;
		margin-top: var(--abt-space-4);
		border-top: 1px solid var(--abt-line);
	}

	/* ── Preview ── */

	.stage {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
		flex-shrink: 0;
		padding: var(--abt-space-5);
		border-right: 1px solid var(--abt-line);
		background: var(--color-sidebarBackground, var(--color-pageBackground));
		color: var(--color-sidebarItemText);
		overflow-y: auto;
	}

	.stage__label {
		font-size: var(--abt-text-xs);
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-sidebarItemText) 55%, transparent);
	}

	.stage__bar {
		min-height: 38px;
	}

	.stage__empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 80px;
		padding: var(--abt-space-4);
		border: 1.5px dashed color-mix(in srgb, var(--color-sidebarItemText) 25%, transparent);
		border-radius: 10px; /* raw: fixed, with the sidebar search bar */
		font-size: var(--abt-text-sm);
		text-align: center;
		color: color-mix(in srgb, var(--color-sidebarItemText) 55%, transparent);
	}

	.stage__hint {
		margin: 0;
		font-size: var(--abt-text-xs);
		color: color-mix(in srgb, var(--color-sidebarItemText) 50%, transparent);
	}

	/* ── Catalog and forms ── */

	.side {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--abt-space-3);
		min-width: 0;
		padding: var(--abt-space-5);
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.side__title {
		font-size: var(--abt-text-base);
		font-weight: 600;
	}

	.side__note {
		margin: 0;
		font-size: var(--abt-text-sm);
		color: var(--color-pageTextSubdued);
	}

	.catalog {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		margin: 0 calc(-1 * var(--abt-space-3));
		padding: 0;
		list-style: none;
	}

	.entry {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		width: 100%;
		padding: var(--abt-space-3);
		border: 0;
		border-radius: var(--abt-radius);
		background: none;
		color: var(--color-pageText);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background 0.1s;
	}

	.entry:hover:not(:disabled) {
		background: var(--abt-fill);
	}

	.entry:focus-visible {
		outline: 2px solid var(--abt-accent-4);
		outline-offset: -2px;
	}

	.entry:disabled {
		cursor: default;
	}

	.entry:disabled .entry__icon,
	.entry:disabled .entry__text {
		opacity: 0.45;
	}

	.entry__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-fill);
	}

	.entry__text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--abt-space-1);
		min-width: 0;
	}

	.entry__title {
		font-size: var(--abt-text-base);
		font-weight: 500;
	}

	.entry__meta {
		font-size: var(--abt-text-sm);
		color: var(--color-pageTextSubdued);
	}

	/* A hint of what clicking does: shows on hover, and stays as a check once pinned. */
	.entry__action {
		display: flex;
		flex-shrink: 0;
		color: var(--abt-muted);
		opacity: 0;
		transition: opacity 0.1s;
	}

	.entry:hover .entry__action,
	.entry:focus-visible .entry__action {
		opacity: 1;
	}

	.entry:disabled .entry__action {
		opacity: 1;
		color: var(--abt-selected-fg);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
	}

	.field__label {
		font-size: var(--abt-text-sm);
		font-weight: 500;
		color: var(--abt-muted);
	}

	.field-pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--abt-space-3);
	}

	.date {
		color-scheme: light dark;
	}

	.symbol:not(:placeholder-shown) {
		text-transform: uppercase;
	}

	.add-btn {
		align-self: flex-start;
	}
</style>
