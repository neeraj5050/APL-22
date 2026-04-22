/* ============================================================
   CROWD PULSE — Main Application Controller
   Orchestrates all dashboard components and data flow
   ============================================================ */

const CrowdPulseApp = (() => {
    // ---- DOM References ----
    const els = {};

    // ---- State ----
    let isInitialized = false;
    let currentEmotions = {
        tension: 0,
        euphoria: 0,
        frustration: 0,
        disbelief: 0,
        jubilation: 0,
    };
    let totalMessages = 0;
    let activeCities = 0;
    let messagesPerSecond = 0;
    let ballCount = 0;

    function init() {
        // Cache DOM elements
        els.score = document.getElementById('match-score');
        els.overs = document.getElementById('match-overs');
        els.runRate = document.getElementById('run-rate');
        els.reqRate = document.getElementById('req-rate');
        els.totalMessages = document.getElementById('total-messages');
        els.activeCities = document.getElementById('active-cities');
        els.latency = document.getElementById('latency-value');
        els.velocityNumber = document.getElementById('velocity-number');
        els.connectionDot = document.getElementById('connection-dot');
        els.connectionText = document.getElementById('connection-text');
        els.inningsLabel = document.getElementById('innings-label');
        els.targetLabel = document.getElementById('target-label');

        // Emotion pillar elements
        ['tension', 'euphoria', 'frustration', 'disbelief', 'jubilation'].forEach(emotion => {
            els[`${emotion}Score`] = document.getElementById(`${emotion}-score`);
            els[`${emotion}Bar`] = document.getElementById(`${emotion}-bar`);
            els[`${emotion}Delta`] = document.getElementById(`${emotion}-delta`);
            els[`${emotion}Pillar`] = document.getElementById(`${emotion}-pillar`);
        });

        // Initialize sub-managers
        ChartsManager.init();
        HeatmapManager.init();
        MomentsManager.init();
        FeedManager.init();

        // Connect to simulator
        connectSimulator();

        // Update connection status
        updateConnectionStatus(true);

        // Periodic UI refresh
        setInterval(updateHeaderStats, 1000);

        isInitialized = true;
        console.log('🏏 Crowd Pulse initialized');
    }

    function connectSimulator() {
        // Subscribe to all simulator events
        CrowdPulseSimulator.subscribe('emotionUpdate', handleEmotionUpdate);
        CrowdPulseSimulator.subscribe('scoreUpdate', handleScoreUpdate);
        CrowdPulseSimulator.subscribe('ballUpdate', handleBallUpdate);
        CrowdPulseSimulator.subscribe('overComplete', handleOverComplete);
        CrowdPulseSimulator.subscribe('newMessage', handleNewMessage);
        CrowdPulseSimulator.subscribe('momentCard', handleMomentCard);
        CrowdPulseSimulator.subscribe('citySentiment', handleCitySentiment);
        CrowdPulseSimulator.subscribe('velocityUpdate', handleVelocityUpdate);
        CrowdPulseSimulator.subscribe('inningsSwitch', handleInningsSwitch);
        CrowdPulseSimulator.subscribe('matchEnd', handleMatchEnd);

        // Start the simulation
        CrowdPulseSimulator.startSimulation(3500);
    }

    // ---- Event Handlers ----

    function handleEmotionUpdate(emotions) {
        const prevEmotions = { ...currentEmotions };
        currentEmotions = emotions;

        // Find dominant
        let dominant = 'tension';
        let maxScore = 0;
        Object.entries(emotions).forEach(([key, val]) => {
            if (val > maxScore) { maxScore = val; dominant = key; }
        });

        // Update each pillar
        Object.entries(emotions).forEach(([emotion, score]) => {
            const scoreEl = els[`${emotion}Score`];
            const barEl = els[`${emotion}Bar`];
            const deltaEl = els[`${emotion}Delta`];
            const pillarEl = els[`${emotion}Pillar`];

            if (scoreEl) {
                const displayValue = Math.round(score * 100);
                animateNumber(scoreEl, displayValue);
            }

            if (barEl) {
                barEl.style.width = `${score * 100}%`;
            }

            if (deltaEl) {
                const delta = score - (prevEmotions[emotion] || 0);
                const deltaPercent = Math.round(delta * 100);
                if (deltaPercent > 0) {
                    deltaEl.textContent = `▲ +${deltaPercent}%`;
                    deltaEl.className = 'emotion-delta up';
                } else if (deltaPercent < 0) {
                    deltaEl.textContent = `▼ ${deltaPercent}%`;
                    deltaEl.className = 'emotion-delta down';
                } else {
                    deltaEl.textContent = `— 0%`;
                    deltaEl.className = 'emotion-delta stable';
                }
            }

            if (pillarEl) {
                pillarEl.classList.toggle('active', emotion === dominant);

                // Spike animation
                const delta = score - (prevEmotions[emotion] || 0);
                if (delta > 0.15) {
                    pillarEl.classList.add('spike');
                    setTimeout(() => pillarEl.classList.remove('spike'), 600);
                }
            }
        });
    }

    function handleScoreUpdate(data) {
        if (els.score) els.score.textContent = data.score;
        if (els.overs) els.overs.textContent = `(${data.overs} ov)`;
        if (els.runRate) els.runRate.textContent = data.runRate;
        if (els.reqRate) {
            if (data.requiredRate) {
                els.reqRate.textContent = data.requiredRate;
                els.reqRate.parentElement.style.display = '';
            } else {
                els.reqRate.parentElement.style.display = 'none';
            }
        }
        if (els.inningsLabel) {
            els.inningsLabel.textContent = data.innings === 2 ? '2nd Innings' : '1st Innings';
        }
        if (els.targetLabel) {
            if (data.target) {
                els.targetLabel.textContent = `Target: ${data.target}`;
                els.targetLabel.style.display = '';
            } else {
                els.targetLabel.style.display = 'none';
            }
        }
    }

    function handleBallUpdate(event) {
        ballCount++;
        totalMessages += Math.floor(50 + Math.random() * 200);

        // Add match event markers to chart
        if (event.type === 'wicket') {
            ChartsManager.addMatchEvent(event.over + event.ball / 10, 'wicket', `W! ${event.score}`);
        } else if (event.type === 'six') {
            ChartsManager.addMatchEvent(event.over + event.ball / 10, 'six', `6! ${event.score}`);
        } else if (event.type === 'four') {
            ChartsManager.addMatchEvent(event.over + event.ball / 10, 'four', `4! ${event.score}`);
        }

        // Add data point to chart every few balls
        if (ballCount % 2 === 0) {
            ChartsManager.addOverData(
                event.over + event.ball / 10,
                event.emotions,
                event.type !== 'dot' && event.type !== 'single' ? event.type : null,
                event.score
            );
        }

        // Simulate latency
        if (els.latency) {
            const latency = Math.floor(800 + Math.random() * 1200);
            els.latency.textContent = `${latency}ms`;
        }
    }

    function handleOverComplete(data) {
        ChartsManager.addOverData(data.over, data.emotions, null, data.score);
    }

    function handleNewMessage(message) {
        FeedManager.addMessage(message);
    }

    function handleMomentCard(moment) {
        MomentsManager.addMoment(moment);

        // Flash effect on the moments card
        const momentsCard = document.getElementById('moments-card');
        if (momentsCard) {
            momentsCard.style.boxShadow = `0 0 30px ${getEmotionGlow(moment.emotion)}`;
            setTimeout(() => {
                momentsCard.style.boxShadow = '';
            }, 1500);
        }
    }

    function handleCitySentiment(cityData) {
        HeatmapManager.updateCityData(cityData);
        activeCities = cityData.filter(c => c.messageCount > 500).length;
    }

    function handleVelocityUpdate(data) {
        messagesPerSecond = data.messagesPerSecond;
        ChartsManager.addVelocityData(data.messagesPerSecond);
        if (els.velocityNumber) {
            animateNumber(els.velocityNumber, data.messagesPerSecond);
        }
    }

    function handleInningsSwitch(data) {
        // Show innings switch notification
        showNotification(`🏏 Innings Break! Target: ${data.target}`, 'info');
    }

    function handleMatchEnd(data) {
        showNotification(`🏆 ${data.winner} wins!`, 'jubilation');
        updateConnectionStatus(false);
    }

    // ---- UI Helpers ----

    function animateNumber(el, target) {
        if (!el) return;
        const current = parseInt(el.textContent) || 0;
        const diff = target - current;
        const steps = 10;
        const stepSize = diff / steps;
        let step = 0;

        function tick() {
            step++;
            const val = Math.round(current + stepSize * step);
            el.textContent = step === steps ? target.toLocaleString() : val.toLocaleString();
            if (step < steps) requestAnimationFrame(tick);
        }
        tick();
    }

    function updateHeaderStats() {
        if (els.totalMessages) {
            els.totalMessages.textContent = totalMessages.toLocaleString();
        }
        if (els.activeCities) {
            els.activeCities.textContent = activeCities;
        }
    }

    function updateConnectionStatus(connected) {
        if (els.connectionDot) {
            els.connectionDot.className = `connection-dot ${connected ? 'connected' : 'disconnected'}`;
        }
        if (els.connectionText) {
            els.connectionText.textContent = connected ? 'Live Connected' : 'Disconnected';
        }
    }

    function getEmotionGlow(emotion) {
        const glows = {
            tension: 'rgba(249, 115, 22, 0.3)',
            euphoria: 'rgba(34, 197, 94, 0.3)',
            frustration: 'rgba(239, 68, 68, 0.3)',
            disbelief: 'rgba(168, 85, 247, 0.3)',
            jubilation: 'rgba(234, 179, 8, 0.3)',
        };
        return glows[emotion] || 'rgba(59, 130, 246, 0.3)';
    }

    function showNotification(text, type) {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 20, 45, 0.9);
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 12px;
            padding: 12px 24px;
            font-family: 'Outfit', sans-serif;
            font-weight: 600;
            font-size: 1rem;
            color: #f0f2f8;
            z-index: 10000;
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            animation: slideDown 0.4s ease-out;
        `;
        notif.textContent = text;
        document.body.appendChild(notif);

        // Add animation keyframes if not present
        if (!document.getElementById('notif-style')) {
            const style = document.createElement('style');
            style.id = 'notif-style';
            style.textContent = `
                @keyframes slideDown {
                    from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transition = 'opacity 0.5s ease';
            setTimeout(() => notif.remove(), 500);
        }, 4000);
    }

    return {
        init,
    };
})();

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
    CrowdPulseApp.init();
});
