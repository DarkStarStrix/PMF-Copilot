import React from 'react';
import { motion } from 'framer-motion';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  centered?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  maxWidth = 'lg',
  centered = true,
}) => {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <a href="/" className={styles.logo}>
            <span className={styles.logoIcon}>P</span>
            <span className={styles.logoText}>PMF Copilot</span>
          </a>
        </div>
      </header>
      <motion.main
        className={`${styles.main} ${styles[maxWidth]} ${centered ? styles.centered : ''}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.main>
    </div>
  );
};
