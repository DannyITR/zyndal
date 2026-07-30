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
