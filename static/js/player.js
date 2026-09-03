/* ========= 音频播放器 ========= */
/*
 * 依赖：config.js, utils.js, verse.js (getAudioUrlFor), chapter.js (prevChapter, nextChapter)
 * 导出到全局的函数：
 *   updateAudio, togglePlay, prevChapterAudio, nextChapterAudio
 */

(function () {
    "use strict";

    var state = window.BibleFlow.state;
    var utils = window.BibleFlow.utils;

    const audio = document.getElementById('audio-player');
    const progress = document.getElementById('progress');
    const playPauseBtn = document.getElementById('play-pause');

    const iconPlay = document.getElementById('icon-play-big');
    const iconPause = document.getElementById('icon-pause-big');

    let shouldAutoPlay = false;

    /* =========================
       更新音频源（跟随主要经文版本）
       ========================= */
    function updateAudio() {
        const version = state.primaryVersion || "en_nrsvce";
        const ver = utils.getVersionConfig(version);

        if (!ver || !ver.has_audio) {
            disablePlayer();
            return;
        }

        const url = utils.getAudioUrlFor(version, state.book, state.chapter);

        if (!url) {
            disablePlayer();
            return;
        }

        if (audio.src === url) return;

        progress.value = 0;
        window.clearWordHighlight();

        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();

        audio._pendingUrl = url;
        enablePlayer();

        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';

        if (shouldAutoPlay) {
            audio.src = url;
            audio.load();
            audio.play().catch(() => {
                syncPlayButtonIcon();
            });
            shouldAutoPlay = false;
        }
    }

    /* =========================
       播放 / 暂停
       ========================= */
    function togglePlay() {
        if (playPauseBtn.disabled) return;

        if (!audio.src && audio._pendingUrl) {
            audio.src = audio._pendingUrl;
            audio.load();
        }

        shouldAutoPlay = false;
        audio.paused ? audio.play() : audio.pause();
    }

    /* =========================
       上一章 / 下一章（音频触发）
       ========================= */
    function prevChapterAudio() {
        shouldAutoPlay = true;
        window.prevChapter();
    }

    function nextChapterAudio() {
        shouldAutoPlay = true;
        window.nextChapter();
    }

    /* =========================
       UI 同步
       ========================= */
    function syncPlayButtonIcon() {
        if (!iconPlay || !iconPause) return;

        if (audio.paused || audio.ended) {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
        } else {
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
        }
    }

    function enablePlayer() {
        playPauseBtn.disabled = false;
        progress.disabled = false;
        playPauseBtn.classList.remove('disabled');
    }

    function disablePlayer() {
        playPauseBtn.disabled = true;
        progress.disabled = true;
        playPauseBtn.classList.add('disabled');

        audio.pause();
        audio.removeAttribute('src');
        audio.load();
    }

    /* =========================
       事件监听
       ========================= */
    progress.addEventListener('input', () => {
        if (!audio.duration) return;
        audio.currentTime = (progress.value / 100) * audio.duration;
    });

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            progress.value = (audio.currentTime / audio.duration) * 100;
        }
        window.highlightWordAt(Math.floor(audio.currentTime * 1000));
    });

    audio.addEventListener('play', syncPlayButtonIcon);
    audio.addEventListener('pause', syncPlayButtonIcon);
    audio.addEventListener('ended', () => {
        audio.currentTime = 0;
        progress.value = 0;
        syncPlayButtonIcon();
        shouldAutoPlay = true;
        window.nextChapter();
    });

    /* =========================
       空格键控制播放 / 暂停
       ========================= */
    document.addEventListener('keydown', (e) => {
        if (e.code !== 'Space' && e.key !== ' ') return;

        const tag = e.target.tagName;
        const isEditable =
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            e.target.isContentEditable;

        if (isEditable) return;
        if (e.altKey || e.ctrlKey || e.metaKey) return;

        e.preventDefault();
        togglePlay();
    });

    /* =========================
       左右箭头快进 / 快退
       ========================= */
    const SKIP_SECONDS = 15;

    document.addEventListener('keydown', (e) => {
        const tag = e.target.tagName;
        const isEditable =
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            e.target.isContentEditable;

        if (isEditable) return;
        if (e.altKey || e.ctrlKey || e.metaKey) return;

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            audio.currentTime = Math.max(0, audio.currentTime - SKIP_SECONDS);
        }

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + SKIP_SECONDS);
        }
    });

    /* ============================================================
       导出到全局
       ============================================================ */

    window.updateAudio = updateAudio;
    window.togglePlay = togglePlay;
    window.prevChapterAudio = prevChapterAudio;
    window.nextChapterAudio = nextChapterAudio;
    window.shouldAutoPlay = shouldAutoPlay;  // chapter.js 需要读写

    // 提供 getter/setter 让 chapter.js 能读写 shouldAutoPlay
    Object.defineProperty(window, 'shouldAutoPlay', {
        get: function () { return shouldAutoPlay; },
        set: function (v) { shouldAutoPlay = v; }
    });

})();
