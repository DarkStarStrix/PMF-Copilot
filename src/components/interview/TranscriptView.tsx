import React, { useEffect, useState, useRef } from "react";
import styles from "./TranscriptView.module.css";

interface TranscriptViewProps {
  isRecording: boolean;
  onTranscriptComplete: (text: string) => void;
}

/**
 * TranscriptView component for Deepgram real-time speech-to-text transcription
 *
 * Setup required:
 * 1. Set DEEPGRAM_API_KEY environment variable in your backend .env file
 * 2. Backend endpoint /deepgram-key returns { api_key: string }
 */
export const TranscriptView: React.FC<TranscriptViewProps> = ({
  isRecording,
  onTranscriptComplete,
}) => {
  const [transcript, setTranscript] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // Convert float32 audio to PCM16
  const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  // Initialize Deepgram connection and microphone
  useEffect(() => {
    if (!isRecording) {
      // Stop recording
      if (deepgramSocketRef.current) {
        deepgramSocketRef.current.close();
        deepgramSocketRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      return;
    }

    isMountedRef.current = true;

    const initializeRecording = async () => {
      try {
        setIsConnecting(true);
        setError(null);
        setTranscript("");

        // Get Deepgram API key from backend
        const keyResponse = await fetch("http://localhost:8000/deepgram-key");
        const keyData = await keyResponse.json();

        if (!keyData.api_key) {
          throw new Error(
            "Deepgram API key not configured. Please set DEEPGRAM_API_KEY environment variable."
          );
        }

        if (!isMountedRef.current) return;

        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (!isMountedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = stream;

        // Create AudioContext
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        // @ts-ignore - ScriptProcessorNode is deprecated but necessary for audio processing
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        // Connect Deepgram WebSocket
        const deepgramUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1`;
        const deepgramSocket = new WebSocket(deepgramUrl, [
          "token",
          keyData.api_key,
        ]);

        deepgramSocket.onopen = () => {
          if (isMountedRef.current) {
            setIsConnecting(false);
          }
        };

        deepgramSocket.onmessage = (event: MessageEvent) => {
          if (!isMountedRef.current) return;

          try {
            const data = JSON.parse(event.data);
            if (
              data.channel &&
              data.channel.alternatives &&
              data.channel.alternatives[0]
            ) {
              const newTranscript = data.channel.alternatives[0].transcript;
              if (newTranscript && data.is_final) {
                setTranscript((prev) => (prev + " " + newTranscript).trim());
              }
            }
          } catch (e) {
            console.error("Error parsing Deepgram message:", e);
          }
        };

        deepgramSocket.onerror = (event: Event) => {
          if (isMountedRef.current) {
            setError("Deepgram connection error");
          }
          console.error("Deepgram error:", event);
        };

        deepgramSocketRef.current = deepgramSocket;

        // Send audio data to Deepgram
        // @ts-ignore - onaudioprocess is deprecated but necessary
        processor.onaudioprocess = (event: any) => {
          if (
            deepgramSocket &&
            deepgramSocket.readyState === WebSocket.OPEN
          ) {
            const inputData = event.inputBuffer.getChannelData(0);
            const pcm16 = floatTo16BitPCM(inputData);
            deepgramSocket.send(pcm16);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      } catch (err) {
        if (isMountedRef.current) {
          const message =
            err instanceof Error ? err.message : "Failed to initialize recording";
          setError(message);
          setIsConnecting(false);
        }
      }
    };

    initializeRecording();

    return () => {
      isMountedRef.current = false;
    };
  }, [isRecording]);

  // Handle transcript completion
  useEffect(() => {
    if (!isRecording && transcript.trim()) {
      onTranscriptComplete(transcript.trim());
    }
  }, [isRecording, transcript]);

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}
      {isConnecting && <div className={styles.connecting}>Connecting to Deepgram...</div>}
      <div className={styles.transcriptBox}>
        {transcript || (
          <span className={styles.placeholder}>
            {isRecording ? "Listening..." : "Click 'Start Listening' to begin"}
          </span>
        )}
      </div>
    </div>
  );
};
