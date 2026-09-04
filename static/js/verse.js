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

                const textDiv = document.createElement("div");
                if (isPrimary) {
                    textDiv.className = "verse-text verse-primary";
                } else {
                    // 次要版本：小灰字，但如果是音频版本，加 .verse-audio-target 支持高亮
                    textDiv.className = "verse-text verse-secondary" + (isAudio ? " verse-audio-target" : "");
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

            frag.appendChild(block);
        });

        container.appendChild(frag);

        // 应用实体样式
        if (typeof window.applyEntityStyles === "function") {
            window.applyEntityStyles();
        }

        onReady && onReady();
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
