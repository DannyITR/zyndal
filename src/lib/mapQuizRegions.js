// Canada Map Quiz — region layout (Grade 10 Geography practice activity).
//
// The base map is a real, geographically accurate SVG of Canada's
// provinces/territories, fetched at runtime from CANADA_MAP_SVG_URL (see
// MapQuizScreen.jsx) rather than built here — it's the same public-data
// map already used by the civic-mp-directory project, so its province
// groups keep their original two-letter ids (BC, AB, SK, ...). This file
// only holds the quiz's own layer on top of that map: the region list, the
// id-mapping into the fetched SVG's groups, and the three ocean rectangles
// (which the source map has no equivalent for — Canada's political map
// doesn't label surrounding water).
export const CANADA_MAP_SVG_URL = '/maps/canada-provinces.svg'

// The source file's own viewBox, expanded with margin on the west/north/
// east so the three oceans have real clickable area outside the landmass
// — south is left tight since Canada's southern border isn't ocean.
const SOURCE_VIEWBOX = { minX: -24500, minY: -27050, width: 55700, height: 47100 }
const WEST_MARGIN = 9000
const NORTH_MARGIN = 8000
const EAST_MARGIN = 9000

const EXPANDED = {
  minX: SOURCE_VIEWBOX.minX - WEST_MARGIN,
  minY: SOURCE_VIEWBOX.minY - NORTH_MARGIN,
  width: SOURCE_VIEWBOX.width + WEST_MARGIN + EAST_MARGIN,
  height: SOURCE_VIEWBOX.height + NORTH_MARGIN,
}
export const MAP_QUIZ_VIEWBOX = `${EXPANDED.minX} ${EXPANDED.minY} ${EXPANDED.width} ${EXPANDED.height}`

// Boundaries (in the expanded viewBox's own coordinate space, measured off
// the real map via getBBox()) splitting the margin into the three named
// oceans: Arctic spans the full width north of the territories/provinces;
// Pacific and Atlantic split the remaining southern strip at BC's east
// edge and New Brunswick's west edge respectively. The gap between them
// (the Prairies/Ontario/Quebec interior) is deliberately left as neither —
// the middle of Canada isn't coastal.
const ARCTIC_BOTTOM_Y = -3478
const PACIFIC_RIGHT_X = -13214
const ATLANTIC_LEFT_X = 19218
const SOUTH_EDGE_Y = EXPANDED.minY + EXPANDED.height
const EAST_EDGE_X = EXPANDED.minX + EXPANDED.width

export const BASE_WATER_RECT = { x: EXPANDED.minX, y: EXPANDED.minY, width: EXPANDED.width, height: EXPANDED.height }

export const OCEAN_RECTS = {
  arctic: {
    x: EXPANDED.minX,
    y: EXPANDED.minY,
    width: EXPANDED.width,
    height: ARCTIC_BOTTOM_Y - EXPANDED.minY,
  },
  pacific: {
    x: EXPANDED.minX,
    y: ARCTIC_BOTTOM_Y,
    width: PACIFIC_RIGHT_X - EXPANDED.minX,
    height: SOUTH_EDGE_Y - ARCTIC_BOTTOM_Y,
  },
  atlantic: {
    x: ATLANTIC_LEFT_X,
    y: ARCTIC_BOTTOM_Y,
    width: EAST_EDGE_X - ATLANTIC_LEFT_X,
    height: SOUTH_EDGE_Y - ARCTIC_BOTTOM_Y,
  },
}

// Quiz region id (also its translation key, mapQuiz.regions.<id>) -> the
// real `<g id="...">` id inside the fetched SVG.
export const PROVINCE_SVG_IDS = {
  bc: 'BC',
  ab: 'AB',
  sk: 'SK',
  mb: 'MB',
  on: 'ON',
  qc: 'QC',
  nb: 'NB',
  ns: 'NS',
  pe: 'PE',
  nl: 'NL',
  yt: 'YT',
  nt: 'NT',
  nu: 'NU',
}

export const MAP_QUIZ_REGIONS = [
  { id: 'arctic', kind: 'ocean' },
  { id: 'pacific', kind: 'ocean' },
  { id: 'atlantic', kind: 'ocean' },
  { id: 'bc', kind: 'province' },
  { id: 'ab', kind: 'province' },
  { id: 'sk', kind: 'province' },
  { id: 'mb', kind: 'province' },
  { id: 'on', kind: 'province' },
  { id: 'qc', kind: 'province' },
  { id: 'nb', kind: 'province' },
  { id: 'ns', kind: 'province' },
  { id: 'pe', kind: 'province' },
  { id: 'nl', kind: 'province' },
  { id: 'yt', kind: 'territory' },
  { id: 'nt', kind: 'territory' },
  { id: 'nu', kind: 'territory' },
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
