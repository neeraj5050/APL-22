# ═══════════════════════════════════════════════════════════════
# Crowd Pulse — Score Pipeline Worker
# ═══════════════════════════════════════════════════════════════
# High-frequency poller for Cricket Data API (Entity Sports / Sportradar).
# Publishes ball-by-ball updates and event triggers to Pub/Sub.
# ═══════════════════════════════════════════════════════════════

import asyncio
import json
import os
import time
import logging
from datetime import datetime, timezone
from enum import Enum
from dataclasses import dataclass, asdict
from typing import Optional

import aiohttp
from google.cloud import pubsub_v1

# ─── Configuration ───────────────────────────────────────────
ENTITY_SPORT_API_KEY = os.environ.get("ENTITY_SPORT_API_KEY", "")
ENTITY_SPORT_BASE_URL = "https://rest.entitysport.com/v2"
PROJECT_ID = os.environ.get("PROJECT_ID", "crowd-pulse-prod")
MATCH_EVENTS_TOPIC = f"projects/{PROJECT_ID}/topics/match-events"
POLL_INTERVAL_SECONDS = float(os.environ.get("POLL_INTERVAL", "2.0"))
MAX_RETRIES = 5
BACKOFF_BASE = 0.5

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("score_pipeline")


class MatchEvent(Enum):
    """All detectable match events."""
    DOT = "dot"
    SINGLE = "single"
    DOUBLE = "double"
    TRIPLE = "triple"
    FOUR = "four"
    SIX = "six"
    WICKET = "wicket"
    WIDE = "wide"
    NO_BALL = "no_ball"
    OVER_END = "over_end"
    INNINGS_END = "innings_end"
    MILESTONE_50 = "milestone_50"
    MILESTONE_100 = "milestone_100"
    MAIDEN_OVER = "maiden_over"
    HAT_TRICK = "hat_trick"


@dataclass
class BallUpdate:
    """Normalized ball-by-ball update published to Pub/Sub."""
    match_id: str
    innings: int
    over: int
    ball: int
    runs_scored: int
    event_type: str
    batting_team: str
    bowling_team: str
    batsman: str
    bowler: str
    current_score: str
    run_rate: float
    required_run_rate: Optional[float]
    target: Optional[int]
    is_free_hit: bool
    commentary: str
    timestamp_source: str
    timestamp_ingested: str


