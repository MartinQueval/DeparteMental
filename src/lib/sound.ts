// Sons générés à la volée via Web Audio API : aucun fichier, léger, hors-ligne.

const MUTE_KEY = 'departemental:muted'

let ctx: AudioContext | null = null
let muted = false
try {
  muted = localStorage.getItem(MUTE_KEY) === '1'
} catch {
  muted = false
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  // Les navigateurs suspendent le contexte tant qu'il n'y a pas eu d'interaction.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface Note {
  /** Fréquence en Hz */
  f: number
  /** Décalage de départ en secondes */
  t: number
  /** Durée en secondes */
  d: number
  type?: OscillatorType
  /** Volume crête (0–1) */
  g?: number
}

function play(notes: Note[]) {
  const c = getCtx()
  if (!c || muted) return
  const now = c.currentTime
  for (const n of notes) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = n.type ?? 'sine'
    osc.frequency.setValueAtTime(n.f, now + n.t)
    const start = now + n.t
    const peak = n.g ?? 0.12
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d)
    osc.connect(gain).connect(c.destination)
    osc.start(start)
    osc.stop(start + n.d + 0.03)
  }
}

export function isMuted(): boolean {
  return muted
}

export function toggleMuted(): boolean {
  muted = !muted
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    /* ignore */
  }
  if (!muted) getCtx() // débloque le contexte audio sur le clic du toggle
  return muted
}

export const sfx = {
  /** Petit tick discret (navigation, boutons secondaires). */
  click() {
    play([{ f: 520, t: 0, d: 0.06, type: 'triangle', g: 0.07 }])
  },
  /** Lancement d'un mode : montée douce en deux notes. */
  start() {
    play([
      { f: 440, t: 0, d: 0.12, type: 'sine', g: 0.1 },
      { f: 660, t: 0.07, d: 0.16, type: 'sine', g: 0.1 },
    ])
  },
  /** Bonne réponse : petit arpège ascendant clair. */
  correct() {
    play([
      { f: 523.25, t: 0, d: 0.1, type: 'triangle', g: 0.11 },
      { f: 659.25, t: 0.06, d: 0.1, type: 'triangle', g: 0.11 },
      { f: 783.99, t: 0.12, d: 0.16, type: 'triangle', g: 0.11 },
    ])
  },
  /** Mauvaise réponse : deux notes basses descendantes. */
  wrong() {
    play([
      { f: 196, t: 0, d: 0.16, type: 'sawtooth', g: 0.08 },
      { f: 147, t: 0.1, d: 0.22, type: 'sawtooth', g: 0.08 },
    ])
  },
  /** Fin de session / victoire : arpège majeur. */
  finish() {
    play([
      { f: 523.25, t: 0, d: 0.14, type: 'triangle', g: 0.11 },
      { f: 659.25, t: 0.1, d: 0.14, type: 'triangle', g: 0.11 },
      { f: 783.99, t: 0.2, d: 0.14, type: 'triangle', g: 0.11 },
      { f: 1046.5, t: 0.3, d: 0.28, type: 'triangle', g: 0.12 },
    ])
  },
}
