// Loader: injects category-template-insights.js into the MAIN world so it
// can access Actual Budget's window.$q and window.$query.
(function () {
  'use strict';

  function injectScript(src, options) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      if (options && options.type) script.type = options.type;
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = reject;
      document.documentElement.appendChild(script);
    });
  }

  async function getBaseUrl() {
    try {
      const result = await chrome.storage.local.get('local:user-link');
      const userLink = result['local:user-link'];
      if (!userLink) return null;
      const url = new URL(userLink);
      return `${url.protocol}//${url.host}/`;
    } catch {
      return null;
    }
  }

  (async () => {
    const baseUrl = await getBaseUrl();
    if (!baseUrl || !window.location.href.startsWith(baseUrl)) return;
    try {
      await injectScript('content-scripts/category-template-insights.js', { type: "module" });
    } catch (err) {
      console.error('[ABT CTI] Failed to inject script:', err);
    }
  })();
})();
