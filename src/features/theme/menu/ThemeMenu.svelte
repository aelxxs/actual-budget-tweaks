<script lang="ts">
	import { themes } from "@lib/design";
	import { onOutsideClick, positionPopover } from "@lib/utilities/popover";
	import { portal } from "@lib/utilities/svelte";
	import { getValue } from "@lib/utilities/store";
	import { LayoutGrid, Paintbrush, Palette, Shapes } from "@lucide/svelte";
	import { editorState } from "../editor-state.svelte";
	import ThemeThumb from "../picker/ThemeThumb.svelte";
	import {
		builtinThumb,
		communityThumb,
		nativeThumb,
		placeholderThumb,
		type Thumb,
		userThumb,
	} from "../picker/thumbs";
	import { openPaletteInStudio, openThemeStudio } from "../studio/open";
	import { openStylePanel } from "../style/open";
	import {
		getNativePreviewColors,
		isCommunityTheme,
		NATIVE_THEME_KEY,
		pageMode,
	} from "../theme-apply";
	import { userThemeState } from "../user-themes.svelte";
	import { openThemeGallery } from "./gallery";

	let open = $state(false);
	let followsSystem = $state(false);
	let button = $state<HTMLButtonElement | null>(null);
	let menu = $state<HTMLDivElement | null>(null);
	let communityThumbs = $state<Record<string, Thumb>>({});

	const key = $derived(editorState.activeTheme);
	const user = $derived(userThemeState.themes[key]);
	const name = $derived(
		key === NATIVE_THEME_KEY
			? "Actual default"
			: (themes[key]?.name ?? user?.name ?? key.split("/").pop() ?? key),
	);
	const thumb = $derived.by((): Thumb => {
		if (key === NATIVE_THEME_KEY) {
			return nativeThumb(getNativePreviewColors(), pageMode());
		}
		if (user) {
			return userThumb(user);
		}
		return builtinThumb(key) ?? communityThumbs[key] ?? placeholderThumb(pageMode());
	});
	// Studio themes and palettes open in Theme Studio; anything else starts a new theme there.
	const inStudio = $derived(!!themes[key] || !!user?.recipe || user?.type === "palette");

	$effect(() => {
		if (isCommunityTheme(key) && !communityThumbs[key]) {
			const repo = key;
			void communityThumb(repo, pageMode()).then((t) => t && (communityThumbs[repo] = t));
		}
	});

	async function toggle() {
		if (open) {
			open = false;
			return;
		}
		followsSystem = await getValue<boolean>("theme-auto-switch", false);
		open = true;
	}

	function run(action: () => void) {
		open = false;
		action();
	}

	function customize() {
		if (user) {
			openThemeStudio(key);
		} else if (themes[key]) {
			openPaletteInStudio(themes[key].keys, themes[key].name);
		} else {
			openThemeStudio();
		}
	}

	$effect(() => {
		if (!open || !menu || !button) {
			return;
		}
		positionPopover(menu, button, { align: "right", gap: 6 });
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				open = false;
				button?.focus();
			}
		};
		document.addEventListener("keydown", onKey);
		const stop = onOutsideClick([menu, button], () => (open = false));
		return () => {
			stop();
			document.removeEventListener("keydown", onKey);
		};
	});
</script>

<button
	type="button"
	class="trigger"
	class:open
	title="Theme"
	aria-label="Theme"
	aria-haspopup="menu"
	aria-expanded={open}
	bind:this={button}
	onclick={toggle}
>
	<Palette size={16} strokeWidth={1.75} />
</button>

{#if open}
	<div class="tm abt-popover" role="menu" aria-label="Theme" use:portal bind:this={menu}>
		<div class="tm__current">
			<span class="tm__thumb"><ThemeThumb {thumb} /></span>
			<span class="tm__text">
				<span class="tm__name">{name}</span>
				<span class="tm__hint">{followsSystem ? "Matching your system" : "Current theme"}</span>
			</span>
		</div>
		<div class="tm__divider"></div>
		<button type="button" role="menuitem" class="tm__row" onclick={() => run(openThemeGallery)}>
			<span class="tm__tile"><LayoutGrid size={15} /></span>
			<span class="tm__label">Change theme</span>
		</button>
		<button type="button" role="menuitem" class="tm__row" onclick={() => run(openStylePanel)}>
			<span class="tm__tile"><Shapes size={15} /></span>
			<span class="tm__label"
				>Style<span class="tm__sub">Corners, background, glow and grain</span></span
			>
		</button>
		<button type="button" role="menuitem" class="tm__row" onclick={() => run(customize)}>
			<span class="tm__tile"><Paintbrush size={15} /></span>
			<span class="tm__label"
				>{inStudio ? "Customize in Theme Studio" : "Create in Theme Studio"}<span class="tm__sub"
					>{inStudio ? `Edit ${name}'s colors` : "Start a theme of your own"}</span
				></span
			>
		</button>
	</div>
{/if}

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 0;
		border-radius: var(--abt-radius);
		background: none;
		color: var(--abt-muted);
		cursor: pointer;
	}
	.trigger:hover,
	.trigger.open {
		background: var(--abt-fill-hover);
		color: var(--color-pageText);
	}
	/* Laid out like the budget actions menu, so ABT's menus read as one family. */
	.tm {
		position: fixed;
		z-index: 10000;
		width: 300px;
		padding: var(--abt-space-3);
	}
	.tm__current {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		padding: var(--abt-space-2) var(--abt-space-3);
	}
	.tm__thumb {
		display: block;
		flex: none;
		width: 56px;
	}
	.tm__text,
	.tm__label {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.tm__name {
		overflow: hidden;
		font-size: var(--abt-text-md);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tm__hint,
	.tm__sub {
		font-size: var(--abt-text-sm);
		color: var(--color-pageTextSubdued);
	}
	.tm__divider {
		height: 1px;
		margin: var(--abt-space-2) var(--abt-space-3);
		background: var(--abt-line);
	}
	.tm__row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		width: 100%;
		padding: var(--abt-space-2) var(--abt-space-3);
		border: 0;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		font-size: var(--abt-text-md);
		text-align: left;
		cursor: pointer;
	}
	.tm__row:hover {
		background: var(--abt-fill);
	}
	.tm__tile {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-ink-2);
		color: var(--abt-muted);
	}
</style>
