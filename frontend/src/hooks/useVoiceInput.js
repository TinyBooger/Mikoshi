import { useCallback, useRef, useState } from 'react';
import { cancelVoiceRecording, startVoiceRecording, stopVoiceRecording } from '../utils/voiceRecorder';

const SILENCE_TIMEOUT_MS = 15000;
const VOICE_ACTIVITY_THRESHOLD = 0.02;

/**
 * Voice-to-text: records mic audio, streams it to the backend over a
 * websocket, and writes the (partial + final) transcript into the chat input.
 *
 * The input value itself stays owned by the caller — this hook only reads the
 * current `input` to build the transcript prefix and writes back through
 * `setInput`, so programmatic writers elsewhere (send, send-failure restore)
 * keep working.
 *
 * @param {object}   params
 * @param {string}   params.sessionToken - auth session token
 * @param {string}   params.input        - current chat input value
 * @param {function} params.setInput     - setter for the chat input value
 * @param {object}   params.toast        - toast provider (from useToast)
 * @returns {{ isRecording, isTranscribing, recordingLevel, handleVoiceToggle, stopVoiceInput, closeVoiceConnection }}
 */
export function useVoiceInput({ sessionToken, input, setInput, toast }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingLevel, setRecordingLevel] = useState(0);
  const voiceSocketRef = useRef(null);
  const voicePrefixRef = useRef('');
  const voiceTranscriptRef = useRef('');
  const voicePartialRef = useRef('');
  const silenceTimeoutRef = useRef(null);
  const recordingActiveRef = useRef(false);
  const voiceSessionIdRef = useRef(0);

  const clearSilenceTimeout = () => {
    if (silenceTimeoutRef.current !== null) {
      window.clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  const resetSilenceTimeout = () => {
    clearSilenceTimeout();
    silenceTimeoutRef.current = window.setTimeout(() => {
      void finishRecording();
    }, SILENCE_TIMEOUT_MS);
  };

  async function finishRecording() {
    if (!recordingActiveRef.current) return;
    const voiceSessionId = voiceSessionIdRef.current;
    recordingActiveRef.current = false;
    clearSilenceTimeout();

    const socket = voiceSocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'stop' }));
    }
    await stopVoiceRecording();
    if (voiceSessionId !== voiceSessionIdRef.current) return;
    setIsRecording(false);
    setRecordingLevel(0);
    setIsTranscribing(true);
  }

  /**
   * Tear down the mic capture and drop the transcription socket. Stable
   * identity (useCallback) so callers can safely list it in effect deps
   * without re-running their cleanup on every render.
   */
  const closeVoiceConnection = useCallback(() => {
    voiceSessionIdRef.current += 1;
    recordingActiveRef.current = false;
    clearSilenceTimeout();
    cancelVoiceRecording();
    voiceSocketRef.current?.close();
    voiceSocketRef.current = null;
  }, []);

  const stopVoiceInput = useCallback(() => {
    closeVoiceConnection();
    setIsRecording(false);
    setIsTranscribing(false);
    setRecordingLevel(0);
  }, [closeVoiceConnection]);

  // Voice-to-text: record audio and transcribe it into the input field.
  const handleVoiceToggle = async () => {
    if (isRecording) {
      await finishRecording();
      return;
    }

    const voiceSessionId = voiceSessionIdRef.current + 1;
    voiceSessionIdRef.current = voiceSessionId;
    try {
      const apiUrl = new URL(window.API_BASE_URL || window.location.origin);
      const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${apiUrl.host}/api/chat/voice-to-text/stream`);
      voiceSocketRef.current = socket;
      voicePrefixRef.current = input.trim() ? `${input.trim()}\n` : '';
      voiceTranscriptRef.current = '';
      voicePartialRef.current = '';

      await new Promise((resolve, reject) => {
        let isReady = false;
        socket.onopen = () => {
          if (voiceSessionId !== voiceSessionIdRef.current) return;
          socket.send(JSON.stringify({ token: sessionToken }));
        };
        socket.onmessage = (event) => {
          if (voiceSessionId !== voiceSessionIdRef.current) return;
          const message = JSON.parse(event.data);
          if (message.type === 'ready') {
            isReady = true;
            resolve();
          } else if (message.type === 'transcript') {
            if (message.is_final) {
              voiceTranscriptRef.current += message.text;
              voicePartialRef.current = '';
            } else {
              voicePartialRef.current = message.text;
            }
            setInput(`${voicePrefixRef.current}${voiceTranscriptRef.current}${voicePartialRef.current}`);
          } else if (message.type === 'complete') {
            setIsTranscribing(false);
          } else if (message.type === 'charged') {
            setIsTranscribing(false);
            socket.close();
          } else if (message.type === 'error') {
            reject(new Error(message.message || '语音识别失败，请重试。'));
          }
        };
        socket.onerror = () => {
          if (voiceSessionId === voiceSessionIdRef.current) {
            reject(new Error('无法连接语音识别服务，请重试。'));
          }
        };
        socket.onclose = () => {
          if (!isReady) reject(new Error('无法连接语音识别服务，请重试。'));
        };
      });

      if (voiceSessionId !== voiceSessionIdRef.current) return;
      await startVoiceRecording(
        (frame) => {
          if (voiceSessionId === voiceSessionIdRef.current && socket.readyState === WebSocket.OPEN) {
            socket.send(frame);
          }
        },
        (level) => {
          if (voiceSessionId !== voiceSessionIdRef.current) return;
          setRecordingLevel(Math.min(1, level * 12));
          if (recordingActiveRef.current && level >= VOICE_ACTIVITY_THRESHOLD) {
            resetSilenceTimeout();
          }
        },
      );
      if (voiceSessionId !== voiceSessionIdRef.current) {
        cancelVoiceRecording();
        return;
      }
      recordingActiveRef.current = true;
      resetSilenceTimeout();
      setIsRecording(true);
    } catch (err) {
      if (voiceSessionId !== voiceSessionIdRef.current) return;
      recordingActiveRef.current = false;
      clearSilenceTimeout();
      setRecordingLevel(0);
      voiceSocketRef.current?.close();
      voiceSocketRef.current = null;
      toast.show(err?.message || '无法启动麦克风录音，请检查权限。', { type: 'error' });
    }
  };

  return {
    isRecording,
    isTranscribing,
    recordingLevel,
    handleVoiceToggle,
    stopVoiceInput,
    closeVoiceConnection,
  };
}
