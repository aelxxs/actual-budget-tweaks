<script lang="ts">
	import type { SyncStatus } from "../lib/data";

	const { status }: { status: SyncStatus } = $props();
</script>

<!-- Real bank-sync status glyph (see data.ts's `sync_status` → SyncStatus
     mapping). Shared between AccountRow's small badge and the hover card's
     larger uses of the same status, rather than duplicating the SVG twice. -->
<span class="status status-{status}" aria-label={status}>
	{#if status === "synced"}
		<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
			<circle cx="24" cy="24" r="9" fill="currentColor" />
		</svg>
	{:else if status === "syncing"}
		<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
			<circle cx="24" cy="24" r="4.6" fill="currentColor" />
			<g class="orbit">
				<path d="M24 24m-11,0 a11,11 0 0 1 19.5,-6.8" stroke-width="3.4" stroke-linecap="round" />
			</g>
		</svg>
	{:else if status === "error"}
		<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
			<circle cx="24" cy="24" r="6.5" fill="currentColor" stroke="none" />
			<circle class="ring-pulse" cx="24" cy="24" r="13" stroke-width="3" />
		</svg>
	{:else}
		<svg
			viewBox="0 0 48 48"
			fill="none"
			stroke="currentColor"
			stroke-width="3.4"
			xmlns="http://www.w3.org/2000/svg"
		>
			<circle cx="24" cy="24" r="8" />
		</svg>
	{/if}
</span>

<style>
	/* Sync-status glyphs (dot grammar) */
	.status {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 17px;
		height: 17px;
		flex-shrink: 0;
	}
	.status svg {
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.status-synced {
		color: var(--sb-success);
	}
	.status-syncing {
		color: var(--sb-attention);
	}
	.status-error {
		color: var(--sb-danger);
	}
	.status-manual {
		color: var(--abt-ink-5);
	}
	.orbit {
		transform-origin: 24px 24px;
		animation: abt-orbit 0.95s linear infinite;
	}
	.ring-pulse {
		transform-origin: center;
		animation: abt-ring-pulse 1.7s ease-in-out infinite;
	}
	@keyframes abt-ring-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.orbit,
		.ring-pulse {
			animation: none;
		}
	}
</style>
