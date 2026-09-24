/** Frontend Visual Lab · gallery engine */
let PAGES_DATA = (window.PORTFOLIO_ITEMS || []).map(item => ({ ...item }));
const CATEGORIES = window.PORTFOLIO_CATEGORIES || [];
let currentCategory = 'all';
let currentSearch = '';
let currentPreviewPage = null;
let previewReturnFocus = null;
let assistantHovering = false;
let assistantInWorks = false;
let assistantPoseTimer = null;
const ASSISTANT_COLLAPSED_KEY = 'yxy-portfolio-assistant-collapsed';
const ASSISTANT_POSITION_KEY = 'yxy-portfolio-assistant-position';
let assistantReaction = 0;
let renderedGalleryColumns = 0;

const CATEGORY_META = Object.fromEntries(CATEGORIES.map(category => [category.id, category]));
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const getCategoryItems = category => category === 'all' ? PAGES_DATA : PAGES_DATA.filter(item => item.category === category);
const getFilteredItems = () => {
  const query = currentSearch.trim().toLowerCase();
  return getCategoryItems(currentCategory).filter(item => !query || [item.titleCn, item.titleEn, item.description, item.categoryName, ...(item.tags || [])].join(' ').toLowerCase().includes(query));
};

async function loadPortfolioSettings() {
  if (!window.PortfolioSettings) return;
  try {
    const response = await fetch('admin/data/portfolio-settings.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('settings unavailable');
    const settings = await response.json();
    PAGES_DATA = window.PortfolioSettings.merge(PAGES_DATA, settings, CATEGORIES);
  } catch (error) {
    console.info('使用作品集默认展示配置。');
  }
}

async function initShowcase() {
  await loadPortfolioSettings();
  updateStats();
  renderCategoryCounts();
  renderMobileCategories();
  renderCards();
  setupEventListeners();
  setupPortfolioAssistant();
}

function updateStats() {
  const total = PAGES_DATA.length;
  const works = document.getElementById('worksCount');
  const heroWorks = document.getElementById('heroWorksCount');
  const heroFacts = document.getElementById('heroFactsCount');
  if (works) works.textContent = total;
  if (heroWorks) heroWorks.textContent = total;
  if (heroFacts) heroFacts.textContent = total;
}

function renderCategoryCounts() {
  document.querySelectorAll('[data-count-for]').forEach(element => {
    element.textContent = element.dataset.countFor === 'all' ? PAGES_DATA.length : getCategoryItems(element.dataset.countFor).length;
  });
}

function renderMobileCategories() {
  const container = document.getElementById('mobileCategoryNav');
  if (!container) return;
  container.innerHTML = CATEGORIES.map((category, index) => `<button class="mobile-category-button ${category.id === currentCategory ? 'active' : ''}" data-category="${category.id}">${String(index + 1).padStart(2, '0')} ${escapeHtml(category.label)}<b>${getCategoryItems(category.id).length}</b></button>`).join('');
}

function coverMarkup(item) {
  const image = item.thumbnail ? `<img class="card-img-preview" src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.titleCn)}" loading="lazy" onerror="this.closest('.card-thumbnail-wrap').classList.add('image-missing'); this.remove();">` : '';
  return `<div class="card-thumbnail-wrap theme-${escapeHtml(item.visualType || 'minimal')}" role="button" tabindex="0" aria-label="预览 ${escapeHtml(item.titleCn)}" onclick="openPreviewModal('${escapeHtml(item.id)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPreviewModal('${escapeHtml(item.id)}')}">${image}<div class="cover-shade"></div><div class="cover-fallback"><img class="cover-brand-mark" src="assets/images/brand/yxy-visual-logo.png" alt=""><span class="cover-number">${escapeHtml(item.id)}</span><span class="cover-label">${escapeHtml(item.categoryName)}</span></div><div class="card-overlay-hover"><span class="btn-hover-action primary">打开预览</span></div>${item.interactive ? '<span class="interactive-stamp">可交互</span>' : ''}</div>`;
}

function renderCards() {
  const grid = document.getElementById('cardsGrid');
  if (!grid) return;
  const filtered = getFilteredItems();
  renderedGalleryColumns = window.matchMedia('(min-width: 1660px)').matches ? 3 : window.matchMedia('(min-width: 681px)').matches ? 2 : 1;
  const packed = window.packGallery(filtered, renderedGalleryColumns);
  grid.innerHTML = filtered.length ? packed.map(({ item, span }) => renderCard(item, span)).join('') : `<div class="empty-state"><span>✦</span><strong>暂时没有匹配的作品</strong><p>换个关键词，或者清除当前分类筛选。</p><button onclick="clearFilters()">清除筛选</button></div>`;
  updateGalleryMeta(filtered.length);
}

function renderCard(item, span = 1) {
  const dependency = item.externalDependency ? `<span class="dependency-tag">${escapeHtml(item.externalDependency)}</span>` : '';
  const size = item.size === 'large' ? 'large' : 'small';
  return `<article class="showcase-card size-${size} gallery-span-${span}${size === 'small' && span > 1 ? ' is-expanded-small' : ''} theme-${escapeHtml(item.visualType || 'minimal')}" data-id="${escapeHtml(item.id)}">${coverMarkup(item)}<div class="card-body"><div class="card-info-main"><div class="card-meta-row"><span class="card-index-pill">#${escapeHtml(item.id)}</span><span class="card-category-pill">${escapeHtml(item.categoryName)}</span>${item.interactive ? '<span class="live-pill">可交互</span>' : ''}</div><h3 class="card-main-title">${escapeHtml(item.titleCn)}</h3><p class="card-main-desc">${escapeHtml(item.description)}</p><div class="card-tags-list">${(item.tags || []).map(tag => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join('')}${dependency}</div></div><div class="card-actions-row"><button class="btn-card-download" title="下载单页 HTML 源码" onclick="downloadSinglePage('${escapeHtml(item.sourcePath)}', '${escapeHtml(item.filename)}')">下载 HTML</button><div class="card-actions-right"><button class="btn-card-preview-ghost" onclick="openPreviewModal('${escapeHtml(item.id)}')">打开预览</button><a class="btn-card-open" title="打开作品" href="${escapeHtml(item.sourcePath)}" target="_blank" rel="noopener">打开作品</a></div></div></div></article>`;
}

function updateGalleryMeta(resultCount) {
  const meta = CATEGORY_META[currentCategory] || CATEGORY_META.all;
  const badge = document.getElementById('gallerySectionBadge');
  const desc = document.getElementById('gallerySectionDesc');
  if (badge) badge.textContent = `${resultCount} 件作品`;
  if (desc) desc.textContent = currentSearch ? `正在展示包含“${currentSearch}”的作品。` : currentCategory === 'all' ? '从完整界面到小小的交互实验，都能直接打开体验。' : meta.description;
}

function setCategory(category) {
  currentCategory = CATEGORY_META[category] ? category : 'all';
  document.querySelectorAll('.category-button, .mobile-category-button').forEach(button => button.classList.toggle('active', button.dataset.category === currentCategory));
  renderMobileCategories();
  renderCards();
  if (category !== 'all') document.getElementById('cardsGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearFilters() {
  currentSearch = '';
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  setCategory('all');
}

function setAssistantPose(pose) {
  const assistant = document.getElementById('portfolioAssistant');
  if (!assistant || assistant.classList.contains('is-collapsed')) return;
  const target = assistant.querySelector(`[data-assistant-pose="${pose}"]`);
  if (!target) return;
  assistant.dataset.pose = pose;
  assistant.querySelectorAll('[data-assistant-pose]').forEach(image => image.classList.toggle('is-active', image === target));
}

function setAssistantCollapsed(collapsed, persist = true) {
  const assistant = document.getElementById('portfolioAssistant');
  const toggle = document.getElementById('assistantToggle');
  if (!assistant || !toggle) return;
  assistant.classList.toggle('is-collapsed', collapsed);
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.setAttribute('aria-label', collapsed ? '展开看板娘' : '和看板娘打招呼，也可以拖动');
  if (collapsed) document.getElementById('assistantBubble')?.classList.remove('is-visible');
  if (assistant.classList.contains('is-positioned')) clampAssistantPosition();
  if (!collapsed) setAssistantPose(assistantInWorks ? 'stand' : 'idle');
  if (!persist) return;
  try { localStorage.setItem(ASSISTANT_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (error) { /* Storage can be unavailable in private contexts. */ }
}

function clampAssistantPosition(x, y) {
  const assistant = document.getElementById('portfolioAssistant');
  if (!assistant) return null;
  const rect = assistant.getBoundingClientRect();
  const point = {
    x: Math.max(8, Math.min(Number.isFinite(x) ? x : rect.left, Math.max(8, window.innerWidth - rect.width - 8))),
    y: Math.max(8, Math.min(Number.isFinite(y) ? y : rect.top, Math.max(8, window.innerHeight - rect.height - 8))),
  };
  assistant.style.setProperty('--assistant-x', `${point.x}px`);
  assistant.style.setProperty('--assistant-y', `${point.y}px`);
  assistant.classList.add('is-positioned');
  return point;
}

function dockAssistantPosition() {
  const assistant = document.getElementById('portfolioAssistant');
  if (!assistant) return null;
  const rect = assistant.getBoundingClientRect();
  const left = rect.left + rect.width / 2 < window.innerWidth / 2 ? 12 : window.innerWidth - rect.width - 12;
  return clampAssistantPosition(left, rect.top);
}

function reactToAssistant() {
  const assistant = document.getElementById('portfolioAssistant');
  const bubble = document.getElementById('assistantBubble');
  if (!assistant || !bubble) return;
  if (assistant.classList.contains('is-collapsed')) setAssistantCollapsed(false);
  const messages = ['你好呀，随便逛逛。', '点开图片可以看完整页面。', '这页是我自己做的。'];
  const pose = assistantReaction % 2 === 0 ? 'wave' : 'wink';
  bubble.textContent = messages[assistantReaction % messages.length];
  assistantReaction += 1;
  bubble.classList.add('is-visible');
  clearTimeout(assistantPoseTimer);
  setAssistantPose(pose);
  assistantPoseTimer = window.setTimeout(() => {
    bubble.classList.remove('is-visible');
    if (!assistantHovering) setAssistantPose(assistantInWorks ? 'stand' : 'idle');
  }, 2200);
}

function setupAssistantDrag(assistant, toggle) {
  let gesture = null;
  let suppressClick = false;
  toggle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = assistant.getBoundingClientRect();
    gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false };
    toggle.setPointerCapture(event.pointerId);
  });
  toggle.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
    gesture.moved = true;
    assistant.classList.add('is-dragging');
    document.getElementById('assistantBubble')?.classList.remove('is-visible');
    clampAssistantPosition(gesture.left + dx, gesture.top + dy);
  });
  const finish = event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (gesture.moved) {
      suppressClick = true;
      const point = dockAssistantPosition();
      try { localStorage.setItem(ASSISTANT_POSITION_KEY, JSON.stringify({ ...point, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight })); } catch (error) { /* Storage may be unavailable. */ }
      window.setTimeout(() => { suppressClick = false; }, 0);
    }
    assistant.classList.remove('is-dragging');
    gesture = null;
  };
  toggle.addEventListener('pointerup', finish);
  toggle.addEventListener('pointercancel', finish);
  toggle.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    reactToAssistant();
  });
  window.addEventListener('resize', () => {
    if (assistant.classList.contains('is-positioned')) {
      clampAssistantPosition();
      dockAssistantPosition();
    }
  });
}

