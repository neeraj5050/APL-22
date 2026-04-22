'use client';

import { useRef, useEffect, useCallback } from 'react';
import styles from './OverByOverChart.module.css';

const EMOTION_COLORS = {
  tension: { line: '#f97316', fill: 'rgba(249, 115, 22, 0.08)', glow: 'rgba(249, 115, 22, 0.4)' },
  euphoria: { line: '#22c55e', fill: 'rgba(34, 197, 94, 0.08)', glow: 'rgba(34, 197, 94, 0.4)' },
  frustration: { line: '#ef4444', fill: 'rgba(239, 68, 68, 0.08)', glow: 'rgba(239, 68, 68, 0.4)' },
  disbelief: { line: '#a855f7', fill: 'rgba(168, 85, 247, 0.08)', glow: 'rgba(168, 85, 247, 0.4)' },
  jubilation: { line: '#eab308', fill: 'rgba(234, 179, 8, 0.08)', glow: 'rgba(234, 179, 8, 0.4)' },
};

const MONO_FONT = "'JetBrains Mono', monospace";
const BODY_FONT = "'Inter', sans-serif";

export default function OverByOverChart({ chartData, matchEvents }) {
  const canvasRef = useRef(null);
  const tooltipRef = useRef(null);
  const hoveredRef = useRef(null);
  const animRef = useRef(null);

  // Setup canvas
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }, []);

  // Draw chart
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    ctx.clearRect(0, 0, w, h);

    if (chartData.length < 2) {
      ctx.fillStyle = '#475569';
      ctx.font = `13px ${BODY_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for match data...', w / 2, h / 2);
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    const padding = { top: 20, right: 20, bottom: 40, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = '#475569';
      ctx.font = `10px ${MONO_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText((1 - i * 0.25).toFixed(2), padding.left - 8, y + 4);
    }

    // X-axis
    const step = Math.max(1, Math.floor(chartData.length / 10));
    ctx.fillStyle = '#475569';
    ctx.font = `10px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    chartData.forEach((d, i) => {
      if (i % step === 0 || i === chartData.length - 1) {
        const x = padding.left + (i / (chartData.length - 1)) * chartW;
        ctx.fillText(`Ov ${d.over.toFixed(1)}`, x, h - 8);
      }
    });

    // Match event markers
    (matchEvents || []).forEach(event => {
      const idx = chartData.findIndex(d => d.over >= event.over);
      if (idx < 0) return;
      const x = padding.left + (idx / (chartData.length - 1)) * chartW;

      ctx.strokeStyle = event.type === 'wicket' ? 'rgba(239, 68, 68, 0.25)'
        : event.type === 'six' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, h - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      const icon = event.type === 'wicket' ? 'W' : event.type === 'six' ? '6' : '4';
      ctx.fillStyle = event.type === 'wicket' ? '#ef4444' : event.type === 'six' ? '#eab308' : '#22c55e';
      ctx.font = `bold 9px ${MONO_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(icon, x, padding.top - 5);
    });

    // Emotion lines
    const emotionKeys = ['tension', 'euphoria', 'frustration', 'disbelief', 'jubilation'];
    emotionKeys.forEach(emotion => {
      const colors = EMOTION_COLORS[emotion];
      const points = chartData.map((d, i) => ({
        x: padding.left + (i / (chartData.length - 1)) * chartW,
        y: padding.top + (1 - (d.emotions[emotion] || 0)) * chartH,
      }));

      // Fill
      ctx.beginPath();
      ctx.moveTo(points[0].x, h - padding.bottom);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, h - padding.bottom);
      ctx.closePath();
      ctx.fillStyle = colors.fill;
      ctx.fill();

      // Line
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();

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
      const last = points[points.length - 1];
      const pulse = 1 + Math.sin(Date.now() / 500) * 0.3;
      ctx.beginPath();
      ctx.arc(last.x, last.y, 3 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = colors.line;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(last.x, last.y, 6 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = colors.glow;
      ctx.fill();
    });

    // Hover
    const hIdx = hoveredRef.current;
    if (hIdx !== null && hIdx >= 0 && hIdx < chartData.length) {
      const x = padding.left + (hIdx / (chartData.length - 1)) * chartW;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, h - padding.bottom);
      ctx.stroke();

      emotionKeys.forEach(emotion => {
        const y = padding.top + (1 - (chartData[hIdx].emotions[emotion] || 0)) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = EMOTION_COLORS[emotion].line;
        ctx.fill();
        ctx.strokeStyle = '#0c1021';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    animRef.current = requestAnimationFrame(draw);
  }, [chartData, matchEvents]);

  useEffect(() => {
    setupCanvas();
    animRef.current = requestAnimationFrame(draw);
    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [setupCanvas, draw]);

  const handleMouseMove = useCallback((e) => {
    if (chartData.length < 2) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = { left: 45, right: 20 };
    const chartW = rect.width - padding.left - padding.right;
    const ratio = (x - padding.left) / chartW;
    const index = Math.round(ratio * (chartData.length - 1));

    if (index >= 0 && index < chartData.length) {
      hoveredRef.current = index;
      const tooltipEl = tooltipRef.current;
      if (tooltipEl) {
        const d = chartData[index];
        tooltipEl.innerHTML = `
          <div style="font-weight:600;margin-bottom:4px;font-size:0.8rem">Over ${d.over.toFixed(1)} ${d.score ? '• ' + d.score : ''}</div>
          ${Object.entries(d.emotions).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
            `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
              <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${EMOTION_COLORS[k].line}"></span>
              <span style="text-transform:capitalize;width:70px">${k}</span>
              <span style="font-family:${MONO_FONT};color:${EMOTION_COLORS[k].line}">${(v * 100).toFixed(0)}%</span>
            </div>`
          ).join('')}
        `;

        let left = e.clientX - rect.left + 15;
        let top = e.clientY - rect.top - 10;
        if (left + 200 > rect.width) left = e.clientX - rect.left - 210;
        if (top < 0) top = 10;
        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = top + 'px';
        tooltipEl.classList.add(styles.visible);
      }
    } else {
      hoveredRef.current = null;
      tooltipRef.current?.classList.remove(styles.visible);
    }
  }, [chartData]);

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = null;
    tooltipRef.current?.classList.remove(styles.visible);
  }, []);

  return (
    <div className={`glass-card glass-card--full`}>
      <div className="section-header">
        <div>
          <h2 className="section-title"><span className="icon">📈</span> Over-by-Over Emotional Graph</h2>
          <div className="section-subtitle">Emotion trends correlated with match events • Hover for details</div>
        </div>
      </div>
      <div className={styles.chartContainer}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        <div ref={tooltipRef} className={styles.tooltip} />
      </div>
      <div className={styles.legend}>
        {Object.entries(EMOTION_COLORS).map(([emotion, colors]) => (
          <div key={emotion} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: colors.line }} />
            <span style={{ textTransform: 'capitalize' }}>{emotion}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
