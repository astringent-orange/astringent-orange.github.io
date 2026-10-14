/* Screenshot-inspired code cards; independent of the Fluid theme package. */
(function() {
  'use strict';

  var paths = {
    copy: '<rect x="9" y="8" width="11" height="13" rx="2"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    fold: '<path d="m6 9 6 6 6-6"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + paths[name] + '</svg>';
  }
  function button(label, name) {
    var element = document.createElement('button');
    element.type = 'button';
    element.className = 'code-card-' + name;
    element.setAttribute('aria-label', label);
    element.title = label;
    element.innerHTML = icon(name);
    return element;
  }
  function sourceText(code) {
    var clone = code.cloneNode(true);
    // Hexo emits <br> between lines. textContent alone would join those lines.
    clone.querySelectorAll('br').forEach(function(br) { br.replaceWith('\n'); });
    clone.querySelectorAll('.code-widget, .line-numbers-rows').forEach(function(node) { node.remove(); });
    return clone.textContent;
  }
  function copyText(text) {
    function fallback() {
      var field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      var active = document.activeElement;
      document.body.appendChild(field);
      field.select();
      var copied;
      try { copied = document.execCommand('copy'); }
      finally {
        field.remove();
        if (active && active.focus) active.focus({ preventScroll: true });
      }
      if (!copied) throw new Error('Copy unavailable');
    }
    return Promise.resolve().then(function() {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).catch(fallback);
      }
      return fallback();
    });
  }
  function init() {
    document.querySelectorAll('.markdown-body pre code').forEach(function(code, index) {
      var pre = code.parentElement;
      if (pre.tagName !== 'PRE' || pre.closest('.code-card, .mermaid') ||
          code.matches('.mermaid, .language-mermaid, .lang-mermaid') ||
          /mermaid/i.test(pre.getAttribute('data-language') || '')) return;
      var body = pre.closest('figure.highlight') || pre;
      var languageClass = Array.from(code.classList).find(function(name) {
        return name !== 'hljs' && name !== 'line-numbers';
      });
      var language = pre.getAttribute('data-language') || languageClass || 'plaintext';
      language = language.replace(/^(language-|lang-)/, '');
      if (/^(none|text|txt|plain)$/i.test(language)) language = 'plaintext';
      var source = sourceText(code);
      body.querySelectorAll('.code-widget').forEach(function(widget) { widget.remove(); });

      var card = document.createElement('div');
      card.className = 'code-card';
      var toolbar = document.createElement('div');
      toolbar.className = 'code-card-toolbar';
      var dots = document.createElement('span');
      dots.className = 'code-card-dots';
      dots.setAttribute('aria-hidden', 'true');
      dots.innerHTML = '<i></i><i></i><i></i>';
      var label = document.createElement('span');
      label.className = 'code-card-language';
      label.textContent = language.toUpperCase();
      var copy = button('复制代码', 'copy');
      var fold = button('收起代码', 'fold');
      var status = document.createElement('span');
      status.className = 'code-card-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');

      body.parentNode.insertBefore(card, body);
      card.append(toolbar, body);
      toolbar.append(dots, label, status, copy, fold);
      body.id = body.id || 'code-card-body-' + index;
      body.classList.add('code-card-body');
      body.tabIndex = 0;
      body.setAttribute('aria-label', language.toUpperCase() + ' 代码');
      fold.setAttribute('aria-controls', body.id);
      fold.setAttribute('aria-expanded', 'true');
      fold.addEventListener('click', function() {
        var collapsed = fold.getAttribute('aria-expanded') === 'true';
        body.hidden = collapsed;
        card.classList.toggle('is-collapsed', collapsed);
        fold.setAttribute('aria-expanded', String(!collapsed));
        fold.setAttribute('aria-label', collapsed ? '展开代码' : '收起代码');
        fold.title = collapsed ? '展开代码' : '收起代码';
      });
      var resetTimer;
      copy.addEventListener('click', function() {
        copyText(source).then(function() {
          clearTimeout(resetTimer);
          copy.innerHTML = icon('check');
          copy.setAttribute('aria-label', '已复制');
          status.textContent = '已复制';
          resetTimer = setTimeout(function() {
            copy.innerHTML = icon('copy');
            copy.setAttribute('aria-label', '复制代码');
            status.textContent = '';
          }, 2000);
        }).catch(function() { status.textContent = '复制失败，请展开后手动选择'; });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
