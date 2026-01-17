import React from 'react';
import { Card, Badge } from '../ui';
import { CheckCircle, SkipForward, Circle } from 'lucide-react';
import styles from './QuestionListPanel.module.css';

export interface QuestionItem {
  id: string;
  text: string;
  status: 'pending' | 'active' | 'done' | 'skipped';
  created_at: string;
  order: number;
}

interface QuestionListPanelProps {
  questions: QuestionItem[];
  onMarkDone: (questionId: string) => void;
  onSkip: (questionId: string) => void;
  onSetActive: (questionId: string) => void;
}

export const QuestionListPanel: React.FC<QuestionListPanelProps> = ({
  questions,
  onMarkDone,
  onSkip,
  onSetActive,
}) => {
  const visibleQuestions = questions.filter(q => q.status !== 'skipped');

  return (
    <Card variant="outlined" padding="md" className={styles.container}>
      <h2 className={styles.title}>Interview Questions</h2>
      <p className={styles.subtitle}>AI-generated questions based on your conversation</p>

      <div className={styles.questionList}>
        {visibleQuestions.length === 0 ? (
          <div className={styles.empty}>
            <p>No questions yet. Start speaking to generate questions.</p>
          </div>
        ) : (
          visibleQuestions.map((question, index) => (
            <div
              key={question.id}
              className={`${styles.questionItem} ${styles[question.status]}`}
              onClick={() => onSetActive(question.id)}
            >
              <div className={styles.questionHeader}>
                <span className={styles.questionNumber}>Q{index + 1}</span>
                <Badge
                  variant={
                    question.status === 'done'
                      ? 'success'
                      : question.status === 'active'
                        ? 'primary'
                        : 'default'
                  }
                  size="sm"
                >
                  {question.status}
                </Badge>
              </div>

              <p className={styles.questionText}>{question.text}</p>

              {question.status === 'active' && (
                <div className={styles.actions}>
                  <button
                    className={styles.doneButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkDone(question.id);
                    }}
                  >
                    <CheckCircle size={16} />
                    Mark Done
                  </button>
                  <button
                    className={styles.skipButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSkip(question.id);
                    }}
                  >
                    <SkipForward size={16} />
                    Skip
                  </button>
                </div>
              )}

              {question.status === 'pending' && (
                <Circle size={16} className={styles.statusIcon} />
              )}

              {question.status === 'done' && (
                <CheckCircle size={16} className={styles.statusIcon} />
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
