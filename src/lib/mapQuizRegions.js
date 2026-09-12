// Canada Map Quiz — region layout (Grade 10 Geography practice activity).
//
// This is a schematic "grid cartogram", not a geographically accurate
// coastline trace (no traced province/territory border data is available in
// this codebase to draw from) — each region is a simple rounded rectangle,
// but they're arranged to preserve the real relative geography a Grade 10
// student is expected to know: territories north of provinces, west-to-east
// ordering, and oceans on the correct sides (Pacific west, Arctic north,
// Atlantic east). id doubles as both the region's map key and its
// translation-name key (locales: mapQuiz.regions.<id>) since it's a 1:1
// name-to-region quiz — there's never a second region that could take a
// given name.
export const MAP_QUIZ_VIEWBOX = '0 0 1140 420'

export const MAP_QUIZ_REGIONS = [
  // Oceans
  { id: 'arctic', kind: 'ocean', x: 0, y: 0, width: 1140, height: 40 },
  { id: 'pacific', kind: 'ocean', x: 0, y: 40, width: 100, height: 380 },
  { id: 'atlantic', kind: 'ocean', x: 1040, y: 40, width: 100, height: 380 },

  // Territories (north row, west to east)
  { id: 'yt', kind: 'territory', x: 100, y: 40, width: 260, height: 180 },
  { id: 'nt', kind: 'territory', x: 360, y: 40, width: 300, height: 180 },
  { id: 'nu', kind: 'territory', x: 660, y: 40, width: 380, height: 180 },

  // Provinces (south row, west to east)
  { id: 'bc', kind: 'province', x: 100, y: 220, width: 140, height: 200 },
  { id: 'ab', kind: 'province', x: 240, y: 220, width: 100, height: 200 },
  { id: 'sk', kind: 'province', x: 340, y: 220, width: 100, height: 200 },
  { id: 'mb', kind: 'province', x: 440, y: 220, width: 100, height: 200 },
  { id: 'on', kind: 'province', x: 540, y: 220, width: 140, height: 200 },
  { id: 'qc', kind: 'province', x: 680, y: 220, width: 140, height: 200 },
  { id: 'nb', kind: 'province', x: 820, y: 220, width: 60, height: 200 },
  { id: 'pe', kind: 'province', x: 880, y: 220, width: 40, height: 200 },
  { id: 'ns', kind: 'province', x: 920, y: 220, width: 60, height: 200 },
  { id: 'nl', kind: 'province', x: 980, y: 220, width: 60, height: 200 },
]

export const MAP_QUIZ_TOTAL = MAP_QUIZ_REGIONS.length

export function shuffledRegionIds(ids) {
  const arr = [...ids]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
