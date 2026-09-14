import { useCallback, useRef, useState } from 'react';
import { cancelVoiceRecording, startVoiceRecording, stopVoiceRecording } from '../utils/voiceRecorder';

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
 * @returns {{ isRecording, isTranscribing, handleVoiceToggle, closeVoiceConnection }}
 */
export function useVoiceInput({ sessionToken, input, setInput, toast }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const voiceSocketRef = useRef(null);
  const voicePrefixRef = useRef('');
  const voiceTranscriptRef = useRef('');
  const voicePartialRef = useRef('');

  /**
   * Tear down the mic capture and drop the transcription socket. Stable
   * identity (useCallback) so callers can safely list it in effect deps
   * without re-running their cleanup on every render.
   */
  const closeVoiceConnection = useCallback(() => {
    cancelVoiceRecording();
    voiceSocketRef.current?.close();
    voiceSocketRef.current = null;
  }, []);

  // Voice-to-text: record audio and transcribe it into the input field.
  const handleVoiceToggle = async () => {
    if (isRecording) {
      const socket = voiceSocketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'stop' }));
      }
      await stopVoiceRecording();
      setIsRecording(false);
      setIsTranscribing(true);
      return;
    }
    try {
      const apiUrl = new URL(window.API_BASE_URL || window.location.origin);
      const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${apiUrl.host}/api/chat/voice-to-text/stream`);
      voiceSocketRef.current = socket;
      voicePrefixRef.current = input.trim() ? `${input.trim()}\n` : '';
      voiceTranscriptRef.current = '';
      voicePartialRef.current = '';

      await new Promise((resolve, reject) => {
        socket.onopen = () => {
          socket.send(JSON.stringify({ token: sessionToken }));
        };
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'ready') {
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
        socket.onerror = () => reject(new Error('无法连接语音识别服务，请重试。'));
      });

      await startVoiceRecording((frame) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(frame);
      });
      setIsRecording(true);
    } catch (err) {
      voiceSocketRef.current?.close();
      voiceSocketRef.current = null;
      toast.show(err?.message || '无法启动麦克风录音，请检查权限。', { type: 'error' });
    }
  };

  return { isRecording, isTranscribing, handleVoiceToggle, closeVoiceConnection };
}
