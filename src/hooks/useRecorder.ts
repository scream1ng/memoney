import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const MAX_REC_MS = 30_000
const SILENCE_MS = 1_000
const NO_SPEECH_MS = 8_000

export type RecPhase = 'idle' | 'requesting' | 'rec'

/** Records until a second of silence (or Stop), then hands over the audio. Same behaviour as the Add sheet's voice entry. */
export function useRecorder(onDone: (audio: Blob) => void, onFail: (message: string) => void) {
  const [phase, setPhase] = useState<RecPhase>('idle')
  const orbRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const micReq = useRef(0) // bumped to drop a getUserMedia that resolves after Stop
  const alive = useRef(true)
  const done = useRef(onDone)
  const failed = useRef(onFail)
  useLayoutEffect(() => {
    done.current = onDone
    failed.current = onFail
  })

  // stop the mic if the view closes mid-recording
  useEffect(() => {
    const rec = recRef
    const req = micReq
    alive.current = true
    return () => {
      alive.current = false
      req.current++
      if (rec.current?.state === 'recording') rec.current.stop()
    }
  }, [])

  function stop() {
    if (recRef.current?.state === 'recording') recRef.current.stop()
    else { micReq.current++; setPhase('idle') } // still on the permission prompt: cancel
  }

  async function start(given?: Promise<MediaStream>) {
    const id = ++micReq.current
    setPhase('requesting')
    try {
      const stream = await (given ?? navigator.mediaDevices.getUserMedia({ audio: true }))
      if (!alive.current || id !== micReq.current) return stream.getTracks().forEach((t) => t.stop())
      let rec: MediaRecorder
      try { rec = new MediaRecorder(stream) } catch (err) {
        stream.getTracks().forEach((t) => t.stop())
        throw err
      }
      const chunks: Blob[] = []
      const timer = setTimeout(() => rec.state === 'recording' && rec.stop(), MAX_REC_MS)
      let meter: ReturnType<typeof setInterval> | undefined
      let audio: AudioContext | undefined
      let noSpeech = false
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = () => {
        clearTimeout(timer)
        clearInterval(meter)
        void audio?.close()
        stream.getTracks().forEach((t) => t.stop())
        recRef.current = null
        if (!alive.current) return
        setPhase('idle')
        if (noSpeech) failed.current('No speech heard. Try again.')
        else done.current(new Blob(chunks, { type: rec.mimeType }))
      }
      recRef.current = rec
      try { rec.start() } catch (err) {
        clearTimeout(timer)
        recRef.current = null
        stream.getTracks().forEach((t) => t.stop())
        throw err
      }
      setPhase('rec')
      try {
        audio = new AudioContext()
        const analyser = audio.createAnalyser()
        analyser.fftSize = 2048
        audio.createMediaStreamSource(stream).connect(analyser)
        if (audio.state === 'suspended') void audio.resume().catch(() => {})
        const samples = new Uint8Array(analyser.fftSize)
        const started = performance.now()
        let voiceMs = 0
        let lastVoice = started
        meter = setInterval(() => {
          if (rec.state !== 'recording' || audio?.state !== 'running') return
          analyser.getByteTimeDomainData(samples)
          let sum = 0
          for (const sample of samples) sum += ((sample - 128) / 128) ** 2
          const level = Math.sqrt(sum / samples.length)
          orbRef.current?.style.setProperty('--level', String(Math.min(1, level * 6)))
          const now = performance.now()
          if (level > 0.018) {
            voiceMs += 100
            lastVoice = now
          }
          if (voiceMs >= 200 && now - lastVoice >= SILENCE_MS) rec.stop()
          else if (voiceMs < 200 && now - started >= NO_SPEECH_MS) { noSpeech = true; rec.stop() }
        }, 100)
      } catch (err) {
        console.error('[mic level]', err)
      }
    } catch (err) {
      console.error('[mic]', err)
      if (alive.current && id === micReq.current) {
        setPhase('idle')
        failed.current('Microphone not available. Type instead.')
      }
    }
  }

  return { phase, orbRef, start, stop }
}
