const CHANGELOG_URL = "https://raw.githubusercontent.com/aelxxs/actual-budget-tweaks/main/CHANGELOG.md";

export interface ReleaseNoteSection {
	heading: string;
	items: string[];
}

/** Extracts the `## v{version}` section of the changelog into grouped, cleaned-up bullet items. */
export function parseChangelogSection(markdown: string, version: string): ReleaseNoteSection[] | null {
	const versionHeading = `## v${version}`;
	const start = markdown.indexOf(versionHeading);
	if (start === -1) return null;

	const rest = markdown.slice(start + versionHeading.length);
	const nextHeadingIndex = rest.search(/\n##\s/);
	const block = nextHeadingIndex === -1 ? rest : rest.slice(0, nextHeadingIndex);

	const sections: ReleaseNoteSection[] = [];
	let current: ReleaseNoteSection | null = null;
	let skipping = false;

	for (const rawLine of block.split("\n")) {
		const line = rawLine.trim();
		if (!line || line.startsWith("[compare changes]")) continue;

		if (line.startsWith("### ")) {
			const heading = line.replace(/^###\s*/, "");
			if (/contributors/i.test(heading)) {
				skipping = true;
				current = null;
				continue;
			}
			skipping = false;
			current = { heading, items: [] };
			sections.push(current);
			continue;
		}

		if (skipping) continue;

		if (line.startsWith("- ")) {
			const text = line
				.replace(/^-\s*/, "")
				.replace(/\s*\(\[[0-9a-f]{6,}\]\(https:\/\/github\.com\/[^)]+\)\)\s*$/, "")
				.trim();
			if (!current) {
				current = { heading: "", items: [] };
				sections.push(current);
			}
			current.items.push(text);
		}
	}

	return sections.filter((section) => section.items.length > 0);
}

export async function fetchReleaseNotes(version: string): Promise<ReleaseNoteSection[] | null> {
	try {
		const res = await browser.runtime.sendMessage({
			type: "fetch",
			url: CHANGELOG_URL,
			responseType: "text",
		});
		if (!res?.ok) return null;
		return parseChangelogSection(res.data as string, version);
	} catch {
		return null;
	}
}
