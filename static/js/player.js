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

    // 播放模式：'sequential'（顺序播放）| 'repeat'（单章循环）| 'stop'（播完暂停）
    let playMode = 'sequential';

    let shouldAutoPlay = false;

    /* =========================
       更新音频源（跟随音频版本设置）
       ========================= */
    function updateAudio() {
        const version = state.audioVersion || state.primaryVersion || "en_nrsvce";
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

        const isCurrentlyPlaying = !audio.paused && audio.src;

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

        if (shouldAutoPlay || isCurrentlyPlaying) {
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
       快进 / 快退
       ========================= */
    function skipAudio(seconds) {
        if (!audio.duration) return;
        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
    }

    /* =========================
       播放模式切换
       ========================= */
    const modeOrder = ['sequential', 'repeat', 'stop'];
    const modeTitles = { sequential: '顺序播放', repeat: '单章循环', stop: '播完暂停' };
    const modeIcons = {
        sequential: 'icon-mode-sequential',
        repeat: 'icon-mode-repeat',
        stop: 'icon-mode-stop'
    };

    function togglePlayMode() {
        // 循环切换到下一个模式
        const idx = modeOrder.indexOf(playMode);
        playMode = modeOrder[(idx + 1) % modeOrder.length];

        // 更新图标显示
        Object.keys(modeIcons).forEach(mode => {
            const el = document.getElementById(modeIcons[mode]);
            if (el) el.style.display = mode === playMode ? 'inline-flex' : 'none';
        });

        // 更新按钮 title
        const btn = document.getElementById('play-mode');
        if (btn) btn.title = modeTitles[playMode];

        console.log(`🎵 播放模式 → ${modeTitles[playMode]}`);
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

        if (playMode === 'repeat') {
            // 单章循环
            audio.play().catch(() => { syncPlayButtonIcon(); });
        } else if (playMode === 'sequential') {
            // 顺序播放下一章
            shouldAutoPlay = true;
            window.nextChapter();
        } else {
            // 播完暂停
            syncPlayButtonIcon();
        }
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
    const SKIP_SECONDS = 10;

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
    window.skipAudio = skipAudio;
    window.togglePlayMode = togglePlayMode;
    window.shouldAutoPlay = shouldAutoPlay;  // chapter.js 需要读写

    // 提供 getter/setter 让 chapter.js 能读写 shouldAutoPlay
    Object.defineProperty(window, 'shouldAutoPlay', {
        get: function () { return shouldAutoPlay; },
        set: function (v) { shouldAutoPlay = v; }
    });

})();
