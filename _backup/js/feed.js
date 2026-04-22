/* ============================================================
   CROWD PULSE — Live Feed Manager
   Real-time streaming fan message ticker with sentiment tags
   ============================================================ */

const FeedManager = (() => {
    const EMOTION_COLORS = {
        tension: '#f97316',
        euphoria: '#22c55e',
        frustration: '#ef4444',
        disbelief: '#a855f7',
        jubilation: '#eab308',
    };

    const PLATFORM_ICONS = {
        twitter: '𝕏',
        youtube: '▶',
        whatsapp: '✦',
        web: '◆',
    };

    let container;
    const messages = [];
    const MAX_MESSAGES = 50;
    let autoScroll = true;

    function init() {
        container = document.getElementById('feed-container');
        if (!container) return;

        // Track manual scroll
        container.addEventListener('scroll', () => {
            const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
            autoScroll = isAtBottom;
        });
    }

    function addMessage(message) {
        messages.unshift(message);
        if (messages.length > MAX_MESSAGES) messages.pop();
        renderLatestMessage(message);
    }

    function renderLatestMessage(msg) {
        if (!container) return;

        const el = document.createElement('div');
        el.className = 'feed-item';
        el.innerHTML = `
            <div class="feed-platform feed-platform--${msg.platform}">
                ${PLATFORM_ICONS[msg.platform] || '◆'}
            </div>
            <div class="feed-content">
                <div class="feed-text">${escapeHtml(msg.text)}</div>
                <div class="feed-meta">
                    <span class="feed-emotion-dot" style="background:${EMOTION_COLORS[msg.emotion]}"></span>
                    <span class="feed-emotion-label" style="color:${EMOTION_COLORS[msg.emotion]}">${msg.emotion}</span>
                    <span class="feed-time">${msg.city || ''}</span>
                </div>
            </div>
        `;

        container.insertBefore(el, container.firstChild);

        // Trim excess
        while (container.children.length > MAX_MESSAGES) {
            container.removeChild(container.lastChild);
        }

        // Auto-scroll to top (newest)
        if (autoScroll) {
            container.scrollTop = 0;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        init,
        addMessage,
        getMessages: () => [...messages],
    };
})();
