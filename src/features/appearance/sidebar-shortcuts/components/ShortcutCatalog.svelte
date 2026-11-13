<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import type { IconName } from "@lib/utilities/icons";
	import { Check, ChevronLeft, Globe, Plus } from "@lucide/svelte";
	import { BUILTIN_TOOLS as builtinTools, BUILTIN_WIDGETS as builtinWidgets } from "../store";
	import type { Shortcut } from "../types";

	/** What can be pinned to the bar; the bar itself previews the hovered one as a ghost tile. */
	const {
		items,
		onPin,
		onGhost,
		onExit,
	}: {
		items: Shortcut[];
		onPin: (item: Shortcut) => void;
		onGhost: (ghost: Shortcut | null) => void;
		/** Leaves the catalog; its heading's back button does this, or returns from a form first. */
		onExit: () => void;
	} = $props();

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
		if (!url) {
			return "";
		}
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

	$effect(() => onGhost(ghost));

	function pin(item: Omit<Shortcut, "id">) {
		onPin({ id: genId(), ...item });
		hovered = null;
	}

	function submitForm() {
		if (!formValid) {
			return;
		}
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

	/** One step back: out of a form to the list, or out of the catalog. Escape does this too. */
	export function back(): void {
		if (form) {
			closeForm();
		} else {
			onExit();
		}
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

<section class="side">
	<button
		type="button"
		class="back"
		aria-label={form ? "Back to all shortcuts" : "Back"}
		onclick={back}
	>
		<ChevronLeft size={16} />
		<span class="back__title">{form ? FORM_TITLES[form] : "Add a shortcut"}</span>
	</button>
	{#if form}
		<form
			class="abt-stack abt-gap-4"
			onsubmit={(e) => {
				e.preventDefault();
				submitForm();
			}}
		>
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

<style>
	/* ── Catalog and forms ── */

	.side {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
		min-width: 0;
	}

	/* Matches the Customize panel's other page headings and the summary row's Pin a category. */
	.back {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		width: 100%;
		padding: var(--abt-space-2) var(--abt-space-3);
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

	.back + form {
		margin-top: var(--abt-space-2);
	}

	.back__title {
		font-size: var(--abt-text-md);
		font-weight: 600;
	}

	.side__note {
		margin: 0;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	.catalog {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.entry {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		width: 100%;
		padding: var(--abt-space-2) var(--abt-space-4) var(--abt-space-2) var(--abt-space-2);
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
		color: var(--abt-muted);
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
