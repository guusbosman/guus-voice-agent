const AVATAR_MESSAGES = {
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  happy: 'Happy'
}

export default function AvatarFace({ state = 'idle' }) {
  return (
    <div className={`avatar-shell avatar-${state}`}>
      <div className="avatar-head">
        <div className="avatar-eyes">
          <span className="eye" />
          <span className="eye" />
        </div>
        <div className="avatar-mouth" />
      </div>
      <p className="avatar-state">{AVATAR_MESSAGES[state] || 'Ready'}</p>
    </div>
  )
}
