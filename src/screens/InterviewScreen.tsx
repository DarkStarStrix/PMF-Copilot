import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Square, MessageSquare, CheckCircle } from "lucide-react";
import { Layout } from "../components/layout";
import { Button, Card, ProgressBar, Badge } from "../components/ui";
import { TranscriptView } from "../components/interview/TranscriptView";
import { usePMF } from "../context/PMFContext";
import { Answer } from "../types";
import styles from "./InterviewScreen.module.css";

const categoryColors: Record<
  string,
  "primary" | "success" | "warning" | "error" | "info"
> = {
  "Pain Points": "error",
  "Feature Requests": "success",
  "User Behavior": "info",
  "Competitive Landscape": "warning",
  "Value Proposition": "primary",
  "Adoption Barriers": "warning",
};

export const InterviewScreen: React.FC = () => {
  const navigate = useNavigate();
  const { state, goToQuestion, addAnswer, completeInterview } = usePMF();
  const { questions, currentQuestionIndex, answers } = state;

  const [currentAnswer, setCurrentAnswer] = useState("");
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [followUpAnswers, setFollowUpAnswers] = useState<
    Record<number, string>
  >({});
  const [isRecording, setIsRecording] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const existingAnswer = answers.find(
    (a) => a.questionId === currentQuestion?.id,
  );

  useEffect(() => {
    if (existingAnswer) {
      setCurrentAnswer(existingAnswer.answer);
    } else {
      setCurrentAnswer("");
    }
    setShowFollowUps(false);
    setFollowUpAnswers({});
  }, [currentQuestionIndex, existingAnswer]);

  const handleSaveAnswer = () => {
    if (!currentAnswer.trim()) return;

    const answer: Answer = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.text,
      answer: currentAnswer.trim(),
      category: currentQuestion.category,
      followUpAnswers: Object.entries(followUpAnswers)
        .filter(([_, value]) => value.trim())
        .map(([index, value]) => ({
          question: currentQuestion.followUps?.[parseInt(index)] || "",
          answer: value.trim(),
        })),
    };

    addAnswer(answer);
  };

  const handlePrevious = () => {
    handleSaveAnswer();
    if (currentQuestionIndex > 0) {
      goToQuestion(currentQuestionIndex - 1);
    }
  };

  const handleEndInterview = () => {
    handleSaveAnswer();
    completeInterview();
    navigate("/results");
  };

  const handleToggleRecording = async () => {
    setIsRecording(!isRecording);
  };

  if (!currentQuestion) {
    return (
      <Layout maxWidth="md">
        <div className={styles.noQuestions}>
          <p>No questions available. Please go back to setup.</p>
          <Button onClick={() => navigate("/questions")}>Go to Setup</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout maxWidth="lg" centered={false}>
      <div className={styles.container}>
        <div className={styles.progressSection}>
          <div className={styles.progressInfo}>
            <span className={styles.progressLabel}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <Badge
              variant={categoryColors[currentQuestion.category] || "default"}
            >
              {currentQuestion.category}
            </Badge>
          </div>
          <ProgressBar progress={progress} size="sm" />
        </div>

        <div className={styles.mainContent}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className={styles.questionSection}
            >
              <Card variant="elevated" padding="lg">
                <h2 className={styles.questionText}>{currentQuestion.text}</h2>

                <div className={styles.answerSection}>
                  <div className={styles.answerHeader}>
                    <label className={styles.answerLabel}>
                      Live Transcript
                    </label>
                    <button
                      className={`${styles.recordButton} ${isRecording ? styles.recording : ""}`}
                      onClick={handleToggleRecording}
                      title={
                        isRecording ? "Stop recording" : "Start voice recording"
                      }
                    >
                      <div className={styles.recordIndicator} />
                      {isRecording ? "Listening..." : "Start Listening"}
                    </button>
                  </div>

                  {/* Replaced TextArea with TranscriptView */}
                  <div style={{ height: "300px", marginBottom: "20px" }}>
                    <TranscriptView
                      isRecording={isRecording}
                      onTranscriptComplete={(text: string) => {
                        setCurrentAnswer(text);
                        setIsRecording(false);
                        // Simulate generating a follow-up after a delay
                        setTimeout(() => {
                          const mockFollowUp =
                            "How often do you encounter this challenge?";
                          // Only add if not already there or to show dynamic nature
                          if (
                            !currentQuestion.followUps?.includes(mockFollowUp)
                          ) {
                            // This is a bit tricky since we can't easily mutate the question object in a deep way without dispatch
                            // But for UI purpose we can show it locally
                          }
                          setShowFollowUps(true);
                          setFollowUpAnswers((prev) => ({ ...prev, 0: "" })); // Trigger display
                        }, 1500);
                      }}
                    />
                  </div>
                </div>

                {/* Modified Follow-ups section to show generated question */}
                <AnimatePresence>
                  {showFollowUps && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className={styles.followUpsSection}
                    >
                      <div className={styles.followUpItem}>
                        <div className={styles.followUpLabel}>
                          <MessageSquare size={16} className="text-blue-500" />
                          <span style={{ fontWeight: 600, color: "#2563eb" }}>
                            Suggested Follow-up:
                          </span>
                        </div>
                        <p className={styles.followUpQuestion}>
                          {currentQuestion.followUps?.[0] ||
                            "How often do you encounter this challenge?"}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          </AnimatePresence>

          <div className={styles.sidebar}>
            <Card variant="outlined" padding="md">
              <h3 className={styles.sidebarTitle}>Interview Progress</h3>
              <div className={styles.questionList}>
                {questions.map((q, index) => {
                  const isAnswered = answers.some((a) => a.questionId === q.id);
                  const isCurrent = index === currentQuestionIndex;

                  return (
                    <button
                      key={q.id}
                      className={`${styles.questionListItem} ${isCurrent ? styles.current : ""} ${isAnswered ? styles.answered : ""}`}
                      onClick={() => {
                        handleSaveAnswer();
                        goToQuestion(index);
                      }}
                    >
                      <span className={styles.questionListNumber}>
                        Q{index + 1}
                      </span>
                      <span className={styles.questionListText}>
                        {q.text.slice(0, 40)}...
                      </span>
                      {isAnswered && (
                        <CheckCircle size={16} className={styles.checkIcon} />
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>

          <Button
            variant="danger"
            onClick={handleEndInterview}
            leftIcon={<Square size={16} />}
          >
            End Interview
          </Button>

          {/* Next Question button removed as requested */}
          {currentQuestionIndex === questions.length - 1 && (
            <Button
              onClick={handleEndInterview}
              rightIcon={<CheckCircle size={20} />}
            >
              Complete Interview
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
};
