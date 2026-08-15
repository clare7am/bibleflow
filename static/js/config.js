window.APP_VERSION = "6";

/* ========= 版本配置 ========= */
window.BIBLE_VERSIONS = [
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
        key: "zh_hehe",
        label: "和合本",
        language: "zh",
        has_audio: false,
        has_tokens: false,
        available: false
    }
];

/* ========= OSS 基础地址 ========= */
window.OSS_BASE = "https://bibleflow.oss-cn-hangzhou.aliyuncs.com";
window.OSS_JSON_BASE = `${window.OSS_BASE}/json`;
window.OSS_MP3_BASE = `${window.OSS_BASE}/mp3`;

/* ========= 搜索索引路径 ========= */
window.SEARCH_INDEX_BASE = `${window.OSS_JSON_BASE}/_global/search`;

/* ========= 版本状态（主要 + 次要）========= */
window.Bible = {
    book: null,
    chapter: null,
    primaryVersion: "en_nrsvce",
    secondaryVersions: ["zh_sigao"]
};

/* ========= 工具：获取版本配置对象 ========= */
function getVersionConfig(key) {
    return window.BIBLE_VERSIONS.find(v => v.key === key) || null;
}

/* ========= 工具：当前所有启用版本（主要 + 次要，去重保序）========= */
function getActiveVersions() {
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

/* ========= 工具：根据主要版本获取书卷名称字段名 =========
 *   en_nrsvce / en_kjv  → "en"
 *   zh_sigao             → "zh_cath"
 *   zh_hehe              → "zh_prot"
 *   其它                  → "en"（兜底）
 *=========================================================== */
function getBookNameField() {
    const k = window.Bible.primaryVersion || "";
    if (k === "zh_sigao")  return "zh_cath";
    if (k === "zh_hehe")   return "zh_prot";
    return "en";   // 所有英文版本
}

/* ========= 工具：获取书卷的显示名称 ========= */
function getBookDisplayName(book) {
    if (!book) return "";
    const field = getBookNameField();          // "en" | "zh_cath" | "zh_prot"
    const bucket = book[field];

    // 直接命中
    if (bucket && bucket.name) return bucket.name;

    // 兜底链：zh_cath → zh_prot → en → book.name → 卷N
    const fallbacks = ["zh_cath", "zh_prot", "en"];
    for (const f of fallbacks) {
        if (f === field) continue;            // 跳过已试过的
        const b = book[f];
        if (b && b.name) return b.name;
    }
    if (book.name) return book.name;
    return `卷${book.id}`;
}

/* ========= 工具：获取书卷的显示缩写 ========= */
function getBookAbbr(book) {
    if (!book) return "";
    const field = getBookNameField();
    const bucket = book[field];
    if (bucket && bucket.abbr) return bucket.abbr;

    const fallbacks = ["zh_cath", "zh_prot", "en"];
    for (const f of fallbacks) {
        if (f === field) continue;
        const b = book[f];
        if (b && b.abbr) return b.abbr;
    }
    // 终极兜底：用 getAbbr(book.id)
    return getAbbr(book.id);
}

/* ========= 工具：获取分类的显示名称 ========= */
function getCategoryLabel(cat) {
    if (!cat) return "";
    const field = getBookNameField();
    const bucket = cat[field];
    if (bucket && bucket.name) return bucket.name;

    const fallbacks = ["zh_cath", "zh_prot", "en"];
    for (const f of fallbacks) {
        if (f === field) continue;
        const b = cat[f];
        if (b && b.name) return b.name;
    }
    if (cat.label) return cat.label;
    return cat.key || "";
}
