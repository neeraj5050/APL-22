'use client';

import styles from './MomentCards.module.css';

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function MomentCards({ moments }) {
  return (
    <div className="glass-card">
      <div className="section-header">
        <div>
          <h2 className="section-title"><span className="icon">💥</span> Moment Cards</h2>
          <div className="section-subtitle">Auto-generated when sentiment outliers are detected</div>
        </div>
      </div>
      <div className={styles.grid}>
        {moments.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>💥</div>
            <div className={styles.emptyText}>Waiting for emotional spikes...</div>
          </div>
        ) : (
          moments.map((m, i) => (
            <div key={m.id} className={styles.card} data-emotion={m.emotion} style={{ animationDelay: `${i * 0.05}s` }}>
              <div className={styles.header}>
                <div className={styles.title}>{m.title}</div>
                <div className={styles.emoji}>{m.emoji}</div>
              </div>
              <div className={styles.meta}>
                <span className={styles.emotionTag}>{m.emotion}</span>
                <span className={styles.intensity}>{m.intensity}</span>
                <span className={styles.time}>Ov {m.over} • {getTimeAgo(m.timestamp)}</span>
              </div>
              <div className={styles.context}>{m.context}</div>
              {m.fanQuote && <div className={styles.quote}>&ldquo;{m.fanQuote}&rdquo;</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
