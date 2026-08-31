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

const ZYNDAL_HOME_URL = 'https://zyndal.ca'

const CLASS_CLAIM_APPROVED_STRINGS = {
  en: {
    subject: 'Your class claim was approved!',
    heading: 'Your class is live 🎉',
    body: 'Your claim has been approved and your class is ready — open Zyndal to find your join code and start assigning homework.',
    button: 'Open Zyndal',
  },
  fr: {
    subject: 'Votre demande de classe a été approuvée!',
    heading: 'Votre classe est active 🎉',
    body: "Votre demande a été approuvée et votre classe est prête — ouvrez Zyndal pour trouver votre code d'accès et commencer à assigner des devoirs.",
    button: 'Ouvrir Zyndal',
  },
  es: {
    subject: '¡Tu solicitud de clase fue aprobada!',
    heading: 'Tu clase ya está activa 🎉',
    body: 'Tu solicitud fue aprobada y tu clase está lista — abre Zyndal para encontrar tu código de acceso y empezar a asignar tareas.',
    button: 'Abrir Zyndal',
  },
}

function classClaimApprovedEmailContent(languagePreference) {
  const s = CLASS_CLAIM_APPROVED_STRINGS[langFor(languagePreference)]
  const html = renderEmailHtml({ heading: s.heading, body: s.body, buttonText: s.button, buttonLink: ZYNDAL_HOME_URL, footer: '' })
  return { subject: s.subject, html }
}

export async function sendClassClaimApprovedEmail({ email, languagePreference }) {
  const resend = getResendClient()
  const { subject, html } = classClaimApprovedEmailContent(languagePreference)
  const { error } = await resend.emails.send({ from: 'Zyndal <hello@zyndal.ca>', replyTo: 'hello@zyndal.ca', to: email, subject, html })
  if (error) throw new Error(error.message || 'Failed to send class-claim-approved email.')
}

const CLASS_CLAIM_REJECTED_STRINGS = {
  en: {
    subject: 'Your class claim was not approved',
    heading: 'Your claim was not approved',
    body: 'Your recent class claim was not approved this time. You can review the details and submit a new claim anytime from Zyndal.',
    button: 'Open Zyndal',
  },
  fr: {
    subject: "Votre demande de classe n'a pas été approuvée",
    heading: "Votre demande n'a pas été approuvée",
    body: "Votre récente demande de classe n'a pas été approuvée cette fois-ci. Vous pouvez revoir les détails et soumettre une nouvelle demande à tout moment depuis Zyndal.",
    button: 'Ouvrir Zyndal',
  },
  es: {
    subject: 'Tu solicitud de clase no fue aprobada',
    heading: 'Tu solicitud no fue aprobada',
    body: 'Tu reciente solicitud de clase no fue aprobada esta vez. Puedes revisar los detalles y enviar una nueva solicitud cuando quieras desde Zyndal.',
    button: 'Abrir Zyndal',
  },
}

function classClaimRejectedEmailContent(languagePreference, reason) {
  const s = CLASS_CLAIM_REJECTED_STRINGS[langFor(languagePreference)]
  const html = renderEmailHtml({
    heading: s.heading,
    body: s.body,
    buttonText: s.button,
    buttonLink: ZYNDAL_HOME_URL,
    footer: reason ? `<p style="color:#8f7ba8;font-size:13px;margin:28px 0 0;">${reason}</p>` : '',
  })
  return { subject: s.subject, html }
}

export async function sendClassClaimRejectedEmail({ email, languagePreference, reason }) {
  const resend = getResendClient()
  const { subject, html } = classClaimRejectedEmailContent(languagePreference, reason)
  const { error } = await resend.emails.send({ from: 'Zyndal <hello@zyndal.ca>', replyTo: 'hello@zyndal.ca', to: email, subject, html })
  if (error) throw new Error(error.message || 'Failed to send class-claim-rejected email.')
}

