/*!
 * Annotated Prototype Builder - Annotation Engine v2.0.0
 * 右侧抽屉式标注引擎：按页面区块分组、全页连续编号、保存、收起/展开、双向联动。
 *
 * 挂载约定:
 *   多页面: <section data-page="login" data-page-title="登录页">...</section>
 *   区块:   <section data-annotate-section="表单区">...</section>（任意容器加此属性即可）
 *   标注:   <button data-annotate="提交按钮" data-annotate-type="action" data-annotate-detail="...">提交</button>
 *   切页:   原型导航调用 window.__annoGotoPage('pageId')，或直接改 [data-page] 的 display
 */
(function () {
  'use strict';

  var TYPE_COLORS = {
    action:     { border: '#2563EB', bg: '#EFF6FF' },
    input:      { border: '#7C3AED', bg: '#F5F3FF' },
    link:       { border: '#0891B2', bg: '#ECFEFF' },
    navigation: { border: '#EA580C', bg: '#FFF7ED' },
    feedback:   { border: '#DC2626', bg: '#FEF2F2' },
    data:       { border: '#16A34A', bg: '#F0FDF4' }
  };
  var DEFAULT_TYPE = 'action';
  var HIGHLIGHT_MS = 1400;
  var DRAWER_WIDTH = 320;

  function typeColor(t) {
    return TYPE_COLORS[t] || TYPE_COLORS[DEFAULT_TYPE];
  }

  /* ---------- 全局状态 ---------- */
  var state = {
    drawerCollapsed: false,
    dotsVisible: true,
    picking: false,
    currentPageId: null,
    currentPageTitle: '',
    cardList: [],
    targetByKey: {},
    keySeq: 0,
    _editingOldText: null
  };

  function nextKey() { state.keySeq++; return 'k' + state.keySeq; }

  /* ---------- 浮层（页面元素序号圆点容器） ---------- */
  function ensureLayer() {
    var layer = document.getElementById('__anno_layer__');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = '__anno_layer__';
      layer.className = '__anno-layer';
      document.body.appendChild(layer);
    }
    return layer;
  }

  /* ---------- 抽屉 ---------- */
  function ensureDrawer() {
    var drawer = document.getElementById('__anno_drawer__');
    if (drawer) return drawer;
    drawer = document.createElement('div');
    drawer.id = '__anno_drawer__';
    drawer.className = '__anno-drawer';
    drawer.innerHTML =
      '<div class="__anno-drawer-header">' +
        '<div class="__anno-drawer-title-wrap">' +
          '<span class="__anno-drawer-page"></span>' +
          '<span class="__anno-drawer-count"></span>' +
        '</div>' +
      '</div>' +
      '<div class="__anno-drawer-body"></div>' +
      '<div class="__anno-drawer-footer">' +
        '<button type="button" class="__anno-btn __anno-btn-add" title="手动添加标注">添加标注</button>' +
        '<button type="button" class="__anno-btn __anno-btn-save" title="保存标注">保存</button>' +
        '<button type="button" class="__anno-btn __anno-btn-toggle-dots" title="隐藏/显示页面元素上的标注点">隐藏圆点</button>' +
        '<button type="button" class="__anno-btn __anno-btn-collapse" title="收起抽屉">收起</button>' +
      '</div>';
    document.body.appendChild(drawer);
    drawer.querySelector('.__anno-btn-add').addEventListener('click', startPicking);
    drawer.querySelector('.__anno-btn-save').addEventListener('click', saveAll);
    drawer.querySelector('.__anno-btn-toggle-dots').addEventListener('click', toggleDots);
    drawer.querySelector('.__anno-btn-collapse').addEventListener('click', collapseDrawer);
    return drawer;
  }

  /* ---------- 展开按钮（收起后显示） ---------- */
  function ensureExpandBtn() {
    var btn = document.getElementById('__anno_expand_btn__');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = '__anno_expand_btn__';
    btn.type = 'button';
    btn.className = '__anno-expand-btn';
    btn.textContent = '展开标注';
    btn.title = '展开标注抽屉';
    btn.addEventListener('click', expandDrawer);
    document.body.appendChild(btn);
    return btn;
  }

  function collapseDrawer() {
    ensureDrawer().classList.add('__anno-drawer-collapsed');
    ensureExpandBtn().style.display = 'flex';
    state.drawerCollapsed = true;
  }

  function expandDrawer() {
    ensureDrawer().classList.remove('__anno-drawer-collapsed');
    ensureExpandBtn().style.display = 'none';
    state.drawerCollapsed = false;
  }

  /* ---------- 标注点显隐切换 ---------- */
  function toggleDots() {
    state.dotsVisible = !state.dotsVisible;
    var layer = document.getElementById('__anno_layer__');
    if (layer) layer.style.display = state.dotsVisible ? '' : 'none';
    var btn = ensureDrawer().querySelector('.__anno-btn-toggle-dots');
    if (btn) btn.textContent = state.dotsVisible ? '隐藏圆点' : '显示圆点';
  }

  /* ---------- 手动添加标注（拾取模式） ---------- */
  var pickTarget = null;

  function startPicking() {
    state.picking = true;
    var btn = ensureDrawer().querySelector('.__anno-btn-add');
    if (btn) { btn.classList.add('__anno-btn-active'); btn.textContent = '点击页面元素'; }
    document.addEventListener('mouseover', pickHover, true);
    document.addEventListener('mouseout', pickUnhover, true);
    document.addEventListener('click', pickClick, true);
  }

  function stopPicking() {
    state.picking = false;
    var btn = ensureDrawer().querySelector('.__anno-btn-add');
    if (btn) { btn.classList.remove('__anno-btn-active'); btn.textContent = '添加标注'; }
    document.removeEventListener('mouseover', pickHover, true);
    document.removeEventListener('mouseout', pickUnhover, true);
    document.removeEventListener('click', pickClick, true);
    Array.prototype.forEach.call(document.querySelectorAll('.__anno-pick-hover'), function (el) {
      el.classList.remove('__anno-pick-hover');
    });
  }

  function pickHover(e) {
    if (!state.picking) return;
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    if (el.closest('#__anno_drawer__, #__anno_layer__, #__anno_expand_btn__, #__anno_modal__')) return;
    if (el.classList.contains('__anno-pick-hover')) return;
    Array.prototype.forEach.call(document.querySelectorAll('.__anno-pick-hover'), function (x) {
      x.classList.remove('__anno-pick-hover');
    });
    el.classList.add('__anno-pick-hover');
  }

  function pickUnhover(e) {
    var el = e.target;
    if (el && el.classList) el.classList.remove('__anno-pick-hover');
  }

  function pickClick(e) {
    if (!state.picking) return;
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    if (el.closest('#__anno_drawer__, #__anno_layer__, #__anno_expand_btn__, #__anno_modal__')) return;
    e.preventDefault();
    e.stopPropagation();
    stopPicking();
    openAnnoForm(el);
  }

  /* ---------- 手动添加标注（模态表单） ---------- */
  function ensureAnnoModal() {
    var modal = document.getElementById('__anno_modal__');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = '__anno_modal__';
    modal.className = '__anno-modal';
    modal.innerHTML =
      '<div class="__anno-modal-box">' +
        '<div class="__anno-modal-title-bar">添加标注</div>' +
        '<label class="__anno-modal-field">主标题 <input type="text" class="__anno-modal-title" maxlength="12" placeholder="≤12字"></label>' +
        '<label class="__anno-modal-field">类型 <select class="__anno-modal-type">' +
          '<option value="">自动推断</option>' +
          '<option value="action">action 按钮/操作</option>' +
          '<option value="input">input 输入/选择</option>' +
          '<option value="link">link 链接</option>' +
          '<option value="navigation">navigation 导航</option>' +
          '<option value="feedback">feedback 提示/反馈</option>' +
          '<option value="data">data 数据展示</option>' +
        '</select></label>' +
        '<label class="__anno-modal-field">详情 <textarea class="__anno-modal-detail" rows="3" placeholder="≤300字，可用结构化格式"></textarea></label>' +
        '<label class="__anno-modal-field">区块（可选） <input type="text" class="__anno-modal-section" placeholder="归入某区块，留空自动归组"></label>' +
        '<div class="__anno-modal-actions">' +
          '<button type="button" class="__anno-btn __anno-modal-cancel">取消</button>' +
          '<button type="button" class="__anno-btn __anno-btn-save-anno">保存</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.__anno-modal-cancel').addEventListener('click', closeAnnoModal);
    modal.querySelector('.__anno-btn-save-anno').addEventListener('click', function () {
      var input = modal.querySelector('.__anno-modal-title');
      var typeSel = modal.querySelector('.__anno-modal-type');
      var detailTa = modal.querySelector('.__anno-modal-detail');
      var sectionInput = modal.querySelector('.__anno-modal-section');
      var title = input.value.trim();
      if (!title) { input.focus(); return; }
      if (!pickTarget) { closeAnnoModal(); return; }
      pickTarget.setAttribute('data-annotate', title.substring(0, 12));
      var type = typeSel.value;
      if (type) pickTarget.setAttribute('data-annotate-type', type);
      var detail = detailTa.value.trim();
      if (detail) pickTarget.setAttribute('data-annotate-detail', detail);
      else pickTarget.removeAttribute('data-annotate-detail');
      var secName = sectionInput.value.trim();
      if (secName) ensureSectionFor(pickTarget, secName);
      closeAnnoModal();
      renderForCurrentPage();
    });
    return modal;
  }

  function openAnnoForm(el) {
    var modal = ensureAnnoModal();
    modal.style.display = 'flex';
    modal.querySelector('.__anno-modal-title').value = (el.textContent || '').trim().substring(0, 12);
    modal.querySelector('.__anno-modal-type').value = '';
    modal.querySelector('.__anno-modal-detail').value = '';
    modal.querySelector('.__anno-modal-section').value = '';
    pickTarget = el;
    setTimeout(function () { modal.querySelector('.__anno-modal-title').focus(); }, 0);
  }

  function closeAnnoModal() {
    var modal = document.getElementById('__anno_modal__');
    if (modal) modal.style.display = 'none';
    pickTarget = null;
  }

  function ensureSectionFor(el, secName) {
    var p = el.parentElement;
    while (p && p !== document.body) {
      if (p.hasAttribute && p.hasAttribute('data-annotate-section')) {
        var n = (p.getAttribute('data-annotate-section') || '').trim();
        if (n === secName) return;
        break;
      }
      p = p.parentElement;
    }
    var wrap = document.createElement('div');
    wrap.setAttribute('data-annotate-section', secName);
    wrap.style.display = 'contents';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
  }

  /* ---------- 页面识别 ---------- */
  function getPages() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-page]'));
  }

  function isVisiblePage(pageEl) {
    if (!pageEl) return false;
    if (pageEl.hasAttribute('hidden')) return false;
    var cs = window.getComputedStyle(pageEl);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    return true;
  }

  function getCurrentPage() {
    var pages = getPages();
    if (!pages.length) return null;
    for (var i = 0; i < pages.length; i++) {
      if (isVisiblePage(pages[i])) return pages[i];
    }
    return pages[0];
  }

  function setupPageSwitcher() {
    var pages = getPages();
    if (pages.length && window.MutationObserver) {
      var observer = new MutationObserver(function () {
        var cur = getCurrentPage();
        var curId = cur ? (cur.getAttribute('data-page') || '__noid__') : null;
        if (curId !== state.currentPageId) {
          renderForCurrentPage();
        }
      });
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden'],
        subtree: true
      });
    }
    window.__annoGotoPage = function (pageId) {
      var ps = getPages();
      if (!ps.length) { renderForCurrentPage(); return; }
      ps.forEach(function (p) {
        if (p.getAttribute('data-page') === pageId) {
          p.style.display = '';
          p.removeAttribute('hidden');
        } else {
          p.style.display = 'none';
        }
      });
      renderForCurrentPage();
    };
  }

  /* ---------- 区块扫描 ---------- */
  function scanSections(pageEl) {
    var sections = [];
    var others = [];
    var globalSection = null;
    if (!pageEl) return { sections: sections, others: others, globalSection: globalSection };

    var sectionEls = Array.prototype.slice.call(pageEl.querySelectorAll('[data-annotate-section]'));
    var sectionsByName = {};
    sectionEls.forEach(function (sc) {
      var name = (sc.getAttribute('data-annotate-section') || '未命名区块').trim();
      if (name === '全局') {
        if (!globalSection) globalSection = { sectionName: '全局', targets: [] };
        return;
      }
      if (!sectionsByName[name]) {
        sectionsByName[name] = { sectionName: name, targets: [] };
        sections.push(sectionsByName[name]);
      }
    });

    var allTargets = Array.prototype.slice.call(pageEl.querySelectorAll('[data-annotate]'));
    allTargets.forEach(function (t) {
      var parent = t.parentElement;
      var foundName = null;
      while (parent && parent !== document.body) {
        if (parent.hasAttribute && parent.hasAttribute('data-annotate-section') && pageEl.contains(parent)) {
          foundName = (parent.getAttribute('data-annotate-section') || '未命名区块').trim();
          break;
        }
        parent = parent.parentElement;
      }
      var entry = { el: t };
      if (foundName === '全局' && globalSection) {
        globalSection.targets.push(entry);
      } else if (foundName && sectionsByName[foundName]) {
        sectionsByName[foundName].targets.push(entry);
      } else {
        others.push(entry);
      }
    });

    return { sections: sections, others: others, globalSection: globalSection };
  }

  /* ---------- 渲染当前页 ---------- */
  function renderForCurrentPage() {
    var page = getCurrentPage();
    var drawer = ensureDrawer();
    var body = drawer.querySelector('.__anno-drawer-body');
    body.innerHTML = '';

    var oldLayer = document.getElementById('__anno_layer__');
    if (oldLayer) oldLayer.innerHTML = '';
    Array.prototype.forEach.call(document.querySelectorAll('.__anno-target'), function (el) {
      el.classList.remove('__anno-target');
    });

    state.cardList = [];
    state.targetByKey = {};

    if (!page) {
      page = document.body;
      state.currentPageId = '__single__';
      state.currentPageTitle = (document.title || '当前页').substring(0, 24);
    } else {
      state.currentPageId = page.getAttribute('data-page') || '__noid__';
      state.currentPageTitle = page.getAttribute('data-page-title') || page.getAttribute('data-page') || '当前页';
    }

    var scan = scanSections(page);
    var allCards = [];
    var displayIndex = 0;

    function buildSection(sec, isOther) {
      if (!sec.targets.length) return null;
      var groupEl = document.createElement('div');
      groupEl.className = '__anno-section-group';
      var title = document.createElement('div');
      title.className = '__anno-section-title' + (isOther ? ' __anno-section-other' : '');
      title.textContent = sec.sectionName + ' (' + sec.targets.length + ')';
      groupEl.appendChild(title);
      var list = document.createElement('div');
      list.className = '__anno-section-list';
      sec.targets.forEach(function (entry) {
        displayIndex++;
        var card = renderCard(entry.el, displayIndex);
        list.appendChild(card.cardEl);
        allCards.push(card);
      });
      groupEl.appendChild(list);
      return groupEl;
    }

    scan.sections.forEach(function (sec) {
      var g = buildSection(sec, false);
      if (g) body.appendChild(g);
    });
    if (scan.others.length) {
      var otherSec = { sectionName: '其他', targets: scan.others };
      var og = buildSection(otherSec, true);
      if (og) body.appendChild(og);
    }
    if (scan.globalSection && scan.globalSection.targets.length) {
      var gg = buildSection(scan.globalSection, false);
      if (gg) body.appendChild(gg);
    }

    state.cardList = allCards;

    drawer.querySelector('.__anno-drawer-page').textContent = state.currentPageTitle;
    drawer.querySelector('.__anno-drawer-count').textContent = ' · 共 ' + allCards.length + ' 处标注';

    if (!allCards.length) {
      var empty = document.createElement('div');
      empty.className = '__anno-empty';
      empty.textContent = '当前页无可标注元素';
      body.appendChild(empty);
    }

    repositionAllDots();
  }

  /* ---------- 渲染单条卡片 ---------- */
  function renderCard(target, index) {
    var type = target.getAttribute('data-annotate-type') || DEFAULT_TYPE;
    var color = typeColor(type);
    var title = target.getAttribute('data-annotate') || '';
    var detail = target.getAttribute('data-annotate-detail') || '';

    var cardEl = document.createElement('div');
    cardEl.className = '__anno-card';
    cardEl.setAttribute('data-anno-type', type);
    cardEl.style.borderLeftColor = color.border;

    var dot = document.createElement('span');
    dot.className = '__anno-card-dot';
    dot.style.backgroundColor = color.border;
    dot.textContent = index;
    cardEl.appendChild(dot);

    var textWrap = document.createElement('div');
    textWrap.className = '__anno-card-text';

    var titleNode = document.createElement('div');
    titleNode.className = '__anno-card-title';
    titleNode.textContent = title;
    makeEditable(titleNode, 'data-annotate', target);
    textWrap.appendChild(titleNode);

    var detailNode = null;
    if (detail) {
      detailNode = document.createElement('div');
      detailNode.className = '__anno-card-detail';
      detailNode.textContent = detail;
      makeEditable(detailNode, 'data-annotate-detail', target);
      textWrap.appendChild(detailNode);
    }
    cardEl.appendChild(textWrap);

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = '__anno-card-del';
    delBtn.textContent = '×';
    delBtn.title = '删除此标注';
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.confirm('确定删除该标注？删除后元素上的标注属性将被移除。')) {
        target.removeAttribute('data-annotate');
        target.removeAttribute('data-annotate-type');
        target.removeAttribute('data-annotate-detail');
        renderForCurrentPage();
      }
    });
    cardEl.appendChild(delBtn);

    var key = nextKey();
    var entry = {
      key: key, cardEl: cardEl, target: target, index: index,
      titleNode: titleNode, detailNode: detailNode, type: type, dot: null
    };
    state.targetByKey[key] = entry;

    entry.dot = renderTargetDot(target, index, color, key);

    cardEl.addEventListener('click', function (e) {
      if (e.target.isContentEditable) return;
      if (e.target.classList.contains('__anno-card-dot')) return;
      if (e.target.classList.contains('__anno-card-title') || e.target.classList.contains('__anno-card-detail')) return;
      scrollAndHighlightTarget(target, color.border);
    });

    return entry;
  }

  /* ---------- 页面元素序号圆点 ---------- */
  function renderTargetDot(target, index, color, key) {
    target.classList.add('__anno-target');
    var dot = document.createElement('span');
    dot.className = '__anno-target-dot';
    dot.style.backgroundColor = color.border;
    dot.textContent = index;
    dot.setAttribute('data-anno-key', key);
    dot.title = '点击在抽屉中定位';
    ensureLayer().appendChild(dot);
    positionDot(dot, target);
    dot.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      highlightCard(key);
    });
    return dot;
  }

  function positionDot(dot, target) {
    var rect = target.getBoundingClientRect();
    var layerRect = ensureLayer().getBoundingClientRect();
    dot.style.left = (rect.right - layerRect.left - 18) + 'px';
    dot.style.top = (rect.top - layerRect.top - 6) + 'px';
  }

  function repositionAllDots() {
    Object.keys(state.targetByKey).forEach(function (key) {
      var entry = state.targetByKey[key];
      if (entry.dot && entry.target) {
        positionDot(entry.dot, entry.target);
      }
    });
  }

  function scrollAndHighlightTarget(target, borderColor) {
    if (!target) return;
    try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    target.style.outline = '2px solid ' + borderColor;
    target.style.outlineOffset = '2px';
    setTimeout(function () {
      target.style.outline = '';
      target.style.outlineOffset = '';
    }, HIGHLIGHT_MS);
  }

  function scrollCardIntoView(card) {
    var body = ensureDrawer().querySelector('.__anno-drawer-body');
    if (!body) return;
    var cardRect = card.getBoundingClientRect();
    var bodyRect = body.getBoundingClientRect();
    var target = body.scrollTop + (cardRect.top - bodyRect.top) - (bodyRect.height / 2) + (cardRect.height / 2);
    target = Math.max(0, target);
    try {
      body.scrollTo({ top: target, behavior: 'smooth' });
    } catch (e) {
      body.scrollTop = target;
    }
  }

  function highlightCard(key) {
    var entry = state.targetByKey[key];
    if (!entry) return;
    var card = entry.cardEl;
    card.classList.add('__anno-card-active');
    if (state.drawerCollapsed) {
      expandDrawer();
      /* 等待抽屉滑入动画结束（0.25s）再定位卡片 */
      setTimeout(function () { scrollCardIntoView(card); }, 300);
    } else {
      scrollCardIntoView(card);
    }
    setTimeout(function () { card.classList.remove('__anno-card-active'); }, HIGHLIGHT_MS);
  }

  /* ---------- 编辑态（双击进入） ---------- */
  function makeEditable(node, attrName, targetEl) {
    node.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      node.contentEditable = 'true';
      node.focus();
      var range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    node.addEventListener('blur', function () {
      node.contentEditable = 'false';
      node.removeAttribute('style');
      targetEl.setAttribute(attrName, node.textContent.trim());
    });
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        node.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        node.textContent = targetEl.getAttribute(attrName) || '';
        node.blur();
      }
    });
  }

  /* ---------- 保存（回写 + 下载） ---------- */
  function saveAll() {
    state.cardList.forEach(function (entry) {
      if (entry.titleNode) {
        entry.target.setAttribute('data-annotate', entry.titleNode.textContent.trim());
      }
      if (entry.detailNode) {
        var v = entry.detailNode.textContent.trim();
        if (v) {
          entry.target.setAttribute('data-annotate-detail', v);
        } else {
          entry.target.removeAttribute('data-annotate-detail');
        }
      }
    });

    var clone = document.documentElement.cloneNode(true);
    var toRemove = ['#__anno_drawer__', '#__anno_expand_btn__', '#__anno_layer__', '#__anno_modal__'];
    toRemove.forEach(function (sel) {
      var el = clone.querySelector(sel);
      if (el) el.parentNode.removeChild(el);
    });
    Array.prototype.forEach.call(clone.querySelectorAll('[data-annotate]'), function (el) {
      el.classList.remove('__anno-target');
      el.removeAttribute('style');
    });
    Array.prototype.forEach.call(clone.querySelectorAll('[contenteditable]'), function (el) {
      el.removeAttribute('contenteditable');
      el.classList.remove('__anno-text-editing');
    });

    var html = '<!DOCTYPE html>\n' + clone.outerHTML;
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var name = (location.pathname.split('/').pop() || 'prototype').replace(/\.html?$/i, '');
    a.href = url;
    a.download = name + '-annotated.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

    var saveBtn = ensureDrawer().querySelector('.__anno-btn-save');
    var orig = saveBtn.textContent;
    saveBtn.textContent = '已保存';
    saveBtn.classList.add('__anno-btn-saved');
    setTimeout(function () {
      saveBtn.textContent = orig;
      saveBtn.classList.remove('__anno-btn-saved');
    }, 1500);
  }

  /* ---------- 页面文字就地编辑（全部文字可修改） ---------- */
  function setupPageTextEditing() {
    document.addEventListener('dblclick', function (e) {
      var el = e.target;
      if (!el || el.nodeType !== 1) return;
      if (el.closest('#__anno_drawer__, #__anno_layer__, #__anno_expand_btn__')) return;
      var tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') return;
      if (!el.textContent || !el.textContent.trim()) return;
      if (el.isContentEditable) return;
      state._editingOldText = el.textContent;
      el.contentEditable = 'true';
      el.classList.add('__anno-text-editing');
      el.focus();
      var range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      e.preventDefault();
      e.stopPropagation();
    }, true);

    document.addEventListener('focusout', function (e) {
      var el = e.target;
      if (el && el.isContentEditable && !el.closest('#__anno_drawer__')) {
        var newText = el.textContent.trim();
        var oldText = state._editingOldText || '';
        el.contentEditable = 'false';
        el.classList.remove('__anno-text-editing');
        /* 同步标注：主标题与元素原文字相同时跟随新文字（同名才跟随，业务命名不覆盖） */
        if (newText && oldText && newText !== oldText) {
          var anno = el.getAttribute('data-annotate');
          if (anno && anno.trim() === oldText.trim()) {
            el.setAttribute('data-annotate', newText.substring(0, 12));
            state.cardList.forEach(function (entry) {
              if (entry.target === el && entry.titleNode) {
                entry.titleNode.textContent = newText.substring(0, 12);
              }
            });
          }
        }
        state._editingOldText = null;
      }
    }, true);
  }

  /* ---------- 初始化 ---------- */
  function init() {
    ensureLayer();
    ensureDrawer();
    ensureExpandBtn().style.display = 'none';
    setupPageSwitcher();
    setupPageTextEditing();
    renderForCurrentPage();

    var timer = null;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(repositionAllDots, 80);
    });
    window.addEventListener('scroll', function () {
      repositionAllDots();
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
