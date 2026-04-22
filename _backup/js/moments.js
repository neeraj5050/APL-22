/* ============================================================
   CROWD PULSE — Moment Cards Manager
   Handles rendering and animation of auto-generated moment cards
   ============================================================ */

const MomentsManager = (() => {
    let container;
    const moments = [];
    const MAX_MOMENTS = 15;

    function init() {
        container = document.getElementById('moments-container');
    }

    function addMoment(moment) {
        moments.unshift(moment);
        if (moments.length > MAX_MOMENTS) moments.pop();
        renderMoments();
    }

    function renderMoments() {
        if (!container) return;

        container.innerHTML = moments.map((m, i) => {
            const timeAgo = getTimeAgo(m.timestamp);

            return `
                <div class="moment-card" data-emotion="${m.emotion}" style="animation-delay: ${i * 0.05}s">
                    <div class="moment-header">
                        <div class="moment-title">${escapeHtml(m.title)}</div>
                        <div class="moment-emoji">${m.emoji}</div>
                    </div>
                    <div class="moment-meta">
                        <span class="moment-emotion-tag">${m.emotion}</span>
                        <span class="moment-intensity">${m.intensity}</span>
                        <span class="moment-time">Ov ${m.over} • ${timeAgo}</span>
                    </div>
                    <div class="moment-context">${escapeHtml(m.context)}</div>
                    ${m.fanQuote ? `<div class="moment-quote">"${escapeHtml(m.fanQuote)}"</div>` : ''}
                </div>
            `;
        }).join('');
    }

    function getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 10) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        return `${Math.floor(seconds / 3600)}h ago`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        init,
        addMoment,
        getMoments: () => [...moments],
    };
})();
