'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MatchSimulator } from '@/lib/simulator';

/**
 * Custom hook that manages the match simulation lifecycle.
 * Provides all real-time data streams to the dashboard components.
 */
export function useSimulator() {
  const simRef = useRef(null);

  const [emotions, setEmotions] = useState({
    tension: 0, euphoria: 0, frustration: 0, disbelief: 0, jubilation: 0,
  });
  const [prevEmotions, setPrevEmotions] = useState({
    tension: 0, euphoria: 0, frustration: 0, disbelief: 0, jubilation: 0,
  });
  const [scoreData, setScoreData] = useState({
    score: '0/0', overs: '0.0', innings: 1, target: null,
    runRate: '0.00', requiredRate: null,
    battingTeam: { code: 'MI', name: 'Mumbai Indians' },
    bowlingTeam: { code: 'CSK', name: 'Chennai Super Kings' },
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

  useEffect(() => {
    const sim = new MatchSimulator();
    simRef.current = sim;

    sim.on('emotionUpdate', (emo) => {
      setEmotions(prev => {
        setPrevEmotions(prev);
        return { ...emo };
      });
    });

    sim.on('scoreUpdate', (data) => {
      setScoreData(data);
    });

    sim.on('ballUpdate', (event) => {
      setTotalMessages(prev => prev + Math.floor(50 + Math.random() * 200));
      setLatency(Math.floor(800 + Math.random() * 1200));

      // Add match event markers
      if (['wicket', 'six', 'four'].includes(event.type)) {
        setMatchEvents(prev => [...prev, {
          over: event.over + event.ball / 10,
          type: event.type,
          description: `${event.type === 'wicket' ? 'W' : event.type === 'six' ? '6' : '4'}! ${event.score}`,
          timestamp: Date.now(),
        }]);
      }

      // Add chart data point every other ball
      setChartData(prev => {
        const newPoint = {
          over: event.over + event.ball / 10,
          emotions: { ...event.emotions },
          event: event.type !== 'dot' && event.type !== 'single' ? event.type : null,
          score: event.score,
          timestamp: Date.now(),
        };
        const updated = [...prev, newPoint];
        return updated.length > 60 ? updated.slice(-60) : updated;
      });
    });

    sim.on('newMessage', (msg) => {
      setMessages(prev => {
        const updated = [msg, ...prev];
        return updated.length > 50 ? updated.slice(0, 50) : updated;
      });
    });

    sim.on('momentCard', (moment) => {
      setMoments(prev => {
        const updated = [moment, ...prev];
        return updated.length > 15 ? updated.slice(0, 15) : updated;
      });
    });

    sim.on('citySentiment', (data) => {
      setCityData(data);
    });

    sim.on('velocityUpdate', (data) => {
      setVelocity(data.messagesPerSecond);
      setVelocityHistory(prev => {
        const updated = [...prev, { value: data.messagesPerSecond, timestamp: data.timestamp }];
        return updated.length > 60 ? updated.slice(-60) : updated;
      });
    });

    sim.on('inningsSwitch', (data) => {
      setNotification({ text: `🏏 Innings Break! Target: ${data.target}`, type: 'info' });
      setTimeout(() => setNotification(null), 4000);
    });

    sim.on('matchEnd', (data) => {
      setNotification({ text: `🏆 ${data.winner} wins!`, type: 'jubilation' });
      setIsConnected(false);
    });

    // Start simulation
    setIsConnected(true);
    sim.start(3500);

    return () => {
      sim.stop();
    };
  }, []);

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
  };
}
