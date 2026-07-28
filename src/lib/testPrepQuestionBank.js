// ⚠️ TEMPORARY TESTING DATA — hardcoded question bank standing in for live
// Claude API generation in the Test Prep and Study Guide features. See
// DEMO_MODE in ai.js. Swap the AI calls back on and this file becomes unused
// (safe to delete or keep as a fallback).
//
// 5 questions per subject per grade (7, 8, 9, 10, 11) = 150 total. Wrong
// options are modeled on common student mistakes, not random noise, matching
// the style of the AI-generated questions this replaces.
// Grade range currently 7-11. Elementary grades (1-6) planned for future release.

import { getSubject } from './questions.js'

const TEST_PREP_QUESTION_BANK = {
  math: {
    7: [
      {
        topic: 'Fractions',
        difficulty: 'easy',
        question: 'What is 2/3 + 1/6?',
        options: ['1/2', '5/6', '3/9', '1/3'],
        correct: 1,
        explanation: 'Convert 2/3 to 4/6, then add 1/6 to get 5/6.',
      },
      {
        topic: 'Decimals',
        difficulty: 'easy',
        question: 'What is 1.75 - 0.5?',
        options: ['1.25', '1.7', '2.25', '1.5'],
        correct: 0,
        explanation: 'Subtracting 0.5 from 1.75 gives 1.25.',
      },
      {
        topic: 'Percentages',
        difficulty: 'medium',
        question: 'What is 40% of 60?',
        options: ['24', '40', '20', '16'],
        correct: 0,
        explanation: '40% of 60 = 0.4 × 60 = 24.',
      },
      {
        topic: 'Basic Geometry',
        difficulty: 'easy',
        question: 'What is the perimeter of a rectangle with length 8 cm and width 3 cm?',
        options: ['22 cm', '24 cm', '11 cm', '19 cm'],
        correct: 0,
        explanation: 'Perimeter = 2(length + width) = 2(8 + 3) = 22 cm.',
      },
      {
        topic: 'Integers',
        difficulty: 'medium',
        question: 'What is (-4) × (-3)?',
        options: ['12', '-12', '-7', '7'],
        correct: 0,
        explanation: 'Multiplying two negative integers gives a positive result: (-4) × (-3) = 12.',
      },
    ],
    8: [
      {
        topic: 'Algebra',
        difficulty: 'easy',
        question: 'Solve for x: 2x + 3 = 11',
        options: ['4', '7', '5.5', '8'],
        correct: 0,
        explanation: 'Subtract 3 from both sides to get 2x = 8, then divide by 2 to get x = 4.',
      },
      {
        topic: 'Algebra',
        difficulty: 'medium',
        question: 'Simplify: 5x - 2x + 3',
        options: ['3x + 3', '7x + 3', '3x - 3', '2x + 3'],
        correct: 0,
        explanation: 'Combine like terms: 5x - 2x = 3x, so the expression simplifies to 3x + 3.',
      },
      {
        topic: 'Ratios and Proportions',
        difficulty: 'medium',
        question: 'If 4 pencils cost $2, how much do 10 pencils cost?',
        options: ['$5', '$4', '$8', '$2.50'],
        correct: 0,
        explanation: 'The ratio is $0.50 per pencil, so 10 pencils cost 10 × $0.50 = $5.',
      },
      {
        topic: 'Pythagorean Theorem',
        difficulty: 'medium',
        question: 'A right triangle has legs of 6 and 8. What is the length of the hypotenuse?',
        options: ['10', '14', '48', '7'],
        correct: 0,
        explanation: 'Using a² + b² = c²: 6² + 8² = 36 + 64 = 100, so c = √100 = 10.',
      },
      {
        topic: 'Statistics',
        difficulty: 'medium',
        question: 'What is the median of this data set: 3, 7, 9, 2, 5?',
        options: ['5', '7', '2', '9'],
        correct: 0,
        explanation: 'Ordering the data: 2, 3, 5, 7, 9 — the middle value is 5.',
      },
    ],
    9: [
      {
        topic: 'Algebra',
        difficulty: 'easy',
        question: 'Solve for x: 2x + 5 = 17',
        options: ['11', '3.5', '6', '8.5'],
        correct: 2,
        explanation: 'Subtract 5 from both sides to get 2x = 12, then divide by 2 to get x = 6.',
      },
      {
        topic: 'Algebra',
        difficulty: 'easy',
        question: 'Simplify: 3(x + 4) - 2x',
        options: ['5x + 12', 'x + 4', '3x + 4', 'x + 12'],
        correct: 3,
        explanation: 'Distribute 3 to get 3x + 12, then combine like terms: 3x - 2x = x, giving x + 12.',
      },
      {
        topic: 'Quadratics',
        difficulty: 'easy',
        question: 'What is the value of x² when x = 5?',
        options: ['25', '10', '15', '20'],
        correct: 0,
        explanation: 'x² means x times itself: 5 × 5 = 25.',
      },
      {
        topic: 'Quadratics',
        difficulty: 'medium',
        question: 'Which of these is a quadratic equation?',
        options: ['2x + 4 = 0', 'x² + 3x - 4 = 0', 'x + y = 10', '3x - 5 = 7'],
        correct: 1,
        explanation: 'A quadratic equation contains a term with the variable squared (x²); the others are linear equations.',
      },
      {
        topic: 'Trigonometry',
        difficulty: 'easy',
        question: 'In a right triangle, which side is opposite the right angle?',
        options: ['The adjacent side', 'The opposite side', 'The hypotenuse', 'There is no such side'],
        correct: 2,
        explanation: 'The hypotenuse is always the longest side and is located opposite the 90° angle.',
      },
    ],
    10: [
      {
        topic: 'Algebra',
        difficulty: 'easy',
        question: 'Solve for x: 3x - 7 = 2x + 5',
        options: ['2', '-12', '8.5', '12'],
        correct: 3,
        explanation: 'Subtract 2x from both sides to get x - 7 = 5, then add 7 to both sides to get x = 12.',
      },
      {
        topic: 'Algebra',
        difficulty: 'medium',
        question: 'Factor: x² - 9',
        options: ['(x - 3)(x + 3)', '(x - 9)(x + 1)', '(x - 3)²', '(x + 3)²'],
        correct: 0,
        explanation: 'This is a difference of squares: a² - b² = (a - b)(a + b), where a = x and b = 3.',
      },
      {
        topic: 'Quadratics',
        difficulty: 'medium',
        question: 'Use factoring to find the roots of x² - 5x + 6 = 0',
        options: ['x = -2 and x = -3', 'x = 2 and x = 3', 'x = 1 and x = 6', 'x = 5 and x = 6'],
        correct: 1,
        explanation: 'Factoring gives (x - 2)(x - 3) = 0, so the roots are x = 2 and x = 3.',
      },
      {
        topic: 'Quadratics',
        difficulty: 'medium',
        question: 'What is the vertex form of a quadratic function used for?',
        options: [
          'Finding the y-intercept only',
          'Making the equation linear',
          'Identifying the maximum or minimum point of the parabola',
          'Removing the x² term',
        ],
        correct: 2,
        explanation: "Vertex form, y = a(x - h)² + k, directly shows the vertex (h, k), which is the parabola's maximum or minimum point.",
      },
      {
        topic: 'Trigonometry',
        difficulty: 'hard',
        question: 'In a right triangle with a 30° angle, if the hypotenuse is 10, what is the length of the side opposite the 30° angle?',
        options: ['8.7', '10', '3', '5'],
        correct: 3,
        explanation: 'sin(30°) = opposite/hypotenuse = 0.5, so opposite = 0.5 × 10 = 5.',
      },
    ],
    11: [
      {
        topic: 'Algebra',
        difficulty: 'medium',
        question: 'If f(x) = 2x² - 3x + 1, what is f(-2)?',
        options: ['15', '11', '-15', '3'],
        correct: 0,
        explanation: 'Substitute x = -2: 2(-2)² - 3(-2) + 1 = 2(4) + 6 + 1 = 8 + 6 + 1 = 15.',
      },
      {
        topic: 'Algebra',
        difficulty: 'hard',
        question: 'Simplify the rational expression (x² - 4)/(x - 2)',
        options: ['x - 2', 'x + 2', 'x² - 2', '2x - 4'],
        correct: 1,
        explanation: 'Factor the numerator as a difference of squares: (x-2)(x+2)/(x-2) = x + 2 (for x ≠ 2).',
      },
      {
        topic: 'Quadratics',
        difficulty: 'medium',
        question: "A ball's height is modeled by h(t) = -5t² + 20t + 1. At what time does the ball reach its maximum height?",
        options: ['4 seconds', '1 second', '2 seconds', '5 seconds'],
        correct: 2,
        explanation: 'The time of maximum height is at the vertex, t = -b/(2a) = -20/(2 × -5) = 2 seconds.',
      },
      {
        topic: 'Quadratics',
        difficulty: 'hard',
        question: 'What does the discriminant (b² - 4ac) tell you about a quadratic equation?',
        options: [
          'The y-intercept',
          'The axis of symmetry only',
          'The maximum value of the function',
          'The number and type of roots',
        ],
        correct: 3,
        explanation: "If the discriminant is positive there are two real roots, if zero there's one real root, and if negative there are two complex roots.",
      },
      {
        topic: 'Trigonometry',
        difficulty: 'hard',
        question: 'Using the Law of Cosines, find side c if a = 7, b = 9, and angle C = 60°.',
        options: ['≈8.19', '≈9.0', '≈12.6', '≈4.0'],
        correct: 0,
        explanation: 'c² = a² + b² - 2ab·cos(C) = 49 + 81 - 2(7)(9)(0.5) = 130 - 63 = 67, so c = √67 ≈ 8.19.',
      },
    ],
  },

  science: {
    7: [
      {
        topic: 'Cells',
        difficulty: 'easy',
        question: 'What is the basic unit of life?',
        options: ['The atom', 'The cell', 'The organ', 'The tissue'],
        correct: 1,
        explanation: 'The cell is the smallest structural and functional unit of all living organisms.',
      },
      {
        topic: 'Cells',
        difficulty: 'easy',
        question: 'Which part of a plant cell is not found in an animal cell?',
        options: ['Nucleus', 'Cell wall', 'Cytoplasm', 'Mitochondria'],
        correct: 1,
        explanation: 'Plant cells have a rigid cell wall outside the cell membrane, which animal cells lack.',
      },
      {
        topic: 'Ecosystems',
        difficulty: 'medium',
        question: 'What do we call the flow of energy from one organism to another in a food chain?',
        options: ['Photosynthesis', 'Energy transfer', 'Respiration', 'Decomposition'],
        correct: 1,
        explanation: 'Energy passes from producers to consumers as each organism is eaten by the next.',
      },
      {
        topic: 'Ecosystems',
        difficulty: 'easy',
        question: 'Which organism in an ecosystem is classified as a producer?',
        options: ['A rabbit', 'A wolf', 'A plant', 'A mushroom'],
        correct: 2,
        explanation: 'Producers, like plants, make their own food through photosynthesis.',
      },
      {
        topic: 'Matter and Energy',
        difficulty: 'medium',
        question: 'What is the term for a solid changing directly into a gas without becoming a liquid?',
        options: ['Evaporation', 'Condensation', 'Sublimation', 'Freezing'],
        correct: 2,
        explanation: 'Sublimation is the process where a solid changes directly into a gas, skipping the liquid phase.',
      },
    ],
    8: [
      {
        topic: 'Fluids',
        difficulty: 'medium',
        question: "What does Pascal's Law state about pressure in a fluid?",
        options: [
          'Pressure applied to a confined fluid is transmitted equally in all directions',
          'Fluids always flow downhill',
          'Pressure only affects the bottom of a container',
          'Fluids cannot be compressed',
        ],
        correct: 0,
        explanation: "Pascal's Law states that pressure applied to a confined fluid is transmitted equally throughout the fluid in all directions.",
      },
      {
        topic: 'Fluids',
        difficulty: 'easy',
        question: 'What determines whether an object floats or sinks in a fluid?',
        options: ['Its color', 'Its density compared to the fluid', 'Its temperature only', 'Its shape only'],
        correct: 1,
        explanation: 'An object floats if it is less dense than the fluid it is placed in, and sinks if it is denser.',
      },
      {
        topic: 'Optics',
        difficulty: 'easy',
        question: 'What is the term for light bouncing off a surface?',
        options: ['Refraction', 'Reflection', 'Absorption', 'Diffraction'],
        correct: 1,
        explanation: 'Reflection occurs when light bounces off a surface, such as a mirror.',
      },
      {
        topic: 'Optics',
        difficulty: 'medium',
        question: 'Which type of lens is used to correct nearsightedness?',
        options: ['Concave lens', 'Convex lens', 'Flat lens', 'Cylindrical lens'],
        correct: 0,
        explanation: 'A concave (diverging) lens spreads light rays out and is used to correct nearsightedness.',
      },
      {
        topic: 'Cells and Systems',
        difficulty: 'medium',
        question: 'Which organ system works with the circulatory system to deliver oxygen to the blood?',
        options: ['The respiratory system', 'The digestive system', 'The skeletal system', 'The excretory system'],
        correct: 0,
        explanation: 'The respiratory system brings oxygen into the lungs, where it is picked up by the blood and delivered by the circulatory system.',
      },
    ],
    9: [
      {
        topic: 'Biology',
        difficulty: 'easy',
        question: 'What is the basic unit of life?',
        options: ['The atom', 'The cell', 'The organ', 'The tissue'],
        correct: 1,
        explanation: 'The cell is the smallest structural and functional unit of all living organisms.',
      },
      {
        topic: 'Biology',
        difficulty: 'medium',
        question: 'Which organelle is responsible for producing energy in a cell?',
        options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Cell wall'],
        correct: 2,
        explanation: "Mitochondria convert nutrients into ATP, the cell's main energy source, through cellular respiration.",
      },
      {
        topic: 'Chemistry',
        difficulty: 'easy',
        question: 'What is the smallest unit of an element that retains its chemical properties?',
        options: ['A molecule', 'An electron', 'A compound', 'An atom'],
        correct: 3,
        explanation: "An atom is the smallest unit of an element that still has that element's chemical properties.",
      },
      {
        topic: 'Chemistry',
        difficulty: 'easy',
        question: 'What do we call a substance made of two or more different elements chemically bonded together?',
        options: ['A compound', 'A mixture', 'An isotope', 'An ion'],
        correct: 0,
        explanation: 'A compound is formed when two or more elements chemically combine in fixed proportions.',
      },
      {
        topic: 'Physics',
        difficulty: 'easy',
        question: 'What is the unit of force in the International System of Units (SI)?',
        options: ['Joule', 'Newton', 'Watt', 'Pascal'],
        correct: 1,
        explanation: 'Force is measured in newtons (N), named after Isaac Newton, defined as kg·m/s².',
      },
    ],
    10: [
      {
        topic: 'Biology',
        difficulty: 'easy',
        question: 'During photosynthesis, what gas do plants release as a byproduct?',
        options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'],
        correct: 2,
        explanation: 'Plants use carbon dioxide and water with sunlight to produce glucose and release oxygen as a byproduct.',
      },
      {
        topic: 'Biology',
        difficulty: 'medium',
        question: 'What process do cells use to divide and produce two identical daughter cells?',
        options: ['Meiosis', 'Osmosis', 'Diffusion', 'Mitosis'],
        correct: 3,
        explanation: 'Mitosis produces two genetically identical daughter cells, used for growth and repair.',
      },
      {
        topic: 'Chemistry',
        difficulty: 'medium',
        question: 'Balance this equation: __H2 + __O2 → __H2O. What coefficient goes in front of H2O?',
        options: ['2', '1', '3', '4'],
        correct: 0,
        explanation: 'Balancing gives 2H₂ + O₂ → 2H₂O, so 2 water molecules balance the 4 hydrogen and 2 oxygen atoms.',
      },
      {
        topic: 'Chemistry',
        difficulty: 'medium',
        question: 'What type of bond forms when electrons are transferred from one atom to another?',
        options: ['Covalent bond', 'Ionic bond', 'Metallic bond', 'Hydrogen bond'],
        correct: 1,
        explanation: 'An ionic bond forms through the transfer of electrons, creating oppositely charged ions that attract each other.',
      },
      {
        topic: 'Physics',
        difficulty: 'medium',
        question: 'An object accelerates from rest at 4 m/s² for 3 seconds. What is its final velocity?',
        options: ['7 m/s', '4 m/s', '12 m/s', '1.33 m/s'],
        correct: 2,
        explanation: 'Using v = u + at, with u = 0: v = 0 + (4)(3) = 12 m/s.',
      },
    ],
    11: [
      {
        topic: 'Biology',
        difficulty: 'medium',
        question: 'In genetics, what does it mean for an allele to be dominant?',
        options: [
          'It is always more common in a population',
          'It only appears in males',
          'It cannot be inherited',
          'It masks the expression of the recessive allele when present',
        ],
        correct: 3,
        explanation: "A dominant allele's trait is expressed in the phenotype whenever at least one copy is present, masking the recessive allele.",
      },
      {
        topic: 'Biology',
        difficulty: 'hard',
        question: 'What is the main function of DNA polymerase during DNA replication?',
        options: [
          'To synthesize new DNA strands by adding complementary nucleotides',
          'To break down old DNA',
          'To transcribe DNA into RNA',
          'To translate RNA into protein',
        ],
        correct: 0,
        explanation: 'DNA polymerase reads the template strand and adds complementary nucleotides to build a new DNA strand.',
      },
      {
        topic: 'Chemistry',
        difficulty: 'easy',
        question: 'What is the pH of a neutral solution at 25°C?',
        options: ['0', '7', '14', '1'],
        correct: 1,
        explanation: 'A neutral solution, like pure water, has a pH of 7 at 25°C — equal concentrations of H⁺ and OH⁻ ions.',
      },
      {
        topic: 'Chemistry',
        difficulty: 'hard',
        question: "According to Le Chatelier's Principle, what happens to equilibrium if you increase the pressure on a gas-phase reaction?",
        options: [
          'It shifts toward the side with more gas moles',
          'It has no effect on equilibrium',
          'It shifts toward the side with fewer gas moles',
          'The reaction stops',
        ],
        correct: 2,
        explanation: 'Increasing pressure shifts equilibrium toward the side with fewer moles of gas, reducing the total volume.',
      },
      {
        topic: 'Physics',
        difficulty: 'medium',
        question: 'A 2 kg object experiences a net force of 10 N. What is its acceleration?',
        options: ['20 m/s²', '0.2 m/s²', '12 m/s²', '5 m/s²'],
        correct: 3,
        explanation: "Using Newton's second law, F = ma, so a = F/m = 10/2 = 5 m/s².",
      },
    ],
  },

  history: {
    7: [
      {
        topic: 'New France',
        difficulty: 'easy',
        question: 'Who founded Quebec City in 1608?',
        options: ['Jacques Cartier', 'Samuel de Champlain', 'Louis Jolliet', 'Étienne Brûlé'],
        correct: 1,
        explanation: 'Samuel de Champlain founded Quebec City in 1608, establishing a key settlement in New France.',
      },
      {
        topic: 'New France',
        difficulty: 'medium',
        question: 'What was the primary economic activity in New France?',
        options: ['The fur trade', 'Gold mining', 'Cotton farming', 'Fishing only'],
        correct: 0,
        explanation: 'The fur trade, especially in beaver pelts, was the economic backbone of New France.',
      },
      {
        topic: 'Early Canadian History',
        difficulty: 'easy',
        question: 'In what year did Jacques Cartier first explore the St. Lawrence River?',
        options: ['1534', '1608', '1663', '1763'],
        correct: 0,
        explanation: 'Jacques Cartier explored the St. Lawrence River starting in 1534, claiming the land for France.',
      },
      {
        topic: 'Early Canadian History',
        difficulty: 'medium',
        question: 'Which treaty ended the Seven Years War and transferred New France to Britain?',
        options: ['The Treaty of Paris (1763)', 'The Treaty of Versailles', 'The Treaty of Utrecht', 'The Treaty of Ghent'],
        correct: 0,
        explanation: 'The Treaty of Paris in 1763 formally ended the Seven Years War and ceded New France to Britain.',
      },
      {
        topic: 'New France',
        difficulty: 'medium',
        question: 'What group did French settlers rely on for trading furs and surviving in the new colony?',
        options: ['Indigenous peoples', 'British colonists', 'Spanish explorers', 'Dutch traders'],
        correct: 0,
        explanation: 'French settlers formed alliances and trading relationships with Indigenous peoples, who were essential to the fur trade and survival in the colony.',
      },
    ],
    8: [
      {
        topic: 'Colonial Canada',
        difficulty: 'medium',
        question: 'What did the Constitutional Act of 1791 do?',
        options: ['Divided Quebec into Upper and Lower Canada', 'Created Confederation', 'Ended the fur trade', 'Gave Canada independence'],
        correct: 0,
        explanation: 'The Constitutional Act of 1791 split the Province of Quebec into Upper Canada (mostly English-speaking) and Lower Canada (mostly French-speaking).',
      },
      {
        topic: 'Colonial Canada',
        difficulty: 'medium',
        question: 'What was a major cause of the Rebellions of 1837-1838 in Upper and Lower Canada?',
        options: [
          'Demand for more democratic and responsible government',
          'A war with the United States',
          'A dispute over the fur trade',
          'Religious conflict with France',
        ],
        correct: 0,
        explanation: 'Reformers in both colonies rebelled partly due to frustration with unelected governing councils and a desire for responsible government.',
      },
      {
        topic: 'Confederation',
        difficulty: 'easy',
        question: 'What document created the Dominion of Canada in 1867?',
        options: ['The British North America Act', 'The Treaty of Paris', 'The Magna Carta', 'The Statute of Westminster'],
        correct: 0,
        explanation: 'The British North America Act of 1867 established Canada as a self-governing dominion.',
      },
      {
        topic: 'Confederation',
        difficulty: 'medium',
        question: 'What was one major reason the colonies wanted to unite in Confederation?',
        options: [
          'Shared defense against potential U.S. expansion and economic benefits',
          'To join the United States',
          'To create a monarchy',
          'To end all trade with Britain',
        ],
        correct: 0,
        explanation: 'Concerns about U.S. expansion after the American Civil War, along with economic advantages, pushed the colonies toward uniting.',
      },
      {
        topic: 'Confederation',
        difficulty: 'easy',
        question: 'How many provinces originally joined together at Confederation in 1867?',
        options: ['Four', 'Two', 'Seven', 'Ten'],
        correct: 0,
        explanation: 'Ontario, Quebec, Nova Scotia, and New Brunswick were the four original provinces of Confederation.',
      },
    ],
    9: [
      {
        topic: 'Canadian history',
        difficulty: 'easy',
        question: 'In what year did Canada become a country through Confederation?',
        options: ['1867', '1776', '1812', '1901'],
        correct: 0,
        explanation: 'Canada became a self-governing dominion on July 1, 1867, through the British North America Act.',
      },
      {
        topic: 'Canadian history',
        difficulty: 'medium',
        question: 'Which four provinces originally formed Canada at Confederation?',
        options: [
          'Ontario, Quebec, Manitoba, and British Columbia',
          'Ontario, Quebec, Nova Scotia, and New Brunswick',
          'Quebec, Nova Scotia, Alberta, and Saskatchewan',
          'Ontario, New Brunswick, Manitoba, and PEI',
        ],
        correct: 1,
        explanation: 'The original four provinces of Confederation in 1867 were Ontario, Quebec, Nova Scotia, and New Brunswick.',
      },
      {
        topic: 'World history',
        difficulty: 'medium',
        question: 'What was the main cause of World War I?',
        options: [
          'The invasion of Poland',
          'The bombing of Pearl Harbor',
          'A complex web of alliances triggered by the assassination of Archduke Franz Ferdinand',
          'The fall of the Berlin Wall',
        ],
        correct: 2,
        explanation: 'The assassination of Archduke Franz Ferdinand in 1914 set off a chain reaction among allied nations, leading to WWI.',
      },
      {
        topic: 'World history',
        difficulty: 'easy',
        question: 'Which ancient civilization built the pyramids of Giza?',
        options: ['The Romans', 'The Greeks', 'The Mesopotamians', 'The Ancient Egyptians'],
        correct: 3,
        explanation: 'The pyramids of Giza were built by the Ancient Egyptians as tombs for their pharaohs around 2500 BCE.',
      },
      {
        topic: 'Canadian history',
        difficulty: 'easy',
        question: "Who was Canada's first Prime Minister?",
        options: ['Sir John A. Macdonald', 'Wilfrid Laurier', 'Louis St. Laurent', 'William Lyon Mackenzie King'],
        correct: 0,
        explanation: "Sir John A. Macdonald became Canada's first Prime Minister in 1867 and served as a key architect of Confederation.",
      },
    ],
    10: [
      {
        topic: 'Canadian history',
        difficulty: 'medium',
        question: 'What was the purpose of the Indian Act of 1876?',
        options: [
          'To grant Indigenous peoples full citizenship rights',
          'To regulate and control the lives of Indigenous peoples in Canada',
          'To create Indigenous self-governing territories',
          'To establish new provinces',
        ],
        correct: 1,
        explanation: "The Indian Act gave the federal government broad control over Indigenous peoples' lives, land, and governance.",
      },
      {
        topic: 'Canadian history',
        difficulty: 'medium',
        question: 'What event in 1917 devastated Halifax during World War I?',
        options: [
          'A German naval invasion',
          'A major earthquake',
          'The Halifax Explosion, caused by a ship collision',
          'The sinking of the Titanic',
        ],
        correct: 2,
        explanation: 'In 1917, a collision between two ships in Halifax Harbour caused a massive explosion, killing about 2,000 people.',
      },
      {
        topic: 'World history',
        difficulty: 'medium',
        question: 'What was the primary goal of the Treaty of Versailles?',
        options: [
          'To start World War II',
          'To create the United Nations',
          'To end the Cold War',
          'To formally end WWI and impose terms on Germany',
        ],
        correct: 3,
        explanation: 'Signed in 1919, the Treaty of Versailles ended WWI and imposed harsh reparations and territorial losses on Germany.',
      },
      {
        topic: 'World history',
        difficulty: 'medium',
        question: 'What economic system did the Bolsheviks establish after the 1917 Russian Revolution?',
        options: ['Communism', 'Capitalism', 'Feudalism', 'Democracy'],
        correct: 0,
        explanation: 'The Bolsheviks, led by Lenin, established a communist state based on Marxist principles after overthrowing the tsar.',
      },
      {
        topic: 'Canadian history',
        difficulty: 'hard',
        question: 'What was the significance of the Statute of Westminster (1931)?',
        options: [
          'It ended Canadian Confederation',
          'It gave Canada full legal independence from Britain',
          'It created the Canadian Senate',
          'It abolished the monarchy in Canada',
        ],
        correct: 1,
        explanation: 'The Statute of Westminster granted Canada (and other dominions) legislative independence from the British Parliament.',
      },
    ],
    11: [
      {
        topic: 'Canadian history',
        difficulty: 'hard',
        question: 'What was the October Crisis of 1970?',
        options: [
          'A stock market crash',
          'A referendum on Quebec sovereignty',
          'A political crisis involving FLQ kidnappings that led to the invocation of the War Measures Act',
          'A labor strike in Ontario',
        ],
        correct: 2,
        explanation: 'The FLQ kidnapped British diplomat James Cross and minister Pierre Laporte, prompting Trudeau to invoke the War Measures Act.',
      },
      {
        topic: 'Canadian history',
        difficulty: 'medium',
        question: 'What did the Quiet Revolution (Révolution tranquille) in Quebec during the 1960s primarily involve?',
        options: [
          'A violent uprising against the federal government',
          'The annexation of new territory',
          "Quebec's declaration of independence",
          'Rapid secularization and modernization of Quebec society and government',
        ],
        correct: 3,
        explanation: "The Quiet Revolution saw Quebec's government take control of education and healthcare from the Church and modernize the province.",
      },
      {
        topic: 'World history',
        difficulty: 'medium',
        question: 'What was the primary ideological conflict of the Cold War?',
        options: [
          'Capitalism (led by the US) versus Communism (led by the USSR)',
          'Monarchy versus Democracy',
          'Colonialism versus Independence movements',
          'Fascism versus Communism',
        ],
        correct: 0,
        explanation: 'The Cold War was defined by tension between the capitalist, democratic United States and the communist Soviet Union.',
      },
      {
        topic: 'World history',
        difficulty: 'hard',
        question: "What was the significance of the Berlin Wall's fall in 1989?",
        options: [
          'It marked the start of World War II',
          'It symbolized the end of the Cold War and division of Europe',
          'It was the beginning of the Cold War',
          'It led to the creation of NATO',
        ],
        correct: 1,
        explanation: 'The fall of the Berlin Wall symbolized the collapse of communist control in Eastern Europe and the approaching end of the Cold War.',
      },
      {
        topic: 'Canadian history',
        difficulty: 'hard',
        question: 'What was the outcome of the 1995 Quebec sovereignty referendum?',
        options: [
          'Quebec voted to separate from Canada',
          'The referendum was cancelled',
          'A narrow majority (about 50.6%) voted to remain in Canada',
          'It resulted in a tie requiring a re-vote',
        ],
        correct: 2,
        explanation: "The 1995 referendum was extremely close, with about 50.6% voting 'No' to sovereignty, keeping Quebec in Canada.",
      },
    ],
  },

  geography: {
    7: [
      {
        topic: 'Physical Geography of Canada',
        difficulty: 'easy',
        question: 'What is the longest river in Canada?',
        options: ['The Mackenzie River', 'The Fraser River', 'The St. Lawrence River', 'The Yukon River'],
        correct: 0,
        explanation: 'The Mackenzie River, at about 4,241 km, is the longest river in Canada.',
      },
      {
        topic: 'Physical Geography of Canada',
        difficulty: 'medium',
        question: 'Which large rocky region covers much of central and eastern Canada?',
        options: ['The Canadian Shield', 'The Rocky Mountains', 'The Great Plains', 'The Arctic Archipelago'],
        correct: 0,
        explanation: 'The Canadian Shield is a vast area of ancient rock covering much of central and eastern Canada.',
      },
      {
        topic: 'Maps and Coordinates',
        difficulty: 'easy',
        question: 'What do lines of latitude measure?',
        options: [
          'Distance north or south of the equator',
          'Distance east or west of the Prime Meridian',
          'Elevation above sea level',
          'Time zones only',
        ],
        correct: 0,
        explanation: 'Lines of latitude run east-west and measure distance north or south of the equator.',
      },
      {
        topic: 'Maps and Coordinates',
        difficulty: 'medium',
        question: 'What is the imaginary line at 0° longitude called?',
        options: ['The equator', 'The Prime Meridian', 'The Tropic of Cancer', 'The Arctic Circle'],
        correct: 1,
        explanation: 'The Prime Meridian, passing through Greenwich, England, marks 0° longitude.',
      },
      {
        topic: 'Physical Geography of Canada',
        difficulty: 'easy',
        question: "Which body of water lies along Canada's east coast?",
        options: ['The Pacific Ocean', 'The Atlantic Ocean', 'The Arctic Ocean', 'The Gulf of Mexico'],
        correct: 1,
        explanation: "Canada's east coast borders the Atlantic Ocean.",
      },
    ],
    8: [
      {
        topic: 'Global Geography',
        difficulty: 'easy',
        question: 'How many continents are there?',
        options: ['5', '6', '7', '8'],
        correct: 2,
        explanation: 'There are 7 continents: Africa, Antarctica, Asia, Australia, Europe, North America, and South America.',
      },
      {
        topic: 'Global Geography',
        difficulty: 'medium',
        question: 'Which country has the largest population in the world?',
        options: ['India', 'China', 'United States', 'Indonesia'],
        correct: 0,
        explanation: 'As of recent estimates, India has surpassed China to become the most populous country in the world.',
      },
      {
        topic: 'Climate Zones',
        difficulty: 'medium',
        question: 'What best describes a temperate climate zone?',
        options: [
          'Moderate temperatures with four distinct seasons',
          'Constant heat and heavy rainfall year-round',
          'Extremely cold with permafrost year-round',
          'Very dry with minimal precipitation',
        ],
        correct: 0,
        explanation: 'Temperate climate zones, like much of Canada and Europe, experience moderate temperatures and four distinct seasons.',
      },
      {
        topic: 'Human Geography',
        difficulty: 'medium',
        question: 'What is "population density"?',
        options: [
          'The number of people living per unit of area',
          'The total population of a country',
          'The rate at which a population grows',
          'The percentage of people living in cities',
        ],
        correct: 0,
        explanation: 'Population density measures how many people live within a given area, such as per square kilometer.',
      },
      {
        topic: 'Human Geography',
        difficulty: 'medium',
        question: 'What is migration?',
        options: [
          'The movement of people from one place to live in another',
          'The movement of tectonic plates',
          'The changing of seasons',
          'The flow of rivers to the ocean',
        ],
        correct: 0,
        explanation: 'Migration refers to people moving from one region or country to settle in another.',
      },
    ],
    9: [
      {
        topic: 'Canada',
        difficulty: 'easy',
        question: 'What is the capital city of Canada?',
        options: ['Toronto', 'Montreal', 'Vancouver', 'Ottawa'],
        correct: 3,
        explanation: "Ottawa, located in Ontario, has been Canada's capital since 1857.",
      },
      {
        topic: 'Canada',
        difficulty: 'easy',
        question: 'Which is the largest province in Canada by land area?',
        options: ['Quebec', 'Ontario', 'British Columbia', 'Alberta'],
        correct: 0,
        explanation: "Quebec is Canada's largest province by area, covering about 1.5 million square kilometers.",
      },
      {
        topic: 'World geography',
        difficulty: 'easy',
        question: 'Which is the longest river in the world?',
        options: ['The Amazon', 'The Nile', 'The Mississippi', 'The Yangtze'],
        correct: 1,
        explanation: 'The Nile River, at about 6,650 km, is generally considered the longest river in the world.',
      },
      {
        topic: 'World geography',
        difficulty: 'easy',
        question: 'Which continent is the largest by land area?',
        options: ['Africa', 'North America', 'Asia', 'Europe'],
        correct: 2,
        explanation: 'Asia is the largest continent, covering about 44.5 million square kilometers.',
      },
      {
        topic: 'Canada',
        difficulty: 'medium',
        question: 'What are the three territories of Canada?',
        options: [
          'Yukon, Labrador, and Nunavut',
          'Northwest Territories, Nunavut, and Newfoundland',
          'Yukon, Nunavut, and British Columbia',
          'Yukon, Northwest Territories, and Nunavut',
        ],
        correct: 3,
        explanation: "Canada's three territories are Yukon, the Northwest Territories, and Nunavut, located in the country's north.",
      },
    ],
    10: [
      {
        topic: 'Canada',
        difficulty: 'easy',
        question: "What climate zone covers most of Canada's Arctic region?",
        options: ['Tundra', 'Tropical', 'Desert', 'Mediterranean'],
        correct: 0,
        explanation: "The tundra climate zone, marked by permafrost and low vegetation, dominates Canada's far north.",
      },
      {
        topic: 'Canada',
        difficulty: 'medium',
        question: "Which body of water separates Canada's Vancouver Island from mainland British Columbia?",
        options: ['Hudson Bay', 'The Strait of Georgia', 'The Gulf of St. Lawrence', 'Lake Winnipeg'],
        correct: 1,
        explanation: 'The Strait of Georgia separates Vancouver Island from the British Columbia mainland.',
      },
      {
        topic: 'World geography',
        difficulty: 'medium',
        question: 'What causes the different time zones around the world?',
        options: [
          "The Earth's orbit around the Sun",
          'Ocean currents',
          "The Earth's rotation on its axis",
          "The tilt of the Earth's axis",
        ],
        correct: 2,
        explanation: 'As the Earth rotates on its axis once every 24 hours, different longitudes face the sun at different times, creating time zones.',
      },
      {
        topic: 'World geography',
        difficulty: 'medium',
        question: 'Which mountain range forms much of the border between Europe and Asia?',
        options: ['The Andes', 'The Rockies', 'The Alps', 'The Ural Mountains'],
        correct: 3,
        explanation: 'The Ural Mountains in Russia are traditionally considered the geographical boundary between Europe and Asia.',
      },
      {
        topic: 'Canada',
        difficulty: 'medium',
        question: 'What is the main factor that makes the Canadian Prairies suitable for large-scale agriculture?',
        options: ['Flat, fertile land with rich soil', 'High rainfall year-round', 'Mountainous terrain', 'Tropical climate'],
        correct: 0,
        explanation: "The Prairies' flat terrain and fertile soil make them ideal for growing wheat and other grain crops.",
      },
    ],
    11: [
      {
        topic: 'Canada',
        difficulty: 'medium',
        question: "What is the primary cause of coastal erosion along Canada's Atlantic provinces?",
        options: ['Volcanic activity', 'Wave action and rising sea levels', 'Deforestation', 'Earthquakes'],
        correct: 1,
        explanation: 'Wave action combined with rising sea levels due to climate change is gradually eroding Atlantic coastlines.',
      },
      {
        topic: 'Canada',
        difficulty: 'hard',
        question: 'What is meant by Canada\'s "population density gradient"?',
        options: [
          'Population is evenly distributed across the country',
          'Population is denser in the north than the south',
          'Population is much denser near the southern border and sparser in the north',
          'Population density is highest in the territories',
        ],
        correct: 2,
        explanation: 'Most Canadians live within a few hundred kilometers of the US border, while the vast north remains sparsely populated.',
      },
      {
        topic: 'World geography',
        difficulty: 'medium',
        question: 'What is desertification, and what commonly causes it?',
        options: [
          'The natural formation of oceans',
          'Melting of polar ice caps',
          'The growth of tropical rainforests',
          'Land degradation into desert, often from overgrazing and deforestation',
        ],
        correct: 3,
        explanation: 'Desertification is the process by which fertile land becomes desert, often driven by overgrazing, deforestation, and drought.',
      },
      {
        topic: 'World geography',
        difficulty: 'hard',
        question: 'What is the significance of the Ring of Fire in world geography?',
        options: [
          'It is a zone around the Pacific Ocean with frequent earthquakes and volcanic activity',
          'It is a major world trade route',
          'It marks the boundary of tropical climate zones',
          'It is a chain of coral reefs',
        ],
        correct: 0,
        explanation: 'The Ring of Fire is a horseshoe-shaped zone around the Pacific Basin where tectonic plate boundaries cause frequent earthquakes and volcanic eruptions.',
      },
      {
        topic: 'Canada',
        difficulty: 'hard',
        question: "How has climate change specifically affected Canada's Arctic region?",
        options: [
          'Increased desertification',
          'Melting permafrost and shrinking sea ice',
          'Rising mountain ranges',
          'Decreased average temperatures',
        ],
        correct: 1,
        explanation: "Canada's Arctic is warming faster than the global average, causing permafrost to melt and sea ice to shrink significantly.",
      },
    ],
  },

  english: {
    7: [
      {
        topic: 'Grammar',
        difficulty: 'easy',
        question: 'Which word is a pronoun in this sentence? "She gave him the book."',
        options: ['Gave', 'She', 'Book', 'The'],
        correct: 1,
        explanation: "'She' replaces a noun (a person's name), which is what a pronoun does.",
      },
      {
        topic: 'Grammar',
        difficulty: 'easy',
        question: 'Which sentence uses correct capitalization?',
        options: ['my Favorite subject is science.', 'My favorite subject is Science.', 'My favorite subject is science.', 'my favorite Subject is science.'],
        correct: 2,
        explanation: "Only the first word of a sentence and proper nouns are capitalized; 'science' here is not a proper noun.",
      },
      {
        topic: 'Reading Comprehension',
        difficulty: 'medium',
        question: 'What is it called when you form a mental picture based on details in a text?',
        options: ['Inferencing', 'Visualizing', 'Skimming', 'Summarizing'],
        correct: 1,
        explanation: 'Visualizing means creating a mental image based on descriptive details in what you read.',
      },
      {
        topic: 'Reading Comprehension',
        difficulty: 'medium',
        question: 'What does it mean to "infer" something while reading?',
        options: [
          'To copy a sentence exactly',
          'To use clues in the text to figure out something not directly stated',
          'To read the text out loud',
          'To count the number of paragraphs',
        ],
        correct: 1,
        explanation: 'Inferring means using clues and context from the text to understand something the author does not state directly.',
      },
      {
        topic: 'Writing Basics',
        difficulty: 'easy',
        question: 'What should every paragraph include to stay organized?',
        options: ['A topic sentence and supporting details', 'A title and a picture', 'A question and an answer', 'A list of vocabulary words'],
        correct: 0,
        explanation: 'A well-organized paragraph starts with a topic sentence and includes supporting details about that idea.',
      },
    ],
    8: [
      {
        topic: 'Literary Devices',
        difficulty: 'medium',
        question: 'What is an example of alliteration?',
        options: ['"Peter Piper picked a peck of pickled peppers"', '"The wind whispered like a voice"', '"Time is a thief"', '"She is as brave as a lion"'],
        correct: 0,
        explanation: 'Alliteration is the repetition of the same starting consonant sound in nearby words, as in "Peter Piper picked."',
      },
      {
        topic: 'Literary Devices',
        difficulty: 'medium',
        question: 'What literary device gives human qualities to non-human things?',
        options: ['Personification', 'Simile', 'Alliteration', 'Irony'],
        correct: 0,
        explanation: 'Personification attributes human characteristics or behavior to non-human objects, animals, or ideas.',
      },
      {
        topic: 'Essay Writing',
        difficulty: 'medium',
        question: 'What is the purpose of a thesis statement?',
        options: ["To state the essay's main argument or claim", 'To list every source used', 'To conclude the essay', 'To ask a question the essay will not answer'],
        correct: 0,
        explanation: "A thesis statement clearly presents the essay's central argument, usually near the end of the introduction.",
      },
      {
        topic: 'Essay Writing',
        difficulty: 'easy',
        question: 'What should supporting paragraphs in an essay contain?',
        options: ['Evidence and details that support the thesis', 'A completely new topic each time', 'Only opinions with no evidence', 'A summary of the introduction'],
        correct: 0,
        explanation: 'Supporting paragraphs should provide evidence, examples, and details that back up the thesis statement.',
      },
      {
        topic: 'Parts of Speech',
        difficulty: 'easy',
        question: 'Which part of speech connects words, phrases, or clauses, such as "and," "but," or "or"?',
        options: ['Conjunction', 'Preposition', 'Interjection', 'Pronoun'],
        correct: 0,
        explanation: 'Conjunctions like "and," "but," and "or" join words, phrases, or clauses together.',
      },
    ],
    9: [
      {
        topic: 'Grammar',
        difficulty: 'easy',
        question: 'Which sentence uses correct subject-verb agreement?',
        options: [
          'The group of students are studying.',
          'The group of students were studying at.',
          'The group of students is studying.',
          'The group of student is studying.',
        ],
        correct: 2,
        explanation: "'Group' is a singular collective noun, so it takes the singular verb 'is', even though it's followed by a plural noun (students).",
      },
      {
        topic: 'Grammar',
        difficulty: 'easy',
        question: 'Identify the correctly punctuated sentence.',
        options: [
          'I bought apples oranges, and bananas.',
          'I bought, apples oranges and bananas.',
          'I bought apples oranges and bananas,',
          'I bought apples, oranges, and bananas.',
        ],
        correct: 3,
        explanation: "A comma is needed after each item in a list before the conjunction 'and'.",
      },
      {
        topic: 'Literature',
        difficulty: 'easy',
        question: 'What is the term for the central message or lesson of a story?',
        options: ['Theme', 'Plot', 'Setting', 'Climax'],
        correct: 0,
        explanation: 'The theme is the underlying message or main idea that the author wants to convey through the story.',
      },
      {
        topic: 'Literature',
        difficulty: 'medium',
        question: 'What do we call the point of highest tension in a story?',
        options: ['The exposition', 'The climax', 'The resolution', 'The falling action'],
        correct: 1,
        explanation: 'The climax is the turning point of the story where tension and conflict reach their peak.',
      },
      {
        topic: 'Writing',
        difficulty: 'easy',
        question: 'What is the purpose of a topic sentence in a paragraph?',
        options: [
          'To conclude the essay',
          'To provide a direct quote',
          'To introduce the main idea of the paragraph',
          'To list the sources used',
        ],
        correct: 2,
        explanation: 'A topic sentence states the main idea of a paragraph, giving readers a clear sense of what the paragraph will discuss.',
      },
    ],
    10: [
      {
        topic: 'Grammar',
        difficulty: 'medium',
        question: 'Which sentence correctly uses the past perfect tense?',
        options: [
          'She has finished her homework before dinner.',
          'She finishing her homework before dinner.',
          'She finish her homework before dinner.',
          'She had finished her homework before dinner.',
        ],
        correct: 3,
        explanation: "The past perfect tense ('had' + past participle) shows an action completed before another past action.",
      },
      {
        topic: 'Grammar',
        difficulty: 'medium',
        question: 'Which of these is an example of a dangling modifier?',
        options: [
          'Walking to school, the rain started pouring.',
          'Walking to school, I got caught in the rain.',
          'The rain started pouring while I walked to school.',
          'I walked to school in the rain.',
        ],
        correct: 0,
        explanation: "In the first sentence, 'Walking to school' has no logical subject to modify since 'the rain' can't walk — this creates a dangling modifier.",
      },
      {
        topic: 'Literature',
        difficulty: 'easy',
        question: 'What literary device involves giving human traits to non-human things?',
        options: ['Metaphor', 'Personification', 'Simile', 'Alliteration'],
        correct: 1,
        explanation: 'Personification attributes human qualities or actions to non-human objects, animals, or ideas.',
      },
      {
        topic: 'Literature',
        difficulty: 'medium',
        question: 'In a story told from the first-person point of view, who is the narrator?',
        options: [
          'An all-knowing outside narrator',
          "A narrator who only knows one character's thoughts but isn't in the story",
          "A character in the story, using 'I'",
          'The author speaking directly to readers',
        ],
        correct: 2,
        explanation: "First-person narration means the story is told by a character within it, using pronouns like 'I' and 'we'.",
      },
      {
        topic: 'Writing',
        difficulty: 'medium',
        question: "What is the main purpose of a thesis statement in an essay?",
        options: [
          'To summarize the entire essay in detail',
          'To list all the sources used',
          'To ask a rhetorical question',
          "To clearly state the essay's main argument or claim",
        ],
        correct: 3,
        explanation: "A thesis statement presents the essay's central argument, usually at the end of the introduction, guiding the rest of the essay.",
      },
    ],
    11: [
      {
        topic: 'Grammar',
        difficulty: 'hard',
        question: 'Which sentence correctly uses the subjunctive mood?',
        options: [
          'If I were you, I would apologize.',
          'If I was you, I would apologize.',
          'If I am you, I would apologize.',
          'If I will be you, I would apologize.',
        ],
        correct: 0,
        explanation: "The subjunctive mood uses 'were' (not 'was') for hypothetical situations contrary to fact.",
      },
      {
        topic: 'Grammar',
        difficulty: 'medium',
        question: 'Identify the sentence with correct parallel structure.',
        options: [
          'She likes hiking, swimming, and to bike.',
          'She likes hiking, swimming, and biking.',
          'She likes to hike, swimming, and biking.',
          'She likes hiking, to swim, and biking.',
        ],
        correct: 1,
        explanation: 'Parallel structure requires that items in a list use the same grammatical form — here, all three are gerunds.',
      },
      {
        topic: 'Literature',
        difficulty: 'medium',
        question: 'What is dramatic irony?',
        options: [
          'When a character says the opposite of what they mean',
          'A twist ending that surprises everyone',
          'When the audience knows something the characters do not',
          "A comparison using 'like' or 'as'",
        ],
        correct: 2,
        explanation: 'Dramatic irony occurs when the audience has knowledge that the characters in the story lack, creating tension or suspense.',
      },
      {
        topic: 'Literature',
        difficulty: 'hard',
        question: 'What is an unreliable narrator?',
        options: [
          'A narrator who speaks in the third person',
          'A narrator who is also the author',
          'A narrator who never appears in the story',
          "A narrator whose credibility or perspective is compromised or biased",
        ],
        correct: 3,
        explanation: 'An unreliable narrator has a distorted, biased, or limited perspective, making their account of events questionable.',
      },
      {
        topic: 'Writing',
        difficulty: 'hard',
        question: 'What is the primary purpose of using rhetorical appeals (ethos, pathos, logos) in persuasive writing?',
        options: [
          'To strengthen an argument by appealing to credibility, emotion, and logic',
          'To make the essay longer',
          'To avoid taking a clear position',
          'To summarize opposing viewpoints only',
        ],
        correct: 0,
        explanation: "Ethos, pathos, and logos are persuasive techniques that appeal to the audience's trust, emotions, and reasoning.",
      },
    ],
  },

  french: {
    7: [
      {
        topic: 'Vocabulary',
        difficulty: 'easy',
        question: 'What does "la pomme" mean in English?',
        options: ['The banana', 'The apple', 'The orange', 'The grape'],
        correct: 1,
        explanation: "'Pomme' means apple; it's a feminine noun so it takes 'la'.",
      },
      {
        topic: 'Vocabulary',
        difficulty: 'easy',
        question: 'How do you say "goodbye" in French?',
        options: ['Bonjour', 'Au revoir', 'Merci', "S'il vous plaît"],
        correct: 1,
        explanation: "'Au revoir' is the standard way to say goodbye in French.",
      },
      {
        topic: 'Present Tense Verbs',
        difficulty: 'medium',
        question: "Conjugate 'avoir' (to have) for 'nous': Nous ___ un chien.",
        options: ['avons', 'avez', 'ai', 'ont'],
        correct: 0,
        explanation: "The verb 'avoir' conjugates as 'nous avons' (we have) in the present tense.",
      },
      {
        topic: 'Present Tense Verbs',
        difficulty: 'medium',
        question: "Conjugate 'être' (to be) for 'ils': Ils ___ contents.",
        options: ['sont', 'est', 'sommes', 'êtes'],
        correct: 0,
        explanation: "The verb 'être' conjugates as 'ils sont' (they are) in the present tense.",
      },
      {
        topic: 'Simple Sentences',
        difficulty: 'easy',
        question: 'Which sentence correctly means "I like the book" in French?',
        options: ["J'aime le livre.", 'Je aime le livre.', "J'aimes le livre.", 'Je aiment le livre.'],
        correct: 0,
        explanation: "'J'aime le livre' is correct — 'je' becomes 'j'' before a vowel sound.",
      },
    ],
    8: [
      {
        topic: 'Past Tense',
        difficulty: 'medium',
        question: "Which sentence correctly uses the passé composé of 'aller' (to go)?",
        options: ['Elle est allée au marché.', 'Elle a allé au marché.', 'Elle allait au marché demain.', 'Elle va allée au marché.'],
        correct: 0,
        explanation: "'Aller' uses 'être' as its auxiliary verb in the passé composé, and the past participle agrees with the subject: 'elle est allée'.",
      },
      {
        topic: 'Past Tense',
        difficulty: 'medium',
        question: "What is the passé composé form of 'finir' (to finish) for 'j'ai'?",
        options: ["J'ai fini", 'Je finis', "J'ai finir", 'Je finissais'],
        correct: 0,
        explanation: "The passé composé of 'finir' uses 'avoir' + past participle: 'j'ai fini' (I finished).",
      },
      {
        topic: 'Adjectives',
        difficulty: 'easy',
        question: "What is the correct plural form of the adjective 'heureux' (happy, masculine)?",
        options: ['Heureux', 'Heureuse', 'Heureuses', 'Heureuxs'],
        correct: 0,
        explanation: "'Heureux' already ends in -x, so the masculine plural form stays the same: 'heureux'.",
      },
      {
        topic: 'Adjectives',
        difficulty: 'medium',
        question: 'Where do most French adjectives go in relation to the noun they describe?',
        options: ['After the noun', 'Always before the noun', 'At the start of the sentence', 'It does not matter'],
        correct: 0,
        explanation: 'Most French adjectives are placed after the noun they describe, unlike in English.',
      },
      {
        topic: 'Reading Comprehension',
        difficulty: 'medium',
        question: "In the sentence 'Après avoir mangé, il est parti', what does 'après' indicate?",
        options: ['A sequence of events (after doing something)', 'A location', 'A question', 'A negative statement'],
        correct: 0,
        explanation: "'Après' means 'after,' indicating that one action (leaving) happened following another (eating).",
      },
    ],
    9: [
      {
        topic: 'Vocabulary',
        difficulty: 'easy',
        question: 'What is the French word for "the house"?',
        options: ['le maison', 'la maison', 'la garçon', 'le fille'],
        correct: 1,
        explanation: "'Maison' (house) is a feminine noun, so it takes the feminine article 'la': la maison.",
      },
      {
        topic: 'Vocabulary',
        difficulty: 'easy',
        question: 'How do you say "good morning" in French?',
        options: ['Bonsoir', 'Au revoir', 'Bonjour', 'Merci'],
        correct: 2,
        explanation: "'Bonjour' means 'good morning' or 'hello' and is used during the day; 'bonsoir' is used in the evening.",
      },
      {
        topic: 'Grammar',
        difficulty: 'easy',
        question: "Which article correctly completes: '___ chat est noir' (The cat is black)?",
        options: ['La', 'Les', "L'", 'Le'],
        correct: 3,
        explanation: "'Chat' (cat) is a masculine singular noun, so it uses the masculine article 'le'.",
      },
      {
        topic: 'Conjugation',
        difficulty: 'easy',
        question: "Conjugate 'être' (to be) for 'je' (I): Je ___ étudiant.",
        options: ['suis', 'es', 'est', 'sont'],
        correct: 0,
        explanation: "The verb 'être' conjugates as 'je suis' (I am) in the present tense.",
      },
      {
        topic: 'Conjugation',
        difficulty: 'easy',
        question: "Conjugate 'avoir' (to have) for 'tu' (you, informal): Tu ___ un livre.",
        options: ['ai', 'as', 'a', 'avons'],
        correct: 1,
        explanation: "The verb 'avoir' conjugates as 'tu as' (you have) in the present tense.",
      },
    ],
    10: [
      {
        topic: 'Vocabulary',
        difficulty: 'easy',
        question: 'What does the French expression "il pleut" mean?',
        options: ['It is sunny', 'It is cold', 'It is raining', 'It is windy'],
        correct: 2,
        explanation: "'Il pleut' is an impersonal expression meaning 'it is raining,' from the verb 'pleuvoir'.",
      },
      {
        topic: 'Grammar',
        difficulty: 'medium',
        question: 'Which sentence correctly uses the passé composé?',
        options: [
          'Je mange une pomme hier.',
          "J'ai manger une pomme.",
          'Je mangeais une pomme demain.',
          "J'ai mangé une pomme.",
        ],
        correct: 3,
        explanation: "The passé composé uses 'avoir' or 'être' + past participle: 'j'ai mangé' (I ate) correctly conjugates 'manger'.",
      },
      {
        topic: 'Grammar',
        difficulty: 'medium',
        question: "What is the correct form of the adjective 'beau' before a feminine noun, e.g., 'a beautiful house'?",
        options: ['une belle maison', 'un beau maison', 'une beau maison', 'un belle maison'],
        correct: 0,
        explanation: "'Beau' becomes 'belle' to agree with the feminine noun 'maison', and takes the feminine article 'une'.",
      },
      {
        topic: 'Conjugation',
        difficulty: 'medium',
        question: "Conjugate 'aller' (to go) for 'nous' (we): Nous ___ au cinéma.",
        options: ['vais', 'allons', 'va', 'vont'],
        correct: 1,
        explanation: "The verb 'aller' conjugates as 'nous allons' (we go) in the present tense.",
      },
      {
        topic: 'Conjugation',
        difficulty: 'medium',
        question: "What is the future tense form of 'parler' (to speak) for 'il' (he)?",
        options: ['il parle', 'il a parlé', 'il parlera', 'il parlait'],
        correct: 2,
        explanation: "The simple future tense of regular -er verbs adds '-ra' to the infinitive stem: 'il parlera' (he will speak).",
      },
    ],
    11: [
      {
        topic: 'Vocabulary',
        difficulty: 'hard',
        question: 'What does the idiomatic expression "avoir le cafard" mean?',
        options: ['To be hungry', 'To be in a hurry', 'To be excited', 'To feel down or depressed'],
        correct: 3,
        explanation: "'Avoir le cafard' is an idiom meaning to feel blue or depressed, literally translating to 'to have the cockroach'.",
      },
      {
        topic: 'Grammar',
        difficulty: 'hard',
        question: 'Which sentence correctly uses the subjunctive mood?',
        options: [
          'Il faut que tu fasses tes devoirs.',
          'Il faut que tu fais tes devoirs.',
          'Il faut que tu as fait tes devoirs.',
          'Il faut que tu feras tes devoirs.',
        ],
        correct: 0,
        explanation: "After expressions like 'il faut que', French requires the subjunctive mood: 'que tu fasses', from the irregular verb 'faire'.",
      },
      {
        topic: 'Grammar',
        difficulty: 'medium',
        question: 'Which sentence correctly uses the conditional tense?',
        options: [
          "Si j'ai de l'argent, je voyagerais.",
          "Si j'avais de l'argent, je voyagerais.",
          "Si j'avais de l'argent, je voyage.",
          "Si j'aurai de l'argent, je voyagerais.",
        ],
        correct: 1,
        explanation: "In a hypothetical 'si' clause, the imperfect ('avais') pairs with the conditional ('voyagerais'): 'If I had money, I would travel'.",
      },
      {
        topic: 'Conjugation',
        difficulty: 'hard',
        question: "What is the past subjunctive form pattern used for actions completed before the main clause's action, e.g., 'that he has finished'?",
        options: ["qu'il finisse", "qu'il finira", "qu'il ait fini", "qu'il a fini"],
        correct: 2,
        explanation: "The past subjunctive uses the subjunctive of 'avoir' or 'être' plus the past participle: 'qu'il ait fini' (that he has finished).",
      },
      {
        topic: 'Conjugation',
        difficulty: 'medium',
        question: "Conjugate 'venir' (to come) in the passé composé for 'elle' (she): Elle ___ hier.",
        options: ['a venu', 'vient', 'venait', 'est venue'],
        correct: 3,
        explanation: "'Venir' uses 'être' as its auxiliary verb in the passé composé, and the past participle agrees with the feminine subject: 'elle est venue'.",
      },
    ],
  },
}

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 }

