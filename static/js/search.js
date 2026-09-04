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

    /**
     * 获取当前要搜索的版本列表（主要 + 次要，去重）
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
        add(state.primaryVersion);
        (state.secondaryVersions || []).forEach(add);
        return list;
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
    async function searchVersionRealtime(ver, target, norm) {
        const hits = [];

        for (const book of (data.allBooks || [])) {
            const maxCh = (book.chapter_count) || 50;
            for (let ch = 1; ch <= maxCh; ch++) {
                const verses = await ensureChapterLoadedRT(ver.key, book.id, ch);
                if (!verses) continue;
                for (const v of verses) {
                    const text = v.text || "";
                    if (norm(text).includes(target)) {
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

        const target = utils.normalizeText(kw);
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

        // 使用索引快速搜索
        hasIndexVersions.forEach(({ ver, index }) => {
            const isProt = utils.isProtestantVersion(ver.key);
            index.forEach(entry => {
                const text = entry.t || "";
                if (norm(text).includes(target)) {
                    // 搜索索引里的 book ID 可能是 Protestant ID，需要映射到 Catholic ID
                    let catholicId = entry.b;
                    if (isProt) {
                        // 反查：找到 prot_id === entry.b 的 Catholic ID
                        const match = (data.allBooks || []).find(b => b.prot_id === entry.b);
                        if (match) catholicId = match.id;
                    }

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
            const rtHits = await searchVersionRealtime(ver, target, norm);
            allHits.push(...rtHits);
        }

        // 渲染结果
        if (!container.isConnected) return;

        if (allHits.length === 0) {
            container.innerHTML = `<div class="search-empty">未找到「${utils.escapeHtml(kw)}」</div>`;
            return;
        }

        container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'search-result-header';
        header.textContent = `找到 ${allHits.length} 节（${versions.length} 个版本）`;
        container.appendChild(header);

        const ul = document.createElement('ul');
        ul.className = 'search-result-list';
        container.appendChild(ul);

        // 高亮关键词
        function highlight(text, keyword) {
            const escaped = utils.escapeHtml(text);
            let kwEscaped = utils.escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let result = escaped.replace(new RegExp(kwEscaped, 'gi'), m => `<b>${m}</b>`);
            if (!result.includes('<b>')) {
                const normText = utils.normalizeText(text);
                const normKw = utils.normalizeText(keyword);
                if (normKw) {
                    const idx = normText.indexOf(normKw);
                    if (idx >= 0) {
                        const original = text.substring(idx, idx + normKw.length);
                        const origEscaped = utils.escapeHtml(original).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        result = escaped.replace(new RegExp(origEscaped, 'gi'), m => `<b>${m}</b>`);
                    }
                }
            }
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
                textLine.innerHTML = highlight(r.text, kw);

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
        // 关闭搜索面板
        const overlay = document.getElementById('search-overlay');
        const sidebar = document.getElementById('search-sidebar');
        const input = document.getElementById('search-input');
        const resultsEl = document.getElementById('search-results');
        if (overlay) overlay.classList.remove('open');
        if (sidebar) sidebar.classList.remove('open');
        if (input) input.value = '';
        if (resultsEl) {
            resultsEl.innerHTML = '';
            resultsEl.style.display = 'none';
        }

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

        let timer = null;

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
