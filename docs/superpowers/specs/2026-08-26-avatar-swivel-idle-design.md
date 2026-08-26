# Avatar Swivel And Idle Design

## Goal

After the office first becomes visible, the avatar types for five seconds, swivels with the chair toward the camera, transitions into a seated idle animation, and remains facing the visitor.

The turn should feel natural rather than staged: the chair and torso cover 80% of the camera-facing yaw, while a restrained head adjustment completes the look.

## Behavior

1. Start the five-second delay after the first rendered frame, not at navigation start. Scene loading time must not consume the typing period.
2. Keep the existing typing animation, seat alignment, keyboard position, and hand correction unchanged during the typing phase.
3. After five seconds, begin the animation crossfade and chair swivel together.
4. Crossfade from `Typing.fbx` to `Seated Idle.fbx` without snapping the skeleton.
5. Ease the shared chair/avatar pivot toward the camera over 1.4 seconds.
6. Apply 80% of the required camera-facing yaw to the chair and torso. Add a clamped head adjustment for the remaining angle.
7. Blend out the typing-specific hand correction during the transition so it does not distort the idle pose.
8. Remain in seated idle, facing the camera. Do not return to typing and do not repeat the sequence.

## Architecture

### Shared Swivel Rig

Create one `THREE.Group` centered on the chair's swivel axis. Attach the existing `chair` object and avatar root to this group with world transforms preserved. Rotating this single group keeps the avatar seated relative to the chair and avoids independent-transform drift.

The rig owns only the shared yaw. It must not alter the chair model, avatar scale, seat correction, or animation tracks.

### Avatar Animation Controller

Separate animation loading/retargeting from action playback. Cache both retargeted clips before the interaction begins so the transition does not fetch or retarget animation data after the five-second timer fires.

The controller has three states:

- `typing`: typing action active; keyboard hand correction fully applied.
- `turning`: typing fades out while seated idle fades in; swivel and head-look weights ease toward their targets; hand correction fades to zero.
- `idle`: seated idle loops; swivel remains at its final yaw; head look remains active.

Only one transition from `typing` to `turning` is allowed.

### Camera-Facing Turn

Compute the desired yaw from the chair pivot to the active camera projected onto the floor plane. Apply 80% of that yaw to the shared rig rather than hardcoding an angle. This preserves the intended behavior if camera 1 is adjusted later.

The head adjustment runs after `AnimationMixer.update`, because the mixer overwrites animated bone quaternions every frame. It eases in during the turn and applies the remaining camera-facing rotation, clamped to 25 degrees of yaw and 10 degrees of pitch. The head must not track camera movement continuously after the final pose; the interaction is a one-time authored turn for the active camera.

## Timing

- Typing delay: 5 seconds after first rendered frame.
- Swivel duration: 1.4 seconds.
- Animation crossfade: 0.6 seconds, starting with the swivel.
- Head-look blend: follows the swivel easing and reaches full weight near the end.

Use a smooth ease-in/ease-out curve so the chair does not start or stop abruptly.

## Assets

- Keep `/models/anims/Typing.fbx`.
- Copy `references/animations/Seated Idle.fbx` to `/models/anims/Seated Idle.fbx`.
- Do not modify the Blender source or office GLB for this interaction.

## Failure Handling

- If the chair object is missing, fail during startup with a descriptive error rather than rotating the avatar alone.
- If the idle animation is missing or invalid, retain the existing startup error overlay.
- If a head bone is unavailable, complete the shared swivel and idle crossfade without head adjustment.

## Verification

1. Production typecheck and build complete successfully.
2. The avatar visibly types for five seconds after the first frame.
3. The chair and avatar rotate together without seat drift, desk clipping, or foot sliding relative to the chair.
4. Typing crossfades into seated idle without a T-pose or skeleton snap.
5. The typing-specific hand correction disappears smoothly during the transition.
6. The final chair angle is natural and the head faces the camera without excessive neck rotation.
7. The avatar remains in seated idle and the transition does not repeat.
8. Existing room geometry, lighting, camera framing, keyboard placement, and load overlay remain unchanged.
