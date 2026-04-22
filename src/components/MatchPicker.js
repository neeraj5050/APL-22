'use client';

import { useState, useEffect } from 'react';
import styles from './MatchPicker.module.css';

export default function MatchPicker({ onStartLive, onStartSimulator }) {
  const [liveMatches, setLiveMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [videoInput, setVideoInput] = useState('');
  const [videoIds, setVideoIds] = useState([]);

  // Fetch live matches on mount
  useEffect(() => {
    async function fetchMatches() {
      setLoading(true);
      try {
        const res = await fetch('/api/cricket');
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const { data } = await res.json();
        setLiveMatches(data || []);
        setError(null);
      } catch (e) {
        console.warn('Could not fetch live matches:', e);
        setError('Could not load live matches. Add your CRICKET_API_KEY in .env.local');
        setLiveMatches([]);
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();
  }, []);

  function addVideoId() {
    const input = videoInput.trim();
    if (!input) return;

    // Extract video ID from various YouTube URL formats
    let vid = input;
    try {
      const url = new URL(input);
      if (url.hostname.includes('youtube.com')) {
        vid = url.searchParams.get('v') || url.pathname.split('/').pop();
      } else if (url.hostname === 'youtu.be') {
        vid = url.pathname.slice(1);
      }
    } catch {
      // Not a URL, treat as plain video ID
    }

    if (vid && !videoIds.includes(vid)) {
      setVideoIds(prev => [...prev, vid]);
    }
    setVideoInput('');
  }

  function removeVideoId(vid) {
    setVideoIds(prev => prev.filter(v => v !== vid));
  }

  function handleStartLive() {
    if (selectedMatch) {
      onStartLive(selectedMatch.matchId, videoIds);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.logo}>🏏</div>
        <h1 className={styles.title}>Crowd Pulse</h1>
        <p className={styles.subtitle}>Real-time Emotional Analytics for Live Cricket</p>
      </div>

      <div className={styles.panels}>
        {/* Live Mode Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelIcon}>📡</div>
            <h2 className={styles.panelTitle}>Live Mode</h2>
            <p className={styles.panelDesc}>Connect to real live cricket scores & YouTube chat</p>
          </div>

          {/* Match Selection */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>① Select Live Match</h3>
            {loading && <div className={styles.loadingPulse}>Fetching live matches...</div>}
            {error && <div className={styles.errorMsg}>{error}</div>}
            
            {!loading && liveMatches.length === 0 && !error && (
              <div className={styles.noMatches}>
                No live matches right now. Try simulator mode or check back later.
              </div>
            )}

            <div className={styles.matchGrid}>
              {liveMatches.map(match => (
                <div
                  key={match.matchId}
                  className={`${styles.matchCard} ${selectedMatch?.matchId === match.matchId ? styles.matchSelected : ''}`}
                  onClick={() => setSelectedMatch(match)}
                >
                  <div className={styles.matchLive}>
                    <span className={styles.matchLiveDot} />
                    LIVE
                  </div>
                  <div className={styles.matchName}>{match.name}</div>
                  <div className={styles.matchScores}>
                    {match.score?.map((s, i) => (
                      <div key={i} className={styles.matchScoreLine}>
                        {s.display}
                      </div>
                    ))}
                  </div>
                  <div className={styles.matchStatus}>{match.status}</div>
                  <div className={styles.matchType}>{match.matchType?.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* YouTube Video IDs */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>② Add YouTube Live Streams <span className={styles.optional}>(optional)</span></h3>
            <p className={styles.sectionHint}>Paste YouTube live stream URLs or video IDs to stream chat comments</p>
            
            <div className={styles.inputRow}>
              <input
                type="text"
                className={styles.input}
                placeholder="YouTube URL or Video ID"
                value={videoInput}
                onChange={e => setVideoInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addVideoId()}
              />
              <button className={styles.addBtn} onClick={addVideoId}>Add</button>
            </div>

            {videoIds.length > 0 && (
              <div className={styles.videoTags}>
                {videoIds.map(vid => (
                  <div key={vid} className={styles.videoTag}>
                    <span className={styles.videoTagIcon}>▶</span>
                    <span className={styles.videoTagId}>{vid}</span>
                    <button className={styles.videoTagRemove} onClick={() => removeVideoId(vid)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className={`${styles.startBtn} ${styles.startLive}`}
            disabled={!selectedMatch}
            onClick={handleStartLive}
          >
            <span className={styles.startBtnPulse} />
            Go Live
          </button>
        </div>

        {/* Simulator Mode Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelIcon}>🎮</div>
            <h2 className={styles.panelTitle}>Simulator Mode</h2>
            <p className={styles.panelDesc}>Experience CrowdPulse with a simulated MI vs CSK match</p>
          </div>

          <div className={styles.simFeatures}>
            <div className={styles.simFeature}>
              <span>🏏</span> Ball-by-ball match simulation
            </div>
            <div className={styles.simFeature}>
              <span>💬</span> Simulated fan messages (X, YT, WhatsApp)
            </div>
            <div className={styles.simFeature}>
              <span>📊</span> Real-time emotional scoring (5 pillars)
            </div>
            <div className={styles.simFeature}>
              <span>🗺️</span> City-level sentiment heatmap
            </div>
            <div className={styles.simFeature}>
              <span>💥</span> Auto-generated moment cards
            </div>
            <div className={styles.simFeature}>
              <span>⚡</span> No API keys needed
            </div>
          </div>

          <button
            className={`${styles.startBtn} ${styles.startSim}`}
            onClick={onStartSimulator}
          >
            🎮 Launch Simulator
          </button>
        </div>
      </div>

      <div className={styles.apiNote}>
        <strong>💡 Setup:</strong> For live mode, add your API keys to <code>.env.local</code>:
        <code className={styles.envBlock}>
          CRICKET_API_KEY=your_cricketdata_org_key{'\n'}
          YOUTUBE_API_KEY=your_google_cloud_key
        </code>
        <span>Free tier: <a href="https://cricketdata.org/member.aspx" target="_blank" rel="noopener">CricketData.org</a> • <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a></span>
      </div>
    </div>
  );
}
