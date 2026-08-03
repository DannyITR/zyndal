import { createAdminHandler } from '../_lib/adminHandler.js'
import { runMultilingualGeneration } from '../_lib/multilingualGeneration.js'

// Same generation logic as scripts/generate-multilingual-content.js (see
// api/_lib/multilingualGeneration.js) — this is the admin-panel-triggerable
// version, for regenerating content after a curriculum update touches a
// handful of subjects/grades/topics, not the initial full 30-combination
// bulk run. A cold full run makes 180+ sequential Anthropic calls with a
// deliberate delay between each (see CALL_DELAY_MS) and can run well past
// what's practical for a synchronous HTTP request even at this function's
// extended maxDuration — use the standalone script (no timeout, since it's
// a plain `node` process) for that one. This endpoint is still safe to call
// for a full run if needed: it's idempotent, so if it times out mid-way,
// calling it again just resumes from wherever it left off.
export const config = { maxDuration: 800 }

async function handle() {
  const log = []
  const { summary } = await runMultilingualGeneration((message) => log.push(message))
  return { log, summary }
}

export default createAdminHandler({ method: 'POST', handle })
