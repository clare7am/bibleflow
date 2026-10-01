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

    /* ===== 筛选状态 ===== */
    var searchFilters = {
        scope: 'all',       // 'all' | 'current'
        version: 'screen',  // 'screen' | 'primary'
        sort: 'interleave', // 'interleave' | 'grouped'
        book: ''            // 书卷 ID 字符串，空=全部
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

        if (searchFilters.version === 'primary') {
            add(state.primaryVersion);
        } else {
            // screen: 当前屏幕显示的所有版本
            add(state.primaryVersion);
            (state.secondaryVersions || []).forEach(add);
        }
        return list;
    }

    /** 获取要搜索的书卷列表（根据筛选条件） */
    function getSearchBooks() {
        // 如果指定了书卷过滤
        if (searchFilters.book) {
            const bookId = parseInt(searchFilters.book, 10);
            const book = (data.allBooks || []).find(b => b.id === bookId);
            return book ? [book] : [];
        }
        // 如果限定当前书卷
        if (searchFilters.scope === 'current' && state.book) {
            const book = (data.allBooks || []).find(b => b.id === state.book);
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
        allHits.sort((a, b) => {
            // 先按书卷 ID 排序
            if (a.bookId !== b.bookId) return a.bookId - b.bookId;
            // 再按章节
            if (a.chapter !== b.chapter) return a.chapter - b.chapter;
            // 再按节号
            if (a.verse !== b.verse) return a.verse - b.verse;
            // 同节经文，按排序模式处理
            if (sortMode === 'grouped') {
                // 按译本分组：同一译本的结果紧挨
                return a.versionKey.localeCompare(b.versionKey);
            }
            // interleave: 同节不同译本按版本字母序穿插
            return a.versionKey.localeCompare(b.versionKey);
        });

        container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'search-result-header';
        const scopeLabel = searchFilters.scope === 'current' ? '当前书卷' : '正本圣经';
        const verLabel = searchFilters.version === 'primary' ? '主要译本' : '屏幕显示译本';
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
                    // ✅ 只传 bookId / chapter / verse，不传版本
                    // 跳转时绝不修改用户的版本选择
                    jumpToVerse(r.bookId, r.chapter, r.verse);
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
        }

        renderNextBatch();
    }

    /* ========= 跳转到经文（不修改版本选择）========= */
    function jumpToVerse(bookId, chapter, verse) {
        // 跳转经文，保留搜索结果
        const input = document.getElementById('search-input');
        if (input) input.blur();

        // ✅ 关键：绝不碰 primaryVersion / secondaryVersions
        // 只用当前已选的主要经文版本去加载目标章节
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

        // 筛选栏元素
        const filterScope = document.getElementById('filter-scope');
        const filterVersion = document.getElementById('filter-version');
        const filterSort = document.getElementById('filter-sort');
        const filterBook = document.getElementById('filter-book');

        let timer = null;

        // 初始化书卷下拉菜单
        function initFilterBooks() {
            if (!filterBook) return;
            const books = data.allBooks || [];
            books.forEach(book => {
                const opt = document.createElement('option');
                opt.value = book.id;
                opt.textContent = utils.getBookDisplayName(book);
                filterBook.appendChild(opt);
            });
        }

        // 筛选条件变化 → 重新搜索
        function onFilterChange() {
            searchFilters.scope = filterScope ? filterScope.value : 'all';
            searchFilters.version = filterVersion ? filterVersion.value : 'screen';
            searchFilters.sort = filterSort ? filterSort.value : 'interleave';
            searchFilters.book = filterBook ? filterBook.value : '';

            // 如果有当前关键词，重新搜索
            if (input && input.value.trim()) {
                clearTimeout(timer);
                timer = setTimeout(() => doSearch(input.value.trim()), 300);
            }
        }

        if (filterScope) filterScope.addEventListener('change', onFilterChange);
        if (filterVersion) filterVersion.addEventListener('change', onFilterChange);
        if (filterSort) filterSort.addEventListener('change', onFilterChange);
        if (filterBook) filterBook.addEventListener('change', onFilterChange);

        initFilterBooks();

        function openSidebar() {
            if (overlay) overlay.classList.add('open');
            if (sidebar) sidebar.classList.add('open');
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
