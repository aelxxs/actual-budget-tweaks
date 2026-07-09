<script lang="ts">
	import { onMount } from "svelte";
	import IconPickerPopover from "@lib/components/IconPickerPopover.svelte";
	import type { IconPickerResult } from "@lib/components/IconPickerPopover.svelte";
	import type { AccountIconData } from "./index";
	import { loadIconCache } from "./index";

	const { accountId, hasIcon, anchorRect, onSave, onRemove, onClose } = $props<{
		accountId: string;
		accountName?: string;
		hasIcon: boolean;
		anchorRect: DOMRect;
		onSave: (iconData: AccountIconData) => Promise<void>;
		onRemove: () => Promise<void>;
		onClose: () => void;
	}>();

	let hasIconActual = $state(hasIcon);

	onMount(async () => {
		const icons = await loadIconCache();
		hasIconActual = Boolean(icons[accountId]);
	});

	async function handleSelect(result: IconPickerResult) {
		await onSave(result as AccountIconData);
	}
</script>

<IconPickerPopover
	{anchorRect}
	hasIcon={hasIconActual}
	onSelect={handleSelect}
	onRemove={onRemove}
	{onClose}
/>
