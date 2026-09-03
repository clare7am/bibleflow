/* highlight.js — 音频逐词高亮
 *
 * 依赖：无（纯 DOM 操作）
 * 导出到全局的函数：
 *   clearWordHighlight, highlightWordAt
 */

(function () {
    "use strict";

    /**
     * 清除所有单词高亮
     */
    function clearWordHighlight() {
        document.querySelectorAll('.verse-primary .word.active')
            .forEach(el => el.classList.remove('active'));
    }

    /**
     * 根据当前时间（毫秒）高亮对应单词
     */
    function highlightWordAt(currentTimeMs) {
        clearWordHighlight();

        let activeAlignId = null;

        document.querySelectorAll('.verse-primary .word[data-align-id]').forEach(el => {
            const start = Number(el.dataset.start);
            const end = Number(el.dataset.end);

            if (!start || !end) return;

            if (currentTimeMs >= start && currentTimeMs < end) {
                el.classList.add('active');
                activeAlignId = el.dataset.alignId;
            }
        });

        if (activeAlignId) {
            const activeEl = document.querySelector(
                `.verse-primary .word[data-align-id="${activeAlignId}"]`
            );
            if (activeEl) {
                activeEl.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }

    /* ============================================================
       导出到全局
       ============================================================ */

    window.clearWordHighlight = clearWordHighlight;
    window.highlightWordAt = highlightWordAt;

})();
