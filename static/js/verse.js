/* ========= 工具函数 ========= */

/**
 * 书卷ID → 英文缩写（用于URL和音频文件名）
 */
function getAbbr(bookId) {
    const abbrMap = {
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
    return abbrMap[bookId] || "";
}

/**
 * 获取经文 JSON 的 OSS URL
 */
function getVerseUrl(version, bookId, chapter) {
    const bookStr = String(bookId).padStart(2, "0");
    const chapterStr = String(chapter).padStart(3, "0");
    return `${window.OSS_JSON_BASE}/${version}/${bookStr}_${chapterStr}.json?v=${window.APP_VERSION}`;
}

/**
 * 获取音频 URL
 */
function getAudioUrlFor(version, bookId, chapter) {
    const ver = getVersionConfig(version);
    if (!ver || !ver.has_audio) return null;

    const bookStr = String(bookId).padStart(2, "0");
    const chapterStr = String(chapter).padStart(3, "0");
    return `${window.OSS_MP3_BASE}/${version}/${bookStr}_${chapterStr}.mp3`;
}

/* ========= 多版本加载入口 ========= */
function loadVersesMulti(onReady) {
    const bookId = Bible.book;
    const chapter = Bible.chapter;
    const container = document.getElementById("verses");

    if (!bookId || !chapter) {
        container.innerHTML = "";
        onReady && onReady();
        return;
    }

    container.innerHTML = "<p>加载中...</p>";

    const versions = getActiveVersions();
    if (versions.length === 0) {
        container.innerHTML = "<p>请至少启用一个可用版本</p>";
        onReady && onReady();
        return;
    }

    // 逐个加载所有启用版本
    const promises = versions.map(ver =>
        fetch(getVerseUrl(ver.key, bookId, chapter))
            .then(res => {
                if (!res.ok) throw new Error(`${ver.key} HTTP ${res.status}`);
                return res.json().then(data => ({ ver, data }));
            })
            .catch(err => {
                console.warn(`⚠️ ${ver.key} 加载失败:`, err.message);
                return { ver, data: null, error: err.message };
            })
    );

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

    // 以主要经文（或第一个成功版本）的节号为基准对齐
    const primaryResult = success.find(r => r.ver.key === window.Bible.primaryVersion)
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

        // 主要经文正文
        const priText = document.createElement("div");
        priText.className = "verse-text verse-primary";
        priText.dataset.version = primaryVer.key;

        if (primaryVer.has_tokens && v.tokens && v.tokens.length > 0) {
            v.tokens.forEach(t => {
                const span = document.createElement("span");
                span.className = t.type || "word";
                span.textContent = t.token;
                if (t.align_id !== undefined && t.align_id !== "") {
                    span.dataset.alignId = t.align_id;
                }
                if (t.start) span.dataset.start = t.start;
                if (t.end) span.dataset.end = t.end;
                if (t.entity_key) span.dataset.entityKey = t.entity_key;
                priText.appendChild(span);
            });
        } else {
            priText.textContent = v.text || "";
        }
        block.appendChild(priText);

        // 次要经文（按勾选顺序，纯文本，无版本标签前缀）
        const secondary = window.Bible.secondaryVersions || [];
        secondary.forEach(secKey => {
            const secVer = getVersionConfig(secKey);
            if (!secVer) return;
            const secVerse = otherIndex[secKey] && otherIndex[secKey][v.verse_id];

            const secDiv = document.createElement("div");
            secDiv.className = "verse-text verse-secondary";
            secDiv.dataset.version = secKey;

            if (secVerse && secVerse.text) {
                secDiv.textContent = secVerse.text;
            } else {
                secDiv.textContent = "—";
                secDiv.classList.add("verse-missing");
            }

            block.appendChild(secDiv);
        });

        frag.appendChild(block);
    });

    container.appendChild(frag);

    // 应用实体样式
    if (typeof applyEntityStyles === "function") {
        applyEntityStyles();
    }

    onReady && onReady();
}

/* ========= 单版本加载（兼容）========= */
function loadVerses(onReady) {
    loadVersesMulti(onReady);
}
