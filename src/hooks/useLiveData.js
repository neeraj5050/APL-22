'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Cities for heatmap (standalone, no simulator dependency)
const CITIES = [
  { name: 'Mumbai', lat: 19.076, lng: 72.877, population: 20.7, teamBias: 'MI' },
  { name: 'Chennai', lat: 13.082, lng: 80.270, population: 10.9, teamBias: 'CSK' },
  { name: 'Delhi', lat: 28.704, lng: 77.102, population: 16.3, teamBias: null },
  { name: 'Bangalore', lat: 12.971, lng: 77.594, population: 12.3, teamBias: 'RCB' },
  { name: 'Kolkata', lat: 22.572, lng: 88.363, population: 14.8, teamBias: 'KKR' },
  { name: 'Hyderabad', lat: 17.385, lng: 78.486, population: 10.0, teamBias: 'SRH' },
  { name: 'Pune', lat: 18.520, lng: 73.856, population: 7.4, teamBias: 'MI' },
  { name: 'Ahmedabad', lat: 23.022, lng: 72.571, population: 8.0, teamBias: 'GT' },
  { name: 'Jaipur', lat: 26.912, lng: 75.787, population: 6.6, teamBias: 'RR' },
  { name: 'Lucknow', lat: 26.846, lng: 80.946, population: 5.0, teamBias: 'LSG' },
  { name: 'Chandigarh', lat: 30.733, lng: 76.779, population: 3.0, teamBias: 'PBKS' },
  { name: 'Indore', lat: 22.719, lng: 75.857, population: 3.2, teamBias: null },
];

function clamp(val, min, max) { return Math.min(max, Math.max(min, val)); }

function makeCitySentiment(baseEmotions, battingCode) {
  return CITIES.map(city => {
    const emo = { ...baseEmotions };
    if (city.teamBias === battingCode) {
      emo.euphoria = clamp(emo.euphoria + 0.15, 0, 1);
      emo.jubilation = clamp(emo.jubilation + 0.1, 0, 1);
      emo.frustration = clamp(emo.frustration - 0.1, 0, 1);
    }
    Object.keys(emo).forEach(k => {
      emo[k] = clamp(emo[k] + (Math.random() - 0.5) * 0.15, 0, 1);
    });
    const dominant = Object.entries(emo).reduce((a, b) => a[1] > b[1] ? a : b);
    return { ...city, emotions: emo, dominant: dominant[0], dominantScore: dominant[1], messageCount: Math.floor(city.population * 200 * (1 + dominant[1])) };
  });
}

/**
 * useLiveData Hook
 * 
 * Connects to REAL live data sources:
 *   1. Cricket Data API → live match scores (polled every 10s)
 *   2. YouTube Live Chat API → real-time chat messages (polled per API interval)
 * 
 * Falls back to simulator data for emotions/cities until real sentiment
 * analysis is available.
 * 
 * Props:
 *   matchId   - CricketData.org match ID (or null to show match picker)
 *   videoIds  - Array of YouTube video IDs to stream chat from
 */
