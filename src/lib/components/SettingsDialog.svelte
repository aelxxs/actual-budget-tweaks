<script lang="ts" module>
	import type { Setting } from "../../features/types";
	import type { Component } from "svelte";

	export interface SettingsGroup {
		heading?: string;
		settings: Setting[];
	}

	export interface SettingsTab {
		value: string;
		label: string;
		groups?: SettingsGroup[];
		/** Rendered after the groups; for tabs that hold more than toggles. */
		content?: { component: Component<any>; props?: Record<string, unknown> };
		/** Lets `content` run edge to edge instead of inside the body's padding. */
		bleed?: boolean;
	}
</script>

<script lang="ts">
	import { X } from "lucide-svelte";
	import SettingRow from "./SettingRow.svelte";
	import Tabs from "./Tabs.svelte";

	const {
		title,
		tabs,
		initialTab,
		onClose,
	}: { title: string; tabs: SettingsTab[]; initialTab?: string; onClose: () => void } = $props();

	let tab = $state(initialTab ?? tabs[0].value);
	const current = $derived(tabs.find((t) => t.value === tab) ?? tabs[0]);

	let dialog: HTMLDivElement;
	$effect(() => dialog.focus());
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onClose()} />

<div
	class="abt-dialog-backdrop"
	role="presentation"
	onclick={(e) => e.target === e.currentTarget && onClose()}
>
	<div
		bind:this={dialog}
		class="settings-dialog abt-dialog abt-popover abt-controls-quiet"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
	>
		<header class="abt-dialog__header">
			<h3 class="abt-dialog__title">{title}</h3>
			<button
				type="button"
				class="abt-btn abt-btn--icon abt-btn--ghost"
				aria-label="Close"
				onclick={onClose}
			>
				<X size={16} strokeWidth={1.75} />
			</button>
		</header>

		<Tabs
			tabs={tabs.map((t) => ({ value: t.value, label: t.label }))}
			bind:value={tab}
			--abt-tabs-bg="none"
			--abt-tabs-pad="var(--abt-space-5)"
		/>

		<div class="abt-dialog__body body" class:body--bleed={current.bleed}>
			{#if current.groups?.length}
				<div class="groups">
					{#each current.groups as group, i (group.heading ?? i)}
						<section class="group">
							{#if group.heading}
								<h4 class="abt-label">{group.heading}</h4>
							{/if}
							<div>
								{#each group.settings as setting (setting.type === "core" ? setting : setting.context.key)}
									<SettingRow {setting} />
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{/if}
			{#if current.content}
				{@const Content = current.content.component}
				<Content {...current.content.props ?? {}} />
			{/if}
		</div>
	</div>
</div>

<style>
	/* A fixed height, so switching tabs doesn't resize the dialog and re-centre it. */
	.settings-dialog {
		--abt-dialog-w: 640px;
		height: min(620px, 85vh);
	}

	.body--bleed {
		display: flex;
		flex-direction: column;
		padding: 0;
	}

	.groups {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-5);
	}

	.body--bleed .groups {
		padding: var(--abt-space-5) var(--abt-space-5) 0;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
	}

	h4 {
		margin: 0;
	}
</style>
