# Avatar Camera Tracking And Hand Clearance Design

## Goal

Keep the avatar's right hand clear of the desk in seated idle and make the head and eyes continuously follow the active camera after the swivel begins.

The tracking must preserve the seated animation, move naturally, and keep both eyes aligned so the avatar never appears cross-eyed.

## Measured Problems

- In final idle, the right wrist is at `y=0.7287` while the desk/keyboard plane is at `y=0.7463`, placing the wrist about 1.8cm inside the desk.
- The final head gaze is 20.49 degrees below the camera direction because the seated-idle clip starts with a downward head pose and the existing fixed correction assumes a level animated head.
- A live `-0.15 rad` local-X correction on `RightForeArm` raises the wrist to `y=0.7472`, approximately 1.85cm, without translating or stretching the hand bone.

## Behavior

1. Preserve the approved typing pose and keyboard contact before the swivel.
2. As the swivel begins, blend in an idle-only `-0.15 rad` local-X correction on `RightForeArm` while the typing hand correction blends out.
3. Activate camera tracking with the swivel progress; no head or eye snap is allowed at the transition boundary.
4. Recalculate the camera direction every rendered frame after `AnimationMixer.update` so tracking follows camera movement and compensates for the current animation pose.
5. The head follows smoothly and more slowly than the eyes.
6. Both eyes use one shared yaw/pitch target derived from their midpoint and receive identical local rotational offsets. Independent per-eye convergence is forbidden.
7. Clamp head and eye rotations to natural ranges. If the camera moves beyond those ranges, tracking saturates instead of twisting bones.
8. Continue tracking in seated idle. Existing chair swivel, crossfade, seat placement, room, keyboard, and timing behavior remain unchanged.

## Architecture

### Pose Adjustment

Keep typing-hand correction and idle right-forearm clearance in `applyPoseAdjustment`. Use the existing typing `handWeight`; the idle correction weight is `1 - handWeight`. The right forearm receives the typing correction during typing and smoothly transitions to the `-0.15 rad` idle correction.

### Camera Look Controller

Add a focused post-mixer look controller in `avatar.ts`. The avatar handle stores references to `Head`, `LeftEye`, and `RightEye`, plus smoothed head and eye yaw/pitch state.

Each frame after mixer update and hand adjustment:

1. Transform the camera direction into the head-parent coordinate space.
2. Derive the yaw and pitch needed to correct the current animated head pose toward camera.
3. Clamp and exponentially damp the head correction.
4. Apply the head correction additively to the mixer-produced head quaternion.
5. Recalculate the residual camera direction after the head correction.
6. Derive one eye yaw/pitch pair from the midpoint of both eyes.
7. Clamp and damp that shared pair, then multiply the same correction quaternion into both eye bones.

The solver must reuse vectors, quaternions, matrices, and Euler objects rather than allocating every frame.

### Tracking Limits

- Head: maximum 30 degrees yaw and 25 degrees pitch; response rate 6 per second.
- Eyes: maximum 12 degrees yaw and 8 degrees pitch; response rate 12 per second.
- Activation weight: existing swivel progress, from zero at five seconds to one at the end of the 1.4-second swivel.

These values are initial limits and may be reduced during visual verification, but must not be increased beyond the stated maxima without user approval.

## Data Model Changes

Replace fixed `headYaw` and `headPitch` timeline outputs with a `lookWeight`. The swivel timeline remains responsible for the chair yaw, phase, typing-hand weight, and activation progress; the live camera-look controller owns head and eye angles.

This removes the incorrect assumption that one head offset can remain valid while the camera or idle animation moves.

## Failure Handling

- If `Head` is missing, skip all tracking.
- If either eye bone is missing, track the head only; do not move a single eye independently.
- Camera tracking failure must not interrupt the chair swivel or animation crossfade.

## Verification

1. Unit tests confirm the right-forearm idle correction replaces, rather than stacks with, typing correction.
2. Unit tests confirm both eye bones receive exactly the same correction quaternion.
3. Unit tests confirm damping is frame-rate independent and all limits clamp correctly.
4. Browser measurement confirms the final right wrist is approximately 2cm higher and no longer intersects the desk.
5. Browser measurement confirms the head gaze closely matches the camera direction in final idle.
6. Move the active camera after idle and confirm head and both eyes follow continuously.
7. Confirm eye rotations remain conjugate and never diverge toward each other.
8. Confirm tracking begins with the swivel, blends without snapping, and remains active in idle.
9. Existing 20 tests and production build remain passing; new tracking tests also pass.
