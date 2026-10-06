// The account toolbar holds the empty flex spacer and search directly; its parent is the header.
export const TOOLBAR =
	'div:has(> div:first-child [data-testid="account-name"]) > div:last-child:has(> div:empty):has(> div > input)';
// Actual's lock button, by its glyph; its label is translated.
export const NATIVE_LOCK = 'path[d^="M4 8V6a6 6"]';

/** Resolves once Actual's lock button is on the page, or gone (or after `timeout`). */
export function whenLock(present: boolean, timeout = 3000): Promise<void> {
	const done = () => !!document.querySelector(`${TOOLBAR} ${NATIVE_LOCK}`) === present;
	if (done()) return Promise.resolve();
	return new Promise((resolve) => {
		const finish = () => {
			observer.disconnect();
			clearTimeout(timer);
			resolve();
		};
		const observer = new MutationObserver(() => {
			if (done()) finish();
		});
		observer.observe(document.body, { childList: true, subtree: true });
		const timer = setTimeout(finish, timeout);
	});
}
