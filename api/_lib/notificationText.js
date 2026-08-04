// In-app notification title/body, localized to the recipient's own
// language_preference at insert time — the notifications table stores
// pre-rendered text (see notifications.js), so this is the one place that
// has to happen; NotificationsScreen.jsx just renders whatever's stored.
// Mirrors resend.js's per-language-branch pattern, generalized to 3
// languages and to accepting interpolated params per notification type.
//
// users.language_preference stores a full English word ('English'/'French'/
// 'Spanish'), not an i18next code — same fact src/lib/i18n.js's own comment
// documents; duplicated here in miniature (rather than importing that file)
// since it's a browser-oriented module (pulls in i18next-browser-
// languagedetector, which expects `window`) that has no place being loaded
// into a serverless function.
export const LANG_FOR_PREFERENCE = { English: 'en', French: 'fr', Spanish: 'es' }

const TEMPLATES = {
  score_share: {
    en: ({ senderUsername, correct, total }) => ({
      title: `@${senderUsername} shared their score`,
      body: `@${senderUsername} got ${correct}/${total} today`,
    }),
    fr: ({ senderUsername, correct, total }) => ({
      title: `@${senderUsername} a partagé son score`,
      body: `@${senderUsername} a obtenu ${correct}/${total} aujourd'hui`,
    }),
    es: ({ senderUsername, correct, total }) => ({
      title: `@${senderUsername} compartió su puntaje`,
      body: `@${senderUsername} obtuvo ${correct}/${total} hoy`,
    }),
  },
  friend_request: {
    en: ({ senderUsername }) => ({ title: `@${senderUsername} wants to follow you`, body: 'Tap to accept or decline' }),
    fr: ({ senderUsername }) => ({ title: `@${senderUsername} souhaite vous suivre`, body: 'Touchez pour accepter ou refuser' }),
    es: ({ senderUsername }) => ({ title: `@${senderUsername} quiere seguirte`, body: 'Toca para aceptar o rechazar' }),
  },
  friend_accepted: {
    en: ({ username }) => ({ title: `@${username} accepted your friend request`, body: 'You are now friends on Zyndal!' }),
    fr: ({ username }) => ({ title: `@${username} a accepté votre demande d'ami`, body: 'Vous êtes maintenant amis sur Zyndal !' }),
    es: ({ username }) => ({ title: `@${username} aceptó tu solicitud de amistad`, body: '¡Ahora son amigos en Zyndal!' }),
  },
  parent_link_request: {
    en: ({ parentUsername }) => ({ title: `@${parentUsername} wants to link as your parent`, body: 'Accept or decline this request.' }),
    fr: ({ parentUsername }) => ({ title: `@${parentUsername} souhaite se lier comme votre parent`, body: 'Acceptez ou refusez cette demande.' }),
    es: ({ parentUsername }) => ({ title: `@${parentUsername} quiere vincularse como tu padre/madre`, body: 'Acepta o rechaza esta solicitud.' }),
  },
  parent_link_accepted: {
    en: ({ studentUsername }) => ({
      title: `✅ @${studentUsername || 'A student'} is now linked to your account`,
      body: 'You can now see their progress on your dashboard.',
    }),
    fr: ({ studentUsername }) => ({
      title: `✅ @${studentUsername || 'Un élève'} est maintenant lié à votre compte`,
      body: 'Vous pouvez maintenant voir ses progrès sur votre tableau de bord.',
    }),
    es: ({ studentUsername }) => ({
      title: `✅ @${studentUsername || 'Un estudiante'} ahora está vinculado a tu cuenta`,
      body: 'Ahora puedes ver su progreso en tu panel.',
    }),
  },
  work_approved: {
    en: () => ({ title: '✅ Your work was approved! +1 XP' }),
    fr: () => ({ title: '✅ Votre travail a été approuvé ! +1 XP' }),
    es: () => ({ title: '✅ ¡Tu trabajo fue aprobado! +1 XP' }),
  },
  work_rejected: {
    en: () => ({ title: 'Your teacher reviewed your work — keep practicing!' }),
    fr: () => ({ title: 'Votre enseignant a examiné votre travail — continuez à vous entraîner !' }),
    es: () => ({ title: 'Tu profesor revisó tu trabajo — ¡sigue practicando!' }),
  },
  homework_assigned: {
    en: ({ title, dueDate }) => ({ title: `📚 New homework assigned: ${title}`, body: `Due ${dueDate}` }),
    fr: ({ title, dueDate }) => ({ title: `📚 Nouveau devoir assigné : ${title}`, body: `À remettre le ${dueDate}` }),
    es: ({ title, dueDate }) => ({ title: `📚 Nueva tarea asignada: ${title}`, body: `Vence el ${dueDate}` }),
  },
  homework_reminder: {
    en: ({ title }) => ({
      title: `📚 Homework due today: ${title}`,
      body: "Don't forget to complete it before the end of the day!",
    }),
    fr: ({ title }) => ({
      title: `📚 Devoir à remettre aujourd'hui : ${title}`,
      body: "N'oubliez pas de le terminer avant la fin de la journée !",
    }),
    es: ({ title }) => ({
      title: `📚 Tarea vence hoy: ${title}`,
      body: '¡No olvides completarla antes de que termine el día!',
    }),
  },
  streak_reminder: {
    en: () => ({
      title: "⚠️ Don't lose your streak!",
      body: "You haven't answered today's questions yet — answer at least one to keep your flame alive 🔥",
    }),
    fr: () => ({
      title: '⚠️ Ne perdez pas votre série !',
      body: "Vous n'avez pas encore répondu aux questions d'aujourd'hui — répondez à au moins une pour garder votre flamme allumée 🔥",
    }),
    es: () => ({
      title: '⚠️ ¡No pierdas tu racha!',
      body: 'Aún no has respondido las preguntas de hoy — responde al menos una para mantener tu llama encendida 🔥',
    }),
  },
  // amount is a pre-formatted dollar string (e.g. "5.00", via
  // centsToDisplay) — same convention as homework_assigned's dueDate above,
  // rather than passing raw cents and reformatting per-language here.
  payout_requested: {
    en: ({ studentUsername, amount }) => ({
      title: `💰 @${studentUsername} is requesting a payout of $${amount}`,
      body: 'Tap to review this request.',
    }),
    fr: ({ studentUsername, amount }) => ({
      title: `💰 @${studentUsername} demande un paiement de ${amount} $`,
      body: 'Touchez pour examiner cette demande.',
    }),
    es: ({ studentUsername, amount }) => ({
      title: `💰 @${studentUsername} está solicitando un pago de $${amount}`,
      body: 'Toca para revisar esta solicitud.',
    }),
  },
  payout_approved: {
    en: ({ amount }) => ({
      title: '🎉 Your payout request was approved!',
      body: `$${amount} has been paid out.`,
    }),
    fr: ({ amount }) => ({
      title: '🎉 Votre demande de paiement a été approuvée !',
      body: `${amount} $ ont été versés.`,
    }),
    es: ({ amount }) => ({
      title: '🎉 ¡Tu solicitud de pago fue aprobada!',
      body: `Se han pagado $${amount}.`,
    }),
  },
  payout_declined: {
    en: () => ({
      title: 'Your payout request was declined by your parent',
      body: 'You can keep earning coins and request again later.',
    }),
    fr: () => ({
      title: 'Votre demande de paiement a été refusée par votre parent',
      body: 'Vous pouvez continuer à gagner des pièces et refaire une demande plus tard.',
    }),
    es: () => ({
      title: 'Tu solicitud de pago fue rechazada por tu padre/madre',
      body: 'Puedes seguir ganando monedas y volver a solicitar más tarde.',
    }),
  },
}

