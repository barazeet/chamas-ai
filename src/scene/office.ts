import * as THREE from 'three';

// Palette matched to the reference photos: white standing desk, black
// leather/mat/tower, warm beige tile floor, dark screens.
const WHITE_DESK = new THREE.MeshStandardMaterial({ color: 0xe9e7e3, roughness: 0.6 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.6 });
const PLASTIC = new THREE.MeshStandardMaterial({ color: 0x232529, roughness: 0.5 });
const MAT = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.95 });
const LEATHER = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.55 });
const RED_MIC = new THREE.MeshStandardMaterial({ color: 0xa8282a, roughness: 0.5 });
const CAGE = new THREE.MeshStandardMaterial({ color: 0x4a5058, wireframe: true });
const LED = new THREE.MeshStandardMaterial({
  color: 0x001133, emissive: 0x2266ff, emissiveIntensity: 2.0,
});
const CABLE_DARK = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.9 });
const CABLE_WHITE = new THREE.MeshStandardMaterial({ color: 0xd8d5d0, roughness: 0.8 });
const CABLE_BLUE = new THREE.MeshStandardMaterial({ color: 0x2b5f9e, roughness: 0.8 });
const WALL = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 1 });
const SKY = new THREE.MeshStandardMaterial({
  color: 0xdfe9f2, emissive: 0xcfe0ee, emissiveIntensity: 0.7,
});
const RED_CAN = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });
// Template for screen materials — always .clone() it, never mutate in place:
const SCREEN_OFF = new THREE.MeshStandardMaterial({
  color: 0x0a0c10, emissive: 0x12161d, emissiveIntensity: 0.8,
});
const FLOOR = new THREE.MeshStandardMaterial({ color: 0xd8cfc4, roughness: 1 });

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

function cable(
  name: string,
  points: Array<[number, number, number]>,
  material: THREE.Material,
  radius = 0.008,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 6), material);
  mesh.name = name;
  return mesh;
}

