<script lang="ts">
	import { getValue, setValue } from "@/lib/utilities/store";
	import { onMount } from "svelte";

	let userLink = $state<string | null>(null);

	onMount(async () => {
		const saved = await getValue("user-link", "");
		userLink = saved;
	});

	async function onInputChange(event: Event) {
		const inputValue = (event.target as HTMLInputElement).value;

		try {
			const url = new URL(inputValue);
			const baseUrl = url.origin.endsWith("/") ? url.origin : url.origin + "/";

			userLink = baseUrl;
			await setValue("user-link", baseUrl);

			if (window.location.href === baseUrl) {
				window.location.reload();
			}
		} catch (error) {
			console.error("Invalid URL entered:", inputValue);
		}
	}
</script>

<div class="input-group">
	<label for="user-link-input">Enter custom link to activate extension:</label>
	<input
		id="user-link-input"
		type="url"
		placeholder="https://example.com/path"
		bind:value={userLink}
		oninput={onInputChange}
		autocomplete="off"
	/>
</div>

<style>
	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 100%;
	}

	label {
		font-weight: 600;
		font-size: 0.95rem;
	}

	input {
		padding: 0.6em 0.75em;
		border: 1.5px solid var(--border);
		border-radius: 0.4rem;
		font-size: 1rem;
		transition: border-color 0.2s ease-in-out;
		outline-offset: 2px;
	}

	input:focus {
		border-color: var(--color-buttonHighlight);
		outline: none;
	}

	input::placeholder {
		color: #aaa;
		font-style: italic;
	}
</style>
