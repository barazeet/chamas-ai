import * as THREE from 'three';

// Palette taken from the real desk photos in references/
const WHITE_DESK = new THREE.MeshStandardMaterial({ color: 0xe9e7e3, roughness: 0.6 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.6 });
const PLASTIC = new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.5 });
const MAT = new THREE.MeshStandardMaterial({ color: 0x1f2228, roughness: 0.9 });
const RED_MIC = new THREE.MeshStandardMaterial({ color: 0xb03030, roughness: 0.5 });
const CAGE = new THREE.MeshStandardMaterial({ color: 0x555c66, wireframe: true });
const LED = new THREE.MeshStandardMaterial({
  color: 0x001133, emissive: 0x2266ff, emissiveIntensity: 2.0,
});
// Template for screen materials — always .clone() it, never mutate in place:
// each screen needs its own instance so textures can be attached per-screen.
const SCREEN_OFF = new THREE.MeshStandardMaterial({
  color: 0x0a0c10, emissive: 0x16202e, emissiveIntensity: 0.6,
});
const WINDOW_GLOW = new THREE.MeshStandardMaterial({
  color: 0x30363f, emissive: 0xbfd4e6, emissiveIntensity: 0.9,
});
const FLOOR = new THREE.MeshStandardMaterial({ color: 0xcfc9c0, roughness: 1 });

function box(
  name: string,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.name = name;
  return mesh;
}

function buildMonitor(name: string, x: number, angle: number): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  // bezel: dark frame slightly larger than the screen, sitting behind it
  group.add(box('bezel', 0.66, 0.4, 0.025, 0, 0.28, -0.012, DARK));
  group.add(box('screen', 0.62, 0.36, 0.03, 0, 0.28, 0.004, SCREEN_OFF.clone()));
  group.add(box('arm-mount', 0.08, 0.08, 0.06, 0, 0.22, -0.06, DARK));
  group.position.set(x, 0.86, -0.3);
  group.rotation.y = angle;
  return group;
}

export function buildOffice(): THREE.Group {
  const office = new THREE.Group();
  office.name = 'office';

  // White standing desk with T-legs + height control panel under the right edge
  office.add(box('desk', 1.9, 0.04, 0.8, 0, 0.76, -0.05, WHITE_DESK));
  office.add(box('desk-controls', 0.14, 0.02, 0.06, 0.68, 0.735, 0.3, DARK));
  for (const [side, label] of [[-1, 'left'], [1, 'right']] as const) {
    office.add(box(`desk-column-${label}`, 0.08, 0.72, 0.08, side * 0.8, 0.38, -0.05, WHITE_DESK));
    office.add(box(`desk-foot-${label}`, 0.08, 0.03, 0.6, side * 0.8, 0.015, -0.05, WHITE_DESK));
  }

  // Dark desk mat covering most of the surface
  office.add(box('deskmat', 1.25, 0.006, 0.55, -0.1, 0.783, 0.02, MAT));

  // Central monitor arm (pole + horizontal bar), monitors hang from it
  const arm = new THREE.Group();
  arm.name = 'monitor-arm';
  arm.add(box('arm-pole', 0.05, 0.4, 0.05, 0, 0.2, 0, DARK));
  arm.add(box('arm-bar', 0.75, 0.04, 0.04, 0, 0.38, 0, DARK));
  arm.position.set(0, 0.78, -0.32);
  office.add(arm);

  office.add(buildMonitor('monitor-left', -0.36, 0.18));
  office.add(buildMonitor('monitor-right', 0.36, -0.18));

  // Webcam perched on the right monitor
  office.add(box('webcam', 0.09, 0.035, 0.035, 0.36, 1.245, -0.3, DARK));

  // Red mic (HyperX-style cylinder on a round shock-mount base)
  const mic = new THREE.Group();
  mic.name = 'mic';
  const micBody = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.15, 16), RED_MIC);
  micBody.position.y = 0.115;
  mic.add(micBody);
  const micBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.015, 24), DARK);
  micBase.position.y = 0.008;
  mic.add(micBase);
  const micRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 8, 24), DARK);
  micRing.rotation.x = Math.PI / 2;
  micRing.position.y = 0.05;
  mic.add(micRing);
  mic.position.set(-0.05, 0.785, 0.0);
  office.add(mic);

  // Low-profile keyboard with a slight typing tilt
  const keyboard = box('keyboard', 0.4, 0.015, 0.14, -0.05, 0.795, 0.16, PLASTIC);
  keyboard.rotation.x = -0.06;
  office.add(keyboard);

  // Rounded mouse (squashed sphere, not a box)
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 12), PLASTIC);
  mouse.scale.set(0.7, 0.35, 1.1);
  mouse.position.set(0.28, 0.795, 0.18);
  mouse.name = 'mouse';
  office.add(mouse);

  office.add(box('controller', 0.14, 0.05, 0.1, -0.58, 0.81, 0.08, PLASTIC));

  // Laptop on an elevated stand, to the right
  const laptop = new THREE.Group();
  laptop.name = 'laptop';
  laptop.add(box('laptop-stand', 0.26, 0.12, 0.2, 0, 0.06, 0, DARK));
  laptop.add(box('laptop-base', 0.33, 0.015, 0.23, 0, 0.13, 0, PLASTIC));
  laptop.add(box('laptop-lid', 0.33, 0.22, 0.012, 0, 0.23, -0.11, SCREEN_OFF.clone()));
  laptop.position.set(0.72, 0.785, 0.02);
  laptop.rotation.y = -0.45;
  office.add(laptop);

  // Tower inside a wire-mesh cage on the floor, left of the desk.
  // Real thing: black case with blue LED fans glowing through the mesh.
  const towerGroup = new THREE.Group();
  towerGroup.name = 'tower';
  towerGroup.add(box('tower-body', 0.24, 0.5, 0.5, 0, 0.25, 0, PLASTIC));
  for (const fanY of [0.14, 0.3, 0.44]) {
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.015, 24), LED);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(0, fanY, 0.252);
    towerGroup.add(fan);
  }
  towerGroup.position.set(-1.2, 0.06, 0.1);
  office.add(towerGroup);
  office.add(box('cage', 0.44, 0.62, 0.68, -1.2, 0.34, 0.1, CAGE));

  // High-back office chair between desk and camera
  const chair = new THREE.Group();
  chair.name = 'chair';
  chair.add(box('chair-seat', 0.5, 0.07, 0.45, 0, 0.45, 0, DARK));
  const chairBack = box('chair-back', 0.46, 0.7, 0.07, 0, 0.95, 0.26, DARK);
  chairBack.rotation.x = -0.12;
  chair.add(chairBack);
  chair.add(box('chair-post', 0.06, 0.4, 0.06, 0, 0.2, 0, DARK));
  chair.position.set(0, 0, 0.62);
  // Backrest faces the desk (-z), so the seated avatar is visible from the camera.
  chair.rotation.y = Math.PI;
  office.add(chair);

  // Window on the left wall, softly glowing
  const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), WINDOW_GLOW);
  windowPane.rotation.y = Math.PI / 2;
  windowPane.position.set(-2.1, 1.6, -0.4);
  windowPane.name = 'window';
  office.add(windowPane);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), FLOOR);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  office.add(floor);

  return office;
}
