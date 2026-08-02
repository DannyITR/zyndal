// Server-only Resend client — mirrors api/_lib/anthropic.js's lazy-client
// pattern. RESEND_API_KEY has no VITE_ prefix on purpose (see that file's
// comment): this name is what keeps it out of the client bundle. Never
// imported by anything under src/.
import { Resend } from 'resend'
import { LANG_FOR_PREFERENCE } from './notificationText.js'

let client = null
function getResendClient() {
  if (client) return client
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Missing RESEND_API_KEY environment variable.')
  client = new Resend(apiKey)
  return client
}

function langFor(languagePreference) {
  return LANG_FOR_PREFERENCE[languagePreference] || 'en'
}

// Minimal inline-styled HTML — email clients don't load external
// stylesheets — using the app's real theme colors (src/index.css :root)
// so the email actually looks like Zyndal rather than a generic template.
// Shared by every email below; `footer` is already-escaped HTML (each
// caller controls its own line breaks/emphasis there).
function renderEmailHtml({ heading, body, buttonText, buttonLink, footer }) {
  return `
    <div style="background:#12081f;padding:40px 20px;font-family:'Segoe UI',Inter,system-ui,sans-serif;">
      <div style="max-width:420px;margin:0 auto;background:#221336;border-radius:24px;padding:36px 28px;text-align:center;">
        <div style="font-size:15px;font-weight:700;color:#b983ff;letter-spacing:0.5px;margin-bottom:24px;">
          ⚡ ZYNDAL
        </div>
        <h1 style="color:#ffffff;font-size:20px;margin:0 0 12px;">${heading}</h1>
        <p style="color:#c9b8e8;font-size:15px;line-height:1.5;margin:0 0 28px;">${body}</p>
        <a href="${buttonLink}" style="display:inline-block;background:linear-gradient(135deg,#8a2be2 0%,#6c3bff 45%,#47bfff 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:14px;">
          ${buttonText}
        </a>
        ${footer}
      </div>
    </div>
  `.trim()
}

const VERIFY_BASE_URL = 'https://zyndal.ca/verify'

const VERIFICATION_STRINGS = {
  en: {
    subject: 'Verify your Zyndal email',
    heading: 'Welcome to Zyndal!',
    body: 'Click the button below to verify your email address.',
    button: 'Verify Email',
    expiry: 'This link expires in 24 hours.',
    ignore: 'If you did not create a Zyndal account, ignore this email.',
  },
  fr: {
    subject: 'Vérifiez votre e-mail Zyndal',
    heading: 'Bienvenue sur Zyndal!',
    body: "Cliquez sur le bouton ci-dessous pour vérifier votre adresse e-mail.",
    button: "Vérifier l'e-mail",
    expiry: 'Ce lien expire dans 24 heures.',
    ignore: "Si vous n'avez pas créé de compte Zyndal, ignorez ce message.",
  },
  es: {
    subject: 'Verifica tu correo de Zyndal',
    heading: '¡Bienvenido a Zyndal!',
    body: 'Haz clic en el botón de abajo para verificar tu dirección de correo electrónico.',
    button: 'Verificar correo',
    expiry: 'Este enlace expira en 24 horas.',
    ignore: 'Si no creaste una cuenta de Zyndal, ignora este correo.',
  },
}

function verificationEmailContent(token, languagePreference) {
  const link = `${VERIFY_BASE_URL}?token=${token}`
  const s = VERIFICATION_STRINGS[langFor(languagePreference)]

  const html = renderEmailHtml({
    heading: s.heading,
    body: s.body,
    buttonText: s.button,
    buttonLink: link,
    footer: `
        <p style="color:#8f7ba8;font-size:13px;margin:28px 0 4px;">${s.expiry}</p>
        <p style="color:#8f7ba8;font-size:13px;margin:0;">${s.ignore}</p>
    `,
  })

  return { subject: s.subject, html }
}

