import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { PMFState, PMFAction, Question, Answer, PMFReport } from '../types';
import { defaultQuestions } from '../data/questions';

const initialState: PMFState = {
  productDescription: '',
  questions: defaultQuestions,
  currentQuestionIndex: 0,
  answers: [],
  report: null,
  isInterviewComplete: false,
};

function pmfReducer(state: PMFState, action: PMFAction): PMFState {
  switch (action.type) {
    case 'SET_PRODUCT_DESCRIPTION':
      return { ...state, productDescription: action.payload };

    case 'SET_QUESTIONS':
      return { ...state, questions: action.payload };

    case 'SET_CURRENT_QUESTION_INDEX':
      return { ...state, currentQuestionIndex: action.payload };

    case 'ADD_ANSWER':
      return { ...state, answers: [...state.answers, action.payload] };

    case 'UPDATE_ANSWER':
      return {
        ...state,
        answers: state.answers.map((a) =>
          a.questionId === action.payload.questionId
            ? { ...a, answer: action.payload.answer }
            : a
        ),
      };

    case 'SET_REPORT':
      return { ...state, report: action.payload };

    case 'COMPLETE_INTERVIEW':
      return { ...state, isInterviewComplete: true };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

interface PMFContextValue {
  state: PMFState;
  dispatch: React.Dispatch<PMFAction>;
  setProductDescription: (description: string) => void;
  setQuestions: (questions: Question[]) => void;
  goToQuestion: (index: number) => void;
  addAnswer: (answer: Answer) => void;
  updateAnswer: (questionId: string, answer: string) => void;
  generateReport: () => void;
  completeInterview: () => void;
  reset: () => void;
}

const PMFContext = createContext<PMFContextValue | undefined>(undefined);

export function PMFProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pmfReducer, initialState);

  const setProductDescription = (description: string) => {
    dispatch({ type: 'SET_PRODUCT_DESCRIPTION', payload: description });
  };

  const setQuestions = (questions: Question[]) => {
    dispatch({ type: 'SET_QUESTIONS', payload: questions });
  };

  const goToQuestion = (index: number) => {
    dispatch({ type: 'SET_CURRENT_QUESTION_INDEX', payload: index });
  };

  const addAnswer = (answer: Answer) => {
    dispatch({ type: 'ADD_ANSWER', payload: answer });
  };

  const updateAnswer = (questionId: string, answer: string) => {
    dispatch({ type: 'UPDATE_ANSWER', payload: { questionId, answer } });
  };

  const generateReport = () => {
    // Simulate report generation based on answers
    const report: PMFReport = generateMockReport(state.answers, state.productDescription);
    dispatch({ type: 'SET_REPORT', payload: report });
  };

  const completeInterview = () => {
    dispatch({ type: 'COMPLETE_INTERVIEW' });
  };

  const reset = () => {
    dispatch({ type: 'RESET' });
  };

  return (
    <PMFContext.Provider
      value={{
        state,
        dispatch,
        setProductDescription,
        setQuestions,
        goToQuestion,
        addAnswer,
        updateAnswer,
        generateReport,
        completeInterview,
        reset,
      }}
    >
      {children}
    </PMFContext.Provider>
  );
}

export function usePMF() {
  const context = useContext(PMFContext);
  if (context === undefined) {
    throw new Error('usePMF must be used within a PMFProvider');
  }
  return context;
}

// Helper function to generate a mock report
function generateMockReport(answers: Answer[], productDescription: string): PMFReport {
  const painPointAnswers = answers.filter(a => a.category === 'Pain Points');

  return {
    executiveSummary: `Based on the customer interview analysis for "${productDescription}", we have identified several key areas that indicate strong product-market fit potential. The interview responses suggest a clear need for the solution being offered, with notable enthusiasm around core features and use cases.`,
    keyInsights: [
      'Users express strong interest in AI-powered customization capabilities',
      'Time savings is a primary motivator for adoption',
      'Integration with existing workflows is crucial for enterprise users',
      'Price sensitivity varies significantly between startup and enterprise segments',
      'Mobile accessibility is increasingly important for field users',
    ],
    painPoints: painPointAnswers.length > 0
      ? painPointAnswers.map(a => a.answer.slice(0, 100) + '...')
      : [
        'Current solutions require extensive technical expertise',
        'Existing tools lack customization flexibility',
        'High costs of enterprise AI solutions',
        'Poor integration with existing tech stacks',
        'Steep learning curve for non-technical users',
      ],
    opportunities: [
      'Develop no-code/low-code interface for broader accessibility',
      'Create pre-built templates for common use cases',
      'Offer tiered pricing to capture different market segments',
      'Build strategic integrations with popular platforms',
      'Develop comprehensive onboarding and training resources',
    ],
    recommendations: [
      'Focus initial efforts on the SMB segment where pain points are most acute',
      'Prioritize ease-of-use and quick time-to-value in product development',
      'Develop case studies showcasing ROI for different use cases',
      'Consider a freemium tier to reduce adoption barriers',
      'Invest in customer success to maximize retention and expansion',
    ],
    overallScore: 72,
  };
}
