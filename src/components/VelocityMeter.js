'use client';

import { useRef, useEffect, useCallback } from 'react';
import styles from './VelocityMeter.module.css';

export default function VelocityMeter({ velocity, velocityHistory }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    ctx.clearRect(0, 0, w, h);

    if (velocityHistory.length < 2) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    const max = Math.max(...velocityHistory.map(d => d.value), 1000);
    const points = velocityHistory.map((d, i) => ({
      x: (i / (velocityHistory.length - 1)) * w,
      y: h - (d.value / max) * h * 0.9,
    }));

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

    ctx.strokeStyle = '#06d6a0';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    animRef.current = requestAnimationFrame(draw);
  }, [velocityHistory]);

  useEffect(() => {
    setupCanvas();
    animRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', setupCanvas);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', setupCanvas);
    };
  }, [setupCanvas, draw]);

  return (
    <div className="glass-card">
      <div className="section-header">
        <div>
          <h2 className="section-title"><span className="icon">⚡</span> Message Velocity</h2>
          <div className="section-subtitle">Messages per second across all platforms</div>
        </div>
      </div>

      <div className={styles.display}>
        <div className={styles.number}>{velocity.toLocaleString()}</div>
        <div className={styles.unit}>msg/sec</div>
      </div>

      <div className={styles.graph}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '60px' }} />
      </div>

      <div className={styles.platforms}>
        <div className={styles.platformCard} style={{ background: 'rgba(29, 155, 240, 0.08)' }}>
          <span style={{ fontSize: '0.8rem', color: '#1d9bf0' }}>𝕏</span>
          <div>
            <div className={styles.platformName}>Twitter/X</div>
            <div className={styles.platformPct}>42% of traffic</div>
          </div>
        </div>
        <div className={styles.platformCard} style={{ background: 'rgba(255, 0, 0, 0.06)' }}>
          <span style={{ fontSize: '0.8rem', color: '#ff0000' }}>▶</span>
          <div>
            <div className={styles.platformName}>YouTube</div>
            <div className={styles.platformPct}>31% of traffic</div>
          </div>
        </div>
        <div className={styles.platformCard} style={{ background: 'rgba(37, 211, 102, 0.06)' }}>
          <span style={{ fontSize: '0.8rem', color: '#25d366' }}>✦</span>
          <div>
            <div className={styles.platformName}>WhatsApp</div>
            <div className={styles.platformPct}>18% of traffic</div>
          </div>
        </div>
        <div className={styles.platformCard} style={{ background: 'rgba(59, 130, 246, 0.06)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)' }}>◆</span>
          <div>
            <div className={styles.platformName}>Web SDK</div>
            <div className={styles.platformPct}>9% of traffic</div>
          </div>
        </div>
      </div>
    </div>
  );
}
