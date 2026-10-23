"""Generate initial nicknames from curated words and a random numeric suffix."""
from pathlib import Path
import secrets


_WORD_LIST_DIR = Path(__file__).parent


def _load_words(filename: str) -> tuple[str, ...]:
    path = _WORD_LIST_DIR / filename
    try:
        words = tuple(
            line.strip()
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        )
    except OSError as exc:
        raise RuntimeError(f"Unable to load onboarding nickname words from {path}") from exc

    if len(words) < 100 or len(words) != len(set(words)):
        raise RuntimeError(f"{path} must contain at least 100 unique words")
    return words


_ADJECTIVES = _load_words("onboarding_adjectives_zh.txt")
_NOUNS = _load_words("onboarding_nouns_zh.txt")


def generate_onboarding_nickname() -> str:
    """Return a curated adjective + noun nickname with four random digits."""
    adjective = secrets.choice(_ADJECTIVES)
    noun = secrets.choice(_NOUNS)
    suffix = f"{secrets.randbelow(10_000):04d}"
    return f"{adjective}{noun}{suffix}"