export function useLiveData({ matchId = null, videoIds = [] } = {}) {
  // ─── State ─────────────────────────────────────────────────
  const [emotions, setEmotions] = useState({
    tension: 0.3, euphoria: 0.2, frustration: 0.15, disbelief: 0.1, jubilation: 0.1,
  });
  const [prevEmotions, setPrevEmotions] = useState({
    tension: 0.3, euphoria: 0.2, frustration: 0.15, disbelief: 0.1, jubilation: 0.1,
  });
  const [scoreData, setScoreData] = useState({
    score: '—', overs: '—', innings: 1, target: null,
    runRate: '—', requiredRate: null,
    battingTeam: { code: '—', name: 'Waiting for match...' },
    bowlingTeam: { code: '—', name: '' },
    matchName: '',
    matchStatus: '',
  });
  const [messages, setMessages] = useState([]);
  const [moments, setMoments] = useState([]);
  const [cityData, setCityData] = useState([]);
  const [velocity, setVelocity] = useState(0);
  const [velocityHistory, setVelocityHistory] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [matchEvents, setMatchEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const [latency, setLatency] = useState(null);
  const [notification, setNotification] = useState(null);

  // Live match list for picker
  const [liveMatches, setLiveMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(matchId);

  // YouTube chat state
  const [ytChatIds, setYtChatIds] = useState({});   // videoId → liveChatId
  const [ytVideoTitles, setYtVideoTitles] = useState({});
  const ytPageTokens = useRef({});   // videoId → nextPageToken
  const ytPollIntervals = useRef({}); // videoId → interval ms

  // Previous score tracking for event detection
  const prevScoreRef = useRef(null);
  const intervalsRef = useRef([]);

  // ─── Emotion tracking from message volume ──────────────────
  const messageCountRef = useRef(0);
  const emotionWindowRef = useRef([]);

  // ─── Fetch Live Matches ────────────────────────────────────
  const fetchLiveMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/cricket');
      if (!res.ok) return;
      const { data } = await res.json();
      if (data && Array.isArray(data)) {
        setLiveMatches(data);
      }
    } catch (e) {
      console.warn('Failed to fetch live matches:', e);
    }
  }, []);

  // ─── Fetch Cricket Score ───────────────────────────────────
  const fetchScore = useCallback(async () => {
    if (!selectedMatchId) return;

    const start = performance.now();
    try {
      const res = await fetch(`/api/cricket?matchId=${selectedMatchId}`);
      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);

      if (!res.ok) return;
      const { data } = await res.json();
      if (!data) return;

      setIsConnected(true);

      // Parse the scores
      const scores = data.score || [];
      const latestInning = scores[scores.length - 1] || {};
      const battingTeamName = (latestInning.inning || '').replace(' Inning 1', '').replace(' Inning 2', '').replace(' Inning', '').trim();
      
      // Detect which teams
      const teams = data.teams || [];
      const battingCode = battingTeamName.slice(0, 3).toUpperCase();
      const bowlingTeam = teams.find(t => !t.toLowerCase().startsWith(battingTeamName.toLowerCase().slice(0, 4))) || teams[1] || '';
      const bowlingCode = bowlingTeam.slice(0, 3).toUpperCase();

      // Parse runs and overs
      const runs = latestInning.runs ?? 0;
      const wickets = latestInning.wickets ?? 0;
      const overs = latestInning.overs ?? 0;
      const currentScore = `${runs}/${wickets}`;

      // Detect target for 2nd innings
      const isSecondInnings = scores.length >= 2;
      const target = isSecondInnings ? (scores[0].runs + 1) : null;
      const rr = overs > 0 ? (runs / overs).toFixed(2) : '0.00';
      const ballsRemaining = isSecondInnings ? Math.max((20 - overs) * 6, 1) : null;
      const rrr = (isSecondInnings && target) 
        ? (((target - runs) / ballsRemaining) * 6).toFixed(2) 
        : null;

      const newScoreData = {
        score: currentScore,
        overs: String(overs),
        innings: isSecondInnings ? 2 : 1,
        target,
        runRate: rr,
        requiredRate: rrr,
        battingTeam: { code: battingCode, name: battingTeamName },
        bowlingTeam: { code: bowlingCode, name: bowlingTeam },
        matchName: data.name || '',
        matchStatus: data.status || '',
      };

      // Detect events by comparing with previous score
      const prevScore = prevScoreRef.current;
      if (prevScore && prevScore.score !== currentScore) {
        const prevRuns = parseInt(prevScore.score.split('/')[0]) || 0;
        const prevWickets = parseInt(prevScore.score.split('/')[1]) || 0;
        const runsDiff = runs - prevRuns;
        const wicketsDiff = wickets - prevWickets;

        let eventType = null;
        if (wicketsDiff > 0) eventType = 'wicket';
        else if (runsDiff === 6) eventType = 'six';
        else if (runsDiff === 4) eventType = 'four';
        else if (runsDiff === 0) eventType = 'dot';

        if (eventType && ['wicket', 'six', 'four'].includes(eventType)) {
          setMatchEvents(prev => [...prev, {
            over: parseFloat(overs),
            type: eventType,
            description: `${eventType === 'wicket' ? 'W' : eventType === 'six' ? '6' : '4'}! ${currentScore}`,
            timestamp: Date.now(),
          }]);

          // Update emotions based on events
          updateEmotionsFromEvent(eventType, newScoreData);
        }

        // Add chart data point
        setChartData(prev => {
          const newPoint = {
            over: parseFloat(overs),
            emotions: { ...emotions },
            event: eventType !== 'dot' && eventType !== 'single' ? eventType : null,
            score: currentScore,
            timestamp: Date.now(),
          };
          const updated = [...prev, newPoint];
          return updated.length > 60 ? updated.slice(-60) : updated;
        });
      }

      prevScoreRef.current = newScoreData;
      setScoreData(newScoreData);

    } catch (e) {
      console.warn('Failed to fetch score:', e);
    }
  }, [selectedMatchId, emotions]);

  // ─── Update emotions from match events ─────────────────────
  const updateEmotionsFromEvent = useCallback((eventType, scoreInfo) => {
    setEmotions(prev => {
      setPrevEmotions(prev);
      const next = { ...prev };
      const isChase = scoreInfo.innings === 2;

      switch (eventType) {
        case 'wicket':
          next.tension = Math.min(1, prev.tension + 0.15);
          next.frustration = Math.min(1, prev.frustration + 0.2);
          next.disbelief = Math.min(1, prev.disbelief + 0.1);
          next.euphoria = Math.max(0, prev.euphoria - 0.1);
          break;
        case 'six':
          next.euphoria = Math.min(1, prev.euphoria + 0.25);
          next.disbelief = Math.min(1, prev.disbelief + 0.1);
          next.jubilation = Math.min(1, prev.jubilation + 0.1);
          next.frustration = Math.max(0, prev.frustration - 0.1);
          break;
        case 'four':
          next.euphoria = Math.min(1, prev.euphoria + 0.15);
          next.jubilation = Math.min(1, prev.jubilation + 0.05);
          break;
        case 'dot':
          next.tension = Math.min(1, prev.tension + 0.03);
          next.frustration = Math.min(1, prev.frustration + 0.05);
          break;
      }

      // Chase amplifier
      if (isChase) {
        const rrr = parseFloat(scoreInfo.requiredRate || 0);
        if (rrr > 10) next.tension = Math.min(1, next.tension + 0.1);
        if (rrr > 15) next.tension = Math.min(1, next.tension + 0.15);
      }

      // Decay towards baseline
      Object.keys(next).forEach(k => {
        next[k] = next[k] * 0.95 + 0.15 * 0.05; // Slow decay to 0.15
      });

      return next;
    });
  }, []);

  // ─── YouTube Chat: Resolve liveChatIds ─────────────────────
  const resolveYtChatIds = useCallback(async () => {
    for (const videoId of videoIds) {
      if (ytChatIds[videoId]) continue; // Already resolved

      try {
        const res = await fetch(`/api/youtube-chat?videoId=${videoId}`);
        if (!res.ok) continue;
        const { data } = await res.json();
        if (data?.liveChatId) {
          setYtChatIds(prev => ({ ...prev, [videoId]: data.liveChatId }));
          setYtVideoTitles(prev => ({ ...prev, [videoId]: data.title || videoId }));
        }
      } catch (e) {
        console.warn(`Failed to resolve YT chat for ${videoId}:`, e);
      }
    }
  }, [videoIds, ytChatIds]);

  // ─── YouTube Chat: Poll Messages ───────────────────────────
  const pollYtChat = useCallback(async (videoId, chatId) => {
    try {
      const pageToken = ytPageTokens.current[videoId] || '';
      const url = `/api/youtube-chat?chatId=${chatId}${pageToken ? `&pageToken=${pageToken}` : ''}`;
      
      const res = await fetch(url);
      if (!res.ok) return;
      const { data } = await res.json();
      if (!data) return;

      // Save pagination token for next poll
      if (data.nextPageToken) {
        ytPageTokens.current[videoId] = data.nextPageToken;
      }

      // Update polling interval from API recommendation
      if (data.pollingIntervalMs) {
        ytPollIntervals.current[videoId] = data.pollingIntervalMs;
      }

      // Transform and add messages
      if (data.messages && data.messages.length > 0) {
        const newMsgs = data.messages.map(msg => ({
          id: `yt_${msg.id}`,
          text: msg.text,
          platform: 'youtube',
          emotion: detectQuickEmotion(msg.text),
          score: 0.5,
          city: null,
          timestamp: new Date(msg.publishedAt).getTime(),
          author: msg.author,
          isModerator: msg.isModerator,
          isOwner: msg.isOwner,
          superChat: msg.superChatAmount,
        }));

        setMessages(prev => {
          const updated = [...newMsgs.reverse(), ...prev];
          return updated.slice(0, 100);
        });

        setTotalMessages(prev => prev + newMsgs.length);
        messageCountRef.current += newMsgs.length;

        // Update velocity
        setVelocity(prev => {
          const newVel = Math.max(prev, newMsgs.length * 2); // Approximate
          setVelocityHistory(h => {
            const updated = [...h, { value: newVel, timestamp: Date.now() }];
            return updated.length > 60 ? updated.slice(-60) : updated;
          });
          return newVel;
        });

        // Update emotions from message sentiment
        updateEmotionsFromMessages(newMsgs);
      }
    } catch (e) {
      console.warn(`YT chat poll error (${videoId}):`, e);
    }
  }, []);

  // ─── Quick emotion detection (client-side, no AI) ──────────
  function detectQuickEmotion(text) {
    const t = (text || '').toLowerCase();
    
    // Jubilation
    if (/\b(won|win|champion|victory|🏆|🎉|🥳|party|jeet)\b/i.test(t)) return 'jubilation';
    // Euphoria
    if (/\b(yes+|amazing|fire|🔥|shot|six|sixer|boundary|beautiful|kya maar|lesgo|bussin|W )\b/i.test(t) || t.includes('🔥🔥')) return 'euphoria';
    // Frustration  
    if (/\b(worst|terrible|rubbish|bekaar|drop|😤|🤦|sack|L |mid|gg)\b/i.test(t) || t.includes('🤡')) return 'frustration';
    // Disbelief
    if (/\b(no way|how|what|unbeliev|😱|🤯|script|bruh|dead 💀)\b/i.test(t)) return 'disbelief';
    // Tension
    if (/\b(nervous|tension|can't watch|heart|nail|close|😰|🫣)\b/i.test(t)) return 'tension';
    
    // Random assignment for unclassified
    const all = ['tension', 'euphoria', 'frustration', 'disbelief', 'jubilation'];
    return all[Math.floor(Math.random() * all.length)];
  }

  // ─── Update emotions from chat message sentiments ──────────
  function updateEmotionsFromMessages(msgs) {
    if (!msgs.length) return;

    const emotionCounts = { tension: 0, euphoria: 0, frustration: 0, disbelief: 0, jubilation: 0 };
    msgs.forEach(m => { emotionCounts[m.emotion] = (emotionCounts[m.emotion] || 0) + 1; });

    const total = msgs.length;
    setEmotions(prev => {
      setPrevEmotions(prev);
      const next = { ...prev };
      Object.keys(emotionCounts).forEach(key => {
        const ratio = emotionCounts[key] / total;
        // Blend: 80% previous + 20% new signal
        next[key] = Math.min(1, Math.max(0, prev[key] * 0.8 + ratio * 0.2 + (ratio > 0.3 ? 0.05 : 0)));
      });
      return next;
    });
  }

  // ─── Moment detection from emotion spikes ──────────────────
  useEffect(() => {
    const emotionHistory = emotionWindowRef.current;
    emotionHistory.push({ ...emotions, timestamp: Date.now() });
    if (emotionHistory.length > 20) emotionHistory.shift();

    if (emotionHistory.length < 5) return;

    // Check for spikes
    const recent = emotionHistory.slice(-3);
    const baseline = emotionHistory.slice(0, -3);

    Object.keys(emotions).forEach(pillar => {
      const currentScore = emotions[pillar];
      const avgBaseline = baseline.reduce((s, e) => s + e[pillar], 0) / baseline.length;
      const delta = currentScore - avgBaseline;

      if (delta > 0.25 && currentScore > 0.6) {
        // Check we haven't just fired this moment
        const lastMoment = moments[0];
        if (lastMoment && Date.now() - lastMoment.timestamp < 15000) return;

        const intensityLabels = ['Simmering', 'Building', 'Surging', 'Explosive', 'NUCLEAR'];
        const idx = Math.min(Math.floor(currentScore * 5), 4);
        const emojis = { tension: '😰', euphoria: '🤩', frustration: '😤', disbelief: '😱', jubilation: '🎉' };

        setMoments(prev => {
          const newMoment = {
            id: `moment_${Date.now()}`,
            title: generateMomentTitle(pillar, scoreData),
            emotion: pillar,
            emoji: emojis[pillar],
            context: `${pillar.charAt(0).toUpperCase() + pillar.slice(1)} surged by ${Math.round(delta * 100)}% at ${scoreData.score}. Message velocity is high across the platform.`,
            intensity: intensityLabels[idx],
            score: currentScore,
            zScore: delta / 0.1,
            over: scoreData.overs,
            matchScore: scoreData.score,
            timestamp: Date.now(),
            fanQuote: messages[0]?.text || '',
          };
          return [newMoment, ...prev].slice(0, 15);
        });
      }
    });
  }, [emotions]);

  function generateMomentTitle(pillar, score) {
    const titles = {
      tension: ["NERVES OF STEEL! 😰", "Can't. Look. Away.", "THE PRESSURE COOKER!"],
      euphoria: ["THE CROWD GOES WILD! 🔥", "ABSOLUTE SCENES! 🤩", "THIS. IS. CRICKET! 🏏"],
      frustration: ["FANS IN MELTDOWN! 😤", "Social Media Erupts!", "THE COLLAPSE IS REAL 💔"],
      disbelief: ["DID THAT JUST HAPPEN?! 😱", "SCRIPT WRITERS ON OVERTIME!", "UNBELIEVABLE!"],
      jubilation: ["CHAMPIONS VIBES! 🏆", "PARTY MODE! 🎉", "Victory Roar!"],
    };
    const opts = titles[pillar] || titles.tension;
    return opts[Math.floor(Math.random() * opts.length)];
  }

  // ─── Initialize & Polling Loops ────────────────────────────
  useEffect(() => {
    // Fetch live matches on mount
    fetchLiveMatches();
    const matchListInterval = setInterval(fetchLiveMatches, 60000); // Refresh every 60s
    intervalsRef.current.push(matchListInterval);

    return () => {
      intervalsRef.current.forEach(id => clearInterval(id));
      intervalsRef.current = [];
    };
  }, [fetchLiveMatches]);

  // Poll cricket score
  useEffect(() => {
    if (!selectedMatchId) return;

    fetchScore(); // Immediate first fetch
    const scoreInterval = setInterval(fetchScore, 10000); // Every 10s
    intervalsRef.current.push(scoreInterval);

    return () => {
      clearInterval(scoreInterval);
    };
  }, [selectedMatchId, fetchScore]);

  // Resolve YouTube chat IDs
  useEffect(() => {
    if (videoIds.length === 0) return;
    resolveYtChatIds();
  }, [videoIds, resolveYtChatIds]);

  // Poll YouTube chats
  useEffect(() => {
    const chatEntries = Object.entries(ytChatIds);
    if (chatEntries.length === 0) return;

    const timers = [];
    chatEntries.forEach(([videoId, chatId]) => {
      const interval = ytPollIntervals.current[videoId] || 6000;
      
      // Initial poll
      pollYtChat(videoId, chatId);
      
      // Recurring poll
      const timer = setInterval(() => {
        pollYtChat(videoId, chatId);
      }, interval);
      timers.push(timer);
    });

    return () => timers.forEach(t => clearInterval(t));
  }, [ytChatIds, pollYtChat]);

  // City sentiment (generated using hook's own emotions)
  useEffect(() => {
    if (!isConnected) return;
    const cityInterval = setInterval(() => {
      setCityData(makeCitySentiment(emotions, scoreData.battingTeam?.code || ''));
    }, 5000);
    intervalsRef.current.push(cityInterval);
    return () => clearInterval(cityInterval);
  }, [isConnected]);

  // ─── Return ────────────────────────────────────────────────
  return {
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
    // Live-specific
    liveMatches,
    selectedMatchId,
    setSelectedMatchId,
    ytVideoTitles,
    ytChatIds,
  };
}
