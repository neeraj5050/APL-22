/* ============================================================
   CROWD PULSE — WebSocket Simulation Layer
   Generates realistic IPL match data for the prototype
   ============================================================ */

const CrowdPulseSimulator = (() => {
    // Match state
    const state = {
        matchId: 'IPL2026_MI_CSK_052',
        teams: {
            batting: { code: 'MI', name: 'Mumbai Indians', score: 0, wickets: 0 },
            bowling: { code: 'CSK', name: 'Chennai Super Kings', score: 0, wickets: 0 }
        },
        innings: 1,
        over: 0,
        ball: 0,
        totalOvers: 20,
        target: null, // Set in innings 2
        isLive: true,
        startTime: Date.now(),
        lastEventTime: Date.now(),
        matchEvents: [],
        overHistory: []
    };

    // Emotional state with momentum
    const emotions = {
        tension: 0.35,
        euphoria: 0.2,
        frustration: 0.15,
        disbelief: 0.1,
        jubilation: 0.1
    };

    // Emotion momentum (inertia for smoother transitions)
    const emotionMomentum = {
        tension: 0,
        euphoria: 0,
        frustration: 0,
        disbelief: 0,
        jubilation: 0
    };

    // City data for India
    const cities = [
        { name: 'Mumbai', lat: 19.076, lng: 72.8777, population: 20.7, teamBias: 'MI' },
        { name: 'Chennai', lat: 13.0827, lng: 80.2707, population: 10.9, teamBias: 'CSK' },
        { name: 'Delhi', lat: 28.7041, lng: 77.1025, population: 16.3, teamBias: null },
        { name: 'Bangalore', lat: 12.9716, lng: 77.5946, population: 12.3, teamBias: 'RCB' },
        { name: 'Kolkata', lat: 22.5726, lng: 88.3639, population: 14.8, teamBias: 'KKR' },
        { name: 'Hyderabad', lat: 17.385, lng: 78.4867, population: 10.0, teamBias: 'SRH' },
        { name: 'Pune', lat: 18.5204, lng: 73.8567, population: 7.4, teamBias: 'MI' },
        { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714, population: 8.0, teamBias: 'GT' },
        { name: 'Jaipur', lat: 26.9124, lng: 75.7873, population: 6.6, teamBias: 'RR' },
        { name: 'Lucknow', lat: 26.8467, lng: 80.9462, population: 5.0, teamBias: 'LSG' },
        { name: 'Chandigarh', lat: 30.7333, lng: 76.7794, population: 3.0, teamBias: 'PBKS' },
        { name: 'Indore', lat: 22.7196, lng: 75.8577, population: 3.2, teamBias: null },
    ];

    // Fan message templates by emotion
    const messageTemplates = {
        tension: {
            twitter: [
                "Can't watch this 😰 my heart can't take it #MIvCSK",
                "Need {runs} off {balls} balls... THIS IS IT 🫣",
                "Nail biting finish incoming 💀 #IPL2026",
                "I literally can't breathe rn 😤😤😤",
                "The tension is UNREAL rn, kya hoga ab 😱",
                "Pressure cooker situation! Who blinks first?",
                "My BP is through the roof watching this #CrowdPulse",
            ],
            youtube: [
                "OMG this match is giving me anxiety",
                "cant breathe!!! so tense",
                "who else is stressed rn???",
                "nail biter alert 🚨🚨🚨",
            ],
            whatsapp: [
                "Bro ye match khatam karo yaar 😭",
                "Heart attack aa jayega mujhe toh",
                "Kya scene hai yaar tension tension",
            ],
        },
        euphoria: {
            twitter: [
                "YESSSSSS WHAT A SHOT 🔥🔥🔥 #MI",
                "TAKE A BOW! Absolute MASTERCLASS 💙💙",
                "SIIIIXXXX! INTO THE STANDS! 🏏🔥🔥🔥 #IPL",
                "This is PEAK cricket! I'm literally screaming rn",
                "WHAT A DELIVERY! Pure perfection 🎯🎯🎯",
                "KYA MAARAAAA BHAI 🔥🔥🔥🔥🔥",
                "Paltan army lessgoooooo 💙💙💙 #MumbaiIndians",
            ],
            youtube: [
                "BEAUTIFUL SHOT 🔥🔥🔥",
                "I just jumped off my couch!!!",
                "Best match of IPL 2026 easily",
                "THIS GUY IS ON FIRE 🔥🔥🔥",
            ],
            whatsapp: [
                "Kya shot tha yaar 🤯",
                "Bhai bhai bhai! 🔥",
                "What a player man! 💪",
            ],
        },
        frustration: {
            twitter: [
                "WHY would you play that shot there 🤦‍♂️🤦‍♂️ #MI",
                "Dropped AGAIN. Catches win matches ffs 😤😤",
                "Absolutely RUBBISH bowling. Bekaar 😡",
                "Sack the coach, sack the captain, sack everyone 💀",
                "This is painful to watch. Just painful. #IPL",
                "No intent™ as usual 🤡🤡🤡",
                "How many times are we going to repeat the same mistakes?!",
            ],
            youtube: [
                "terrible shot selection as usual",
                "this team doesnt deserve to win smh",
                "worst bowling ive seen all season",
                "bruh just retire already 🤦",
            ],
            whatsapp: [
                "Ye kya bakwas kar raha hai 😤",
                "Bekaar team, har baar same story",
                "Match toh gaya ab, gg",
            ],
        },
        disbelief: {
            twitter: [
                "NO WAY. NO WAY THAT JUST HAPPENED 😱😱😱",
                "ARE YOU KIDDING ME?! How is that possible?! #IPL",
                "Script writers at it again 📝📝📝",
                "I've seen everything now. Pack it up 😭",
                "This doesn't feel real. What am I watching??",
                "HOWWWWW?!?!? 🤯🤯🤯🤯🤯",
                "This match is SCRIPTED I refuse to believe otherwise",
            ],
            youtube: [
                "WHAT IS HAPPENING",
                "am i dreaming rn???",
                "this is not real this is NOT REAL",
                "I literally cant believe what I just saw 🤯",
            ],
            whatsapp: [
                "Bro kya ho raha hai 🤯",
                "Believe nahi ho raha yaar",
                "Pagal ho gaye sab",
            ],
        },
        jubilation: {
            twitter: [
                "WE WON! WE ACTUALLY WON! 💙💙💙🏆🏆🏆 #MI",
                "CHAMPIONS! Legacy cemented forever! 👑👑👑",
                "Greatest match in IPL HISTORY! #IPL2026 🏏🔥",
                "Whistlepodu... wait wrong team but WHAT A WIN! 🎉",
                "PARTY IN MUMBAI TONIGHT! 🥳🎊🎉💙",
                "Apni team 💪💪💪 No one can stop us!",
                "Thala would be proud 💛 wait wrong team 😂 #MI",
            ],
            youtube: [
                "YESSSSSS WE DID IT 🏆🏆🏆",
                "greatest game ever played",
                "I'm literally crying tears of joy rn 😭",
                "WHAT A WIN WHAT A WIN WHAT A WIN",
            ],
            whatsapp: [
                "JEET GAYE BHAIIII 🎉🎉🎉",
                "Kya din hai aaj 💙",
                "Party tonight!!! 🥳",
            ],
        }
    };

    // Ball outcomes with probabilities
    const ballOutcomes = [
        { type: 'dot', runs: 0, probability: 0.35, emotionEffect: { tension: 0.05, frustration: 0.1 } },
        { type: 'single', runs: 1, probability: 0.25, emotionEffect: { tension: -0.02 } },
        { type: 'double', runs: 2, probability: 0.1, emotionEffect: { euphoria: 0.05 } },
        { type: 'three', runs: 3, probability: 0.03, emotionEffect: { euphoria: 0.08 } },
        { type: 'four', runs: 4, probability: 0.12, emotionEffect: { euphoria: 0.3, jubilation: 0.1 } },
        { type: 'six', runs: 6, probability: 0.08, emotionEffect: { euphoria: 0.5, disbelief: 0.2, jubilation: 0.15 } },
        { type: 'wicket', runs: 0, probability: 0.05, emotionEffect: { tension: 0.3, frustration: 0.4, disbelief: 0.25 } },
        { type: 'wide', runs: 1, probability: 0.015, emotionEffect: { frustration: 0.15 } },
        { type: 'no_ball', runs: 1, probability: 0.005, emotionEffect: { frustration: 0.2, disbelief: 0.1 } },
    ];

    // Listeners
    const listeners = [];

    function subscribe(event, callback) {
        listeners.push({ event, callback });
    }

    function emit(event, data) {
        listeners.filter(l => l.event === event).forEach(l => l.callback(data));
    }

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function randomPick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function weightedRandom(items) {
        const total = items.reduce((sum, item) => sum + item.probability, 0);
        let rand = Math.random() * total;
        for (const item of items) {
            rand -= item.probability;
            if (rand <= 0) return item;
        }
        return items[items.length - 1];
    }

    // Generate city-wise sentiment data
    function generateCitySentiment() {
        return cities.map(city => {
            const isBattingFanCity = city.teamBias === state.teams.batting.code;
            const isBowlingFanCity = city.teamBias === state.teams.bowling.code;

            // Base emotions + city bias
            const cityEmotions = { ...emotions };

            if (isBattingFanCity) {
                cityEmotions.euphoria = clamp(cityEmotions.euphoria + 0.15, 0, 1);
                cityEmotions.jubilation = clamp(cityEmotions.jubilation + 0.1, 0, 1);
                cityEmotions.frustration = clamp(cityEmotions.frustration - 0.1, 0, 1);
            } else if (isBowlingFanCity) {
                cityEmotions.frustration = clamp(cityEmotions.frustration + 0.15, 0, 1);
                cityEmotions.tension = clamp(cityEmotions.tension + 0.1, 0, 1);
                cityEmotions.euphoria = clamp(cityEmotions.euphoria - 0.1, 0, 1);
            }

            // Add noise
            Object.keys(cityEmotions).forEach(key => {
                cityEmotions[key] = clamp(cityEmotions[key] + (Math.random() - 0.5) * 0.15, 0, 1);
            });

            // Find dominant
            const dominant = Object.entries(cityEmotions).reduce((a, b) => a[1] > b[1] ? a : b);

            return {
                ...city,
                emotions: cityEmotions,
                dominant: dominant[0],
                dominantScore: dominant[1],
                messageCount: Math.floor(city.population * 800 * (0.5 + Math.random())),
            };
        });
    }

    // Generate a fan message
    function generateMessage(dominantEmotion) {
        const platforms = ['twitter', 'youtube', 'whatsapp', 'web'];
        const platform = randomPick(platforms);
        const emotion = dominantEmotion || randomPick(Object.keys(emotions));

        let templates = messageTemplates[emotion]?.[platform] || messageTemplates[emotion]?.twitter || ['🏏'];
        let text = randomPick(templates);

        // Replace placeholders
        const remainingBalls = (state.totalOvers - state.over) * 6 - state.ball;
        const runsNeeded = state.target ? state.target - state.teams.batting.score : 0;
        text = text.replace('{runs}', runsNeeded).replace('{balls}', remainingBalls);

        return {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            text,
            platform,
            emotion,
            score: emotions[emotion],
            city: randomPick(cities).name,
            timestamp: Date.now(),
        };
    }

    // Simulate a ball
    function simulateBall() {
        if (!state.isLive) return;

        state.ball++;
        if (state.ball > 6) {
            state.ball = 1;
            state.over++;

            // Store over summary
            state.overHistory.push({
                over: state.over,
                score: state.teams.batting.score,
                wickets: state.teams.batting.wickets,
                emotions: { ...emotions },
                timestamp: Date.now(),
            });

            emit('overComplete', {
                over: state.over,
                emotions: { ...emotions },
                score: `${state.teams.batting.score}/${state.teams.batting.wickets}`,
            });
        }

        // Check innings end
        if (state.over >= state.totalOvers || state.teams.batting.wickets >= 10) {
            if (state.innings === 1) {
                // Switch innings
                state.innings = 2;
                state.target = state.teams.batting.score + 1;
                const temp = state.teams.batting;
                state.teams.batting = state.teams.bowling;
                state.teams.bowling = temp;
                state.teams.batting.score = 0;
                state.teams.batting.wickets = 0;
                state.over = 0;
                state.ball = 0;
                emit('inningsSwitch', { target: state.target, innings: 2 });
                return;
            } else {
                state.isLive = false;
                emit('matchEnd', { winner: state.teams.batting.score >= state.target ? state.teams.batting.name : state.teams.bowling.name });
                return;
            }
        }

        // Determine outcome
        const outcome = weightedRandom(ballOutcomes);

        // Apply runs
        if (outcome.type === 'wicket') {
            state.teams.batting.wickets++;
        } else {
            state.teams.batting.score += outcome.runs;
        }

        // Check win condition in innings 2
        if (state.innings === 2 && state.teams.batting.score >= state.target) {
            state.isLive = false;
            emotions.jubilation = 0.95;
            emotions.euphoria = 0.9;
            emotions.tension = 0.1;
            emit('matchEnd', { winner: state.teams.batting.name });
        }

        // Update emotions based on outcome
        if (outcome.emotionEffect) {
            Object.entries(outcome.emotionEffect).forEach(([emotion, delta]) => {
                emotionMomentum[emotion] += delta;
            });
        }

        // Match situation modifiers
        const oversRemaining = state.totalOvers - state.over;
        const ballsRemaining = oversRemaining * 6 - state.ball;

        if (state.innings === 2) {
            const runsNeeded = state.target - state.teams.batting.score;
            const requiredRR = (runsNeeded / ballsRemaining) * 6;

            // Last few overs tension
            if (oversRemaining <= 3) {
                emotionMomentum.tension += 0.05;
            }
            if (oversRemaining <= 1) {
                emotionMomentum.tension += 0.12;
            }

            // Required rate pressure
            if (requiredRR > 12) {
                emotionMomentum.tension += 0.06;
                emotionMomentum.frustration += 0.03;
            }

            // Close match
            if (runsNeeded < 15 && ballsRemaining < 12) {
                emotionMomentum.tension += 0.15;
            }
        }

        // Apply momentum with decay
        Object.keys(emotions).forEach(key => {
            emotions[key] = clamp(
                lerp(emotions[key], emotions[key] + emotionMomentum[key], 0.4),
                0, 1
            );
            // Decay momentum
            emotionMomentum[key] *= 0.6;
            // Natural regression to mean
            emotions[key] = lerp(emotions[key], 0.25, 0.02);
        });

        // Create match event
        const event = {
            type: outcome.type,
            runs: outcome.runs,
            over: state.over,
            ball: state.ball,
            score: `${state.teams.batting.score}/${state.teams.batting.wickets}`,
            battingTeam: state.teams.batting.code,
            bowlingTeam: state.teams.bowling.code,
            innings: state.innings,
            target: state.target,
            emotions: { ...emotions },
            timestamp: Date.now(),
        };

        state.matchEvents.push(event);
        state.lastEventTime = Date.now();

        emit('ballUpdate', event);
        emit('emotionUpdate', { ...emotions });
        emit('scoreUpdate', {
            score: `${state.teams.batting.score}/${state.teams.batting.wickets}`,
            overs: `${state.over}.${state.ball}`,
            battingTeam: state.teams.batting,
            bowlingTeam: state.teams.bowling,
            innings: state.innings,
            target: state.target,
            runRate: state.over > 0 ? (state.teams.batting.score / (state.over + state.ball / 6)).toFixed(2) : '0.00',
            requiredRate: state.innings === 2 && state.target ? 
                (((state.target - state.teams.batting.score) / ((state.totalOvers - state.over) * 6 - state.ball)) * 6).toFixed(2) : null,
        });

        // Detect outliers for moment cards
        detectOutlier(event);

        return event;
    }

    // Outlier detection for moment cards
    let rollingAvgs = { tension: 0.3, euphoria: 0.2, frustration: 0.2, disbelief: 0.15, jubilation: 0.15 };
    let rollingSDs = { tension: 0.1, euphoria: 0.1, frustration: 0.1, disbelief: 0.1, jubilation: 0.1 };

    function detectOutlier(event) {
        Object.keys(emotions).forEach(emotion => {
            const score = emotions[emotion];
            const avg = rollingAvgs[emotion];
            const sd = Math.max(rollingSDs[emotion], 0.05);
            const zScore = (score - avg) / sd;

            // Update rolling averages
            rollingAvgs[emotion] = lerp(rollingAvgs[emotion], score, 0.1);
            rollingSDs[emotion] = lerp(rollingSDs[emotion], Math.abs(score - avg), 0.1);

            if (zScore > 2.0 && score > 0.65) {
                const momentData = generateMomentCard(emotion, score, zScore, event);
                emit('momentCard', momentData);
            }
        });
    }

    function generateMomentCard(emotion, score, zScore, event) {
        const titles = {
            tension: [
                "NERVES OF STEEL NEEDED!",
                "Can't. Look. Away. 😰",
                `${event.score} — Edge of the Seat!`,
                "THE PRESSURE COOKER!",
            ],
            euphoria: [
                "THE CROWD GOES WILD! 🔥",
                "ABSOLUTE SCENES! 🤩",
                `${event.type === 'six' ? 'SIX! ' : ''}Pure Cricketing Joy!`,
                "THIS. IS. IPL! 🏏",
            ],
            frustration: [
                "THE COLLAPSE IS REAL 💔",
                "Fans In Meltdown Mode 😤",
                "What Are We Watching?! 🤦",
                "Social Media Explodes With Rage!",
            ],
            disbelief: [
                "DID THAT JUST HAPPEN?! 😱",
                "SCRIPT WRITERS ON OVERTIME!",
                "Nobody Predicted THIS! 🤯",
                "UNBELIEVABLE SCENES!",
            ],
            jubilation: [
                "CHAMPIONS VIBES! 🏆",
                "PARTY MODE ACTIVATED! 🎉",
                "Victory Roar Across India!",
                "THE GREATEST! 👑",
            ],
        };

        const contexts = {
            tension: `At ${event.score} in over ${event.over}.${event.ball}, the nation holds its breath. Message velocity has spiked ${Math.floor(zScore * 100)}% above baseline.`,
            euphoria: `A moment of pure cricketing brilliance at ${event.score}. Fan celebrations are peaking across ${Math.floor(8 + Math.random() * 4)} Indian cities simultaneously.`,
            frustration: `The mood turns sour at ${event.score}. Fan frustration has hit ${Math.floor(score * 100)}% intensity — the highest in this match so far.`,
            disbelief: `Nobody saw this coming. At ${event.score}, the shock factor has sent social media into overdrive with a ${Math.floor(zScore * 50)}x message spike.`,
            jubilation: `The celebrations erupt at ${event.score}! Pure unbridled joy is radiating from fan bases across the country.`,
        };

        const intensityLabels = ['Simmering', 'Building', 'Surging', 'Explosive', 'NUCLEAR'];
        const intensityIndex = Math.min(Math.floor(score * 5), 4);

        return {
            id: `moment_${Date.now()}`,
            title: randomPick(titles[emotion]),
            emotion,
            emoji: { tension: '😰', euphoria: '🤩', frustration: '😤', disbelief: '😱', jubilation: '🎉' }[emotion],
            context: contexts[emotion],
            intensity: intensityLabels[intensityIndex],
            score,
            zScore,
            over: `${event.over}.${event.ball}`,
            matchScore: event.score,
            timestamp: Date.now(),
            fanQuote: generateMessage(emotion).text,
        };
    }

    // Message stream simulation
    let messageInterval = null;
    function startMessageStream(rate = 5) {
        // rate = messages per second
        if (messageInterval) clearInterval(messageInterval);
        messageInterval = setInterval(() => {
            if (!state.isLive) return;

            // Find dominant emotion
            const dominant = Object.entries(emotions).reduce((a, b) => a[1] > b[1] ? a : b)[0];

            // 60% chance of dominant emotion message, 40% random
            const emotion = Math.random() < 0.6 ? dominant : randomPick(Object.keys(emotions));
            const message = generateMessage(emotion);
            emit('newMessage', message);
        }, 1000 / rate);
    }

    // Main simulation loop
    let ballInterval = null;
    function startSimulation(ballIntervalMs = 4000) {
        // Reset state for a fresh match
        state.teams.batting = { code: 'MI', name: 'Mumbai Indians', score: 0, wickets: 0 };
        state.teams.bowling = { code: 'CSK', name: 'Chennai Super Kings', score: 0, wickets: 0 };
        state.innings = 1;
        state.over = 0;
        state.ball = 0;
        state.target = null;
        state.isLive = true;
        state.matchEvents = [];
        state.overHistory = [];

        emit('matchStart', {
            matchId: state.matchId,
            teams: state.teams,
            timestamp: Date.now(),
        });

        // Simulate balls
        ballInterval = setInterval(() => {
            if (!state.isLive) {
                clearInterval(ballInterval);
                return;
            }
            simulateBall();
        }, ballIntervalMs);

        // Start message stream
        startMessageStream(8);

        // Periodic city sentiment updates
        setInterval(() => {
            if (!state.isLive) return;
            emit('citySentiment', generateCitySentiment());
        }, 5000);

        // Periodic velocity update
        setInterval(() => {
            if (!state.isLive) return;
            const baseVelocity = 2000 + Math.random() * 3000;
            const emotionalMultiplier = 1 + (Math.max(...Object.values(emotions)) * 3);
            const velocity = Math.floor(baseVelocity * emotionalMultiplier);
            emit('velocityUpdate', { messagesPerSecond: velocity, timestamp: Date.now() });
        }, 2000);
    }

    function stopSimulation() {
        if (ballInterval) clearInterval(ballInterval);
        if (messageInterval) clearInterval(messageInterval);
        state.isLive = false;
    }

    return {
        subscribe,
        startSimulation,
        stopSimulation,
        getState: () => ({ ...state }),
        getEmotions: () => ({ ...emotions }),
        getCitySentiment: generateCitySentiment,
        simulateBall,
    };
})();
