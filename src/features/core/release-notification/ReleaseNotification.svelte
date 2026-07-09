<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import type { ReleaseNoteSection } from "@lib/utilities/changelog";

	const {
		version,
		sections,
		releaseUrl,
		onClose,
	}: {
		version: string;
		sections: ReleaseNoteSection[] | null;
		releaseUrl: string;
		onClose: (dontShowAgain: boolean) => void;
	} = $props();

	let dontShowAgain = $state(false);
	const iconUrl = browser.runtime.getURL("/icon.svg");
</script>

<div class="toast">
	<div class="toast__header">
		<img class="toast__logo" src={iconUrl} alt="" />
		<div class="toast__heading">
			<div class="toast__eyebrow">Actual Budget Tweaks</div>
			<div class="toast__title">Updated to v{version}</div>
		</div>
		<button
			class="toast__close"
			type="button"
			title="Close"
			aria-label="Close"
			onclick={() => onClose(dontShowAgain)}
		>
			<Icon name="close" size={13} />
		</button>
	</div>

	<div class="toast__body">
		{#if sections && sections.length}
			{#each sections as section}
				{#if section.heading}
					<div class="toast__section-heading">{section.heading}</div>
				{/if}
				<ul class="toast__list">
					{#each section.items as item}
						<li>{item}</li>
					{/each}
				</ul>
			{/each}
		{:else}
			<div class="toast__empty">Release notes aren't available for this version.</div>
		{/if}
	</div>

	<div class="toast__footer">
		<label class="toast__opt-out">
			<input type="checkbox" class="toast__checkbox" bind:checked={dontShowAgain} />
			Don't show update notifications again
		</label>
		<a class="toast__release-link" href={releaseUrl} target="_blank" rel="noreferrer">View full release</a>
	</div>
</div>

<style>
	.toast {
		position: relative;
		width: 450px;
		max-height: 75vh;
		display: flex;
		flex-direction: column;
		background: var(--color-menuBackground);
		color: var(--color-menuItemText);
		border: 1px solid var(--color-menuBorder);
		border-radius: 10px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
		font-family: inherit;
		overflow: hidden;
	}

	.toast::before {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(
			90deg,
			var(--color-sidebarItemAccentSelected),
			color-mix(in srgb, var(--color-sidebarItemAccentSelected) 40%, transparent)
		);
	}

	.toast__header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 8px 12px 14px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-pageText) 10%, transparent);
		flex-shrink: 0;
	}

	.toast__logo {
		width: 26px;
		height: 26px;
		flex-shrink: 0;
		border-radius: 6px;
	}

	.toast__heading {
		flex: 1;
		min-width: 0;
	}

	.toast__eyebrow {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-pageTextSubdued);
	}

	.toast__title {
		font-weight: 700;
		font-size: 14px;
		margin-top: 1px;
	}

	.toast__close {
		all: unset;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 5px;
		border-radius: 5px;
		color: var(--color-pageTextSubdued);
		cursor: pointer;
		align-self: flex-start;
	}

	.toast__close:hover {
		color: var(--color-pageText);
		background: color-mix(in srgb, currentColor 12%, transparent);
	}

	.toast__body {
		overflow-y: auto;
		padding: 12px 14px;
		font-size: 12px;
		line-height: 1.45;
	}

	.toast__section-heading {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-sidebarItemAccentSelected);
		margin: 12px 0 6px;
	}

	.toast__section-heading:first-child {
		margin-top: 0;
	}

	.toast__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		margin-left: 10px;
		flex-direction: column;
		gap: 2px;
	}

	.toast__list li {
		position: relative;
		padding-left: 14px;
	}

	.toast__list li::before {
		content: "";
		position: absolute;
		left: 2px;
		top: 0.55em;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 70%, var(--color-pageTextSubdued));
	}

	.toast__empty {
		opacity: 0.7;
	}

	.toast__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 14px;
		border-top: 1px solid color-mix(in srgb, var(--color-pageText) 10%, transparent);
		background: color-mix(in srgb, var(--color-pageText) 3%, transparent);
		flex-shrink: 0;
	}

	.toast__opt-out {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		color: var(--color-pageTextSubdued);
		cursor: pointer;
	}

	.toast__release-link {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-sidebarItemAccentSelected);
		text-decoration: none;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.toast__release-link:hover {
		text-decoration: underline;
	}

	.toast__checkbox {
		position: relative;
		margin: 0;
		flex-shrink: 0;
		width: 14px;
		height: 14px;
		appearance: none;
		outline: 0;
		border: 1px solid var(--color-formInputBorder, var(--color-menuBorder));
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--color-tableBackground, transparent);
		cursor: pointer;
		transition:
			background-color 0.15s,
			border-color 0.15s;
	}

	.toast__checkbox:checked {
		border-color: var(--color-checkboxBorderSelected, var(--color-sidebarItemAccentSelected));
		background-color: var(--color-checkboxBackgroundSelected, var(--color-sidebarItemAccentSelected));
	}

	.toast__checkbox:checked::after {
		display: block;
		width: 8px;
		height: 8px;
		content: " ";
		background: var(--color-checkboxBackgroundSelected, var(--color-sidebarItemAccentSelected))
			url('data:image/svg+xml; utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="white" d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>')
			8px 8px;
	}
</style>
