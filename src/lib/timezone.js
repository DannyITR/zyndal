import { DEFAULT_TIMEZONE } from './streak'

// Browser-only. Intl.DateTimeFormat().resolvedOptions().timeZone with no
// explicit timeZone option returns whatever zone the JS runtime itself is
// configured for — in a browser that's the user's own system timezone
// (exactly what every date-sensitive screen/request needs), but in Node it
// would return the SERVER's zone instead. Deliberately never imported from
// api/ for that reason — server code always receives a timezone string from
// the client (see submitAnswer/getDailyProgress in storage.js) rather than
// trying to detect one itself.
export function getUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
  } catch {
    return DEFAULT_TIMEZONE
  }
}