function buildMonitor(name: string, x: number, angle: number): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  // slim bezel frame behind the panel
  group.add(box('bezel', 0.64, 0.38, 0.02, 0, 0.28, -0.01, DARK));
  group.add(box('screen', 0.62, 0.36, 0.015, 0, 0.28, 0.002, SCREEN_OFF.clone()));
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

  // Large dark desk mat covering the work area
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

  // Red HyperX-style mic: cylinder, shock-mount ring, round base
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

  // Rounded mouse (squashed sphere)
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 12), PLASTIC);
  mouse.scale.set(0.7, 0.35, 1.1);
  mouse.position.set(0.28, 0.795, 0.18);
  mouse.name = 'mouse';
  office.add(mouse);

  office.add(box('controller', 0.14, 0.05, 0.1, -0.58, 0.81, 0.08, PLASTIC));

  // Desk clutter from the photos: red can, red box, white power strip
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 16), RED_CAN);
  can.position.set(-0.34, 0.83, -0.14);
  can.name = 'can';
  office.add(can);
  office.add(box('red-box', 0.12, 0.05, 0.08, 0.14, 0.81, -0.2, RED_CAN));
  office.add(box('power-strip', 0.16, 0.035, 0.06, 0.46, 0.8, -0.22, WHITE_DESK));

  // Laptop on an elevated stand, to the right, dark screen
  const laptop = new THREE.Group();
  laptop.name = 'laptop';
  laptop.add(box('laptop-stand', 0.26, 0.12, 0.2, 0, 0.06, 0, DARK));
  laptop.add(box('laptop-base', 0.33, 0.015, 0.23, 0, 0.13, 0, PLASTIC));
  laptop.add(box('laptop-lid', 0.33, 0.22, 0.012, 0, 0.23, -0.11, SCREEN_OFF.clone()));
  laptop.position.set(0.72, 0.785, 0.02);
  // Lid faces the room (visible from the camera side, like the photos)
  laptop.rotation.y = 0.7;
  office.add(laptop);

  // Tower in the DIY wire-mesh cage, floor left; blue LED fans glow through
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

  // UPS on the floor under the right side, blue LCD (from the photos)
  const ups = new THREE.Group();
  ups.name = 'ups';
  ups.add(box('ups-body', 0.18, 0.32, 0.34, 0, 0.16, 0, DARK));
  const upsLcd = box('ups-lcd', 0.08, 0.03, 0.01, 0, 0.26, 0.176, LED);
  ups.add(upsLcd);
  ups.position.set(0.92, 0, 0.25);
  office.add(ups);

  // Cable runs: monitors down behind the desk, mic, laptop (white), cage
  office.add(cable('cable-monitor-left', [
    [-0.36, 1.05, -0.33], [-0.5, 0.85, -0.42], [-0.68, 0.45, -0.42], [-0.8, 0.05, -0.35],
  ], CABLE_DARK));
  office.add(cable('cable-monitor-right', [
    [0.36, 1.05, -0.33], [0.46, 0.82, -0.4], [0.56, 0.4, -0.38], [0.62, 0.05, -0.28],
  ], CABLE_DARK));
  office.add(cable('cable-mic', [
    [-0.05, 0.79, -0.03], [-0.16, 0.68, -0.3], [-0.26, 0.3, -0.4], [-0.3, 0.05, -0.35],
  ], CABLE_DARK, 0.006));
  office.add(cable('cable-laptop', [
    [0.74, 0.86, 0.05], [0.86, 0.78, 0.14], [0.9, 0.4, 0.18], [0.88, 0.04, 0.22],
  ], CABLE_WHITE, 0.006));
  office.add(cable('cable-cage', [
    [-1.05, 0.5, 0.0], [-0.95, 0.75, -0.15], [-0.85, 0.78, -0.25],
  ], CABLE_DARK, 0.01));

  // High-back black leather chair between desk and camera
  const chair = new THREE.Group();
  chair.name = 'chair';
  chair.add(box('chair-seat', 0.5, 0.07, 0.45, 0, 0.45, 0, LEATHER));
  const chairBack = box('chair-back', 0.46, 0.7, 0.07, 0, 0.95, 0.26, LEATHER);
  chairBack.rotation.x = -0.12;
  chair.add(chairBack);
  chair.add(box('chair-post', 0.06, 0.4, 0.06, 0, 0.2, 0, DARK));
  chair.position.set(0, 0, 0.62);
  // Backrest faces the desk (-z), so the seated avatar is visible from the camera.
  chair.rotation.y = Math.PI;
  office.add(chair);

  // Room: back wall, left wall, black-framed window with sky, coiled blue
  // ethernet cable hanging under it (all straight from the photos)
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), WALL);
  backWall.position.set(0, 1.7, -1.6);
  backWall.name = 'back-wall';
  office.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.4), WALL);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-2.2, 1.7, 0.4);
  leftWall.name = 'left-wall';
  office.add(leftWall);

  const windowGroup = new THREE.Group();
  windowGroup.name = 'window';
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), SKY);
  windowGroup.add(sky);
  // black frame: outer border + cross mullion
  const frame = [
    box('frame-top', 1.42, 0.06, 0.04, 0, 0.58, 0.01, DARK),
    box('frame-bottom', 1.42, 0.06, 0.04, 0, -0.58, 0.01, DARK),
    box('frame-left', 0.06, 1.22, 0.04, -0.68, 0, 0.01, DARK),
    box('frame-right', 0.06, 1.22, 0.04, 0.68, 0, 0.01, DARK),
    box('frame-mid-h', 1.3, 0.03, 0.03, 0, 0.1, 0.01, DARK),
  ];
  for (const f of frame) windowGroup.add(f);
  windowGroup.rotation.y = Math.PI / 2;
  windowGroup.position.set(-2.18, 1.7, -0.5);
  office.add(windowGroup);

  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 32), CABLE_BLUE);
  coil.rotation.y = Math.PI / 2;
  coil.position.set(-2.16, 1.0, -0.15);
  coil.name = 'cable-coil';
  office.add(coil);
  office.add(cable('cable-coil-tail', [
    [-2.16, 0.92, -0.15], [-2.16, 0.6, -0.12], [-2.16, 0.35, -0.05], [-1.6, 0.1, 0.05],
  ], CABLE_BLUE, 0.01));

  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), FLOOR);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  office.add(floor);

  return office;
}
