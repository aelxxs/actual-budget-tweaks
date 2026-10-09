/** The setting key whose preview is open; one at a time across the settings page. */
export const previewState = $state<{ open: string | null }>({ open: null });
