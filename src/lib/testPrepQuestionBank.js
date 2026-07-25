// ⚠️ TEMPORARY TESTING DATA — hardcoded question bank standing in for live
// Claude API generation in the Test Prep and Study Guide features. See
// DEMO_MODE in ai.js. Swap the AI calls back on and this file becomes unused
// (safe to delete or keep as a fallback).
//
// 5 questions per subject per grade (9, 10, 11) = 90 total. Wrong options
// are modeled on common student mistakes, not random noise, matching the
// style of the AI-generated questions this replaces.

import { getSubject } from './questions'

const TEST_PREP_QUESTION_BANK = {
  math: {
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
  if (!Number.isFinite(g) || g <= 9) return 9
  if (g >= 11) return 11
  return 10
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
