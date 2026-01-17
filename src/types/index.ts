export interface Question {
  id: string;
  text: string;
  category: QuestionCategory;
  followUps?: string[];
}

export interface QuestionItem {
  id: string;
  text: string;
  status: 'pending' | 'active' | 'done' | 'skipped';
  created_at: string;
  order: number;
}

export type QuestionCategory =
  | 'Pain Points'
  | 'Feature Requests'
  | 'User Behavior'
  | 'Competitive Landscape'
  | 'Value Proposition'
  | 'Adoption Barriers';

export interface Answer {
  questionId: string;
  questionText: string;
  answer: string;
  category: QuestionCategory;
  followUpAnswers?: { question: string; answer: string }[];
}

export interface InterviewSession {
  id: string;
  productDescription: string;
  startedAt: Date;
  completedAt?: Date;
  answers: Answer[];
}

export interface PMFReport {
  executiveSummary: string;
  keyInsights: string[];
  painPoints: string[];
  opportunities: string[];
  recommendations: string[];
  overallScore: number;
}

export interface PMFState {
  productDescription: string;
  questions: Question[];
  currentQuestionIndex: number;
  answers: Answer[];
  report: PMFReport | null;
  isInterviewComplete: boolean;
}

export type PMFAction =
  | { type: 'SET_PRODUCT_DESCRIPTION'; payload: string }
  | { type: 'SET_QUESTIONS'; payload: Question[] }
  | { type: 'SET_CURRENT_QUESTION_INDEX'; payload: number }
  | { type: 'ADD_ANSWER'; payload: Answer }
  | { type: 'UPDATE_ANSWER'; payload: { questionId: string; answer: string } }
  | { type: 'SET_REPORT'; payload: PMFReport }
  | { type: 'COMPLETE_INTERVIEW' }
  | { type: 'RESET' };