export async function sendVerificationEmail({ email, token, languagePreference }) {
  const resend = getResendClient()
  const { subject, html } = verificationEmailContent(token, languagePreference)
  const { error } = await resend.emails.send({
    from: 'Zyndal <hello@zyndal.ca>',
    replyTo: 'hello@zyndal.ca',
    to: email,
    subject,
    html,
  })
  if (error) throw new Error(error.message || 'Failed to send verification email.')
}

const RESET_PASSWORD_BASE_URL = 'https://zyndal.ca/reset-password'

const PASSWORD_RESET_STRINGS = {
  en: {
    subject: 'Reset your Zyndal password',
    heading: 'Reset your password',
    body: 'Someone requested a password reset for your Zyndal account. Click the button below to reset your password. This link expires in 1 hour.',
    button: 'Reset Password',
    ignore: "If you didn't request this, ignore this email. Your password won't change.",
  },
  fr: {
    subject: 'Réinitialisez votre mot de passe Zyndal',
    heading: 'Réinitialisation de mot de passe',
    body: 'Une réinitialisation de mot de passe a été demandée pour votre compte Zyndal. Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe. Ce lien expire dans 1 heure.',
    button: 'Réinitialiser le mot de passe',
    ignore: "Si vous n'avez pas demandé cela, ignorez cet e-mail.",
  },
  es: {
    subject: 'Restablece tu contraseña de Zyndal',
    heading: 'Restablece tu contraseña',
    body: 'Alguien solicitó restablecer la contraseña de tu cuenta de Zyndal. Haz clic en el botón de abajo para restablecer tu contraseña. Este enlace expira en 1 hora.',
    button: 'Restablecer contraseña',
    ignore: 'Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.',
  },
}

function passwordResetEmailContent(token, languagePreference) {
  const link = `${RESET_PASSWORD_BASE_URL}?token=${token}`
  const s = PASSWORD_RESET_STRINGS[langFor(languagePreference)]

  const html = renderEmailHtml({
    heading: s.heading,
    body: s.body,
    buttonText: s.button,
    buttonLink: link,
    footer: `
        <p style="color:#8f7ba8;font-size:13px;margin:28px 0 4px;">${s.ignore}</p>
    `,
  })

  return { subject: s.subject, html }
}

export async function sendPasswordResetEmail({ email, token, languagePreference }) {
  const resend = getResendClient()
  const { subject, html } = passwordResetEmailContent(token, languagePreference)
  const { error } = await resend.emails.send({
    from: 'Zyndal <hello@zyndal.ca>',
    replyTo: 'hello@zyndal.ca',
    to: email,
    subject,
    html,
  })
  if (error) throw new Error(error.message || 'Failed to send password reset email.')
}

const SIGNUP_BASE_URL = 'https://zyndal.ca'

const PARENT_INVITE_STRINGS = {
  en: {
    subject: (parentName) => `${parentName} invited you to join Zyndal!`,
    heading: "You're invited to Zyndal!",
    body: 'Your parent has set up a Zyndal account to help track your learning and reward your progress. Click below to create your student account — it only takes a minute.',
    button: 'Create my account',
    altText: (parentCode) => `If you already have a Zyndal account, log in and go to Settings → Join a Parent to enter code: ${parentCode}`,
  },
  fr: {
    subject: (parentName) => `${parentName} vous a invité(e) à rejoindre Zyndal!`,
    heading: 'Vous êtes invité(e) sur Zyndal!',
    body: "Votre parent a créé un compte Zyndal pour suivre votre apprentissage et récompenser vos progrès. Cliquez ci-dessous pour créer votre compte étudiant — cela ne prend qu’une minute.",
    button: 'Créer mon compte',
    altText: (parentCode) => `Si vous avez déjà un compte Zyndal, connectez-vous et allez dans Paramètres → Rejoindre un parent pour entrer le code : ${parentCode}`,
  },
  es: {
    subject: (parentName) => `¡${parentName} te invitó a unirte a Zyndal!`,
    heading: '¡Estás invitado/a a Zyndal!',
    body: 'Tu padre/madre configuró una cuenta de Zyndal para ayudar a seguir tu aprendizaje y recompensar tu progreso. Haz clic abajo para crear tu cuenta de estudiante — solo toma un minuto.',
    button: 'Crear mi cuenta',
    altText: (parentCode) => `Si ya tienes una cuenta de Zyndal, inicia sesión y ve a Configuración → Vincular a un padre/madre para ingresar el código: ${parentCode}`,
  },
}

