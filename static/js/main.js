/**
 * main.js — Unified panel management + display settings + version drag-drop
 *
 * Dependencies: config.js, utils.js, book.js, verse.js, player.js
 *
 * Exports:
 *   openPanel, closePanel, renderVersionPanel,
 *   selectPrimaryVersion, selectPrimaryVersionSilent, toggleSecondaryVersion,
 *   updateVersionButtonLabel, init, updateMiniPlayerTitle
 */

(function () {
    "use strict";

    var state = window.BibleFlow.state;
    var cfg = window.BibleFlow.config;
    var utils = window.BibleFlow.utils;

    /* ============================================================
       Panel types and state
       ============================================================ */

    var panelTypes = ["book", "version", "display", "search", "audio"];

    /* ============================================================
       Unified panel open / close
       ============================================================ */

    function openPanel(type) {
        var sidePanel = document.getElementById("side-panel");
        if (!sidePanel) return;

        // If the requested panel is already open, close it (toggle)
        if (state.activePanel === type) {
            closePanel();
            return;
        }

        // Set side-panel open state
        sidePanel.classList.add("open");
        sidePanel.setAttribute("data-active", type);

        // 搜索/显示/音频面板：移入文档流，在经文区下方
        if (type === "search" || type === "display" || type === "audio") {
            sidePanel.style.position = "relative";
            sidePanel.style.top = "";
            sidePanel.style.left = "";
            sidePanel.style.right = "";
            sidePanel.style.bottom = "";
            sidePanel.style.zIndex = "";
        } else {
            sidePanel.style.position = "";
        }

        // Hide all panels, show the requested one
        var panels = sidePanel.querySelectorAll(".panel-content");
        for (var i = 0; i < panels.length; i++) {
            panels[i].classList.remove("active");
            panels[i].setAttribute("hidden", "");
        }

        var target = sidePanel.querySelector('.panel-content[data-panel="' + type + '"]');
        if (target) {
            target.classList.add("active");
            target.removeAttribute("hidden");
        }

        state.activePanel = type;

        // Sync bottom tab bar active state
        syncTabBarState(type);

        // Panel-specific initialization
        if (type === "version") {
            renderVersionPanel();
        } else if (type === "display") {
            syncDisplayPanel();
        } else if (type === "audio") {
            renderAudioVersionList();
            initAudioVersionToggle();
        } else if (type === "search") {
            focusSearchInput();
        }
    }

    function closePanel() {
        var sidePanel = document.getElementById("side-panel");
        if (!sidePanel) return;

        sidePanel.classList.remove("open");
        sidePanel.removeAttribute("data-active");
        sidePanel.style.position = "";

        var panels = sidePanel.querySelectorAll(".panel-content");
        for (var i = 0; i < panels.length; i++) {
            panels[i].classList.remove("active");
            panels[i].setAttribute("hidden", "");
        }

        state.activePanel = null;
        syncTabBarState(null);
    }

    function syncTabBarState(type) {
        var tabBar = document.getElementById("bottom-tab-bar");
        if (!tabBar) return;
        var btns = tabBar.querySelectorAll(".tab-btn");
        for (var i = 0; i < btns.length; i++) {
            var p = btns[i].getAttribute("data-panel");
            if (p === type) {
                btns[i].classList.add("active");
            } else {
                btns[i].classList.remove("active");
            }
        }
    }

    /* ============================================================
       Display panel
       ============================================================ */

    function syncDisplayPanel() {
        // Verse number toggle
        var verseBtn = document.getElementById("display-verse-num");
        if (verseBtn) {
            if (state.showVerseNum) {
                verseBtn.classList.add("on");
            } else {
                verseBtn.classList.remove("on");
            }
        }

        // Reading mode toggle
        var readBtn = document.getElementById("display-reading-mode");
        if (readBtn) {
            if (state.readingMode) {
                readBtn.classList.add("on");
            } else {
                readBtn.classList.remove("on");
            }
        }

        // Font size slider
        var slider = document.getElementById("font-size-slider");
        var valueSpan = document.getElementById("font-size-value");
        if (slider) {
            var currentSize = parseInt(slider.getAttribute("value"), 10) || 18;
            slider.setAttribute("value", currentSize);
            slider.value = currentSize;
            applyFontSize(currentSize);
        }
        if (valueSpan) {
            valueSpan.textContent = (slider ? slider.value : 18) + "px";
        }

        // Font family select
        var fontSelect = document.getElementById("font-family-select");
        if (fontSelect) {
            fontSelect.value = state.fontFamily || "default";
            applyFontFamily(state.fontFamily || "default");
        }
    }

    function applyFontSize(px) {
        var container = document.getElementById("verses");
        if (container) {
            container.style.setProperty("--verse-font-size", px + "px");
            // 直接设置经文元素字号
            var verseTexts = container.querySelectorAll(".verse-text");
            for (var i = 0; i < verseTexts.length; i++) {
                verseTexts[i].style.fontSize = px + "px";
            }
            var verseSecondary = container.querySelectorAll(".verse-secondary");
            for (var i = 0; i < verseSecondary.length; i++) {
                verseSecondary[i].style.fontSize = (px - 4) + "px";
            }
        }
    }

    function applyFontFamily(family, type) {
        var container = document.getElementById("verses");
        if (!container) return;

        var zhClasses = ["font-zh-simsun", "font-zh-kaiti"];
        var enClasses = ["font-en-serif", "font-en-sans"];
        var allClasses = zhClasses.concat(enClasses);
        var verseTexts = container.querySelectorAll(".verse-text, .verse-secondary");

        for (var i = 0; i < verseTexts.length; i++) {
            for (var j = 0; j < allClasses.length; j++) {
                verseTexts[i].classList.remove(allClasses[j]);
            }
            if (family && family !== "default") {
                var prefix = type === "zh" ? "font-zh-" : "font-en-";
                verseTexts[i].classList.add(prefix + family);
            }
        }
    }

    function initDisplayPanel() {
        // Verse number toggle
        var verseBtn = document.getElementById("display-verse-num");
        if (verseBtn) {
            verseBtn.addEventListener("click", function () {
                state.showVerseNum = !state.showVerseNum;
                verseBtn.classList.toggle("on", state.showVerseNum);
                var container = document.getElementById("verses");
                if (container) {
                    container.classList.toggle("verse-num-hidden", !state.showVerseNum);
                }
            });
        }

        // Reading mode toggle
        var readBtn = document.getElementById("display-reading-mode");
        if (readBtn) {
            readBtn.addEventListener("click", function () {
                state.readingMode = !state.readingMode;
                readBtn.classList.toggle("on", state.readingMode);
                var container = document.getElementById("verses");
                if (container) {
                    container.classList.toggle("reading-mode", state.readingMode);
                }
                if (state.book && state.chapter) {
                    window.loadVersesMulti();
                }
            });
        }

        // Font size slider
        var slider = document.getElementById("font-size-slider");
        var valueSpan = document.getElementById("font-size-value");
        if (slider) {
            slider.setAttribute("min", "14");
            slider.setAttribute("max", "24");
            slider.setAttribute("value", "18");
            slider.addEventListener("input", function () {
                var val = parseInt(slider.value, 10);
                applyFontSize(val);
                if (valueSpan) {
                    valueSpan.textContent = val + "px";
                }
            });
        }

        // Font family selects — 根据主要版本语言显示/隐藏
        var fontRow = document.querySelector(".display-row-fonts");
        var zhSelect = document.getElementById("font-zh-select");
        var enSelect = document.getElementById("font-en-select");
        var pv = state.primaryVersion || "";
        var isEn = pv.indexOf("en_") === 0;

        if (fontRow) fontRow.hidden = false; // 始终显示，但内部 select 根据版本启用/禁用

        if (zhSelect) {
            zhSelect.disabled = isEn;
            zhSelect.value = state.fontZh || "default";
            zhSelect.addEventListener("change", function () {
                state.fontZh = zhSelect.value;
                applyFontFamily(zhSelect.value, "zh");
            });
            applyFontFamily(state.fontZh || "default", "zh");
        }
        if (enSelect) {
            enSelect.disabled = !isEn;
            enSelect.value = state.fontEn || "default";
            enSelect.addEventListener("change", function () {
                state.fontEn = enSelect.value;
                applyFontFamily(enSelect.value, "en");
            });
            applyFontFamily(state.fontEn || "default", "en");
        }

        // Set initial state
        state.showVerseNum = true;
    }

    /* ============================================================
       Version panel — render + drag-drop
       ============================================================ */

    function renderVersionPanel() {
        var container = document.getElementById("version-list");
        if (!container) return;

        container.innerHTML = "";

        var primary = state.primaryVersion;
        var secondary = state.secondaryVersions || [];
        var enabled = [primary].concat(secondary);
        var disabled = [];
        for (var i = 0; i < cfg.versions.length; i++) {
            var v = cfg.versions[i];
            if (v.key !== primary && secondary.indexOf(v.key) < 0) {
                disabled.push(v);
            }
        }

        // ---- Enabled section ----
        var enabledSection = document.createElement("div");
        enabledSection.className = "version-section";
        enabledSection.setAttribute("data-section", "enabled");

        var enabledTitle = document.createElement("div");
        enabledTitle.className = "version-section-title";
        enabledTitle.textContent = "已启用（拖拽排序，排第一为主要经文）";
        enabledSection.appendChild(enabledTitle);

        var enabledList = document.createElement("div");
        enabledList.className = "version-sortable-list";
        enabledList.setAttribute("data-section", "enabled");

        for (var j = 0; j < enabled.length; j++) {
            var key = enabled[j];
            var ver = utils.getVersionConfig(key);
            if (!ver) continue;
            var item = buildVersionItem(ver, key === primary);
            enabledList.appendChild(item);
        }

        enabledSection.appendChild(enabledList);
        container.appendChild(enabledSection);

        // ---- Disabled section ----
        var disabledSection = document.createElement("div");
        disabledSection.className = "version-section";
        disabledSection.setAttribute("data-section", "disabled");

        var disabledTitle = document.createElement("div");
        disabledTitle.className = "version-section-title";
        disabledTitle.textContent = "未启用（可拖入已启用）";
        disabledSection.appendChild(disabledTitle);

        var disabledList = document.createElement("div");
        disabledList.className = "version-sortable-list";
        disabledList.setAttribute("data-section", "disabled");

        for (var k = 0; k < disabled.length; k++) {
            var dItem = buildVersionItem(disabled[k], false);
            disabledList.appendChild(dItem);
        }

        disabledSection.appendChild(disabledList);
        container.appendChild(disabledSection);

        // ---- Init drag-drop ----
        initDragDrop();
    }

    function buildVersionItem(ver, isPrimary) {
        var item = document.createElement("div");
        item.className = "version-item draggable" + (isPrimary ? " is-primary" : "");
        item.setAttribute("draggable", "true");
        item.setAttribute("data-version", ver.key);

        var dragIcon = document.createElement("span");
        dragIcon.className = "version-drag-handle";
        dragIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>';
        item.appendChild(dragIcon);

        if (isPrimary) {
            var badge = document.createElement("span");
            badge.className = "version-primary-badge";
            badge.textContent = "主要";
            item.appendChild(badge);
        }

        var label = document.createElement("span");
        label.className = "version-label-text";
        label.textContent = ver.label;
        item.appendChild(label);

        if (!ver.available) {
            var vBadge = document.createElement("span");
            vBadge.className = "version-badge";
            vBadge.textContent = "待更新";
            item.appendChild(vBadge);
        }

        return item;
    }

    /* ---- Drag-drop (desktop + mobile touch) ---- */

    function initDragDrop() {
        var lists = document.querySelectorAll(".version-sortable-list");
        var draggedItem = null;
        var draggedFrom = null;
        var touchClone = null;
        var touchStartY = 0;

        for (var li = 0; li < lists.length; li++) {
            var list = lists[li];

            // Desktop drag
            list.addEventListener("dragstart", function (e) {
                draggedItem = e.target.closest(".draggable");
                if (!draggedItem) return;
                draggedFrom = list;
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", draggedItem.getAttribute("data-version"));
                setTimeout(function () { draggedItem.classList.add("dragging"); }, 0);
            });

            list.addEventListener("dragend", function () {
                if (draggedItem) draggedItem.classList.remove("dragging");
                var allLists = document.querySelectorAll(".version-sortable-list");
                for (var i = 0; i < allLists.length; i++) {
                    allLists[i].classList.remove("drag-over");
                }
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
                var targetList = list;
                var afterElement = getDragAfterElement(targetList, e.clientY);
                if (!canMoveTo(targetList)) return;
                moveItem(draggedItem, targetList, afterElement);
                draggedItem.classList.remove("dragging");
                draggedItem = null;
                draggedFrom = null;
            });

            // Mobile touch
            (function (currentList) {
                currentList.addEventListener("touchstart", function (e) {
                    var item = e.target.closest(".draggable");
                    if (!item) return;
                    draggedItem = item;
                    draggedFrom = currentList;
                    touchStartY = e.touches[0].clientY;

                    touchClone = item.cloneNode(true);
                    touchClone.style.cssText = "position:fixed;z-index:99999;pointer-events:none;opacity:0.85;width:" + item.offsetWidth + "px;background:var(--bg);box-shadow:0 4px 12px rgba(0,0,0,0.15);border-radius:8px;";
                    touchClone.classList.add("dragging");
                    document.body.appendChild(touchClone);
                    positionTouchClone(e.touches[0]);
                    item.style.opacity = "0.3";
                }, { passive: true });

                currentList.addEventListener("touchmove", function (e) {
                    if (!touchClone) return;
                    e.preventDefault();
                    positionTouchClone(e.touches[0]);
                    var allLists = document.querySelectorAll(".version-sortable-list");
                    for (var i = 0; i < allLists.length; i++) {
                        allLists[i].classList.remove("drag-over");
                    }
                    var target = getElementFromPoint(e.touches[0].clientX, e.touches[0].clientY, ".version-sortable-list");
                    if (target) target.classList.add("drag-over");
                }, { passive: false });

                currentList.addEventListener("touchend", function (e) {
                    if (!draggedItem || !touchClone) {
                        cleanupTouch();
                        return;
                    }
                    var touch = e.changedTouches[0];
                    var targetList = getElementFromPoint(touch.clientX, touch.clientY, ".version-sortable-list");
                    if (targetList && canMoveTo(targetList)) {
                        var afterEl = getDragAfterElement(targetList, touch.clientY);
                        moveItem(draggedItem, targetList, afterEl);
                    }
                    cleanupTouch();
                });
            })(list);
        }

        function positionTouchClone(touch) {
            if (!touchClone) return;
            touchClone.style.left = (touch.clientX - 30) + "px";
            touchClone.style.top = (touch.clientY - 20) + "px";
        }

        function getElementFromPoint(x, y, selector) {
            var el = document.elementFromPoint(x, y);
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
            var allLists = document.querySelectorAll(".version-sortable-list");
            for (var i = 0; i < allLists.length; i++) {
                allLists[i].classList.remove("drag-over");
            }
            draggedItem = null;
            draggedFrom = null;
        }

        function canMoveTo(targetList) {
            if (!draggedItem) return false;
            var isToDisabled = targetList.getAttribute("data-section") === "disabled";
            var enabledList = document.querySelector('.version-sortable-list[data-section="enabled"]');
            if (isToDisabled && enabledList && enabledList.children.length <= 1) {
                showToast("至少需要一个已启用的译本");
                return false;
            }
            return true;
        }

        function moveItem(item, targetList, beforeElement) {
            if (item.parentNode) item.parentNode.removeChild(item);
            if (beforeElement) {
                targetList.insertBefore(item, beforeElement);
            } else {
                targetList.appendChild(item);
            }
            syncStateFromDOM();
        }

        function getDragAfterElement(list, y) {
            var items = [];
            var draggables = list.querySelectorAll(".draggable:not(.dragging)");
            for (var i = 0; i < draggables.length; i++) {
                items.push(draggables[i]);
            }
            var closest = { offset: Number.MAX_VALUE, element: null };
            for (var j = 0; j < items.length; j++) {
                var box = items[j].getBoundingClientRect();
                var offset = box.top + box.height / 2 - y;
                if (offset > 0 && offset < closest.offset) {
                    closest = { offset: offset, element: items[j] };
                }
            }
            return closest.element;
        }
    }

    function syncStateFromDOM() {
        var enabledList = document.querySelector('.version-sortable-list[data-section="enabled"]');
        if (!enabledList) return;
        var items = [];
        var draggables = enabledList.querySelectorAll(".draggable");
        for (var i = 0; i < draggables.length; i++) {
            items.push(draggables[i]);
        }
        var keys = [];
        for (var j = 0; j < items.length; j++) {
            keys.push(items[j].getAttribute("data-version"));
        }
        if (keys.length === 0) return;

        var newPrimary = keys[0];
        var newSecondary = keys.slice(1);
        var primaryChanged = newPrimary !== state.primaryVersion;
        var oldPrimary = state.primaryVersion;

        state.primaryVersion = newPrimary;
        state.secondaryVersions = newSecondary;

        document.dispatchEvent(new CustomEvent("versionsChanged"));

        // Update DOM badges
        for (var k = 0; k < items.length; k++) {
            var isP = k === 0;
            items[k].classList.toggle("is-primary", isP);
            var existingBadge = items[k].querySelector(".version-primary-badge");
            if (isP && !existingBadge) {
                var b = document.createElement("span");
                b.className = "version-primary-badge";
                b.textContent = "主要";
                var labelText = items[k].querySelector(".version-label-text");
                if (labelText) {
                    items[k].insertBefore(b, labelText);
                } else {
                    items[k].appendChild(b);
                }
            } else if (!isP && existingBadge) {
                existingBadge.remove();
            }
        }

        updateVersionButtonLabel();

        if (primaryChanged) {
            window.updateBookPanelLanguage();
        }

        window.loadVersesMulti();
        window.updateAudio();
    }

    function showToast(msg) {
        var toast = document.getElementById("toast-msg");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "toast-msg";
            toast.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--bg-secondary);color:var(--text-primary);padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;opacity:0;transition:opacity .2s;pointer-events:none;";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = "1";
        clearTimeout(window._toastTimer);
        window._toastTimer = setTimeout(function () { toast.style.opacity = "0"; }, 2000);
    }

    /* ============================================================
       Audio version list (in audio panel)
       ============================================================ */

    function renderAudioVersionList() {
        var popup = document.getElementById("audio-version-popup");
        var currentEl = document.getElementById("audio-version-current");
        if (!popup) return;

        popup.innerHTML = "";

        var currentAudio = state.audioVersion || "en_nrsvce";
        var currentLabel = "—";

        for (var i = 0; i < cfg.versions.length; i++) {
            var ver = cfg.versions[i];
            if (!ver.has_audio) continue;

            if (ver.key === currentAudio) currentLabel = ver.label;

            var row = document.createElement("div");
            row.className = "audio-version-popup-item" + (ver.key === currentAudio ? " active" : "");
            row.setAttribute("data-version", ver.key);

            if (ver.key === currentAudio) {
                var check = document.createElement("span");
                check.className = "check-icon";
                check.textContent = "✓";
                row.appendChild(check);
            }

            var label = document.createElement("span");
            label.textContent = ver.label;
            row.appendChild(label);

            (function (key, lbl) {
                row.addEventListener("click", function () {
                    state.audioVersion = key;
                    if (currentEl) currentEl.textContent = "正在播放：" + lbl;
                    // Update active state in popup
                    var items = popup.querySelectorAll(".audio-version-popup-item");
                    for (var m = 0; m < items.length; m++) {
                        items[m].classList.toggle("active", items[m].getAttribute("data-version") === key);
                        // Remove check icons
                        var oldCheck = items[m].querySelector(".check-icon");
                        if (oldCheck) oldCheck.remove();
                        if (items[m].getAttribute("data-version") === key) {
                            var check = document.createElement("span");
                            check.className = "check-icon";
                            check.textContent = "✓";
                            items[m].insertBefore(check, items[m].firstChild);
                        }
                    }
                    // Close popup
                    var toggleBtn = document.getElementById("audio-version-toggle");
                    if (toggleBtn) toggleBtn.classList.remove("open");
                    popup.hidden = true;

                    window.updateAudio();
                });
            })(ver.key, ver.label);

            popup.appendChild(row);
        }

        if (currentEl) {
            var curVer = cfg.versions.find(function(v) { return v.key === currentAudio; });
            currentEl.textContent = curVer ? curVer.label : currentAudio;
        }
    }

    /* ============================================================
       Audio time update
       ============================================================ */

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        var mins = Math.floor(seconds / 60);
        var secs = Math.floor(seconds % 60);
        return mins + ":" + (secs < 10 ? "0" : "") + secs;
    }

    function updateAudioTime() {
        var audio = document.getElementById("audio-player");
        var timeEl = document.getElementById("audio-time-current");
        var totalEl = document.getElementById("audio-time-total");
        if (!audio || !timeEl || !totalEl) return;

        timeEl.textContent = formatTime(audio.currentTime);
        totalEl.textContent = formatTime(audio.duration);
    }

    function initAudioVersionToggle() {
        var toggleBtn = document.getElementById("audio-version-toggle");
        var popup = document.getElementById("audio-version-popup");
        if (!toggleBtn || !popup) return;

        toggleBtn.addEventListener("click", function () {
            var isOpen = !popup.hidden;
            popup.hidden = isOpen;
            toggleBtn.classList.toggle("open", !isOpen);
        });

        // Close popup when clicking outside
        document.addEventListener("click", function (e) {
            if (!popup.hidden && !toggleBtn.contains(e.target) && !popup.contains(e.target)) {
                popup.hidden = true;
                toggleBtn.classList.remove("open");
            }
        });
    }

    /* ============================================================
       Mini player
       ============================================================ */

    function updateMiniPlayerTitle() {
        var titleEl = document.getElementById("mini-player-title");
        if (!titleEl) return;

        if (state.book && state.chapter) {
            var bookCfg = null;
            if (window.BibleFlow.data && window.BibleFlow.data.allBooks) {
                var books = window.BibleFlow.data.allBooks;
                for (var i = 0; i < books.length; i++) {
                    if (books[i].key === state.book) {
                        bookCfg = books[i];
                        break;
                    }
                }
            }
            var bookName = bookCfg ? bookCfg.name : state.book;
            titleEl.textContent = bookName + " " + state.chapter;
        } else {
            titleEl.textContent = "未播放";
        }
    }

    function initMiniPlayer() {
        var btn = document.getElementById("mini-player-btn");
        if (!btn) return;
        btn.addEventListener("click", function () {
            openPanel("audio");
        });
    }

    /* ============================================================
       Bottom Tab Bar event binding
       ============================================================ */

    function initBottomTabBar() {
        var tabBar = document.getElementById("bottom-tab-bar");
        if (!tabBar) return;

        var btns = tabBar.querySelectorAll(".tab-btn");
        for (var i = 0; i < btns.length; i++) {
            (function (btn) {
                btn.addEventListener("click", function () {
                    var panel = btn.getAttribute("data-panel");
                    if (panel) {
                        openPanel(panel);
                    }
                });
            })(btns[i]);
        }
    }

    /* ============================================================
       Search panel helpers
       ============================================================ */

    function focusSearchInput() {
        var input = document.getElementById("search-input");
        if (input) {
            setTimeout(function () { input.focus(); }, 100);
        }
    }

    /* ============================================================
       Version button label
       ============================================================ */

    function updateVersionButtonLabel() {
        var labelEl = document.getElementById("version-label");
        if (!labelEl) return;

        var pri = utils.getVersionConfig(state.primaryVersion);
        var sec = [];
        var secList = state.secondaryVersions || [];
        for (var i = 0; i < secList.length; i++) {
            var s = utils.getVersionConfig(secList[i]);
            if (s) sec.push(s);
        }

        var text = pri ? pri.label : "";
        if (sec.length > 0) {
            var labels = [];
            for (var j = 0; j < sec.length; j++) {
                labels.push(sec[j].label);
            }
            text += " + " + labels.join("/");
        }
        labelEl.textContent = text;
    }

    /* ============================================================
       Backward-compatible version selectors
       ============================================================ */

    function selectPrimaryVersion(versionKey) {
        if (versionKey === state.primaryVersion) return;
        state.secondaryVersions = (state.secondaryVersions || []).filter(function (k) { return k !== versionKey; });
        state.primaryVersion = versionKey;
        renderVersionPanel();
        updateVersionButtonLabel();
        window.updateBookPanelLanguage();
        window.loadVersesMulti();
        window.updateAudio();
    }

    function selectPrimaryVersionSilent(versionKey) {
        if (versionKey === state.primaryVersion) return;
        state.secondaryVersions = (state.secondaryVersions || []).filter(function (k) { return k !== versionKey; });
        state.primaryVersion = versionKey;
        renderVersionPanel();
        updateVersionButtonLabel();
        window.updateBookPanelLanguage();
        window.loadVersesMulti();
        window.updateAudio();
    }

    function toggleSecondaryVersion(versionKey) {
        var list = state.secondaryVersions || [];
        var idx = list.indexOf(versionKey);
        if (idx >= 0) {
            list.splice(idx, 1);
        } else {
            list.push(versionKey);
        }
        state.secondaryVersions = list;
        renderVersionPanel();
        window.loadVersesMulti();
    }

    /* ============================================================
       Material Icons init
       ============================================================ */

    function initMaterialIcons() {
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                var icons = document.querySelectorAll(".material-icons");
                for (var i = 0; i < icons.length; i++) {
                    icons[i].classList.add("loaded");
                }
            });
        } else {
            setTimeout(function () {
                var icons = document.querySelectorAll(".material-icons");
                for (var i = 0; i < icons.length; i++) {
                    icons[i].classList.add("loaded");
                }
            }, 300);
        }
    }

    /* ============================================================
       Unified init
       ============================================================ */

    function init() {
        // 1. Version button label
        updateVersionButtonLabel();

        // 2. 顶栏书卷按钮
        var bookBtn = document.getElementById("book-btn");
        if (bookBtn) bookBtn.addEventListener("click", function() { openPanel("book"); });

        // 3. Display panel toggles + slider
        initDisplayPanel();

        // 3. Mini player
        initMiniPlayer();

        // 4. Bottom tab bar
        initBottomTabBar();

        // 5. Book selector (delegated to book.js)
        window.initBookSelector();

        // 6. Material Icons
        initMaterialIcons();

        // 7. Set default state
        if (state.showVerseNum === undefined) {
            state.showVerseNum = true;
        }
    }

    // DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    /* ============================================================
       Export to global scope
       ============================================================ */

    window.openPanel = openPanel;
    window.closePanel = closePanel;
    window.renderVersionPanel = renderVersionPanel;
    window.selectPrimaryVersion = selectPrimaryVersion;
    window.selectPrimaryVersionSilent = selectPrimaryVersionSilent;
    window.toggleSecondaryVersion = toggleSecondaryVersion;
    window.updateVersionButtonLabel = updateVersionButtonLabel;
    window.init = init;
    window.updateMiniPlayerTitle = updateMiniPlayerTitle;
    window.updateAudioTime = updateAudioTime;

})();
