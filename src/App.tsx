import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  ProductInputScreen,
  QuestionsSetupScreen,
  InterviewScreen,
  ResultsScreen,
  ReportScreen,
} from './screens';

const App: React.FC = () => {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/" element={<ProductInputScreen />} />
        <Route path="/questions" element={<QuestionsSetupScreen />} />
        <Route path="/interview" element={<InterviewScreen />} />
        <Route path="/results" element={<ResultsScreen />} />
        <Route path="/report" element={<ReportScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

export default App;
