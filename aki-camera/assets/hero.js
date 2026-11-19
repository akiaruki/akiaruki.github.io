// Aki Cam hero: a floating phone whose screen wipes between real app screenshots,
// in front of depth-stacked photographs. Three.js r170 (vendored, MIT).
import * as THREE from './vendor/three.module.min.js';

const SCREENS = [
  { src: 'assets/img/s-camera-720.webp', tag: 'Looks', name: 'アキ 黄金 Kogane' },
  { src: 'assets/img/s-camcorder-720.webp', tag: 'Camcorder', name: 'Handy ’96' },
  { src: 'assets/img/s-pro-720.webp', tag: 'Pro controls', name: 'ISO · Shutter · WB · Focus' },
  { src: 'assets/img/s-filters-720.webp', tag: 'Lens filters', name: 'Black Mist' },
  { src: 'assets/img/s-bw-720.webp', tag: 'Looks', name: 'B&W Noir' },
];
// x, y, z in phone-widths around the phone; photo behind the glass
const CARDS = [
  ['p-sakura', -1.32, 0.62, -0.9], ['p-coast', 1.34, -0.42, -0.8],
  ['p-snow', 2.3, 0.72, -2.0], ['p-maple', -2.25, -0.55, -2.1],
  ['p-bay', 1.22, 1.5, -1.7], ['p-falls', -1.15, -1.55, -1.5],
];
const PW = 1, PH = 2.118, SW = 0.948, SH = SW * 2622 / 1206, R = 0.158;

function roundedShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

const VERT = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const SDF = 'float rr(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}';
const SCREEN_FRAG = `
uniform sampler2D tA,tB;uniform float uMix,uOn;uniform vec2 uSize,uTilt;uniform float uR;varying vec2 vUv;
${SDF}
void main(){
  vec2 p=(vUv-.5)*uSize;float d=rr(p,uSize*.5,uR);float aa=fwidth(d);float a=1.-smoothstep(-aa,aa,d);
  float x=vUv.x+(vUv.y-.5)*.16;float e=uMix*1.36-.18;
  float m=smoothstep(e-.012,e+.012,x);
  vec3 c=mix(texture2D(tB,vUv).rgb,texture2D(tA,vUv).rgb,m);
  float wip=step(.002,uMix)*step(uMix,.998);
  float line=(1.-smoothstep(0.,.007,abs(x-e)))*wip;
  float halo=(1.-smoothstep(0.,.09,abs(x-e)))*wip;
  c+=vec3(.92,.55,.07)*line+vec3(.92,.55,.07)*halo*.08;
  float g=vUv.x*.8+vUv.y*.6+uTilt.x*1.6-uTilt.y*.6;
  c+=vec3(1.)*smoothstep(.55,.9,g)*(1.-smoothstep(.9,1.25,g))*.035;
  c*=uOn;
  gl_FragColor=vec4(c,a);
  #include <colorspace_fragment>
}`;
const CARD_FRAG = `
uniform sampler2D tA;uniform float uDim,uFade;uniform vec2 uSize;uniform float uR;varying vec2 vUv;
${SDF}
void main(){
  vec2 p=(vUv-.5)*uSize;float d=rr(p,uSize*.5,uR);float aa=fwidth(d);float a=1.-smoothstep(-aa,aa,d);
  vec3 c=texture2D(tA,vUv).rgb*uDim;
  gl_FragColor=vec4(c,a*uFade);
  #include <colorspace_fragment>
}`;

