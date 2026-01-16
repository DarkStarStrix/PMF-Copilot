import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Share2,
  Printer,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Target,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { Layout } from '../components/layout';
import { Button, Card, Badge, ProgressBar } from '../components/ui';
import { usePMF } from '../context/PMFContext';
import styles from './ReportScreen.module.css';

export const ReportScreen: React.FC = () => {
  const navigate = useNavigate();
  const { state, reset } = usePMF();
  const { report, productDescription } = state;
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PMF Copilot Report',
          text: report?.executiveSummary || 'Product-Market Fit Analysis Report',
          url: window.location.href,
        });
      } catch {
        // User cancelled sharing
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const handleDownloadPDF = () => {
    // In a real app, this would generate a PDF
    window.print();
  };

  const handleStartNew = () => {
    reset();
    navigate('/');
  };

  if (!report) {
    return (
      <Layout maxWidth="md">
        <div className={styles.noReport}>
          <FileText size={48} className={styles.noReportIcon} />
          <h2>No Report Available</h2>
          <p>Complete an interview and generate a report to see insights.</p>
          <Button onClick={() => navigate('/results')}>Go to Results</Button>
        </div>
      </Layout>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'success';
    if (score >= 50) return 'warning';
    return 'error';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Strong PMF Indicators';
    if (score >= 60) return 'Moderate PMF Potential';
    if (score >= 40) return 'Early Stage - Needs Validation';
    return 'Significant Pivot May Be Needed';
  };

  return (
    <Layout maxWidth="xl" centered={false}>
      <div className={styles.container} ref={reportRef}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className={styles.headerContent}>
            <div className={styles.headerIcon}>
              <FileText size={28} />
            </div>
            <div>
              <h1 className={styles.title}>PMF Analysis Report</h1>
              <p className={styles.subtitle}>{productDescription}</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Button variant="ghost" size="sm" leftIcon={<Printer size={16} />} onClick={handlePrint}>
              Print
            </Button>
            <Button variant="ghost" size="sm" leftIcon={<Share2 size={16} />} onClick={handleShare}>
              Share
            </Button>
            <Button variant="outline" size="sm" leftIcon={<Download size={16} />} onClick={handleDownloadPDF}>
              Download PDF
            </Button>
          </div>
        </motion.div>

        <div className={styles.reportGrid}>
          {/* Score Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className={styles.scoreCardWrapper}
          >
            <Card variant="elevated" padding="lg" className={styles.scoreCard}>
              <h2 className={styles.sectionTitle}>PMF Score</h2>
              <div className={styles.scoreDisplay}>
                <div className={styles.scoreCircle}>
                  <span className={styles.scoreValue}>{report.overallScore}</span>
                  <span className={styles.scoreMax}>/100</span>
                </div>
                <Badge variant={getScoreColor(report.overallScore)} size="md">
                  {getScoreLabel(report.overallScore)}
                </Badge>
              </div>
              <ProgressBar
                progress={report.overallScore}
                variant={getScoreColor(report.overallScore)}
                size="lg"
                showLabel={false}
              />
            </Card>
          </motion.div>

          {/* Executive Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className={styles.summaryWrapper}
          >
            <Card variant="elevated" padding="lg">
              <h2 className={styles.sectionTitle}>Executive Summary</h2>
              <p className={styles.summaryText}>{report.executiveSummary}</p>
            </Card>
          </motion.div>

          {/* Key Insights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card variant="elevated" padding="lg">
              <div className={styles.sectionHeader}>
                <Lightbulb className={styles.sectionIcon} />
                <h2 className={styles.sectionTitle}>Key Insights</h2>
              </div>
              <ul className={styles.insightsList}>
                {report.keyInsights.map((insight, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                    className={styles.insightItem}
                  >
                    <CheckCircle size={18} className={styles.insightIcon} />
                    <span>{insight}</span>
                  </motion.li>
                ))}
              </ul>
            </Card>
          </motion.div>

          {/* Pain Points */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <Card variant="elevated" padding="lg">
              <div className={styles.sectionHeader}>
                <AlertTriangle className={styles.sectionIconWarning} />
                <h2 className={styles.sectionTitle}>Pain Points Identified</h2>
              </div>
              <ul className={styles.painPointsList}>
                {report.painPoints.map((point, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.35 + index * 0.05 }}
                    className={styles.painPointItem}
                  >
                    <div className={styles.painPointBullet} />
                    <span>{point}</span>
                  </motion.li>
                ))}
              </ul>
            </Card>
          </motion.div>

          {/* Opportunities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card variant="elevated" padding="lg">
              <div className={styles.sectionHeader}>
                <Target className={styles.sectionIconSuccess} />
                <h2 className={styles.sectionTitle}>Opportunities</h2>
              </div>
              <ul className={styles.opportunitiesList}>
                {report.opportunities.map((opportunity, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                    className={styles.opportunityItem}
                  >
                    <ArrowRight size={16} className={styles.opportunityIcon} />
                    <span>{opportunity}</span>
                  </motion.li>
                ))}
              </ul>
            </Card>
          </motion.div>

          {/* Recommendations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className={styles.recommendationsWrapper}
          >
            <Card variant="elevated" padding="lg" className={styles.recommendationsCard}>
              <div className={styles.sectionHeader}>
                <CheckCircle className={styles.sectionIconPrimary} />
                <h2 className={styles.sectionTitle}>Recommendations</h2>
              </div>
              <div className={styles.recommendationsList}>
                {report.recommendations.map((rec, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.45 + index * 0.05 }}
                    className={styles.recommendationItem}
                  >
                    <span className={styles.recommendationNumber}>{index + 1}</span>
                    <span className={styles.recommendationText}>{rec}</span>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
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
            onClick={() => navigate('/results')}
          >
            Back to Results
          </Button>
          <Button
            size="lg"
            onClick={handleStartNew}
            leftIcon={<RotateCcw size={20} />}
          >
            Start New Interview
          </Button>
        </motion.div>
      </div>
    </Layout>
  );
};
