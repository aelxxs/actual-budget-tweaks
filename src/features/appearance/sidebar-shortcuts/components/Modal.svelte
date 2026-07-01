<script lang="ts">
	import { icon } from "@lib/icons";
	import { getFaviconUrl } from "@lib/utilities/favicon";
	import type { BuiltinTool, BuiltinWidget, Shortcut } from "../types";

	type ModalProps = {
		shortcuts: Shortcut[];
		builtinTools: BuiltinTool[];
		builtinWidgets: BuiltinWidget[];
		onSave: (shortcuts: Shortcut[]) => Promise<void>;
		onClose: () => void;
	};

	const { shortcuts, builtinTools, builtinWidgets, onSave, onClose }: ModalProps = $props();

	let items = $state<Shortcut[]>(shortcuts.map((s) => ({ ...s })));

	let addUrl = $state("");
	let addLabel = $state("");
	let stockSymbol = $state("");
	let rsuSymbol = $state("");
	let rsuDate = $state("");
	let rsuCount = $state("");

	const SVG_ICONS: Record<string, string> = {
		"svg:calc": icon("calculator", { size: 14 }),
		"svg:convert": icon("currencyConvert", { size: 14 }),
		"svg:stock": icon("stock", { size: 14 }),
		"svg:networth": icon("networth", { size: 14 }),
		"svg:interest": icon("interest", { size: 14 }),
		"svg:calendar": icon("calendar", { size: 14 }),
		"svg:rsu": icon("rsu", { size: 14 }),
	};

	function genId(): string {
		return `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
	}

	function addWebsite() {
		if (!addUrl.trim()) return;
		let url = addUrl.trim();
		if (!url.startsWith("http")) url = "https://" + url;
		const label =
			addLabel.trim() ||
			(() => {
				try {
					return new URL(url).hostname.replace("www.", "");
				} catch {
					return url;
				}
			})();
		items = [...items, { id: genId(), label, icon: "", url, type: "external", size: "small" }];
		addUrl = "";
		addLabel = "";
	}

	function addTool(tool: BuiltinTool) {
		if (items.some((s) => s.type === "tool" && s.url === tool.id)) return;
		items = [
			...items,
			{ id: genId(), label: tool.label, icon: tool.icon, url: tool.id, type: "tool", size: "small" },
		];
	}

	function addWidget(widget: BuiltinWidget) {
		if (widget.id === "stock-tracker") {
			if (!stockSymbol.trim()) return;
			items = [
				...items,
				{
					id: genId(),
					label: `${stockSymbol.toUpperCase()}`,
					icon: widget.icon,
					url: widget.id,
					type: "widget",
					size: "half",
					config: { symbol: stockSymbol.toUpperCase().trim() },
				},
			];
			stockSymbol = "";
		} else if (widget.id === "upcoming-schedules") {
			if (items.some((s) => s.type === "widget" && s.url === "upcoming-schedules")) return;
			items = [
				...items,
				{
					id: genId(),
					label: widget.label,
					icon: widget.icon,
					url: widget.id,
					type: "widget",
					size: "wide",
				},
			];
		} else if (widget.id === "rsu-tracker") {
			if (!rsuSymbol.trim() || !rsuCount.trim()) return;
			items = [
				...items,
				{
					id: genId(),
					label: `${rsuSymbol.toUpperCase()} RSU`,
					icon: widget.icon,
					url: widget.id,
					type: "widget",
					size: "half",
					config: {
						symbol: rsuSymbol.toUpperCase().trim(),
						startDate: rsuDate,
						count: rsuCount.trim(),
					},
				},
			];
			rsuSymbol = "";
			rsuDate = "";
			rsuCount = "";
		}
	}

	function remove(id: string) {
		items = items.filter((s) => s.id !== id);
	}

	let dragIdx = $state<number | null>(null);
	let dropTarget = $state<{ idx: number; side: "before" | "after" } | null>(null);

	function onDragStart(idx: number, e: DragEvent) {
		dragIdx = idx;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", String(idx));
		}
	}

	function onDragOver(idx: number, e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		if (dragIdx === idx) {
			dropTarget = null;
			return;
		}
		const el = e.currentTarget as HTMLElement;
		const rect = el.getBoundingClientRect();
		const midY = rect.top + rect.height / 2;
		const side = e.clientY < midY ? "before" : "after";
		dropTarget = { idx, side };
	}

	function onDrop(_idx: number, e: DragEvent) {
		e.preventDefault();
		if (dragIdx != null && dropTarget) {
			const a = [...items];
			const [moved] = a.splice(dragIdx, 1);
			let insertAt = dropTarget.idx;
			if (dragIdx < insertAt) insertAt--;
			if (dropTarget.side === "after") insertAt++;
			a.splice(insertAt, 0, moved);
			items = a;
		}
		dragIdx = null;
		dropTarget = null;
	}

	function onDragEnd() {
		dragIdx = null;
		dropTarget = null;
	}
	async function save() {
		await onSave(items);
	}
</script>

<div class="overlay" role="presentation" onclick={onClose}>
	<div class="modal" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()}>
		<div class="hd">
			<h3>Shortcuts</h3>
			<button class="close-btn" onclick={onClose}>✕</button>
		</div>

		<div class="body">
			{#if items.length > 0}
				<div class="list">
					{#each items as item, idx (item.id)}
						<div
							class="row"
							class:is-dragging={dragIdx === idx}
							class:is-drop-before={dropTarget?.idx === idx && dropTarget?.side === "before"}
							class:is-drop-after={dropTarget?.idx === idx && dropTarget?.side === "after"}
							draggable="true"
							ondragstart={(e) => onDragStart(idx, e)}
							ondragover={(e) => onDragOver(idx, e)}
							ondrop={(e) => onDrop(idx, e)}
							ondragend={onDragEnd}
							role="listitem"
						>
							<span class="row__grip" aria-label="Drag to reorder">⋮⋮</span>
							<span class="row__icon">
								{#if item.icon && SVG_ICONS[item.icon]}
									{@html SVG_ICONS[item.icon]}
								{:else if item.type === "external" && !item.icon}
									{@const fav = getFaviconUrl(item.url)}
									{#if fav}
										<img src={fav} alt="" width="16" height="16" />
									{:else}
										🔗
									{/if}
								{:else}
									{item.icon || "🔗"}
								{/if}
							</span>
							<div class="row__info">
								<span class="row__label">{item.label}</span>
								<span class="row__url">
									{#if item.type === "tool"}Built-in tool
									{:else if item.type === "widget"}Widget
									{:else}{item.url}
									{/if}
								</span>
							</div>
							{#if item.size === "wide"}
								<span class="row__badge">wide</span>
							{/if}
							<button class="icon-btn icon-btn--danger" onclick={() => remove(item.id)}>✕</button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Add website -->
			<div class="section-label">Add website</div>
			<div class="add-row">
				<input
					class="input input--grow"
					type="text"
					placeholder="bank.com"
					bind:value={addUrl}
					onkeydown={(e) => {
						if (e.key === "Enter") addWebsite();
					}}
				/>
				<input
					class="input input--name"
					type="text"
					placeholder="Name"
					bind:value={addLabel}
					onkeydown={(e) => {
						if (e.key === "Enter") addWebsite();
					}}
				/>
				<button class="btn btn--primary btn--sm" onclick={addWebsite} disabled={!addUrl.trim()}>Add</button>
			</div>

			<!-- Tools -->
			<div class="section-label">Tools</div>
			<div class="tools">
				{#each builtinTools as tool}
					{@const exists = items.some((s) => s.type === "tool" && s.url === tool.id)}
					{#if !exists}
						<button class="tool-btn" onclick={() => addTool(tool)}>
							<span class="tool-btn__icon"
								>{#if SVG_ICONS[tool.icon]}{@html SVG_ICONS[tool.icon]}{:else}{tool.icon}{/if}</span
							>
							<span>{tool.label}</span>
						</button>
					{/if}
				{/each}
			</div>

			<!-- Widgets -->
			<div class="section-label">Widgets</div>
			<div class="tools">
				<!-- Stock tracker -->
				<div class="widget-add-labeled">
					<div class="widget-add-labeled__header">
						<span class="tool-btn__icon">{@html SVG_ICONS["svg:stock"]}</span>
						<span class="widget-add-labeled__title">Stock Tracker</span>
					</div>
					<div class="widget-add-labeled__fields">
						<input
							class="input input--sym"
							type="text"
							placeholder="e.g. AAPL"
							bind:value={stockSymbol}
							onkeydown={(e) => {
								if (e.key === "Enter") addWidget(builtinWidgets[0]);
							}}
						/>
						<button
							class="btn btn--primary btn--sm"
							onclick={() => addWidget(builtinWidgets[0])}
							disabled={!stockSymbol.trim()}>Add</button
						>
					</div>
				</div>

				<!-- RSU Tracker -->
				{#if builtinWidgets.find((w) => w.id === "rsu-tracker")}
					<div class="widget-add-labeled">
						<div class="widget-add-labeled__header">
							<span class="tool-btn__icon">{@html SVG_ICONS["svg:rsu"]}</span>
							<span class="widget-add-labeled__title">RSU Tracker</span>
						</div>
						<div class="widget-add-labeled__fields">
							<input class="input input--sym" type="text" placeholder="Symbol" bind:value={rsuSymbol} />
							<input
								class="input input--date"
								type="date"
								placeholder="Grant date"
								bind:value={rsuDate}
							/>
							<input class="input input--sym" type="text" placeholder="Count" bind:value={rsuCount} />
							<button
								class="btn btn--primary btn--sm"
								onclick={() => addWidget(builtinWidgets.find((w) => w.id === "rsu-tracker")!)}
								disabled={!rsuSymbol.trim() || !rsuCount.trim()}>Add</button
							>
						</div>
					</div>
				{/if}

				<!-- Upcoming schedules -->
				{#if !items.some((s) => s.type === "widget" && s.url === "upcoming-schedules")}
					<button class="tool-btn" onclick={() => addWidget(builtinWidgets[1])}>
						<span class="tool-btn__icon">{@html SVG_ICONS["svg:calendar"]}</span>
						<span>Upcoming Bills</span>
					</button>
				{/if}
			</div>
		</div>

		<div class="ft">
			<button class="btn btn--secondary" onclick={onClose}>Cancel</button>
			<button class="btn btn--primary" onclick={save}>Save</button>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 99999;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal {
		background: var(--color-cardBackground, #2a2b3d);
		color: var(--color-pageText, #e0e0e0);
		border: 1px solid var(--color-tableBorder, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		width: 420px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
	}

	.hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 18px;
		border-bottom: 1px solid var(--color-tableBorder);
		flex-shrink: 0;
	}
	.hd h3 {
		font-size: 14px;
		font-weight: 600;
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--color-pageTextSubdued);
		cursor: pointer;
		font-size: 14px;
		padding: 4px 6px;
		border-radius: 4px;
		line-height: 1;
	}
	.close-btn:hover {
		background: var(--color-tableBorder);
	}

	.body {
		padding: 14px 18px;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
		scrollbar-width: thin;
	}

	.ft {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 18px;
		border-top: 1px solid var(--color-tableBorder);
		flex-shrink: 0;
	}

	/* ── List ── */
	.list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-bottom: 16px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 6px;
		transition:
			background 0.08s,
			opacity 0.08s;
		cursor: grab;
	}
	.row:hover {
		background: color-mix(in srgb, var(--color-pageText) 4%, transparent);
	}
	.row.is-dragging {
		opacity: 0.4;
	}
	.row.is-drop-before,
	.row.is-drop-after {
		position: relative;
	}

	.row.is-drop-before::before,
	.row.is-drop-after::after {
		content: "";
		position: absolute;
		left: 8px;
		right: 8px;
		height: 2px;
		background: var(--color-sidebarItemAccentSelected);
		border-radius: 1px;
	}

	.row.is-drop-before::before {
		top: -2px;
	}

	.row.is-drop-after::after {
		bottom: -2px;
	}

	.row__grip {
		font-size: 14px;
		letter-spacing: -3px;
		color: var(--color-pageTextSubdued);
		opacity: 0.9;
		cursor: grab;
		flex-shrink: 0;
		line-height: 1;
		transition: opacity 0.08s;
		user-select: none;
	}
	.row:hover .row__grip {
		opacity: 0.9;
	}
	.row__grip:active {
		cursor: grabbing;
	}

	.row__icon {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--color-pageText) 6%, transparent);
		border-radius: 6px;
		font-size: 14px;
		flex-shrink: 0;
	}
	.row__icon img {
		border-radius: 3px;
		object-fit: contain;
	}

	.row__info {
		flex: 1;
		min-width: 0;
	}
	.row__label {
		font-size: 12px;
		font-weight: 500;
		display: block;
	}
	.row__url {
		font-size: 10px;
		color: var(--color-pageTextSubdued);
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row__badge {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 2px 6px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 15%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		flex-shrink: 0;
	}

	.icon-btn {
		width: 20px;
		height: 20px;
		border: none;
		border-radius: 4px;
		background: none;
		color: var(--color-pageTextSubdued);
		cursor: pointer;
		font-size: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.3;
		transition:
			opacity 0.08s,
			background 0.08s;
	}
	.icon-btn:hover {
		opacity: 1;
		background: color-mix(in srgb, var(--color-pageText) 10%, transparent);
	}
	.icon-btn:disabled {
		display: none;
	}
	.icon-btn--danger:hover {
		color: var(--color-errorText);
	}

	/* ── Section ── */
	.section-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-pageTextSubdued);
		margin-bottom: 6px;
		padding-top: 10px;
		border-top: 1px solid color-mix(in srgb, var(--color-pageText) 6%, transparent);
	}

	.section-label:first-child {
		border-top: none;
		padding-top: 0;
	}

	.add-row {
		display: flex;
		gap: 6px;
		margin-bottom: 14px;
	}

	.input {
		padding: 6px 10px;
		font-size: 12px;
		font-family: inherit;
		border: 1px solid var(--color-tableBorder);
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-pageText) 4%, transparent);
		color: var(--color-pageText);
		outline: none;
	}
	.input:focus {
		border-color: var(--color-sidebarItemAccentSelected);
	}
	.input::placeholder {
		color: var(--color-pageTextSubdued);
	}
	.input--grow {
		flex: 1;
		min-width: 0;
	}
	.input--name {
		width: 100px;
		flex-shrink: 0;
	}
	.input--sym {
		flex: 1;
		min-width: 0;
	}

	.input--sym:not(:placeholder-shown) {
		text-transform: uppercase;
	}

	/* ── Tools/Widgets ── */
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 14px;
	}

	.tool-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 12px;
		border: 1px solid var(--color-tableBorder);
		border-radius: 8px;
		background: none;
		color: var(--color-pageText);
		font-family: inherit;
		font-size: 12px;
		cursor: pointer;
		transition:
			border-color 0.08s,
			background 0.08s;
	}
	.tool-btn:hover:not(:disabled) {
		border-color: var(--color-sidebarItemAccentSelected);
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 8%, transparent);
	}
	.tool-btn__icon {
		display: flex;
		align-items: center;
	}

	.widget-add {
		display: flex;
		gap: 6px;
		align-items: center;
		width: 100%;
	}

	.widget-add-labeled {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 10px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-pageText) 3%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-pageText) 6%, transparent);
	}

	.widget-add-labeled__header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.widget-add-labeled__title {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-pageTextSubdued);
	}

	.widget-add-labeled__fields {
		display: flex;
		gap: 6px;
		align-items: center;
		flex-wrap: wrap;
	}

	.input--date {
		font-family: inherit;
		font-size: 12px;
		color-scheme: dark;
		flex: 1;
		min-width: 120px;
	}

	.widget-add-labeled__fields .input--sym {
		flex: 1;
		min-width: 60px;
	}
	/* ── Buttons ── */
	.btn {
		padding: 7px 16px;
		font-size: 12px;
		font-family: inherit;
		font-weight: 500;
		border: none;
		border-radius: 6px;
		cursor: pointer;
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.btn--sm {
		padding: 6px 12px;
	}
	.btn--primary {
		background: var(--color-sidebarItemAccentSelected);
		color: #fff;
	}
	.btn--primary:hover:not(:disabled) {
		filter: brightness(1.1);
	}
	.btn--secondary {
		background: color-mix(in srgb, var(--color-pageText) 8%, transparent);
		color: var(--color-pageText);
	}
	.btn--secondary:hover {
		background: color-mix(in srgb, var(--color-pageText) 14%, transparent);
	}
</style>
