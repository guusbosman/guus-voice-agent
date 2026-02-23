import { useEffect, useMemo, useRef, useState } from 'react'
import AvatarFace from './components/AvatarFace'
import TulipLogo from './components/TulipLogo'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function makeId() {
  return Math.random().toString(36).slice(2)
}

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [avatarState, setAvatarState] = useState('idle')
  const [textInput, setTextInput] = useState('')
  const [messages, setMessages] = useState([
    { id: makeId(), role: 'assistant', text: 'Hello. I can chat by text now and voice later.' }
  ])
  const [loading, setLoading] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const createSession = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: 'demo-user', channel: 'web' })
        })
        if (!res.ok) return
        const data = await res.json()
        setSessionId(data.session_id)
      } catch (_err) {
        // Keep UI functional in offline mode.
      }
    }

    createSession()
  }, [])

  const canUseSpeech = useMemo(() => {
    return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  }, [])

  const handleStartVoice = () => {
    if (!canUseSpeech) {
      alert('Speech recognition is not supported in this browser.')
      return
    }

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

      <main className="grid">
        <section className="card avatar-card">
          <AvatarFace state={avatarState} />
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
