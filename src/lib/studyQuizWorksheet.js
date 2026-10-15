// Builds the printable "study quiz" worksheet for one upload as a complete,
// self-contained HTML document. Shared by both sides on purpose, so what the
// student previews is exactly what gets emailed: the Study Guide's preview
// modal (src/components/student/testprep/StudyQuizModal.jsx) renders this
// string in an iframe, and api/email-study-quiz.js sends the same string,
// rebuilt server-side from the database, never from client HTML.
//
// Like src/lib/uploads.js, this deliberately imports nothing browser-only
// (no react-i18next): a serverless function imports it. The worksheet's own
// printed labels live here, keyed by language code, for the same reason
// api/_lib/resend.js keeps its email strings in-file.
//
// Every style is inline (or in the one <style> block), since email clients
// don't load external stylesheets. The answer key starts on a new printed
// page via page-break-before: always; on screen it gets a dashed divider
// instead, so the preview shows where the break falls.

const LABELS = {
  en: {
    name: 'Name',
    date: 'Date',
    answer: 'Answer',
    answerKey: 'Answer Key',
    questionCount: (n) => `${n} question${n === 1 ? '' : 's'}`,
  },
  fr: {
    name: 'Nom',
    date: 'Date',
    answer: 'Réponse',
    answerKey: 'Corrigé',
    questionCount: (n) => `${n} question${n === 1 ? '' : 's'}`,
  },
  es: {
    name: 'Nombre',
    date: 'Fecha',
    answer: 'Respuesta',
    answerKey: 'Respuestas',
    questionCount: (n) => `${n} pregunta${n === 1 ? '' : 's'}`,
  },
}

// Mirrors the "subjects" block of src/locales/*/translation.json. Copied
// here because the server can't load those JSON files through i18next, and
// the emailed worksheet needs the same localized subject name the preview
// shows. Keep both in sync when adding a subject.
const SUBJECT_LABELS = {
  en: {
    math: 'Math',
    science: 'Science',
    history_geography: 'History & Geography',
    english: 'English',
    french: 'French',
    physics: 'Physics',
    chemistry: 'Chemistry',
    woodwork: 'Woodwork',
    art: 'Art',
    music: 'Music',
    cooking: 'Cooking',
    drama: 'Drama',
    leadership: 'Leadership',
  },
  fr: {
    math: 'Mathématiques',
    science: 'Sciences',
    history_geography: 'Histoire et Géographie',
    english: 'Anglais',
    french: 'Français',
    physics: 'Physique',
    chemistry: 'Chimie',
    woodwork: 'Menuiserie',
    art: 'Art',
    music: 'Musique',
    cooking: 'Cuisine',
    drama: 'Théâtre',
    leadership: 'Leadership',
  },
  es: {
    math: 'Matemáticas',
    science: 'Ciencias',
    history_geography: 'Historia y Geografía',
    english: 'Inglés',
    french: 'Francés',
    physics: 'Física',
    chemistry: 'Química',
    woodwork: 'Carpintería',
    art: 'Arte',
    music: 'Música',
    cooking: 'Cocina',
    drama: 'Teatro',
    leadership: 'Liderazgo',
  },
}

// users.language_preference stores 'English'/'French'/'Spanish' (see
// LANG_FOR_PREFERENCE in api/_lib/notificationText.js).
const LANG_FOR_PREFERENCE = { English: 'en', French: 'fr', Spanish: 'es' }

export function worksheetLangFor(languagePreference) {
  return LANG_FOR_PREFERENCE[languagePreference] || 'en'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

function isMultipleChoice(q) {
  return Array.isArray(q.options) && q.options.length > 0
}

// The key shows "b. <option>" (the same lettering the question's <ol
// type="a"> prints) for a multiple-choice question whose answer matches one
// of its options, and the plain answer text otherwise.
function answerKeyText(q) {
  if (isMultipleChoice(q)) {
    const index = q.options.indexOf(q.answer)
    if (index >= 0) return `${LETTERS[index]}. ${q.answer}`
  }
  return q.answer || ''
}

const LINE = 'border-bottom:1px solid #444;height:30px;'

function renderQuestion(q, i, labels) {
  const answerSpace = isMultipleChoice(q)
    ? `<ol type="a" style="margin:8px 0 0;padding-left:28px;">${q.options
        .map((o) => `<li style="margin:4px 0;">${escapeHtml(o)}</li>`)
        .join('')}</ol>
       <p style="margin:12px 0 0;">${labels.answer}: <span style="display:inline-block;width:160px;${LINE}height:auto;">&nbsp;</span></p>`
    : `<div style="${LINE}"></div><div style="${LINE}"></div><div style="${LINE}"></div>`

  return `<div style="margin:0 0 26px;page-break-inside:avoid;break-inside:avoid;">
      <p style="margin:0;font-weight:600;">${i + 1}. ${escapeHtml(q.question)}</p>
      ${answerSpace}
    </div>`
}

function renderAnswer(q) {
  const explanation = q.explanation ? `<div style="margin:2px 0 0;color:#555;font-size:13px;">${escapeHtml(q.explanation)}</div>` : ''
  return `<li style="margin:0 0 12px;"><strong>${escapeHtml(answerKeyText(q))}</strong>${explanation}</li>`
}

// questions: [{ question, options: string[] (empty for short answer),
// answer: string, explanation?: string }] — see toWorksheetQuestions in
// api/_lib/studyQuiz.js for how upload_questions rows map onto this.
export function buildStudyQuizHtml({ title, subjectId, questions, lang = 'en' }) {
  const labels = LABELS[lang] || LABELS.en
  const subjectLabel = (SUBJECT_LABELS[lang] || SUBJECT_LABELS.en)[subjectId] || SUBJECT_LABELS.en[subjectId] || ''
  const safeTitle = escapeHtml(title)

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
  @media screen {
    .answer-key { border-top: 2px dashed #999; margin-top: 40px; padding-top: 28px; }
  }
  @media print {
    body { padding: 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:32px 28px;background:#ffffff;color:#111111;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.5;">
  <div style="max-width:720px;margin:0 auto;">
    <h1 style="margin:0;font-size:24px;line-height:1.25;">${safeTitle}</h1>
    <p style="margin:4px 0 0;color:#444;">${escapeHtml(subjectLabel)} · ${escapeHtml(labels.questionCount(questions.length))}</p>

    <table role="presentation" style="width:100%;margin:24px 0 32px;border-collapse:collapse;">
      <tr>
        <td style="width:62%;padding:0 16px 0 0;">${labels.name}: <span style="display:inline-block;width:70%;${LINE}height:auto;">&nbsp;</span></td>
        <td style="width:38%;padding:0;">${labels.date}: <span style="display:inline-block;width:60%;${LINE}height:auto;">&nbsp;</span></td>
      </tr>
    </table>

    ${questions.map((q, i) => renderQuestion(q, i, labels)).join('\n')}

    <div class="answer-key" style="page-break-before:always;break-before:page;">
      <h2 style="margin:0 0 4px;font-size:20px;">${labels.answerKey}</h2>
      <p style="margin:0 0 18px;color:#444;">${safeTitle}</p>
      <ol style="margin:0;padding-left:22px;">
        ${questions.map(renderAnswer).join('\n')}
      </ol>
    </div>
  </div>
</body>
</html>`
}
