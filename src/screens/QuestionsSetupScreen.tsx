import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, MessageSquare, ChevronRight } from 'lucide-react';
import { Layout } from '../components/layout';
import { Button, Card, Badge } from '../components/ui';
import { usePMF } from '../context/PMFContext';
import styles from './QuestionsSetupScreen.module.css';

const categoryColors: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  'Pain Points': 'error',
  'Feature Requests': 'success',
  'User Behavior': 'info',
  'Competitive Landscape': 'warning',
  'Value Proposition': 'primary',
  'Adoption Barriers': 'warning',
};

export const QuestionsSetupScreen: React.FC = () => {
  const navigate = useNavigate();
  const { state } = usePMF();
  const { productDescription, questions } = state;

  const handleGoLive = () => {
    navigate('/interview');
  };

  return (
    <Layout maxWidth="lg" centered={false}>
      <div className={styles.container}>
        <div className={styles.header}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className={styles.title}>Interview Questions</h1>
            <p className={styles.subtitle}>
              Review the questions that will guide your customer interview
            </p>
          </motion.div>
        </div>

        {productDescription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card variant="outlined" padding="md" className={styles.productCard}>
              <div className={styles.productLabel}>Your Product</div>
              <p className={styles.productDescription}>{productDescription}</p>
            </Card>
          </motion.div>
        )}

        <div className={styles.questionsGrid}>
          {questions.map((question, index) => (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + index * 0.05 }}
            >
              <Card variant="default" padding="md" className={styles.questionCard}>
                <div className={styles.questionHeader}>
                  <span className={styles.questionNumber}>Q{index + 1}</span>
                  <Badge variant={categoryColors[question.category] || 'default'} size="sm">
                    {question.category}
                  </Badge>
                </div>
                <p className={styles.questionText}>{question.text}</p>
                {question.followUps && question.followUps.length > 0 && (
                  <div className={styles.followUps}>
                    <div className={styles.followUpsLabel}>
                      <MessageSquare size={14} />
                      <span>Follow-up questions</span>
                    </div>
                    <ul className={styles.followUpsList}>
                      {question.followUps.map((followUp, i) => (
                        <li key={i}>
                          <ChevronRight size={12} />
                          {followUp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          className={styles.actions}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate('/')}
          >
            Back
          </Button>
          <Button
            size="lg"
            onClick={handleGoLive}
            leftIcon={<Play size={20} />}
          >
            Go Live
          </Button>
        </motion.div>
      </div>
    </Layout>
  );
};
