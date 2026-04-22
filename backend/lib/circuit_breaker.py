# ═══════════════════════════════════════════════════════════════
# Crowd Pulse — Circuit Breaker
# ═══════════════════════════════════════════════════════════════
# Protects external API calls during high-traffic moments.
# Implements the standard three-state circuit breaker pattern.
# ═══════════════════════════════════════════════════════════════

import time
import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Callable, Any

logger = logging.getLogger("circuit_breaker")


class CircuitState(Enum):
    CLOSED = "closed"        # Normal operation — requests flow through
    OPEN = "open"            # Failing — requests rejected immediately
    HALF_OPEN = "half_open"  # Recovery test — allow limited requests


@dataclass
class CircuitBreaker:
    """
    Circuit breaker for external API calls during high-traffic moments.
    
    Prevents cascading failures by fast-failing when an external service
    (Gemini, Cricket API, etc.) is experiencing errors.
    
    States:
        CLOSED    → Normal. Requests flow. Track failures.
        OPEN      → Service down. Reject immediately, use fallback.
        HALF_OPEN → Testing recovery. Allow N requests through.
    
    Usage:
        cb = CircuitBreaker(name="gemini", failure_threshold=5, recovery_timeout=30)
        result = cb.call(gemini_classify, messages, fallback=rule_based_classify)
    """
    name: str
    failure_threshold: int = 5
    recovery_timeout: float = 30.0
    success_threshold: int = 3

    state: CircuitState = field(default=CircuitState.CLOSED)
    failure_count: int = field(default=0)
    success_count: int = field(default=0)
    last_failure_time: float = field(default=0.0)
    total_rejected: int = field(default=0)

    def call(self, func: Callable, *args, fallback: Callable = None, **kwargs) -> Any:
        """
        Execute function through the circuit breaker.
        
        Args:
            func: The function to execute (e.g., API call)
            fallback: Optional fallback function when circuit is OPEN
            
        Returns:
            Result from func or fallback
            
        Raises:
            CircuitOpenError: If circuit is OPEN and no fallback provided
        """
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                logger.info(f"[{self.name}] Circuit HALF_OPEN — testing recovery")
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
            else:
                self.total_rejected += 1
                remaining = self.recovery_timeout - (time.time() - self.last_failure_time)
                if fallback:
                    logger.debug(f"[{self.name}] Circuit OPEN — using fallback ({remaining:.0f}s remaining)")
                    return fallback(*args, **kwargs)
                raise CircuitOpenError(
                    f"Circuit [{self.name}] OPEN. "
                    f"Rejected {self.total_rejected} calls. "
                    f"Recovery in {remaining:.0f}s"
                )

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            if fallback:
                logger.warning(f"[{self.name}] Call failed, using fallback: {e}")
                return fallback(*args, **kwargs)
            raise

    def _on_success(self):
        """Record a successful call."""
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                logger.info(f"[{self.name}] Circuit CLOSED — fully recovered ✓")
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.total_rejected = 0

    def _on_failure(self):
        """Record a failed call."""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == CircuitState.HALF_OPEN:
            logger.warning(f"[{self.name}] Circuit OPEN — recovery failed ✗")
            self.state = CircuitState.OPEN
        elif self.failure_count >= self.failure_threshold:
            logger.warning(
                f"[{self.name}] Circuit OPEN — {self.failure_count} consecutive failures"
            )
            self.state = CircuitState.OPEN

    def reset(self):
        """Manually reset the circuit breaker."""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.total_rejected = 0
        logger.info(f"[{self.name}] Circuit manually reset")

    @property
    def is_available(self) -> bool:
        """Check if the circuit breaker will allow a request."""
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.HALF_OPEN:
            return True
        # OPEN — check if recovery timeout has elapsed
        return time.time() - self.last_failure_time >= self.recovery_timeout


class CircuitOpenError(Exception):
    """Raised when a circuit breaker is OPEN and no fallback is provided."""
    pass


# ─── Priority Sampler (for rate-limited scenarios) ───────────

def sample_under_pressure(messages: list[dict], max_batch: int) -> list[dict]:
    """
    When rate-limited, intelligently sample messages to maximize
    emotional signal within the available API budget.
    
    Priority order:
        P0: Wickets, hat-tricks (match-changing)
        P1: Sixes, milestones (strong emotion)
        P2: Fours, close-calls (moderate emotion)
        P3: Dots, singles (background noise)
    
    Args:
        messages: List of raw message dicts
        max_batch: Maximum number of messages to return
    
    Returns:
        Top N messages by emotional priority
    """
    def priority_score(msg: dict) -> float:
        text = msg.get("raw_text", "").lower()
        score = 0.0

        # High-emotion keyword indicators
        if any(w in text for w in ["wicket", "out", "bowled", "caught", "lbw"]):
            score += 10
        if any(w in text for w in ["six", "sixer", "🔥🔥", "massive"]):
            score += 8
        if any(w in text for w in ["won", "champion", "victory", "🏆"]):
            score += 9
        if any(w in text for w in ["no way", "how", "unbelievable", "😱"]):
            score += 7

        # Intensity markers
        if text.isupper() and len(text) > 10:
            score += 5
        if text.count("!") > 2:
            score += 3
        emoji_count = sum(1 for c in text if ord(c) > 0x1F600)
        score += min(emoji_count, 5)

        # Penalize likely spam/neutral
        if len(text) < 5:
            score -= 5
        if text.startswith("http"):
            score -= 10
        if len(set(text)) < 3:  # Repetitive spam like "aaaaa"
            score -= 8

        return score

    scored = sorted(messages, key=priority_score, reverse=True)
    return scored[:max_batch]
