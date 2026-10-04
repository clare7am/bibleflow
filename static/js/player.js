/* ========= 音频播放器 ========= */
/*
 * 依赖：config.js, utils.js, verse.js (getAudioUrlFor), chapter.js (prevChapter, nextChapter)
 * 导出到全局的函数：
 *   updateAudio, togglePlay, prevChapterAudio, nextChapterAudio, togglePlaybackRate
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

    // 播放速度
    let currentRate = 1;

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

        // 在 pause 之前保存播放状态，使用独立变量确保不会被后续操作影响
        const _wasPlaying = (!audio.paused && audio.src && !audio.ended) ? true : false;

        progress.value = 0;
        window.clearWordHighlight();

        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();

        audio._pendingUrl = url;
        enablePlayer();

        // 中文录音默认 1.25 倍速
        if (version.indexOf("zh_") === 0 && (!state.playbackRate || state.playbackRate === 1)) {
            state.playbackRate = 1.25;
        }
        if (state.playbackRate && state.playbackRate !== 1) {
            audio.playbackRate = state.playbackRate;
        }

        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';

        // 正在播放中切换章节 → 继续播放；暂停时切换 → 保持暂停
        if (_wasPlaying || shouldAutoPlay) {
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
        window.prevChapter();
    }

    function nextChapterAudio() {
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

    // 点击进度条：计算位置，跳转进度，自动播放
    progress.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;

        // 先确保有音频源
        if (!audio.src && audio._pendingUrl) {
            audio.src = audio._pendingUrl;
            audio.load();
        }

        if (audio.duration) {
            audio.currentTime = (pct / 100) * audio.duration;
        }

        // 自动播放
        if (!playPauseBtn.disabled) {
            audio.play().then(() => {
                syncPlayButtonIcon();
            }).catch(() => {
                syncPlayButtonIcon();
            });
        }

        // 添加 active 类让进度条变宽
        this.classList.add('active');
        setTimeout(() => this.classList.remove('active'), 300);
    });

    // 触摸支持（手机端拖拽）
    let touchDragging = false;

    progress.addEventListener('touchstart', function(e) {
        this.classList.add('active');
        touchDragging = true;
        // 立即跳转到触摸位置
        if (audio.duration && e.touches.length === 1) {
            const rect = this.getBoundingClientRect();
            const pct = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
            const clampedPct = Math.max(0, Math.min(100, pct));
            audio.currentTime = (clampedPct / 100) * audio.duration;
            this.value = clampedPct;
        }
    });

    progress.addEventListener('touchmove', function(e) {
        if (!touchDragging || !audio.duration || e.touches.length === 0) return;
        e.preventDefault();
        const rect = this.getBoundingClientRect();
        const pct = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
        const clampedPct = Math.max(0, Math.min(100, pct));
        audio.currentTime = (clampedPct / 100) * audio.duration;
        this.value = clampedPct;
    }, { passive: false });

    progress.addEventListener('touchend', function() {
        this.classList.remove('active');
        touchDragging = false;
    });

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const pct = (audio.currentTime / audio.duration) * 100;
            progress.value = pct;
            // 更新 CSS 变量显示进度
            progress.style.setProperty('--progress', pct + '%');
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
            window.nextChapter(true);
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
       播放速度控制
       ============================================================ */

    function togglePlaybackRate() {
        const menu = document.getElementById('rate-menu');
        if (!menu) return;
        menu.classList.toggle('open');
    }

    function setPlaybackRate(rate) {
        currentRate = rate;
        audio.playbackRate = rate;

        // 更新按钮文字
        var label = document.getElementById('playback-rate-label');
        if (label) label.textContent = rate + 'x';

        // 更新菜单 active 状态
        document.querySelectorAll('.rate-menu-item').forEach(item => {
            item.classList.toggle('active', parseFloat(item.dataset.rate) === rate);
        });

        // 关闭菜单
        const menu = document.getElementById('rate-menu');
        if (menu) menu.classList.remove('open');
    }

    // 菜单项点击事件
    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('.rate-menu-item').forEach(item => {
            item.addEventListener('click', function() {
                setPlaybackRate(parseFloat(this.dataset.rate));
            });
        });

        // 点击其他地方关闭菜单
        document.addEventListener('click', function(e) {
            const menu = document.getElementById('rate-menu');
            const rateBtn = document.getElementById('playback-rate');
            if (menu && !menu.contains(e.target) && !rateBtn.contains(e.target)) {
                menu.classList.remove('open');
            }
        });
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
    window.togglePlaybackRate = togglePlaybackRate;
    window.setPlaybackRate = setPlaybackRate;
    window.shouldAutoPlay = shouldAutoPlay;  // chapter.js 需要读写

    // 提供 getter/seter 让 chapter.js 能读写 shouldAutoPlay
    Object.defineProperty(window, 'shouldAutoPlay', {
        get: function () { return shouldAutoPlay; },
        set: function (v) { shouldAutoPlay = v; }
    });

})();
