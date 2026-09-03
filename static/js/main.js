/**
 * main.js — 版本选择面板（侧拉式）+ 统一初始化入口
 *
 * 依赖：config.js, utils.js, book.js, verse.js, player.js
 */

(function () {
    "use strict";

    var state = window.BibleFlow.state;
    var cfg = window.BibleFlow.config;
    var utils = window.BibleFlow.utils;

    /* ========= 渲染版本选择面板 ========= */
    function renderVersionPanel() {
        const container = document.getElementById("version-list");
        if (!container) return;

        container.innerHTML = "";

        const primary = state.primaryVersion;
        const secondary = state.secondaryVersions || [];

        // ---- 主要经文（单选）----
        const priTitle = document.createElement("div");
        priTitle.className = "version-section-title";
        priTitle.textContent = "主要经文（单选）";
        container.appendChild(priTitle);

        cfg.versions.forEach(ver => {
            const isPrimary = ver.key === primary;
            const isUnavailable = !ver.available;

            const btn = document.createElement("button");
            btn.className = "version-item";
            if (isPrimary) btn.classList.add("active");
            if (isUnavailable) btn.classList.add("disabled");
            btn.dataset.version = ver.key;

            btn.innerHTML = `
                <span class="version-radio ${isPrimary ? 'on' : ''}"></span>
                <span class="version-label-text">${ver.label}</span>
                ${isUnavailable ? '<span class="version-badge">待更新</span>' : ''}
            `;

            btn.addEventListener("click", () => {
                if (isUnavailable || isPrimary) return;
                selectPrimaryVersion(ver.key);
            });
            container.appendChild(btn);
        });

        // ---- 分隔线 ----
        const divider = document.createElement("div");
        divider.className = "version-divider";
        container.appendChild(divider);

        // ---- 次要经文（多选）----
        const secTitle = document.createElement("div");
        secTitle.className = "version-section-title";
        secTitle.textContent = "次要经文（多选）";
        container.appendChild(secTitle);

        cfg.versions.forEach(ver => {
            const isSecondary = secondary.includes(ver.key);
            const isUnavailable = !ver.available;
            const isThePrimary = ver.key === primary;

            const btn = document.createElement("button");
            btn.className = "version-item";
            if (isSecondary) btn.classList.add("active");
            if (isUnavailable || isThePrimary) btn.classList.add("disabled");
            btn.dataset.version = ver.key;

            btn.innerHTML = `
                <span class="version-checkbox ${isSecondary ? 'on' : ''}"></span>
                <span class="version-label-text">${ver.label}</span>
                ${isUnavailable ? '<span class="version-badge">待更新</span>' : ''}
                ${isThePrimary ? '<span class="version-badge">已设主要</span>' : ''}
            `;

            btn.addEventListener("click", () => {
                if (isUnavailable || isThePrimary) return;
                toggleSecondaryVersion(ver.key);
            });
            container.appendChild(btn);
        });
    }

    /* ========= 选择主要经文（完整流程）========= */
    function selectPrimaryVersion(versionKey) {
        if (versionKey === state.primaryVersion) return;

        // 如果新主要已在次要里，先从次要移除
        state.secondaryVersions = (state.secondaryVersions || [])
            .filter(k => k !== versionKey);

        state.primaryVersion = versionKey;

        console.log(`🔄 主要经文 → ${versionKey}`);

        renderVersionPanel();
        updateVersionButtonLabel();
        // 关键：刷新书卷面板所有文字（书卷名、分类名、Tab名、顶栏标题）
        window.updateBookPanelLanguage();
        closeVersionPanel();

        window.loadVersesMulti();
        window.updateAudio();
    }

    /* ========= 静默切换主要经文（搜索跳转用）========= */
    function selectPrimaryVersionSilent(versionKey) {
        if (versionKey === state.primaryVersion) return;

        state.secondaryVersions = (state.secondaryVersions || [])
            .filter(k => k !== versionKey);

        state.primaryVersion = versionKey;

        renderVersionPanel();
        updateVersionButtonLabel();
        window.updateBookPanelLanguage();

        window.loadVersesMulti();
        window.updateAudio();
    }

    /* ========= 切换次要经文 ========= */
    function toggleSecondaryVersion(versionKey) {
        const list = state.secondaryVersions || [];
        const idx = list.indexOf(versionKey);

        if (idx >= 0) {
            list.splice(idx, 1);
        } else {
            list.push(versionKey);
        }

        state.secondaryVersions = list;
        console.log(`🔄 次要经文 → [${list.join(', ')}]`);

        renderVersionPanel();
        closeVersionPanel();

        window.loadVersesMulti();
    }

    /* ========= 更新顶栏版本标签 ========= */
    function updateVersionButtonLabel() {
        const labelEl = document.getElementById("version-label");
        if (!labelEl) return;

        const pri = utils.getVersionConfig(state.primaryVersion);
        const sec = (state.secondaryVersions || []).map(k => utils.getVersionConfig(k)).filter(Boolean);

        let text = pri ? pri.label : "";
        if (sec.length > 0) {
            text += " + " + sec.map(s => s.label).join("/");
        }
        labelEl.textContent = text;
    }

    /* ========= 主题切换 ========= */
    function initTheme() {
        const saved = localStorage.getItem("bf-theme") || "apple";
        document.documentElement.setAttribute("data-theme", saved);
        updateThemeIcon(saved);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute("data-theme") || "apple";
        const next = current === "apple" ? "mono" : "apple";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("bf-theme", next);
        updateThemeIcon(next);
    }

    function updateThemeIcon(theme) {
        const btn = document.getElementById("theme-toggle");
        if (!btn) return;
        if (theme === "apple") {
            // 太阳图标（切换到黑白）
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>`;
            btn.title = "切换到黑白风格";
        } else {
            // 月亮图标（切换到 Apple）
            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>`;
            btn.title = "切换到蓝白风格";
        }
    }

    /* ========= 打开 / 关闭版本面板 ========= */
    function openVersionPanel() {
        renderVersionPanel();
        const overlay = document.getElementById("version-overlay");
        const panel = document.getElementById("version-panel");
        if (overlay) overlay.classList.add("open");
        if (panel) panel.classList.add("open");
    }

    function closeVersionPanel() {
        const overlay = document.getElementById("version-overlay");
        const panel = document.getElementById("version-panel");
        if (overlay) overlay.classList.remove("open");
        if (panel) panel.classList.remove("open");
    }

    /* ============================================================
       统一初始化入口
       ============================================================ */

    function init() {
        // 0. 初始化主题
        initTheme();
        const themeToggle = document.getElementById("theme-toggle");
        if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

        // 1. 版本面板标签
        updateVersionButtonLabel();

        // 2. 版本面板事件绑定
        const verToggle = document.getElementById("version-toggle");
        const verClose = document.getElementById("version-panel-close");
        const verOverlay = document.getElementById("version-overlay");

        if (verToggle) verToggle.addEventListener("click", openVersionPanel);
        if (verClose) verClose.addEventListener("click", closeVersionPanel);
        if (verOverlay) verOverlay.addEventListener("click", closeVersionPanel);

        // 3. 书卷 + 章节面板初始化
        window.initBookSelector();
    }

    // 页面加载完成后初始化
    window.addEventListener("DOMContentLoaded", init);

    /* ============================================================
       导出到全局
       ============================================================ */

    window.renderVersionPanel = renderVersionPanel;
    window.selectPrimaryVersion = selectPrimaryVersion;
    window.selectPrimaryVersionSilent = selectPrimaryVersionSilent;
    window.toggleSecondaryVersion = toggleSecondaryVersion;
    window.updateVersionButtonLabel = updateVersionButtonLabel;
    window.openVersionPanel = openVersionPanel;
    window.closeVersionPanel = closeVersionPanel;
    window.init = init;

})();
