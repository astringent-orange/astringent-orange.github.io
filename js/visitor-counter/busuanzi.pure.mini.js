/* Fluid statistics adapter. Only the production host may report a visit. */
(function () {
  'use strict';
  if (location.hostname !== 'mian221.top') return;
  if (window.__visitorCounterStarted) return;
  window.__visitorCounterStarted = true;
  var fields = ['site_uv', 'page_pv'];
  function display(values) {
    fields.forEach(function (field) {
      var container = document.getElementById('busuanzi_container_' + field);
      var value = document.getElementById('busuanzi_value_' + field);
      if (!container || !value) return;
      value.textContent = values ? String(values[field]) : '统计暂不可用';
      container.style.display = 'inline';
    });
  }
  var cookieKey = 'vercount_uv_' + location.host.replace(/[^a-zA-Z0-9_-]/g, '_');
  var isNew = !document.cookie.split('; ').some(function (part) { return part === cookieKey + '=1'; });
  if (isNew) document.cookie = cookieKey + '=1; path=/; max-age=31536000; samesite=lax';
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, 5000);
  var page = new URL(location.href);
  page.search = '';
  page.hash = '';
  fetch('https://events.vercount.one/api/v2/log', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: page.href, isNewUv: isNew }), signal: controller.signal
  }).then(function (response) {
    if (!response.ok) throw new Error('Counter HTTP ' + response.status);
    return response.json();
  }).then(function (result) {
    if (!result || result.status !== 'success' || !result.data ||
        !fields.every(function (field) { return Number.isSafeInteger(result.data[field]) && result.data[field] >= 0; })) {
      throw new Error('Invalid counter response');
    }
    return fetch('/stats-history.json', { cache: 'no-cache' }).then(function (historyResponse) {
      if (historyResponse.status === 404) return null;
      if (!historyResponse.ok) throw new Error('History unavailable');
      return historyResponse.json();
    }).then(function (history) {
      if (!history) { display(result.data); return; }
      if (history.version !== 1 || !history.site) throw new Error('Invalid history');
      var pathname;
      try { pathname = decodeURIComponent(location.pathname); } catch (_) { throw new Error('Invalid path'); }
      pathname = pathname.replace(/\/(?:index(?:\.html?)?)?$/i, '') || '/';
      var pageBaseline = history.pages[pathname];
      var site = history.site;
      if (![site.old, site.checkpoint].every(function (n) { return Number.isSafeInteger(n) && n >= 0; })) throw new Error('Invalid site baseline');
      var resultValues = { site_uv: result.data.site_uv < site.checkpoint ? '待核对' : site.old + result.data.site_uv - site.checkpoint, page_pv: result.data.page_pv };
      if (document.getElementById('busuanzi_value_page_pv')) {
        if (!pageBaseline || ![pageBaseline.old, pageBaseline.checkpoint].every(function (n) { return Number.isSafeInteger(n) && n >= 0; }) || result.data.page_pv < pageBaseline.checkpoint) resultValues.page_pv = '待核对';
        else resultValues.page_pv = pageBaseline.old + result.data.page_pv - pageBaseline.checkpoint;
      }
      var container = document.getElementById('busuanzi_container_site_uv');
      if (container) Array.from(container.childNodes).forEach(function (node) {
        if (node.nodeType === 3 && node.textContent.includes('访客')) node.textContent = '累计访客：';
      });
      display(resultValues);
    });
  }).catch(function () { display(null); }).finally(function () { clearTimeout(timeout); });
})();
