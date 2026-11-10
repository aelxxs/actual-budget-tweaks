<script lang="ts">
	import { setAbtEnabled } from "../utilities/abt-enabled";

	const logoUrl = browser.runtime.getURL("/icon.svg");
	let turningOn = $state(false);

	async function turnOn() {
		turningOn = true;
		await setAbtEnabled(true);
		location.reload();
	}
</script>

<div class="off">
	<div class="title">
		<img src={logoUrl} alt="" />
		<h2>Actual Budget Tweaks is off</h2>
	</div>
	<p>
		Actual runs as it would without the extension. Your settings, themes and sidebar layout are kept
		for when you turn it back on.
	</p>
	<button type="button" class="abt-btn abt-tone-accent" disabled={turningOn} onclick={turnOn}>
		{turningOn ? "Turning on…" : "Turn on ABT"}
	</button>
</div>

<style>
	.off {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--abt-space-3);
		max-width: 560px;
	}
	.title {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}
	.title img {
		width: 18px; /* raw: matches the settings page logo */
		height: 18px; /* raw: matches the settings page logo */
		border-radius: var(--abt-radius-sm);
	}
	h2 {
		margin: 0;
		font-size: var(--abt-text-xl);
		font-weight: 600;
	}
	p {
		margin: 0;
		color: var(--abt-soft);
	}
</style>
