# ═══════════════════════════════════════════════════════════════
# Crowd Pulse — YouTube Live Chat Worker
# ═══════════════════════════════════════════════════════════════
# Streams YouTube live chat comments using pytchat and publishes
# normalized messages to Pub/Sub topic `raw-social`.
# ═══════════════════════════════════════════════════════════════

import asyncio
import json
import hashlib
import os
import logging
from datetime import datetime, timezone
from typing import Optional

import pytchat
from google.cloud import pubsub_v1

# ─── Configuration ───────────────────────────────────────────
PROJECT_ID = os.environ.get("PROJECT_ID", "crowd-pulse-prod")
RAW_SOCIAL_TOPIC = f"projects/{PROJECT_ID}/topics/raw-social"
BATCH_SIZE = int(os.environ.get("YT_BATCH_SIZE", "25"))
BATCH_FLUSH_INTERVAL = float(os.environ.get("YT_FLUSH_INTERVAL", "0.5"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("yt_chat")


class YouTubeChatWorker:
    """
    Streams YouTube live chat comments using pytchat and publishes
    to Pub/Sub topic `raw-social` in the normalized JSON schema.
    
    Features:
        - Multi-video concurrent streaming (e.g., English + Hindi broadcasts)
        - Micro-batching for efficient Pub/Sub publishing (25 msgs/batch)
        - Message deduplication via hash-based seen buffer
        - Graceful reconnection on stream end
    """

    def __init__(self, match_id: str, video_ids: list[str]):
        self.match_id = match_id
        self.video_ids = video_ids
        self.publisher = pubsub_v1.PublisherClient()
        self._running = False
        self._message_count = 0
        self._seen_ids: set[str] = set()
        self._MAX_SEEN = 100_000
        self._batch_buffer: list[dict] = []

    def _normalize_chat_message(self, item, video_id: str) -> Optional[dict]:
        """
        Normalize a pytchat ChatData item to the unified schema:
        {message_id, match_id, timestamp, platform, city, raw_text}
        
        Returns None if message is a duplicate.
        """
        # Deduplication
        msg_key = f"{item.author.channelId}_{item.message[:50]}"
        msg_hash = hashlib.md5(msg_key.encode()).hexdigest()
        if msg_hash in self._seen_ids:
            return None
        self._seen_ids.add(msg_hash)

        # Evict oldest entries if buffer is full
        if len(self._seen_ids) > self._MAX_SEEN:
            evict_count = self._MAX_SEEN // 10
            evict_keys = list(self._seen_ids)[:evict_count]
            for k in evict_keys:
                self._seen_ids.discard(k)

        return {
            "message_id": f"yt_{msg_hash}",
            "match_id": self.match_id,
            "timestamp": item.datetime if hasattr(item, 'datetime')
                         else datetime.now(timezone.utc).isoformat(),
            "platform": "youtube",
            "city": None,  # YouTube chat doesn't expose user location
            "raw_text": item.message,
            "source_user_id": hashlib.sha256(
                item.author.channelId.encode()
            ).hexdigest()[:16],
            "detected_language": None,  # Detected downstream by Gemini
            "metadata": json.dumps({
                "video_id": video_id,
                "channel_name": item.author.name,
                "is_member": item.author.isChatModerator or item.author.isChatOwner,
                "type": item.type,
                "amount_string": getattr(item, 'amountString', None),
            }),
        }

    def _flush_batch(self):
        """Publish accumulated batch to Pub/Sub."""
        if not self._batch_buffer:
            return

        for msg in self._batch_buffer:
            data = json.dumps(msg).encode("utf-8")
            self.publisher.publish(
                RAW_SOCIAL_TOPIC,
                data,
                match_id=self.match_id,
                platform="youtube",
            )

        self._message_count += len(self._batch_buffer)
        if self._message_count % 500 == 0:
            logger.info(f"Published {self._message_count} YT chat messages")

        self._batch_buffer = []

    async def _stream_single_video(self, video_id: str):
        """Stream chat from a single YouTube live video."""
        logger.info(f"Connecting to YouTube live chat: {video_id}")

        try:
            chat = pytchat.create(video_id=video_id)
        except Exception as e:
            logger.error(f"Failed to connect to YT chat {video_id}: {e}")
            return

        while self._running and chat.is_alive():
            try:
                for item in chat.get().sync_items():
                    normalized = self._normalize_chat_message(item, video_id)
                    if normalized:
                        self._batch_buffer.append(normalized)
                        if len(self._batch_buffer) >= BATCH_SIZE:
                            self._flush_batch()

                # Flush remaining messages in buffer
                self._flush_batch()
                await asyncio.sleep(BATCH_FLUSH_INTERVAL)

            except Exception as e:
                logger.error(f"Error reading YT chat {video_id}: {e}")
                await asyncio.sleep(2)

        logger.info(f"YouTube chat stream ended: {video_id}")

    async def run(self):
        """Start streaming from all configured YouTube videos concurrently."""
        self._running = True
        logger.info(f"YT chat worker starting for {len(self.video_ids)} video(s)")

        tasks = [self._stream_single_video(vid) for vid in self.video_ids]
        await asyncio.gather(*tasks, return_exceptions=True)

        self._flush_batch()
        logger.info(f"YT chat worker stopped. Total messages: {self._message_count}")

    def stop(self):
        self._running = False


# ─── Entry Point ─────────────────────────────────────────────
if __name__ == "__main__":
    worker = YouTubeChatWorker(
        match_id="IPL2026_MI_CSK_052",
        video_ids=["LIVE_VIDEO_ID_ENGLISH", "LIVE_VIDEO_ID_HINDI"],
    )
    asyncio.run(worker.run())
