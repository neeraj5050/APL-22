'use client';

import { useState } from 'react';
import { useSimulator } from '@/hooks/useSimulator';
import { useLiveData } from '@/hooks/useLiveData';
import DashboardHeader from '@/components/DashboardHeader';
import EmotionalScoreboard from '@/components/EmotionalScoreboard';
import OverByOverChart from '@/components/OverByOverChart';
import CityHeatmap from '@/components/CityHeatmap';
import VelocityMeter from '@/components/VelocityMeter';
import MomentCards from '@/components/MomentCards';
import LiveFeed from '@/components/LiveFeed';
import MatchPicker from '@/components/MatchPicker';
import styles from './page.module.css';

export default function Home() {
  const [mode, setMode] = useState('setup'); // 'setup', 'live', 'simulator'
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [videoIds, setVideoIds] = useState([]);

  return (
    <div className={styles.dashboard}>
      {mode === 'setup' && (
        <MatchPicker
          onStartLive={(matchId, vids) => {
            setSelectedMatchId(matchId);
            setVideoIds(vids);
            setMode('live');
          }}
          onStartSimulator={() => setMode('simulator')}
        />
      )}

      {mode === 'live' && (
        <LiveDashboard
          matchId={selectedMatchId}
          videoIds={videoIds}
          onBack={() => setMode('setup')}
        />
      )}

      {mode === 'simulator' && (
        <SimulatorDashboard onBack={() => setMode('setup')} />
      )}
    </div>
  );
}


// ─── Live Dashboard (Real APIs) ──────────────────────────────
function LiveDashboard({ matchId, videoIds, onBack }) {
  const {
    emotions, prevEmotions, scoreData, messages, moments,
    cityData, velocity, velocityHistory, chartData, matchEvents,
    isConnected, totalMessages, latency, notification,
    liveMatches, selectedMatchId, setSelectedMatchId,
    ytVideoTitles, ytChatIds,
  } = useLiveData({ matchId, videoIds });

  return (
    <>
      {notification && <div className="notification">{notification.text}</div>}

      {/* Mode bar */}
      <div className={styles.modeBar}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.modeBadge} data-mode="live">
          <span className={styles.livePulse} />
          LIVE MODE
        </div>
        <div className={styles.ytStatus}>
          {Object.keys(ytChatIds).length > 0 ? (
            <span className={styles.ytConnected}>
              ▶ {Object.keys(ytChatIds).length} YouTube chat{Object.keys(ytChatIds).length > 1 ? 's' : ''} connected
            </span>
          ) : videoIds.length > 0 ? (
            <span className={styles.ytPending}>▶ Connecting to YouTube chat...</span>
          ) : null}
        </div>
      </div>

      <DashboardHeader
        scoreData={scoreData}
        isConnected={isConnected}
        totalMessages={totalMessages}
        latency={latency}
      />

      <EmotionalScoreboard emotions={emotions} prevEmotions={prevEmotions} />

      <div className={styles.body}>
        <OverByOverChart chartData={chartData} matchEvents={matchEvents} />
        <CityHeatmap cityData={cityData} />
        <VelocityMeter velocity={velocity} velocityHistory={velocityHistory} />
        <MomentCards moments={moments} />
        <LiveFeed messages={messages} />
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerText}>
          Crowd Pulse v2.0 • LIVE MODE • Cricket Data API + YouTube Chat API • Latency: {latency ? `${latency}ms` : '—'}
        </div>
      </footer>
    </>
  );
}


// ─── Simulator Dashboard (Demo Mode) ────────────────────────
function SimulatorDashboard({ onBack }) {
  const {
    emotions, prevEmotions, scoreData, messages, moments,
    cityData, velocity, velocityHistory, chartData, matchEvents,
    isConnected, totalMessages, latency, notification,
  } = useSimulator();

  return (
    <>
      {notification && <div className="notification">{notification.text}</div>}

      {/* Mode bar */}
      <div className={styles.modeBar}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.modeBadge} data-mode="simulator">
          🎮 SIMULATOR MODE
        </div>
        <div className={styles.modeNote}>
          Using simulated MI vs CSK match data
        </div>
      </div>

      <DashboardHeader
        scoreData={scoreData}
        isConnected={isConnected}
        totalMessages={totalMessages}
        latency={latency}
      />

      <EmotionalScoreboard emotions={emotions} prevEmotions={prevEmotions} />

      <div className={styles.body}>
        <OverByOverChart chartData={chartData} matchEvents={matchEvents} />
        <CityHeatmap cityData={cityData} />
        <VelocityMeter velocity={velocity} velocityHistory={velocityHistory} />
        <MomentCards moments={moments} />
        <LiveFeed messages={messages} />
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerText}>
          Crowd Pulse v2.0 • SIMULATOR MODE • Next.js + Firebase • Powered by Google Cloud + Gemini AI
        </div>
      </footer>
    </>
  );
}
