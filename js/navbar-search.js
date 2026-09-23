/**
 * 从 flexblock 主题迁移而来：导航栏内联搜索 + /search/ 全文搜索页。
 * 数据源为 scripts/search-json.js 生成的 /search.json。
 */
(function() {
  'use strict';

  var SEARCH_INDEX_URL = '/search.json';
  var SEARCH_PAGE_URL = '/search/';
  var NAV_LIMIT = 6;
  var PAGE_SIZE = 10;

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function(char) {
      var entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return entityMap[char];
    });
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightText(text, keyword) {
    if (!keyword) return escapeHTML(text);
    var safeKeyword = escapeRegExp(keyword.trim());
    if (!safeKeyword) return escapeHTML(text);
    return escapeHTML(text).replace(new RegExp('(' + safeKeyword + ')', 'ig'), '<mark>$1</mark>');
  }

  function buildSnippet(item, keyword, offset, length) {
    var source = item.excerpt || item.content || '';
    if (!source) return '';

    var normalizedKeyword = keyword.trim().toLowerCase();
    var sourceLower = source.toLowerCase();
    var matchIndex = normalizedKeyword ? sourceLower.indexOf(normalizedKeyword) : -1;
    var start = matchIndex >= 0 ? Math.max(0, matchIndex - offset) : 0;
    var snippet = source.slice(start, start + length).trim();

    return start > 0 ? '...' + snippet : snippet;
  }

  function formatMeta(item) {
    return []
      .concat(item.categories || [])
      .concat(item.tags || [])
      .slice(0, 3)
      .join(' / ');
  }

  var indexPromise = null;

  function loadSearchIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = fetch(SEARCH_INDEX_URL)
      .then(function(response) {
        if (!response.ok) throw new Error('Failed to load search index');
        return response.json();
      })
      .then(function(data) {
        return Array.isArray(data) ? data : [];
      })
      .catch(function() {
        indexPromise = null;
        return [];
      });
    return indexPromise;
  }

  function matchItems(keyword, index) {
    var trimmed = keyword.trim();
    if (!trimmed) return [];
    var normalized = trimmed.toLowerCase();

    return index.filter(function(item) {
      var haystack = [
        item.title,
        item.excerpt,
        item.content,
        (item.tags || []).join(' '),
        (item.categories || []).join(' ')
      ].join(' ').toLowerCase();
      return haystack.includes(normalized);
    }).sort(function(a, b) {
      var aTitle = (a.title || '').toLowerCase().includes(normalized) ? 1 : 0;
      var bTitle = (b.title || '').toLowerCase().includes(normalized) ? 1 : 0;
      return bTitle - aTitle;
    });
  }

  /* ==================== 导航栏内联搜索 ==================== */

  function initNavbarSearch() {
    var searchBtn = document.getElementById('search-btn');
    if (!searchBtn) return;

    var toggle = searchBtn.querySelector('a.nav-link');
    if (!toggle) return;

    // 记录图标按钮原始宽度，输入框收起时按此占位，图标尺寸与其他导航项保持一致
    searchBtn.style.setProperty('--nb-icon-w', toggle.offsetWidth + 'px');
    searchBtn.classList.add('nb-search');

    var form = document.createElement('form');
    form.className = 'nb-search-form';
    form.setAttribute('role', 'search');
    form.innerHTML = '<input class="nb-search-input" type="search" name="q" placeholder="搜索文章..." autocomplete="off" />';

    var results = document.createElement('div');
    results.className = 'nb-search-results';
    results.hidden = true;
    results.innerHTML = [
      '<div class="nb-search-state">输入关键词开始搜索</div>',
      '<div class="nb-search-list"></div>'
    ].join('');

    searchBtn.appendChild(form);
    searchBtn.appendChild(results);

    // UI 就绪后再接管按钮，中途失败仍可退回弹窗搜索
    toggle.removeAttribute('data-toggle');
    toggle.removeAttribute('data-target');

    var input = form.querySelector('.nb-search-input');
    var state = results.querySelector('.nb-search-state');
    var list = results.querySelector('.nb-search-list');

    function openSearch() {
      searchBtn.classList.add('is-open');
      results.hidden = false;
      requestAnimationFrame(function() { input.focus(); });
    }

    function closeSearch() {
      searchBtn.classList.remove('is-open');
      searchBtn.classList.remove('show-results');
      results.hidden = true;
    }

    function render(items, keyword) {
      list.innerHTML = '';
      searchBtn.classList.add('show-results');

      if (!keyword.trim()) {
        state.textContent = '输入关键词开始搜索';
        state.hidden = false;
        return;
      }

      if (!items.length) {
        state.textContent = '未找到相关文章';
        state.hidden = false;
        return;
      }

      state.hidden = true;
      list.innerHTML = items.map(function(item) {
        var snippet = buildSnippet(item, keyword, 24, 88);
        var meta = formatMeta(item);
        return [
          '<a class="nb-search-result-item" href="/' + escapeHTML(item.path) + '">',
          '<span class="nb-search-result-title">' + highlightText(item.title || 'Untitled', keyword) + '</span>',
          snippet ? '<span class="nb-search-result-snippet">' + highlightText(snippet, keyword) + '</span>' : '',
          meta ? '<span class="nb-search-result-meta">' + escapeHTML(meta) + '</span>' : '',
          '</a>'
        ].join('');
      }).join('');
    }

    function performSearch(keyword) {
      loadSearchIndex().then(function(index) {
        render(matchItems(keyword, index).slice(0, NAV_LIMIT), keyword);
      });
    }

    toggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (searchBtn.classList.contains('is-open')) {
        closeSearch();
      } else {
        openSearch();
        if (input.value.trim()) performSearch(input.value);
      }
    });

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var keyword = input.value.trim();
      window.location.href = keyword
        ? SEARCH_PAGE_URL + '?q=' + encodeURIComponent(keyword)
        : SEARCH_PAGE_URL;
    });

    form.addEventListener('click', function(e) { e.stopPropagation(); });
    results.addEventListener('click', function(e) { e.stopPropagation(); });

    input.addEventListener('input', function() {
      performSearch(input.value);
    });

    document.addEventListener('click', function(e) {
      if (!searchBtn.contains(e.target)) closeSearch();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeSearch();
    });
  }

  /* ==================== /search/ 全文搜索页 ==================== */

  function initSearchPage() {
    var container = document.getElementById('nb-search-page');
    if (!container) return;

    var form = container.querySelector('.nb-search-page-form');
    var input = container.querySelector('.nb-search-page-input');
    var summary = container.querySelector('.nb-search-page-summary');
    var results = container.querySelector('.nb-search-page-results');
    var pagination = container.querySelector('.nb-search-page-pagination');
    var params = new URLSearchParams(window.location.search);

    function renderEmpty(message) {
      pagination.hidden = true;
      results.innerHTML = '<div class="nb-search-page-empty">' + escapeHTML(message) + '</div>';
    }

    function renderPagination(totalItems, currentPage, keyword) {
      var totalPages = Math.ceil(totalItems / PAGE_SIZE);
      if (totalPages <= 1) {
        pagination.hidden = true;
        pagination.innerHTML = '';
        return;
      }

      var links = [];
      var addLink = function(label, pageNumber, className) {
        var url = '?q=' + encodeURIComponent(keyword) + '&page=' + pageNumber;
        var classes = className ? ' class="' + className + '"' : '';
        links.push('<a href="' + url + '" data-page="' + pageNumber + '"' + classes + '>' + label + '</a>');
      };

      if (currentPage > 1) addLink('上一页', currentPage - 1, 'extend prev');

      for (var pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        if (pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - currentPage) <= 1) {
          if (pageNumber === currentPage) {
            links.push('<span class="page-number current">' + pageNumber + '</span>');
          } else {
            addLink(String(pageNumber), pageNumber, 'page-number');
          }
        } else if (
          (pageNumber === 2 && currentPage > 3) ||
          (pageNumber === totalPages - 1 && currentPage < totalPages - 2)
        ) {
          links.push('<span class="space">...</span>');
        }
      }

      if (currentPage < totalPages) addLink('下一页', currentPage + 1, 'extend next');

      pagination.hidden = false;
      pagination.innerHTML = links.join('');
    }

    function render(items, keyword, currentPage) {
      if (!keyword.trim()) {
        summary.textContent = '输入关键词开始搜索。';
        renderEmpty('搜索结果将显示在这里。');
        return;
      }

      summary.textContent = '共找到 ' + items.length + ' 篇相关文章';

      if (!items.length) {
        renderEmpty('未找到匹配的文章。');
        return;
      }

      var totalPages = Math.ceil(items.length / PAGE_SIZE);
      var safePage = Math.min(Math.max(currentPage, 1), totalPages);
      var pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

      results.innerHTML = pageItems.map(function(item) {
        var snippet = buildSnippet(item, keyword, 42, 168);
        var meta = formatMeta(item);
        return [
          '<a class="nb-search-page-item" href="/' + escapeHTML(item.path) + '">',
          '<h3 class="nb-search-page-title">' + highlightText(item.title || 'Untitled', keyword) + '</h3>',
          item.date ? '<div class="nb-search-page-meta">发布于 ' + escapeHTML(item.date) + (meta ? ' · ' + escapeHTML(meta) : '') + '</div>'
                    : (meta ? '<div class="nb-search-page-meta">' + escapeHTML(meta) + '</div>' : ''),
          snippet ? '<p class="nb-search-page-snippet">' + highlightText(snippet, keyword) + '</p>' : '',
          '</a>'
        ].join('');
      }).join('');

      renderPagination(items.length, safePage, keyword);
    }

    function performSearch(keyword, pageNumber) {
      loadSearchIndex().then(function(index) {
        render(matchItems(keyword, index), keyword, pageNumber || 1);
      });
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var keyword = input.value.trim();
      var nextUrl = keyword ? '?q=' + encodeURIComponent(keyword) + '&page=1' : window.location.pathname;
      window.history.replaceState({}, '', nextUrl);
      performSearch(keyword, 1);
    });

    input.addEventListener('input', function() {
      performSearch(input.value, 1);
    });

    pagination.addEventListener('click', function(e) {
      var target = e.target.closest('[data-page]');
      if (!target) return;

      e.preventDefault();
      var keyword = input.value.trim();
      var nextPage = Number(target.dataset.page) || 1;
      window.history.replaceState({}, '', '?q=' + encodeURIComponent(keyword) + '&page=' + nextPage);
      performSearch(keyword, nextPage);
      var top = container.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    });

    var initialKeyword = params.get('q') || '';
    var initialPage = Number(params.get('page') || '1') || 1;
    input.value = initialKeyword;
    performSearch(initialKeyword, initialPage);
  }

  /* ==================== 移动端菜单入口 ==================== */

  function initMobileSearch() {
    var mobileBtn = document.getElementById('mobile-search-btn');
    if (!mobileBtn) return;

    var link = mobileBtn.querySelector('a');
    if (!link) return;

    // 移动端改为跳转全文搜索页，不再打开弹窗
    link.removeAttribute('data-toggle');
    link.removeAttribute('data-target');
    link.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = SEARCH_PAGE_URL;
    });
  }

  function boot() {
    initNavbarSearch();
    initMobileSearch();
    initSearchPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
