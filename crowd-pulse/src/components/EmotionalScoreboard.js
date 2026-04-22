'use client';

import styles from './EmotionalScoreboard.module.css';

const EMOTION_CONFIG = [
  { key: 'tension', emoji: '😰', label: 'Tension' },
  { key: 'euphoria', emoji: '🤩', label: 'Euphoria' },
  { key: 'frustration', emoji: '😤', label: 'Frustration' },
  { key: 'disbelief', emoji: '😱', label: 'Disbelief' },
  { key: 'jubilation', emoji: '🎉', label: 'Jubilation' },
];

export default function EmotionalScoreboard({ emotions, prevEmotions }) {
  // Find dominant emotion
  let dominant = 'tension';
  let maxScore = 0;
  Object.entries(emotions).forEach(([key, val]) => {
    if (val > maxScore) { maxScore = val; dominant = key; }
  });

  return (
    <section className="glass-card glass-card--full">
      <div className="section-header">
        <div>
          <h1 className="section-title">
            <span className="icon">📊</span>
            Emotional Scoreboard
          </h1>
          <div className="section-subtitle">Real-time sentiment across 5 emotional pillars</div>
        </div>
      </div>
      <div className={styles.scoreboard}>
        {EMOTION_CONFIG.map(({ key, emoji, label }) => {
          const score = emotions[key] || 0;
          const prev = prevEmotions[key] || 0;
          const delta = Math.round((score - prev) * 100);
          const isActive = key === dominant;
          const isSpike = score - prev > 0.15;

          return (
            <div
              key={key}
              className={`${styles.pillar} ${isActive ? styles.active : ''} ${isSpike ? styles.spike : ''}`}
              data-emotion={key}
            >
              <div className={styles.emoji}>{emoji}</div>
              <div className={styles.name}>{label}</div>
              <div className={styles.score}>{Math.round(score * 100)}</div>
              <div className={styles.bar}>
                <div
                  className={styles.barFill}
                  style={{ width: `${score * 100}%` }}
                />
              </div>
              <div className={`${styles.delta} ${delta > 0 ? styles.up : delta < 0 ? styles.down : styles.stable}`}>
                {delta > 0 ? `▲ +${delta}%` : delta < 0 ? `▼ ${delta}%` : '— 0%'}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