// languagePreference is the recipient's own users.language_preference —
// always look up the notification's RECIPIENT (userId passed to
// insertNotification), never the actor who triggered it (e.g. the sender of
// a friend request), since the recipient is who reads the stored text.
export function notificationText(type, languagePreference, params = {}) {
  const lang = LANG_FOR_PREFERENCE[languagePreference] || 'en'
  const templatesForType = TEMPLATES[type]
  const build = templatesForType?.[lang] || templatesForType?.en
  return build(params)
}

// Push copy is deliberately its own text, distinct from the in-app
// notification row above (see share-score.js/friend-request.js's own
// comments) — punchier, written for a lock-screen banner rather than a
// notifications-list row. Only the types whose push copy actually differs
// from TEMPLATES above need an entry here; everywhere else (homework,
// streak reminders, parent-link, work review) already passes the same
// notificationText() result to both insertNotification and sendPushToUser.
const PUSH_TEMPLATES = {
  score_share: {
    en: ({ senderUsername, correct, total }) => ({
      title: `🔥 @${senderUsername} shared their score with you!`,
      body: `They got ${correct}/${total} today — share yours back to keep your streak alive`,
    }),
    fr: ({ senderUsername, correct, total }) => ({
      title: `🔥 @${senderUsername} a partagé son score avec vous !`,
      body: `Il/Elle a obtenu ${correct}/${total} aujourd'hui — partagez le vôtre pour garder votre flamme allumée`,
    }),
    es: ({ senderUsername, correct, total }) => ({
      title: `🔥 ¡@${senderUsername} compartió su puntaje contigo!`,
      body: `Obtuvo ${correct}/${total} hoy — comparte el tuyo para mantener tu racha viva`,
    }),
  },
  friend_request: {
    en: ({ senderUsername }) => ({ title: `👋 @${senderUsername} wants to follow you on Zyndal`, body: 'Tap to accept or decline' }),
    fr: ({ senderUsername }) => ({ title: `👋 @${senderUsername} souhaite vous suivre sur Zyndal`, body: 'Touchez pour accepter ou refuser' }),
    es: ({ senderUsername }) => ({ title: `👋 @${senderUsername} quiere seguirte en Zyndal`, body: 'Toca para aceptar o rechazar' }),
  },
  friend_accepted: {
    en: ({ username }) => ({
      title: `🎉 @${username} accepted your friend request!`,
      body: "You're now friends on Zyndal — share your score to start a streak!",
    }),
    fr: ({ username }) => ({
      title: `🎉 @${username} a accepté votre demande d'ami !`,
      body: 'Vous êtes maintenant amis sur Zyndal — partagez votre score pour commencer une série !',
    }),
    es: ({ username }) => ({
      title: `🎉 ¡@${username} aceptó tu solicitud de amistad!`,
      body: '¡Ahora son amigos en Zyndal — comparte tu puntaje para comenzar una racha!',
    }),
  },
}

export function pushNotificationText(type, languagePreference, params = {}) {
  const lang = LANG_FOR_PREFERENCE[languagePreference] || 'en'
  const templatesForType = PUSH_TEMPLATES[type]
  const build = templatesForType?.[lang] || templatesForType?.en
  return build(params)
}
