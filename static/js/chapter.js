/**
 * chapter.js — 章节切换逻辑
 */

function onChapterChange(chapter, onReady) {
    if (!chapter) return;

    const wasPlaying = !audio.paused && !audio.ended;

    Bible.chapter = chapter;

    const book = window._allBooks?.find(b => b.id === Bible.book);
    if (book) {
        const span = document.getElementById("book-btn-text");
        if (span) span.textContent = `${getBookDisplayName(book)} ${chapter}`;
    }

    loadVersesMulti(onReady);
    updateAudio();

    if (wasPlaying) {
        shouldAutoPlay = true;
    }
}

function getCurrentChapters() {
    return window._currentChapters || [];
}

async function prevChapter() {
    shouldAutoPlay = false;

    const chapters = getCurrentChapters();
    const bookIndex = window._allBooks.findIndex(b => b.id === Bible.book);
    const currentCh = Number(Bible.chapter) || 1;

    if (chapters.length === 0) {
        console.warn("prevChapter: 章节未加载，重新加载当前书卷");
        await loadChaptersForCurrentBook(currentCh);
        return;
    }

    const chIndex = chapters.findIndex(c => Number(c.chapter) === currentCh);

    if (chIndex > 0) {
        const target = chapters[chIndex - 1].chapter;
        Bible.chapter = target;
        onChapterChange(target);
        return;
    }

    // 跨书卷：上一卷最后一章
    if (bookIndex > 0) {
        const prevBook = window._allBooks[bookIndex - 1];
        Bible.book = prevBook.id;
        try {
            const chs = await loadChaptersForBook(prevBook.id, null);
            const lastCh = chs[chs.length - 1].chapter;
            Bible.chapter = lastCh;
            onChapterChange(lastCh);
        } catch (e) {
            console.error("跨卷 prev 失败:", e);
        }
    }
}

async function nextChapter() {
    shouldAutoPlay = false;

    const chapters = getCurrentChapters();
    const bookIndex = window._allBooks.findIndex(b => b.id === Bible.book);
    const currentCh = Number(Bible.chapter) || 1;

    if (chapters.length === 0) {
        console.warn("nextChapter: 章节未加载，重新加载当前书卷");
        await loadChaptersForCurrentBook(currentCh);
        return;
    }

    const chIndex = chapters.findIndex(c => Number(c.chapter) === currentCh);

    if (chIndex >= 0 && chIndex < chapters.length - 1) {
        const target = chapters[chIndex + 1].chapter;
        Bible.chapter = target;
        onChapterChange(target);
        return;
    }

    // 跨书卷：下一卷第一章
    if (bookIndex >= 0 && bookIndex < window._allBooks.length - 1) {
        const nextBook = window._allBooks[bookIndex + 1];
        Bible.book = nextBook.id;
        try {
            const chs = await loadChaptersForBook(nextBook.id, null);
            const firstCh = chs[0].chapter;
            Bible.chapter = firstCh;
            onChapterChange(firstCh);
        } catch (e) {
            console.error("跨卷 next 失败:", e);
        }
    }
}

async function loadChaptersForCurrentBook(fallbackChapter) {
    const target = fallbackChapter || Bible.chapter || 1;
    return loadChaptersForBook(Bible.book, target);
}
