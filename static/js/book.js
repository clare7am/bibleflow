/* ========= 书卷 + 章节 并排侧拉面板 ========= */

window._allBooks = [];
window._bookCategories = null;          // 顶层分类数组（含 old_testament / new_testament）
window._currentTestament = "old_testament";
window._currentChapters = [];

/* ---------- 初始化 ---------- */
async function initBookSelector() {
    try {
        const [booksResp, catResp] = await Promise.all([
            fetch(`${window.OSS_JSON_BASE}/_global/books.json?v=${window.APP_VERSION}`),
            fetch(`${window.OSS_JSON_BASE}/_global/categories.json?v=${window.APP_VERSION}`)
        ]);

        if (!booksResp.ok) throw new Error(`books.json 加载失败: HTTP ${booksResp.status}`);
        if (!catResp.ok) throw new Error(`categories.json 加载失败: HTTP ${catResp.status}`);

        window._allBooks = await booksResp.json();
        window._bookCategories = await catResp.json();

        // 默认：创世纪 第1章
        const first = window._allBooks[0];
        Bible.book = first.id;
        Bible.chapter = 1;

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
    if (topPrev) topPrev.addEventListener("click", prevChapter);
    if (topNext) topNext.addEventListener("click", nextChapter);

    // 默认渲染旧约
    renderBooks("old_testament");
}

/* ---------- Tab 切换 ---------- */
function switchTestament(testament) {
    window._currentTestament = testament;
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

    const cats = window._bookCategories || [];
    // 找到当前 testament 的顶层分类对象
    const testamentCat = cats.find(c => c.key === testament) || null;

    if (!testamentCat) {
        // 没有分类信息，显示全部
        const grid = document.createElement("div");
        grid.className = "book-grid";
        appendBookButtons(window._allBooks, grid);
        list.appendChild(grid);
    } else {
        // 子分类数组（可能叫 "categories" 或直接在顶层）
        const subCats = testamentCat.categories || [];

        if (subCats.length > 0) {
            // 按子分类分组渲染
            subCats.forEach(subCat => {
                const subBookIds = subCat.book_ids || [];
                const subBooks = window._allBooks.filter(b => subBookIds.includes(b.id));
                if (subBooks.length === 0) return;

                const catTitle = document.createElement("div");
                catTitle.className = "book-cat-title";
                catTitle.textContent = getCategoryLabel(subCat);
                list.appendChild(catTitle);

                const grid = document.createElement("div");
                grid.className = "book-grid";
                appendBookButtons(subBooks, grid);
                list.appendChild(grid);
            });
        } else {
            // 无子分类，按 testament 的 book_ids 直接列出
            const bookIds = testamentCat.book_ids || [];
            const books = window._allBooks.filter(b => bookIds.includes(b.id));
            const grid = document.createElement("div");
            grid.className = "book-grid";
            appendBookButtons(books, grid);
            list.appendChild(grid);
        }
    }

    // 渲染右侧章节
    const currentBook = window._allBooks.find(b => b.id === Bible.book);
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
        item.textContent = getBookAbbr(book);
        item.title = getBookDisplayName(book);
        item.dataset.bookId = book.id;

        if (Number(Bible.book) === book.id) {
            item.classList.add("active");
        }

        item.addEventListener("click", () => selectBook(book));
        container.appendChild(item);
    });
}

