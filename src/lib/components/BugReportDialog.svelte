<script lang="ts">
	import { ExternalLink } from "@lucide/svelte";
	import { scriptSections, sectionItems } from "../../features";
	import Dialog from "./Dialog.svelte";

	const { repoUrl, onClose }: { repoUrl: string; onClose: () => void } = $props();

	const version = browser.runtime.getManifest().version;
	let feature = $state("");
	let description = $state("");

	function submit() {
		// Field names match .github/ISSUE_TEMPLATE/bug_report.yml's `id`s — the
		// repo has issue forms configured, so /issues/new without `template=`
		// lands on the template chooser instead of prefilling a blank issue.
		const params = new URLSearchParams({
			template: "bug_report.yml",
			title: feature ? `[Bug]: ${feature}` : "[Bug]: ",
			version,
		});
		if (feature) {
			params.set("feature", feature);
		}
		if (description) {
			params.set("description", description);
		}
		window.open(`${repoUrl}/issues/new?${params}`, "_blank", "noopener,noreferrer");
		onClose();
	}
</script>

<Dialog title="Report a bug" {onClose}>
	<div class="abt-dialog__body bug-form">
		<label class="bug-field">
			<span class="abt-label">Affected feature</span>
			<select class="abt-input" bind:value={feature}>
				<option value="">General / Not sure</option>
				{#each scriptSections as section (section.title)}
					<optgroup label={section.title}>
						{#each sectionItems(section) as item (item.context.key)}
							<option value={item.label}>{item.label}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</label>
		<label class="bug-field">
			<span class="abt-label">What happened?</span>
			<textarea
				class="abt-input bug-textarea"
				rows="4"
				placeholder="Describe what you expected vs. what actually happened…"
				bind:value={description}></textarea>
		</label>
	</div>
	{#snippet footer()}
		<button type="button" class="abt-btn" onclick={onClose}>Cancel</button>
		<button type="button" class="abt-btn abt-tone-accent" onclick={submit}>
			Open on GitHub
			<ExternalLink size={13} strokeWidth={1.5} />
		</button>
	{/snippet}
</Dialog>

<style>
	.bug-form {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-4);
	}

	.bug-field {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
	}

	.bug-textarea {
		height: auto;
		min-height: 88px;
		padding-block: var(--abt-space-2);
		resize: vertical;
	}
</style>
