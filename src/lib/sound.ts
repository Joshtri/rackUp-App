// Shot clock sounds, made with Web Audio (no sound files needed).

let ctx: AudioContext | null = null

/** Call from a tap/click: browsers only allow audio after a user gesture. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

export function beep(frequency = 880, durationMs = 120, volume = 0.25) {
  if (!ctx || ctx.state !== 'running') return
  const t = ctx.currentTime
  const end = t + durationMs / 1000
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(end + 0.02)
}

// WNT-style beep, matched to a recording of the World Nineball Tour shot clock:
// a 443 Hz tone with a strong 2nd and 3rd harmonic, instant on, fading to about
// half volume, then a quick cut.
const WNT_FREQ = 443
const WNT_HARMONICS = [0, 1, 0.72, 0.43, 0.04, 0.02, 0.1, 0.03, 0.02, 0.05]
let wntWave: PeriodicWave | null = null

function wntTone(holdMs: number, volume: number) {
  if (!ctx || ctx.state !== 'running') return
  wntWave ??= ctx.createPeriodicWave(
    new Float32Array(WNT_HARMONICS.length),
    new Float32Array(WNT_HARMONICS),
  )
  const t = ctx.currentTime
  const fadeEnd = t + holdMs / 1000
  const end = fadeEnd + 0.02
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.setPeriodicWave(wntWave)
  osc.frequency.value = WNT_FREQ
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.005)
  gain.gain.linearRampToValueAtTime(volume * 0.55, fadeEnd)
  gain.gain.linearRampToValueAtTime(0, end)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(end + 0.02)
}

/** One countdown beep, played each second from 5 down to 1. */
export function wntBeep() {
  wntTone(250, 0.55)
}

/** The sound for when the shot clock hits zero: the same tone, held longer. */
export function playTimeUp() {
  wntTone(1000, 0.65)
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // not supported
  }
}
