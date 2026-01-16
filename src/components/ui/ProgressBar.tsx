import React from 'react';
import { motion } from 'framer-motion';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  progress: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'warning' | 'error';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showLabel = true,
  size = 'md',
  variant = 'primary',
}) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.track} ${styles[size]}`}>
        <motion.div
          className={`${styles.fill} ${styles[variant]}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {showLabel && (
        <span className={styles.label}>{Math.round(clampedProgress)}%</span>
      )}
    </div>
  );
};