export function initHero({ hero, canvas, stage, caption, reduced }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const FOV = 26, DIST = 9;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.z = DIST;

  // Soft studio environment for the metal band: generated, no image download.
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 16, 12), new THREE.MeshBasicMaterial({ color: 0x050506, side: THREE.BackSide })));
  const box = (w, h, x, y, z, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  box(14, 5, 0, 11, 4, 0xffffff); box(5, 16, -12, 2, 5, 0xd0d0d6); box(4, 14, 12, 0, 6, 0xa0a0a8); box(10, 3, 0, -10, 6, 0x2a2a2e);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();

  const rig = new THREE.Group(); scene.add(rig);       // placed at the stage centre
  const phone = new THREE.Group(); rig.add(phone);
  const D = 0.074, BV = 0.018;
  const bodyGeo = new THREE.ExtrudeGeometry(roundedShape(PW - BV * 2, PH - BV * 2, R - BV), { depth: D, bevelEnabled: true, bevelSize: BV, bevelThickness: BV, bevelSegments: 5, curveSegments: 20 });
  bodyGeo.translate(0, 0, -D / 2);
  const metal = new THREE.MeshStandardMaterial({ color: 0x8d8d92, metalness: 1, roughness: 0.28, envMap, envMapIntensity: 1.5 });
  phone.add(new THREE.Mesh(bodyGeo, metal));
  const zf = D / 2 + BV;
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(PW - 0.012, PH - 0.012, R - 0.006), 20), new THREE.MeshBasicMaterial({ color: 0x030304 }));
  glass.position.z = zf + 0.0006; phone.add(glass);
  for (const [x, y, h] of [[PW / 2 + 0.004, 0.34, 0.26], [-PW / 2 - 0.004, 0.52, 0.15], [-PW / 2 - 0.004, 0.32, 0.15]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, 0.036), metal); b.position.set(x, y, 0); phone.add(b);
  }

  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const load = (src) => new Promise((res, rej) => loader.load(src, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, maxAniso); res(t); }, undefined, rej));
  const blank = new THREE.DataTexture(new Uint8Array([4, 4, 5, 255]), 1, 1); blank.needsUpdate = true;

  const screenMat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: SCREEN_FRAG, transparent: true,
    uniforms: { tA: { value: blank }, tB: { value: blank }, uMix: { value: 0 }, uOn: { value: 1 }, uSize: { value: new THREE.Vector2(SW, SH) }, uR: { value: R - 0.028 }, uTilt: { value: new THREE.Vector2() } },
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
  screen.position.z = zf + 0.0014; phone.add(screen);

  // faint halo so the phone separates from the black
  const hc = document.createElement('canvas'); hc.width = hc.height = 128;
  const hx = hc.getContext('2d'); const gr = hx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  hx.fillStyle = gr; hx.fillRect(0, 0, 128, 128);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, opacity: 0.11, depthWrite: false }));
  halo.position.z = -0.6; halo.renderOrder = -2; rig.add(halo);

  const cards = [];
  const CW = 0.86, CH = CW * 4 / 3;
  const cardGeo = new THREE.PlaneGeometry(CW, CH);
  CARDS.forEach(([name, x, y, z], i) => {
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: CARD_FRAG, transparent: true, depthWrite: false,
      uniforms: { tA: { value: blank }, uDim: { value: Math.max(.22, .62 + z * .17) }, uFade: { value: 0 }, uSize: { value: new THREE.Vector2(CW, CH) }, uR: { value: 0.06 } } });
    const m = new THREE.Mesh(cardGeo, mat); m.renderOrder = -1; rig.add(m);
    const c = { m, mat, x, y, z, i, target: 0 }; cards.push(c);
    load(`assets/img/${name}-420.webp`).then((t) => { mat.uniforms.tA.value = t; c.target = 1; wake(); }).catch(() => {});
  });

  // ---------- layout ----------
  let W = 1, H = 1, ratio = 1, scale = 1, narrow = false, baseX = 0, baseY = 0, dprCap = Math.min(window.devicePixelRatio || 1, 2);
  function layout() {
    const hr = hero.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(hr.width)); H = Math.max(1, Math.round(hr.height));
    const budget = 3.6e6;
    ratio = Math.min(dprCap, Math.sqrt(budget / (W * H)));
    renderer.setPixelRatio(ratio); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const k = (2 * DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / H;      // world units per CSS px at z=0
    const desk = window.innerWidth >= 900;
    const px = Math.min(sr.height * (desk ? 0.78 : 0.86), sr.width * 0.62 * PH, desk ? 780 : 600);
    scale = (px * k) / PH;
    narrow = sr.width < 640;
    baseX = ((sr.left + sr.width / 2) - (hr.left + W / 2)) * k;
    baseY = -(((sr.top + sr.height / 2) - (desk ? 22 : 16)) - (hr.top + H / 2)) * k;
    rig.scale.setScalar(scale);
    wake();
  }

  // ---------- motion state ----------
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollP = 0, t0 = performance.now(), intro = reduced ? 1 : 0, running = false, visible = true, raf = 0, last = 0, dirty = true;
  let cur = 0, wipeT = -1, nextAt = 0, texs = [];
  const fine = window.matchMedia('(pointer:fine)').matches;

  function onPointer(e) {
    const r = hero.getBoundingClientRect();
    ptr.tx = ((e.clientX - r.left) / r.width - .5) * 2; ptr.ty = ((e.clientY - r.top) / r.height - .5) * 2;
  }
  function onScroll() { scrollP = Math.min(1.2, Math.max(0, window.scrollY / Math.max(1, H))); wake(); }

  function setCaption(i) {
    if (!caption) return;
    caption.innerHTML = ''; const d = document.createElement('i'); const b = document.createElement('b');
    b.textContent = SCREENS[i].tag; caption.append(d, b, document.createTextNode(SCREENS[i].name));
  }

  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const io2 = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  let slow = 0, frames = 0;

  function frame(now) {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    const t = (now - t0) / 1000;
    if (!reduced) {
      intro = Math.min(1, intro + dt / 1.5);
      ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 4); ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 4);
    }
    const e = ease(intro), bob = reduced ? 0 : Math.sin(t * .7) * .018;
    const ry = -0.34 + (1 - e) * 0.55 + ptr.x * 0.2 + scrollP * 0.95 + (reduced ? 0 : Math.sin(t * .45) * .035);
    const rx = 0.07 + ptr.y * 0.1 - scrollP * 0.3;
    phone.rotation.set(rx, ry, -0.035 + scrollP * 0.06);
    phone.position.set(0, bob + (1 - e) * -0.12, 0);
    rig.position.set(baseX, baseY - scrollP * 0.9, 0);
    screenMat.uniforms.uTilt.value.set(ry, rx);
    halo.material.opacity = 0.11 * e;
    const spread = narrow ? 0.6 : 1;
    for (const c of cards) {
      const f = c.mat.uniforms.uFade; f.value = reduced ? c.target : f.value + (c.target * e - f.value) * Math.min(1, dt * 2.2);
      const depth = -c.z;
      c.m.position.set(c.x * spread - ptr.x * 0.05 * depth, c.y + (reduced ? 0 : Math.sin(t * .5 + c.i * 1.7) * .03) + ptr.y * 0.03 * depth - scrollP * depth * 0.35, c.z);
      c.m.rotation.set(0, -c.x * 0.16 + ptr.x * 0.05, c.x * 0.012);
      c.m.visible = !(narrow && c.y > 1.2);
    }
    // screen wipe
    if (wipeT >= 0) {
      wipeT += dt / 1.15;
      screenMat.uniforms.uMix.value = io2(Math.min(1, wipeT));
      if (wipeT >= 1) { screenMat.uniforms.tA.value = screenMat.uniforms.tB.value; screenMat.uniforms.uMix.value = 0; wipeT = -1; nextAt = now + 3400; }
    } else if (!reduced && nextAt && now > nextAt && texs.length > 1) {
      const n = (cur + 1) % SCREENS.length;
      if (texs[n]) { cur = n; screenMat.uniforms.tB.value = texs[n]; wipeT = 0; setCaption(n); } else nextAt = now + 400;
    }
    renderer.render(scene, camera);
    // adapt the resolution if this device cannot keep up
    if (!reduced) {
      frames++; if (dt > 0.024) slow++;
      if (frames >= 90) { if (slow > 45 && dprCap > 1) { dprCap = Math.max(1, dprCap * 0.75); layout(); } frames = slow = 0; }
    }
    dirty = false;
    if (running && visible && !reduced) raf = requestAnimationFrame(frame);
  }
  function wake() { dirty = true; if (!raf && running && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  // ---------- lifecycle ----------
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting && !document.hidden; if (visible) wake(); }, { rootMargin: '80px' });
  io.observe(hero);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden && hero.getBoundingClientRect().bottom > 0; if (visible) wake(); });
  window.addEventListener('scroll', onScroll, { passive: true });
  if (fine && !reduced) window.addEventListener('pointermove', onPointer, { passive: true });
  let rz = 0;
  new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(layout); }).observe(hero);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; hero.classList.remove('gl-on'); });
  canvas.addEventListener('webglcontextrestored', () => { running = true; hero.classList.add('gl-on'); wake(); });

  return load(SCREENS[0].src).then((t) => {
    texs[0] = t; screenMat.uniforms.tA.value = t; screenMat.uniforms.tB.value = t;
    layout(); onScroll(); setCaption(0);
    running = true; renderer.compile(scene, camera);
    frame(performance.now());
    hero.classList.add('gl-on');
    nextAt = performance.now() + 3200;
    if (!reduced) {
      // remaining screens arrive one at a time, after the first frame is on screen
      let p = Promise.resolve();
      SCREENS.slice(1).forEach((s, i) => { p = p.then(() => load(s.src)).then((tx) => { texs[i + 1] = tx; renderer.initTexture(tx); }).catch(() => {}); });
    }
    return true;
  });
}
