/* ========= 搜索功能（基于预构建索引） ========= */

/*
 * 索引文件格式（OSS 上）：
 *   /json/_global/search/{version}.json
 *   内容形如：
 *   [
 *     { "b": 1, "c": 1, "v": 1, "t": "Thus the heavens..." },
 *     ...
 *   ]
 *
 * 如果索引不存在，回退到实时逐章加载。
 */

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
        const ver = getVersionConfig(k);
        if (!ver || !ver.available) return;
        seen.add(k);
        list.push(ver);
    };
    add(window.Bible.primaryVersion);
    (window.Bible.secondaryVersions || []).forEach(add);
    return list;
}

/**
 * 加载指定版本的搜索索引
 */
async function loadSearchIndex(versionKey) {
    if (searchIndexLoaded[versionKey]) {
        return searchIndexCache[versionKey] || null;
    }

    const url = `${window.SEARCH_INDEX_BASE}/${versionKey}.json?v=${window.APP_VERSION}`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`搜索索引不存在: ${url}，将回退到实时搜索`);
            searchIndexLoaded[versionKey] = true;
            searchIndexCache[versionKey] = null;
            return null;
        }
        const data = await res.json();
        searchIndexLoaded[versionKey] = true;
        searchIndexCache[versionKey] = data;
        console.log(`✅ 搜索索引已加载: ${versionKey} (${data.length} 条)`);
        return data;
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

    const url = getVerseUrl(versionKey, bookId, chapter);
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        verCache[bookId][chapter] = data.verses || [];
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

    for (const book of window._allBooks) {
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
                        bookName: getBookDisplayName(book),
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
 * 文本归一化（统一繁体/简体、大小写）
 */
function normalizeText(s) {
    return (s || "")
        .normalize('NFC')
        .replace(/愛/g, '爱')
        .replace(/臺/g, '台')
        .toLowerCase();
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

    const target = normalizeText(kw);
    const norm = s => normalizeText(s);

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
        index.forEach(entry => {
            const text = entry.t || "";
            if (norm(text).includes(target)) {
                const book = window._allBooks.find(b => b.id === entry.b);
                allHits.push({
                    versionKey: ver.key,
                    versionLabel: ver.label,
                    bookId: entry.b,
                    bookName: book ? getBookDisplayName(book) : `卷${entry.b}`,
                    chapter: entry.c,
                    verse: entry.v,
                    text: text
                });
            }
        });
    });

    // 没有索引的版本 → 实时搜索
    for (const { ver } of noIndexVersions) {
        container.innerHTML = `<div class="search-loading">正在搜索 ${ver.label}（实时）…</div>`;
        const rtHits = await searchVersionRealtime(ver, target, norm);
        allHits.push(...rtHits);
    }

    // 渲染结果
    if (!container.isConnected) return;

    if (allHits.length === 0) {
        container.innerHTML = `<div class="search-empty">未找到「${escapeHtml(kw)}」</div>`;
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
        const escaped = escapeHtml(text);
        // 尝试原文高亮（不归一化）
        let kwEscaped = escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let result = escaped.replace(new RegExp(kwEscaped, 'gi'), m => `<b>${m}</b>`);
        // 如果没命中，尝试归一化后的子串
        if (!result.includes('<b>')) {
            const normText = normalizeText(text);
            const normKw = normalizeText(keyword);
            if (normKw) {
                // 找到在归一化文本中的位置
                const idx = normText.indexOf(normKw);
                if (idx >= 0) {
                    // 用原文对应位置高亮
                    const original = text.substring(idx, idx + normKw.length);
                    const origEscaped = escapeHtml(original).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    result = escaped.replace(new RegExp(origEscaped, 'gi'), m => `<b>${m}</b>`);
                }
            }
        }
        return result;
    }

    allHits.forEach(r => {
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
            jumpToVerse(r.versionKey, r.bookId, r.chapter, r.verse);
        };
        ul.appendChild(li);
    });
}

/**
 * 跳转到指定经节
 */
function jumpToVerse(targetVersionKey, bookId, chapter, verse) {
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

    // 如果目标版本不是当前主要经文，切换过去
    if (window.Bible.primaryVersion !== targetVersionKey) {
        selectPrimaryVersionSilent(targetVersionKey);
    }

    Bible.book = bookId;
    Bible.chapter = chapter;

    loadChaptersForBook(bookId, chapter).then(() => {
        document.querySelectorAll(".book-item").forEach(el => {
            el.classList.toggle("active", Number(el.dataset.bookId) === bookId);
        });

        loadVersesMulti(() => {
            requestAnimationFrame(() => {
                const blocks = document.querySelectorAll('.verse-block');
                if (blocks.length === 0) return;

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

                if (!found && blocks[0]) {
                    blocks[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        updateAudio();
    }).catch(e => {
        console.error('跳转加载失败:', e);
    });
}

/* ========= 工具函数 ========= */
function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ========= 侧边栏控制 ========= */
document.addEventListener('DOMContentLoaded', () => {
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
});