class ScorePipelineWorker:
    """
    High-frequency poller for cricket match data.
    
    Polls Entity Sports API every 2 seconds for ball-by-ball updates.
    Detects compound events (wickets, boundaries, milestones, hat-tricks).
    Publishes structured BallUpdate messages to Pub/Sub topic `match-events`.
    
    Features:
        - Exponential backoff on API errors / rate limits
        - Compound event detection (milestones, hat-tricks, maiden overs)
        - Consistent poll interval maintenance
        - Graceful shutdown
    """

    def __init__(self, match_id: str):
        self.match_id = match_id
        self.publisher = pubsub_v1.PublisherClient()
        self.session: Optional[aiohttp.ClientSession] = None
        self.last_ball_key = None
        self.consecutive_wickets = 0
        self.batsman_runs: dict[str, int] = {}
        self.over_runs = 0
        self._running = False

    async def _create_session(self):
        """Create aiohttp session with aggressive timeouts."""
        timeout = aiohttp.ClientTimeout(total=5, connect=2)
        self.session = aiohttp.ClientSession(
            timeout=timeout,
            headers={"Authorization": f"token {ENTITY_SPORT_API_KEY}"}
        )

    async def _fetch_ball_by_ball(self) -> dict:
        """
        Fetch latest ball-by-ball data with exponential backoff.
        
        Handles:
            - 429 Rate Limit → exponential backoff
            - 5xx Server Error → retry with backoff
            - Network errors → retry with backoff
        """
        url = f"{ENTITY_SPORT_BASE_URL}/matches/{self.match_id}/live"

        for attempt in range(MAX_RETRIES):
            try:
                async with self.session.get(url, params={"token": ENTITY_SPORT_API_KEY}) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("response", {})
                    elif resp.status == 429:
                        wait_time = BACKOFF_BASE * (2 ** attempt)
                        logger.warning(f"Rate limited (429). Backing off {wait_time:.1f}s (attempt {attempt+1})")
                        await asyncio.sleep(wait_time)
                    elif resp.status >= 500:
                        logger.error(f"Server error {resp.status}. Retry {attempt+1}/{MAX_RETRIES}")
                        await asyncio.sleep(BACKOFF_BASE * (2 ** attempt))
                    else:
                        logger.error(f"Unexpected status {resp.status}: {await resp.text()}")
                        return {}
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                logger.error(f"Network error: {e}. Retry {attempt+1}/{MAX_RETRIES}")
                await asyncio.sleep(BACKOFF_BASE * (2 ** attempt))

        logger.critical(f"All {MAX_RETRIES} retries exhausted for match {self.match_id}")
        return {}

    def _detect_events(self, ball_data: dict) -> list[str]:
        """
        Detect primary and compound events from ball data.
        
        Compound events detected:
            - milestone_50  → batsman crosses 50 runs
            - milestone_100 → batsman crosses 100 runs
            - hat_trick     → 3 consecutive wickets
            - maiden_over   → 6 dots in an over
            - over_end      → 6th ball of the over
        """
        events = []
        runs = ball_data.get("runs", 0)
        is_wicket = ball_data.get("is_wicket", False)
        batsman = ball_data.get("batsman", {}).get("name", "Unknown")
        ball_num = ball_data.get("ball", 0)

        # Primary event classification
        if is_wicket:
            events.append(MatchEvent.WICKET.value)
            self.consecutive_wickets += 1
            if self.consecutive_wickets >= 3:
                events.append(MatchEvent.HAT_TRICK.value)
        else:
            self.consecutive_wickets = 0
            event_map = {0: "dot", 1: "single", 2: "double", 3: "triple", 4: "four", 6: "six"}
            event_name = event_map.get(runs, "single")
            events.append(getattr(MatchEvent, event_name.upper()).value)

        # Extras detection
        if ball_data.get("is_wide"):
            events.append(MatchEvent.WIDE.value)
        if ball_data.get("is_noball"):
            events.append(MatchEvent.NO_BALL.value)

        # Milestone detection
        batsman_total = ball_data.get("batsman", {}).get("runs", 0)
        prev_runs = self.batsman_runs.get(batsman, 0)
        if prev_runs < 50 <= batsman_total:
            events.append(MatchEvent.MILESTONE_50.value)
        if prev_runs < 100 <= batsman_total:
            events.append(MatchEvent.MILESTONE_100.value)
        self.batsman_runs[batsman] = batsman_total

        # Over boundary detection
        self.over_runs += runs
        if ball_num == 6:
            if self.over_runs == 0 and not is_wicket:
                events.append(MatchEvent.MAIDEN_OVER.value)
            events.append(MatchEvent.OVER_END.value)
            self.over_runs = 0

        return events

    def _build_ball_update(self, live_data: dict, ball_data: dict, events: list[str]) -> BallUpdate:
        """Construct a normalized BallUpdate from raw API data."""
        innings_data = live_data.get("live_innings", {})

        return BallUpdate(
            match_id=self.match_id,
            innings=live_data.get("live_innings_number", 1),
            over=ball_data.get("over", 0),
            ball=ball_data.get("ball", 0),
            runs_scored=ball_data.get("runs", 0),
            event_type="|".join(events),
            batting_team=innings_data.get("batting_team_short", ""),
            bowling_team=innings_data.get("bowling_team_short", ""),
            batsman=ball_data.get("batsman", {}).get("name", ""),
            bowler=ball_data.get("bowler", {}).get("name", ""),
            current_score=f"{innings_data.get('runs', 0)}/{innings_data.get('wickets', 0)}",
            run_rate=float(innings_data.get("run_rate", 0.0)),
            required_run_rate=float(innings_data.get("required_run_rate", 0)) or None,
            target=innings_data.get("target") or None,
            is_free_hit=ball_data.get("is_free_hit", False),
            commentary=ball_data.get("commentary", ""),
            timestamp_source=ball_data.get("timestamp", datetime.now(timezone.utc).isoformat()),
            timestamp_ingested=datetime.now(timezone.utc).isoformat(),
        )

    def _publish_to_pubsub(self, ball_update: BallUpdate):
        """Publish ball event to Pub/Sub with metadata attributes."""
        data = json.dumps(asdict(ball_update)).encode("utf-8")
        future = self.publisher.publish(
            MATCH_EVENTS_TOPIC,
            data,
            match_id=self.match_id,
            event_type=ball_update.event_type,
            over=str(ball_update.over),
            ball=str(ball_update.ball),
        )
        future.add_done_callback(
            lambda f: logger.info(f"Published ball {ball_update.over}.{ball_update.ball}: {ball_update.event_type}")
            if not f.exception()
            else logger.error(f"Pub/Sub publish failed: {f.exception()}")
        )

    async def run(self):
        """
        Main polling loop.
        
        Polls the Cricket API every POLL_INTERVAL_SECONDS.
        Detects new deliveries by comparing ball keys.
        Publishes events to Pub/Sub.
        Auto-terminates when match ends.
        """
        await self._create_session()
        self._running = True
        logger.info(f"Score pipeline started for match {self.match_id}")

        try:
            while self._running:
                loop_start = time.monotonic()

                live_data = await self._fetch_ball_by_ball()
                if not live_data:
                    await asyncio.sleep(POLL_INTERVAL_SECONDS)
                    continue

                # Extract latest ball
                live_score = live_data.get("live_score", {})
                ball_key = f"{live_score.get('overs', '0')}"

                if ball_key != self.last_ball_key:
                    self.last_ball_key = ball_key
                    events = self._detect_events(live_score)
                    ball_update = self._build_ball_update(live_data, live_score, events)
                    self._publish_to_pubsub(ball_update)

                # Check match completion
                match_status = live_data.get("status_str", "")
                if match_status.lower() in ("completed", "abandoned", "no result"):
                    logger.info(f"Match {self.match_id} ended: {match_status}")
                    self._running = False
                    break

                # Maintain consistent poll interval
                elapsed = time.monotonic() - loop_start
                sleep_time = max(0, POLL_INTERVAL_SECONDS - elapsed)
                await asyncio.sleep(sleep_time)

        finally:
            if self.session:
                await self.session.close()
            logger.info("Score pipeline stopped.")

    def stop(self):
        """Gracefully stop the polling loop."""
        self._running = False


# ─── Entry Point ─────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    match_id = sys.argv[1] if len(sys.argv) > 1 else "IPL2026_MI_CSK_052"
    worker = ScorePipelineWorker(match_id)
    asyncio.run(worker.run())
