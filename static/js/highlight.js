/* highlight.js — 音频逐词高亮
 *
 * 依赖：无（纯 DOM 操作）
 * 导出到全局的函数：
 *   clearWordHighlight, highlightWordAt
 */

(function () {
    "use strict";

    var state = window.BibleFlow.state;
    var utils = window.BibleFlow.utils;

    /**
     * 清除所有单词高亮
     */
    function clearWordHighlight() {
        document.querySelectorAll('.verse-text .word.active')
            .forEach(el => el.classList.remove('active'));
    }

    /**
     * 根据当前时间（毫秒）高亮对应单词
     */
    function highlightWordAt(currentTimeMs) {
        // 检查当前音频版本是否有 tokens
        const audioVer = state.audioVersion || state.primaryVersion;
        const audioVerConfig = utils.getVersionConfig(audioVer);
        if (!audioVerConfig || !audioVerConfig.has_tokens) {
            return;
        }

        // 清除旧高亮
        document.querySelectorAll('.verse-text .word.active').forEach(el => el.classList.remove('active'));

        // 找到音频版本的所有经文容器
        const containers = document.querySelectorAll(`.verse-text[data-version="${audioVer}"]`);
        if (containers.length === 0) return;

        let activeAlignId = null;

        containers.forEach(container => {
            container.querySelectorAll('.word[data-align-id]').forEach(el => {
                const start = Number(el.dataset.start);
                const end = Number(el.dataset.end);

                if (!start || !end) return;

                if (currentTimeMs >= start && currentTimeMs < end) {
                    el.classList.add('active');
                    activeAlignId = el.dataset.alignId;
                }
            });
        });

        if (activeAlignId) {
            const activeEl = document.querySelector(`.verse-text[data-version="${audioVer}"] .word[data-align-id="${activeAlignId}"]`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    /* ============================================================
       导出到全局
       ============================================================ */

    window.clearWordHighlight = clearWordHighlight;
    window.highlightWordAt = highlightWordAt;

})();
