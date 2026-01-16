import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Square, MessageSquare, CheckCircle } from 'lucide-react';
import { Layout } from '../components/layout';
import { Button, Card, TextArea, ProgressBar, Badge } from '../components/ui';
import { usePMF } from '../context/PMFContext';
import { Answer } from '../types';
import styles from './InterviewScreen.module.css';

const categoryColors: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  'Pain Points': 'error',
  'Feature Requests': 'success',
  'User Behavior': 'info',
  'Competitive Landscape': 'warning',
  'Value Proposition': 'primary',
  'Adoption Barriers': 'warning',
};

export const InterviewScreen: React.FC = () => {
  const navigate = useNavigate();
  const { state, goToQuestion, addAnswer, completeInterview } = usePMF();
  const { questions, currentQuestionIndex, answers } = state;

  const [currentAnswer, setCurrentAnswer] = useState('');
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<number, string>>({});
  const [isRecording, setIsRecording] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const existingAnswer = answers.find(a => a.questionId === currentQuestion?.id);

  useEffect(() => {
    if (existingAnswer) {
      setCurrentAnswer(existingAnswer.answer);
    } else {
      setCurrentAnswer('');
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
          question: currentQuestion.followUps?.[parseInt(index)] || '',
          answer: value.trim(),
        })),
    };

    addAnswer(answer);
  };

  const handleNext = () => {
    handleSaveAnswer();
    if (currentQuestionIndex < questions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
    }
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
    navigate('/results');
  };

  const handleToggleRecording = () => {
    setIsRecording(!isRecording);
    // In a real app, this would handle speech-to-text
  };

  if (!currentQuestion) {
    return (
      <Layout maxWidth="md">
        <div className={styles.noQuestions}>
          <p>No questions available. Please go back to setup.</p>
          <Button onClick={() => navigate('/questions')}>Go to Setup</Button>
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
            <Badge variant={categoryColors[currentQuestion.category] || 'default'}>
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
                    <label className={styles.answerLabel}>Your Response</label>
                    <button
                      className={`${styles.recordButton} ${isRecording ? styles.recording : ''}`}
                      onClick={handleToggleRecording}
                      title={isRecording ? 'Stop recording' : 'Start voice recording'}
                    >
                      <div className={styles.recordIndicator} />
                      {isRecording ? 'Recording...' : 'Record'}
                    </button>
                  </div>
                  <TextArea
                    placeholder="Type the interviewee's response here..."
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    rows={6}
                  />
                </div>

                {currentQuestion.followUps && currentQuestion.followUps.length > 0 && (
                  <div className={styles.followUpsSection}>
                    <button
                      className={styles.followUpsToggle}
                      onClick={() => setShowFollowUps(!showFollowUps)}
                    >
                      <MessageSquare size={18} />
                      <span>Follow-up Questions ({currentQuestion.followUps.length})</span>
                      <ChevronRight
                        size={18}
                        className={`${styles.toggleIcon} ${showFollowUps ? styles.open : ''}`}
                      />
                    </button>

                    <AnimatePresence>
                      {showFollowUps && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className={styles.followUpsList}
                        >
                          {currentQuestion.followUps.map((followUp, index) => (
                            <div key={index} className={styles.followUpItem}>
                              <p className={styles.followUpQuestion}>{followUp}</p>
                              <TextArea
                                placeholder="Response to follow-up..."
                                value={followUpAnswers[index] || ''}
                                onChange={(e) =>
                                  setFollowUpAnswers({
                                    ...followUpAnswers,
                                    [index]: e.target.value,
                                  })
                                }
                                rows={3}
                              />
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </Card>
            </motion.div>
          </AnimatePresence>

          <div className={styles.sidebar}>
            <Card variant="outlined" padding="md">
              <h3 className={styles.sidebarTitle}>Interview Progress</h3>
              <div className={styles.questionList}>
                {questions.map((q, index) => {
                  const isAnswered = answers.some(a => a.questionId === q.id);
                  const isCurrent = index === currentQuestionIndex;

                  return (
                    <button
                      key={q.id}
                      className={`${styles.questionListItem} ${isCurrent ? styles.current : ''} ${isAnswered ? styles.answered : ''}`}
                      onClick={() => {
                        handleSaveAnswer();
                        goToQuestion(index);
                      }}
                    >
                      <span className={styles.questionListNumber}>Q{index + 1}</span>
                      <span className={styles.questionListText}>{q.text.slice(0, 40)}...</span>
                      {isAnswered && <CheckCircle size={16} className={styles.checkIcon} />}
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
            leftIcon={<ChevronLeft size={20} />}
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

          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              onClick={handleNext}
              rightIcon={<ChevronRight size={20} />}
            >
              Next Question
            </Button>
          ) : (
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
