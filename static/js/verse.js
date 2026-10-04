/* ========= 经文加载与渲染 ========= */
/*
 * 依赖：config.js, utils.js, entity.js
 * 导出到全局的函数：
 *   loadVersesMulti, renderMultiVersion, loadVerses
 */

(function () {
    "use strict";

    var state = window.BibleFlow.state;
    var utils = window.BibleFlow.utils;

    /* ========= 多版本加载入口 ========= */
    function loadVersesMulti(onReady) {
        const bookId = state.book;
        const chapter = state.chapter;
        const container = document.getElementById("verses");

        if (!bookId || !chapter) {
            container.innerHTML = "";
            onReady && onReady();
            return;
        }

        container.innerHTML = "<p>加载中...</p>";

        const versions = utils.getActiveVersions();
        if (versions.length === 0) {
            container.innerHTML = "<p>请至少启用一个可用版本</p>";
            onReady && onReady();
            return;
        }

        // 逐个加载所有启用版本
        const promises = versions.map(ver => {
            const url = utils.getVerseUrl(ver.key, bookId, chapter);
            if (!url) {
                // 此版本无此书（如 Deutero 书的 Protestant 版本）
                return Promise.resolve({ ver, data: null, error: "此版本无此卷" });
            }
            return fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error(`${ver.key} HTTP ${res.status}`);
                    return res.json().then(data => ({ ver, data }));
                })
                .catch(err => {
                    console.warn(`⚠️ ${ver.key} 加载失败:`, err.message);
                    return { ver, data: null, error: err.message };
                });
        });

        Promise.all(promises).then(results => {
            renderMultiVersion(results, container, onReady);
        });
    }

    /* ========= 多版本渲染 ========= */
    function renderMultiVersion(results, container, onReady) {
        container.innerHTML = "";

        // 更新容器类名（阅读模式）
        container.classList.toggle("reading-mode", state.readingMode);

        const success = results.filter(r => r.data);
        const failed = results.filter(r => !r.data);

        if (success.length === 0) {
            container.innerHTML = "<p>待更新</p>";
            onReady && onReady();
            return;
        }

        // 以主要经文为基准对齐节号
        const primaryResult = success.find(r => r.ver.key === state.primaryVersion)
            || success[0];
        const primaryVerses = primaryResult.data.verses || [];
        const primaryVer = primaryResult.ver;

        // 建立其他版本 verse_id → verse 的索引
        const otherIndex = {};
        success.forEach(r => {
            if (r.ver.key === primaryVer.key) return;
            otherIndex[r.ver.key] = {};
            (r.data.verses || []).forEach(v => {
                otherIndex[r.ver.key][v.verse_id] = v;
            });
        });

        // 渲染每一节
        const frag = document.createDocumentFragment();

        primaryVerses.forEach(v => {
            const block = document.createElement("div");
            block.className = "verse-block";

            // 节号
            const num = document.createElement("div");
            num.className = "verse-num";
            num.textContent = v.verse_id || "";
            block.appendChild(num);

            // 渲染每个版本：有 tokens 就渲染 token span，没有就纯文本
            const audioVer = state.audioVersion || state.primaryVersion;

            success.forEach(r => {
                const ver = r.ver;
                const verData = r.data;
                const verse = (verData.verses || []).find(vv => vv.verse_id === v.verse_id);
                if (!verse) return;

                const isPrimary = ver.key === primaryVer.key;
                const isAudio = ver.key === audioVer;

                // 阅读模式：次版本默认隐藏，点击展开
                const isExpanded = state.readingMode && !isPrimary && block.dataset.expanded === ver.key;

                const textDiv = document.createElement("div");
                if (isPrimary) {
                    textDiv.className = "verse-text verse-primary";
                } else {
                    // 阅读模式下次版本用 verse-secondary + expanded 类控制显示
                    textDiv.className = "verse-text verse-secondary" + (isAudio ? " verse-audio-target" : "") + (isExpanded ? " expanded" : "");
                }
                textDiv.dataset.version = ver.key;

                if (ver.has_tokens && verse.tokens && verse.tokens.length > 0) {
                    verse.tokens.forEach(t => {
                        const span = document.createElement("span");
                        span.className = t.type || "word";
                        span.textContent = t.token;
                        if (t.align_id !== undefined && t.align_id !== "") {
                            span.dataset.alignId = t.align_id;
                        }
                        if (t.start) span.dataset.start = t.start;
                        if (t.end) span.dataset.end = t.end;
                        if (t.entity_key) span.dataset.entityKey = t.entity_key;
                        textDiv.appendChild(span);
                    });
                } else {
                    textDiv.textContent = verse.text || "";
                }
                block.appendChild(textDiv);
            });

            // 阅读模式：添加点击展开次版本的事件
            if (state.readingMode) {
                block.addEventListener("click", function(e) {
                    // 阻止冒泡到内部链接等
                    e.stopPropagation();
                    toggleSecondaryVerse(this, results, primaryVer);
                });
            }

            frag.appendChild(block);
        });

        container.appendChild(frag);

        // 应用实体样式
        window.applyEntityStyles(container);

        // 经节号显示/隐藏
        container.classList.toggle("verse-num-hidden", !state.showVerseNum);

        onReady && onReady();

        // 初始化经文复制功能
        initVerseCopy();
    }

    /* ========= 经文复制功能 ========= */
    let _copyInitialized = false;
    function initVerseCopy() {
        if (_copyInitialized) return;
        _copyInitialized = true;

        document.addEventListener('copy', function(e) {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.rangeCount) return;

            const range = sel.getRangeAt(0);

            // 收集选中的所有 verse-block
            const verseBlocks = [];
            const fragment = range.cloneContents();
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(fragment);

            // 方法1：如果选中文本跨越多个 verse-block
            const selectedBlocks = tempDiv.querySelectorAll('.verse-block');
            if (selectedBlocks.length > 1) {
                // 跨节复制
                const firstBlock = range.startContainer.nodeType === Node.TEXT_NODE
                    ? range.startContainer.parentNode.closest('.verse-block')
                    : range.startContainer.closest('.verse-block');

                if (!firstBlock) return;

                const bookId = state.book;
                const chapter = state.chapter;
                const book = (window.BibleFlow.data.allBooks || []).find(b => b.id === bookId);
                if (!book) return;

                // 获取版本
                const firstText = firstBlock.querySelector('.verse-text');
                const versionKey = firstText ? firstText.dataset.version : null;
                let bookName;
                if (versionKey) {
                    const fieldName = utils.getFieldForVersion(versionKey);
                    bookName = book[fieldName]?.name || utils.getBookDisplayName(book);
                } else {
                    bookName = utils.getBookDisplayName(book);
                }
                if (!bookName) return;

                // 提取所有选中的 verse-block 的节号和文本
                const verses = [];
                const allBlocks = document.querySelectorAll('.verse-block');
                let inSelection = false;

                allBlocks.forEach(function(block) {
                    const verseNum = block.querySelector('.verse-num')?.textContent?.trim() || '';
                    const verseText = block.querySelector('.verse-text')?.textContent?.trim() || '';

                    // 检查此 block 是否在选中范围内
                    const blockRange = document.createRange();
                    blockRange.selectNodeContents(block);
                    const intersects = range.intersectsNode(block);

                    if (intersects && verseNum && verseText) {
                        verses.push({ num: parseInt(verseNum, 10), text: verseText });
                    }
                });

                if (verses.length === 0) return;

                // 格式化：书卷名 章:开始节-结束节 经文内容
                const startVerse = verses[0].num;
                const endVerse = verses[verses.length - 1].num;
                const verseRange = startVerse === endVerse ? String(startVerse) : startVerse + '-' + endVerse;
                const verseText = verses.map(function(v) { return v.text; }).join('');

                const formatted = bookName + ' ' + chapter + ':' + verseRange + ' ' + verseText;
                e.clipboardData.setData('text/plain', formatted);
                e.preventDefault();
                return;
            }

            // 方法2：单节复制（原有逻辑）
            let node = range.commonAncestorContainer;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

            const verseBlock = node.closest ? node.closest('.verse-block') : findClosestVerseBlock(node);
            if (!verseBlock) return;

            const textNode = findClosestVerseText(node);
            const versionKey = textNode ? textNode.dataset.version : null;

            const bookId = state.book;
            const chapter = state.chapter;
            const verseNum = verseBlock.querySelector('.verse-num')?.textContent?.trim() || '';
            if (!bookId || !chapter || !verseNum) return;

            const book = (window.BibleFlow.data.allBooks || []).find(b => b.id === bookId);
            if (!book) return;

            let bookName;
            if (versionKey) {
                const fieldName = utils.getFieldForVersion(versionKey);
                bookName = book[fieldName]?.name || utils.getBookDisplayName(book);
            } else {
                bookName = utils.getBookDisplayName(book);
            }

            if (!bookName) return;

            let selectedText = sel.toString().trim();
            if (!selectedText) return;

            if (verseBlock.contains(node)) {
                const formatted = bookName + ' ' + chapter + ':' + verseNum + ' ' + selectedText;
                e.clipboardData.setData('text/plain', formatted);
                e.preventDefault();
            }
        });
    }

    function findClosestVerseBlock(node) {
        while (node && node !== document.body) {
            if (node.classList && node.classList.contains('verse-block')) return node;
            node = node.parentNode;
        }
        return null;
    }

    function findClosestVerseText(node) {
        while (node && node !== document.body) {
            if (node.classList && node.classList.contains('verse-text')) return node;
            node = node.parentNode;
        }
        return null;
    }

    /** 阅读模式：切换次版本展开/收起 */
    function toggleSecondaryVerse(block, results, primaryVer) {
        const secondaryTexts = block.querySelectorAll(".verse-text.verse-secondary");
        if (secondaryTexts.length === 0) return;

        const firstSecondary = secondaryTexts[0];
        const isExpanded = firstSecondary.classList.contains("expanded");

        if (isExpanded) {
            // 收起
            secondaryTexts.forEach(el => {
                el.classList.remove("expanded");
            });
            delete block.dataset.expanded;
        } else {
            // 展开
            secondaryTexts.forEach(el => {
                el.classList.add("expanded");
            });
            const verKeys = [...secondaryTexts].map(el => el.dataset.version).join(",");
            block.dataset.expanded = verKeys;
        }
    }

    /* ========= 单版本加载（兼容）========= */
    function loadVerses(onReady) {
        loadVersesMulti(onReady);
    }

    /* ============================================================
       导出到全局
       ============================================================ */

    window.loadVersesMulti = loadVersesMulti;
    window.renderMultiVersion = renderMultiVersion;
    window.loadVerses = loadVerses;

})();
