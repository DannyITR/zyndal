// Ten preset nudge messages for the friend "poke" feature (see
// api/social/poke.js). A poke always sends one of these — never free text —
// so the server can validate the key against POKE_PRESET_KEYS and render it
// in the recipient's own language without trusting client-supplied copy.
// Shared between the client picker UI (PokePickerModal.jsx) and the server
// notification body (api/_lib/notificationText.js), the same
// cross-boundary-shared-data-module role src/lib/questions.js's SUBJECTS
// plays for daily questions.
export const POKE_PRESETS = [
  { key: 'dont_lose_streak', en: "Don't lose your streak!", fr: 'Ne perds pas ta série !', es: '¡No pierdas tu racha!' },
  { key: 'your_turn_leaderboard', en: 'Your turn on the leaderboard!', fr: 'À ton tour sur le classement !', es: '¡Es tu turno en la clasificación!' },
  { key: 'keep_it_going', en: "Let's keep it going!", fr: 'Continuons comme ça !', es: '¡Sigamos así!' },
  { key: 'miss_you', en: "We miss you — come back!", fr: 'Tu nous manques — reviens !', es: '¡Te extrañamos, vuelve!' },
  { key: 'beat_my_score', en: "Bet you can't beat my score today!", fr: 'Je parie que tu ne peux pas battre mon score aujourd\'hui !', es: '¡Apuesto a que no puedes superar mi puntaje hoy!' },
  { key: 'you_got_this', en: "You've got this — go answer today's questions!", fr: 'Tu peux le faire — va répondre aux questions du jour !', es: '¡Tú puedes — ve a responder las preguntas de hoy!' },
  { key: 'dont_forget', en: "Don't forget today's questions!", fr: "N'oublie pas les questions d'aujourd'hui !", es: '¡No olvides las preguntas de hoy!' },
  { key: 'race_to_top', en: 'Race you to the top of the leaderboard!', fr: 'On se fait la course jusqu\'en haut du classement !', es: '¡Te reto a llegar primero a la cima de la clasificación!' },
  { key: 'stay_strong', en: 'Stay strong, keep that streak alive!', fr: 'Tiens bon, garde ta série vivante !', es: '¡Mantente firme, no dejes morir tu racha!' },
  { key: 'friendly_nudge', en: 'Just a friendly nudge to check in!', fr: 'Juste un petit rappel amical !', es: '¡Solo un pequeño empujón amistoso!' },
]

export const POKE_PRESET_KEYS = POKE_PRESETS.map((p) => p.key)

export function pokePresetText(key, lang) {
  const preset = POKE_PRESETS.find((p) => p.key === key)
  if (!preset) return null
  return preset[lang] || preset.en
}
