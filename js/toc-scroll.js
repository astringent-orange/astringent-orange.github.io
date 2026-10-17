/* Keep the active TOC entry visible without pinning it to the top on every scroll. */
(function() {
  'use strict';

  function init() {
    var toc = document.getElementById('toc-body');
    var article = document.querySelector('.markdown-body');
    if (!toc || !article || toc.dataset.scrollSyncReady === 'true') return;
    toc.dataset.scrollSyncReady = 'true';
    var frame = null;
    var lastActive = null;

    function schedule() {
      if (frame !== null) return;
      frame = requestAnimationFrame(function() {
        frame = null;
        var active = toc.querySelector('.tocbot-active-link');
        if (!active || active === lastActive || toc.clientHeight === 0) return;
        lastActive = active;

        // Respect manually collapsed branches: keep their visible parent in view.
        var visibleLink = active;
        for (var parent = active.parentElement; parent && parent !== toc; parent = parent.parentElement) {
          if (parent.classList.contains('tocbot-is-collapsed')) {
            visibleLink = parent.parentElement.querySelector(':scope > .tocbot-link') || visibleLink;
          }
        }
        var bounds = toc.getBoundingClientRect();
        var item = visibleLink.getBoundingClientRect();
        var padding = 12;
        var delta = 0;
        if (item.top < bounds.top + padding) delta = item.top - bounds.top - padding;
        else if (item.bottom > bounds.bottom - padding) delta = item.bottom - bounds.bottom + padding;
        if (delta !== 0) {
          toc.scrollTop = Math.max(0, Math.min(toc.scrollHeight - toc.clientHeight, toc.scrollTop + delta));
        }
      });
    }

    // Tocbot changes the active class as the document scrolls. No polling, no rebuild.
    new MutationObserver(schedule).observe(toc, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['class']
    });
    window.addEventListener('resize', function() { lastActive = null; schedule(); });

    // Images, MathJax and folded code may change article height without scrolling.
    // Tocbot calculates positions live, so notify its existing listener rather than
    // refreshing/rebuilding the TOC (which would lose its scroll/fold state).
    var layoutFrame = null;
    function layoutChanged() {
      if (layoutFrame !== null) return;
      layoutFrame = requestAnimationFrame(function() {
        layoutFrame = null;
        document.dispatchEvent(new Event('scroll'));
      });
    }
    if ('ResizeObserver' in window) new ResizeObserver(layoutChanged).observe(article);
    article.addEventListener('load', layoutChanged, true);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
