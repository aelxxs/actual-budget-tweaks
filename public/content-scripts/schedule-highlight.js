// Opens a schedule's edit modal when the URL carries ?highlight=<scheduleId>
// on /schedules. Mirrors the row-click approach used by category-template
// insights: find the table row via data-focus-key and dispatch a click,
// which triggers Actual's pushModal('schedule-edit', { id }).
(function () {
  'use strict';

  let lastHandled = null;

  function openSchedule(schedId) {
    let tries = 0;
    const maxTries = 60;
    const step = () => {
      const row = document.querySelector(
        `[data-focus-key="${schedId}"] [data-testid="row"]`
      );
      if (row) {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return;
      }
      if (++tries < maxTries) setTimeout(step, 100);
    };
    setTimeout(step, 120);
  }

  function checkUrl() {
    if (location.pathname !== '/schedules') {
      lastHandled = null;
      return;
    }
    const id = new URLSearchParams(location.search).get('highlight');
    if (!id || id === lastHandled) return;
    lastHandled = id;
    openSchedule(id);
  }

  checkUrl();
  window.addEventListener('popstate', checkUrl);

  // SPA navigations via pushState/replaceState don't fire popstate — patch them.
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function () {
      const result = original.apply(this, arguments);
      setTimeout(checkUrl, 0);
      return result;
    };
  }
})();
