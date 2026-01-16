import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileSpreadsheet, FileText, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Layout } from '../components/layout';
import { Button, Card, Badge } from '../components/ui';
import { usePMF } from '../context/PMFContext';
import styles from './ResultsScreen.module.css';

const categoryColors: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  'Pain Points': 'error',
  'Feature Requests': 'success',
  'User Behavior': 'info',
  'Competitive Landscape': 'warning',
  'Value Proposition': 'primary',
  'Adoption Barriers': 'warning',
};

export const ResultsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { state, generateReport } = usePMF();
  const { answers, productDescription } = state;
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    generateReport();
    setIsGenerating(false);
    navigate('/report');
  };

  const toggleRowExpansion = (questionId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedRows(newExpanded);
  };

  const handleExportCSV = () => {
    const headers = ['Question', 'Answer', 'Category'];
    const rows = answers.map(a => [
      `"${a.questionText.replace(/"/g, '""')}"`,
      `"${a.answer.replace(/"/g, '""')}"`,
      a.category,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'interview-results.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Get category statistics
  const categoryStats = answers.reduce((acc, answer) => {
    acc[answer.category] = (acc[answer.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Layout maxWidth="xl" centered={false}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className={styles.headerIcon}>
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h1 className={styles.title}>Interview Results</h1>
            <p className={styles.subtitle}>
              Review and analyze the collected responses
            </p>
          </div>
        </motion.div>

        {productDescription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card variant="outlined" padding="md" className={styles.productCard}>
              <span className={styles.productLabel}>Product</span>
              <span className={styles.productDescription}>{productDescription}</span>
            </Card>
          </motion.div>
        )}

        <motion.div
          className={styles.statsRow}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className={styles.statCard}>
            <span className={styles.statValue}>{answers.length}</span>
            <span className={styles.statLabel}>Questions Answered</span>
          </div>
          {Object.entries(categoryStats).map(([category, count]) => (
            <div key={category} className={styles.statCard}>
              <Badge variant={categoryColors[category] || 'default'} size="sm">
                {category}
              </Badge>
              <span className={styles.statCount}>{count}</span>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card variant="elevated" padding="sm" className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <h2 className={styles.tableTitle}>Response Data</h2>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Download size={16} />}
                onClick={handleExportCSV}
              >
                Export CSV
              </Button>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thQuestion}>Question</th>
                    <th className={styles.thAnswer}>Answer</th>
                    <th className={styles.thCategory}>Category</th>
                    <th className={styles.thActions}></th>
                  </tr>
                </thead>
                <tbody>
                  {answers.map((answer, index) => {
                    const isExpanded = expandedRows.has(answer.questionId);
                    const hasFollowUps = answer.followUpAnswers && answer.followUpAnswers.length > 0;

                    return (
                      <React.Fragment key={answer.questionId}>
                        <motion.tr
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className={isExpanded ? styles.expandedRow : ''}
                        >
                          <td className={styles.tdQuestion}>
                            <span className={styles.questionNumber}>Q{index + 1}</span>
                            {answer.questionText}
                          </td>
                          <td className={styles.tdAnswer}>
                            <p className={styles.answerText}>
                              {answer.answer.length > 150
                                ? `${answer.answer.slice(0, 150)}...`
                                : answer.answer}
                            </p>
                          </td>
                          <td className={styles.tdCategory}>
                            <Badge variant={categoryColors[answer.category] || 'default'} size="sm">
                              {answer.category}
                            </Badge>
                          </td>
                          <td className={styles.tdActions}>
                            {hasFollowUps && (
                              <button
                                className={styles.expandButton}
                                onClick={() => toggleRowExpansion(answer.questionId)}
                              >
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </button>
                            )}
                          </td>
                        </motion.tr>
                        {isExpanded && hasFollowUps && (
                          <tr className={styles.followUpRow}>
                            <td colSpan={4}>
                              <div className={styles.followUpsContent}>
                                <span className={styles.followUpsLabel}>Follow-up Responses</span>
                                {answer.followUpAnswers?.map((fu, i) => (
                                  <div key={i} className={styles.followUpItem}>
                                    <span className={styles.followUpQuestion}>{fu.question}</span>
                                    <span className={styles.followUpAnswer}>{fu.answer}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {answers.length === 0 && (
                <div className={styles.emptyState}>
                  <p>No responses recorded yet.</p>
                  <Button variant="outline" onClick={() => navigate('/interview')}>
                    Start Interview
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div
          className={styles.actions}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate('/interview')}
          >
            Back to Interview
          </Button>
          <Button
            size="lg"
            onClick={handleGenerateReport}
            isLoading={isGenerating}
            leftIcon={<FileText size={20} />}
            disabled={answers.length === 0}
          >
            Generate Report
          </Button>
        </motion.div>
      </div>
    </Layout>
  );
};
