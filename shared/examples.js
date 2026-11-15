export const defaultQuestions = {
  refund: { type: 'noul', instructions: 'Is a refund requested?' },
  team: { type: 'choice', instructions: 'Which team should handle this?', criteria: { billing: 'Payments and refunds', technical: 'Software errors' } },
  urgency: { type: 'score', instructions: 'How urgent is it?', criteria: ['Routine', 'Urgent', 'Emergency'] },
};

export const defaultExamples = [
  { text: 'The customer requests a refund for a duplicate payment.', expectedAnswers: { refund: true, team: 'billing', urgency: 0 } },
  { text: 'The app crashes whenever I try to sign in. Please help.', expectedAnswers: { refund: false, team: 'technical', urgency: 1 } },
  { text: 'Our payment processing is down for every customer. This needs immediate attention.', expectedAnswers: { refund: false, team: 'technical', urgency: 2 } },
];

export const imageExampleQuestions = {
  has_circle: { type: 'noul', instructions: 'Is there a circle in the pictures in `images`?' },
  object_color: { type: 'choice', instructions: 'What is the color of the main colored object in the first picture in `images`? Ignore the background.', criteria: { red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow', other: 'Another color or no colored object' } },
};

export const imageExampleLabels = {
  'red-circle': { has_circle: true, object_color: 'red' },
  'blue-square': { has_circle: false, object_color: 'blue' },
};
