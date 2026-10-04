/* ========= 搜索功能（基于 per-version 预构建索引） ========= */
/*
 * 依赖：config.js, utils.js, book.js (loadChaptersForBook), verse.js (getVerseUrl, loadVersesMulti)
 *
 * 索引文件格式（OSS 上）：
 *   /json/_global/search/{version}.json
 *   内容形如：
 *   [
 *     { "b": 1, "c": 1, "v": 1, "t": "Thus the heavens..." },
 *     ...
 *   ]
 *
 * 如果索引不存在，回退到实时逐章加载。
 *
 * 搜索结果点击跳转：只导航到目标书卷+章节，绝不修改版本选择。
 * 版本只能通过地球（🌐）菜单修改。
 */

(function () {
    "use strict";

    var state = window.BibleFlow.state;
    var data = window.BibleFlow.data;
    var cfg = window.BibleFlow.config;
    var utils = window.BibleFlow.utils;

    const searchIndexCache = {};
    const searchIndexLoaded = {};

    /** 搜索后更新译本下拉菜单的可用状态（无结果的译本 disabled） */
    function updateFilterVersionAvailability(hits) {
        const filterVersion = document.getElementById('filter-version');
        if (!filterVersion) return;
        const hitVersionKeys = new Set(hits.map(h => h.versionKey));
        const opts = filterVersion.querySelectorAll('option');
        opts.forEach(opt => {
            if (opt.value === 'all') return; // 混合选项不受影响
            opt.disabled = !hitVersionKeys.has(opt.value);
            if (opt.disabled && opt.textContent.indexOf('（无结果）') === -1) {
                opt.textContent = opt.textContent.replace(/^📌\s*/, '') + '（无结果）';
            } else if (!opt.disabled) {
                // 恢复原始标签
                const ver = utils.getVersionConfig(opt.value);
                if (ver) {
                    opt.textContent = (opt.value === state.primaryVersion ? '📌 ' : '') + ver.label;
                }
            }
        });
    }

    /* ===== 筛选状态 ===== */
    var searchFilters = {
        scope: 'all',       // 'all' | 'current' | 具体书卷 ID
        version: 'all',     // 'all' | 具体版本 key（如 'zh_sigao'）
        sort: 'interleave', // 'interleave' | 'grouped'
    };

    /**
     * 获取当前要搜索的版本列表（根据筛选条件）
     */
    function getSearchVersions() {
        const list = [];
        const seen = new Set();
        const add = (k) => {
            if (!k || seen.has(k)) return;
            const ver = utils.getVersionConfig(k);
            if (!ver || !ver.available) return;
            seen.add(k);
            list.push(ver);
        };

        if (searchFilters.version === 'all_versions') {
            // 全部译本：所有已收录的版本
            var allVer = window.BibleFlow.data.allVersions || cfg.versions || [];
            for (var i = 0; i < allVer.length; i++) {
                add(allVer[i].key);
            }
        } else if (searchFilters.version === 'all') {
            // 混合：所有已启用的版本
            add(state.primaryVersion);
            (state.secondaryVersions || []).forEach(add);
        } else {
            // 指定某个版本
            add(searchFilters.version);
        }
        return list;
    }

    /** 获取要搜索的书卷列表（根据筛选条件） */
    function getSearchBooks() {
        var bookFilter = searchFilters.scope;
        // 旧约/新约筛选
        if (bookFilter && bookFilter.indexOf('canon_') === 0) {
            var canonKey = bookFilter.replace('canon_', '');
            var cat = (data.bookCategories || []).find(function(c) { return c.key === canonKey; });
            if (cat && cat.book_ids) {
                var books = data.allBooks || [];
                return cat.book_ids.map(function(id) { return books.find(function(b) { return b.id === id; }); }).filter(function(b) { return b; });
            }
            return [];
        }
        // 如果指定了具体书卷
        if (bookFilter && bookFilter !== 'all' && bookFilter !== 'current') {
            var bookId = parseInt(bookFilter, 10);
            var book = (data.allBooks || []).find(function(b) { return b.id === bookId; });
            return book ? [book] : [];
        }
        // 如果限定当前书卷
        if (bookFilter === 'current' && state.book) {
            var book = (data.allBooks || []).find(function(b) { return b.id === state.book; });
            return book ? [book] : [];
        }
        // 全部书卷
        return data.allBooks || [];
    }

    /**
     * 加载指定版本的搜索索引
     */
    async function loadSearchIndex(versionKey) {
        if (searchIndexLoaded[versionKey]) {
            return searchIndexCache[versionKey] || null;
        }

        const url = `${cfg.searchIndexBase}/${versionKey}.json?v=${cfg.appVersion}`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.warn(`搜索索引不存在: ${url}，将回退到实时搜索`);
                searchIndexLoaded[versionKey] = true;
                searchIndexCache[versionKey] = null;
                return null;
            }
            const json = await res.json();
            searchIndexLoaded[versionKey] = true;
            searchIndexCache[versionKey] = json;
            console.log(`✅ 搜索索引已加载: ${versionKey} (${json.length} 条)`);
            return json;
        } catch (e) {
            console.warn(`搜索索引加载失败: ${versionKey}`, e.message);
            searchIndexLoaded[versionKey] = true;
            searchIndexCache[versionKey] = null;
            return null;
        }
    }

    /**
     * 实时搜索回退（索引不存在时使用）
     */
    const realtimeCache = {};

    async function ensureChapterLoadedRT(versionKey, bookId, chapter) {
        if (!realtimeCache[versionKey]) realtimeCache[versionKey] = {};
        const verCache = realtimeCache[versionKey];
        if (!verCache[bookId]) verCache[bookId] = {};
        if (verCache[bookId][chapter]) return verCache[bookId][chapter];

        const url = utils.getVerseUrl(versionKey, bookId, chapter);
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const json = await res.json();
            verCache[bookId][chapter] = json.verses || [];
            return verCache[bookId][chapter];
        } catch (e) {
            return null;
        }
    }

    /**
     * 实时搜索某个版本（回退方案）
     */
    async function searchVersionRealtime(ver, targets, norm) {
        const hits = [];
        const books = getSearchBooks();

        for (const book of books) {
            const maxCh = (book.chapter_count) || 50;
            for (let ch = 1; ch <= maxCh; ch++) {
                const verses = await ensureChapterLoadedRT(ver.key, book.id, ch);
                if (!verses) continue;
                for (const v of verses) {
                    const text = v.text || "";
                    const normText = norm(text);
                    // AND 匹配：所有关键词都必须出现
                    const matchAll = targets.every(t => normText.includes(t));
                    if (matchAll) {
                        hits.push({
                            versionKey: ver.key,
                            versionLabel: ver.label,
                            bookId: book.id,
                            bookName: utils.getBookDisplayName(book),
                            chapter: ch,
                            verse: v.verse_id || v.verse || "",
                            text: text
                        });
                    }
                }
            }
        }
        return hits;
    }

    /**
     * 搜索核心
     */
    async function doSearch(keyword) {
        const kw = keyword.trim();
        const container = document.getElementById('search-results');
        if (!kw) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = '<div class="search-loading">搜索中…</div>';

        const versions = getSearchVersions();
        if (versions.length === 0) {
            container.innerHTML = `<div class="search-empty">请先启用至少一个可用版本</div>`;
            return;
        }

        // 按空格拆分关键词，AND 匹配（所有词都必须出现）
        const keywords = kw.split(/\s+/).filter(Boolean);
        const targets = keywords.map(k => utils.normalizeText(k));

        const norm = s => utils.normalizeText(s);

        // 并行加载所有版本的索引
        const indexPromises = versions.map(async ver => {
            const index = await loadSearchIndex(ver.key);
            return { ver, index };
        });

        const results = await Promise.all(indexPromises);

        // 判断哪些版本有索引、哪些需要实时搜索
        const hasIndexVersions = results.filter(r => r.index && r.index.length > 0);
        const noIndexVersions = results.filter(r => !r.index || r.index.length === 0);

        const allHits = [];
        const searchBooks = getSearchBooks();
        const searchBookIds = new Set(searchBooks.map(b => b.id));

        // 使用索引快速搜索
        hasIndexVersions.forEach(({ ver, index }) => {
            const isProt = utils.isProtestantVersion(ver.key);
            index.forEach(entry => {
                // 搜索索引里的 book ID 可能是 Protestant ID，需要映射到 Catholic ID
                let catholicId = entry.b;
                if (isProt) {
                    const match = (data.allBooks || []).find(b => b.prot_id === entry.b);
                    if (match) catholicId = match.id;
                }

                // 书卷过滤
                if (searchBookIds.size > 0 && !searchBookIds.has(catholicId)) return;

                const text = entry.t || "";
                const normText = norm(text);
                // AND 匹配：所有关键词都必须出现
                const matchAll = targets.every(t => normText.includes(t));
                if (matchAll) {
                    const book = (data.allBooks || []).find(b => b.id === catholicId);
                    allHits.push({
                        versionKey: ver.key,
                        versionLabel: ver.label,
                        bookId: catholicId,
                        bookName: book ? utils.getBookDisplayName(book) : `卷${catholicId}`,
                        chapter: entry.c,
                        verse: entry.v,
                        text: text
                    });
                }
            });
        });

        // 没有索引的版本 → 实时搜索
        for (const { ver } of noIndexVersions) {
            if (container.isConnected) {
                container.innerHTML = `<div class="search-loading">正在搜索 ${ver.label}（实时）…</div>`;
            }
            const rtHits = await searchVersionRealtime(ver, targets, norm);
            allHits.push(...rtHits);
        }

        // 渲染结果
        if (!container.isConnected) return;

        if (allHits.length === 0) {
            container.innerHTML = `<div class="search-empty">未找到「${utils.escapeHtml(kw)}」</div>`;
            return;
        }

        // 排序
        const sortMode = searchFilters.sort;
        // 构建版本优先级映射（按版本设置里的顺序）
        const versionOrder = {};
        versionOrder[state.primaryVersion] = 0;
        (state.secondaryVersions || []).forEach((key, idx) => {
            versionOrder[key] = idx + 1;
        });

        allHits.sort((a, b) => {
            if (sortMode === 'grouped') {
                // 按译本分组：先按版本顺序，再按书卷/章节/节号
                const aOrder = versionOrder[a.versionKey] !== undefined ? versionOrder[a.versionKey] : 999;
                const bOrder = versionOrder[b.versionKey] !== undefined ? versionOrder[b.versionKey] : 999;
                if (aOrder !== bOrder) return aOrder - bOrder;
            }
            // 先按书卷 ID 排序
            if (a.bookId !== b.bookId) return a.bookId - b.bookId;
            // 再按章节
            if (a.chapter !== b.chapter) return a.chapter - b.chapter;
            // 再按节号
            if (a.verse !== b.verse) return a.verse - b.verse;
            // 同节经文，按版本设置顺序排序（interleave 模式）
            const aOrder = versionOrder[a.versionKey] !== undefined ? versionOrder[a.versionKey] : 999;
            const bOrder = versionOrder[b.versionKey] !== undefined ? versionOrder[b.versionKey] : 999;
            return aOrder - bOrder;
        });

        container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'search-result-header';
        let scopeLabel = '全部书卷';
        if (searchFilters.scope === 'current') {
            const currentBook = (data.allBooks || []).find(b => b.id === state.book);
            scopeLabel = currentBook ? utils.getBookDisplayName(currentBook) : '当前书卷';
        } else if (searchFilters.scope && searchFilters.scope !== 'all') {
            const bookId = parseInt(searchFilters.scope, 10);
            const book = (data.allBooks || []).find(b => b.id === bookId);
            scopeLabel = book ? utils.getBookDisplayName(book) : '指定书卷';
        }
        let verLabel = '混合译本';
        if (searchFilters.version !== 'all') {
            const ver = utils.getVersionConfig(searchFilters.version);
            verLabel = ver ? ver.label : searchFilters.version;
        }
        header.textContent = `找到 ${allHits.length} 节（${scopeLabel} · ${verLabel}）`;
        container.appendChild(header);

        const ul = document.createElement('ul');
        ul.className = 'search-result-list';
        container.appendChild(ul);

        // 高亮关键词（支持多词高亮）
        function highlight(text, kwArr) {
            const escaped = utils.escapeHtml(text);
            let result = escaped;
            kwArr.forEach(keyword => {
                let kwEscaped = utils.escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                result = result.replace(new RegExp(kwEscaped, 'gi'), m => `<b>${m}</b>`);
                if (!result.includes('<b>')) {
                    const normText = utils.normalizeText(text);
                    const normKw = utils.normalizeText(keyword);
                    if (normKw) {
                        const idx = normText.indexOf(normKw);
                        if (idx >= 0) {
                            const original = text.substring(idx, idx + normKw.length);
                            const origEscaped = utils.escapeHtml(original).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            result = result.replace(new RegExp(origEscaped, 'gi'), m => `<b>${m}</b>`);
                        }
                    }
                }
            });
            return result;
        }

        // 分页渲染
        let rendered = 0;
        const PAGE = 200;

        function renderNextBatch() {
            if (rendered >= allHits.length) return;
            const slice = allHits.slice(rendered, rendered + PAGE);

            slice.forEach(r => {
                const li = document.createElement('li');
                li.className = 'search-result-item';

                const refLine = document.createElement('span');
                refLine.className = 'search-result-ref';
                refLine.textContent = `${r.bookName} ${r.chapter}:${r.verse}`;

                const tag = document.createElement('span');
                tag.className = 'search-result-tag';
                tag.textContent = r.versionLabel;
                refLine.appendChild(tag);

                const textLine = document.createElement('span');
                textLine.className = 'search-result-text';
                textLine.innerHTML = highlight(r.text, keywords);

                li.appendChild(refLine);
                li.appendChild(textLine);

                li.onclick = () => {
                    jumpToVerse(r.bookId, r.chapter, r.verse, r.versionKey);
                };
                ul.appendChild(li);
            });

            rendered += slice.length;

            const oldMore = ul.querySelector('.load-more');
            if (oldMore) oldMore.remove();

            if (rendered < allHits.length) {
                const more = document.createElement('li');
                more.textContent = '加载更多…';
                more.className = 'load-more';
                more.onclick = renderNextBatch;
                ul.appendChild(more);
            }

            // 第一批渲染后，更新译本下拉菜单的可用状态
            if (rendered >= slice.length) {
                updateFilterVersionAvailability(allHits);
            }
        }

        renderNextBatch();
    }

    /* ========= 跳转到经文（不修改版本选择）========= */
    function jumpToVerse(bookId, chapter, verse, versionKey) {
        // 跳转经文，保留搜索结果
        const input = document.getElementById('search-input');
        if (input) input.blur();

        // ✅ 如果点击的译本未启用，自动启用为次要译本
        var hitVersionKey = versionKey;
        var isVersionEnabled = hitVersionKey === state.primaryVersion ||
            (state.secondaryVersions || []).indexOf(hitVersionKey) !== -1;
        if (!isVersionEnabled) {
            state.secondaryVersions.push(hitVersionKey);
            if (window.showToast) window.showToast('已启用 ' + (utils.getVersionConfig(hitVersionKey) || {}).label + ' 译本');
        }

        // ✅ 只用当前已选的主要经文版本去加载目标章节
        state.book = bookId;
        state.chapter = chapter;

        window.loadChaptersForBook(bookId, chapter).then(() => {
            // 更新书卷列表高亮
            document.querySelectorAll(".book-item").forEach(el => {
                el.classList.toggle("active", Number(el.dataset.bookId) === bookId);
            });

            window.loadVersesMulti(() => {
                requestAnimationFrame(() => {
                    const blocks = document.querySelectorAll('.verse-block');
                    if (blocks.length === 0) {
                        console.warn('跳转：经文未渲染');
                        return;
                    }

                    let found = false;
                    blocks.forEach(block => {
                        const num = block.querySelector('.verse-num');
                        if (num && Number(num.textContent) === verse) {
                            found = true;
                            block.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            block.classList.add('verse-highlight');
                            setTimeout(() => {
                                block.classList.remove('verse-highlight');
                            }, 2200);
                        }
                    });

                    // 没找到精确 verse → 至少滚到章节顶部
                    if (!found && blocks[0]) {
                        blocks[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });

            window.updateAudio();
        }).catch(e => {
            console.error('跳转加载失败:', e);
        });
    }

    /* ========= 侧边栏控制 ========= */
    function initSearchSidebar() {
        const toggle = document.getElementById('search-toggle');
        const sidebar = document.getElementById('search-sidebar');
        const overlay = document.getElementById('search-overlay');
        const closeBtn = document.getElementById('search-close');
        const input = document.getElementById('search-input');
        const results = document.getElementById('search-results');

        let timer = null;

        // ===== 自定义下拉菜单逻辑 =====
        let activeDropdown = null;

        function openDropdown(dropdown) {
            closeAllDropdowns();
            const popup = dropdown.querySelector('.filter-popup');
            const trigger = dropdown.querySelector('.filter-trigger');
            if (!popup || !trigger) return;
            popup.hidden = false;
            trigger.classList.add('active');
            activeDropdown = dropdown;
        }

        function closeAllDropdowns() {
            document.querySelectorAll('.filter-dropdown').forEach(dd => {
                const popup = dd.querySelector('.filter-popup');
                const trigger = dd.querySelector('.filter-trigger');
                if (popup) popup.hidden = true;
                if (trigger) trigger.classList.remove('active');
            });
            activeDropdown = null;
        }

        function selectOption(dropdown, optionEl) {
            if (optionEl.classList.contains('disabled')) return;
            const filterKey = dropdown.querySelector('.filter-trigger').dataset.filter;
            const value = optionEl.dataset.value;
            const text = optionEl.textContent;

            // 更新选中状态
            dropdown.querySelectorAll('.filter-option').forEach(opt => opt.classList.remove('selected'));
            optionEl.classList.add('selected');

            // 更新按钮文字
            const triggerText = dropdown.querySelector('.filter-trigger-text');
            if (triggerText) triggerText.textContent = text;

            // 更新筛选状态
            if (filterKey === 'scope') searchFilters.scope = value;
            else if (filterKey === 'version') searchFilters.version = value;
            else if (filterKey === 'sort') searchFilters.sort = value;
            else if (filterKey === 'book') searchFilters.scope = value;

            closeAllDropdowns();

            // 触发重新搜索
            if (input && input.value.trim()) {
                clearTimeout(timer);
                timer = setTimeout(() => doSearch(input.value.trim()), 300);
            }
        }

        // 绑定所有下拉菜单事件
        document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
            const trigger = dropdown.querySelector('.filter-trigger');
            const popup = dropdown.querySelector('.filter-popup');

            if (trigger) {
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (activeDropdown === dropdown) {
                        closeAllDropdowns();
                    } else {
                        openDropdown(dropdown);
                    }
                });
            }

            if (popup) {
                popup.addEventListener('click', (e) => {
                    const option = e.target.closest('.filter-option');
                    if (option) selectOption(dropdown, option);
                });
            }
        });

        // 点击外部关闭所有下拉
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-dropdown')) {
                closeAllDropdowns();
            }
        });

        // ESC 关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && activeDropdown) {
                closeAllDropdowns();
            }
        });

        // ===== 初始化译本选项 =====
        function initFilterVersions() {
            var container = document.querySelector('#filter-version-dropdown .filter-popup');
            if (!container) return;

            // 保存当前选中的值
            var currentSelected = container.querySelector('.filter-option.selected');
            var currentValue = currentSelected ? currentSelected.dataset.value : 'all';

            container.innerHTML = '';

            // 1. 全部已启用译本
            var allOpt = document.createElement('div');
            allOpt.className = 'filter-option' + (currentValue === 'all' ? ' selected' : '');
            allOpt.dataset.value = 'all';
            allOpt.textContent = '全部已启用译本';
            container.appendChild(allOpt);

            // 2. 全部译本（包括未启用）
            var allVerOpt = document.createElement('div');
            allVerOpt.className = 'filter-option' + (currentValue === 'all_versions' ? ' selected' : '');
            allVerOpt.dataset.value = 'all_versions';
            allVerOpt.textContent = '全部译本';
            container.appendChild(allVerOpt);

            // 分隔线
            var sep1 = document.createElement('div');
            sep1.style.cssText = 'height:1px;background:var(--line-2);margin:6px 0;';
            container.appendChild(sep1);

            // 分组标题
            var title = document.createElement('div');
            title.className = 'filter-group-title';
            title.textContent = '仅在以下译本中搜索';
            container.appendChild(title);

            // 列出所有译本（从 data.allVersions 或 cfg.versions）
            var allVersions = window.BibleFlow.data.allVersions || cfg.versions || [];
            var primaryEnabled = state.primaryVersion;
            var secondaryEnabled = state.secondaryVersions || [];

            for (var i = 0; i < allVersions.length; i++) {
                var ver = allVersions[i];
                if (!ver || !ver.key) continue;

                var isEnabled = ver.key === primaryEnabled || secondaryEnabled.indexOf(ver.key) !== -1;
                var opt = document.createElement('div');
                opt.className = 'filter-option' + (currentValue === ver.key ? ' selected' : '');
                if (!isEnabled) opt.classList.add('disabled');
                opt.dataset.value = ver.key;
                opt.textContent = ver.label + (isEnabled ? '' : '（未启用）');
                container.appendChild(opt);
            }

            // 更新按钮显示文字
            var triggerText = document.querySelector('#filter-version-dropdown .filter-trigger-text');
            if (triggerText) {
                if (currentValue === 'all') {
                    triggerText.textContent = '全部已启用译本';
                } else if (currentValue === 'all_versions') {
                    triggerText.textContent = '全部译本';
                } else {
                    var ver = utils.getVersionConfig(currentValue);
                    triggerText.textContent = ver ? ver.label : currentValue;
                }
            }
        }

        // ===== 初始化书卷选项（合并范围和书卷） =====
        function initFilterBooks() {
            const container = document.querySelector('#filter-book-dropdown .filter-popup');
            if (!container) return;

            // 保存当前选中的值
            const currentSelected = container.querySelector('.filter-option.selected');
            const currentValue = currentSelected ? currentSelected.dataset.value : 'all';

            container.innerHTML = '';

            // 1. 全部书卷（默认选项）
            const allOpt = document.createElement('div');
            allOpt.className = 'filter-option' + (currentValue === 'all' ? ' selected' : '');
            allOpt.dataset.value = 'all';
            allOpt.textContent = '全部书卷';
            container.appendChild(allOpt);

            // 2. 当前书卷
            if (state.book) {
                const currentBook = (data.allBooks || []).find(b => b.id === state.book);
                if (currentBook) {
                    const opt = document.createElement('div');
                    opt.className = 'filter-option' + (currentValue === 'current' ? ' selected' : '');
                    opt.dataset.value = 'current';
                    opt.textContent = '当前书卷：' + utils.getBookDisplayName(currentBook);
                    container.appendChild(opt);
                }
            }

            // 3. 旧约 / 新约 筛选
            var categories = data.bookCategories || [];
            var field = window.BibleFlow.utils.getBookNameField();
            for (var ci = 0; ci < categories.length; ci++) {
                var cat = categories[ci];
                var catName = cat[field] ? (cat[field].name || cat[field]) : (cat.name || '');
                if (catName && cat.book_ids && cat.book_ids.length > 0) {
                    var opt = document.createElement('div');
                    opt.className = 'filter-option' + (currentValue === 'canon_' + cat.key ? ' selected' : '');
                    opt.dataset.value = 'canon_' + cat.key;
                    opt.textContent = catName;
                    container.appendChild(opt);
                }
            }

            // 分隔线
            const sep1 = document.createElement('div');
            sep1.style.cssText = 'height:1px;background:var(--line-2);margin:6px 0;';
            container.appendChild(sep1);

            // 4. 所有书卷平铺
            var books = data.allBooks || [];
            for (var bi = 0; bi < books.length; bi++) {
                var book = books[bi];
                var isSelected = currentValue === book.id.toString() || parseInt(currentValue, 10) === book.id;
                var opt = document.createElement('div');
                opt.className = 'filter-option' + (isSelected ? ' selected' : '');
                opt.dataset.value = book.id;
                opt.textContent = utils.getBookDisplayName(book);
                container.appendChild(opt);
            }

            // 更新按钮显示文字
            const triggerText = document.querySelector('#filter-book-dropdown .filter-trigger-text');
            if (triggerText) {
                if (currentValue === 'all') {
                    triggerText.textContent = '全部书卷';
                } else if (currentValue === 'current') {
                    const currentBook = books.find(b => b.id === state.book);
                    triggerText.textContent = currentBook ? '当前：' + utils.getBookDisplayName(currentBook) : '当前书卷';
                } else if (typeof currentValue === 'string' && currentValue.indexOf('canon_') === 0) {
                    var canonKey = currentValue.replace('canon_', '');
                    var cat = categories.find(function(c) { return c.key === canonKey; });
                    var field = window.BibleFlow.utils.getBookNameField();
                    var catName = cat ? (cat[field] ? (cat[field].name || cat[field]) : (cat.name || '')) : '';
                    triggerText.textContent = catName || currentValue;
                } else {
                    const bookId = parseInt(currentValue, 10);
                    const book = books.find(b => b.id === bookId);
                    triggerText.textContent = book ? utils.getBookDisplayName(book) : '全部书卷';
                }
            }
        }

        // 搜索后更新译本选项的可用状态
        function updateFilterVersionAvailability(hits) {
            const container = document.querySelector('#filter-version-dropdown .filter-popup');
            if (!container) return;
            const hitVersionKeys = new Set(hits.map(h => h.versionKey));
            const opts = container.querySelectorAll('.filter-option');
            opts.forEach(opt => {
                if (opt.dataset.value === 'all') return;
                const hasResult = hitVersionKeys.has(opt.dataset.value);
                opt.classList.toggle('disabled', !hasResult);
                if (!hasResult && !opt.textContent.endsWith('（无结果）')) {
                    opt.textContent += '（无结果）';
                } else if (hasResult && opt.textContent.endsWith('（无结果）')) {
                    opt.textContent = opt.textContent.replace('（无结果）', '').trim();
                }
            });
        }

        // 初始化（延迟到数据加载完成后重试）
        function tryInit(attempts) {
            if (!attempts) attempts = 0;
            if (data.allBooks && data.allBooks.length > 0) {
                console.log('[search] initFilterBooks: allBooks loaded, count=', data.allBooks.length);
                console.log('[search] initFilterBooks: categories=', data.bookCategories ? data.bookCategories.length : 0);
                initFilterBooks();
                initFilterVersions();
            } else {
                if (attempts < 50) {
                    if (attempts % 5 === 0) console.log('[search] waiting for allBooks... attempt', attempts);
                    setTimeout(function() { tryInit(attempts + 1); }, 200);
                }
            }
        }
        tryInit(0);

        // 监听版本变化事件
        document.addEventListener('versionsChanged', () => {
            initFilterVersions();
        });

        function openSidebar() {
            if (overlay) overlay.classList.add('open');
            if (sidebar) sidebar.classList.add('open');
            // 每次打开时重新初始化译本和书卷选项
            initFilterVersions();
            initFilterBooks();
            if (input) input.focus();
        }

        function closeSidebar() {
            if (overlay) overlay.classList.remove('open');
            if (sidebar) sidebar.classList.remove('open');
            if (input) input.value = '';
            if (results) {
                results.innerHTML = '';
                results.style.display = 'none';
            }
        }

        if (toggle) toggle.onclick = () => openSidebar();
        if (closeBtn) closeBtn.onclick = () => closeSidebar();
        if (overlay) overlay.onclick = () => closeSidebar();

        if (input) {
            // 输入框聚焦时锁定 body 滚动，防止输入法推高网页
            input.addEventListener('focus', () => {
                document.body.style.overflow = 'hidden';
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
                document.body.style.top = `-${window.scrollY}px`;
            });

            // 输入框失焦时恢复 body 滚动
            input.addEventListener('blur', () => {
                const scrollY = document.body.style.top;
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.width = '';
                document.body.style.top = '';
                window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
            });

            input.addEventListener('input', () => {
                clearTimeout(timer);
                const kw = input.value.trim();
                if (!kw) {
                    if (results) results.innerHTML = '';
                    return;
                }
                openSidebar();
                timer = setTimeout(() => doSearch(kw), 300);
            });

            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    clearTimeout(timer);
                    doSearch(input.value.trim());
                }
            });
        }
    }

    /* ============================================================
       导出到全局
       ============================================================ */

    window.doSearch = doSearch;
    window.jumpToVerse = jumpToVerse;
    window.initSearchSidebar = initSearchSidebar;
    window.getSearchVersions = getSearchVersions;
    window.loadSearchIndex = loadSearchIndex;

    // 自动初始化侧边栏（DOMContentLoaded）
    document.addEventListener('DOMContentLoaded', () => {
        initSearchSidebar();
    });

})();
