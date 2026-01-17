import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import styles from "./TranscriptView.module.css";

interface Chunk {
  text: string;
  timestamp: string;
  type?: "transcript" | "question";
}

interface TranscriptViewProps {
  isRecording: boolean;
  onTranscriptComplete: (text: string) => void;
}

export interface TranscriptViewRef {
  addQuestionMarker: (questionNumber: number, questionText: string) => void;
}

/**
 * TranscriptView component for Deepgram real-time speech-to-text transcription
 *
 * Setup required:
 * 1. Set DEEPGRAM_API_KEY environment variable in your backend .env file
 * 2. Backend endpoint /deepgram-key returns { api_key: string }
 */
export const TranscriptView = forwardRef<TranscriptViewRef, TranscriptViewProps>(
  ({ isRecording, onTranscriptComplete }, ref) => {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const currentChunkRef = useRef("");
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Expose method to add question markers
  useImperativeHandle(ref, () => ({
    addQuestionMarker: (questionNumber: number, questionText: string) => {
      const timestamp = getElapsedTime();
      setChunks((prev) => [
        ...prev,
        {
          text: `Q${questionNumber}: ${questionText}`,
          timestamp,
          type: "question",
        },
      ]);
    },
  }));

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

  // Format elapsed time as MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // Get current elapsed time since recording started
  const getElapsedTime = (): string => {
    if (!recordingStartTimeRef.current) return "00:00";
    const elapsed = Date.now() - recordingStartTimeRef.current;
    return formatTime(elapsed);
  };

  // Initialize Deepgram connection and microphone
  useEffect(() => {
    if (!isRecording) {
      // Stop recording and clean up resources
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
        chunkTimerRef.current = null;
      }
      if (deepgramSocketRef.current) {
        deepgramSocketRef.current.close();
        deepgramSocketRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      // Save any remaining chunk content
      if (currentChunkRef.current.trim()) {
        setChunks((prev) => [...prev, { text: currentChunkRef.current.trim(), timestamp: getElapsedTime() }]);
      }
      currentChunkRef.current = "";
      recordingStartTimeRef.current = null;
      return;
    }

    isMountedRef.current = true;

    const initializeRecording = async () => {
      try {
        setIsConnecting(true);
        setError(null);
        setChunks([]);
        currentChunkRef.current = "";
        recordingStartTimeRef.current = Date.now();

        // Get Deepgram API key from backend
        const keyResponse = await fetch("http://localhost:8000/deepgram-key");
        if (!keyResponse.ok) {
          throw new Error(
            `Failed to fetch Deepgram API key: ${keyResponse.statusText}`
          );
        }

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
            // Start 5-second chunk timer
            if (chunkTimerRef.current) {
              clearInterval(chunkTimerRef.current);
            }
            chunkTimerRef.current = setInterval(() => {
              if (currentChunkRef.current.trim()) {
                setChunks((prev) => [...prev, { text: currentChunkRef.current.trim(), timestamp: getElapsedTime() }]);
                currentChunkRef.current = "";
              }
            }, 5000);
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
                currentChunkRef.current = (currentChunkRef.current + " " + newTranscript).trim();
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
    if (!isRecording && chunks.length > 0) {
      const fullTranscript = chunks.map((chunk) => chunk.text).join(" ");
      onTranscriptComplete(fullTranscript);
    }
  }, [isRecording, chunks, onTranscriptComplete]);

  // Auto-scroll to bottom when chunks update
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [chunks]);

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}
      {isConnecting && <div className={styles.connecting}>Connecting to Deepgram...</div>}
      <div className={styles.transcriptBox} ref={scrollContainerRef}>
        {chunks.length > 0 ? (
          <div className={styles.chunksContainer}>
            {chunks.map((chunk, index) => (
              <div
                key={index}
                className={`${styles.chunk} ${
                  chunk.type === "question" ? styles.questionMarker : ""
                }`}
              >
                <div className={styles.chunkTimestamp}>{chunk.timestamp}</div>
                <div className={styles.chunkText}>{chunk.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <span className={styles.placeholder}>
            {isRecording ? "Listening..." : "Click 'Start Listening' to begin"}
          </span>
        )}
      </div>
    </div>
  );
  }
);
