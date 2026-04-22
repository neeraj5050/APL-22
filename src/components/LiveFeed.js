'use client';

import { useRef, useEffect } from 'react';
import styles from './LiveFeed.module.css';

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

export default function LiveFeed({ messages }) {
  const containerRef = useRef(null);

  return (
    <div className="glass-card">
      <div className="section-header">
        <div>
          <h2 className="section-title"><span className="icon">💬</span> Live Fan Feed</h2>
          <div className="section-subtitle">Real-time messages with sentiment analysis</div>
        </div>
      </div>
      <div className={styles.container} ref={containerRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={styles.item}>
            <div className={`${styles.platform} ${styles[`platform_${msg.platform}`]}`}>
              {PLATFORM_ICONS[msg.platform] || '◆'}
            </div>
            <div className={styles.content}>
              <div className={styles.text}>{msg.text}</div>
              <div className={styles.meta}>
                <span className={styles.emotionDot} style={{ background: EMOTION_COLORS[msg.emotion] }} />
                <span className={styles.emotionLabel} style={{ color: EMOTION_COLORS[msg.emotion] }}>{msg.emotion}</span>
                <span className={styles.city}>{msg.city || ''}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
