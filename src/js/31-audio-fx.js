// ---------- 오디오
// 모든 소리는 마스터 컴프레서(ACOUT)를 거쳐 나가 큰 소리가 겹쳐도 찢어지지 않는다.
// 엔진: 톱니파(낮게) + 제트 굉음(잡음)을 같은 저역 필터(engF)·음량(engG)에 묶는다.
//   engG/eng/engF 값은 기존 코드(비행·이착함)가 그대로 조절한다.
let ACOUT, NOISE;
let _aSeed = 777;
const arnd = () => (_aSeed = (_aSeed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; // 소리 전용 난수 (게임 난수와 분리)
function aud() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    ACOUT = AC.createDynamicsCompressor();
    ACOUT.threshold.value = -16;
    ACOUT.knee.value = 12;
    ACOUT.ratio.value = 5;
    ACOUT.connect(AC.destination);
    // 2초 분량의 갈색 잡음(저역이 두꺼운 잡음) — 엔진 굉음 · 폭발 · 발사음에 재사용
    NOISE = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = NOISE.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (arnd() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    eng = AC.createOscillator();
    eng.type = 'sawtooth';
    engG = AC.createGain();
    engF = AC.createBiquadFilter();
    engF.type = 'lowpass';
    engG.gain.value = 0;
    const sawG = AC.createGain();
    sawG.gain.value = 0.28;
    eng.connect(sawG).connect(engF);
    const roar = AC.createBufferSource();
    roar.buffer = NOISE;
    roar.loop = true;
    const roarG = AC.createGain();
    roarG.gain.value = 1.6;
    roar.connect(roarG).connect(engF);
    engF.connect(engG);
    engG.connect(ACOUT);
    eng.start();
    roar.start();
  } catch (x) {}
}
function tone(f, d = 0.1, ty = 'sine', v = 0.07, f2) {
  if (!AC) return;
  const o = AC.createOscillator(),
    n = AC.createGain(),
    c = AC.currentTime;
  o.type = ty;
  o.frequency.setValueAtTime(f, c);
  if (f2) o.frequency.linearRampToValueAtTime(f2, c + d);
  n.gain.setValueAtTime(v, c);
  n.gain.linearRampToValueAtTime(0, c + d);
  o.connect(n);
  n.connect(ACOUT || AC.destination);
  o.start();
  o.stop(c + d);
}
// 걸러진 잡음 한 번: 필터 주파수를 f0 → f1 로 움직인다 (발사 슈욱 · 폭발 굉음)
function noiseSnd(d, v, f0, f1, type = 'lowpass', attack = 0.01) {
  if (!AC || !NOISE) return;
  const s = AC.createBufferSource(),
    fl = AC.createBiquadFilter(),
    n = AC.createGain(),
    c = AC.currentTime;
  s.buffer = NOISE;
  s.loop = true;
  fl.type = type;
  fl.frequency.setValueAtTime(f0, c);
  fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), c + d);
  n.gain.setValueAtTime(0.0001, c);
  n.gain.exponentialRampToValueAtTime(v, c + attack);
  n.gain.exponentialRampToValueAtTime(0.0001, c + d);
  s.connect(fl)
    .connect(n)
    .connect(ACOUT || AC.destination);
  s.start(c, arnd() * 1.5);
  s.stop(c + d + 0.05);
}
// 폭발: 낮게 깔리는 굉음 + 쿵 하는 저음
function boomSnd(d = 0.8, v = 0.25) {
  if (!AC) return;
  noiseSnd(d * 1.6, v * 3, 1400, 90, 'lowpass', 0.008);
  tone(78, d * 0.7, 'sine', v * 1.4, 32);
}
// 미사일 발사: 위로 쓸려 올라가는 슈욱 소리
function launchSnd() {
  noiseSnd(1.1, 0.5, 500, 3200, 'bandpass', 0.03);
  noiseSnd(0.6, 0.35, 1200, 200, 'lowpass', 0.005);
}
// 기총 연사음 (V14.6.0): 방아쇠를 당기는 동안 이어지는 "드르륵". 한 발마다 삐 소리를 내던 것을 바꿨다.
// 잡음(총성 몸통) + 저음 톱니파(쿵쿵)를 rof Hz 사각파로 음량을 흔들어 발마다 맥박을 만든다.
// 노드는 처음 쏠 때 한 번만 만들고, 켜고 끌 때는 출력 음량만 움직인다.
let GUN_SND = null;
function gunSnd(on) {
  if (!AC || !NOISE) return;
  if (!GUN_SND) {
    const src = AC.createBufferSource(),
      bp = AC.createBiquadFilter(),
      thump = AC.createOscillator(),
      lp = AC.createBiquadFilter(),
      thumpG = AC.createGain(),
      gate = AC.createGain(),
      lfo = AC.createOscillator(),
      lfoG = AC.createGain(),
      out = AC.createGain();
    src.buffer = NOISE;
    src.loop = true;
    bp.type = 'bandpass';
    bp.frequency.value = 750;
    bp.Q.value = 0.7;
    thump.type = 'sawtooth';
    thump.frequency.value = 55;
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    thumpG.gain.value = 0.5;
    lfo.type = 'square';
    lfo.frequency.value = P.mig.rof; // 발사 속도와 같은 박자
    lfoG.gain.value = 0.5;
    gate.gain.value = 0.5; // 0.5 ± 0.5 → 0 ~ 1 로 박자마다 끊긴다
    lfo.connect(lfoG).connect(gate.gain);
    src.connect(bp).connect(gate);
    thump.connect(lp).connect(thumpG).connect(gate);
    out.gain.value = 0;
    gate.connect(out).connect(ACOUT || AC.destination);
    src.start();
    thump.start();
    lfo.start();
    GUN_SND = { out, on: false };
  }
  if (GUN_SND.on === on) return;
  GUN_SND.on = on;
  const g = GUN_SND.out.gain,
    c = AC.currentTime;
  g.cancelScheduledValues(c);
  g.setTargetAtTime(on ? 0.45 : 0, c, on ? 0.006 : 0.05); // 켤 때는 바로, 끌 때는 짧은 여운
}
// ---------- 이펙트
const spPool = [];
function getSprite(col, add, map = TX) {
  const s = spPool.pop() || new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false }));
  if (s.material.map !== map) {
    s.material.map = map;
    s.material.needsUpdate = true;
  }
  s.material.color.set(col);
  s.material.blending = add ? T.AdditiveBlending : T.NormalBlending;
  s.material.depthWrite = false;
  s.material.opacity = 1;
  scene.add(s);
  return s;
}
function freeSprite(s) {
  scene.remove(s);
  spPool.push(s);
}
// add 가 참이면 불꽃(가산 혼합 · 더 밝은 불 텍스처 · 식으면서 검붉어짐), 아니면 연기(보통 혼합)
function puff(pos, col, size, life, grow = 1.5, add) {
  const s = getSprite(col, !!add, add ? FIRETX : SMOKETX);
  s.position.copy(pos);
  s.scale.setScalar(size);
  if (add) {
    const c = new T.Color(col).multiplyScalar(2.6);
    fx.push({
      s,
      t: 0,
      life,
      size,
      grow,
      opMax: 0.95,
      fade: 1.3,
      c0: c,
      c1: new T.Color().setRGB(0.5, 0.07, 0.02),
      cPow: 0.6,
    });
  } else fx.push({ s, t: 0, life, size, grow, opMax: 0.62 });
}
function boom(pos, sz) {
  for (let i = 0; i < 9; i++)
    puff(
      pos.clone().add(V(vrnd() - 0.5, vrnd() - 0.5, vrnd() - 0.5).multiplyScalar(sz * 0.5)),
      [0xffcc44, 0xff5500, 0x777777][i % 3],
      sz * (0.7 + vrnd() * 0.5),
      1 + vrnd(),
      2.5,
      i % 3 < 2
    );
  boomSnd(1, 0.3);
  boomVfx(pos, sz);
}
