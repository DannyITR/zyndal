// 6 subjects × 5 hardcoded multiple-choice questions per grade (grades 7-11).
// Wrong options are modeled on common student mistakes, not random noise.
// Grade range currently 7-11. Elementary grades (1-6) planned for future release.

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

// Placeholder "classes" until the real schools/classes feature (auto-grouped,
// teacher-claimed) ships — one per default subject, 1:1 with a SUBJECTS entry
// for now. Swap the data source here (not the grid UI) once real per-student
// class enrollment exists. Not related to the classes/class_students tables
// behind the existing "Classes" nav button (ClassesFlow.jsx) — that's a
// separate teacher-roster/homework-assignment feature.
export function getPlaceholderClasses() {
  return SUBJECTS.map((s) => ({ id: s.id, subjectId: s.id, name: s.name, icon: s.icon, color: s.color }))
}

// The single subject shown on the home screen each day, same for every
// student — cycles through all 6 on a 6-day rotation so each gets equal
// coverage. Order is a product spec (not SUBJECTS' own array order) and the
// day-index math matches the existing daysSinceEpoch pattern used elsewhere
// in this file and in getTodaysGuideSubject (src/lib/ai.js), so all three
// stay in step with each other. Takes a 'YYYY-MM-DD' string (not a Date) to
// match how selectedDate/date are already passed around the app; noon UTC
// keeps this on the correct calendar day the same way getDailyQuestion does
// for past dates.
const DAILY_ROTATION_ORDER = ['math', 'science', 'history', 'geography', 'english', 'french']

export function getTodaysSubjectId(dateStr) {
  const date = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date()
  const daysSinceEpoch = Math.floor(date.getTime() / 86400000)
  return DAILY_ROTATION_ORDER[daysSinceEpoch % DAILY_ROTATION_ORDER.length]
}

export function getTodaysSubject(dateStr) {
  return getSubject(getTodaysSubjectId(dateStr))
}

