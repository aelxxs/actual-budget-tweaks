/**
 * Observe changes to the sidebar all-accounts balance node and call the callback on mutation.
 * Retries until the element is found.
 * @param {Function} callback - Function to call when a mutation occurs.
 */
export function observeSidebarAllAccountsBalance(callback) {
    let observerAttached = false;
    function tryAttachObserver() {
        if (observerAttached) return;
        const target = document.querySelector('[data-testid="sidebar-all-accounts-balance"]');
        if (!target) {
            setTimeout(tryAttachObserver, 200); // Retry every 200ms until found
            return;
        }
        const observer = new MutationObserver(() => {
            callback();
        });
        observer.observe(target, { childList: true, subtree: true, characterData: true });
        observerAttached = true;
    }
    tryAttachObserver();
}
// privacy-utils.js
// Shared privacy mode logic for Actual Budget Tweaks widgets



let isPrivacyMode = false;


/**
 * Refresh privacy mode state and toggle the global privacy class on <body>.
 * @returns {Promise<boolean>} - Resolves to the current privacy mode state.
 */
export async function refreshPrivacyMode() {
    const q = window.$q, query = window.$query;
    if (!q || !query) return false;
    try {
        const result = await query(
            q('preferences').filter({ id: 'isPrivacyEnabled' }).select('*')
        );
        isPrivacyMode = String(result.data?.[0]?.value) === 'true';
        setPrivacyModeClass(isPrivacyMode);
        return isPrivacyMode;
    } catch (err) {
        console.warn('[ABT] Failed to read privacy mode:', err);
        return false;
    }
}

/**
 * Add or remove the .abt-privacy-enabled class on <body>.
 */
export function setPrivacyModeClass(enabled) {
    if (enabled) {
        document.body.classList.add('abt-privacy-enabled');
    } else {
        document.body.classList.remove('abt-privacy-enabled');
    }
}

/**
 * Get the current privacy mode state (after last refresh).
 * @returns {boolean}
 */
export function getPrivacyMode() {
    return isPrivacyMode;
}