/* ---------- 选中书卷（左侧点击） ---------- */
function selectBook(book) {
    Bible.book = book.id;
    const ch = Bible.chapter || 1;
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
    const bookStr = String(bookId).padStart(2, "0");

    // 尝试从 OSS 加载章节列表
    const url = `${window.OSS_JSON_BASE}/_global/chapters/${bookStr}.json?v=${window.APP_VERSION}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`章节列表不存在: ${url}`);

        const data = await res.json();
        const chapters = Array.isArray(data) ? data : (data.chapters || data.verses || []);

        window._currentChapters = chapters;
        finalizeChapterLoad(bookId, targetChapter, chapters);
        return chapters;
    } catch (err) {
        console.warn("⚠️ 章节列表远程加载失败，使用回退方案:", err.message);
        return loadChaptersFallback(bookId, targetChapter);
    }
}

/* ---------- 回退方案：根据 books.json 的 chapter_count 生成 ---------- */
async function loadChaptersFallback(bookId, targetChapter) {
    const book = window._allBooks.find(b => b.id === bookId);
    const maxCh = (book && book.chapter_count) || 50;

    const chapters = [];
    for (let i = 1; i <= maxCh; i++) {
        chapters.push({ chapter: i, chapter_title: `第 ${i} 章` });
    }

    window._currentChapters = chapters;
    finalizeChapterLoad(bookId, targetChapter, chapters);
    return chapters;
}

/* ---------- 章节加载完成后的统一处理 ---------- */
function finalizeChapterLoad(bookId, targetChapter, chapters) {
    const requested = targetChapter != null ? targetChapter : (Bible.chapter || 1);
    const exists = chapters.some(c => Number(c.chapter) === Number(requested));
    const target = exists ? requested : chapters[0].chapter;

    Bible.chapter = target;

    const book = window._allBooks.find(b => b.id === Number(bookId));
    if (book) updateTopTitle(book, target);

    loadVersesMulti();
    updateAudio();
}

/* ---------- 渲染右侧章节网格 ---------- */
function renderChapters(book) {
    const header = document.getElementById("chapter-list-header");
    const list = document.getElementById("chapter-list");
    if (!list) return;

    if (header) header.textContent = getBookDisplayName(book);

    const chapters = window._currentChapters;
    if (!chapters || chapters.length === 0) {
        list.className = "chapter-list";
        list.innerHTML = '<div class="chapter-empty">加载中…</div>';
        return;
    }

    list.innerHTML = "";
    list.className = "chapter-grid";

    chapters.forEach(item => {
        const btn = document.createElement("button");
        btn.className = "chapter-item";
        btn.textContent = item.chapter;
        btn.title = item.chapter_title || `第 ${item.chapter} 章`;

        if (Number(Bible.chapter) === Number(item.chapter)) {
            btn.classList.add("active");
        }

        btn.addEventListener("click", () => {
            selectChapter(book, item.chapter, btn);
        });
        list.appendChild(btn);
    });
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
    Bible.chapter = chapter;

    document.querySelectorAll(".chapter-item").forEach(el => {
        el.classList.remove("active");
    });
    if (btnEl) btnEl.classList.add("active");

    updateTopTitle(book, chapter);
    closeBookPanel();

    loadVersesMulti();
    updateAudio();
}

/* ---------- 更新顶部标题 ---------- */
function updateTopTitle(book, chapter) {
    const span = document.getElementById("book-btn-text");
    if (span) {
        const ch = chapter || Bible.chapter || 1;
        const name = getBookDisplayName(book);
        span.textContent = `${name} ${ch}`;
    }
}

/* ---------- 切换主要版本后刷新书卷面板全部文字 ---------- */
function updateBookPanelLanguage() {
    // 1. 重绘书卷列表（书卷名 + 分类标题语言切换）
    renderBooks(window._currentTestament);

    // 2. 更新 Tab 文字（旧约/新约 → 跟随语言）
    updateTabLabels();

    // 3. 更新右侧章节头部（当前书卷名）
    const book = window._allBooks.find(b => b.id === Bible.book);
    if (book) {
        const header = document.getElementById("chapter-list-header");
        if (header) header.textContent = getBookDisplayName(book);
        // 更新 title 属性
        document.querySelectorAll(".book-item").forEach(el => {
            const bid = Number(el.dataset.bookId);
            const b = window._allBooks.find(x => x.id === bid);
            if (b) el.title = getBookDisplayName(b);
        });
    }

    // 4. 更新顶栏标题
    if (book) updateTopTitle(book, Bible.chapter);
}

/* ---------- 更新 Tab 文字（旧约/新约 → 跟随语言）---------- */
function updateTabLabels() {
    const field = getBookNameField();   // "en" | "zh_cath" | "zh_prot"
    const cats = window._bookCategories || [];

    document.querySelectorAll(".book-tab").forEach(tab => {
        const testament = tab.dataset.testament;   // "old_testament" | "new_testament"
        const cat = cats.find(c => c.key === testament);
        if (!cat) return;

        const bucket = cat[field];
        if (bucket && bucket.name) {
            tab.textContent = bucket.name;
        } else {
            // 兜底
            tab.textContent = testament === "old_testament" ? "旧约" : "新约";
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
    const testament = findTestamentForBook(Bible.book);

    // 强制重新渲染（修复新约首次打开不全的 bug）
    renderBooks(testament);

    // 更新 tab 状态
    document.querySelectorAll(".book-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.testament === testament);
    });
    window._currentTestament = testament;

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
    const cats = window._bookCategories || [];
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
    const targetCh = Bible.chapter || 1;
    loadChaptersForBook(bookId, targetCh);
}
