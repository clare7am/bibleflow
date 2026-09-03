/* ========= 书卷 + 章节 并排侧拉面板 ========= */
/*
 * 依赖：config.js, utils.js
 * 导出到全局的函数：
 *   initBookSelector, bindUI, switchTestament, renderBooks, selectBook,
 *   loadChaptersForBook, selectChapter, updateTopTitle, updateBookPanelLanguage,
 *   openBookPanel, closeBookPanel, onBookChange
 */

(function () {
    "use strict";

    var data = window.BibleFlow.data;
    var state = window.BibleFlow.state;
    var cfg = window.BibleFlow.config;
    var utils = window.BibleFlow.utils;

    /* ---------- 根据当前主要版本获取书卷的最大章节数 ---------- */
    function getMaxChapterForBook(book) {
        const field = utils.getBookNameField();   // "en" | "zh_cath" | "zh_prot"
        const bucket = book && book[field];
        if (bucket && bucket.max_chapter) return Number(bucket.max_chapter);
        // 回退链
        const fallbacks = ["zh_cath", "zh_prot", "en"];
        for (const f of fallbacks) {
            if (f === field) continue;
            const b = book[f];
            if (b && b.max_chapter) return Number(b.max_chapter);
        }
        return null;
    }

    /* ---------- 初始化 ---------- */
    async function initBookSelector() {
        try {
            const [booksResp, catResp] = await Promise.all([
                fetch(`/test/books.json?v=${cfg.appVersion}`),
                fetch(`${cfg.ossJsonBase}/_global/categories.json?v=${cfg.appVersion}`)
            ]);

            if (!booksResp.ok) throw new Error(`books.json 加载失败: HTTP ${booksResp.status}`);
            if (!catResp.ok) throw new Error(`categories.json 加载失败: HTTP ${catResp.status}`);

            data.allBooks = await booksResp.json();
            data.bookCategories = await catResp.json();

            // 默认：创世纪 第1章
            const first = data.allBooks[0];
            state.book = first.id;
            state.chapter = 1;

            bindUI();
            updateTopTitle(first, 1);

            await loadChaptersForBook(first.id, 1);
        } catch (err) {
            console.error("书卷初始化失败:", err);
            const span = document.getElementById("book-btn-text");
            if (span) span.textContent = "待更新";
        }
    }

    /* ---------- 绑定 DOM 事件 ---------- */
    function bindUI() {
        const titleBtn = document.getElementById("book-btn");
        if (titleBtn) titleBtn.addEventListener("click", openBookPanel);

        const closeBtn = document.getElementById("book-panel-close");
        if (closeBtn) closeBtn.addEventListener("click", closeBookPanel);

        const overlay = document.getElementById("book-overlay");
        if (overlay) overlay.addEventListener("click", closeBookPanel);

        document.querySelectorAll(".book-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                switchTestament(tab.dataset.testament);
            });
        });

        const topPrev = document.getElementById("top-prev");
        const topNext = document.getElementById("top-next");
        if (topPrev) topPrev.addEventListener("click", window.prevChapter);
        if (topNext) topNext.addEventListener("click", window.nextChapter);

        // 默认渲染旧约
        renderBooks(data.currentTestament);
    }

    /* ---------- Tab 切换 ---------- */
    function switchTestament(testament) {
        data.currentTestament = testament;
        document.querySelectorAll(".book-tab").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.testament === testament);
        });
        renderBooks(testament);
    }

    /* ---------- 渲染左侧书卷列表（含子分类）---------- */
    function renderBooks(testament) {
        const list = document.getElementById("book-list");
        if (!list) return;

        // 清空并强制重绘
        list.innerHTML = "";

        const cats = data.bookCategories || [];
        // 找到当前 testament 的顶层分类对象
        const testamentCat = cats.find(c => c.key === testament) || null;

        if (!testamentCat) {
            // 没有分类信息，显示全部
            const grid = document.createElement("div");
            grid.className = "book-grid";
            appendBookButtons(data.allBooks, grid);
            list.appendChild(grid);
        } else {
            // 子分类数组（可能叫 "categories" 或直接在顶层）
            const subCats = testamentCat.categories || [];

            if (subCats.length > 0) {
                // 按子分类分组渲染
                subCats.forEach(subCat => {
                    const subBookIds = subCat.book_ids || [];
                    const subBooks = data.allBooks.filter(b => subBookIds.includes(b.id));
                    if (subBooks.length === 0) return;

                    const catTitle = document.createElement("div");
                    catTitle.className = "book-cat-title";
                    catTitle.textContent = utils.getCategoryLabel(subCat);
                    list.appendChild(catTitle);

                    const grid = document.createElement("div");
                    grid.className = "book-grid";
                    appendBookButtons(subBooks, grid);
                    list.appendChild(grid);
                });
            } else {
                // 无子分类，按 testament 的 book_ids 直接列出
                const bookIds = testamentCat.book_ids || [];
                const books = data.allBooks.filter(b => bookIds.includes(b.id));
                const grid = document.createElement("div");
                grid.className = "book-grid";
                appendBookButtons(books, grid);
                list.appendChild(grid);
            }
        }

        // 渲染右侧章节
        const currentBook = data.allBooks.find(b => b.id === state.book);
        if (currentBook) {
            renderChapters(currentBook);
        } else {
            showChapterEmpty();
        }
    }

    function appendBookButtons(books, container) {
        books.forEach(book => {
            const item = document.createElement("button");
            item.className = "book-item";
            item.title = utils.getBookDisplayName(book);
            item.dataset.bookId = book.id;

            // 主要版本缩写（大字）
            const mainName = document.createElement("span");
            mainName.className = "book-item-main";
            mainName.textContent = utils.getBookAbbr(book);
            item.appendChild(mainName);

            // 次要版本书卷名（小字，仅在有次要版本且名称不同时显示）
            const secondary = state.secondaryVersions || [];
            if (secondary.length > 0) {
                const secKey = secondary[0]; // 取第一个次要版本
                const secField = utils.getFieldForVersion(secKey);
                if (secField) {
                    const secBucket = book[secField];
                    if (secBucket && secBucket.abbr && secBucket.abbr !== utils.getBookAbbr(book)) {
                        const subName = document.createElement("span");
                        subName.className = "book-item-sub";
                        subName.textContent = secBucket.abbr;
                        item.appendChild(subName);
                    } else if (secBucket && secBucket.name && secBucket.name !== utils.getBookDisplayName(book)) {
                        const subName = document.createElement("span");
                        subName.className = "book-item-sub";
                        // 中文取第一个字作为小字标注
                        subName.textContent = secBucket.name.charAt(0);
                        item.appendChild(subName);
                    }
                }
            }

            if (Number(state.book) === book.id) {
                item.classList.add("active");
            }

            item.addEventListener("click", () => selectBook(book));
            container.appendChild(item);
        });
    }

    /* ---------- 选中书卷（左侧点击） ---------- */
    function selectBook(book) {
        state.book = book.id;
        const ch = state.chapter || 1;
        updateTopTitle(book, ch);

        document.querySelectorAll(".book-item").forEach(el => {
            el.classList.toggle("active", Number(el.dataset.bookId) === book.id);
        });

        loadChaptersForBook(book.id, 1).then(() => {
            renderChapters(book);
        });
    }

    /* ---------- 加载指定书卷的章节列表 ---------- */
    async function loadChaptersForBook(bookId, targetChapter) {
        const book = data.allBooks.find(b => b.id === bookId);
        const maxCh = getMaxChapterForBook(book);

        if (!maxCh) {
            console.warn("⚠️ 无法获取书卷", bookId, "的章节数");
            return [];
        }

        // 同步 data.currentChapters（供 chapter.js prev/next 使用）
        const chapters = [];
        for (let i = 1; i <= maxCh; i++) {
            chapters.push({ chapter: i, chapter_title: `第 ${i} 章` });
        }
        data.currentChapters = chapters;

        // 校准章节状态并加载经文
        const target = targetChapter != null ? targetChapter : (state.chapter || 1);
        const validTarget = target <= maxCh ? target : 1;
        state.chapter = validTarget;

        const bk = data.allBooks.find(b => b.id === Number(bookId));
        if (bk) updateTopTitle(bk, validTarget);

        window.loadVersesMulti();
        window.updateAudio();

        return chapters;
    }

    /* ---------- 回退方案（保留兼容） ---------- */
    async function loadChaptersFallback(bookId, targetChapter, fallbackMax) {
        return loadChaptersForBook(bookId, targetChapter);
    }

    /* ---------- 渲染右侧章节网格 ---------- */
    function renderChapters(book) {
        const header = document.getElementById("chapter-list-header");
        const list = document.getElementById("chapter-list");
        if (!list) return;

        // 章节头部：主要版本全名 + 次要版本全名（小字）
        if (header) {
            header.innerHTML = "";

            const mainName = utils.getBookDisplayName(book);
            const mainSpan = document.createElement("span");
            mainSpan.className = "chapter-header-main";
            mainSpan.textContent = mainName;
            header.appendChild(mainSpan);

            // 次要版本全名
            const secondary = state.secondaryVersions || [];
            if (secondary.length > 0) {
                const secField = utils.getFieldForVersion(secondary[0]);
                const currentField = utils.getBookNameField();
                if (secField && secField !== currentField) {
                    const secBucket = book[secField];
                    if (secBucket && secBucket.name && secBucket.name !== mainName) {
                        const subSpan = document.createElement("span");
                        subSpan.className = "chapter-header-sub";
                        subSpan.textContent = secBucket.name;
                        header.appendChild(subSpan);
                    }
                }
            }
        }

        // 根据当前主要版本的 max_chapter 生成章节列表
        const maxCh = getMaxChapterForBook(book);
        if (!maxCh) {
            list.className = "chapter-list";
            list.innerHTML = '<div class="chapter-empty">加载中…</div>';
            return;
        }

        // 同步更新 data.currentChapters（供 chapter.js 的 prev/next 使用）
        data.currentChapters = [];
        for (let i = 1; i <= maxCh; i++) {
            data.currentChapters.push({ chapter: i, chapter_title: `第 ${i} 章` });
        }

        list.innerHTML = "";
        list.className = "chapter-grid";

        for (let i = 1; i <= maxCh; i++) {
            const btn = document.createElement("button");
            btn.className = "chapter-item";
            btn.textContent = i;
            btn.title = `第 ${i} 章`;

            if (Number(state.chapter) === i) {
                btn.classList.add("active");
            }

            btn.addEventListener("click", () => {
                selectChapter(book, i, btn);
            });
            list.appendChild(btn);
        }
    }

    /* ---------- 空状态 ---------- */
    function showChapterEmpty() {
        const header = document.getElementById("chapter-list-header");
        const list = document.getElementById("chapter-list");
        if (header) header.textContent = "选择书卷";
        if (list) {
            list.className = "chapter-list";
            list.innerHTML = '<div class="chapter-empty">← 选择左侧书卷</div>';
        }
    }

    /* ---------- 选中章节（右侧点击） ---------- */
    function selectChapter(book, chapter, btnEl) {
        state.chapter = chapter;

        document.querySelectorAll(".chapter-item").forEach(el => {
            el.classList.remove("active");
        });
        if (btnEl) btnEl.classList.add("active");

        updateTopTitle(book, chapter);
        closeBookPanel();

        window.loadVersesMulti();
        window.updateAudio();
    }

    /* ---------- 更新顶部标题 ---------- */
    function updateTopTitle(book, chapter) {
        const span = document.getElementById("book-btn-text");
        if (span) {
            const ch = chapter || state.chapter || 1;
            const name = utils.getBookDisplayName(book);
            span.textContent = `${name} ${ch}`;
        }
    }

    /* ---------- 切换主要版本后刷新书卷面板全部文字 ---------- */
    function updateBookPanelLanguage() {
        // 1. 重绘书卷列表 + 章节列表（章节数随版本变化）
        renderBooks(data.currentTestament);

        // 2. 更新 Tab 文字（双语）
        updateTabLabels();

        // 3. 更新顶栏标题
        const book = data.allBooks.find(b => b.id === state.book);
        if (book) updateTopTitle(book, state.chapter);
    }

    /* ---------- 更新 Tab 文字（双语：英文 + 中文小字）---------- */
    function updateTabLabels() {
        const field = utils.getBookNameField();   // "en" | "zh_cath" | "zh_prot"
        const cats = data.bookCategories || [];

        // 获取次要版本对应的字段
        const secondary = state.secondaryVersions || [];
        const secField = secondary.length > 0 ? utils.getFieldForVersion(secondary[0]) : null;

        document.querySelectorAll(".book-tab").forEach(tab => {
            const testament = tab.dataset.testament;   // "old_testament" | "new_testament"
            const cat = cats.find(c => c.key === testament);
            if (!cat) return;

            // 清空后重建（支持双语）
            tab.innerHTML = "";

            // 主要版本名称
            const mainBucket = cat[field];
            const mainName = (mainBucket && mainBucket.name) ? mainBucket.name : (testament === "old_testament" ? "Old Testament" : "New Testament");
            const mainSpan = document.createElement("span");
            mainSpan.className = "tab-main";
            mainSpan.textContent = mainName;
            tab.appendChild(mainSpan);

            // 次要版本名称（小字）
            if (secField && secField !== field) {
                const secBucket = cat[secField];
                if (secBucket && secBucket.name && secBucket.name !== mainName) {
                    const subSpan = document.createElement("span");
                    subSpan.className = "tab-sub";
                    subSpan.textContent = secBucket.name;
                    tab.appendChild(subSpan);
                }
            }
        });
    }

    /* ---------- 打开 / 关闭面板 ---------- */
    function openBookPanel() {
        const overlay = document.getElementById("book-overlay");
        const panel = document.getElementById("book-panel");
        if (!overlay || !panel) return;

        overlay.classList.add("open");
        panel.classList.add("open");

        // 判断当前书卷属于哪个 testament
        const testament = findTestamentForBook(state.book);

        // 强制重新渲染（修复新约首次打开不全的 bug）
        renderBooks(testament);

        // 更新 tab 状态
        document.querySelectorAll(".book-tab").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.testament === testament);
        });
        data.currentTestament = testament;

        // 更新 Tab 文字（语言可能已切换）
        updateTabLabels();
    }

    function closeBookPanel() {
        const overlay = document.getElementById("book-overlay");
        const panel = document.getElementById("book-panel");
        if (overlay) overlay.classList.remove("open");
        if (panel) panel.classList.remove("open");
    }

    /* ---------- 根据 bookId 找到所属 testament ---------- */
    function findTestamentForBook(bookId) {
        const cats = data.bookCategories || [];
        for (const cat of cats) {
            // 检查顶层 book_ids
            if (cat.book_ids && cat.book_ids.includes(bookId)) {
                return cat.key;   // "old_testament" / "new_testament"
            }
            // 检查子分类
            const subs = cat.categories || [];
            for (const sub of subs) {
                if (sub.book_ids && sub.book_ids.includes(bookId)) {
                    return cat.key;
                }
            }
        }
        return "old_testament";   // 兜底
    }

    /* ---------- onBookChange（兼容搜索跳转） ---------- */
    function onBookChange(bookId) {
        if (!bookId) return;
        const targetCh = state.chapter || 1;
        loadChaptersForBook(bookId, targetCh);
    }

    /* ============================================================
       导出到全局（供其他模块调用）
       ============================================================ */

    window.initBookSelector = initBookSelector;
    window.bindUI = bindUI;
    window.switchTestament = switchTestament;
    window.renderBooks = renderBooks;
    window.selectBook = selectBook;
    window.loadChaptersForBook = loadChaptersForBook;
    window.selectChapter = selectChapter;
    window.updateTopTitle = updateTopTitle;
    window.updateBookPanelLanguage = updateBookPanelLanguage;
    window.openBookPanel = openBookPanel;
    window.closeBookPanel = closeBookPanel;
    window.onBookChange = onBookChange;
    window.showChapterEmpty = showChapterEmpty;
    window.renderChapters = renderChapters;

})();
