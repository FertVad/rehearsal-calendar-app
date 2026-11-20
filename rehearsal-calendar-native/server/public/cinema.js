/* ============================================================
   Rehearsly — cinematic landing, prototype: the whole page as one
   scene the scroll carries the camera through.

   three.js is served from here, not from a CDN: vendor/three.module.min.js
   is three@0.186.1's build/three.module.js bundled and minified once,
     npx esbuild@0.25.10 three/build/three.module.js --bundle --minify \
       --format=esm --legal-comments=inline
   The words stay HTML over the canvas in all four languages; the scene
   only draws. The page scrolls as any page does — nothing holds the wheel,
   the camera follows the scroll it is given.
   ============================================================ */
import * as THREE from './vendor/three.module.min.js';

const canvas = document.querySelector('.stage');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STILL = /[?&]still\b/.test(location.search);   // no easing: for screenshots

let renderer = null;
if (!reduced) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { renderer = null; }
}
if (!renderer) {
  document.documentElement.classList.add('no-3d');
} else {
  start(renderer);
}

function start(renderer) {
  /* ── What the scene is made of ─────────────────────────── */

  // Day 4 of the demo company as seeded (screens/shots/README.md), in the
  // order the participants sheet lists them, with each person's busy hours.
  // The one hour nobody is busy is 13:00–14:00: the window the form's own
  // screenshot recommends.
  const BUSY = [[[16, 18]], [], [[18, 23]], [[19, 23]], [], [[9, 13]], [[16, 18]], [[14, 17]]];
  const NAMES = {
    ru: ['Марина Белова', 'Ксения Лебедева', 'Алина Морозова', 'Дмитрий Орлов', 'Полина Сафронова', 'Софья Никитина', 'Илья Захаров', 'Артём Ковалёв'],
    en: ['Hannah Clarke', 'Priya Patel', 'Emma Wilson', 'Jake Thompson', 'Sophie Bennett', 'Chloe Evans', 'Daniel Okafor', 'Marcus Reid'],
    es: ['Valentina Ríos', 'Lucía Fernández', 'Camila Torres', 'Mateo Gómez', 'Sofía Méndez', 'Daniela Ortiz', 'Santiago Herrera', 'Joaquín Rivas'],
    de: ['Lena Hoffmann', 'Mia Richter', 'Paula Schulz', 'Jonas Becker', 'Hannah Wolf', 'Elif Yılmaz', 'Felix Wagner', 'Leon Krüger'],
  };
  const GAP_TEXT = {
    ru: ['13:00–14:00', 'Все свободны'],
    en: ['1:00–2:00 PM', 'All available'],
    es: ['13:00–14:00', 'Todos disponibles'],
    de: ['13:00–14:00', 'Alle verfügbar'],
  };
  const hourText = (lang, h) => (lang === 'en'
    ? `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
    : `${String(h).padStart(2, '0')}:00`);

  // The demo's four productions as the projects screen lists them, in each
  // language's own world (screens/shots/README.md).
  const PROJECTS = {
    ru: ['Шоу-балет «Пульс»', 'Клип «Огни»', 'Чайка', 'Новогодний эфир'],
    en: ['Pulse Dance Company', '“Neon” music video', 'Twelfth Night', 'New Year’s Eve Live'],
    es: ['Compañía Pulso', 'Videoclip “Fuego lento”', 'Bodas de sangre', 'Especial de Año Nuevo'],
    de: ['Tanzkompanie Puls', 'Musikvideo „Nachtschicht“', 'Kabale und Liebe', 'Silvestergala'],
  };
  // One person's day in all four: hours marked once, and a rehearsal booked
  // in the first — the calendar's 18:00–21:00 — that the others then lose.
  const MINE = [10, 13];
  const CALL = [18, 21];
  const PROJ_TEXT = {
    ru: { once: 'Отмечено один раз', range: '18:00–21:00', all: 'Занято во всех проектах' },
    en: { once: 'Marked once', range: '6:00–9:00 PM', all: 'Blocked in every production' },
    es: { once: 'Marcado una sola vez', range: '18:00–21:00', all: 'Ocupado en todos los proyectos' },
    de: { once: 'Einmal eingetragen', range: '18:00–21:00', all: 'In allen Projekten belegt' },
  };

  // The beats, by the ids of their sections: the scroll's t is the index of
  // the beat being read plus how far into it.
  const beats = [...document.querySelectorAll('.beat')];
  const B = Object.fromEntries(beats.map((b, i) => [b.id, i]));
  const o = B.mark - 1;   // the day's own clock: its cards were timed with "02" at 1

  // Each person's day is a glass card, the hours running down it as in a
  // day column of a calendar, busy hours in red. Side by side they are the
  // cast; slid into one stack they are the planner — light passes only
  // where nobody is busy. A tall screen gets narrower, taller cards.
  const START = 9, END = 23;            // the working day the planner looks at
  const FREE = 13;                      // the hour nobody is busy
  const N = BUSY.length;
  const D = {};                         // card sizes, set per layout
  const cardH = () => (END - START) * D.hour;
  const cardCY = () => D.y0 + cardH() / 2;
  const hy = (h) => D.y0 + cardH() - (h - START) * D.hour;   // where an hour begins
  const rowX = (i) => (i - (N - 1) / 2) * D.sp;
  const stackZ = (i) => ((N - 1) / 2 - i) * D.depth;          // the first card in front
  const PANELS = 4;
  const panelX = (k) => (k - (PANELS - 1) / 2) * (D.pw + D.pg);
  const PANEL_Z = -.4;
  // The panels keep a shorter hour than the cards: on a tall screen they
  // share it with more words.
  const panelH = () => (END - START) * D.ph;
  const panelCY = () => D.y0 + panelH() / 2;
  const phy = (h) => D.y0 + panelH() - (h - START) * D.ph;

  // The phone: the screen has the shots' own aspect (1178 × 2556).
  const SCREEN_W = 1.33;
  const SCREEN_H = SCREEN_W * 2556 / 1178;
  const SCREEN_R = SCREEN_W * 0.14;
  const BEZEL = 0.068;
  const BODY_W = SCREEN_W + 2 * BEZEL;
  const BODY_H = SCREEN_H + 2 * BEZEL;
  const BODY_D = 0.13;
  const BODY_R = SCREEN_R + BEZEL;
  const SCREEN_PX = 660 * 2556 / 1178;  // a screen's height in the strips' pixels

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const mix = (a, b, k) => a + (b - a) * k;

  /* ── Renderer, scene, camera ───────────────────────────── */

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080c);
  scene.fog = new THREE.FogExp2(0x07080c, 0.045);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);

  // Reflections come from a small studio of light panels, rendered once.
  scene.environment = (() => {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x030305);
    const panel = (w, h, color, k, pos, rot) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.rotation.set(...rot); env.add(m);
    };
    panel(7, 2.2, 0xffffff, 2.6, [0, 5, 1], [Math.PI / 2, 0, 0]);
    panel(1.2, 7, 0xb98bff, 2.4, [-5, 1, 1.5], [0, Math.PI / 2, 0]);
    panel(1.0, 7, 0x9fb6ff, 1.3, [5, 1, -1], [0, -Math.PI / 2, 0]);
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(env, 0.03).texture;
    pm.dispose();
    return tex;
  })();

  /* ── Geometry helpers ──────────────────────────────────── */

  function roundedRect(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    r = Math.max(0.0001, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4));
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  // A flat rounded shape whose UVs run 0..1 across it, for a texture.
  function plate(w, h, r) {
    const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 24);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + .5, p.getY(i) / h + .5);
    return g;
  }
  // A rounded rectangle drawn by its distance field, so its corners, its
  // one-pixel edge and its glow stay true at any size: the cards, the busy
  // hours, the free hour, the rehearsal. Sized with sizeRect, never scaled.
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  const RECT_FS = `
    uniform vec2 size; uniform float margin, radius, fill, border, glow, lines, lineA, opacity;
    uniform vec3 color, edgeColor; varying vec2 vUv;
    float box(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
    void main(){
      vec2 p = (vUv - .5) * (size + 2. * margin);
      float d = box(p, size * .5, min(radius, min(size.x, size.y) * .5));
      float aa = max(fwidth(d), 1e-5);
      float inside = 1. - smoothstep(-aa, aa, d);
      float edge = border * (1. - smoothstep(.6, 1.6, abs(d) / aa));
      float f = inside * fill;
      if (lines > 0.) {
        float gy = (p.y / size.y + .5) * lines, lw = max(fwidth(gy), 1e-5);
        f += inside * lineA * (1. - smoothstep(.5, 1.5, abs(gy - floor(gy + .5)) / lw));
      }
      float g = glow > 0. ? (1. - inside) * exp(-max(d, 0.) / glow) * .5 : 0.;
      float a = clamp(f + edge + g, 0., 1.);
      vec3 c = (color * (f + g) + edgeColor * edge) / max(f + g + edge, 1e-4);
      gl_FragColor = vec4(c, a * opacity);
      #include <colorspace_fragment>
    }`;
  function rect(o) {
    return new THREE.Mesh(unitPlane, new THREE.ShaderMaterial({
      uniforms: {
        size: { value: new THREE.Vector2(1, 1) },
        margin: { value: o.margin ?? (o.glow ? o.glow * 5 : .01) },
        radius: { value: o.radius ?? .04 }, fill: { value: o.fill ?? 1 }, border: { value: o.border ?? 0 },
        glow: { value: o.glow ?? 0 }, lines: { value: o.lines ?? 0 }, lineA: { value: o.lineA ?? 0 },
        color: { value: new THREE.Color(o.color) }, edgeColor: { value: new THREE.Color(o.edge ?? o.color) },
        opacity: { value: 1 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: RECT_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
  }
  function sizeRect(m, w, h) {
    const u = m.material.uniforms;
    u.size.value.set(w, h);
    m.scale.set(w + 2 * u.margin.value, h + 2 * u.margin.value, 1);
  }

  /* ── The stage: floor, light, dust ─────────────────────── */

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x0c0e13, roughness: .82, metalness: .1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(new THREE.HemisphereLight(0x8d97b4, 0x050608, .55));

  const P_HERO = new THREE.Vector3(0, 1.9, 3.4);
  const heroTarget = new THREE.Object3D(); heroTarget.position.copy(P_HERO); scene.add(heroTarget);
  const keyHero = new THREE.SpotLight(0xffffff, 85, 0, .42, .65, 2);
  keyHero.position.set(1.4, 8.6, 7.2);
  keyHero.target = heroTarget;
  scene.add(keyHero);

  const gridTarget = new THREE.Object3D(); scene.add(gridTarget);
  const keyGrid = new THREE.SpotLight(0xdfe6ff, 0, 0, .62, .75, 2);
  keyGrid.position.set(-1.5, 9, 4.2);
  keyGrid.target = gridTarget;
  keyGrid.castShadow = true;
  keyGrid.shadow.mapSize.set(1024, 1024);
  keyGrid.shadow.bias = -0.0004;
  scene.add(keyGrid);

  const rim = new THREE.PointLight(0xa855f7, 26, 0, 2);
  rim.position.set(-3.2, 3.2, 1.2);
  scene.add(rim);

  // The beam the phone floats in: a cone, brightest along its axis.
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.12, 2.1, 9, 48, 1, true), new THREE.ShaderMaterial({
    uniforms: { strength: { value: .3 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y / 9. + .5; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; varying float vY; uniform float strength; void main(){ float a = pow(abs(dot(vN, vV)), 2.5) * smoothstep(0., .35, vY) * smoothstep(1., .55, vY); gl_FragColor = vec4(vec3(.82, .86, 1.) * a * strength, 1.); }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  // A follow spot: wherever the phone goes on stage, the light and its beam
  // go with it.
  const SPOT_OFF = new THREE.Vector3(1.4, 6.7, 3.8);
  const beamTo = new THREE.Vector3();
  function aimSpot(at) {
    keyHero.position.copy(at).add(SPOT_OFF);
    heroTarget.position.copy(at);
    beamTo.copy(at).setY(0);
    beam.position.copy(keyHero.position).add(beamTo).multiplyScalar(.5);
    beam.lookAt(beamTo);
    beam.rotateX(-Math.PI / 2);
    beam.scale.y = keyHero.position.distanceTo(beamTo) / 9;
  }
  aimSpot(P_HERO);
  scene.add(beam);

  // Dust drifting through the light.
  const tall0 = innerWidth / innerHeight < .75;
  const DUST = tall0 ? 180 : 420;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - .5) * 9;
    dustPos[i * 3 + 1] = Math.random() * 6;
    dustPos[i * 3 + 2] = (Math.random() - .5) * 8 + 1.5;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dot = document.createElement('canvas'); dot.width = dot.height = 32;
  { const c = dot.getContext('2d'), g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); }
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: .05, map: new THREE.CanvasTexture(dot), transparent: true, opacity: .6,
    blending: THREE.AdditiveBlending, depthWrite: false, color: 0xcfd8ff,
  }));
  scene.add(dust);

  /* ── The phone ─────────────────────────────────────────── */

  const phone = new THREE.Group();
  {
    const b = .035;
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedRect(BODY_W - 2 * b, BODY_H - 2 * b, BODY_R - b),
        { depth: BODY_D - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 6, curveSegments: 32 }),
      new THREE.MeshStandardMaterial({ color: 0x3a3e48, metalness: .92, roughness: .3, envMapIntensity: 1.3 }));
    body.geometry.center();
    body.castShadow = true;
    phone.add(body);
    const front = new THREE.Mesh(plate(BODY_W - .03, BODY_H - .03, BODY_R - .015),
      new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: .3, clearcoat: 1, clearcoatRoughness: .08 }));
    front.position.z = BODY_D / 2 + .0015;
    phone.add(front);
  }
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  // The screen draws three images as one: the pinned top, the strip that
  // scrolls between, and the tab bar. One mesh, rounded by its own shape.
  const screenMat = new THREE.ShaderMaterial({
    uniforms: {
      tTop: { value: blank }, tMid: { value: blank }, tBot: { value: blank },
      topH: { value: 0 }, botH: { value: 0 }, win: { value: 1 }, scroll: { value: 0 }, light: { value: 1 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `
      uniform sampler2D tTop, tMid, tBot; uniform float topH, botH, win, scroll, light; varying vec2 vUv;
      void main(){
        float y = 1. - vUv.y; vec3 c;
        if (y < topH) c = texture2D(tTop, vec2(vUv.x, 1. - y / topH)).rgb;
        else if (y > 1. - botH) c = texture2D(tBot, vec2(vUv.x, 1. - (y - (1. - botH)) / botH)).rgb;
        else { float t = (y - topH) / (1. - topH - botH); c = texture2D(tMid, vec2(vUv.x, 1. - (scroll * (1. - win) + t * win))).rgb; }
        gl_FragColor = vec4(c * light, 1.);
      }`,
  });
  const screen = new THREE.Mesh(plate(SCREEN_W, SCREEN_H, SCREEN_R), screenMat);
  screen.position.z = BODY_D / 2 + .003;
  phone.add(screen);
  // Glass over it: reflections only, added to whatever the screen shows.
  const glass = new THREE.Mesh(plate(SCREEN_W, SCREEN_H, SCREEN_R), new THREE.MeshPhysicalMaterial({
    color: 0x000000, roughness: .06, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: .55,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glass.position.z = BODY_D / 2 + .004;
  phone.add(glass);
  const island = new THREE.Mesh(plate(SCREEN_W * .32, SCREEN_W * .094, SCREEN_W * .047), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  island.position.set(0, SCREEN_H / 2 - SCREEN_W * .095, BODY_D / 2 + .005);
  phone.add(island);
  scene.add(phone);

  /* ── The day: eight people, a card each ────────────────── */

  // Drawn back to front when stacked: the first card is the front one.
  const cards = BUSY.map((spans, i) => {
    const g = new THREE.Group();
    const order = (N - 1 - i) * 4;
    const glass = rect({ color: 0xbfcbe2, edge: 0xdfe6f3, fill: .045, border: .42, lines: END - START, lineA: .07, radius: .05 });
    glass.renderOrder = order;
    g.add(glass);
    const segs = spans.map(([a, b]) => {
      const m = rect({ color: 0xef4444, edge: 0xffb4b4, fill: .9, border: .65, glow: .045, radius: .035 });
      m.position.z = .002;
      m.renderOrder = order + 1;
      g.add(m);
      return { m, a, b, h: 0 };
    });
    const free = rect({ color: 0x10b981, edge: 0x8af2c9, fill: .55, border: .95, glow: .07, radius: .035, margin: .4 });
    free.position.z = .003;
    free.renderOrder = order + 2;
    g.add(free);
    const booked = rect({ color: 0xa855f7, edge: 0xf1e4ff, fill: .96, border: .8, glow: .06, radius: .035, margin: .5 });
    booked.position.z = .004;
    booked.renderOrder = order + 3;
    g.add(booked);
    scene.add(g);
    return { g, glass, segs, free, booked };
  });

  // Light behind the stack, and the shaft it sends through the free hour.
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0x10b981) }, strength: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vU; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vU = position.z + .5; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; varying float vU; uniform vec3 color; uniform float strength; void main(){ float a = pow(abs(dot(vN, vV)), 1.4) * smoothstep(0., .05, vU) * (1. - smoothstep(.45, 1., vU)); gl_FragColor = vec4(color * a * strength, 1.); \n#include <colorspace_fragment>\n }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).rotateX(Math.PI / 2), shaftMat);
  shaft.renderOrder = -1;
  scene.add(shaft);
  const source = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(dot), color: 0x5ff5b8, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
  }));
  source.renderOrder = -2;
  scene.add(source);
  const gapLight = new THREE.PointLight(0x10b981, 0, 0, 2);
  scene.add(gapLight);

  function fitCards() {
    const inset = Math.min(.05, D.cw * .1);
    D.segW = D.cw - 2 * inset;
    const cy = cardCY(), fy = hy(FREE + .5) - cy;
    for (const c of cards) {
      sizeRect(c.glass, D.cw, cardH());
      for (const s of c.segs) s.h = (s.b - s.a) * D.hour - .03;
      sizeRect(c.free, D.segW, D.hour - .03);
      sizeRect(c.booked, D.segW, D.hour - .03);
      c.free.position.y = c.booked.position.y = fy;
    }
    const back = stackZ(N - 1) - .3, front = stackZ(0) + .9;
    shaft.scale.set(D.cw * .42, D.hour * .5, front - back);
    shaft.position.set(0, hy(FREE + .5), (front + back) / 2);
    source.position.set(0, hy(FREE + .5), back);
    source.scale.setScalar(D.cw * 2.2);
    gapLight.position.set(0, hy(FREE + .5) - .2, stackZ(0) + .9);
  }

  /* ── Labels: HTML, placed where the scene's points land ── */

  const layer = document.querySelector('.labels');
  const labels = [];
  const label = (cls, shift) => {
    const el = document.createElement('div');
    el.className = `label ${cls}`;
    layer.appendChild(el);
    const l = { el, anchor: new THREE.Vector3(), shift, lw: 0, lh: 0 };
    labels.push(l);
    return l;
  };
  // A label's size is read once after its words or the layout change, not
  // every frame.
  const remeasure = () => labels.forEach((l) => { l.lw = 0; });
  const nameLabels = cards.map(() => label('label--name', '-50%,-100%'));
  const HOURS = [9, 11, 13, 15, 17, 19, 21, 23];
  const hourLabels = HOURS.map(() => label('label--hour', '-100%,-50%'));
  const gapLabel = label('label--gap', '-100%,-50%');

  function writeLabels(lang) {
    nameLabels.forEach((l, i) => {
      const name = NAMES[lang][i];
      const ava = document.createElement('span');
      ava.className = 'ava';
      ava.textContent = name.split(' ').map((w) => w[0]).join('');
      const first = document.createElement('span');
      first.className = 'nm';
      first.textContent = name.split(' ')[0];
      l.el.replaceChildren(ava, first);
    });
    hourLabels.forEach((l, i) => { l.el.textContent = hourText(lang, HOURS[i]); });
    const [range, all] = GAP_TEXT[lang];
    const small = document.createElement('small');
    small.textContent = all;
    gapLabel.el.replaceChildren(range, small);
    remeasure();
  }
  const v = new THREE.Vector3();
  // Placed where its point lands, by its shift ("-100%,-50%": the right edge
  // there, centred on it), and kept inside the screen's sides.
  function placeLabel(l, alpha, w, h) {
    if (alpha <= .01) { l.el.style.opacity = '0'; return; }
    v.copy(l.anchor).project(camera);
    if (v.z > 1) { l.el.style.opacity = '0'; return; }
    if (!l.lw) { l.lw = l.el.offsetWidth; l.lh = l.el.offsetHeight; }
    const [sx, sy] = l.shift.split(',').map((p) => parseFloat(p) / 100);
    const x = Math.min(Math.max((v.x * .5 + .5) * w + sx * l.lw, 8), w - 8 - l.lw);
    const y = (-v.y * .5 + .5) * h + sy * l.lh;
    l.el.style.opacity = alpha.toFixed(3);
    l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  }

  /* ── Words drawn into the scene ────────────────────────── */

  // The chat and the notifications are HTML in the page (the picture
  // without the scene); here their words are read and drawn into canvases,
  // so they sit in 3D with the rest. A canvas pixel is PX of them per CSS px.
  const PX = 2.5;
  const fontOf = (l) => `${l === 'ru' ? '"Inter Tight"' : '"Instrument Sans"'}, -apple-system, "Segoe UI", system-ui, sans-serif`;
  const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
  const fontsReady = Promise.all(['400 15px "Inter Tight"', '600 15px "Inter Tight"', '700 15px "Inter Tight"',
    '400 15px "Instrument Sans"', '600 15px "Instrument Sans"', '400 11px "JetBrains Mono"']
    .map((f) => document.fonts.load(f, 'Aa Яя Éé ñ Üü').catch(() => null)));
  const measure = document.createElement('canvas').getContext('2d');

  function canvasOf(w, h, px = PX) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * px); c.height = Math.ceil(h * px);
    const g = c.getContext('2d');
    g.scale(px, px);
    g.textBaseline = 'top';
    return [c, g];
  }
  // A rounded rectangle; r is one radius or [top-left, top-right, bottom-right, bottom-left].
  function rr(g, x, y, w, h, r) {
    const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
    g.beginPath();
    g.moveTo(x + a, y); g.lineTo(x + w - b, y); g.quadraticCurveTo(x + w, y, x + w, y + b);
    g.lineTo(x + w, y + h - c); g.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
    g.lineTo(x + d, y + h); g.quadraticCurveTo(x, y + h, x, y + h - d);
    g.lineTo(x, y + a); g.quadraticCurveTo(x, y, x + a, y);
    g.closePath();
  }
  // Lines of at most maxW; a no-break space keeps its words together.
  function wrap(g, text, maxW) {
    const out = [];
    let line = '';
    for (const word of text.split(/[ \t\n]+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && g.measureText(next).width > maxW) { out.push(line); line = word; } else line = next;
    }
    if (line) out.push(line);
    return out;
  }
  // A plane carrying a canvas, the size its CSS pixels say at u units each.
  function canvasPlane() {
    const m = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, opacity: 0,
    }));
    m.visible = false;
    return m;
  }
  function paint(m, canvas, w, h, u) {
    const old = m.material.map;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    m.material.map = t;
    m.material.needsUpdate = true;
    if (old) old.dispose();
    m.scale.set(w * u, h * u, 1);
  }

  /* ── Before: the chat, floating in the dark ────────────── */

  const WHO = { 1: '#fbbf24', 2: '#34d399', 3: '#60a5fa', 4: '#f472b6' };
  function chatOf(lang) {
    const root = document.querySelector(`.chat > [data-l="${lang}"]`);
    if (!root) return [];
    const head = root.querySelector('.chat__head');
    const items = [{
      kind: 'head', mark: head.querySelector('.chat__avatar').textContent,
      title: head.querySelector('b').textContent, sub: head.querySelector('small').textContent,
    }];
    root.querySelectorAll('.msg, .chat__pin, .chat__seen').forEach((el) => {
      if (el.classList.contains('msg')) {
        const who = el.querySelector('.msg__who');
        const n = who && [...who.classList].map((c) => c.match(/--(\d)$/)).find(Boolean);
        items.push({
          kind: el.classList.contains('msg--out') ? 'out' : 'in',
          who: who ? who.textContent : '', color: n ? WHO[n[1]] : '#e6edf3',
          text: [...el.childNodes].filter((x) => x !== who).map((x) => x.textContent).join('').trim(),
        });
      } else if (el.classList.contains('chat__pin')) {
        items.push({ kind: 'pin', text: el.textContent.replace('📌', '').trim() });
      } else {
        items.push({ kind: 'seen', text: el.textContent.trim() });
      }
    });
    return items;
  }
  function drawChatItem(it, F) {
    const g = measure;
    if (it.kind === 'in' || it.kind === 'out') {
      g.font = `400 15px ${F}`;
      const ls = wrap(g, it.text, 278);
      const tw = Math.max(...ls.map((l) => g.measureText(l).width));
      g.font = `600 12px ${F}`;
      const ww = it.who ? g.measureText(it.who).width : 0;
      const w = Math.ceil(Math.max(tw, ww) + 24), whoH = it.who ? 17 : 0, h = Math.ceil(9 + whoH + ls.length * 20 + 9);
      const [c, x] = canvasOf(w, h);
      rr(x, 0, 0, w, h, it.kind === 'out' ? [16, 16, 5, 16] : [16, 16, 16, 5]);
      x.fillStyle = it.kind === 'out' ? '#9333ea' : '#21262d';
      x.fill();
      if (it.who) { x.font = `600 12px ${F}`; x.fillStyle = it.color; x.fillText(it.who, 12, 9); }
      x.font = `400 15px ${F}`;
      x.fillStyle = it.kind === 'out' ? '#ffffff' : '#e6edf3';
      ls.forEach((l, k) => x.fillText(l, 12, 9 + whoH + k * 20 + 1));
      return [c, w, h];
    }
    if (it.kind === 'head') {
      g.font = `600 15px ${F}`;
      const tw = g.measureText(it.title).width;
      const w = Math.ceil(12 + 36 + 12 + tw + 18), h = 60;
      const [c, x] = canvasOf(w, h);
      rr(x, .5, .5, w - 1, h - 1, 18);
      x.fillStyle = 'rgba(13, 17, 23, .92)'; x.fill();
      x.strokeStyle = 'rgba(139, 148, 158, .25)'; x.lineWidth = 1; x.stroke();
      const gr = x.createLinearGradient(12, 12, 48, 48);
      gr.addColorStop(0, '#3b2a55'); gr.addColorStop(1, '#1d1530');
      x.beginPath(); x.arc(30, 30, 18, 0, Math.PI * 2); x.fillStyle = gr; x.fill();
      x.font = `600 15px ${F}`; x.fillStyle = '#a855f7'; x.textAlign = 'center'; x.fillText(it.mark, 30, 21);
      x.textAlign = 'left';
      x.fillStyle = '#e6edf3'; x.fillText(it.title, 60, 12);
      x.font = `400 12px ${F}`; x.fillStyle = '#8b949e'; x.fillText(it.sub, 60, 33);
      return [c, w, h];
    }
    // The pin and who has read it: small pills between the bubbles.
    const pin = it.kind === 'pin';
    g.font = pin ? `500 12px ${F}` : `400 11px ${MONO}`;
    const w = Math.ceil(g.measureText(it.text).width + 22 + (pin ? 14 : 0)), h = 24;
    const [c, x] = canvasOf(w, h);
    rr(x, 0, 0, w, h, 12);
    x.fillStyle = pin ? '#21262d' : 'rgba(33, 38, 45, .7)'; x.fill();
    x.font = g.font;
    x.fillStyle = pin ? '#8b949e' : '#9aa3ae';
    if (pin) {
      x.beginPath(); x.arc(15, 10, 3.5, 0, Math.PI * 2); x.fillStyle = '#a855f7'; x.fill();
      x.fillRect(14.3, 12, 1.4, 6);
      x.fillStyle = '#8b949e';
    }
    x.fillText(it.text, pin ? 25 : 11, pin ? 6 : 7);
    return [c, w, h];
  }

  const chatG = new THREE.Group();
  chatG.position.set(0, 1.2, .8);
  scene.add(chatG);
  const CHAT_U = .0058;               // units per CSS pixel of a bubble
  let chat = [];
  // Where each one rests, by its own seed: a chat column with depth.
  const seed = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  async function buildChat(lang) {
    await fontsReady;
    const F = fontOf(lang);
    const items = chatOf(lang);
    while (chat.length < items.length) { const m = canvasPlane(); chatG.add(m); chat.push({ m }); }
    chat.forEach((c, i) => {
      c.on = i < items.length;
      if (!c.on) { c.m.visible = false; return; }
      const it = items[i];
      const [cv, w, h] = drawChatItem(it, F);
      paint(c.m, cv, w, h, CHAT_U);
      const half = w * CHAT_U / 2, side = it.kind === 'in' ? -1 : it.kind === 'out' ? 1 : 0;
      c.x = side ? side * (1.15 - half) + (seed(i, 1) - .5) * .2 : (seed(i, 1) - .5) * .3;
      c.z = (seed(i, 2) - .6) * .9;
      c.h = h * CHAT_U;
    });
    chat.n = items.length;
  }

  /* ── 01: the link goes out, the cast comes in ──────────── */

  // Each of the eight waits round the phone as an outline; the link reaches
  // them one by one and they fill in. In "02" they settle over their cards.
  const ring = BUSY.map((_, i) => {
    const deg = i < 4 ? [146, 168, 192, 214][i] : [34, 12, -12, -34][i - 4];
    return THREE.MathUtils.degToRad(deg);
  });
  const P_INV = new THREE.Vector3(0, 2.05, 2.2);
  const ringAt = (i, out) => out.set(P_INV.x + Math.cos(ring[i]) * D.rx, P_INV.y + Math.sin(ring[i]) * D.ry, P_INV.z - .5);
  const SHARE = new THREE.Vector3(0, SCREEN_H / 2 - SCREEN_H * .144, BODY_D / 2 + .01);   // the share button, on the screen
  const dotTex = new THREE.CanvasTexture(dot);
  const links = BUSY.map(() => {
    const pts = new Float32Array(33 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xb98bff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTex, color: 0xe9d5ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    spark.scale.setScalar(.22);
    scene.add(line, spark);
    return { line, spark, pts, curve: new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()) };
  });

  /* ── Productions: one person, four panels ──────────────── */

  const panels = Array.from({ length: PANELS }, (_, k) => {
    const g = new THREE.Group();
    const order = 60 + k * 4;
    const glass = rect({ color: 0xbfcbe2, edge: 0xdfe6f3, fill: .05, border: .45, lines: END - START, lineA: .07, radius: .06 });
    const mine = rect({ color: 0xef4444, edge: 0xffb4b4, fill: .9, border: .65, glow: .05, radius: .04, margin: .4 });
    const call = rect({ color: k ? 0xef4444 : 0xa855f7, edge: k ? 0xffb4b4 : 0xf1e4ff, fill: .92, border: .7, glow: .06, radius: .04, margin: .5 });
    [glass, mine, call].forEach((m, j) => { m.renderOrder = order + j; m.position.z = j * .002; g.add(m); });
    g.visible = false;
    scene.add(g);
    return { g, glass, mine, call };
  });
  function fitPanels() {
    const inset = .08, cy = panelCY();
    for (const p of panels) {
      sizeRect(p.glass, D.pw, panelH());
      sizeRect(p.mine, D.pw - 2 * inset, (MINE[1] - MINE[0]) * D.ph - .03);
      sizeRect(p.call, D.pw - 2 * inset, (CALL[1] - CALL[0]) * D.ph - .03);
      p.mine.position.y = (phy(MINE[0]) + phy(MINE[1])) / 2 - cy;
      p.call.position.y = (phy(CALL[0]) + phy(CALL[1])) / 2 - cy;
    }
  }

  /* ── For the cast: the lock screen and what lands on it ── */

  const icon = new Image();
  const iconReady = new Promise((done) => { icon.onload = done; icon.onerror = done; });
  icon.src = 'assets/icon-64.png';
  function lockOf(lang) {
    const root = document.querySelector(`.lock > [data-l="${lang}"]`);
    if (!root) return { date: '', notes: [] };
    return {
      date: root.querySelector('.lock__date').textContent,
      notes: [...root.querySelectorAll('.note')].map((n) => {
        const meta = n.querySelectorAll('.note__meta span');
        return { app: meta[0].textContent, when: meta[1].textContent, title: n.querySelector('.note__title').textContent, body: n.querySelector('.note__body').textContent };
      }),
    };
  }
  // The lock screen in the strips' own pixels: 660 across.
  function drawLock(lang, date) {
    const W = 660, H = Math.round(SCREEN_PX), F = fontOf(lang);
    const [c, x] = canvasOf(W, H, 1.5);
    const bg = x.createLinearGradient(0, 0, W * .35, H);
    bg.addColorStop(0, '#1b1430'); bg.addColorStop(.7, '#0d1117'); bg.addColorStop(1, '#0d1117');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const glow = (cx, cy, r, color) => {
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
    };
    glow(W * .3, 0, W * 1.1, 'rgba(168, 85, 247, .45)');
    glow(W, H, W * .9, 'rgba(16, 185, 129, .16)');
    x.textAlign = 'center';
    x.fillStyle = 'rgba(230, 237, 243, .8)';
    x.font = `600 31px ${F}`;
    x.fillText(date, W / 2, 168);
    x.fillStyle = 'rgba(230, 237, 243, .94)';
    x.font = `700 186px ${F}`;
    x.fillText('9:41', W / 2, 206);
    // The two buttons at the foot of every lock screen, and the home bar.
    for (const cx of [104, W - 104]) {
      x.beginPath(); x.arc(cx, H - 150, 44, 0, Math.PI * 2);
      x.fillStyle = 'rgba(255, 255, 255, .1)'; x.fill();
    }
    rr(x, W / 2 - 74, H - 26, 148, 9, 4.5);
    x.fillStyle = 'rgba(255, 255, 255, .75)'; x.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function drawNote(n, F) {
    const W = 616, g = measure;
    g.font = `400 24px ${F}`;
    const ls = wrap(g, n.body, W - 32 - 64 - 18 - 24);
    const H = Math.ceil(24 + 30 + 34 + ls.length * 31 + 22);
    const [c, x] = canvasOf(W + 24, H + 24, 2);
    x.translate(12, 8);
    x.shadowColor = 'rgba(0, 0, 0, .45)'; x.shadowBlur = 14; x.shadowOffsetY = 4;
    rr(x, 0, 0, W, H, 36);
    x.fillStyle = 'rgba(46, 50, 62, .92)'; x.fill();
    x.shadowColor = 'transparent';
    x.strokeStyle = 'rgba(255, 255, 255, .08)'; x.lineWidth = 1.5; x.stroke();
    x.save(); rr(x, 22, 24, 64, 64, 15); x.clip();
    if (icon.naturalWidth) x.drawImage(icon, 22, 24, 64, 64);
    x.restore();
    const tx = 22 + 64 + 18;
    x.font = `500 20px ${F}`; x.fillStyle = 'rgba(230, 237, 243, .62)';
    x.fillText(n.app.toUpperCase(), tx, 26);
    x.textAlign = 'right'; x.fillText(n.when, W - 24, 26); x.textAlign = 'left';
    x.font = `600 25px ${F}`; x.fillStyle = '#f2f5f8';
    x.fillText(n.title, tx, 54);
    x.font = `400 24px ${F}`; x.fillStyle = 'rgba(230, 237, 243, .86)';
    ls.forEach((l, k) => x.fillText(l, tx, 88 + k * 31));
    return [c, W + 24, H + 24];
  }
  const PX_U = SCREEN_W / 660;        // units per pixel of the screen
  const notes = [0, 1, 2].map(() => { const m = canvasPlane(); m.renderOrder = 120; phone.add(m); return { m, h: 0 }; });
  const lockTex = {};
  async function buildLock(lang) {
    await fontsReady; await iconReady;
    const F = fontOf(lang), { date, notes: ns } = lockOf(lang);
    lockTex[lang] = drawLock(lang, date);
    ns.slice(0, 3).forEach((n, i) => {
      const [cv, w, h] = drawNote(n, F);
      paint(notes[i].m, cv, w, h, PX_U);
      notes[i].h = h * PX_U;
    });
  }

  /* ── The labels these scenes add ───────────────────────── */

  const projLabels = panels.map(() => label('label--proj', '-50%,-100%'));
  const onceLabel = label('label--note', '0,-50%');
  const allLabel = label('label--note is-violet', '0,-50%');
  function writeSceneLabels(lang) {
    // A hyphenated name never breaks at its hyphen: «Шоу-балет» stays whole.
    projLabels.forEach((l, k) => {
      l.el.replaceChildren(...PROJECTS[lang][k].split(' ').flatMap((w, i) => {
        if (!w.includes('-')) return [i ? ' ' : '', w];
        const s = document.createElement('span');
        s.className = 'nw';
        s.textContent = w;
        return [i ? ' ' : '', s];
      }));
    });
    const p = PROJ_TEXT[lang];
    onceLabel.el.textContent = p.once;
    const small = document.createElement('small');
    small.textContent = p.all;
    allLabel.el.replaceChildren(p.range, small);
    remeasure();
  }

  /* ── Screens, per language ─────────────────────────────── */

  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const cache = new Map();
  function tex(url) {
    if (!cache.has(url)) {
      cache.set(url, new Promise((done) => loader.load(url, (t) => {
        t.colorSpace = THREE.NoColorSpace;   // the pixels as shot, no conversion
        t.anisotropy = maxAniso;
        done(t);
      }, undefined, () => done(blank))));
    }
    return cache.get(url);
  }
  // A screen is its pinned top, the strip between and the tab bar, in the
  // strips' pixels; '@' is a file all languages share.
  const SCREENS = {
    calendar: { top: '@chrome-status', mid: 'calendar', bot: 'calendar-tabs', topPx: 99, botPx: 136 },
    invite: { top: '@chrome-status', mid: 'invite', bot: 'invite-tabs', topPx: 99, botPx: 136 },
    create: { top: 'create-top', mid: 'create', bot: null, topPx: 188, botPx: 0 },
    projects: { top: '@chrome-status', mid: 'projects', bot: 'projects-tabs', topPx: 99, botPx: 136 },
    card: { top: '@chrome-status', mid: 'card', bot: 'card-home', topPx: 99, botPx: 57 },
  };
  // What the phone brings in when the rehearsal is booked: the form it was
  // booked with, or, on the page for the people who rehearse, the rehearsal
  // as it reaches them (data-screen on that beat).
  const BOOK = beats[B.book].dataset.screen || 'create';
  const USED = ['calendar', 'invite', BOOK, 'projects'];
  const urlOf = (lang, n) => (n.startsWith('@') ? `assets/${n.slice(1)}.webp` : `assets/${lang}/${n}.webp`);
  const loaded = {};
  async function loadLang(lang) {
    // The first screen first: everything else can arrive while it is read.
    for (const name of USED) {
      const s = SCREENS[name];
      const [top, mid, bot] = await Promise.all([s.top, s.mid, s.bot].map((n) => (n ? tex(urlOf(lang, n)) : blank)));
      loaded[`${lang}/${name}`] = { ...s, top, mid, bot };
    }
    await buildLock(lang);
    loaded[`${lang}/lock`] = { top: blank, mid: lockTex[lang], bot: blank, topPx: 0, botPx: 0 };
  }
  let shown = '';
  function showScreen(lang, name, scroll) {
    const s = loaded[`${lang}/${name}`];
    if (!s) return;
    const u = screenMat.uniforms;
    if (shown !== `${lang}/${name}`) {
      shown = `${lang}/${name}`;
      u.tTop.value = s.top; u.tMid.value = s.mid; u.tBot.value = s.bot;
      u.topH.value = s.topPx / SCREEN_PX;
      u.botH.value = s.botPx / SCREEN_PX;
      const img = s.mid.image, stripPx = img.height * 660 / img.width;
      u.win.value = Math.min(1, (SCREEN_PX - s.topPx - s.botPx) / stripPx);
    }
    u.scroll.value = scroll;
  }

  let lang = document.documentElement.getAttribute('data-lang') || 'en';
  function setLang(l) {
    lang = l;
    writeLabels(l);
    writeSceneLabels(l);
    buildChat(l);
    loadLang(l);
  }
  setLang(lang);
  document.addEventListener('langchange', (e) => setLang(e.detail));

  /* ── The camera's shots ────────────────────────────────── */

  // A shot names what to look at, from which direction, how much of it to
  // fit, and where on the screen it should sit (-1..1 from the centre): the
  // words take the left of a wide screen and the top of a tall one. It also
  // sets the lights: the follow spot on the phone, the wash over the day,
  // and how much of the spot's beam shows.
  const V = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(...a));
  const L = (spot, grid = 0, beam = 0) => ({ spot, grid, beam });
  // Out of every shot: up on a wide screen; on a tall one the words are on
  // top, so the phone goes down through the stage and comes back up.
  const AWAY_UP = { pos: [-3, 10, -1], ry: 1.1, rx: -.5 };
  const AWAY_DOWN = { pos: [0, -4.2, 2.2], ry: .5, rx: .3 };
  let AWAY = AWAY_UP;
  const PASS = { pos: [8, 2.3, 2.2], ry: -.8, rx: 0 };
  const FINAL = { pos: [.9, 1.9, 2.4], ry: -.24, rx: .02 };
  const P_CAST = new THREE.Vector3(0, 1.95, 2.2);
  const P_LOCK = new THREE.Vector3(0, 1.95, 2.4);
  // On a tall screen the words of a beat take the top and the scene the
  // rest: measured, not assumed, since the words' length depends on the
  // language and the screen's height on the phone and whatever frames it.
  function copyBottom(id) {
    const last = beats[B[id]].querySelector('.beat__copy')?.lastElementChild;
    return last ? last.offsetTop + last.offsetHeight : 0;
  }
  // The room under the words, as the part of the screen it is and where its
  // middle sits (-1..1); room above and below for labels, and how far the
  // subject may run off the foot of the screen.
  function below(id, { top = 0, bottom = 0, bleed = 0 } = {}) {
    const H = innerHeight;
    const a = Math.min(H * .72, copyBottom(id) + 14 + top);
    const b = H - 16 - bottom + bleed * H;
    return { frac: (b - a) / H, mid: 1 - (a + b) / H };
  }
  // A shot that fits a subject `high` tall and `wide` across into that room.
  const under = (id, target, high, wide, room = {}) => {
    const r = below(id, room);
    return { target, fitH: high / r.frac, fitW: wide, off: [room.ox || 0, r.mid] };
  };

  function shots(tall) {
    AWAY = tall ? AWAY_DOWN : AWAY_UP;
    const cy = cardCY(), gy = hy(FREE + .5), py = panelCY();
    // The details are a page that slides over the scene; the call's shot is
    // ready behind them by the time their foot lets it show.
    const dEnd = Math.max(.35, 1 - innerHeight / beats[B.details].offsetHeight);
    const C = chatG.position, chatAt = (dz) => [C.x, C.y + 1.0, C.z + dz];
    const hero = (t, dir, ry) => ({ t, target: P_HERO, dir, fitH: BODY_H * (tall ? 1.62 : 1.42), off: tall ? [0, -1.3] : [.26, 0], phone: { pos: P_HERO, ry, rx: .04 }, light: L(85, 0, .3) });
    const details = [
      { t: B.details + .1, target: [0, 2.4, -3], dir: [0, .1, 1], fitH: 6, off: [0, 0], phone: AWAY, light: L(0) },
      { t: B.details + dEnd * .6, target: [0, 2.4, -3.6], dir: [.06, .1, 1], fitH: 6, off: [0, 0], phone: AWAY, light: L(0) },
    ];
    if (tall) {
      const rowW = D.sp * N + .95;
      // Each subject with its height, its width and the room its labels
      // need: avatars over the cards, names over the panels, notes under them.
      const row = (id) => ({ ...under(id, [0, cy, 0], cardH() + .15, rowW, { top: 34, ox: .08 }), phone: AWAY, light: L(0, 120) });
      const stack = (id, target, k) => ({ ...under(id, target, cardH() * k, 0), phone: AWAY, light: L(0, 120) });
      const chat = (dz, wide) => ({ ...under('problem', chatAt(dz + .1), 2.5, wide), phone: AWAY, light: L(0, 20) });
      const inv = under('invite', [P_INV.x, P_INV.y + .05, P_INV.z - .4], 2 * D.ry + .9, 2 * D.rx + 1.3, { top: 20 });
      const proj = { ...under('projects', [0, py, PANEL_Z], panelH() + .1, PANELS * (D.pw + D.pg) + 1.0, { top: 46, bottom: 50 }), phone: AWAY, light: L(0, 120) };
      const cast = under('cast', P_CAST, BODY_H * 1.02, 0, { bleed: .16 });
      const card = { ...under('book', P_CAST, BODY_H * 1.02, 0, { bleed: .16 }), light: L(80, 40) };
      const lock = under('notify', P_LOCK, BODY_H * 1.02, 0);
      const end = { ...under('get', P_HERO, BODY_H * 1.02, 0, { bleed: .22 }), dir: [0, .06, 1], phone: { pos: P_HERO, ry: -.12, rx: .04 }, light: L(85, 0, .3) };
      return [
        hero(0, [0, .06, 1], -.1),
        { ...hero(.9, [.02, .08, 1], -.04), fitH: BODY_H * 1.4, off: [0, -.1] },
        { ...chat(0, 2.9), t: B.problem + .25, dir: [-.25, .06, 1] },
        { ...chat(-.3, 2.75), t: B.problem + .95, dir: [-.15, .05, 1] },
        { ...inv, t: B.invite + .25, dir: [.05, .05, 1], phone: { pos: P_INV, ry: -.06, rx: .02 }, light: L(70) },
        { ...inv, t: B.invite + .9, dir: [-.03, .05, 1], phone: { pos: P_INV, ry: .04, rx: .02 }, light: L(70) },
        { ...row('mark'), t: o + 1.6, dir: [-.03, .1, 1], fitW: rowW * 1.05 },
        { ...row('mark'), t: o + 2.05, dir: [.03, .09, 1] },
        { ...stack('windows', [0, cy, 0], 1.18), t: o + 2.5, dir: [.95, .18, 1] },
        { ...stack('windows', [0, gy, .3], 1.06), t: o + 3.0, dir: [.8, .12, 1] },
        { ...stack('book', [0, gy, .2], 1.09), t: o + 3.3, dir: [.7, .14, 1] },
        ...(BOOK === 'card' ? [
          { ...card, t: o + 3.6, dir: [-.22, .08, 1], phone: { pos: P_CAST, ry: .2, rx: .03 } },
          { ...card, t: o + 3.95, dir: [-.1, .07, 1], phone: { pos: P_CAST, ry: .08, rx: .02 } },
        ] : [
          { ...row('book'), t: o + 3.65, dir: [-.03, .09, 1], phone: PASS },
          { ...under('book', [.9, 1.75, 2.4], BODY_H * 1.05, 0), t: o + 3.95, dir: [-.2, .3, 1], phone: FINAL, light: L(70, 120) },
        ]),
        { ...proj, t: B.projects + .3, dir: [-.03, .1, 1] },
        { ...proj, t: B.projects + .95, dir: [.03, .09, 1] },
        { ...cast, t: B.cast + .3, dir: [-.22, .08, 1], phone: { pos: P_CAST, ry: .2, rx: .03 }, light: L(80) },
        { ...cast, t: B.cast + .95, dir: [-.1, .07, 1], phone: { pos: P_CAST, ry: .08, rx: .02 }, light: L(80) },
        { ...lock, t: B.notify + .25, dir: [0, .05, 1], phone: { pos: P_LOCK, ry: -.03, rx: .02 }, light: L(80) },
        { ...lock, t: B.notify + .6, dir: [.05, .05, 1], phone: { pos: P_LOCK, ry: -.08, rx: .02 }, light: L(80) },
        ...details,
        { ...end, t: B.details + dEnd },
        { ...end, t: B.get + 3 },
      ];
    }
    const fitRow = (D.sp * N + 1.2) / .56, fitRowH = (cardH() + 1) / .8;
    const row = { target: [0, cy, 0], fitW: fitRow, fitH: fitRowH, off: [.3, 0], phone: AWAY, light: L(0, 120) };
    const inv = { target: [P_INV.x, P_INV.y + .1, P_INV.z - .4], fitH: 2 * D.ry + 1.5, off: [.27, 0], light: L(70) };
    const proj = { target: [0, py, PANEL_Z], fitW: (PANELS * (D.pw + D.pg) + 2.6) / .56, fitH: (panelH() + 1.1) / .8, off: [.27, 0], phone: AWAY, light: L(0, 120) };
    const end = { target: P_HERO, dir: [.12, .06, 1], fitH: BODY_H * 1.42, off: [.26, 0], phone: { pos: P_HERO, ry: -.34, rx: .03 }, light: L(85, 0, .3) };
    return [
      hero(0, [.12, .06, 1], -.34),
      { ...hero(.9, [.02, .08, 1], -.06), fitH: BODY_H * 1.3 },
      { t: B.problem + .25, target: chatAt(0), dir: [-.3, .06, 1], fitH: 3.9, off: [.27, 0], phone: AWAY, light: L(0, 20) },
      { t: B.problem + .95, target: chatAt(-.3), dir: [-.18, .05, 1], fitH: 3.45, off: [.27, 0], phone: AWAY, light: L(0, 20) },
      { ...inv, t: B.invite + .25, dir: [.08, .05, 1], phone: { pos: P_INV, ry: -.1, rx: .02 } },
      { ...inv, t: B.invite + .9, dir: [-.04, .05, 1], phone: { pos: P_INV, ry: .04, rx: .02 } },
      { ...row, t: o + 1.6, dir: [-.04, .12, 1], fitW: fitRow * 1.06, fitH: fitRowH * 1.06 },
      { ...row, t: o + 2.05, dir: [.05, .1, 1] },
      { t: o + 2.5, target: [0, cy, 0], dir: [.95, .2, 1], fitH: cardH() * 1.7, off: [.24, 0], phone: AWAY, light: L(0, 120) },
      { t: o + 3.0, target: [0, gy, .3], dir: [.8, .14, 1], fitH: cardH() * 1.45, off: [.24, 0], phone: AWAY, light: L(0, 120) },
      { t: o + 3.3, target: [0, gy, .2], dir: [.7, .16, 1], fitH: cardH() * 1.5, off: [.24, 0], phone: AWAY, light: L(0, 120) },
      // The people who rehearse get the rehearsal as it reaches them, held
      // beside the words as their calendar is, not flown past.
      ...(BOOK === 'card' ? [
        { t: o + 3.6, target: P_CAST, dir: [-.3, .1, 1], fitH: BODY_H * 1.42, off: [.26, 0], phone: { pos: P_CAST, ry: .26, rx: .03 }, light: L(80, 40) },
        { t: o + 3.95, target: P_CAST, dir: [-.12, .08, 1], fitH: BODY_H * 1.36, off: [.26, 0], phone: { pos: P_CAST, ry: .1, rx: .02 }, light: L(80, 40) },
      ] : [
        { ...row, t: o + 3.65, dir: [-.05, .1, 1], phone: PASS },
        { t: o + 3.95, target: [.9, 1.1, 1.3], dir: [-.14, .32, 1], fitH: BODY_H * 1.7, off: [.2, 0], phone: FINAL, light: L(70, 120) },
      ]),
      { ...proj, t: B.projects + .3, dir: [-.06, .1, 1] },
      { ...proj, t: B.projects + .95, dir: [.06, .1, 1] },
      { t: B.cast + .3, target: P_CAST, dir: [-.3, .1, 1], fitH: BODY_H * 1.42, off: [.26, 0], phone: { pos: P_CAST, ry: .26, rx: .03 }, light: L(80) },
      { t: B.cast + .95, target: P_CAST, dir: [-.12, .08, 1], fitH: BODY_H * 1.36, off: [.26, 0], phone: { pos: P_CAST, ry: .1, rx: .02 }, light: L(80) },
      { t: B.notify + .25, target: P_LOCK, dir: [0, .05, 1], fitH: BODY_H * 1.28, off: [.26, 0], phone: { pos: P_LOCK, ry: -.04, rx: .02 }, light: L(80) },
      { t: B.notify + .6, target: P_LOCK, dir: [.08, .05, 1], fitH: BODY_H * 1.24, off: [.26, 0], phone: { pos: P_LOCK, ry: -.12, rx: .02 }, light: L(80) },
      ...details,
      { ...end, t: B.details + dEnd },
      { ...end, t: B.get + 3 },
    ];
  }

  // Where the camera stands for a shot at this aspect.
  const tmpR = new THREE.Vector3(), tmpU = new THREE.Vector3(), tmpM = new THREE.Matrix4();
  function place(shot) {
    const target = V(shot.target), dir = V(shot.dir).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), tanH = tanV * camera.aspect;
    const dist = Math.max(shot.fitH ? shot.fitH / 2 / tanV : 0, shot.fitW ? shot.fitW / 2 / tanH : 0);
    const pos = target.clone().addScaledVector(dir, dist);
    tmpM.lookAt(pos, target, camera.up);
    tmpR.setFromMatrixColumn(tmpM, 0); tmpU.setFromMatrixColumn(tmpM, 1);
    const shift = tmpR.multiplyScalar(-shot.off[0] * dist * tanH).add(tmpU.multiplyScalar(-shot.off[1] * dist * tanV));
    return { pos: pos.add(shift), look: target.add(shift), phone: shot.phone, light: shot.light };
  }

  let SHOTS = [];
  let TALL = false;
  function layout() {
    const w = innerWidth, h = innerHeight;
    const tall = TALL = w / h < .75;
    renderer.setPixelRatio(Math.min(devicePixelRatio, tall ? 1.5 : 2));
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = !tall;
    // A tall screen sees less sideways at the same lens: it widens the lens
    // and thins the haze, or the day would sit far off in the fog.
    camera.fov = tall ? 42 : 32;
    scene.fog.density = tall ? .022 : .045;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    Object.assign(D, tall
      ? { cw: .36, sp: .46, hour: .31, depth: .3, y0: .3, rx: 1.25, ry: 2.05, pw: .74, pg: .16, ph: .15 }
      : { cw: .56, sp: .72, hour: .25, depth: .34, y0: .3, rx: 2.1, ry: 1.65, pw: 1.15, pg: .32, ph: .24 });
    fitCards();
    fitPanels();
    onceLabel.shift = allLabel.shift = tall ? '-50%,0' : '0,-50%';
    SHOTS = shots(tall).map((s) => ({ t: s.t, ...place(s) }));
    remeasure();
  }
  layout();
  addEventListener('resize', layout);
  document.fonts.ready.then(layout);   // the words' heights decide where the beats begin
  document.addEventListener('langchange', () => layout());

  /* ── The scroll, in beats ──────────────────────────────── */

  // A beat that scrolls as a page does keeps its words where they are.
  const copies = beats.map((b) => (b.classList.contains('beat--flow') ? null : b.querySelector('.beat__copy')));
  function scrollT() {
    const y = scrollY;
    for (let i = beats.length - 1; i >= 0; i--) {
      const top = beats[i].offsetTop;
      if (y >= top || i === 0) return i + Math.min(1, Math.max(0, (y - top) / beats[i].offsetHeight));
    }
    return 0;
  }
  function fadeCopies(t) {
    copies.forEach((c, i) => {
      if (!c) return;
      const local = t - i;
      let a, y;
      if (i === 0) {
        // On a tall screen the first words leave upwards before the phone
        // reaches them; on a wide one they sit beside it and leave later.
        a = 1 - smooth(TALL ? .08 : .62, TALL ? .38 : .9, local);
        y = TALL ? -(1 - a) * 60 : (1 - a) * 18;
      } else {
        const next = beats[i + 1];
        const end = next && next.classList.contains('beat--flow') ? Math.max(.3, 1 - innerHeight / beats[i].offsetHeight) : .98;
        a = smooth(.04, .22, local) * (1 - smooth(end - .16, end, local));
        y = (1 - a) * 18;
      }
      c.style.opacity = a.toFixed(3);
      c.style.transform = `translateY(${y.toFixed(1)}px)`;
      c.style.visibility = a < .01 ? 'hidden' : 'visible';
    });
  }

  /* ── Every frame ───────────────────────────────────────── */

  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const pPos = new THREE.Vector3();
  const green = new THREE.Color(0x10b981), violet = new THREE.Color(0xa855f7);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();
  const near = (t, at) => 1 - smooth(0, .05, Math.abs(t - at));   // a blink as the screen changes
  let tNow = scrollT();
  let last = performance.now();
  links.forEach((l) => { l.line.frustumCulled = false; });

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const time = now / 1000;
    const tGoal = scrollT();
    tNow = STILL ? tGoal : tNow + (tGoal - tNow) * Math.min(1, dt * 5);
    const t = tNow;
    const u = t - o;   // the day's own clock

    // Camera, phone and lights, between the two shots around t.
    let k = 0;
    while (k < SHOTS.length - 2 && t > SHOTS[k + 1].t) k++;
    const A = SHOTS[k], Bs = SHOTS[k + 1];
    const f = ease(Math.min(1, Math.max(0, (t - A.t) / (Bs.t - A.t))));
    camPos.lerpVectors(A.pos, Bs.pos, f);
    camLook.lerpVectors(A.look, Bs.look, f);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    pPos.lerpVectors(V(A.phone.pos), V(Bs.phone.pos), f);
    phone.position.copy(pPos);
    phone.position.y += Math.sin(time * .9) * .035;
    phone.rotation.set(mix(A.phone.rx, Bs.phone.rx, f), mix(A.phone.ry, Bs.phone.ry, f) + Math.sin(time * .5) * .025, 0);
    phone.updateMatrixWorld();

    aimSpot(pPos);
    keyHero.intensity = mix(A.light.spot, Bs.light.spot, f);
    keyGrid.intensity = mix(A.light.grid, Bs.light.grid, f);
    beam.material.uniforms.strength.value = mix(A.light.beam, Bs.light.beam, f) * (TALL && t < 1 ? mix(.3, 1, smooth(.2, .7, t)) : 1);
    gridTarget.position.set(0, 0, 0);

    // The screen, beat by beat. Under the first words of a tall screen it
    // stays dim until they leave; it blinks as it changes.
    let blink = 1;
    if (t < B.problem + .5) showScreen(lang, 'calendar', smooth(.1, 1.1, t) * .34);
    else if (t < o + 2.4) showScreen(lang, 'invite', 0);
    else if (t < B.projects + .5) showScreen(lang, BOOK, .2 + smooth(o + 3.7, o + 4.3, t) * .8);
    else if (t < B.cast + .45) showScreen(lang, 'projects', 0);
    else if (t < B.notify + .05) { showScreen(lang, 'calendar', smooth(B.cast + .5, B.cast + 1.05, t) * .6); blink = 1 - .9 * near(t, B.cast + .45); }
    else if (t < B.details + .5) { showScreen(lang, 'lock', 0); blink = 1 - .9 * near(t, B.notify + .05); }
    else showScreen(lang, 'calendar', smooth(B.get, B.get + 1, t) * .34);
    screenMat.uniforms.light.value = (TALL && t < 1 ? mix(.3, 1, smooth(.25, .7, t)) : 1) * blink;

    // Before: the chat. Each message comes out of the dark and the thread
    // climbs away behind the newest, as a chat scrolls; then it is blown off.
    const pc = t - B.problem;
    chatG.visible = !!chat.n && pc > -.2 && pc < 1.4;
    if (chatG.visible) {
      const n = chat.n, blow = smooth(.98, 1.3, pc);
      const at = (i) => .04 + i * (.72 / (n - 1));
      const arr = Array.from({ length: n }, (_, i) => smooth(at(i), at(i) + .07, pc));
      let above = 0;
      for (let i = n - 1; i >= 0; i--) {
        const c = chat[i], a = arr[i];
        let age = 0;
        for (let j = i + 1; j < n; j++) age += arr[j];
        c.m.visible = a > .001;
        c.m.position.set(c.x * (1 + blow * .8), above + c.h / 2 - (1 - a) * .25, c.z - age * .38 - (1 - a) * 3 - blow * 4);
        const top = TALL ? 2.2 : 3.2;   // where the words begin, over the thread
        c.m.material.opacity = a * Math.max(0, 1 - age * .09) * (1 - smooth(top - .8, top, above + c.h)) * (1 - blow);
        above += a * (c.h + .08);
      }
    }

    // 01: the link goes out from the share button to each of the eight.
    const pi = t - B.invite;
    const sent = (i) => .22 + i * .055;
    const share = phone.localToWorld(tmpS.copy(SHARE));
    links.forEach((l, i) => {
      const go = smooth(sent(i), sent(i) + .16, pi);
      if (pi < 0 || pi > 1.1 || go <= 0) { l.line.visible = l.spark.visible = false; return; }
      ringAt(i, l.curve.v2);
      l.curve.v0.copy(share);
      l.curve.v1.copy(share).lerp(l.curve.v2, .5).add(tmpA.set(0, .9, .6));
      for (let s = 0; s <= 32; s++) { l.curve.getPoint(s / 32, tmpP); l.pts[s * 3] = tmpP.x; l.pts[s * 3 + 1] = tmpP.y; l.pts[s * 3 + 2] = tmpP.z; }
      l.line.geometry.attributes.position.needsUpdate = true;
      l.line.geometry.setDrawRange(0, Math.max(2, Math.round(33 * go)));
      l.line.material.opacity = .55 * (1 - smooth(.82, 1.0, pi));
      l.line.visible = true;
      l.curve.getPoint(go, l.spark.position);
      l.spark.material.opacity = go < 1 ? 1 : Math.max(0, 1 - (pi - sent(i) - .16) * 10);
      l.spark.visible = l.spark.material.opacity > .01;
    });

    // The cards: each comes in and its busy hours are drawn down it; they
    // slide into one stack, the light comes through the free hour, the
    // rehearsal goes in from the front, and they spread out again.
    const cy = cardCY();
    const dimEnd = (1 - .85 * smooth(3.7, 3.95, u)) * (1 - smooth(B.projects, B.projects + .15, t));
    cards.forEach((c, i) => {
      const j = N - 1 - i;
      const gather = smooth(2.05 + i * .02, 2.42 + i * .02, u) * (1 - smooth(3.33 + j * .02, 3.62 + j * .02, u));
      c.gx = mix(rowX(i), 0, gather); c.gz = mix(0, stackZ(i), gather);
      const come = smooth(1.12 + i * .035, 1.42 + i * .035, u);
      c.g.visible = come > .001 && dimEnd > .001;
      if (!c.g.visible) return;
      c.g.position.set(c.gx, cy - (1 - come) * .35, c.gz);
      c.glass.material.uniforms.opacity.value = come * dimEnd;
      const drawn = smooth(1.26 + i * .04, 1.5 + i * .04, u);
      for (const s of c.segs) {
        s.m.visible = drawn > .001;
        const h = Math.max(.001, s.h * drawn);
        sizeRect(s.m, D.segW, h);
        s.m.position.y = hy(s.a) - .015 - h / 2 - cy;
        s.m.material.uniforms.opacity.value = come * dimEnd;
      }
      const lit = smooth(2.45 + j * .025, 2.62 + j * .025, u) * (1 - smooth(3.06, 3.24, u));
      c.free.visible = lit > .001;
      c.free.material.uniforms.opacity.value = lit;
      const set = smooth(3.06 + i * .03, 3.13 + i * .03, u);
      c.booked.visible = set > .001;
      c.booked.material.uniforms.opacity.value = set * dimEnd;
      c.booked.material.uniforms.glow.value = .06 + .1 * set * (1 - smooth(3.13 + i * .03, 3.4 + i * .03, u));
    });
    const light = smooth(2.42, 2.62, u) * (1 - smooth(3.1, 3.3, u));
    shaftMat.uniforms.strength.value = .9 * light;
    shaftMat.uniforms.color.value.lerpColors(green, violet, smooth(3.04, 3.16, u));
    source.material.opacity = light;
    gapLight.intensity = 5 * light;

    // Productions: four panels, one person. Hours marked once land in all
    // four; a rehearsal booked in the first takes the same hours in the rest.
    // Then they fly into the phone, which holds them all.
    const pp = t - B.projects;
    const into = smooth(B.cast - .02, B.cast + .28, t);
    panels.forEach((P, k) => {
      const come = smooth(.04 + k * .04, .26 + k * .04, pp);
      const vis = come * (1 - smooth(.85, 1, into));
      P.g.visible = vis > .001;
      if (!P.g.visible) return;
      P.g.position.set(panelX(k), panelCY() - (1 - come) * .35, PANEL_Z).lerp(P_CAST, into);
      P.g.scale.setScalar(1 - .88 * into);
      P.glass.material.uniforms.opacity.value = vis;
      const once = smooth(.22 + k * .03, .29 + k * .03, pp);
      P.mine.visible = once > .001;
      P.mine.material.uniforms.opacity.value = once * vis;
      const callAt = k === 0 ? .46 : .58 + (k - 1) * .05;
      const booked = smooth(callAt, callAt + .07, pp);
      P.call.visible = booked > .001;
      P.call.material.uniforms.opacity.value = booked * vis;
      P.call.material.uniforms.glow.value = .06 + .14 * booked * (1 - smooth(callAt + .07, callAt + .3, pp));
      P.call.position.y = (phy(CALL[0]) + phy(CALL[1])) / 2 - panelCY() + (k ? 0 : (1 - booked) * .6);
    });

    // For the cast: the notifications land on the lock screen, the oldest
    // first, each newer one on top; each lifts off the glass as it lands.
    const pn = t - B.notify;
    const inLock = t > B.notify && t < B.details + .5;
    const landAt = [.34, .22, .1];   // all down before the details slide over
    const arr = landAt.map((a) => smooth(a, a + .1, pn));
    notes.forEach((n, j) => {
      n.m.visible = inLock && arr[j] > .001 && n.h > 0;
      if (!n.m.visible) return;
      let y = SCREEN_H / 2 - 452 * PX_U - n.h / 2;
      for (let i = 0; i < j; i++) y -= arr[i] * (notes[i].h - 6 * PX_U);
      const drop = 1 - arr[j];
      const lift = arr[j] * (1 - smooth(landAt[j] + .1, landAt[j] + .32, pn));
      n.m.position.set(0, y + drop * .45, BODY_D / 2 + .012 + .12 * lift + drop * .08);
      n.m.material.opacity = arr[j];
    });

    // Dust drifts up and comes round again.
    const p = dustGeo.attributes.position.array;
    for (let i = 1; i < p.length; i += 3) { p[i] += dt * .06; if (p[i] > 6) p[i] = 0; }
    dustGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);

    // Labels follow, and the words fade with their beats.
    const W = innerWidth, H = innerHeight;
    const settle = smooth(B.mark - .05, B.mark + .3, t);
    const names = smooth(B.invite + .05, B.invite + .2, t) * (1 - smooth(o + 2.05, o + 2.15, t));
    nameLabels.forEach((l, i) => {
      ringAt(i, tmpA);
      tmpB.set(cards[i].gx ?? rowX(i), cy + cardH() / 2 + .08, cards[i].gz ?? 0);
      l.anchor.copy(tmpA).lerp(tmpB, settle);
      const joined = smooth(sent(i) + .13, sent(i) + .17, pi);
      const out = t < B.mark && joined < .5;
      if (l.out !== out) { l.out = out; l.el.classList.toggle('is-out', out); }
      const pop = joined * (1 - smooth(sent(i) + .17, sent(i) + .4, pi));
      l.el.style.setProperty('--pop', pop.toFixed(3));
      placeLabel(l, names, W, H);
    });
    const front = cards[0].g.position;
    // In the stack the hours give way to the one that matters.
    const hours = smooth(1.3, 1.6, u) * (1 - smooth(2.05, 2.2, u)) + smooth(3.5, 3.65, u) * (1 - smooth(3.72, 3.88, u));
    hourLabels.forEach((l, i) => {
      l.anchor.set(front.x - D.cw / 2 - .07, hy(HOURS[i]), front.z);
      placeLabel(l, hours, W, H);
    });
    gapLabel.anchor.set(front.x - D.cw / 2 - .07, hy(FREE + .5), front.z);
    placeLabel(gapLabel, smooth(2.58, 2.72, u) * (1 - smooth(3.04, 3.14, u)), W, H);

    const projA = smooth(.12, .3, pp) * (1 - smooth(.0, .15, into));
    // A name is as wide as its panel's share of the row, so neighbours never meet.
    tmpA.set(panelX(0), 0, PANEL_Z).project(camera);
    tmpB.set(panelX(1), 0, PANEL_Z).project(camera);
    const pwPx = Math.round(Math.abs(tmpB.x - tmpA.x) * W / 2 - 6);
    projLabels.forEach((l, k) => {
      if (l.w !== pwPx) { l.w = pwPx; l.lw = 0; l.el.style.setProperty('--w', `${pwPx}px`); }
      l.anchor.set(panelX(k), panelCY() + panelH() / 2 + .1, PANEL_Z);
      placeLabel(l, projA, W, H);
    });
    if (TALL) {
      onceLabel.anchor.set(0, D.y0 - .2, PANEL_Z);
      allLabel.anchor.set(0, D.y0 - .2, PANEL_Z);
    } else {
      onceLabel.anchor.set(panelX(PANELS - 1) + D.pw / 2 + .12, (phy(MINE[0]) + phy(MINE[1])) / 2, PANEL_Z);
      allLabel.anchor.set(panelX(PANELS - 1) + D.pw / 2 + .12, (phy(CALL[0]) + phy(CALL[1])) / 2, PANEL_Z);
    }
    placeLabel(onceLabel, smooth(.3, .37, pp) * (1 - smooth(.5, .56, pp)), W, H);
    placeLabel(allLabel, smooth(.72, .8, pp) * (1 - smooth(.0, .12, into)), W, H);
    fadeCopies(t);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
