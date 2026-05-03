// Loader: Injects D3 and income-breakdown.js into the MAIN world
// so they can access Actual Budget's window.$q and window.$query.
(function () {
  'use strict';

  function injectScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
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

  function injectStylesheet(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL(href);
    document.documentElement.appendChild(link);
  }

  async function load() {
    const baseUrl = await getBaseUrl();
    if (!baseUrl || !window.location.href.startsWith(baseUrl)) return;
    try {
      injectStylesheet('content-scripts/income-breakdown.css');
      await injectScript('lib/d3.min.js');
      await injectScript('lib/d3-sankey.min.js');
      await injectScript('content-scripts/income-breakdown.js');
    } catch (err) {
      console.error('[ABT Income Breakdown] Failed to inject scripts:', err);
    }
  }

  load();
})();
