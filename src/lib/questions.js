// 6 subjects × 5 hardcoded multiple-choice questions (grades 9-11).
// Wrong options are modeled on common student mistakes, not random noise.

export const SUBJECTS = [
  { id: 'math', name: 'Math', icon: '📐', color: '#8a2be2' },
  { id: 'science', name: 'Science', icon: '🧪', color: '#47bfff' },
  { id: 'geography', name: 'Geography', icon: '🌍', color: '#34e0a1' },
  { id: 'history', name: 'History', icon: '🏛️', color: '#ffce54' },
  { id: 'english', name: 'English', icon: '📖', color: '#ff5c7a' },
  { id: 'french', name: 'French', icon: '🐓', color: '#b983ff' },
]

export function getSubject(subjectId) {
  return SUBJECTS.find((s) => s.id === subjectId) || null
}

export const QUESTIONS_BY_SUBJECT = {
  math: [
    {
      id: 'math-1',
      grade: 9,
      topic: 'Algebra',
      prompt: 'Solve for x: 3x + 7 = 22',
      options: ['x = 5', 'x = 29/3', 'x = 22/3', 'x = -5'],
      correctIndex: 0,
    },
    {
      id: 'math-2',
      grade: 9,
      topic: 'Algebra',
      prompt: 'Solve for x: 2(x - 4) = 10',
      options: ['x = 9', 'x = 7', 'x = 3', 'x = 18'],
      correctIndex: 0,
    },
    {
      id: 'math-3',
      grade: 10,
      topic: 'Quadratics',
      prompt: 'Solve: x² - 5x + 6 = 0',
      options: ['x = 2 or x = 3', 'x = -2 or x = -3', 'x = 1 or x = 6', 'x = 5 or x = 6'],
      correctIndex: 0,
    },
    {
      id: 'math-4',
      grade: 10,
      topic: 'Quadratics',
      prompt: 'What are the roots of x² - 9 = 0?',
      options: ['x = 3 or x = -3', 'x = 9 or x = -9', 'x = 3 only', 'x = 81'],
      correctIndex: 0,
    },
    {
      id: 'math-5',
      grade: 11,
      topic: 'Trigonometry',
      prompt: 'In a right triangle, the side opposite θ is 3 and the hypotenuse is 5. What is sin(θ)?',
      options: ['3/5', '5/3', '4/5', '3/4'],
      correctIndex: 0,
    },
  ],
  science: [
    {
      id: 'science-1',
      grade: 9,
      topic: 'Biology',
      prompt: 'Which organelle is known as the "powerhouse of the cell"?',
      options: ['Mitochondria', 'Nucleus', 'Ribosome', 'Golgi apparatus'],
      correctIndex: 0,
    },
    {
      id: 'science-2',
      grade: 9,
      topic: 'Biology',
      prompt: 'During photosynthesis, plants release which gas as a byproduct?',
      options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
      correctIndex: 0,
    },
    {
      id: 'science-3',
      grade: 10,
      topic: 'Chemistry',
      prompt: 'What is the chemical symbol for sodium?',
      options: ['Na', 'So', 'S', 'Sd'],
      correctIndex: 0,
    },
    {
      id: 'science-4',
      grade: 10,
      topic: 'Chemistry',
      prompt: 'What is the pH of a neutral solution at 25°C?',
      options: ['7', '0', '14', '1'],
      correctIndex: 0,
    },
    {
      id: 'science-5',
      grade: 11,
      topic: 'Physics',
      prompt: 'What is the SI unit of force?',
      options: ['Newton', 'Joule', 'Watt', 'Pascal'],
      correctIndex: 0,
    },
  ],
  geography: [
    {
      id: 'geography-1',
      grade: 9,
      topic: 'Canada',
      prompt: 'What is the capital city of Canada?',
      options: ['Ottawa', 'Toronto', 'Vancouver', 'Montreal'],
      correctIndex: 0,
    },
    {
      id: 'geography-2',
      grade: 9,
      topic: 'Canada',
      prompt: 'Which is the largest province in Canada by area?',
      options: ['Quebec', 'Ontario', 'British Columbia', 'Alberta'],
      correctIndex: 0,
    },
    {
      id: 'geography-3',
      grade: 10,
      topic: 'World Geography',
      prompt: 'Which is the longest river in the world?',
      options: ['The Nile', 'The Amazon', 'The Mississippi', 'The Yangtze'],
      correctIndex: 0,
    },
    {
      id: 'geography-4',
      grade: 10,
      topic: 'World Geography',
      prompt: 'Which continent is the Sahara Desert located on?',
      options: ['Africa', 'Asia', 'Australia', 'South America'],
      correctIndex: 0,
    },
    {
      id: 'geography-5',
      grade: 11,
      topic: 'Maps',
      prompt: 'On a topographic map, what do contour lines represent?',
      options: ['Points of equal elevation', 'Temperature zones', 'Political borders', 'Population density'],
      correctIndex: 0,
    },
  ],
  history: [
    {
      id: 'history-1',
      grade: 9,
      topic: 'Canadian History',
      prompt: 'In what year did Canada become a country through Confederation?',
      options: ['1867', '1776', '1812', '1901'],
      correctIndex: 0,
    },
    {
      id: 'history-2',
      grade: 10,
      topic: 'Canadian History',
      prompt: 'Which document created the Dominion of Canada?',
      options: ['The British North America Act', 'The Treaty of Paris', 'The Magna Carta', 'The Statute of Westminster'],
      correctIndex: 0,
    },
    {
      id: 'history-3',
      grade: 10,
      topic: 'Canadian History',
      prompt: 'The War of 1812 was fought between the United States and which other power?',
      options: ['Britain', 'France', 'Spain', 'Mexico'],
      correctIndex: 0,
    },
    {
      id: 'history-4',
      grade: 11,
      topic: 'World History',
      prompt: 'World War I began in which year?',
      options: ['1914', '1918', '1939', '1904'],
      correctIndex: 0,
    },
    {
      id: 'history-5',
      grade: 11,
      topic: 'World History',
      prompt: 'The French Revolution began in which year?',
      options: ['1789', '1776', '1804', '1917'],
      correctIndex: 0,
    },
  ],
  english: [
    {
      id: 'english-1',
      grade: 9,
      topic: 'Grammar',
      prompt: "Which sentence uses 'they're', 'their', and 'there' correctly?",
      options: [
        "They're going over there to check on their house.",
        "Their going over they're to check on there house.",
        "There going over their to check on they're house.",
        "Their going over there to check on they're house.",
      ],
      correctIndex: 0,
    },
    {
      id: 'english-2',
      grade: 9,
      topic: 'Grammar',
      prompt: 'Which sentence is punctuated correctly?',
      options: [
        "It's raining, so bring your umbrella.",
        "Its raining, so bring you're umbrella.",
        "Its raining, so bring your umbrella.",
        "It's raining, so bring you're umbrella.",
      ],
      correctIndex: 0,
    },
    {
      id: 'english-3',
      grade: 9,
      topic: 'Literature',
      prompt: "Who wrote 'Romeo and Juliet'?",
      options: ['William Shakespeare', 'Charles Dickens', 'Mark Twain', 'Jane Austen'],
      correctIndex: 0,
    },
    {
      id: 'english-4',
      grade: 10,
      topic: 'Literature',
      prompt: "In George Orwell's '1984', what is the name of the totalitarian leader?",
      options: ['Big Brother', 'Big Father', 'The Supreme Leader', 'Napoleon'],
      correctIndex: 0,
    },
    {
      id: 'english-5',
      grade: 11,
      topic: 'Writing',
      prompt: 'Which of the following is a run-on sentence?',
      options: [
        'I went to the store I bought some milk.',
        'I went to the store, and I bought some milk.',
        'I went to the store; I bought some milk.',
        'I went to the store. I bought some milk.',
      ],
      correctIndex: 0,
    },
  ],
  french: [
    {
      id: 'french-1',
      grade: 9,
      topic: 'Vocabulary',
      prompt: "What does 'bibliothèque' mean in English?",
      options: ['Library', 'Bookstore', 'Bakery', 'School'],
      correctIndex: 0,
    },
    {
      id: 'french-2',
      grade: 9,
      topic: 'Vocabulary',
      prompt: "What is 'pomme de terre' in English?",
      options: ['Potato', 'Apple', 'Tomato', 'Ground apple'],
      correctIndex: 0,
    },
    {
      id: 'french-3',
      grade: 10,
      topic: 'Grammar',
      prompt: "Choose the correct article: '___ pomme' (a feminine noun).",
      options: ['une', 'un', 'le', 'les'],
      correctIndex: 0,
    },
    {
      id: 'french-4',
      grade: 10,
      topic: 'Conjugation',
      prompt: "Conjugate 'être' (to be) for 'nous':",
      options: ['sommes', 'êtes', 'sont', 'es'],
      correctIndex: 0,
    },
    {
      id: 'french-5',
      grade: 11,
      topic: 'Conjugation',
      prompt: "What is the correct 'je' form of 'aller' (to go) in the present tense?",
      options: ['vais', 'va', 'allons', 'ailles'],
      correctIndex: 0,
    },
  ],
}

// Days-since-epoch keeps rotation stable and deterministic per day, independent of year.
function daysSinceEpoch(date) {
  return Math.floor(date.getTime() / 86400000)
}

export function getDailyQuestion(subjectId, date = new Date()) {
  const list = QUESTIONS_BY_SUBJECT[subjectId]
  if (!list) return null
  const index = daysSinceEpoch(date) % list.length
  return list[index]
}

// Answers loaded back from Supabase only store subject + question text, so
// history detail views look up the full question (options, correct answer)
// by matching the prompt against the static bank.
export function findQuestionByPrompt(subjectId, prompt) {
  const list = QUESTIONS_BY_SUBJECT[subjectId]
  if (!list) return null
  return list.find((q) => q.prompt === prompt) || null
}
