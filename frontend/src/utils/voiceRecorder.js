// Live PCM recorder for DashScope paraformer-realtime.

const WAV_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

let audioContext = null;
let mediaStream = null;
let sourceNode = null;
let processorNode = null;
let audioChunkHandler = null;
let resampleBuffer = new Float32Array(0);
let resamplePosition = 0;

function encodePcmFrame(floatSamples) {
  const pcm = new Int16Array(floatSamples.length);
  for (let i = 0; i < floatSamples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, floatSamples[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm.buffer;
}

function resampleFrame(floatSamples, sourceSampleRate) {
  if (sourceSampleRate === WAV_SAMPLE_RATE) {
    return encodePcmFrame(floatSamples);
  }

  const combined = new Float32Array(resampleBuffer.length + floatSamples.length);
  combined.set(resampleBuffer);
  combined.set(floatSamples, resampleBuffer.length);

  const sourceStep = sourceSampleRate / WAV_SAMPLE_RATE;
  const output = [];
  while (resamplePosition + 1 < combined.length) {
    const index = Math.floor(resamplePosition);
    const fraction = resamplePosition - index;
    output.push(combined[index] + (combined[index + 1] - combined[index]) * fraction);
    resamplePosition += sourceStep;
  }

  const consumedSamples = Math.floor(resamplePosition);
  resampleBuffer = combined.slice(consumedSamples);
  resamplePosition -= consumedSamples;

  return output.length > 0 ? encodePcmFrame(output) : null;
}

function resetResampler() {
  resampleBuffer = new Float32Array(0);
  resamplePosition = 0;
}

export async function startVoiceRecording(onAudioChunk = null) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('当前浏览器不支持麦克风录音');
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: WAV_SAMPLE_RATE,
    });
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
    audioChunkHandler = onAudioChunk;
    resetResampler();
    processorNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const pcmFrame = resampleFrame(inputData, audioContext.sampleRate);
      if (pcmFrame) audioChunkHandler?.(pcmFrame);
    };

    sourceNode.connect(processorNode);
    // ScriptProcessorNode needs to be connected to the destination to fire.
    processorNode.connect(audioContext.destination);
  } catch (error) {
    cancelVoiceRecording();
    throw error;
  }
}

function releaseRecordingResources() {
  let closePromise = Promise.resolve();
  if (processorNode) {
    processorNode.disconnect();
    processorNode.onaudioprocess = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
  }
  if (audioContext) {
    closePromise = audioContext.close().catch(() => undefined);
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }
  return closePromise;
}

export function cancelVoiceRecording() {
  void releaseRecordingResources();
  audioContext = null;
  mediaStream = null;
  sourceNode = null;
  processorNode = null;
  audioChunkHandler = null;
  resetResampler();
}

export async function stopVoiceRecording() {
  await releaseRecordingResources();

  audioContext = null;
  mediaStream = null;
  sourceNode = null;
  processorNode = null;
  audioChunkHandler = null;
  resetResampler();
}
