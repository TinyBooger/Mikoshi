// Minimal WAV recorder for the voice-to-text feature.
//
// We record raw PCM at 16 kHz mono via the Web Audio API and wrap it in a WAV
// header so the backend can send it directly to DashScope paraformer-realtime
// (format="wav", sample_rate=16000) without any server-side transcoding.

const WAV_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

let audioContext = null;
let mediaStream = null;
let sourceNode = null;
let processorNode = null;
let chunks = [];

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i += 1) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWav(floatSamples, sampleRate) {
  const length = floatSamples.length;
  const pcm = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const s = Math.max(-1, Math.min(1, floatSamples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  new Int16Array(buffer, 44).set(pcm);

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function startVoiceRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('当前浏览器不支持麦克风录音');
  }

  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: WAV_SAMPLE_RATE,
  });
  sourceNode = audioContext.createMediaStreamSource(mediaStream);
  processorNode = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
  chunks = [];

  processorNode.onaudioprocess = (event) => {
    const inputData = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(inputData));
  };

  sourceNode.connect(processorNode);
  // ScriptProcessorNode needs to be connected to the destination to fire.
  processorNode.connect(audioContext.destination);
}

export async function stopVoiceRecording() {
  if (processorNode) {
    processorNode.disconnect();
    processorNode.onaudioprocess = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
  }
  if (audioContext) {
    try {
      await audioContext.close();
    } catch (err) {
      // ignore close failures
    }
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }

  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  chunks = [];

  // Reset module state.
  audioContext = null;
  mediaStream = null;
  sourceNode = null;
  processorNode = null;

  if (length === 0) {
    throw new Error('未捕获到任何音频');
  }

  return encodeWav(merged, WAV_SAMPLE_RATE);
}
