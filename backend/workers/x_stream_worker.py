# ═══════════════════════════════════════════════════════════════
# Crowd Pulse — X (Twitter) API v2 Stream Worker
# ═══════════════════════════════════════════════════════════════
# Connects to the X Filtered Stream endpoint to track match-specific
# hashtags in real-time. Normalizes tweets and publishes to Pub/Sub.
# ═══════════════════════════════════════════════════════════════

import asyncio
import json
import hashlib
import os
import logging
from datetime import datetime, timezone
from typing import Optional

import aiohttp
from google.cloud import pubsub_v1

# ─── Configuration ───────────────────────────────────────────
X_BEARER_TOKEN = os.environ.get("X_BEARER_TOKEN", "")
FILTERED_STREAM_URL = "https://api.twitter.com/2/tweets/search/stream"
STREAM_RULES_URL = "https://api.twitter.com/2/tweets/search/stream/rules"
PROJECT_ID = os.environ.get("PROJECT_ID", "crowd-pulse-prod")
RAW_SOCIAL_TOPIC = f"projects/{PROJECT_ID}/topics/raw-social"

MAX_RECONNECT_ATTEMPTS = 10
RECONNECT_BACKOFF_BASE = 1.0

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("x_stream")

# Known Indian cities for profile-location extraction
INDIAN_CITIES = {
    "mumbai", "delhi", "bangalore", "bengaluru", "chennai", "kolkata",
    "hyderabad", "pune", "ahmedabad", "jaipur", "lucknow", "chandigarh",
    "indore", "kochi", "guwahati", "nagpur", "visakhapatnam", "noida",
    "gurgaon", "gurugram", "thane", "navi mumbai", "coimbatore",
}


