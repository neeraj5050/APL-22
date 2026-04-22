'use client';

import styles from './DashboardHeader.module.css';

export default function DashboardHeader({ scoreData, isConnected, totalMessages, latency }) {
  const activeCities = 12;

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo}>
          🏏
          <div className={styles.pulseRing} />
        </div>
        <div>
          <div className={styles.name}>Crowd Pulse</div>
          <div className={styles.tag}>LIVE EMOTIONAL ANALYTICS</div>
        </div>
      </div>

      <div className={styles.matchInfo}>
        <div className={styles.teams}>
          <div className={`${styles.badge} ${styles.badgeMI}`}>MI</div>
          <div>
            <span className={styles.matchScore}>{scoreData.score}</span>
            <span className={styles.overs}>({scoreData.overs} ov)</span>
          </div>
          <span className={styles.vs}>VS</span>
          <div className={`${styles.badge} ${styles.badgeCSK}`}>CSK</div>
        </div>

        <div className={styles.inningsInfo}>
          <span className={styles.inningsLabel}>
            {scoreData.innings === 2 ? '2nd Innings' : '1st Innings'}
          </span>
          {scoreData.target && (
            <span className={styles.targetLabel}>Target: {scoreData.target}</span>
          )}
        </div>

        <div className={styles.liveBadge}>
          <span className={styles.liveDot} />
          LIVE
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{totalMessages.toLocaleString()}</div>
          <div className={styles.statLabel}>Messages</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{activeCities}</div>
          <div className={styles.statLabel}>Active Cities</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{scoreData.runRate}</div>
          <div className={styles.statLabel}>Run Rate</div>
        </div>
        {scoreData.requiredRate && (
          <div className={styles.stat}>
            <div className={styles.statValue}>{scoreData.requiredRate}</div>
            <div className={styles.statLabel}>Req. Rate</div>
          </div>
        )}
        <div className={styles.stat}>
          <div className={styles.statValue}>{latency ? `${latency}ms` : '—'}</div>
          <div className={styles.statLabel}>Latency</div>
        </div>
        <div className={styles.connection}>
          <span className={`${styles.connectionDot} ${isConnected ? styles.connected : styles.disconnected}`} />
          <span>{isConnected ? 'Live Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
}
