/* ============================================================
 * config.js — 纯配置 + 状态（不再包含工具函数）
 * ============================================================
 *
 * 约定：
 *   - window.BibleFlow.config   静态配置
 *   - window.BibleFlow.state    运行时状态（书卷、章节、版本选择）
 *   - window.BibleFlow.data     运行时数据（书卷列表、章节列表等）
 *   - 向后兼容：保留旧的 window.Bible / window.BIBLE_VERSIONS 等别名
 * ============================================================ */

(function () {
    "use strict";

    if (!window.BibleFlow) window.BibleFlow = {};

    /* ========= 配置（静态） ========= */
    window.BibleFlow.config = {
        appVersion: "6",
        ossBase: "https://bibleflow.oss-cn-hangzhou.aliyuncs.com",
        get ossJsonBase() { return this.ossBase + "/json"; },
        get ossMp3Base() { return this.ossBase + "/mp3"; },
        get searchIndexBase() { return this.ossJsonBase + "/_global/search"; },

        versions: [
            {
                key: "en_nrsvce",
                label: "NRSVCE",
                language: "en",
                has_audio: true,
                has_tokens: true,
                available: true
            },
            {
                key: "en_kjv",
                label: "KJV",
                language: "en",
                has_audio: false,
                has_tokens: false,
                available: false
            },
            {
                key: "zh_sigao",
                label: "思高",
                language: "zh",
                has_audio: false,
                has_tokens: false,
                available: true
            },
            {
                key: "zh_cuv2010",
                label: "和合本",
                language: "zh",
                has_audio: false,
                has_tokens: false,
                available: true
            }
        ]
    };

    /* ========= 状态（运行时可变） ========= */
    window.BibleFlow.state = {
        book: null,
        chapter: null,
        primaryVersion: "en_nrsvce",
        secondaryVersions: ["zh_sigao"]
    };

    /* ========= 数据（运行时加载） ========= */
    window.BibleFlow.data = {
        allBooks: [],
        bookCategories: null,
        currentChapters: [],
        currentTestament: "old_testament"
    };

    /* ============================================================
       向后兼容别名（旧代码仍可通过 window.Bible / window.BIBLE_VERSIONS 访问）
       ============================================================ */

    // window.Bible → 指向 state
    window.Bible = window.BibleFlow.state;

    // window.BIBLE_VERSIONS → 指向 config.versions
    window.BIBLE_VERSIONS = window.BibleFlow.config.versions;

    // window.APP_VERSION
    window.APP_VERSION = window.BibleFlow.config.appVersion;

    // window.OSS_BASE / OSS_JSON_BASE / OSS_MP3_BASE / SEARCH_INDEX_BASE
    window.OSS_BASE = window.BibleFlow.config.ossBase;
    window.OSS_JSON_BASE = window.BibleFlow.config.ossJsonBase;
    window.OSS_MP3_BASE = window.BibleFlow.config.ossMp3Base;
    window.SEARCH_INDEX_BASE = window.BibleFlow.config.searchIndexBase;

    // window._allBooks / _bookCategories / _currentChapters / _currentTestament
    Object.defineProperty(window, "_allBooks", {
        get: function () { return window.BibleFlow.data.allBooks; },
        set: function (v) { window.BibleFlow.data.allBooks = v; }
    });
    Object.defineProperty(window, "_bookCategories", {
        get: function () { return window.BibleFlow.data.bookCategories; },
        set: function (v) { window.BibleFlow.data.bookCategories = v; }
    });
    Object.defineProperty(window, "_currentChapters", {
        get: function () { return window.BibleFlow.data.currentChapters; },
        set: function (v) { window.BibleFlow.data.currentChapters = v; }
    });
    Object.defineProperty(window, "_currentTestament", {
        get: function () { return window.BibleFlow.data.currentTestament; },
        set: function (v) { window.BibleFlow.data.currentTestament = v; }
    });

})();
