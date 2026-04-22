# ═══════════════════════════════════════════════════════════════
# Crowd Pulse — Over Batcher Cloud Function
# ═══════════════════════════════════════════════════════════════
# Triggered by Pub/Sub. Buffers social messages per-over (6 balls)
# and flushes batches to Gemini API for sentiment classification.
# ═══════════════════════════════════════════════════════════════

import json
import os
import time
import base64
import logging
from datetime import datetime, timezone
from collections import defaultdict

import functions_framework
from google.cloud import firestore, pubsub_v1
import google.generativeai as genai

# ─── Configuration ───────────────────────────────────────────
PROJECT_ID = os.environ.get("PROJECT_ID", "crowd-pulse-prod")
ENRICHED_TOPIC = f"projects/{PROJECT_ID}/topics/enriched-sentiments"
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
MAX_BATCH_SIZE = int(os.environ.get("MAX_BATCH_SIZE", "50"))
OVER_TIMEOUT_SECONDS = int(os.environ.get("OVER_TIMEOUT", "30"))

logger = logging.getLogger("over_batcher")
db = firestore.Client(project=PROJECT_ID)
publisher = pubsub_v1.PublisherClient()

# ─── Gemini System Prompt ────────────────────────────────────
SENTIMENT_SYSTEM_PROMPT = """You are CrowdPulse Sentiment Engine, an expert in analyzing cricket fan emotions during live IPL matches. You understand:
- Multi-lingual cricket vernacular (Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, English, Hinglish)
- Cricket slang, abbreviations, and memes (e.g., "thala for a reason", "RCB 49 PTSD", "intent™")
- Sarcasm and irony common in cricket Twitter (e.g., "Great captaincy 🤡" = frustration, not euphoria)
- Team-specific fan cultures and rivalries
- Emoji-heavy communication patterns
- Gen Z vernacular: "no cap" (genuine), "fr fr" (sincere), "bussin" (euphoria), "mid" (frustration), "W"/"L" (euphoria/frustration), "bruh" (disbelief)

CLASSIFICATION FRAMEWORK:
Score each message on 5 emotional pillars (0.0 to 1.0):
1. TENSION: Anticipation, nervousness (e.g., "can't watch", "heart rate 📈")
2. EUPHORIA: Pure joy, celebration (e.g., "YESSSSS", "🔥🔥🔥", "kya maaraaaa")
3. FRUSTRATION: Anger, disappointment (e.g., "dropped again 🤦", "bekaar bowling")
4. DISBELIEF: Shock, amazement (e.g., "NO WAY", "script writers 📝")
5. JUBILATION: Triumphant celebration (e.g., "WE WON", "champions!")

RULES:
- Multiple pillars CAN score high simultaneously
- Sarcasm detection is CRITICAL — clown emoji (🤡) inverts literal meaning
- ALL CAPS = +0.1-0.2 on dominant pillar
- Emoji clusters (3+) amplify dominant emotion +0.1
- Neutral/spam → all pillars < 0.1
- Scores are independent (don't need to sum to 1.0)

OUTPUT FORMAT (strict JSON):
{"results": [{"id": "", "tension": 0.0, "euphoria": 0.0, "frustration": 0.0, "disbelief": 0.0, "jubilation": 0.0, "dominant_emotion": "", "confidence": 0.0, "is_sarcastic": false, "detected_team_affiliation": null}]}"""

# Configure Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
model = genai.GenerativeModel(
    model_name=GEMINI_MODEL,
    system_instruction=SENTIMENT_SYSTEM_PROMPT,
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.1,
    ),
)

# Instance-level buffers (persisted across invocations on the same instance)
_over_buffers: dict[tuple, list] = defaultdict(list)
_over_timestamps: dict[tuple, float] = {}


def _should_flush(match_id: str, over: int, is_over_end: bool) -> bool:
    """
    Determine if the current over buffer should be flushed.
    
    Flush triggers:
        1. Over completion event (6th ball bowled)
        2. Batch size limit reached (MAX_BATCH_SIZE)
        3. Timeout exceeded (OVER_TIMEOUT_SECONDS since first message)
    """
    key = (match_id, over)
    buffer = _over_buffers[key]

    if is_over_end:
        return True
    if len(buffer) >= MAX_BATCH_SIZE:
        return True

    first_ts = _over_timestamps.get(key)
    if first_ts and (time.time() - first_ts) > OVER_TIMEOUT_SECONDS:
        return True

    return False