function clampGrade(grade) {
  const g = Number(grade)
  if (!Number.isFinite(g)) return 9
  return Math.min(11, Math.max(7, Math.round(g)))
}

export function getBankForGrade(subjectId, grade) {
  const subjectBank = TEST_PREP_QUESTION_BANK[subjectId]
  if (!subjectBank) return []
  return subjectBank[clampGrade(grade)] || []
}

// Loose "closest matching" heuristic: strips trailing pluralization and
// checks substring/word overlap in both directions, since this is a
// temporary stand-in for the AI's understanding of free-text topics.
function normalizeTopic(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/s\b/g, '')
}

export function topicMatches(bankTopic, studentTopic) {
  const a = normalizeTopic(bankTopic)
  const b = normalizeTopic(studentTopic)
  if (!b) return false
  if (a.includes(b) || b.includes(a)) return true
  const aWords = a.split(/\s+/).filter((w) => w.length >= 4)
  const bWords = b.split(/\s+/).filter((w) => w.length >= 4)
  return aWords.some((w) => bWords.some((x) => x.includes(w) || w.includes(x)))
}

function toPlanQuestion(q) {
  return { question: q.question, options: q.options, correct: q.correct, explanation: q.explanation }
}

function splitSequential(arr, chunkCount) {
  const chunks = []
  const base = Math.floor(arr.length / chunkCount)
  let extra = arr.length % chunkCount
  let idx = 0
  for (let i = 0; i < chunkCount; i++) {
    const size = base + (extra > 0 ? 1 : 0)
    if (extra > 0) extra--
    chunks.push(arr.slice(idx, idx + size))
    idx += size
  }
  return chunks
}

