// Server-only Resend client — mirrors api/_lib/anthropic.js's lazy-client
// pattern. RESEND_API_KEY has no VITE_ prefix on purpose (see that file's
// comment): this name is what keeps it out of the client bundle. Never
// imported by anything under src/.
import { Resend } from 'resend'

let client = null
function getResendClient() {
  if (client) return client
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Missing RESEND_API_KEY environment variable.')
  client = new Resend(apiKey)
  return client
}

const VERIFY_BASE_URL = 'https://zyndal.ca/verify'

// Minimal inline-styled HTML — email clients don't load external
// stylesheets — using the app's real theme colors (src/index.css :root)
// so the email actually looks like Zyndal rather than a generic template.
function verificationEmailContent(token, languagePreference) {
  const link = `${VERIFY_BASE_URL}?token=${token}`
  const isFrench = languagePreference === 'French'

  const subject = isFrench ? 'Vérifiez votre e-mail Zyndal' : 'Verify your Zyndal email'
  const heading = isFrench ? 'Bienvenue sur Zyndal!' : 'Welcome to Zyndal!'
  const body = isFrench
    ? "Cliquez sur le bouton ci-dessous pour vérifier votre adresse e-mail."
    : 'Click the button below to verify your email address.'
  const button = isFrench ? "Vérifier l'e-mail" : 'Verify Email'
  const expiry = isFrench ? 'Ce lien expire dans 24 heures.' : 'This link expires in 24 hours.'
  const ignore = isFrench
    ? "Si vous n'avez pas créé de compte Zyndal, ignorez ce message."
    : 'If you did not create a Zyndal account, ignore this email.'

  const html = `
    <div style="background:#12081f;padding:40px 20px;font-family:'Segoe UI',Inter,system-ui,sans-serif;">
      <div style="max-width:420px;margin:0 auto;background:#221336;border-radius:24px;padding:36px 28px;text-align:center;">
        <div style="font-size:15px;font-weight:700;color:#b983ff;letter-spacing:0.5px;margin-bottom:24px;">
          ⚡ ZYNDAL
        </div>
        <h1 style="color:#ffffff;font-size:20px;margin:0 0 12px;">${heading}</h1>
        <p style="color:#c9b8e8;font-size:15px;line-height:1.5;margin:0 0 28px;">${body}</p>
        <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#8a2be2 0%,#6c3bff 45%,#47bfff 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:14px;">
          ${button}
        </a>
        <p style="color:#8f7ba8;font-size:13px;margin:28px 0 4px;">${expiry}</p>
        <p style="color:#8f7ba8;font-size:13px;margin:0;">${ignore}</p>
      </div>
    </div>
  `.trim()

  return { subject, html }
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

function passwordResetEmailContent(token, languagePreference) {
  const link = `${RESET_PASSWORD_BASE_URL}?token=${token}`
  const isFrench = languagePreference === 'French'

  const subject = isFrench ? 'Réinitialisez votre mot de passe Zyndal' : 'Reset your Zyndal password'
  const heading = isFrench ? 'Réinitialisation de mot de passe' : 'Reset your password'
  const body = isFrench
    ? 'Une réinitialisation de mot de passe a été demandée pour votre compte Zyndal. Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe. Ce lien expire dans 1 heure.'
    : 'Someone requested a password reset for your Zyndal account. Click the button below to reset your password. This link expires in 1 hour.'
  const button = isFrench ? 'Réinitialiser le mot de passe' : 'Reset Password'
  const ignore = isFrench
    ? "Si vous n'avez pas demandé cela, ignorez cet e-mail."
    : "If you didn't request this, ignore this email. Your password won't change."

  const html = `
    <div style="background:#12081f;padding:40px 20px;font-family:'Segoe UI',Inter,system-ui,sans-serif;">
      <div style="max-width:420px;margin:0 auto;background:#221336;border-radius:24px;padding:36px 28px;text-align:center;">
        <div style="font-size:15px;font-weight:700;color:#b983ff;letter-spacing:0.5px;margin-bottom:24px;">
          ⚡ ZYNDAL
        </div>
        <h1 style="color:#ffffff;font-size:20px;margin:0 0 12px;">${heading}</h1>
        <p style="color:#c9b8e8;font-size:15px;line-height:1.5;margin:0 0 28px;">${body}</p>
        <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#8a2be2 0%,#6c3bff 45%,#47bfff 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:14px;">
          ${button}
        </a>
        <p style="color:#8f7ba8;font-size:13px;margin:28px 0 4px;">${ignore}</p>
      </div>
    </div>
  `.trim()

  return { subject, html }
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

function parentInviteEmailContent(parentName, parentCode, email, languagePreference) {
  const link = `${SIGNUP_BASE_URL}?parent_code=${encodeURIComponent(parentCode)}&email=${encodeURIComponent(email)}`
  const isFrench = languagePreference === 'French'

  const subject = isFrench ? `${parentName} vous a invité(e) à rejoindre Zyndal!` : `${parentName} invited you to join Zyndal!`
  const heading = isFrench ? 'Vous êtes invité(e) sur Zyndal!' : "You're invited to Zyndal!"
  const body = isFrench
    ? 'Votre parent a créé un compte Zyndal pour suivre votre apprentissage et récompenser vos progrès. Cliquez ci-dessous pour créer votre compte étudiant — cela ne prend qu’une minute.'
    : 'Your parent has set up a Zyndal account to help track your learning and reward your progress. Click below to create your student account — it only takes a minute.'
  const button = isFrench ? 'Créer mon compte' : 'Create my account'
  const altText = isFrench
    ? `Si vous avez déjà un compte Zyndal, connectez-vous et allez dans Paramètres → Rejoindre un parent pour entrer le code : ${parentCode}`
    : `If you already have a Zyndal account, log in and go to Settings → Join a Parent to enter code: ${parentCode}`

  const html = `
    <div style="background:#12081f;padding:40px 20px;font-family:'Segoe UI',Inter,system-ui,sans-serif;">
      <div style="max-width:420px;margin:0 auto;background:#221336;border-radius:24px;padding:36px 28px;text-align:center;">
        <div style="font-size:15px;font-weight:700;color:#b983ff;letter-spacing:0.5px;margin-bottom:24px;">
          ⚡ ZYNDAL
        </div>
        <h1 style="color:#ffffff;font-size:20px;margin:0 0 12px;">${heading}</h1>
        <p style="color:#c9b8e8;font-size:15px;line-height:1.5;margin:0 0 28px;">${body}</p>
        <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#8a2be2 0%,#6c3bff 45%,#47bfff 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:14px;">
          ${button}
        </a>
        <p style="color:#8f7ba8;font-size:13px;margin:28px 0 4px;line-height:1.5;">${altText}</p>
      </div>
    </div>
  `.trim()

  return { subject, html }
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