// Three Stripe-subscription-lifecycle emails, sent by api/_lib/stripeSubscription.js.
// Always addressed to the actual payer (the subscription owner — see that
// file's is_subscription_owner-scoped lookups), never a student whose
// Premium came from a linked parent's plan.
const SUBSCRIPTION_STRINGS = {
  welcome: {
    en: {
      subject: 'Welcome to Zyndal Premium! 🎉',
      heading: 'Welcome to Zyndal Premium!',
      body: 'Your Premium subscription is now active. You have full access to all Premium features including unlimited practice, study guides, test prep, homework uploads, and your parent reward wallet. Manage your subscription anytime in Settings. Thank you for supporting Zyndal!',
      button: 'Open Zyndal',
    },
    fr: {
      subject: 'Bienvenue sur Zyndal Premium! 🎉',
      heading: 'Bienvenue sur Zyndal Premium!',
      body: "Votre abonnement Premium est maintenant actif. Vous avez un accès complet à toutes les fonctionnalités Premium, y compris la pratique illimitée, les guides d'étude, la préparation aux tests, les téléversements de devoirs et le portefeuille de récompenses de votre parent. Gérez votre abonnement à tout moment dans Paramètres. Merci de soutenir Zyndal!",
      button: 'Ouvrir Zyndal',
    },
    es: {
      subject: '¡Bienvenido a Zyndal Premium! 🎉',
      heading: '¡Bienvenido a Zyndal Premium!',
      body: 'Tu suscripción Premium ya está activa. Tienes acceso completo a todas las funciones Premium, incluida la práctica ilimitada, guías de estudio, preparación para exámenes, subida de tareas y la billetera de recompensas de tu padre/madre. Administra tu suscripción en cualquier momento desde Configuración. ¡Gracias por apoyar a Zyndal!',
      button: 'Abrir Zyndal',
    },
  },
  paymentFailed: {
    en: {
      subject: 'Your Zyndal payment failed',
      heading: 'Payment failed',
      body: 'Your Zyndal payment failed — please update your payment method to keep your Premium access.',
      button: 'Update payment method',
    },
    fr: {
      subject: 'Votre paiement Zyndal a échoué',
      heading: 'Échec du paiement',
      body: 'Votre paiement Zyndal a échoué — veuillez mettre à jour votre moyen de paiement pour conserver votre accès Premium.',
      button: 'Mettre à jour le paiement',
    },
    es: {
      subject: 'Tu pago de Zyndal falló',
      heading: 'Pago fallido',
      body: 'Tu pago de Zyndal falló — actualiza tu método de pago para conservar tu acceso Premium.',
      button: 'Actualizar método de pago',
    },
  },
  cancelled: {
    en: {
      subject: 'Your Zyndal Premium subscription has ended',
      heading: 'Subscription ended',
      body: 'Your Zyndal Premium subscription has ended. You can resubscribe anytime from Settings to get full access back.',
      button: 'Resubscribe',
    },
    fr: {
      subject: 'Votre abonnement Zyndal Premium a pris fin',
      heading: 'Abonnement terminé',
      body: 'Votre abonnement Zyndal Premium a pris fin. Vous pouvez vous réabonner à tout moment dans Paramètres pour retrouver un accès complet.',
      button: 'Se réabonner',
    },
    es: {
      subject: 'Tu suscripción a Zyndal Premium ha finalizado',
      heading: 'Suscripción finalizada',
      body: 'Tu suscripción a Zyndal Premium ha finalizado. Puedes volver a suscribirte en cualquier momento desde Configuración para recuperar el acceso completo.',
      button: 'Volver a suscribirse',
    },
  },
}

function subscriptionEmailContent(kind, languagePreference) {
  const s = SUBSCRIPTION_STRINGS[kind][langFor(languagePreference)]
  const html = renderEmailHtml({ heading: s.heading, body: s.body, buttonText: s.button, buttonLink: SIGNUP_BASE_URL, footer: '' })
  return { subject: s.subject, html }
}

export async function sendWelcomeEmail({ email, languagePreference }) {
  const resend = getResendClient()
  const { subject, html } = subscriptionEmailContent('welcome', languagePreference)
  const { error } = await resend.emails.send({ from: 'Zyndal <hello@zyndal.ca>', replyTo: 'hello@zyndal.ca', to: email, subject, html })
  if (error) throw new Error(error.message || 'Failed to send welcome email.')
}

export async function sendPaymentFailedEmail({ email, languagePreference }) {
  const resend = getResendClient()
  const { subject, html } = subscriptionEmailContent('paymentFailed', languagePreference)
  const { error } = await resend.emails.send({ from: 'Zyndal <hello@zyndal.ca>', replyTo: 'hello@zyndal.ca', to: email, subject, html })
  if (error) throw new Error(error.message || 'Failed to send payment-failed email.')
}

export async function sendSubscriptionCancelledEmail({ email, languagePreference }) {
  const resend = getResendClient()
  const { subject, html } = subscriptionEmailContent('cancelled', languagePreference)
  const { error } = await resend.emails.send({ from: 'Zyndal <hello@zyndal.ca>', replyTo: 'hello@zyndal.ca', to: email, subject, html })
  if (error) throw new Error(error.message || 'Failed to send cancellation email.')
}

