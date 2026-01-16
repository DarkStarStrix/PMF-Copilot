import { Question } from '../types';

export const defaultQuestions: Question[] = [
  {
    id: '1',
    text: 'What is the biggest challenge you face in your current workflow that this product could solve?',
    category: 'Pain Points',
    followUps: [
      'How often do you encounter this challenge?',
      'What have you tried to solve this problem before?',
    ],
  },
  {
    id: '2',
    text: 'How do you currently solve this problem, and what tools or methods do you use?',
    category: 'User Behavior',
    followUps: [
      'How satisfied are you with your current solution?',
      'What would you change about your current approach?',
    ],
  },
  {
    id: '3',
    text: 'If you could have any feature that would make your work easier, what would it be?',
    category: 'Feature Requests',
    followUps: [
      'Why is this feature important to you?',
      'How would this feature impact your daily work?',
    ],
  },
  {
    id: '4',
    text: 'What alternatives have you considered or tried, and why did they fall short?',
    category: 'Competitive Landscape',
    followUps: [
      'What was the main reason for switching away from these alternatives?',
      'What would make you switch to a new solution?',
    ],
  },
  {
    id: '5',
    text: 'How would you describe the ideal solution to your problem?',
    category: 'Value Proposition',
    followUps: [
      'What would success look like if you had this solution?',
      'How much time or money would this save you?',
    ],
  },
  {
    id: '6',
    text: 'What concerns would you have about adopting a new solution like this?',
    category: 'Adoption Barriers',
    followUps: [
      'What would help address these concerns?',
      'Who else would need to be involved in the decision?',
    ],
  },
  {
    id: '7',
    text: 'How much would you be willing to pay for a solution that addresses your needs?',
    category: 'Value Proposition',
    followUps: [
      'What would justify a higher price point?',
      'How do you typically budget for tools like this?',
    ],
  },
  {
    id: '8',
    text: 'Who else on your team would benefit from this type of solution?',
    category: 'User Behavior',
    followUps: [
      'How would they use it differently than you?',
      'What would help them adopt it quickly?',
    ],
  },
];
