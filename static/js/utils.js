/* ============================================================
 * utils.js — 工具函数（与 config.js 的配置/状态解耦）
 * ============================================================
 *
 * 约定：
 *   - 配置与状态统一从 window.BibleFlow.config / .state / .data 读取
 *   - 所有工具函数挂载到 window.BibleFlow.utils 下
 *   - 本文件不依赖加载顺序（只读 window.BibleFlow，不写）
 * ============================================================ */

(function () {
    "use strict";

    /* ---- 快捷引用 ---- */
    var cfg = function () { return window.BibleFlow.config; };
    var state = function () { return window.BibleFlow.state; };
    var data = function () { return window.BibleFlow.data; };

    /* ---- 版本工具 ---- */

    /** 根据 key 获取版本配置对象 */
    function getVersionConfig(key) {
        return (cfg().versions || []).find(function (v) { return v.key === key; }) || null;
    }

    /** 当前所有启用版本（主要 + 次要，去重保序） */
    function getActiveVersions() {
        var list = [];
        var seen = new Set();
        var add = function (k) {
            if (!k || seen.has(k)) return;
            var ver = getVersionConfig(k);
            if (!ver || !ver.available) return;
            seen.add(k);
            list.push(ver);
        };
        add(state().primaryVersion);
        (state().secondaryVersions || []).forEach(add);
        return list;
    }

    /* ---- 多版本书卷名称字段映射 ---- */

    /** 当前主要版本对应的书卷名称字段名 */
    function getBookNameField() {
        var k = state().primaryVersion || "";
        if (k === "zh_sigao") return "zh_cath";
        if (k === "zh_hehe") return "zh_prot";
        return "en";
    }

    /** 根据版本 key 获取书卷名称字段名（用于次要版本标注） */
    function getFieldForVersion(versionKey) {
        if (versionKey === "zh_sigao") return "zh_cath";
        if (versionKey === "zh_hehe") return "zh_prot";
        return "en";
    }

    /** 获取书卷的显示名称（含回退链） */
    function getBookDisplayName(book) {
        if (!book) return "";
        var field = getBookNameField();
        var bucket = book[field];

        if (bucket && bucket.name) return bucket.name;

        var fallbacks = ["zh_cath", "zh_prot", "en"];
        for (var i = 0; i < fallbacks.length; i++) {
            var f = fallbacks[i];
            if (f === field) continue;
            var b = book[f];
            if (b && b.name) return b.name;
        }
        if (book.name) return book.name;
        return "卷" + book.id;
    }

    /** 获取书卷的显示缩写（含回退链） */
    function getBookAbbr(book) {
        if (!book) return "";
        var field = getBookNameField();
        var bucket = book[field];
        if (bucket && bucket.abbr) return bucket.abbr;

        var fallbacks = ["zh_cath", "zh_prot", "en"];
        for (var i = 0; i < fallbacks.length; i++) {
            var f = fallbacks[i];
            if (f === field) continue;
            var b = book[f];
            if (b && b.abbr) return b.abbr;
        }
        return getAbbr(book.id);
    }

    /** 获取分类的显示名称（含回退链） */
    function getCategoryLabel(cat) {
        if (!cat) return "";
        var field = getBookNameField();
        var bucket = cat[field];
        if (bucket && bucket.name) return bucket.name;

        var fallbacks = ["zh_cath", "zh_prot", "en"];
        for (var i = 0; i < fallbacks.length; i++) {
            var f = fallbacks[i];
            if (f === field) continue;
            var b = cat[f];
            if (b && b.name) return b.name;
        }
        if (cat.label) return cat.label;
        return cat.key || "";
    }

    /* ---- 书卷缩写映射（URL / 音频文件名用） ---- */

    var ABBR_MAP = {
        1: "Gen", 2: "Ex", 3: "Lev", 4: "Num", 5: "Dt",
        6: "Jos", 7: "Jdg", 8: "Ru", 9: "1S", 10: "2S",
        11: "1K", 12: "2K", 13: "1Chr", 14: "2Chr",
        15: "Ezra", 16: "Ne", 17: "Tb", 18: "Jdt", 19: "Es",
        20: "1Mac", 21: "2Mac", 22: "Job", 23: "Ps", 24: "Pro",
        25: "Ecl", 26: "Song", 27: "Wis", 28: "Sir", 29: "Is",
        30: "Jer", 31: "Lm", 32: "Bar", 33: "Ezk", 34: "Dn",
        35: "Hos", 36: "Jl", 37: "Am", 38: "Ob", 39: "Jon",
        40: "Mic", 41: "Nh", 42: "Hb", 43: "Zep", 44: "Hg",
        45: "Zec", 46: "Mal", 47: "Mt", 48: "Mk", 49: "Lk",
        50: "Jn", 51: "Acts", 52: "Rom", 53: "1Cor", 54: "2Cor",
        55: "Gal", 56: "Eph", 57: "Phil", 58: "Col", 59: "1Thes",
        60: "2Thes", 61: "1Tim", 62: "2Tim", 63: "Tit", 64: "Phlm",
        65: "Heb", 66: "Jas", 67: "1P", 68: "2P", 69: "1Jn",
        70: "2Jn", 71: "3Jn", 72: "Jd", 73: "Rev"
    };

    function getAbbr(bookId) {
        return ABBR_MAP[bookId] || "";
    }

    /* ---- URL 构建工具 ---- */

    /** 获取经文 JSON 的 OSS URL */
    function getVerseUrl(version, bookId, chapter) {
        var bookStr = String(bookId).padStart(2, "0");
        var chapterStr = String(chapter).padStart(3, "0");
        return cfg().ossJsonBase + "/" + version + "/" + bookStr + "_" + chapterStr + ".json?v=" + cfg().appVersion;
    }

    /** 获取音频 URL */
    function getAudioUrlFor(version, bookId, chapter) {
        var ver = getVersionConfig(version);
        if (!ver || !ver.has_audio) return null;
        var bookStr = String(bookId).padStart(2, "0");
        var chapterStr = String(chapter).padStart(3, "0");
        return cfg().ossMp3Base + "/" + version + "/" + bookStr + "_" + chapterStr + ".mp3";
    }

    /* ---- 文本工具 ---- */

    /** HTML 转义 */
    function escapeHtml(s) {
        return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    /** 文本归一化（统一繁体/简体、大小写，用于搜索） */
    function normalizeText(s) {
        return (s || "")
            .normalize("NFC")
            .replace(/\u611B/g, "\u7231")   // 愛 → 爱
            .replace(/\u81FA/g, "\u53F0")   // 臺 → 台
            .toLowerCase();
    }

    /* ---- 导出到 BibleFlow.utils ---- */

    if (!window.BibleFlow) window.BibleFlow = {};
    window.BibleFlow.utils = {
        getVersionConfig: getVersionConfig,
        getActiveVersions: getActiveVersions,
        getBookNameField: getBookNameField,
        getFieldForVersion: getFieldForVersion,
        getBookDisplayName: getBookDisplayName,
        getBookAbbr: getBookAbbr,
        getCategoryLabel: getCategoryLabel,
        getAbbr: getAbbr,
        getVerseUrl: getVerseUrl,
        getAudioUrlFor: getAudioUrlFor,
        escapeHtml: escapeHtml,
        normalizeText: normalizeText
    };

    /* ---- 向后兼容：保留旧的 window 全局函数（供 inline onclick 等使用） ---- */

    window.getVersionConfig = getVersionConfig;
    window.getActiveVersions = getActiveVersions;
    window.getBookNameField = getBookNameField;
    window.getFieldForVersion = getFieldForVersion;
    window.getBookDisplayName = getBookDisplayName;
    window.getBookAbbr = getBookAbbr;
    window.getCategoryLabel = getCategoryLabel;
    window.getAbbr = getAbbr;
    window.getVerseUrl = getVerseUrl;
    window.getAudioUrlFor = getAudioUrlFor;
    window.escapeHtml = escapeHtml;
    window.normalizeText = normalizeText;

})();
