import { useEffect, useMemo, useRef, useState } from 'react'
import AvatarFace from './components/AvatarFace'
import TulipLogo from './components/TulipLogo'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function makeId() {
  return Math.random().toString(36).slice(2)
}

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [apiOnline, setApiOnline] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [avatarState, setAvatarState] = useState('idle')
  const [textInput, setTextInput] = useState('')
  const [messages, setMessages] = useState([
    { id: makeId(), role: 'assistant', text: 'Hello. I can chat by text now and voice later.' }
  ])
  const [loading, setLoading] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [micStatus, setMicStatus] = useState('unknown')
  const [micName, setMicName] = useState('Not detected')
  const [micLevel, setMicLevel] = useState(0)
  const recognitionRef = useRef(null)
  const micStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const meterRafRef = useRef(null)

  const reconnectApi = async () => {
    setConnecting(true)
    try {
      const healthRes = await fetch(`${API_BASE_URL}/health`)
      if (!healthRes.ok) throw new Error('Health check failed')

      const sessionRes = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'demo-user', channel: 'web' })
      })
      if (!sessionRes.ok) throw new Error('Session create failed')

      const data = await sessionRes.json()
      setSessionId(data.session_id)
      setApiOnline(true)
    } catch (_err) {
      setApiOnline(false)
    } finally {
      setConnecting(false)
    }
  }

  useEffect(() => {
    reconnectApi()
  }, [])

  useEffect(() => {
    return () => {
      if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const canUseSpeech = useMemo(() => {
    return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  }, [])

  const stopMicMeter = () => {
    if (meterRafRef.current) {
      cancelAnimationFrame(meterRafRef.current)
      meterRafRef.current = null
    }
    setMicLevel(0)
  }

  const startMicMeter = (stream) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return

    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    const audioContext = new AudioContextClass()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sumSquares = 0
      for (let i = 0; i < data.length; i += 1) {
        const normalized = (data[i] - 128) / 128
        sumSquares += normalized * normalized
      }
      const rms = Math.sqrt(sumSquares / data.length)
      const normalizedLevel = Math.min(100, Math.round(rms * 280))
      setMicLevel(normalizedLevel)
      meterRafRef.current = requestAnimationFrame(tick)
    }

    audioContextRef.current = audioContext
    analyserRef.current = analyser
    meterRafRef.current = requestAnimationFrame(tick)
  }

  const checkMicrophone = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setMicStatus('unsupported')
      setMicName('Browser does not support microphone access')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      micStreamRef.current = stream
      setMicStatus('ready')

      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack?.label) {
        setMicName(audioTrack.label)
      } else {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const firstMic = devices.find((d) => d.kind === 'audioinput')
        setMicName(firstMic?.label || 'Microphone access granted')
      }

      stopMicMeter()
      startMicMeter(stream)
    } catch (_err) {
      setMicStatus('blocked')
      setMicName('Permission blocked or no microphone found')
      stopMicMeter()
    }
  }

  const handleStartVoice = () => {
    if (!canUseSpeech) {
      alert('Speech recognition is not supported in this browser.')
      return
    }
    checkMicrophone()

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = true

    recognition.onstart = () => {
      setVoiceActive(true)
      setAvatarState('listening')
    }

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript
      }
      setTextInput(transcript)
    }

    recognition.onerror = () => {
      setVoiceActive(false)
      setAvatarState('idle')
    }

    recognition.onend = () => {
      setVoiceActive(false)
      setAvatarState('idle')
    }

    recognition.start()
    recognitionRef.current = recognition
  }

  const handleStopVoice = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setVoiceActive(false)
    setAvatarState('idle')
    stopMicMeter()
  }

  const sendText = async () => {
    const trimmed = textInput.trim()
    if (!trimmed || loading) return

    setMessages((prev) => [...prev, { id: makeId(), role: 'user', text: trimmed }])
    setTextInput('')
    setLoading(true)
    setAvatarState('thinking')

    try {
      const res = await fetch(`${API_BASE_URL}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: trimmed,
          mode: 'text'
        })
      })
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      setApiOnline(true)
      const answer = data.reply || 'I heard you. What should I do next?'

      setAvatarState('speaking')
      setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text: answer }])

      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(answer)
        utterance.onend = () => setAvatarState('happy')
        window.speechSynthesis.speak(utterance)
      } else {
        setAvatarState('happy')
      }

      setTimeout(() => setAvatarState('idle'), 900)
    } catch (_err) {
      setApiOnline(false)
      setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text: 'Unable to reach API. Please try again.' }])
      setAvatarState('idle')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    sendText()
  }

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">
          <TulipLogo />
          <div>
            <h1>Tulip Voice Agent</h1>
            <p>Voice + text assistant with expressive avatar</p>
          </div>
        </div>
        <span className="status">{sessionId ? `Session ${sessionId.slice(0, 8)}` : 'Starting session...'}</span>
      </header>
      {!apiOnline && (
        <div className="api-warning">
          <span>API offline at {API_BASE_URL}</span>
          <button className="btn secondary reconnect-btn" onClick={reconnectApi} disabled={connecting}>
            {connecting ? 'Reconnecting...' : 'Reconnect'}
          </button>
        </div>
      )}

      <main className="grid">
        <section className="card avatar-card">
          <AvatarFace state={avatarState} />
          <div className="mic-panel">
            <div className="mic-row">
              <strong>Microphone:</strong>
              <span className={`mic-state mic-${micStatus}`}>{micStatus}</span>
            </div>
            <div className="mic-name" title={micName}>{micName}</div>
            <div className="mic-meter">
              <div className="mic-meter-fill" style={{ width: `${micLevel}%` }} />
            </div>
            <button className="btn secondary mic-check-btn" onClick={checkMicrophone}>Check Mic</button>
          </div>
          <div className="voice-controls">
            <button className="btn" onClick={handleStartVoice} disabled={voiceActive}>Start Voice</button>
            <button className="btn secondary" onClick={handleStopVoice} disabled={!voiceActive}>Stop Voice</button>
          </div>
          <p className="hint">Voice input uses browser speech recognition for MVP preview.</p>
        </section>

        <section className="card chat-card">
          <div className="chat-window">
            {messages.map((msg) => (
              <div key={msg.id} className={`bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <form className="chat-form" onSubmit={onSubmit}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type or use voice, then send"
            />
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send'}</button>
          </form>
        </section>
      </main>
    </div>
  )
}