// The app's internal `grade` field (stored on users, questions, study plans,
// etc.) always uses the North American grade number (7-11) — that's the
// number the question bank and every other table is keyed by, and it must
// stay that way. Quebec students don't call it that, though: their school
// system runs Secondary 1-5, not grades 7-11, so anywhere that number is
// shown to a student or sent to Claude as "Secondary X", it needs this
// conversion first (Secondary 1=grade 7, 2=8, 3=9, 4=10, 5=11).
export function gradeToSecondary(grade) {
  return grade - 6
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
      options: ['x = 7', 'x = 9', 'x = 3', 'x = 18'],
      correctIndex: 1,
    },
    {
      id: 'math-3',
      grade: 10,
      topic: 'Quadratics',
      prompt: 'Solve: x² - 5x + 6 = 0',
      options: ['x = -2 or x = -3', 'x = 1 or x = 6', 'x = 2 or x = 3', 'x = 5 or x = 6'],
      correctIndex: 2,
    },
    {
      id: 'math-4',
      grade: 10,
      topic: 'Quadratics',
      prompt: 'What are the roots of x² - 9 = 0?',
      options: ['x = 9 or x = -9', 'x = 3 only', 'x = 81', 'x = 3 or x = -3'],
      correctIndex: 3,
    },
    {
      id: 'math-5',
      grade: 11,
      topic: 'Trigonometry',
      prompt: 'In a right triangle, the side opposite θ is 3 and the hypotenuse is 5. What is sin(θ)?',
      options: ['3/5', '5/3', '4/5', '3/4'],
      correctIndex: 0,
    },
    {
      id: 'math-6',
      grade: 7,
      topic: 'Fractions',
      prompt: 'What is 3/4 + 1/8?',
      options: ['4/12', '7/8', '1/2', '4/8'],
      correctIndex: 1,
    },
    {
      id: 'math-7',
      grade: 7,
      topic: 'Decimals',
      prompt: 'What is 0.6 + 0.25?',
      options: ['0.85', '0.31', '0.9', '0.65'],
      correctIndex: 0,
    },
    {
      id: 'math-8',
      grade: 7,
      topic: 'Percentages',
      prompt: 'What is 25% of 80?',
      options: ['20', '25', '55', '40'],
      correctIndex: 0,
    },
    {
      id: 'math-9',
      grade: 7,
      topic: 'Geometry',
      prompt: 'What is the sum of the interior angles of a triangle?',
      options: ['180°', '360°', '90°', '270°'],
      correctIndex: 0,
    },
    {
      id: 'math-10',
      grade: 7,
      topic: 'Integers',
      prompt: 'What is -8 + 3?',
      options: ['-5', '-11', '5', '11'],
      correctIndex: 0,
    },
    {
      id: 'math-11',
      grade: 8,
      topic: 'Algebra',
      prompt: 'Solve for x: x + 5 = 12',
      options: ['7', '17', '-7', '60'],
      correctIndex: 0,
    },
    {
      id: 'math-12',
      grade: 8,
      topic: 'Algebra',
      prompt: 'Simplify: 4x + 2x',
      options: ['6x', '8x', '6x²', '2x'],
      correctIndex: 0,
    },
    {
      id: 'math-13',
      grade: 8,
      topic: 'Ratios and Proportions',
      prompt: 'The ratio of boys to girls in a class is 3:2. If there are 15 boys, how many girls are there?',
      options: ['10', '12', '9', '20'],
      correctIndex: 0,
    },
    {
      id: 'math-14',
      grade: 8,
      topic: 'Pythagorean Theorem',
      prompt: 'A right triangle has legs of length 3 and 4. What is the length of the hypotenuse?',
      options: ['5', '7', '6', '12'],
      correctIndex: 0,
    },
    {
      id: 'math-15',
      grade: 8,
      topic: 'Statistics',
      prompt: 'What is the mean of these numbers: 4, 8, 6, 2?',
      options: ['5', '6', '4', '20'],
      correctIndex: 0,
    },
  ],
  science: [
    {
      id: 'science-1',
      grade: 9,
      topic: 'Biology',
      prompt: 'Which organelle is known as the "powerhouse of the cell"?',
      options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
      correctIndex: 1,
    },
    {
      id: 'science-2',
      grade: 9,
      topic: 'Biology',
      prompt: 'During photosynthesis, plants release which gas as a byproduct?',
      options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'],
      correctIndex: 2,
    },
    {
      id: 'science-3',
      grade: 10,
      topic: 'Chemistry',
      prompt: 'What is the chemical symbol for sodium?',
      options: ['So', 'S', 'Sd', 'Na'],
      correctIndex: 3,
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
      options: ['Joule', 'Newton', 'Watt', 'Pascal'],
      correctIndex: 1,
    },
    {
      id: 'science-6',
      grade: 7,
      topic: 'Cells',
      prompt: 'What is the basic unit of life called?',
      options: ['Atom', 'Cell', 'Molecule', 'Tissue'],
      correctIndex: 1,
    },
    {
      id: 'science-7',
      grade: 7,
      topic: 'Cells',
      prompt: "Which part of the cell controls its activities?",
      options: ['Nucleus', 'Cell wall', 'Cytoplasm', 'Vacuole'],
      correctIndex: 0,
    },
    {
      id: 'science-8',
      grade: 7,
      topic: 'Ecosystems',
      prompt: 'In a food chain, what do we call an organism that makes its own food?',
      options: ['Consumer', 'Producer', 'Decomposer', 'Predator'],
      correctIndex: 1,
    },
    {
      id: 'science-9',
      grade: 7,
      topic: 'Ecosystems',
      prompt: 'What role do decomposers play in an ecosystem?',
      options: [
        'They break down dead matter and recycle nutrients',
        'They produce oxygen for the ecosystem',
        'They hunt other animals for food',
        'They convert sunlight into energy',
      ],
      correctIndex: 0,
    },
    {
      id: 'science-10',
      grade: 7,
      topic: 'Matter and Energy',
      prompt: 'Which state of matter has a fixed shape and a fixed volume?',
      options: ['Solid', 'Liquid', 'Gas', 'Plasma'],
      correctIndex: 0,
    },
    {
      id: 'science-11',
      grade: 8,
      topic: 'Fluids',
      prompt: "What property of a fluid describes its resistance to flow?",
      options: ['Viscosity', 'Density', 'Buoyancy', 'Pressure'],
      correctIndex: 0,
    },
    {
      id: 'science-12',
      grade: 8,
      topic: 'Fluids',
      prompt: 'What force allows objects to float in a fluid?',
      options: ['Gravity', 'Friction', 'Buoyant force', 'Magnetism'],
      correctIndex: 2,
    },
    {
      id: 'science-13',
      grade: 8,
      topic: 'Optics',
      prompt: 'What happens to light when it passes from air into water?',
      options: ['It refracts (bends)', 'It disappears', 'It speeds up', 'It turns into sound'],
      correctIndex: 0,
    },
    {
      id: 'science-14',
      grade: 8,
      topic: 'Optics',
      prompt: 'What type of lens curves outward and causes light rays to converge?',
      options: ['Convex lens', 'Concave lens', 'Flat lens', 'Prism'],
      correctIndex: 0,
    },
    {
      id: 'science-15',
      grade: 8,
      topic: 'Cells and Systems',
      prompt: 'Which body system is responsible for transporting oxygen and nutrients throughout the body?',
      options: ['The circulatory system', 'The digestive system', 'The nervous system', 'The respiratory system'],
      correctIndex: 0,
    },
  ],
  geography: [
    {
      id: 'geography-1',
      grade: 9,
      topic: 'Canada',
      prompt: 'What is the capital city of Canada?',
      options: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'],
      correctIndex: 2,
    },
    {
      id: 'geography-2',
      grade: 9,
      topic: 'Canada',
      prompt: 'Which is the largest province in Canada by area?',
      options: ['Ontario', 'British Columbia', 'Alberta', 'Quebec'],
      correctIndex: 3,
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
      options: ['Asia', 'Africa', 'Australia', 'South America'],
      correctIndex: 1,
    },
    {
      id: 'geography-5',
      grade: 11,
      topic: 'Maps',
      prompt: 'On a topographic map, what do contour lines represent?',
      options: ['Temperature zones', 'Political borders', 'Points of equal elevation', 'Population density'],
      correctIndex: 2,
    },
    {
      id: 'geography-6',
      grade: 7,
      topic: 'Physical Geography of Canada',
      prompt: "Which mountain range runs along Canada's west coast?",
      options: ['The Rocky Mountains', 'The Appalachian Mountains', 'The Andes', 'The Ural Mountains'],
      correctIndex: 0,
    },
    {
      id: 'geography-7',
      grade: 7,
      topic: 'Physical Geography of Canada',
      prompt: 'What is the largest lake located entirely within Canada?',
      options: ['Lake Superior', 'Great Bear Lake', 'Great Slave Lake', 'Lake Winnipeg'],
      correctIndex: 1,
    },
    {
      id: 'geography-8',
      grade: 7,
      topic: 'Maps and Coordinates',
      prompt: 'On a map, lines that run east-west and measure distance from the equator are called?',
      options: ['Lines of latitude', 'Lines of longitude', 'The prime meridian', 'Contour lines'],
      correctIndex: 0,
    },
    {
      id: 'geography-9',
      grade: 7,
      topic: 'Maps and Coordinates',
      prompt: 'What imaginary line measures distance east or west from the Prime Meridian?',
      options: ['Latitude', 'Longitude', 'The equator', 'The Tropic of Cancer'],
      correctIndex: 1,
    },
    {
      id: 'geography-10',
      grade: 7,
      topic: 'Physical Geography of Canada',
      prompt: 'What is the Canadian Shield?',
      options: [
        'A large area of ancient rock covering much of central and eastern Canada',
        'A desert region in southern Alberta',
        'The mountain range in British Columbia',
        'The flat farmland of the Prairies',
      ],
      correctIndex: 0,
    },
    {
      id: 'geography-11',
      grade: 8,
      topic: 'Global Geography',
      prompt: 'Which is the largest ocean on Earth?',
      options: ['The Pacific Ocean', 'The Atlantic Ocean', 'The Indian Ocean', 'The Arctic Ocean'],
      correctIndex: 0,
    },
    {
      id: 'geography-12',
      grade: 8,
      topic: 'Climate Zones',
      prompt: 'Which climate zone is found near the equator and is known for heavy rainfall and high heat?',
      options: ['Tropical', 'Arctic', 'Temperate', 'Arid'],
      correctIndex: 0,
    },
    {
      id: 'geography-13',
      grade: 8,
      topic: 'Human Geography',
      prompt: 'What term describes the study of how humans interact with and are distributed across the Earth?',
      options: ['Human geography', 'Physical geography', 'Meteorology', 'Geology'],
      correctIndex: 0,
    },
    {
      id: 'geography-14',
      grade: 8,
      topic: 'Human Geography',
      prompt: 'What is urbanization?',
      options: [
        'The growth of cities as populations shift from rural to urban areas',
        'The process of building new farmland',
        'The melting of polar ice',
        'The movement of tectonic plates',
      ],
      correctIndex: 0,
    },
    {
      id: 'geography-15',
      grade: 8,
      topic: 'Climate Zones',
      prompt: 'Which climate zone is characterized by very low precipitation and extreme temperature swings between day and night?',
      options: ['Desert (arid)', 'Tropical', 'Tundra', 'Mediterranean'],
      correctIndex: 0,
    },
  ],
  history: [
    {
      id: 'history-1',
      grade: 9,
      topic: 'Canadian History',
      prompt: 'In what year did Canada become a country through Confederation?',
      options: ['1776', '1812', '1901', '1867'],
      correctIndex: 3,
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
      options: ['France', 'Britain', 'Spain', 'Mexico'],
      correctIndex: 1,
    },
    {
      id: 'history-4',
      grade: 11,
      topic: 'World History',
      prompt: 'World War I began in which year?',
      options: ['1918', '1939', '1914', '1904'],
      correctIndex: 2,
    },
    {
      id: 'history-5',
      grade: 11,
      topic: 'World History',
      prompt: 'The French Revolution began in which year?',
      options: ['1776', '1804', '1917', '1789'],
      correctIndex: 3,
    },
    {
      id: 'history-6',
      grade: 7,
      topic: 'New France',
      prompt: 'Which French explorer founded Quebec City in 1608?',
      options: ['Jacques Cartier', 'Samuel de Champlain', 'Louis Jolliet', 'Étienne Brûlé'],
      correctIndex: 1,
    },
    {
      id: 'history-7',
      grade: 7,
      topic: 'New France',
      prompt: "What was the name of the French colony in North America that included present-day Quebec?",
      options: ['New France', 'New England', 'Acadia', 'Louisiana'],
      correctIndex: 0,
    },
    {
      id: 'history-8',
      grade: 7,
      topic: 'New France',
      prompt: 'What was the main economic activity that drove the growth of New France?',
      options: ['The fur trade', 'Gold mining', 'Sugar plantations', 'Textile manufacturing'],
      correctIndex: 0,
    },
    {
      id: 'history-9',
      grade: 7,
      topic: 'Early Canadian History',
      prompt: 'In what year did Jacques Cartier first sail up the St. Lawrence River?',
      options: ['1534', '1608', '1667', '1763'],
      correctIndex: 0,
    },
    {
      id: 'history-10',
      grade: 7,
      topic: 'Early Canadian History',
      prompt: "Which war ended with France ceding New France to Britain?",
      options: ["The Seven Years' War", 'The War of 1812', 'The American Revolution', 'The Hundred Years War'],
      correctIndex: 0,
    },
    {
      id: 'history-11',
      grade: 8,
      topic: 'Colonial Canada',
      prompt: 'What was the Royal Proclamation of 1763?',
      options: [
        'A document establishing British rule over former New France and Indigenous relations',
        'A declaration of war against the United States',
        'The document that created Confederation',
        'A treaty ending the War of 1812',
      ],
      correctIndex: 0,
    },
    {
      id: 'history-12',
      grade: 8,
      topic: 'Colonial Canada',
      prompt: 'What was the Act of Union (1840) intended to do?',
      options: [
        'Unite Upper and Lower Canada into a single province',
        'Give Canada full independence from Britain',
        'Create the province of Quebec',
        'End the fur trade',
      ],
      correctIndex: 0,
    },
    {
      id: 'history-13',
      grade: 8,
      topic: 'Confederation',
      prompt: 'In what year did Canadian Confederation take place?',
      options: ['1867', '1812', '1901', '1776'],
      correctIndex: 0,
    },
    {
      id: 'history-14',
      grade: 8,
      topic: 'Confederation',
      prompt: 'Besides Ontario and Quebec, which two colonies joined Confederation in 1867?',
      options: ['Nova Scotia and New Brunswick', 'British Columbia and Manitoba', 'Prince Edward Island and Newfoundland', 'Alberta and Saskatchewan'],
      correctIndex: 0,
    },
    {
      id: 'history-15',
      grade: 8,
      topic: 'Confederation',
      prompt: "Who is often called a 'Father of Confederation' and became Canada's first Prime Minister?",
      options: ['Sir John A. Macdonald', 'Wilfrid Laurier', 'George-Étienne Cartier', 'Louis Riel'],
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
        "Its raining, so bring you're umbrella.",
        "It's raining, so bring your umbrella.",
        "Its raining, so bring your umbrella.",
        "It's raining, so bring you're umbrella.",
      ],
      correctIndex: 1,
    },
    {
      id: 'english-3',
      grade: 9,
      topic: 'Literature',
      prompt: "Who wrote 'Romeo and Juliet'?",
      options: ['Charles Dickens', 'Mark Twain', 'William Shakespeare', 'Jane Austen'],
      correctIndex: 2,
    },
    {
      id: 'english-4',
      grade: 10,
      topic: 'Literature',
      prompt: "In George Orwell's '1984', what is the name of the totalitarian leader?",
      options: ['Big Father', 'The Supreme Leader', 'Napoleon', 'Big Brother'],
      correctIndex: 3,
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
    {
      id: 'english-6',
      grade: 7,
      topic: 'Grammar',
      prompt: "Which word in this sentence is the verb? 'The dog ran quickly across the yard.'",
      options: ['Dog', 'Ran', 'Quickly', 'Yard'],
      correctIndex: 1,
    },
    {
      id: 'english-7',
      grade: 7,
      topic: 'Grammar',
      prompt: 'Which sentence is a complete sentence?',
      options: ['Running through the park.', 'The bright blue sky.', 'She finished her homework.', 'Because it was raining.'],
      correctIndex: 2,
    },
    {
      id: 'english-8',
      grade: 7,
      topic: 'Reading Comprehension',
      prompt: 'The main idea of a paragraph is usually found in the:',
      options: ['Topic sentence', 'Last word', 'Footnote', 'Title only'],
      correctIndex: 0,
    },
    {
      id: 'english-9',
      grade: 7,
      topic: 'Grammar',
      prompt: "Which word is a noun in this sentence? 'The happy children played outside.'",
      options: ['Happy', 'Children', 'Played', 'Outside'],
      correctIndex: 1,
    },
    {
      id: 'english-10',
      grade: 7,
      topic: 'Writing Basics',
      prompt: 'What is the purpose of an introduction in a piece of writing?',
      options: [
        "To introduce the topic and grab the reader's attention",
        'To list every source used',
        'To summarize the ending',
        'To provide a bibliography',
      ],
      correctIndex: 0,
    },
    {
      id: 'english-11',
      grade: 8,
      topic: 'Literary Devices',
      prompt: "What literary device compares two unlike things using 'like' or 'as'?",
      options: ['Simile', 'Metaphor', 'Hyperbole', 'Onomatopoeia'],
      correctIndex: 0,
    },
    {
      id: 'english-12',
      grade: 8,
      topic: 'Literary Devices',
      prompt: 'What is a metaphor?',
      options: [
        'A direct comparison between two unlike things without using "like" or "as"',
        'A comparison using "like" or "as"',
        'An exaggeration for effect',
        'A word that imitates a sound',
      ],
      correctIndex: 0,
    },
    {
      id: 'english-13',
      grade: 8,
      topic: 'Essay Writing',
      prompt: 'What is the purpose of a conclusion in an essay?',
      options: [
        'To summarize the main points and restate the thesis',
        'To introduce a brand new argument',
        'To list the bibliography',
        'To ask the reader a question and leave it unanswered',
      ],
      correctIndex: 0,
    },
    {
      id: 'english-14',
      grade: 8,
      topic: 'Parts of Speech',
      prompt: 'Which part of speech describes or modifies a noun?',
      options: ['Adjective', 'Verb', 'Adverb', 'Preposition'],
      correctIndex: 0,
    },
    {
      id: 'english-15',
      grade: 8,
      topic: 'Parts of Speech',
      prompt: 'Which part of speech modifies a verb, adjective, or another adverb?',
      options: ['Adverb', 'Noun', 'Pronoun', 'Conjunction'],
      correctIndex: 0,
    },
  ],
  french: [
    {
      id: 'french-1',
      grade: 9,
      topic: 'Vocabulary',
      prompt: "What does 'bibliothèque' mean in English?",
      options: ['Bookstore', 'Library', 'Bakery', 'School'],
      correctIndex: 1,
    },
    {
      id: 'french-2',
      grade: 9,
      topic: 'Vocabulary',
      prompt: "What is 'pomme de terre' in English?",
      options: ['Apple', 'Tomato', 'Potato', 'Ground apple'],
      correctIndex: 2,
    },
    {
      id: 'french-3',
      grade: 10,
      topic: 'Grammar',
      prompt: "Choose the correct article: '___ pomme' (a feminine noun).",
      options: ['un', 'le', 'les', 'une'],
      correctIndex: 3,
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
      options: ['va', 'vais', 'allons', 'ailles'],
      correctIndex: 1,
    },
    {
      id: 'french-6',
      grade: 7,
      topic: 'Vocabulary',
      prompt: "What does 'le chien' mean in English?",
      options: ['The cat', 'The dog', 'The bird', 'The fish'],
      correctIndex: 1,
    },
    {
      id: 'french-7',
      grade: 7,
      topic: 'Vocabulary',
      prompt: "How do you say 'thank you' in French?",
      options: ["S'il vous plaît", 'Merci', 'Bonjour', 'Pardon'],
      correctIndex: 1,
    },
    {
      id: 'french-8',
      grade: 7,
      topic: 'Present Tense Verbs',
      prompt: "Conjugate 'parler' (to speak) for 'je': Je ___ français.",
      options: ['parle', 'parles', 'parlons', 'parlez'],
      correctIndex: 0,
    },
    {
      id: 'french-9',
      grade: 7,
      topic: 'Simple Sentences',
      prompt: "Which sentence correctly says 'I am happy' in French?",
      options: ['Je suis content', 'Je es content', 'Je as content', 'Je être content'],
      correctIndex: 0,
    },
    {
      id: 'french-10',
      grade: 7,
      topic: 'Vocabulary',
      prompt: "What is 'l'école' in English?",
      options: ['The store', 'The school', 'The hospital', 'The park'],
      correctIndex: 1,
    },
    {
      id: 'french-11',
      grade: 8,
      topic: 'Past Tense',
      prompt: "Which sentence correctly uses the passé composé of 'manger' (to eat)?",
      options: ["J'ai mangé", 'Je mange', 'J\'ai manger', 'Je mangeais'],
      correctIndex: 0,
    },
    {
      id: 'french-12',
      grade: 8,
      topic: 'Adjectives',
      prompt: "What is the correct feminine form of the adjective 'petit' (small)?",
      options: ['Petite', 'Petit', 'Petits', 'Petites'],
      correctIndex: 0,
    },
    {
      id: 'french-13',
      grade: 8,
      topic: 'Past Tense',
      prompt: "Which auxiliary verb does 'manger' use to form the passé composé?",
      options: ['Avoir', 'Être', 'Aller', 'Faire'],
      correctIndex: 0,
    },
    {
      id: 'french-14',
      grade: 8,
      topic: 'Reading Comprehension',
      prompt: "In the sentence 'Elle a visité le musée hier', what does 'hier' mean?",
      options: ['Yesterday', 'Today', 'Tomorrow', 'Now'],
      correctIndex: 0,
    },
    {
      id: 'french-15',
      grade: 8,
      topic: 'Reading Comprehension',
      prompt: "What is the correct plural form of 'le livre' (the book)?",
      options: ['Les livres', 'Le livres', 'Les livre', 'La livres'],
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

// Grade-filtered rotation — used by resolveDailyQuestion (api/_lib/
// dailyQuestion.js) as the hardcoded fallback so a student only ever sees
// questions tagged for their own grade. Falls back to the full unfiltered
// list only if literally zero questions exist for that exact grade, so this
// can never return null for a valid subjectId. Grades 9-11 currently have
// only 2 hardcoded questions each per subject (vs 5 for grades 7-8), so the
// rotation for those grades alternates between just 2 questions until a
// generated pool exists for them — a data-volume limitation, not a bug.
export function getDailyQuestionForGrade(subjectId, grade, date = new Date()) {
  const list = QUESTIONS_BY_SUBJECT[subjectId]
  if (!list) return null
  const gradeList = list.filter((q) => q.grade === grade)
  const effectiveList = gradeList.length > 0 ? gradeList : list
  const index = daysSinceEpoch(date) % effectiveList.length
  return effectiveList[index]
}

// The subtitle shown below the subject name on the daily question screen.
// Describes the question actually shown, not the seasonal schedule's
// aspirational target — a generated-pool question carries its own real
// unit/topic tags, but a hardcoded-fallback question's unit/topic have no
// relation to whatever unit the schedule currently points at, so showing
// the rich label over it would be misleading.
export function formatQuestionSubtitle(question) {
  if (question.source === 'generated') {
    return `Grade ${question.grade} • Unit ${question.unitNumber}: ${question.unitTitle} • ${question.topicTitle}`
  }
  return `Grade ${question.grade} • ${question.topic}`
}

// Answers loaded back from Supabase only store subject + question text, so
// history detail views look up the full question (options, correct answer)
// by matching the prompt against the static bank.
export function findQuestionByPrompt(subjectId, prompt) {
  const list = QUESTIONS_BY_SUBJECT[subjectId]
  if (!list) return null
  return list.find((q) => q.prompt === prompt) || null
}
