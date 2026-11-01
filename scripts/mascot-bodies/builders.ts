/**
 * Chibi character body builders for the 10 RoMes mascots.
 *
 * Every emitter outputs absolute `M`, `C`, `Z` only.
 * Loaded by `node --experimental-strip-types`, so only erasable type syntax.
 */

import { CHIBI_LAYERS } from "./chibi-art.ts"

export interface BodyDef {
  id: string
  name: string
  viewBox: string
  d: string
  underlay: string
  midlay: string
  overlay: string
}

const KAPPA = 0.5522847498

const fmt = (n: number): string => {
  const r = Math.round(n * 100) / 100
  return String(Object.is(r, -0) ? 0 : r)
}

function lineToCubic(from: [number, number], to: [number, number]): [number, number, number, number, number, number] {
  const [x0, y0] = from
  const [x1, y1] = to
  return [
    x0 + (x1 - x0) / 3,
    y0 + (y1 - y0) / 3,
    x0 + ((x1 - x0) * 2) / 3,
    y0 + ((y1 - y0) * 2) / 3,
    x1,
    y1,
  ]
}

function quadToCubic(
  from: [number, number], ctrl: [number, number], to: [number, number]
): [number, number, number, number, number, number] {
  const [x0, y0] = from
  const [qx, qy] = ctrl
  const [x1, y1] = to
  return [
    x0 + ((qx - x0) * 2) / 3,
    y0 + ((qy - y0) * 2) / 3,
    x1 + ((qx - x1) * 2) / 3,
    y1 + ((qy - y1) * 2) / 3,
    x1,
    y1,
  ]
}

function quarterToCubic(
  from: [number, number], corner: [number, number], to: [number, number]
): [number, number, number, number, number, number] {
  const [x0, y0] = from
  const [cx, cy] = corner
  const [x1, y1] = to
  return [
    x0 + (cx - x0) * KAPPA,
    y0 + (cy - y0) * KAPPA,
    x1 + (cx - x1) * KAPPA,
    y1 + (cy - y1) * KAPPA,
    x1,
    y1,
  ]
}

class Path {
  private parts: string[] = []
  private at: [number, number] = [0, 0]
  private origin: [number, number] = [0, 0]

  moveTo(x: number, y: number): this {
    this.at = [x, y]
    this.origin = [x, y]
    this.parts.push(`M${fmt(x)} ${fmt(y)}`)
    return this
  }

  curveTo(c: [number, number, number, number, number, number]): this {
    const [x1, y1, x2, y2, x, y] = c
    this.at = [x, y]
    this.parts.push(`C${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x)} ${fmt(y)}`)
    return this
  }

  lineTo(x: number, y: number): this {
    return this.curveTo(lineToCubic(this.at, [x, y]))
  }

  quadTo(qx: number, qy: number, x: number, y: number): this {
    return this.curveTo(quadToCubic(this.at, [qx, qy], [x, y]))
  }

  quarterTo(cx: number, cy: number, x: number, y: number): this {
    return this.curveTo(quarterToCubic(this.at, [cx, cy], [x, y]))
  }

  close(): string {
    const [x, y] = this.at
    const [sx, sy] = this.origin
    if (Math.abs(x - sx) > 1e-9 || Math.abs(y - sy) > 1e-9) this.lineTo(sx, sy)
    return this.parts.join("") + "Z"
  }
}

function buildChibiBody(opts: {
  topY: number
  headBot: number
  headW: number
  headR: number
  torsoW: number
  botY: number
  torsoR: number
}): string {
  const { topY, headBot, headW, headR, torsoW, botY, torsoR } = opts
  const hl = 100 - headW / 2
  const hr = 100 + headW / 2
  const tl = 100 - torsoW / 2
  const tr = 100 + torsoW / 2

  const p = new Path()
  p.moveTo(hl + headR, topY)
  p.lineTo(hr - headR, topY)
  p.quarterTo(hr, topY, hr, topY + headR)
  p.lineTo(hr, headBot - headR)
  p.quarterTo(hr, headBot, tr, headBot)
  p.lineTo(tr, botY - torsoR)
  p.quarterTo(tr, botY, tr - torsoR, botY)
  p.lineTo(tl + torsoR, botY)
  p.quarterTo(tl, botY, tl, botY - torsoR)
  p.lineTo(tl, headBot)
  p.quarterTo(hl, headBot, hl, headBot - headR)
  p.lineTo(hl, topY + headR)
  p.quarterTo(hl, topY, hl + headR, topY)
  return p.close()
}

const RAW_DEFS: Omit<BodyDef, "underlay" | "midlay" | "overlay">[] = [
  {
    id: "cursor",
    name: "Robo-Planner",
    viewBox: "0 0 200 200",
    d: buildChibiBody({ topY: 26, headBot: 124, headW: 148, headR: 32, torsoW: 88, botY: 186, torsoR: 26 }),
  },
  {
    id: "blob",
    name: "Octo-Multi",
    viewBox: "0 0 200 200",
    d: buildChibiBody({ topY: 18, headBot: 126, headW: 150, headR: 50, torsoW: 60, botY: 164, torsoR: 22 }),
  },
  {
    id: "circle",
    name: "Tech-Bear",
    viewBox: "0 0 200 200",
    d: buildChibiBody({ topY: 26, headBot: 124, headW: 148, headR: 36, torsoW: 92, botY: 186, torsoR: 28 }),
  },
  {
    id: "squircle",
    name: "Smart-Cat",
    viewBox: "0 0 200 200",
    d: buildChibiBody({ topY: 28, headBot: 124, headW: 148, headR: 34, torsoW: 86, botY: 186, torsoR: 26 }),
  },
  {
    id: "capsule",
    name: "Data-Owl",
    viewBox: "0 0 200 200",
    d: buildChibiBody({ topY: 24, headBot: 124, headW: 150, headR: 44, torsoW: 92, botY: 184, torsoR: 28 }),
  },
  {
    id: "drop",
    name: "Creative-Fox",
    viewBox: "0 0 200 200",
    d: buildChibiBody({ topY: 28, headBot: 124, headW: 152, headR: 34, torsoW: 88, botY: 186, torsoR: 26 }),
  },
  {
    id: "shield",
    name: "Post-Bunny",
    viewBox: "0 0 200 200",
    d: buildChibiBody({ topY: 32, headBot: 126, headW: 146, headR: 38, torsoW: 88, botY: 186, torsoR: 28 }),
  },
  {
    id: "hexagon",
    name: "Shield-Dog",
    viewBox: "0 0 200 200",
    d: buildChibiBody({ topY: 22, headBot: 122, headW: 148, headR: 40, torsoW: 90, botY: 185, torsoR: 26 }),
  },
  {
    id: "diamond",
    name: "Heart-Otter",
    viewBox: "0 0 200 200",
    d: buildChibiBody({ topY: 20, headBot: 122, headW: 150, headR: 46, torsoW: 90, botY: 185, torsoR: 28 }),
  },
  {
    id: "star",
    name: "Star-Lion",
    viewBox: "0 0 200 200",
    d: buildChibiBody({ topY: 28, headBot: 124, headW: 146, headR: 38, torsoW: 86, botY: 186, torsoR: 26 }),
  },
]

export const BODY_DEFS: BodyDef[] = RAW_DEFS.map(def => ({
  ...def,
  ...CHIBI_LAYERS[def.id],
}))