// Sent by api/weekly-summary.js's cron. Unlike every other email above,
// this one's content isn't a single interpolated paragraph — each parent
// gets one email covering every one of their linked children in a single
// send (deliberately NOT one email per child), with a per-child stat grid
// and a streak badge — so this builds its own complete HTML document
// (DOCTYPE + viewport meta, for real mobile-client rendering) rather than
// going through renderEmailHtml's fixed heading+one-paragraph+button
// fragment shape every other email in this file uses.
const WEEKLY_SUMMARY_STRINGS = {
  en: {
    subject: 'Your Weekly Zyndal Summary',
    heading: 'Your Weekly Summary',
    intro: "Here's how your kids did on Zyndal this past week:",
    button: 'View Full Dashboard',
    day: 'day streak',
    days: 'day streak',
    xp: 'XP earned',
    coins: 'Coins earned',
    questions: 'Questions',
    grades: 'Grades',
    noGradesEntered: 'No grades entered this week',
    // Deliberately upbeat, not guilt-tripping — a parent shouldn't read
    // this as a complaint about their kid.
    noActivity: "hasn't answered any questions yet this week — a gentle nudge might help them get going! 🌱",
  },
  fr: {
    subject: 'Votre résumé hebdomadaire Zyndal',
    heading: 'Votre résumé hebdomadaire',
    intro: 'Voici comment vos enfants ont progressé sur Zyndal cette semaine :',
    button: 'Voir le tableau de bord',
    day: 'jour de série',
    days: 'jours de série',
    xp: 'XP gagnés',
    coins: 'Pièces gagnées',
    questions: 'Questions',
    grades: 'Notes',
    noGradesEntered: 'Aucune note ajoutée cette semaine',
    noActivity: "n'a pas encore répondu à de questions cette semaine — un petit rappel pourrait l'aider à s'y remettre ! 🌱",
  },
  es: {
    subject: 'Tu resumen semanal de Zyndal',
    heading: 'Tu resumen semanal',
    intro: 'Así les fue a tus hijos en Zyndal esta semana:',
    button: 'Ver panel completo',
    day: 'día de racha',
    days: 'días de racha',
    xp: 'XP ganados',
    coins: 'Monedas ganadas',
    questions: 'Preguntas',
    grades: 'Calificaciones',
    noGradesEntered: 'Sin calificaciones agregadas esta semana',
    noActivity: 'aún no ha respondido preguntas esta semana — un pequeño recordatorio podría ayudarle a comenzar. 🌱',
  },
}

// Not a security boundary (email HTML, not a browser DOM), just hygiene —
// display_name is user-editable free text (Settings), so it shouldn't be
// interpolated into HTML unescaped.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statCell(value, label) {
  return `
    <td style="width:50%;padding:0 6px 8px 0;">
      <div style="background:#1a0f2e;border-radius:10px;padding:10px 12px;">
        <p style="margin:0;color:#ffffff;font-family:'Segoe UI',Inter,system-ui,sans-serif;font-weight:700;font-size:17px;">${value}</p>
        <p style="margin:2px 0 0;color:#8f7ba8;font-size:11px;">${label}</p>
      </div>
    </td>
  `
}

