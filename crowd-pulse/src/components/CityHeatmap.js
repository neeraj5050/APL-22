'use client';

import { useRef, useEffect, useCallback } from 'react';
import styles from './CityHeatmap.module.css';

const EMOTION_COLORS = {
  tension: '#f97316',
  euphoria: '#22c55e',
  frustration: '#ef4444',
  disbelief: '#a855f7',
  jubilation: '#eab308',
};

const CITY_POSITIONS = {
  'Mumbai': { x: 160, y: 225 },
  'Chennai': { x: 220, y: 310 },
  'Delhi': { x: 208, y: 85 },
  'Bangalore': { x: 200, y: 290 },
  'Kolkata': { x: 300, y: 170 },
  'Hyderabad': { x: 215, y: 255 },
  'Pune': { x: 175, y: 240 },
  'Ahmedabad': { x: 155, y: 170 },
  'Jaipur': { x: 185, y: 115 },
  'Lucknow': { x: 235, y: 115 },
  'Chandigarh': { x: 200, y: 60 },
  'Indore': { x: 190, y: 175 },
};

const INDIA_OUTLINE = `M 180,30 L 200,25 220,30 240,20 260,28 280,35 305,30 
  320,50 330,70 340,80 345,100 350,120 340,140 345,160 340,180 
  335,200 330,220 320,240 310,250 300,270 285,285 270,300 
  255,310 240,320 225,335 215,345 200,350 190,340 180,330 
  170,310 160,290 155,270 150,250 140,230 135,215 130,200 
  125,180 120,160 115,145 120,130 125,115 130,100 140,85 
  145,70 155,55 165,40 Z`;

export default function CityHeatmap({ cityData }) {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  const showTooltip = useCallback((e, city) => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const bars = Object.entries(city.emotions)
      .sort((a, b) => b[1] - a[1])
      .map(([emotion, score]) => `
        <div class="${styles.tooltipRow}">
          <span style="width:60px;text-transform:capitalize;font-size:0.65rem;color:${EMOTION_COLORS[emotion]}">${emotion}</span>
          <div class="${styles.tooltipBar}">
            <div class="${styles.tooltipBarFill}" style="width:${score * 100}%;background:${EMOTION_COLORS[emotion]}"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:0.6rem;color:#94a3b8;width:30px;text-align:right">${Math.round(score * 100)}%</span>
        </div>
      `).join('');

    tooltip.innerHTML = `
      <div class="${styles.tooltipName}">${city.name}</div>
      <div style="font-size:0.65rem;color:#64748b;margin-bottom:8px">
        ${(city.messageCount || 0).toLocaleString()} messages • ${city.teamBias || 'Neutral'} territory
      </div>
      ${bars}
    `;
    tooltip.style.opacity = '1';

    const container = svgRef.current?.closest(`.${styles.card}`) || svgRef.current?.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      let left = e.clientX - rect.left + 15;
      let top = e.clientY - rect.top - 10;
      if (left + 200 > rect.width) left = e.clientX - rect.left - 210;
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
  }, []);

  // Build SVG content
  const gridDots = [];
  for (let x = 100; x < 380; x += 20) {
    for (let y = 20; y < 370; y += 20) {
      if (x > 110 && x < 355 && y > 15 && y < 355 && !(x > 300 && y > 250) && !(x < 130 && y > 270)) {
        gridDots.push(<circle key={`dot-${x}-${y}`} cx={x} cy={y} r="0.5" fill="rgba(148, 163, 184, 0.06)" />);
      }
    }
  }

  return (
    <div className={`glass-card ${styles.card}`}>
      <div className="section-header">
        <div>
          <h2 className="section-title"><span className="icon">🗺️</span> City-Wise Sentiment Heatmap</h2>
          <div className="section-subtitle">Sentiment clustering by Indian cities</div>
        </div>
      </div>
      <div className={styles.container}>
        <svg ref={svgRef} className={styles.svg} viewBox="80 0 320 380">
          <defs>
            <filter id="city-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
            </filter>
          </defs>

          {/* India outline */}
          <path d={INDIA_OUTLINE} fill="rgba(15, 20, 45, 0.4)" stroke="rgba(148, 163, 184, 0.12)" strokeWidth="1.5" strokeLinejoin="round" />

          {/* Grid texture */}
          {gridDots}

          {/* City bubbles */}
          {(cityData || []).map((city, i) => {
            const pos = CITY_POSITIONS[city.name];
            if (!pos) return null;
            const color = EMOTION_COLORS[city.dominant] || '#3b82f6';
            const radius = Math.max(6, Math.min(22, city.messageCount / 3000));

            return (
              <g key={city.name}>
                {/* Glow */}
                <circle cx={pos.x} cy={pos.y} r={radius + 8} fill={color} opacity="0.08" filter="url(#city-glow)" />
                {/* Pulse */}
                <circle cx={pos.x} cy={pos.y} r={radius + 4} fill="none" stroke={color} strokeWidth="1" opacity="0.2" className={styles.pulse} style={{ animationDelay: `${i * 0.3}s` }} />
                {/* Dot */}
                <circle
                  cx={pos.x} cy={pos.y} r={radius} fill={color} opacity="0.65"
                  className={styles.cityDot}
                  onMouseEnter={(e) => showTooltip(e, city)}
                  onMouseMove={(e) => showTooltip(e, city)}
                  onMouseLeave={hideTooltip}
                />
                {/* Label */}
                <text x={pos.x} y={pos.y + radius + 12} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="'Inter', sans-serif">{city.name}</text>
                {/* Score */}
                <text x={pos.x} y={pos.y + 3} textAnchor="middle" fill="white" fontSize={Math.max(6, radius * 0.5)} fontFamily="'JetBrains Mono', monospace" fontWeight="600">{Math.round(city.dominantScore * 100)}</text>
              </g>
            );
          })}
        </svg>

        <div ref={tooltipRef} className={styles.tooltip} />

        <div className={styles.legendBox}>
          <div className={styles.legendLabels}>
            <span>Frustration</span>
            <span>Jubilation</span>
          </div>
          <div className={styles.legendBar} />
        </div>
      </div>
    </div>
  );
}
