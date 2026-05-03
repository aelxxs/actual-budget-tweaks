// Loader: Injects template-apply-breakdown.js into the MAIN world
// so it can wrap window.$send and access window.$query / window.$q.
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

  function injectStylesheet(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL(href);
    document.documentElement.appendChild(link);
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

  async function load() {
    const baseUrl = await getBaseUrl();
    if (!baseUrl || !window.location.href.startsWith(baseUrl)) return;
    try {
      injectStylesheet('content-scripts/template-apply-breakdown.css');
      await injectScript('content-scripts/template-apply-breakdown.js');
    } catch (err) {
      console.error('[ABT Template Apply Breakdown] Failed to inject scripts:', err);
    }
  }

  load();
})();
