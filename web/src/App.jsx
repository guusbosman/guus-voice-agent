import { useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track } from 'livekit-client'
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
  const [voiceConnecting, setVoiceConnecting] = useState(false)
  const [avatarState, setAvatarState] = useState('idle')
  const [roomName, setRoomName] = useState('')
  const [textInput, setTextInput] = useState('')
  const [messages, setMessages] = useState([
    { id: makeId(), role: 'assistant', text: 'Hello. I can chat by text now and voice later.' }
  ])
  const [loading, setLoading] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [micStatus, setMicStatus] = useState('unknown')
  const [micName, setMicName] = useState('Not detected')
  const [micLevel, setMicLevel] = useState(0)
  const [micSensitivity, setMicSensitivity] = useState(2.6)
  const roomRef = useRef(null)
  const micStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const meterRafRef = useRef(null)
  const micSensitivityRef = useRef(2.6)
  const remoteAudioContainerRef = useRef(null)
  const remoteAudioElementsRef = useRef(new Map())
  const remoteAudioCountRef = useRef(0)

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
      if (roomRef.current) {
        roomRef.current.disconnect()
      }
      remoteAudioElementsRef.current.forEach((el) => el.remove())
    }
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
      const normalizedLevel = Math.min(100, Math.round(rms * 280 * micSensitivityRef.current))
      setMicLevel(normalizedLevel)
      meterRafRef.current = requestAnimationFrame(tick)
    }

    audioContextRef.current = audioContext
    meterRafRef.current = requestAnimationFrame(tick)
  }

  const checkMicrophone = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setMicStatus('unsupported')
      setMicName('Browser does not support microphone access')
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
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
      return true
    } catch (_err) {
      setMicStatus('blocked')
      setMicName('Permission blocked or no microphone found')
      stopMicMeter()
      return false
    }
  }

  const cleanupRemoteAudio = () => {
    remoteAudioElementsRef.current.forEach((el) => el.remove())
    remoteAudioElementsRef.current.clear()
    remoteAudioCountRef.current = 0
  }

  const registerRoomListeners = (room) => {
    room.on(RoomEvent.TrackSubscribed, (track, _pub, _participant) => {
      if (track.kind !== Track.Kind.Audio) return
      const audioElement = track.attach()
      audioElement.autoplay = true
      audioElement.playsInline = true
      remoteAudioElementsRef.current.set(track.sid, audioElement)
      remoteAudioContainerRef.current?.appendChild(audioElement)
      remoteAudioCountRef.current += 1
      setAvatarState('speaking')
    })

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return
      const el = remoteAudioElementsRef.current.get(track.sid)
      if (el) {
        track.detach(el)
        el.remove()
        remoteAudioElementsRef.current.delete(track.sid)
      }
      remoteAudioCountRef.current = Math.max(0, remoteAudioCountRef.current - 1)
      setAvatarState(remoteAudioCountRef.current > 0 ? 'speaking' : 'listening')
    })

    room.on(RoomEvent.Reconnecting, () => setAvatarState('thinking'))
    room.on(RoomEvent.Reconnected, () => setAvatarState('listening'))
    room.on(RoomEvent.Disconnected, () => {
      setVoiceActive(false)
      setVoiceConnecting(false)
      setAvatarState('idle')
      cleanupRemoteAudio()
    })
  }

  const handleStartVoice = async () => {
    if (voiceActive || voiceConnecting) return
    setVoiceConnecting(true)
    setAvatarState('thinking')

    try {
      const micOk = await checkMicrophone()
      if (!micOk) throw new Error('Microphone not available')

      const tokenRes = await fetch(`${API_BASE_URL}/livekit/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'demo-user' })
      })
      if (!tokenRes.ok) throw new Error('Unable to mint LiveKit token')
      const tokenData = await tokenRes.json()
      setSessionId(tokenData.session_id)
      setRoomName(tokenData.room_name)

      const room = new Room({
        adaptiveStream: true,
        dynacast: true
      })
      registerRoomListeners(room)

      await room.connect(tokenData.livekit_url, tokenData.participant_token)
      await room.localParticipant.setMicrophoneEnabled(true)
      roomRef.current = room

      setVoiceActive(true)
      setVoiceConnecting(false)
      setApiOnline(true)
      setAvatarState('listening')
    } catch (_err) {
      setVoiceActive(false)
      setVoiceConnecting(false)
      setAvatarState('idle')
      setApiOnline(false)
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          text: 'Voice session failed to start. Check API, LiveKit credentials, and microphone permissions.'
        }
      ])
    }
  }

  const handleStopVoice = async () => {
    if (roomRef.current) {
      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(false)
      } catch (_err) {
        // no-op: best effort shutdown
      }
      roomRef.current.disconnect()
      roomRef.current = null
    }
    cleanupRemoteAudio()
    setVoiceActive(false)
    setAvatarState('idle')
    stopMicMeter()
  }

  const handleSensitivityChange = (event) => {
    const next = Number(event.target.value)
    setMicSensitivity(next)
    micSensitivityRef.current = next
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
          {roomName && <div className="voice-room">Live room: {roomName}</div>}
          <div className="mic-panel">
            <div className="mic-row">
              <strong>Microphone:</strong>
              <span className={`mic-state mic-${micStatus}`}>{micStatus}</span>
            </div>
            <div className="mic-name" title={micName}>{micName}</div>
            <div className="mic-meter">
              <div className="mic-meter-fill" style={{ width: `${micLevel}%` }} />
            </div>
            <div className="mic-sensitivity">
              <label htmlFor="mic-sensitivity">Mic Sensitivity</label>
              <input
                id="mic-sensitivity"
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={micSensitivity}
                onChange={handleSensitivityChange}
              />
              <span>{micSensitivity.toFixed(1)}x</span>
            </div>
            <button className="btn secondary mic-check-btn" onClick={checkMicrophone}>Check Mic</button>
          </div>
          <div className="voice-controls">
            <button className="btn" onClick={handleStartVoice} disabled={voiceActive || voiceConnecting}>
              {voiceConnecting ? 'Connecting...' : 'Start Voice'}
            </button>
            <button className="btn secondary" onClick={handleStopVoice} disabled={!voiceActive}>Stop Voice</button>
          </div>
          <p className="hint">Voice uses LiveKit room streaming; text remains a fallback.</p>
          <div ref={remoteAudioContainerRef} className="remote-audio-container" />
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
