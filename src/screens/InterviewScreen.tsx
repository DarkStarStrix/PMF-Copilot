import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Square } from "lucide-react";
import { Layout } from "../components/layout";
import { Button } from "../components/ui";
import { TranscriptView } from "../components/interview/TranscriptView";
import { QuestionListPanel, type QuestionItem } from "../components/interview/QuestionListPanel";
import { usePMF } from "../context/PMFContext";
import styles from "./InterviewScreen.module.css";

const API_BASE_URL = "http://localhost:8000";
const POLLING_INTERVAL = 5000; // 5 seconds

export const InterviewScreen: React.FC = () => {
  const navigate = useNavigate();
  const { state, completeInterview } = usePMF();
  const { productDescription } = state;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pollingIntervalRef = useRef<number | null>(null);
  const fullTranscriptRef = useRef<string>("");

  // Initialize session on mount (single persistent session)
  useEffect(() => {
    const initSession = async () => {
      try {
        setIsLoading(true);

        // Get or create the persistent session
        const getSessionResponse = await fetch(`${API_BASE_URL}/get-session`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!getSessionResponse.ok) throw new Error("Failed to get session");

        const sessionData = await getSessionResponse.json();
        const persistentSessionId = sessionData.session_id;
        setSessionId(persistentSessionId);

        // Update session with product description if available
        if (productDescription) {
          await fetch(`${API_BASE_URL}/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product: productDescription }),
          });
        }

        // Start live mode
        await fetch(`${API_BASE_URL}/live/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: persistentSessionId }),
        });

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize");
        setIsLoading(false);
      }
    };

    // Initialize session immediately on component mount
    initSession();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Poll for questions every 5 seconds
  useEffect(() => {
    if (!sessionId) return;

    const pollQuestions = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/live/questions?session_id=${sessionId}`
        );

        if (!response.ok) return;

        const data = await response.json();
        setQuestions(data.questions || []);

        // Auto-activate first pending question if none active
        const hasActive = data.questions.some((q: QuestionItem) => q.status === "active");
        if (!hasActive && data.current_question) {
          await updateQuestionStatus(data.current_question.id, "active");
        }
      } catch (err) {
        console.error("Failed to poll questions:", err);
      }
    };

    // Initial poll
    pollQuestions();

    // Set up polling interval
    pollingIntervalRef.current = window.setInterval(pollQuestions, POLLING_INTERVAL);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [sessionId]);

  const updateQuestionStatus = async (
    questionId: string,
    status: "done" | "skipped" | "active"
  ) => {
    if (!sessionId) return;

    try {
      await fetch(`${API_BASE_URL}/live/question/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: questionId,
          status,
        }),
      });

      // Update local state immediately for better UX
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id === questionId) {
            return { ...q, status };
          }
          // Deactivate other questions when activating one
          if (status === "active" && q.status === "active") {
            return { ...q, status: "pending" };
          }
          return q;
        })
      );

      // If marking done, auto-activate next pending question
      if (status === "done") {
        const currentQuestion = questions.find((q) => q.id === questionId);
        const nextPending = questions.find(
          (q) =>
            q.status === "pending" &&
            q.order > (currentQuestion?.order || 0)
        );
        if (nextPending) {
          setTimeout(() => updateQuestionStatus(nextPending.id, "active"), 500);
        }
      }
    } catch (err) {
      console.error("Failed to update question status:", err);
    }
  };

  const handleTranscriptComplete = async (text: string) => {
    if (!sessionId || !text.trim()) return;

    fullTranscriptRef.current += (fullTranscriptRef.current ? " " : "") + text;

    try {
      // Send transcript to backend to generate follow-ups
      await fetch(`${API_BASE_URL}/live/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          text: text,
        }),
      });
    } catch (err) {
      console.error("Failed to send transcript:", err);
    }
  };

  const handleEndInterview = async () => {
    if (!sessionId) return;

    try {
      await fetch(`${API_BASE_URL}/live/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      completeInterview();
      navigate("/results");
    } catch (err) {
      console.error("Failed to stop interview:", err);
    }
  };

  if (isLoading) {
    return (
      <Layout maxWidth="lg">
        <div className={styles.loading}>Initializing interview...</div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout maxWidth="lg">
        <div className={styles.error}>
          <p>Error: {error}</p>
          <Button onClick={() => navigate("/")}>Go Back</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout maxWidth="full" centered={false}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Live Interview</h1>
          <Button
            variant="danger"
            onClick={handleEndInterview}
            leftIcon={<Square size={16} />}
          >
            End Interview
          </Button>
        </div>

        <div className={styles.twoColumnLayout}>
          {/* Left Column: Questions */}
          <div className={styles.leftColumn}>
            <QuestionListPanel
              questions={questions}
              onMarkDone={(id) => updateQuestionStatus(id, "done")}
              onSkip={(id) => updateQuestionStatus(id, "skipped")}
              onSetActive={(id) => updateQuestionStatus(id, "active")}
            />
          </div>

          {/* Right Column: Transcript */}
          <div className={styles.rightColumn}>
            <div className={styles.transcriptContainer}>
              <div className={styles.transcriptHeader}>
                <h2 className={styles.transcriptTitle}>Real-time Transcription</h2>
                <button
                  className={`${styles.recordButton} ${isRecording ? styles.recording : ""}`}
                  onClick={() => setIsRecording(!isRecording)}
                >
                  <div className={styles.recordIndicator} />
                  {isRecording ? "Listening..." : "Start Listening"}
                </button>
              </div>

              <div className={styles.transcriptView}>
                <TranscriptView
                  isRecording={isRecording}
                  onTranscriptComplete={handleTranscriptComplete}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