function setupPortfolioAssistant() {
  const assistant = document.getElementById('portfolioAssistant');
  const toggle = document.getElementById('assistantToggle');
  const bubble = document.getElementById('assistantBubble');
  const minimize = document.getElementById('assistantMinimize');
  if (!assistant || !toggle) return;

  let storedPreference = null;
  try { storedPreference = localStorage.getItem(ASSISTANT_COLLAPSED_KEY); } catch (error) { /* Keep the responsive default. */ }
  const defaultCollapsed = window.matchMedia('(max-width: 2030px)').matches;
  setAssistantCollapsed(storedPreference === '1' ? true : storedPreference === '0' ? false : defaultCollapsed, false);
  try {
    const storedPosition = JSON.parse(localStorage.getItem(ASSISTANT_POSITION_KEY) || 'null');
    if (storedPosition && Number.isFinite(storedPosition.x) && Number.isFinite(storedPosition.y)
        && Number.isFinite(storedPosition.viewportWidth)
        && Math.abs(storedPosition.viewportWidth - window.innerWidth) < window.innerWidth * .25) {
      clampAssistantPosition(storedPosition.x, storedPosition.y);
      dockAssistantPosition();
    }
  } catch (error) { /* Ignore malformed or unavailable storage. */ }

  let failedImages = 0;
  assistant.querySelectorAll('img').forEach(image => image.addEventListener('error', () => {
    failedImages += 1;
    if (failedImages >= 4) assistant.hidden = true;
  }));

  setupAssistantDrag(assistant, toggle);
  minimize?.addEventListener('click', () => setAssistantCollapsed(true));
  assistant.addEventListener('pointerenter', () => {
    if (assistant.classList.contains('is-collapsed')) return;
    assistantHovering = true;
    clearTimeout(assistantPoseTimer);
    setAssistantPose('wink');
  });
  assistant.addEventListener('pointerleave', () => {
    assistantHovering = false;
    if (!bubble?.classList.contains('is-visible')) setAssistantPose(assistantInWorks ? 'stand' : 'idle');
  });

  const syncScrollPose = () => {
    assistantInWorks = window.scrollY > 320;
    if (!assistantHovering && !bubble?.classList.contains('is-visible')) setAssistantPose(assistantInWorks ? 'stand' : 'idle');
  };
  window.addEventListener('scroll', syncScrollPose, { passive: true });
  syncScrollPose();

  if (!assistant.classList.contains('is-collapsed')) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bubble?.classList.add('is-visible');
    setAssistantPose(reducedMotion ? 'idle' : 'wave');
    assistantPoseTimer = window.setTimeout(() => {
      bubble?.classList.remove('is-visible');
      if (!assistantHovering) setAssistantPose(assistantInWorks ? 'stand' : 'idle');
    }, reducedMotion ? 1200 : 2400);
  }
}

