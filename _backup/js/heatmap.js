/* ============================================================
   CROWD PULSE — India City-Wise Sentiment Heatmap
   SVG-based visualization with animated bubbles and tooltips
   ============================================================ */

const HeatmapManager = (() => {
    const EMOTION_COLORS = {
        tension: '#f97316',
        euphoria: '#22c55e',
        frustration: '#ef4444',
        disbelief: '#a855f7',
        jubilation: '#eab308',
    };

    // Simplified India outline for SVG (approximate boundary points)
    // Using a projected coordinate system (scaled to SVG viewport)
    const INDIA_OUTLINE = `M 180,30 L 200,25 220,30 240,20 260,28 280,35 305,30 
        320,50 330,70 340,80 345,100 350,120 340,140 345,160 340,180 
        335,200 330,220 320,240 310,250 300,270 285,285 270,300 
        255,310 240,320 225,335 215,345 200,350 190,340 180,330 
        170,310 160,290 155,270 150,250 140,230 135,215 130,200 
        125,180 120,160 115,145 120,130 125,115 130,100 140,85 
        145,70 155,55 165,40 Z`;

    // City positions mapped to SVG coordinates (approximate positions on India map)
    const CITY_POSITIONS = {
        'Mumbai': { x: 160, y: 225 },
        'Chennai': { x: 220, y: 310 },
        'Delhi': { x: 208, y: 85 },
        'Bangalore': { x: 200, y: 290 },
        'Kolkata': { x: 300, y: 170 },
        'Hyderabad': { x: 215, y: 255 },
        'Pune': { x: 175, y: 240 },
        'Ahmedabad': { x: 155, y: 170 },
        'Jaipur': { x: 185, y: 115 },
        'Lucknow': { x: 235, y: 115 },
        'Chandigarh': { x: 200, y: 60 },
        'Indore': { x: 190, y: 175 },
    };

    let svgContainer;
    let tooltipEl;
    let currentCityData = [];

    function init() {
        svgContainer = document.getElementById('heatmap-svg');
        tooltipEl = document.getElementById('city-tooltip');

        if (!svgContainer) return;

        drawMap();
    }

    function drawMap() {
        const svgNS = 'http://www.w3.org/2000/svg';
        svgContainer.innerHTML = '';

        // Set viewBox
        svgContainer.setAttribute('viewBox', '80 0 320 380');

        // Defs for gradients and filters
        const defs = document.createElementNS(svgNS, 'defs');

        // Glow filter
        const filter = document.createElementNS(svgNS, 'filter');
        filter.setAttribute('id', 'city-glow');
        filter.setAttribute('x', '-50%');
        filter.setAttribute('y', '-50%');
        filter.setAttribute('width', '200%');
        filter.setAttribute('height', '200%');
        const blur = document.createElementNS(svgNS, 'feGaussianBlur');
        blur.setAttribute('in', 'SourceGraphic');
        blur.setAttribute('stdDeviation', '4');
        filter.appendChild(blur);
        defs.appendChild(filter);

        // Pulse animation
        const style = document.createElementNS(svgNS, 'style');
        style.textContent = `
            @keyframes cityPulse {
                0%, 100% { opacity: 0.3; r: attr(data-pulse-r); }
                50% { opacity: 0.1; }
            }
            .city-pulse { animation: cityPulse 2s ease-in-out infinite; }
        `;
        defs.appendChild(style);

        svgContainer.appendChild(defs);

        // India outline
        const outline = document.createElementNS(svgNS, 'path');
        outline.setAttribute('d', INDIA_OUTLINE);
        outline.setAttribute('fill', 'rgba(15, 20, 45, 0.4)');
        outline.setAttribute('stroke', 'rgba(148, 163, 184, 0.12)');
        outline.setAttribute('stroke-width', '1.5');
        outline.setAttribute('stroke-linejoin', 'round');
        svgContainer.appendChild(outline);

        // Grid dots for texture
        for (let x = 100; x < 380; x += 20) {
            for (let y = 20; y < 370; y += 20) {
                if (isPointInIndia(x, y)) {
                    const dot = document.createElementNS(svgNS, 'circle');
                    dot.setAttribute('cx', x);
                    dot.setAttribute('cy', y);
                    dot.setAttribute('r', '0.5');
                    dot.setAttribute('fill', 'rgba(148, 163, 184, 0.06)');
                    svgContainer.appendChild(dot);
                }
            }
        }

        // City group (will be populated in update)
        const cityGroup = document.createElementNS(svgNS, 'g');
        cityGroup.id = 'city-dots-group';
        svgContainer.appendChild(cityGroup);
    }

    // Rough point-in-polygon check for India outline
    function isPointInIndia(x, y) {
        // Simplified bounding + rough check
        if (x < 110 || x > 355 || y < 15 || y > 355) return false;
        // Rough exclusion zones
        if (x > 300 && y > 250) return false;
        if (x < 130 && y > 270) return false;
        if (x < 140 && y < 50) return false;
        if (x > 280 && y < 30) return false;
        return true;
    }

    function updateCityData(cityData) {
        currentCityData = cityData;
        const svgNS = 'http://www.w3.org/2000/svg';
        const group = document.getElementById('city-dots-group');
        if (!group) return;

        group.innerHTML = '';

        cityData.forEach((city, index) => {
            const pos = CITY_POSITIONS[city.name];
            if (!pos) return;

            const color = EMOTION_COLORS[city.dominant] || '#3b82f6';
            const radius = Math.max(6, Math.min(22, city.messageCount / 3000));

            // Glow circle (outer pulse)
            const glow = document.createElementNS(svgNS, 'circle');
            glow.setAttribute('cx', pos.x);
            glow.setAttribute('cy', pos.y);
            glow.setAttribute('r', radius + 8);
            glow.setAttribute('fill', color);
            glow.setAttribute('opacity', '0.08');
            glow.setAttribute('filter', 'url(#city-glow)');
            group.appendChild(glow);

            // Animated pulse ring
            const pulse = document.createElementNS(svgNS, 'circle');
            pulse.setAttribute('cx', pos.x);
            pulse.setAttribute('cy', pos.y);
            pulse.setAttribute('r', radius + 4);
            pulse.setAttribute('fill', 'none');
            pulse.setAttribute('stroke', color);
            pulse.setAttribute('stroke-width', '1');
            pulse.setAttribute('opacity', '0.2');
            pulse.classList.add('city-pulse');

            // Stagger animation
            pulse.style.animationDelay = `${index * 0.3}s`;
            group.appendChild(pulse);

            // Main dot
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', pos.x);
            dot.setAttribute('cy', pos.y);
            dot.setAttribute('r', radius);
            dot.setAttribute('fill', color);
            dot.setAttribute('opacity', '0.65');
            dot.setAttribute('class', 'city-dot');
            dot.setAttribute('data-city', city.name);
            dot.style.transition = 'r 0.5s ease, fill 0.5s ease';

            // Interaction
            dot.addEventListener('mouseenter', (e) => showCityTooltip(e, city));
            dot.addEventListener('mouseleave', hideCityTooltip);
            dot.addEventListener('mousemove', (e) => moveCityTooltip(e));

            group.appendChild(dot);

            // City label
            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', pos.x);
            label.setAttribute('y', pos.y + radius + 12);
            label.setAttribute('class', 'city-label');
            label.setAttribute('fill', '#94a3b8');
            label.setAttribute('font-size', '8');
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-family', "'Inter', sans-serif");
            label.textContent = city.name;
            group.appendChild(label);

            // Small score text
            const scoreText = document.createElementNS(svgNS, 'text');
            scoreText.setAttribute('x', pos.x);
            scoreText.setAttribute('y', pos.y + 3);
            scoreText.setAttribute('text-anchor', 'middle');
            scoreText.setAttribute('fill', 'white');
            scoreText.setAttribute('font-size', Math.max(6, radius * 0.5));
            scoreText.setAttribute('font-family', "'JetBrains Mono', monospace");
            scoreText.setAttribute('font-weight', '600');
            scoreText.textContent = Math.round(city.dominantScore * 100);
            group.appendChild(scoreText);
        });
    }

    function showCityTooltip(e, city) {
        if (!tooltipEl) return;

        const emotionBars = Object.entries(city.emotions)
            .sort((a, b) => b[1] - a[1])
            .map(([emotion, score]) => {
                const color = EMOTION_COLORS[emotion];
                return `
                    <div class="city-tooltip-emotion">
                        <span style="width:60px;text-transform:capitalize;font-size:0.65rem;color:${color}">${emotion}</span>
                        <div class="city-tooltip-bar">
                            <div class="city-tooltip-bar-fill" style="width:${score * 100}%;background:${color}"></div>
                        </div>
                        <span style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:#94a3b8;width:30px;text-align:right">${Math.round(score * 100)}%</span>
                    </div>
                `;
            }).join('');

        tooltipEl.innerHTML = `
            <div class="city-tooltip-name">${city.name}</div>
            <div style="font-size:0.65rem;color:#64748b;margin-bottom:8px">
                ${(city.messageCount || 0).toLocaleString()} messages • ${city.teamBias || 'Neutral'} territory
            </div>
            ${emotionBars}
        `;

        tooltipEl.classList.add('visible');
        moveCityTooltip(e);
    }

    function moveCityTooltip(e) {
        if (!tooltipEl) return;
        const container = svgContainer.closest('.glass-card');
        if (!container) return;

        const rect = container.getBoundingClientRect();
        let left = e.clientX - rect.left + 15;
        let top = e.clientY - rect.top - 10;

        if (left + 200 > rect.width) left = e.clientX - rect.left - 210;
        if (top < 0) top = 10;

        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = top + 'px';
    }

    function hideCityTooltip() {
        if (tooltipEl) tooltipEl.classList.remove('visible');
    }

    return {
        init,
        updateCityData,
    };
})();