class XStreamWorker:
    """
    Connects to the X API v2 Filtered Stream and publishes match-specific
    tweets to Pub/Sub topic `raw-social` in the normalized schema:
    
        {timestamp, platform, city, raw_text}
    
    Features:
        - Multi-language stream rules (en, hi, regional)
        - Auto-reconnect with exponential backoff
        - Profile-based city extraction
        - Privacy-safe user ID hashing
    """

    def __init__(self, match_id: str, hashtags: list[str]):
        self.match_id = match_id
        self.hashtags = hashtags
        self.publisher = pubsub_v1.PublisherClient()
        self.session: Optional[aiohttp.ClientSession] = None
        self._running = False
        self._reconnect_count = 0
        self._message_count = 0

    async def _create_session(self):
        self.session = aiohttp.ClientSession(
            headers={"Authorization": f"Bearer {X_BEARER_TOKEN}"},
            timeout=aiohttp.ClientTimeout(total=None, connect=10),
        )

    async def _setup_stream_rules(self):
        """
        Configure filtered stream rules for match hashtags.
        
        Creates 3 rules:
            1. English tweets matching match hashtags
            2. Hindi tweets matching match hashtags
            3. Regional language tweets (Tamil, Telugu, Bengali)
        """
        # Delete existing rules
        async with self.session.get(STREAM_RULES_URL) as resp:
            existing = await resp.json()
            existing_ids = [r["id"] for r in existing.get("data", [])]
            if existing_ids:
                await self.session.post(
                    STREAM_RULES_URL,
                    json={"delete": {"ids": existing_ids}},
                )
                logger.info(f"Deleted {len(existing_ids)} existing stream rules")

        # Add match-specific rules
        hashtag_clause = " OR ".join(self.hashtags)
        rules = [
            {"value": f"{hashtag_clause} -is:retweet lang:en", "tag": f"match_{self.match_id}_en"},
            {"value": f"{hashtag_clause} -is:retweet lang:hi", "tag": f"match_{self.match_id}_hi"},
            {"value": f"{hashtag_clause} -is:retweet (lang:ta OR lang:te OR lang:bn)", "tag": f"match_{self.match_id}_regional"},
        ]

        async with self.session.post(STREAM_RULES_URL, json={"add": rules}) as resp:
            result = await resp.json()
            meta = result.get("meta", {})
            logger.info(f"Stream rules set — created: {meta.get('summary', {}).get('created', 0)}")

    def _extract_city(self, location_text: str) -> Optional[str]:
        """Extract city name from X profile location field."""
        if not location_text:
            return None
        location_lower = location_text.lower().strip()
        for city in INDIAN_CITIES:
            if city in location_lower:
                return city.title().replace("Bengaluru", "Bangalore")
        return None

    def _normalize_tweet(self, tweet_data: dict) -> dict:
        """
        Normalize tweet to unified social message schema:
        {message_id, match_id, timestamp, platform, city, raw_text, ...}
        """
        tweet = tweet_data.get("data", {})
        includes = tweet_data.get("includes", {})

        city = None
        if includes.get("users"):
            location = includes["users"][0].get("location", "")
            city = self._extract_city(location)

        # Determine language from matching rule tag
        matching_rules = tweet_data.get("matching_rules", [])
        lang = "en"
        if matching_rules:
            tag = matching_rules[0].get("tag", "")
            if "_hi" in tag:
                lang = "hi"
            elif "_regional" in tag:
                lang = "regional"

        return {
            "message_id": f"x_{tweet.get('id', '')}",
            "match_id": self.match_id,
            "timestamp": tweet.get("created_at", datetime.now(timezone.utc).isoformat()),
            "platform": "twitter",
            "city": city,
            "raw_text": tweet.get("text", ""),
            "source_user_id": hashlib.sha256(
                tweet.get("author_id", "").encode()
            ).hexdigest()[:16],
            "detected_language": lang,
            "metadata": json.dumps({
                "tweet_id": tweet.get("id"),
                "matching_rules": [r.get("tag") for r in matching_rules],
                "public_metrics": tweet.get("public_metrics", {}),
            }),
        }

    def _publish_to_pubsub(self, normalized: dict):
        """Publish normalized tweet to Pub/Sub."""
        data = json.dumps(normalized).encode("utf-8")
        self.publisher.publish(
            RAW_SOCIAL_TOPIC,
            data,
            match_id=self.match_id,
            platform="twitter",
        )
        self._message_count += 1
        if self._message_count % 100 == 0:
            logger.info(f"Published {self._message_count} tweets to Pub/Sub")

    async def _consume_stream(self):
        """
        Connect to Filtered Stream and consume tweets via chunked transfer.
        Handles rate limits (429) with Retry-After compliance.
        """
        params = {
            "tweet.fields": "created_at,author_id,public_metrics,lang",
            "user.fields": "location",
            "expansions": "author_id",
        }

        async with self.session.get(FILTERED_STREAM_URL, params=params) as resp:
            if resp.status == 429:
                retry_after = int(resp.headers.get("Retry-After", 60))
                logger.warning(f"X API rate limited. Waiting {retry_after}s")
                await asyncio.sleep(retry_after)
                return

            if resp.status != 200:
                body = await resp.text()
                logger.error(f"Stream error {resp.status}: {body[:200]}")
                return

            self._reconnect_count = 0
            logger.info("Connected to X Filtered Stream ✓")

            async for line in resp.content:
                if not self._running:
                    break

                line = line.strip()
                if not line:
                    continue  # Keep-alive heartbeat

                try:
                    tweet_data = json.loads(line)
                    normalized = self._normalize_tweet(tweet_data)
                    self._publish_to_pubsub(normalized)
                except json.JSONDecodeError:
                    pass
                except Exception as e:
                    logger.error(f"Error processing tweet: {e}", exc_info=True)

    async def run(self):
        """Main loop with automatic reconnection and exponential backoff."""
        await self._create_session()
        await self._setup_stream_rules()
        self._running = True

        while self._running and self._reconnect_count < MAX_RECONNECT_ATTEMPTS:
            try:
                await self._consume_stream()
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                self._reconnect_count += 1
                backoff = min(RECONNECT_BACKOFF_BASE * (2 ** self._reconnect_count), 300)
                logger.warning(
                    f"Stream disconnected: {e}. "
                    f"Reconnecting in {backoff:.0f}s (attempt {self._reconnect_count})"
                )
                await asyncio.sleep(backoff)
            except Exception as e:
                logger.critical(f"Unexpected error: {e}", exc_info=True)
                break

        if self.session:
            await self.session.close()
        logger.info(f"X Stream worker stopped. Total tweets: {self._message_count}")

    def stop(self):
        self._running = False


# ─── Entry Point ─────────────────────────────────────────────
if __name__ == "__main__":
    worker = XStreamWorker(
        match_id="IPL2026_MI_CSK_052",
        hashtags=["#MIvCSK", "#IPL2026", "#CrowdPulse", "#MI", "#CSK"],
    )
    asyncio.run(worker.run())
