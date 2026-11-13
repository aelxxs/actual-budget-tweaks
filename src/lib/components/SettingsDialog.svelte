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
	import Dialog from "./Dialog.svelte";
	import SettingRow from "./SettingRow.svelte";
	import Tabs from "./Tabs.svelte";

	const {
		title,
		tabs,
		initialTab,
		onClose,
	}: { title: string; tabs: SettingsTab[]; initialTab?: string; onClose: () => void } = $props();

	let tab = $derived(initialTab ?? tabs[0].value);
	const current = $derived(tabs.find((t) => t.value === tab) ?? tabs[0]);
</script>

<Dialog {title} class="settings-dialog" inPlace {onClose}>
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
</Dialog>

<style>
	/* A fixed height, so switching tabs doesn't resize the dialog and re-centre it. */
	:global(.settings-dialog) {
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
