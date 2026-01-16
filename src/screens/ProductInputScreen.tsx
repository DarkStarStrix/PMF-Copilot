import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Layout } from '../components/layout';
import { Button, Card, TextArea } from '../components/ui';
import { usePMF } from '../context/PMFContext';
import styles from './ProductInputScreen.module.css';

export const ProductInputScreen: React.FC = () => {
  const navigate = useNavigate();
  const { setProductDescription } = usePMF();
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (description.trim().length < 10) {
      setError('Please provide a more detailed description (at least 10 characters)');
      return;
    }
    setProductDescription(description.trim());
    navigate('/questions');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleContinue();
    }
  };

  return (
    <Layout maxWidth="md">
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.iconWrapper}>
            <Sparkles className={styles.icon} />
          </div>
          <h1 className={styles.title}>Start Your PMF Journey</h1>
          <p className={styles.subtitle}>
            Describe your product and we will help you discover product-market fit through
            structured customer interviews.
          </p>
        </motion.div>

        <Card variant="elevated" padding="lg">
          <div className={styles.form}>
            <TextArea
              label="Product Description"
              placeholder="Describe your product... e.g., A SaaS platform that helps you create your own customized AI experiences"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={handleKeyDown}
              error={error}
              helperText="Be specific about what your product does and who it's for"
              rows={5}
            />

            <div className={styles.examples}>
              <span className={styles.examplesLabel}>Examples:</span>
              <button
                type="button"
                className={styles.exampleChip}
                onClick={() => setDescription('A SaaS platform that helps you create your own customized AI experiences')}
              >
                AI Experience Platform
              </button>
              <button
                type="button"
                className={styles.exampleChip}
                onClick={() => setDescription('A mobile app that connects local farmers directly with consumers for fresh produce delivery')}
              >
                Farm-to-Table App
              </button>
              <button
                type="button"
                className={styles.exampleChip}
                onClick={() => setDescription('A B2B tool that automates expense reporting and approval workflows for finance teams')}
              >
                Expense Automation
              </button>
            </div>

            <Button
              size="lg"
              fullWidth
              onClick={handleContinue}
              rightIcon={<ArrowRight size={20} />}
              disabled={!description.trim()}
            >
              Continue to Interview Setup
            </Button>
          </div>
        </Card>

        <motion.p
          className={styles.hint}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Press Cmd+Enter to continue
        </motion.p>
      </div>
    </Layout>
  );
};
