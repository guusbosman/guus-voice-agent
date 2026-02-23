# Avatar UI (Basic Animated Face)

## Goal

Provide a lightweight visual companion during voice conversations without building full video/avatar generation.

## MVP Approach

Render a simple 2D face in the browser (Canvas or SVG) and animate it based on conversation events.

States:

- `idle`
- `listening`
- `thinking`
- `speaking`
- `happy`

## Event To Animation Mapping

- `session.started` -> `idle`
- `turn.user.started` -> `listening`
- `turn.user.final` -> `thinking`
- `turn.agent.started` -> `speaking`
- `turn.agent.final` -> `idle`
- `turn.interrupted` -> brief `thinking`, then `listening`
- tool success or positive confirmation -> brief `happy` pulse

## Animation Behaviors

- `idle`: slow blink every 3-6 seconds, subtle breathing scale.
- `listening`: slight forward tilt, attentive eyes.
- `thinking`: tiny side-to-side eye motion, soft pulse.
- `speaking`: mouth open/close loop at fixed rhythm (not lip-synced in MVP).
- `happy`: quick smile curve + one nod.

## Implementation Notes

- Keep animation frame-rate capped (`requestAnimationFrame` + delta checks).
- Use state machine logic instead of ad-hoc booleans.
- Set max state duration for `thinking` fallback (for example 8 seconds) to avoid stuck UI.
- Add mute visual indicator when user mic is muted.

## Tech Options

1. Fastest:
- SVG + CSS keyframes + small state reducer.

2. More control:
- Canvas rendering + simple timeline controller.

3. If already using React motion libs:
- Framer Motion with variants per state.

## Acceptance Criteria

- State changes are visible within 150 ms of event receipt.
- No dropped animation frames on typical laptop/mobile browser.
- Avatar always recovers to `idle` after session end or error.
- UX clearly differentiates listening vs speaking states.

## Future Upgrades (Optional)

- Amplitude-reactive mouth animation using audio level.
- Multiple avatar skins/themes.
- Optional WebGL face rig if richer expression is needed.