def _classify_with_gemini(messages: list[dict], match_context: dict) -> list[dict]:
    """
    Send a batch of messages to Gemini for 5-pillar emotional classification.
    
    Falls back to neutral scores if Gemini fails.
    """
    prompt_input = {
        "messages": [
            {
                "id": m["message_id"],
                "text": m["raw_text"],
                "platform": m["platform"],
                "language": m.get("detected_language", "unknown"),
                "team_context": match_context.get("team_context", ""),
                "match_situation": match_context.get("match_situation", ""),
            }
            for m in messages
        ]
    }

    try:
        response = model.generate_content(json.dumps(prompt_input))
        result = json.loads(response.text)
        return result.get("results", [])
    except Exception as e:
        logger.error(f"Gemini classification failed: {e}")
        # Fallback: neutral scores
        return [
            {
                "id": m["message_id"],
                "tension": 0.2, "euphoria": 0.2, "frustration": 0.2,
                "disbelief": 0.1, "jubilation": 0.1,
                "dominant_emotion": "tension", "confidence": 0.0,
                "is_sarcastic": False, "detected_team_affiliation": None,
            }
            for m in messages
        ]


def _get_match_context(match_id: str) -> dict:
    """Fetch current match state from Firestore."""
    try:
        doc = db.collection("matches").document(match_id).get()
        if doc.exists:
            data = doc.to_dict()
            return {
                "team_context": f"{data.get('batting_team', '')} vs {data.get('bowling_team', '')}",
                "match_situation": (
                    f"{data.get('current_score', '')}, "
                    f"Over {data.get('current_over', '')}, "
                    f"RRR: {data.get('required_run_rate', 'N/A')}"
                ),
            }
    except Exception as e:
        logger.warning(f"Failed to fetch match context: {e}")
    return {"team_context": "", "match_situation": ""}


def _publish_enriched(message: dict, scores: dict):
    """Publish classified message to enriched-sentiments topic."""
    enriched = {
        **message,
        "tension": scores.get("tension", 0),
        "euphoria": scores.get("euphoria", 0),
        "frustration": scores.get("frustration", 0),
        "disbelief": scores.get("disbelief", 0),
        "jubilation": scores.get("jubilation", 0),
        "dominant_emotion": scores.get("dominant_emotion", "tension"),
        "confidence": scores.get("confidence", 0),
        "is_sarcastic": scores.get("is_sarcastic", False),
        "detected_team_affiliation": scores.get("detected_team_affiliation"),
        "classified_at": datetime.now(timezone.utc).isoformat(),
    }

    data = json.dumps(enriched).encode("utf-8")
    publisher.publish(
        ENRICHED_TOPIC,
        data,
        match_id=message.get("match_id", ""),
        dominant_emotion=enriched["dominant_emotion"],
    )


@functions_framework.cloud_event
def over_batcher(cloud_event):
    """
    Cloud Function entry point — triggered by Pub/Sub push subscription.
    
    Receives raw social messages, buffers them per-over, and on flush
    conditions sends the batch to Gemini for multi-dimensional classification.
    Publishes enriched results to the `enriched-sentiments` topic.
    """
    # Decode Pub/Sub message
    data = base64.b64decode(cloud_event.data["message"]["data"])
    message = json.loads(data)
    attrs = cloud_event.data["message"].get("attributes", {})

    match_id = message.get("match_id", attrs.get("match_id", "unknown"))

    # Determine current over from Firestore
    match_ctx = _get_match_context(match_id)
    current_over = 0
    try:
        doc = db.collection("matches").document(match_id).get()
        if doc.exists:
            current_over = doc.to_dict().get("current_over", 0)
    except Exception:
        pass

    key = (match_id, current_over)
    is_over_end = message.get("event_type", "").endswith("over_end")

    # Buffer the message
    _over_buffers[key].append(message)
    if key not in _over_timestamps:
        _over_timestamps[key] = time.time()

    # Check flush condition
    if _should_flush(match_id, current_over, is_over_end):
        buffer = _over_buffers.pop(key, [])
        _over_timestamps.pop(key, None)

        if not buffer:
            return

        logger.info(f"Flushing {len(buffer)} messages for {match_id} over {current_over}")

        # Classify with Gemini (sub-batched if needed)
        all_scores = []
        for i in range(0, len(buffer), MAX_BATCH_SIZE):
            chunk = buffer[i:i + MAX_BATCH_SIZE]
            scores = _classify_with_gemini(chunk, match_ctx)
            all_scores.extend(scores)

        # Build score lookup and publish enriched
        score_map = {s["id"]: s for s in all_scores}
        for msg in buffer:
            scores = score_map.get(msg["message_id"], {})
            _publish_enriched(msg, scores)

        logger.info(f"Published {len(buffer)} enriched messages for over {current_over}")