function dayTitle(chunk) {
  const topics = [...new Set(chunk.map((q) => q.topic))]
  return topics.join(' & ')
}

function dayFocus(dayIndex, dayCount) {
  if (dayCount === 1) return 'Full review — mixed difficulty'
  if (dayIndex === 0) return 'Warm-up — easier concepts first'
  if (dayIndex === dayCount - 1) return 'Final review — toughest questions'
  return 'Building up — medium difficulty'
}

function demoLessonText(subjectName, topicLabel) {
  return `Demo mode — this is a placeholder lesson while AI generation is temporarily disabled. Here are practice questions on ${topicLabel} to help you review ${subjectName}.\nWork through each question, then read the explanation to understand why the correct answer is right.`
}

function sortByDifficulty(arr) {
  return [...arr].sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty])
}

// Builds a { days: [...] } structure matching the shape generateStudyPlan
// normally returns from Claude, sourced entirely from the hardcoded bank.
// Topic-matched questions lead (so the requested topic is covered first);
// if there aren't enough matches to fill every requested day, the rest of
// that subject/grade's bank pads out the remaining days as broader review.
export function buildDemoStudyPlanDays({ subjectId, grade, topic, daysAvailable }) {
  const bank = getBankForGrade(subjectId, grade)
  const matched = bank.filter((q) => topicMatches(q.topic, topic))
  const rest = bank.filter((q) => !matched.includes(q))
  const ordered = matched.length > 0 ? [...sortByDifficulty(matched), ...sortByDifficulty(rest)] : sortByDifficulty(bank)
  const dayCount = Math.max(1, Math.min(daysAvailable, ordered.length))
  const chunks = splitSequential(ordered, dayCount)
  const subjectName = getSubject(subjectId)?.name || subjectId

  const days = chunks.map((chunk, i) => ({
    day: i + 1,
    title: dayTitle(chunk),
    focus: dayFocus(i, dayCount),
    lesson: demoLessonText(subjectName, dayTitle(chunk)),
    questions: chunk.map(toPlanQuestion),
  }))

  return { days }
}

// Deterministic per-day shuffle so the guide's question order rotates daily
// without needing real randomness (keeps repeat generations stable within a day).
function mulberry32(seed) {
  let t = seed
  return function () {
    t |= 0
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle(arr, seed) {
  const rand = mulberry32(seed)
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function dailySeed() {
  return Math.floor(Date.now() / 86400000)
}

// Builds a { topic, questions } structure matching generateStudyGuide's
// normal Claude output shape.
export function buildDemoStudyGuide({ subjectId, grade }) {
  const bank = getBankForGrade(subjectId, grade)
  const shuffled = seededShuffle(bank, dailySeed())
  const topics = [...new Set(shuffled.map((q) => q.topic))]
  const topicLabel = topics.length === 1 ? topics[0] : 'Mixed Review'
  return {
    topic: topicLabel,
    questions: shuffled.map(toPlanQuestion),
  }
}