// child: { name, streak, xpEarned, coinsEarned, questionsAnswered,
// grades: [{subject, gradePercentage}], hasActivity }. hasActivity
// distinguishes "answered zero questions this week" (still shown, with an
// encouraging note in place of the stat grid) from real activity — per
// the spec's "skip children with zero activity for the week [i.e. the
// stat grid], still list them but note no activity, don't skip the
// parent entirely."
function weeklySummaryChildHtml(child, s) {
  const name = escapeHtml(child.name)

  if (!child.hasActivity) {
    return `
      <div style="text-align:left;background:#2a1b42;border-radius:14px;padding:16px 18px;margin:0 0 12px;">
        <p style="color:#ffffff;font-weight:700;font-size:15px;margin:0 0 6px;">${name}</p>
        <p style="color:#8f7ba8;font-size:13px;margin:0;line-height:1.5;">${name} ${s.noActivity}</p>
      </div>
    `
  }

  // Mirrors the in-app streak pill (src/components/student/StreakFlame.jsx
  // / .streak-pill--lit in App.css) — warm orange/gold when the streak is
  // actually alive, muted when it's 0. CSS animation/filter aren't
  // reliable across email clients, so this is a static color-only echo of
  // that "lit vs unlit" look rather than the pulsing flame itself.
  const streakLit = child.streak > 0
  const streakBg = streakLit ? 'rgba(255,158,68,0.15)' : '#1a0f2e'
  const streakBorder = streakLit ? 'rgba(255,158,68,0.5)' : 'rgba(255,255,255,0.08)'
  const streakUnit = child.streak === 1 ? s.day : s.days

  const gradesText =
    child.grades.length > 0
      ? child.grades.map((g) => `${escapeHtml(g.subject)} ${g.gradePercentage}%`).join(', ')
      : s.noGradesEntered

  return `
    <div style="text-align:left;background:#2a1b42;border-radius:14px;padding:16px 18px;margin:0 0 12px;">
      <p style="color:#ffffff;font-weight:700;font-size:15px;margin:0 0 12px;">${name}</p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
        <tr>
          <td style="background:${streakBg};border:1px solid ${streakBorder};border-radius:10px;padding:8px 14px;white-space:nowrap;">
            <span style="font-size:18px;vertical-align:middle;">🔥</span>
            <span style="font-family:'Segoe UI',Inter,system-ui,sans-serif;font-weight:700;font-size:15px;color:#ffffff;vertical-align:middle;margin-left:6px;">${child.streak}</span>
            <span style="font-size:12px;color:#c9b8e8;vertical-align:middle;margin-left:5px;">${streakUnit}</span>
          </td>
        </tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px;">
        <tr>${statCell(child.xpEarned, `⚡ ${s.xp}`)}${statCell(child.coinsEarned, `🪙 ${s.coins}`)}</tr>
        <tr>${statCell(child.questionsAnswered, `✅ ${s.questions}`)}${statCell(child.grades.length, `📊 ${s.grades}`)}</tr>
      </table>

      <p style="color:#8f7ba8;font-size:12px;margin:0;line-height:1.5;">${gradesText}</p>
    </div>
  `
}

function weeklySummaryEmailContent(children, languagePreference) {
  const lang = langFor(languagePreference)
  const s = WEEKLY_SUMMARY_STRINGS[lang]
  const childrenHtml = children.map((child) => weeklySummaryChildHtml(child, s)).join('')

  // A real HTML document (not just a fragment, unlike every other email
  // above) specifically so the viewport meta tag actually applies —
  // matters more here than for the shorter one-CTA emails since this one
  // has a multi-row stat grid that benefits from real mobile rendering.
  // The <style> block is a progressive-enhancement nicety on clients that
  // support it (most modern mobile mail apps); every rule that actually
  // matters is still inlined too, so it degrades cleanly on clients (e.g.
  // older Outlook) that strip <style> blocks entirely.
  const html = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${s.subject}</title>
<style>
  @media only screen and (max-width: 480px) {
    .zyndal-email-outer { padding: 24px 12px !important; }
    .zyndal-email-card { padding: 28px 18px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#12081f;">
  <div class="zyndal-email-outer" style="background:#12081f;padding:40px 20px;font-family:'Segoe UI',Inter,system-ui,sans-serif;">
    <div class="zyndal-email-card" style="max-width:440px;margin:0 auto;background:#221336;border-radius:24px;padding:36px 28px;">
      <div style="text-align:center;font-size:15px;font-weight:700;color:#b983ff;letter-spacing:0.5px;margin-bottom:24px;">
        ⚡ ZYNDAL
      </div>
      <h1 style="text-align:center;color:#ffffff;font-size:20px;margin:0 0 12px;">${s.heading}</h1>
      <p style="text-align:center;color:#c9b8e8;font-size:15px;line-height:1.5;margin:0 0 22px;">${s.intro}</p>

      ${childrenHtml}

      <div style="text-align:center;margin-top:10px;">
        <a href="${SIGNUP_BASE_URL}" style="display:inline-block;background:linear-gradient(135deg,#8a2be2 0%,#6c3bff 45%,#47bfff 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:14px;">
          ${s.button}
        </a>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
  return { subject: s.subject, html }
}

export async function sendWeeklySummaryEmail({ email, languagePreference, children }) {
  const resend = getResendClient()
  const { subject, html } = weeklySummaryEmailContent(children, languagePreference)
  const { error } = await resend.emails.send({ from: 'Zyndal <hello@zyndal.ca>', replyTo: 'hello@zyndal.ca', to: email, subject, html })
  if (error) throw new Error(error.message || 'Failed to send weekly summary email.')
}