function setupEventListeners() {
  window.addEventListener('resize', () => {
    const columns = window.matchMedia('(min-width: 1660px)').matches ? 3 : window.matchMedia('(min-width: 681px)').matches ? 2 : 1;
    if (columns !== renderedGalleryColumns) renderCards();
  });
  document.querySelectorAll('.category-button').forEach(button => button.addEventListener('click', () => setCategory(button.dataset.category)));
  document.getElementById('mobileCategoryNav')?.addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (button) setCategory(button.dataset.category); });
  document.getElementById('searchInput')?.addEventListener('input', event => { currentSearch = event.target.value; renderCards(); });
  document.getElementById('previewModal')?.addEventListener('click', event => { if (event.target.id === 'previewModal') closePreviewModal(); });
  document.addEventListener('keydown', event => {
    const modal = document.getElementById('previewModal');
    if (!modal?.classList.contains('open')) return;
    if (event.key === 'Escape') return closePreviewModal();
    if (event.key === 'Tab') {
      const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}

function openPreviewModal(id) {
  const item = PAGES_DATA.find(page => page.id === id); if (!item) return;
  currentPreviewPage = item;
  previewReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const modal = document.getElementById('previewModal'); const iframe = document.getElementById('modalIframe'); const title = document.getElementById('modalTitle'); const external = document.getElementById('modalOpenExternal'); const notice = document.getElementById('modalNotice'); const fallback = document.getElementById('modalFallback');
  modal.hidden = false;
  title.textContent = `#${item.id} · ${item.titleCn}`; external.href = item.sourcePath; iframe.src = item.sourcePath; fallback.hidden = true;
  notice.hidden = !item.externalDependency; notice.textContent = item.externalDependency ? `此作品使用 ${item.externalDependency}，联网时体验更完整。` : '';
  iframe.onload = () => { fallback.hidden = true; };
  modal.classList.add('open'); document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => modal.querySelector('.btn-modal-close')?.focus());
}

function closePreviewModal() { const modal = document.getElementById('previewModal'); const iframe = document.getElementById('modalIframe'); if (!modal?.classList.contains('open')) return; modal.classList.remove('open'); modal.hidden = true; iframe.src = 'about:blank'; document.body.style.overflow = ''; currentPreviewPage = null; previewReturnFocus?.focus(); previewReturnFocus = null; }
function setViewport(size, button) { document.querySelectorAll('.vp-btn').forEach(item => item.classList.remove('active')); button.classList.add('active'); document.getElementById('modalIframe').className = `device-frame vp-${size}`; }

async function downloadSinglePage(path, filename) {
  try { const html = await fetch(path).then(response => { if (!response.ok) throw new Error('source unavailable'); return response.text(); }); const blob = new Blob([html], { type: 'text/html;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href); showToast(`已开始下载 ${filename}`); } catch (error) { console.error(error); showToast('下载失败，请使用“打开 ↗”后另存为。'); }
}
function downloadModalCurrentPage() { if (currentPreviewPage) downloadSinglePage(currentPreviewPage.sourcePath, currentPreviewPage.filename); }

async function downloadAllAsZip() {
  if (typeof JSZip === 'undefined') return showToast('打包组件加载中，请稍等...');
  showToast(`正在整理 ${PAGES_DATA.length} 个 HTML 入口`); const zip = new JSZip(); const sourceFolder = zip.folder('source');
  try {
    const staticFiles = ['index.html', 'assets/css/common.css', 'assets/css/showcase.css', 'assets/js/showcase.js', 'assets/js/portfolio-data.js'];
    for (const file of staticFiles) { const content = await fetch(file).then(response => response.text()); zip.file(file, content); }
    for (const item of PAGES_DATA) { const content = await fetch(item.sourcePath).then(response => response.text()); sourceFolder.file(`${item.id}-${item.filename}`, content); }
    const blob = await zip.generateAsync({ type: 'blob' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'frontend-visual-lab-html-entry.zip'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href); showToast(`已打包 ${PAGES_DATA.length} 个 HTML 入口。`);
  } catch (error) { console.error(error); showToast('打包失败，请检查页面路径或网络依赖。'); }
}

function showToast(message) { let toast = document.getElementById('showcaseToast'); if (!toast) { toast = document.createElement('div'); toast.id = 'showcaseToast'; toast.className = 'toast-msg'; document.body.appendChild(toast); } toast.textContent = message; toast.style.display = 'block'; clearTimeout(toast._timer); toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3600); }

document.addEventListener('DOMContentLoaded', initShowcase);
