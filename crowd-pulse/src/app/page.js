'use client';

import { useSimulator } from '@/hooks/useSimulator';
import DashboardHeader from '@/components/DashboardHeader';
import EmotionalScoreboard from '@/components/EmotionalScoreboard';
import OverByOverChart from '@/components/OverByOverChart';
import CityHeatmap from '@/components/CityHeatmap';
import VelocityMeter from '@/components/VelocityMeter';
import MomentCards from '@/components/MomentCards';
import LiveFeed from '@/components/LiveFeed';
import styles from './page.module.css';

export default function Home() {
  const {
    emotions,
    prevEmotions,
    scoreData,
    messages,
    moments,
    cityData,
    velocity,
    velocityHistory,
    chartData,
    matchEvents,
    isConnected,
    totalMessages,
    latency,
    notification,
  } = useSimulator();

  return (
    <div className={styles.dashboard}>
      {/* Notification overlay */}
      {notification && (
        <div className="notification">{notification.text}</div>
      )}

      {/* Header */}
      <DashboardHeader
        scoreData={scoreData}
        isConnected={isConnected}
        totalMessages={totalMessages}
        latency={latency}
      />

      {/* Emotional Scoreboard */}
      <EmotionalScoreboard emotions={emotions} prevEmotions={prevEmotions} />

      {/* Dashboard Body */}
      <div className={styles.body}>
        {/* Over-by-Over Chart (full width) */}
        <OverByOverChart chartData={chartData} matchEvents={matchEvents} />

        {/* Heatmap + Velocity */}
        <CityHeatmap cityData={cityData} />
        <VelocityMeter velocity={velocity} velocityHistory={velocityHistory} />

        {/* Moments + Feed */}
        <MomentCards moments={moments} />
        <LiveFeed messages={messages} />
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerText}>
          Crowd Pulse v2.0 • Next.js + Firebase • Powered by Google Cloud + Gemini AI • Latency Target: &lt;3s
        </div>
      </footer>
    </div>
  );
}
