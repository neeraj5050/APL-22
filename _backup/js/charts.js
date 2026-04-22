/* ============================================================
   CROWD PULSE — Chart Visualizations
   Canvas-based Over-by-Over emotional graph + velocity sparkline
   ============================================================ */

const ChartsManager = (() => {
    // ---- Emotion Colors ----
    const EMOTION_COLORS = {
        tension: { line: '#f97316', fill: 'rgba(249, 115, 22, 0.08)', glow: 'rgba(249, 115, 22, 0.4)' },
        euphoria: { line: '#22c55e', fill: 'rgba(34, 197, 94, 0.08)', glow: 'rgba(34, 197, 94, 0.4)' },
        frustration: { line: '#ef4444', fill: 'rgba(239, 68, 68, 0.08)', glow: 'rgba(239, 68, 68, 0.4)' },
        disbelief: { line: '#a855f7', fill: 'rgba(168, 85, 247, 0.08)', glow: 'rgba(168, 85, 247, 0.4)' },
        jubilation: { line: '#eab308', fill: 'rgba(234, 179, 8, 0.08)', glow: 'rgba(234, 179, 8, 0.4)' },
    };

    const FONT_FAMILY = "'Inter', sans-serif";
    const MONO_FONT = "'JetBrains Mono', monospace";

    // ---- Data Storage ----
    let overData = []; // Array of { over, emotions, event, score }
    let activeEmotions = new Set(['tension', 'euphoria', 'frustration', 'disbelief', 'jubilation']);
    let matchEvents = []; // Wickets, sixes, etc.

    // ---- Canvas refs ----
    let mainCanvas, mainCtx;
    let velocityCanvas, velocityCtx;
    let velocityData = [];
    let animationFrame = null;
    let targetData = [];
    let displayData = [];

    // ---- Tooltip State ----
    let tooltipEl;
    let hoveredOver = null;

    function init() {
        mainCanvas = document.getElementById('over-chart-canvas');
        tooltipEl = document.getElementById('chart-tooltip');

        if (!mainCanvas) return;

        setupCanvas(mainCanvas);
        mainCtx = mainCanvas.getContext('2d');

        // Velocity mini chart
        velocityCanvas = document.getElementById('velocity-canvas');
        if (velocityCanvas) {
            setupCanvas(velocityCanvas);
            velocityCtx = velocityCanvas.getContext('2d');
        }

        // Mouse events for tooltip
        mainCanvas.addEventListener('mousemove', handleMouseMove);
        mainCanvas.addEventListener('mouseleave', handleMouseLeave);

        // Start render loop
        render();

        // Setup legend interactivity
        setupLegend();
    }

    function setupCanvas(canvas) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
    }

    function setupLegend() {
        document.querySelectorAll('.legend-item').forEach(item => {
            item.addEventListener('click', () => {
                const emotion = item.dataset.emotion;
                if (activeEmotions.has(emotion)) {
                    activeEmotions.delete(emotion);
                    item.classList.add('disabled');
                } else {
                    activeEmotions.add(emotion);
                    item.classList.remove('disabled');
                }
            });
        });
    }

    // Add data point
    function addOverData(over, emotionsObj, event, score) {
        overData.push({
            over,
            emotions: { ...emotionsObj },
            event: event || null,
            score: score || '',
            timestamp: Date.now(),
        });

        // Keep last 40 overs max
        if (overData.length > 40) overData.shift();
    }

    function addMatchEvent(over, type, description) {
        matchEvents.push({
            over,
            type, // 'wicket', 'six', 'four'
            description,
            timestamp: Date.now(),
        });
    }

    function addVelocityData(value) {
        velocityData.push({ value, timestamp: Date.now() });
        if (velocityData.length > 60) velocityData.shift();
    }

    // ---- Render Loop ----
    function render() {
        if (mainCtx) drawMainChart();
        if (velocityCtx) drawVelocityChart();
        animationFrame = requestAnimationFrame(render);
    }

    function drawMainChart() {
        const canvas = mainCanvas;
        const ctx = mainCtx;
        const w = canvas.getBoundingClientRect().width;
        const h = canvas.getBoundingClientRect().height;

        ctx.clearRect(0, 0, w, h);

        if (overData.length < 2) {
            // Draw placeholder
            ctx.fillStyle = '#475569';
            ctx.font = `13px ${FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.fillText('Waiting for match data...', w / 2, h / 2);
            return;
        }

        const padding = { top: 20, right: 20, bottom: 40, left: 45 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        // ---- Grid Lines ----
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = '#475569';
            ctx.font = `10px ${MONO_FONT}`;
            ctx.textAlign = 'right';
            ctx.fillText((1 - i * 0.25).toFixed(2), padding.left - 8, y + 4);
        }

        // ---- X-axis labels ----
        const step = Math.max(1, Math.floor(overData.length / 10));
        ctx.fillStyle = '#475569';
        ctx.font = `10px ${MONO_FONT}`;
        ctx.textAlign = 'center';
        overData.forEach((d, i) => {
            if (i % step === 0 || i === overData.length - 1) {
                const x = padding.left + (i / (overData.length - 1)) * chartW;
                ctx.fillText(`Ov ${d.over}`, x, h - 8);
            }
        });

        // ---- Draw match event markers ----
        matchEvents.forEach(event => {
            const dataIndex = overData.findIndex(d => d.over >= event.over);
            if (dataIndex < 0) return;
            const x = padding.left + (dataIndex / (overData.length - 1)) * chartW;

            ctx.strokeStyle = event.type === 'wicket' ? 'rgba(239, 68, 68, 0.25)' :
                              event.type === 'six' ? 'rgba(234, 179, 8, 0.25)' :
                              'rgba(148, 163, 184, 0.12)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, h - padding.bottom);
            ctx.stroke();
            ctx.setLineDash([]);

            // Event label
            const icon = event.type === 'wicket' ? 'W' : event.type === 'six' ? '6' : '4';
            ctx.fillStyle = event.type === 'wicket' ? '#ef4444' :
                            event.type === 'six' ? '#eab308' : '#22c55e';
            ctx.font = `bold 9px ${MONO_FONT}`;
            ctx.textAlign = 'center';
            ctx.fillText(icon, x, padding.top - 5);
        });

        // ---- Draw emotion lines ----
        const emotionKeys = ['tension', 'euphoria', 'frustration', 'disbelief', 'jubilation'];

        emotionKeys.forEach(emotion => {
            if (!activeEmotions.has(emotion)) return;

            const colors = EMOTION_COLORS[emotion];
            const points = overData.map((d, i) => ({
                x: padding.left + (i / (overData.length - 1)) * chartW,
                y: padding.top + (1 - d.emotions[emotion]) * chartH,
            }));

            // Fill area
            ctx.beginPath();
            ctx.moveTo(points[0].x, h - padding.bottom);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(points[points.length - 1].x, h - padding.bottom);
            ctx.closePath();
            ctx.fillStyle = colors.fill;
            ctx.fill();

            // Line with glow
            ctx.shadowColor = colors.glow;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = colors.line;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            
            // Smooth curve using cardinal spline approximation
            if (points.length >= 3) {
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length - 1; i++) {
                    const xc = (points[i].x + points[i + 1].x) / 2;
                    const yc = (points[i].y + points[i + 1].y) / 2;
                    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                }
                ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
            } else {
                points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Animated dot on last point
            const lastPoint = points[points.length - 1];
            const pulseScale = 1 + Math.sin(Date.now() / 500) * 0.3;
            ctx.beginPath();
            ctx.arc(lastPoint.x, lastPoint.y, 3 * pulseScale, 0, Math.PI * 2);
            ctx.fillStyle = colors.line;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(lastPoint.x, lastPoint.y, 6 * pulseScale, 0, Math.PI * 2);
            ctx.fillStyle = colors.glow;
            ctx.fill();
        });

        // ---- Hover highlight ----
        if (hoveredOver !== null && hoveredOver >= 0 && hoveredOver < overData.length) {
            const x = padding.left + (hoveredOver / (overData.length - 1)) * chartW;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, h - padding.bottom);
            ctx.stroke();

            // Data point dots
            emotionKeys.forEach(emotion => {
                if (!activeEmotions.has(emotion)) return;
                const y = padding.top + (1 - overData[hoveredOver].emotions[emotion]) * chartH;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = EMOTION_COLORS[emotion].line;
                ctx.fill();
                ctx.strokeStyle = '#0c1021';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }
    }

    function drawVelocityChart() {
        const canvas = velocityCanvas;
        const ctx = velocityCtx;
        const w = canvas.getBoundingClientRect().width;
        const h = canvas.getBoundingClientRect().height;

        ctx.clearRect(0, 0, w, h);

        if (velocityData.length < 2) return;

        const max = Math.max(...velocityData.map(d => d.value), 1000);
        const points = velocityData.map((d, i) => ({
            x: (i / (velocityData.length - 1)) * w,
            y: h - (d.value / max) * h * 0.9,
        }));

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, 'rgba(6, 214, 160, 0.2)');
        gradient.addColorStop(1, 'rgba(6, 214, 160, 0)');

        ctx.beginPath();
        ctx.moveTo(0, h);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Line
        ctx.strokeStyle = '#06d6a0';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();
    }

    // ---- Mouse Interaction ----
    function handleMouseMove(e) {
        if (overData.length < 2) return;

        const rect = mainCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const padding = { left: 45, right: 20 };
        const chartW = rect.width - padding.left - padding.right;

        const ratio = (x - padding.left) / chartW;
        const index = Math.round(ratio * (overData.length - 1));

        if (index >= 0 && index < overData.length) {
            hoveredOver = index;
            showTooltip(e, overData[index]);
        } else {
            hoveredOver = null;
            hideTooltip();
        }
    }

    function handleMouseLeave() {
        hoveredOver = null;
        hideTooltip();
    }

    function showTooltip(e, data) {
        if (!tooltipEl) return;

        const emotionList = Object.entries(data.emotions)
            .filter(([k]) => activeEmotions.has(k))
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => {
                const color = EMOTION_COLORS[k].line;
                return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color}"></span>
                    <span style="text-transform:capitalize;width:70px">${k}</span>
                    <span style="font-family:${MONO_FONT};color:${color}">${(v * 100).toFixed(0)}%</span>
                </div>`;
            }).join('');

        tooltipEl.innerHTML = `
            <div style="font-weight:600;margin-bottom:4px;font-size:0.8rem">Over ${data.over} ${data.score ? '• ' + data.score : ''}</div>
            ${data.event ? `<div style="color:#eab308;font-size:0.7rem;margin-bottom:4px">⚡ ${data.event}</div>` : ''}
            ${emotionList}
        `;

        const rect = mainCanvas.getBoundingClientRect();
        let left = e.clientX - rect.left + 15;
        let top = e.clientY - rect.top - 10;

        // Keep tooltip in bounds
        if (left + 200 > rect.width) left = e.clientX - rect.left - 210;
        if (top < 0) top = 10;

        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = top + 'px';
        tooltipEl.classList.add('visible');
    }

    function hideTooltip() {
        if (tooltipEl) tooltipEl.classList.remove('visible');
    }

    // Cleanup
    function destroy() {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        if (mainCanvas) {
            mainCanvas.removeEventListener('mousemove', handleMouseMove);
            mainCanvas.removeEventListener('mouseleave', handleMouseLeave);
        }
    }

    // Handle resize
    window.addEventListener('resize', () => {
        if (mainCanvas) setupCanvas(mainCanvas);
        if (velocityCanvas) setupCanvas(velocityCanvas);
    });

    return {
        init,
        addOverData,
        addMatchEvent,
        addVelocityData,
        destroy,
        EMOTION_COLORS,
    };
})();
