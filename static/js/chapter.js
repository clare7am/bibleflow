/**
 * chapter.js — 章节切换逻辑
 *
 * 依赖：config.js, utils.js, book.js (loadChaptersForBook), verse.js (loadVersesMulti, updateAudio)
 */

(function () {
    "use strict";

    var state = window.BibleFlow.state;
    var data = window.BibleFlow.data;
    var utils = window.BibleFlow.utils;

    function onChapterChange(chapter, onReady) {
        if (!chapter) return;

        const audio = document.getElementById('audio-player');
        const wasPlaying = audio && !audio.paused && !audio.ended;

        state.chapter = chapter;

        const book = data.allBooks?.find(b => b.id === state.book);
        if (book) {
            const span = document.getElementById("book-btn-text");
            if (span) span.textContent = `${utils.getBookDisplayName(book)} ${chapter}`;
        }

        window.loadVersesMulti(onReady);
        window.updateAudio();

        if (wasPlaying) {
            window.shouldAutoPlay = true;
        }
    }

    function getCurrentChapters() {
        return data.currentChapters || [];
    }

    async function prevChapter() {
        window.shouldAutoPlay = false;

        let chapters = getCurrentChapters();
        const bookIndex = data.allBooks.findIndex(b => b.id === state.book);
        const currentCh = Number(state.chapter) || 1;

        // 如果章节未加载，先加载再继续
        if (chapters.length === 0) {
            await loadChaptersForCurrentBook(currentCh);
            chapters = getCurrentChapters();
        }

        const chIndex = chapters.findIndex(c => Number(c.chapter) === currentCh);

        if (chIndex > 0) {
            const target = chapters[chIndex - 1].chapter;
            state.chapter = target;
            onChapterChange(target);
            return;
        }

        // 跨书卷：上一卷最后一章
        if (bookIndex > 0) {
            const prevBook = data.allBooks[bookIndex - 1];
            state.book = prevBook.id;
            try {
                const chs = await window.loadChaptersForBook(prevBook.id, null);
                const lastCh = chs[chs.length - 1].chapter;
                state.chapter = lastCh;
                onChapterChange(lastCh);
            } catch (e) {
                console.error("跨卷 prev 失败:", e);
            }
        }
    }

    async function nextChapter() {
        window.shouldAutoPlay = false;

        let chapters = getCurrentChapters();
        const bookIndex = data.allBooks.findIndex(b => b.id === state.book);
        const currentCh = Number(state.chapter) || 1;

        // 如果章节未加载，先加载再继续
        if (chapters.length === 0) {
            await loadChaptersForCurrentBook(currentCh);
            chapters = getCurrentChapters();
        }

        const chIndex = chapters.findIndex(c => Number(c.chapter) === currentCh);

        if (chIndex >= 0 && chIndex < chapters.length - 1) {
            const target = chapters[chIndex + 1].chapter;
            state.chapter = target;
            onChapterChange(target);
            return;
        }

        // 跨书卷：下一卷第一章
        if (bookIndex >= 0 && bookIndex < data.allBooks.length - 1) {
            const nextBook = data.allBooks[bookIndex + 1];
            state.book = nextBook.id;
            try {
                const chs = await window.loadChaptersForBook(nextBook.id, null);
                const firstCh = chs[0].chapter;
                state.chapter = firstCh;
                onChapterChange(firstCh);
            } catch (e) {
                console.error("跨卷 next 失败:", e);
            }
        }
    }

    async function loadChaptersForCurrentBook(fallbackChapter) {
        const target = fallbackChapter || state.chapter || 1;
        return window.loadChaptersForBook(state.book, target);
    }

    /* ============================================================
       导出到全局
       ============================================================ */

    window.onChapterChange = onChapterChange;
    window.getCurrentChapters = getCurrentChapters;
    window.prevChapter = prevChapter;
    window.nextChapter = nextChapter;
    window.loadChaptersForCurrentBook = loadChaptersForCurrentBook;

})();
