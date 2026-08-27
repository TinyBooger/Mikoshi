"""Voice-to-text (ASR) helpers backed by DashScope paraformer-realtime."""
import logging
import os
import tempfile
from http import HTTPStatus

logger = logging.getLogger(__name__)

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")

ASR_MODEL = "paraformer-realtime-8k-v2"
ASR_SAMPLE_RATE = 16000


def transcribe_audio(file_path: str, sample_rate: int = ASR_SAMPLE_RATE) -> dict:
    """Transcribe a local WAV audio file using DashScope paraformer-realtime.

    Returns ``{"success": bool, "text": str, ...}``.
    """
    if not DASHSCOPE_API_KEY:
        return {"success": False, "message": "DASHSCOPE_API_KEY is not configured"}

    try:
        import dashscope
        from dashscope.audio.asr import Recognition

        dashscope.api_key = DASHSCOPE_API_KEY

        recognition = Recognition(
            model=ASR_MODEL,
            format="wav",
            sample_rate=sample_rate,
            language_hints=["zh", "en"],
            callback=None,
        )
        result = recognition.call(file_path)

        if result.status_code != HTTPStatus.OK:
            message = getattr(result, "message", None) or "ASR failed"
            return {"success": False, "message": str(message)}

        text = _extract_sentence_text(result)
        return {
            "success": True,
            "text": text,
            "request_id": recognition.get_last_request_id(),
        }
    except Exception as exc:  # noqa: BLE001 - surface any ASR failure to the caller
        logger.exception("Voice-to-text ASR error")
        return {"success": False, "message": str(exc)}


def transcribe_audio_bytes(audio_bytes: bytes, sample_rate: int = ASR_SAMPLE_RATE) -> dict:
    """Transcribe in-memory WAV audio bytes."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        return transcribe_audio(tmp_path, sample_rate=sample_rate)
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def _extract_sentence_text(result) -> str:
    """Best-effort extraction of the transcript from a RecognitionResult."""
    sentences = None
    try:
        sentences = result.get_sentence()
    except Exception:  # noqa: BLE001
        sentences = None

    if isinstance(sentences, str):
        return sentences.strip()

    if isinstance(sentences, (list, tuple)):
        parts = []
        for sentence in sentences:
            if isinstance(sentence, dict):
                parts.append(sentence.get("text", ""))
            elif hasattr(sentence, "text"):
                parts.append(sentence.text)
            else:
                parts.append(str(sentence))
        return "".join(parts).strip()

    # Fallback to the raw output payload when get_sentence() is unavailable.
    output = getattr(result, "output", None)
    if isinstance(output, dict):
        sentence_list = output.get("sentence") or output.get("sentences")
        if isinstance(sentence_list, list):
            parts = []
            for sentence in sentence_list:
                if isinstance(sentence, dict):
                    parts.append(sentence.get("text", ""))
                else:
                    parts.append(str(sentence))
            return "".join(parts).strip()

    return ""
