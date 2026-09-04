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

    /* ========= 渲染版本选择面板（拖拽排序） ========= */
    function renderVersionPanel() {
        const container = document.getElementById("version-list");
        if (!container) return;

        container.innerHTML = "";

        const primary = state.primaryVersion;
        const secondary = state.secondaryVersions || [];
        const enabled = [primary, ...secondary];
        const disabled = cfg.versions.filter(v => v.key !== primary && !secondary.includes(v.key));

        console.log(`[renderVersionPanel] primary=${primary}, secondary=[${secondary.join(", ")}], enabled=[${enabled.join(", ")}]`);

        // ---- 已启用区域 ----
        const enabledSection = document.createElement("div");
        enabledSection.className = "version-section";
        enabledSection.dataset.section = "enabled";

        const enabledTitle = document.createElement("div");
        enabledTitle.className = "version-section-title";
        enabledTitle.textContent = `已启用（拖拽排序，排第一为主要经文）`;
        enabledSection.appendChild(enabledTitle);

        const enabledList = document.createElement("div");
        enabledList.className = "version-sortable-list";
        enabledList.dataset.section = "enabled";

        enabled.forEach(key => {
            const ver = utils.getVersionConfig(key);
            if (!ver) return;
            const item = buildVersionItem(ver, key === primary);
            enabledList.appendChild(item);
        });

        enabledSection.appendChild(enabledList);
        container.appendChild(enabledSection);

        // ---- 未启用区域 ----
        const disabledSection = document.createElement("div");
        disabledSection.className = "version-section";
        disabledSection.dataset.section = "disabled";

        const disabledTitle = document.createElement("div");
        disabledTitle.className = "version-section-title";
        disabledTitle.textContent = "未启用（可拖入已启用）";
        disabledSection.appendChild(disabledTitle);

        const disabledList = document.createElement("div");
        disabledList.className = "version-sortable-list";
        disabledList.dataset.section = "disabled";

        disabled.forEach(ver => {
            const item = buildVersionItem(ver, false);
            disabledList.appendChild(item);
        });

        disabledSection.appendChild(disabledList);
        container.appendChild(disabledSection);

        // ---- 音频设置区域 ----
        const audioSection = document.createElement("div");
        audioSection.className = "version-section";
        audioSection.style.marginTop = "16px";
        audioSection.style.paddingTop = "16px";
        audioSection.style.borderTop = "1px solid var(--border)";

        const audioTitle = document.createElement("div");
        audioTitle.className = "version-section-title";
        audioTitle.textContent = "音频朗读版本";
        audioSection.appendChild(audioTitle);

        const audioSelect = document.createElement("select");
        audioSelect.className = "version-audio-select";
        audioSelect.id = "version-audio-select";

        cfg.versions.forEach(ver => {
            const opt = document.createElement("option");
            opt.value = ver.key;
            opt.textContent = ver.label;
            if (!ver.has_audio) {
                opt.disabled = true;
                opt.textContent += "（无音频）";
            }
            audioSelect.appendChild(opt);
        });

        // 设置当前音频版本
        const currentAudio = state.audioVersion || "en_nrsvce";
        audioSelect.value = cfg.versions.find(v => v.key === currentAudio && v.has_audio)
            ? currentAudio
            : "en_nrsvce";

        audioSelect.addEventListener("change", () => {
            state.audioVersion = audioSelect.value;
            window.updateAudio();
        });

        audioSection.appendChild(audioSelect);
        container.appendChild(audioSection);

        // ---- 初始化拖拽 ----
        initDragDrop();
    }

    /** 构建单个版本项（含拖拽属性） */
    function buildVersionItem(ver, isPrimary) {
        const item = document.createElement("div");
        item.className = "version-item draggable" + (isPrimary ? " is-primary" : "");
        item.draggable = true;
        item.dataset.version = ver.key;

        const dragIcon = document.createElement("span");
        dragIcon.className = "version-drag-handle";
        dragIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>';
        item.appendChild(dragIcon);

        if (isPrimary) {
            const badge = document.createElement("span");
            badge.className = "version-primary-badge";
            badge.textContent = "主要";
            item.appendChild(badge);
        }

        const label = document.createElement("span");
        label.className = "version-label-text";
        label.textContent = ver.label;
        item.appendChild(label);

        if (!ver.available) {
            const badge = document.createElement("span");
            badge.className = "version-badge";
            badge.textContent = "待更新";
            item.appendChild(badge);
        }

        return item;
    }

    /** 初始化拖拽排序（桌面 + 移动端） */
    function initDragDrop() {
        const lists = document.querySelectorAll(".version-sortable-list");
        let draggedItem = null;
        let draggedFrom = null;
        let touchClone = null;  // 移动端浮动元素
        let touchStartY = 0;

        lists.forEach(list => {
            // ===== 桌面 Drag & Drop =====
            list.addEventListener("dragstart", function (e) {
                draggedItem = e.target.closest(".draggable");
                if (!draggedItem) return;
                draggedFrom = list;
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", draggedItem.dataset.version);
                setTimeout(() => draggedItem.classList.add("dragging"), 0);
            });

            list.addEventListener("dragend", function () {
                if (draggedItem) draggedItem.classList.remove("dragging");
                document.querySelectorAll(".version-sortable-list").forEach(l => {
                    l.classList.remove("drag-over");
                });
                draggedItem = null;
                draggedFrom = null;
            });

            list.addEventListener("dragover", function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                list.classList.add("drag-over");
            });

            list.addEventListener("dragleave", function (e) {
                if (!list.contains(e.relatedTarget)) {
                    list.classList.remove("drag-over");
                }
            });

            list.addEventListener("drop", function (e) {
                e.preventDefault();
                list.classList.remove("drag-over");
                if (!draggedItem) return;

                const targetList = list;
                const afterElement = getDragAfterElement(targetList, e.clientY);

                if (!canMoveTo(targetList)) return;

                moveItem(draggedItem, targetList, afterElement);
                draggedItem.classList.remove("dragging");
                draggedItem = null;
                draggedFrom = null;
            });

            // ===== 移动端 Touch 支持 =====
            list.addEventListener("touchstart", function (e) {
                const item = e.target.closest(".draggable");
                if (!item) return;

                draggedItem = item;
                draggedFrom = list;
                touchStartY = e.touches[0].clientY;

                // 创建浮动镜像
                touchClone = item.cloneNode(true);
                touchClone.style.cssText = "position:fixed;z-index:99999;pointer-events:none;opacity:0.85;width:" + item.offsetWidth + "px;background:var(--bg);box-shadow:0 4px 12px rgba(0,0,0,0.15);border-radius:8px;";
                touchClone.classList.add("dragging");
                document.body.appendChild(touchClone);
                positionTouchClone(e.touches[0]);

                item.style.opacity = "0.3";
            }, { passive: true });

            list.addEventListener("touchmove", function (e) {
                if (!touchClone) return;
                e.preventDefault();
                positionTouchClone(e.touches[0]);

                // 高亮目标列表
                document.querySelectorAll(".version-sortable-list").forEach(l => l.classList.remove("drag-over"));
                const target = getElementFromPoint(e.touches[0].clientX, e.touches[0].clientY, ".version-sortable-list");
                if (target) target.classList.add("drag-over");
            }, { passive: false });

            list.addEventListener("touchend", function (e) {
                if (!draggedItem || !touchClone) {
                    cleanupTouch();
                    return;
                }

                const touch = e.changedTouches[0];
                const targetList = getElementFromPoint(touch.clientX, touch.clientY, ".version-sortable-list");

                if (targetList && canMoveTo(targetList)) {
                    const afterElement = getDragAfterElement(targetList, touch.clientY);
                    moveItem(draggedItem, targetList, afterElement);
                }

                cleanupTouch();
            });
        });

        function positionTouchClone(touch) {
            if (!touchClone) return;
            touchClone.style.left = (touch.clientX - 30) + "px";
            touchClone.style.top = (touch.clientY - 20) + "px";
        }

        function getElementFromPoint(x, y, selector) {
            const el = document.elementFromPoint(x, y);
            if (!el) return null;
            return el.closest(selector) || el.querySelector(selector);
        }

        function cleanupTouch() {
            if (touchClone) {
                touchClone.remove();
                touchClone = null;
            }
            if (draggedItem) {
                draggedItem.style.opacity = "";
            }
            document.querySelectorAll(".version-sortable-list").forEach(l => l.classList.remove("drag-over"));
            draggedItem = null;
            draggedFrom = null;
        }

        /** 检查是否允许移动到此列表 */
        function canMoveTo(targetList) {
            if (!draggedItem) return false;
            const isToDisabled = targetList.dataset.section === "disabled";
            const enabledList = document.querySelector('.version-sortable-list[data-section="enabled"]');
            if (isToDisabled && enabledList && enabledList.children.length <= 1) {
                showToast("至少需要一个已启用的译本");
                return false;
            }
            return true;
        }

        /** 移动 DOM 元素并同步 state */
        function moveItem(item, targetList, beforeElement) {
            if (item.parentNode) item.parentNode.removeChild(item);
            if (beforeElement) {
                targetList.insertBefore(item, beforeElement);
            } else {
                targetList.appendChild(item);
            }
            syncStateFromDOM();
        }

        /** 获取拖拽位置之后的元素 */
        function getDragAfterElement(list, y) {
            const items = [...list.querySelectorAll(".draggable:not(.dragging)")];
            return items.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = box.top + box.height / 2 - y;
                return offset > 0 && offset < closest.offset ? { offset, element: child } : closest;
            }, { offset: Number.MAX_VALUE }).element;
        }
    }

    /** 从 DOM 同步 state */
    function syncStateFromDOM() {
        const enabledList = document.querySelector('.version-sortable-list[data-section="enabled"]');
        const items = [...enabledList.querySelectorAll(".draggable")];
        const keys = items.map(el => el.dataset.version);

        if (keys.length === 0) return;

        const newPrimary = keys[0];
        const newSecondary = keys.slice(1);

        const primaryChanged = newPrimary !== state.primaryVersion;
        const oldPrimary = state.primaryVersion;

        state.primaryVersion = newPrimary;
        state.secondaryVersions = newSecondary;

        console.log(`🔄 版本顺序 → 主要: ${oldPrimary} → ${newPrimary}, 次要: [${newSecondary.join(", ")}]`);
        console.log(`   state.primaryVersion 现在是: ${state.primaryVersion}`);

        // 立即更新主要版本标记（在重新渲染前）
        items.forEach((el, i) => {
            el.classList.toggle("is-primary", i === 0);
            const existingBadge = el.querySelector(".version-primary-badge");
            if (i === 0 && !existingBadge) {
                const badge = document.createElement("span");
                badge.className = "version-primary-badge";
                badge.textContent = "主要";
                el.insertBefore(badge, el.querySelector(".version-label-text"));
            } else if (i !== 0 && existingBadge) {
                existingBadge.remove();
            }
        });

        // 更新顶栏按钮标签
        updateVersionButtonLabel();

        if (primaryChanged) {
            window.updateBookPanelLanguage();
        }

        window.loadVersesMulti();
        window.updateAudio();
    }

    /** 显示提示 */
    function showToast(msg) {
        let toast = document.getElementById("toast-msg");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "toast-msg";
            toast.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--bg-secondary);color:var(--text-primary);padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;opacity:0;transition:opacity .2s;pointer-events:none;";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = "1";
        clearTimeout(window._toastTimer);
        window._toastTimer = setTimeout(() => { toast.style.opacity = "0"; }, 2000);
    }

    /* ========= 兼容 stub（供外部直接调用） ========= */
    function selectPrimaryVersion(versionKey) {
        // 拖拽模式下不直接使用，但保留以防外部调用
        if (versionKey === state.primaryVersion) return;
        state.secondaryVersions = (state.secondaryVersions || []).filter(k => k !== versionKey);
        state.primaryVersion = versionKey;
        renderVersionPanel();
        updateVersionButtonLabel();
        window.updateBookPanelLanguage();
        window.loadVersesMulti();
        window.updateAudio();
    }

    function selectPrimaryVersionSilent(versionKey) {
        if (versionKey === state.primaryVersion) return;
        state.secondaryVersions = (state.secondaryVersions || []).filter(k => k !== versionKey);
        state.primaryVersion = versionKey;
        renderVersionPanel();
        updateVersionButtonLabel();
        window.updateBookPanelLanguage();
        window.loadVersesMulti();
        window.updateAudio();
    }

    function toggleSecondaryVersion(versionKey) {
        const list = state.secondaryVersions || [];
        const idx = list.indexOf(versionKey);
        if (idx >= 0) list.splice(idx, 1); else list.push(versionKey);
        state.secondaryVersions = list;
        renderVersionPanel();
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