function parentInviteEmailContent(parentName, parentCode, email, languagePreference) {
  const link = `${SIGNUP_BASE_URL}?parent_code=${encodeURIComponent(parentCode)}&email=${encodeURIComponent(email)}`
  const s = PARENT_INVITE_STRINGS[langFor(languagePreference)]

  const html = renderEmailHtml({
    heading: s.heading,
    body: s.body,
    buttonText: s.button,
    buttonLink: link,
    footer: `
        <p style="color:#8f7ba8;font-size:13px;margin:28px 0 4px;line-height:1.5;">${s.altText(parentCode)}</p>
    `,
  })

  return { subject: s.subject(parentName), html }
}

export async function sendParentInviteEmail({ email, parentName, parentCode, languagePreference }) {
  const resend = getResendClient()
  const { subject, html } = parentInviteEmailContent(parentName, parentCode, email, languagePreference)
  const { error } = await resend.emails.send({
    from: 'Zyndal <hello@zyndal.ca>',
    replyTo: 'hello@zyndal.ca',
    to: email,
    subject,
    html,
  })
  if (error) throw new Error(error.message || 'Failed to send invitation email.')
}

// Homework-assignment email — new alongside this stage's other three (no
// English/French version existed to extend; built trilingual from the
// start). Wired into create-homework.js as a third notification channel
// alongside the in-app row and push alert, sent only to enrolled students
// with a verified email on file (see that file's own comment).
const HOMEWORK_STRINGS = {
  en: {
    subject: (title) => `New homework assigned: ${title}`,
    heading: 'New homework assigned',
    body: (title, className, dueDate) => `${className} has new homework — "${title}" — due ${dueDate}. Log in to Zyndal to complete it.`,
    button: 'Open Zyndal',
  },
  fr: {
    subject: (title) => `Nouveau devoir assigné : ${title}`,
    heading: 'Nouveau devoir assigné',
    body: (title, className, dueDate) => `${className} a un nouveau devoir — « ${title} » — à remettre le ${dueDate}. Connectez-vous à Zyndal pour le compléter.`,
    button: 'Ouvrir Zyndal',
  },
  es: {
    subject: (title) => `Nueva tarea asignada: ${title}`,
    heading: 'Nueva tarea asignada',
    body: (title, className, dueDate) => `${className} tiene una nueva tarea — "${title}" — vence el ${dueDate}. Inicia sesión en Zyndal para completarla.`,
    button: 'Abrir Zyndal',
  },
}

function homeworkAssignedEmailContent(title, className, dueDate, languagePreference) {
  const s = HOMEWORK_STRINGS[langFor(languagePreference)]

  const html = renderEmailHtml({
    heading: s.heading,
    body: s.body(title, className, dueDate),
    buttonText: s.button,
    buttonLink: SIGNUP_BASE_URL,
    footer: '',
  })

  return { subject: s.subject(title), html }
}

export async function sendHomeworkAssignedEmail({ email, title, className, dueDate, languagePreference }) {
  const resend = getResendClient()
  const { subject, html } = homeworkAssignedEmailContent(title, className, dueDate, languagePreference)
  const { error } = await resend.emails.send({
    from: 'Zyndal <hello@zyndal.ca>',
    replyTo: 'hello@zyndal.ca',
    to: email,
    subject,
    html,
  })
  if (error) throw new Error(error.message || 'Failed to send homework assignment email.')
}
