// ===== 배경 음악: 게임 안에서 직접 연주하는 합성 음악 (음원 파일 없음) =====
// 곡: 코로베이니키 (러시아 민요, 1861 · 저작권 없음) 편곡.
//   menu    — 잔잔한 편곡: 벨 선율 · 발랄라이카풍 트레몰로 · 패드 · 잔향
//   op-real — 오프닝 실제 역사: 느린 현악 지속음 · 낮은 벨 · 시계 째깍
//   op-alt  — 오프닝 대체역사: 타이코 · 팀파니 · 현악 스타카토 · 금관 주제 (강하게)
// musicCue(이름) 로 바꾼다. 메뉴 음악은 아래 감시기가 화면 상태를 보고 알아서 튼다.
const MUS = { bus: null, in: null, track: null, name: null, step: 0, next: 0, vol: 0.9, timer: null, fadeT: 0 };
let _mSeed = 4242;
const mrnd = () => (_mSeed = (_mSeed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; // 음악 전용 난수
const m2f = m => 440 * Math.pow(2, (m - 69) / 12);

function musInit() {
  if (MUS.bus) return true;
  if (!AC) return false;
  try {
    MUS.bus = AC.createGain();
    MUS.bus.gain.value = 0;
    MUS.in = AC.createGain();
    // 잔향: 잡음을 지수 감쇠시킨 2.8초 임펄스 (스테레오)
    const len = (AC.sampleRate * 2.8) | 0,
      ir = AC.createBuffer(2, len, AC.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (mrnd() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const rev = AC.createConvolver(),
      wet = AC.createGain(),
      dry = AC.createGain();
    rev.buffer = ir;
    wet.gain.value = 0.32;
    dry.gain.value = 0.85;
    MUS.in.connect(dry).connect(MUS.bus);
    MUS.in.connect(rev).connect(wet).connect(MUS.bus);
    MUS.bus.connect(ACOUT || AC.destination);
    return true;
  } catch (e) {
    MUS.bus = null;
    return false;
  }
}

// ---------- 악기 (t: 시작 시각, f: 주파수, d: 길이 초, v: 세기)
function envGain(t, v, a, d, r) {
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + a);
  g.gain.setValueAtTime(Math.max(v, 0.0002), t + a + Math.max(0, d - a));
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, d) + r);
  g.connect(MUS.in);
  return g;
}
function osc(type, f, t, end, out, detune = 0) {
  const o = AC.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  o.connect(out);
  o.start(t);
  o.stop(end + 0.05);
  return o;
}
const INST = {
  // 벨/첼레스타: 맑게 울리고 사라진다
  bell(t, f, d, v) {
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 + d);
    g.connect(MUS.in);
    osc('sine', f, t, t + 1.7 + d, g);
    const g2 = AC.createGain();
    g2.gain.value = 0.22;
    g2.connect(g);
    osc('sine', f * 3.01, t, t + 0.6, g2);
  },
  // 발랄라이카풍 뜯는 소리
  pluck(t, f, d, v) {
    const fl = AC.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = 2;
    fl.frequency.setValueAtTime(3800, t);
    fl.frequency.exponentialRampToValueAtTime(500, t + 0.35);
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    fl.connect(g).connect(MUS.in);
    osc('sawtooth', f, t, t + 0.5, fl);
    osc('square', f * 2, t, t + 0.2, fl, 4);
  },
  // 트레몰로: 같은 음을 빠르게 반복 (발랄라이카 · 만돌린 느낌)
  trem(t, f, d, v) {
    const n = Math.max(1, Math.round(d / 0.075));
    for (let i = 0; i < n; i++) INST.pluck(t + i * (d / n), f, d / n, v * (i % 2 ? 0.7 : 1));
  },
  // 부드러운 패드
  pad(t, f, d, v) {
    const fl = AC.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = 1100;
    const g = envGain(t, v, 0.7, d, 1.2);
    fl.connect(g);
    osc('sawtooth', f, t, t + d + 1.3, fl, -7);
    osc('sawtooth', f, t, t + d + 1.3, fl, 7);
  },
  // 현악 (attack 짧으면 스타카토)
  str(t, f, d, v, a = 0.12) {
    const fl = AC.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = 2400;
    const g = envGain(t, v, a, d, a < 0.05 ? 0.12 : 0.6);
    fl.connect(g);
    osc('sawtooth', f, t, t + d + 0.7, fl, -9);
    osc('sawtooth', f, t, t + d + 0.7, fl, 9);
    osc('triangle', f / 2, t, t + d + 0.7, fl);
  },
  // 금관
  brass(t, f, d, v) {
    const fl = AC.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = 1.5;
    fl.frequency.setValueAtTime(350, t);
    fl.frequency.exponentialRampToValueAtTime(2600, t + 0.07);
    fl.frequency.exponentialRampToValueAtTime(1300, t + 0.4);
    const g = envGain(t, v, 0.04, d, 0.25);
    fl.connect(g);
    osc('sawtooth', f, t, t + d + 0.3, fl, -5);
    osc('sawtooth', f, t, t + d + 0.3, fl, 6);
    osc('square', f / 2, t, t + d + 0.3, fl);
  },
  bass(t, f, d, v) {
    const g = envGain(t, v, 0.02, d * 0.9, 0.2);
    osc('triangle', f, t, t + d + 0.25, g);
    osc('sine', f / 2, t, t + d + 0.25, g);
  },
  // 타이코 북
  taiko(t, v) {
    const g = AC.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    g.connect(MUS.in);
    const o = osc('sine', 120, t, t + 0.95, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.45);
    if (NOISE) {
      const s = AC.createBufferSource(),
        fl = AC.createBiquadFilter(),
        ng = AC.createGain();
      s.buffer = NOISE;
      fl.type = 'lowpass';
      fl.frequency.value = 700;
      ng.gain.setValueAtTime(v * 1.4, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      s.connect(fl).connect(ng).connect(MUS.in);
      s.start(t, mrnd());
      s.stop(t + 0.3);
    }
  },
  timp(t, f, v) {
    const g = AC.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    g.connect(MUS.in);
    const o = osc('sine', f * 1.03, t, t + 1.9, g);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.15);
    osc('triangle', f * 2, t, t + 0.4, g);
  },
  snare(t, v) {
    if (!NOISE) return;
    const s = AC.createBufferSource(),
      fl = AC.createBiquadFilter(),
      g = AC.createGain();
    s.buffer = NOISE;
    fl.type = 'highpass';
    fl.frequency.value = 1500;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    s.connect(fl).connect(g).connect(MUS.in);
    s.start(t, mrnd());
    s.stop(t + 0.2);
  },
  tick(t, v) {
    const g = AC.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    g.connect(MUS.in);
    osc('square', 2400, t, t + 0.04, g);
  },
};

// ---------- 악보 (8분음표 단위 [MIDI 음, 길이]) · 0 = 쉼표
// 코로베이니키 A 부분 (8마디)
const KORO_A = [
  [
    [76, 2],
    [71, 1],
    [72, 1],
    [74, 2],
    [72, 1],
    [71, 1],
  ],
  [
    [69, 2],
    [69, 1],
    [72, 1],
    [76, 2],
    [74, 1],
    [72, 1],
  ],
  [
    [71, 3],
    [72, 1],
    [74, 2],
    [76, 2],
  ],
  [
    [72, 2],
    [69, 2],
    [69, 4],
  ],
  [
    [0, 1],
    [74, 2],
    [77, 1],
    [81, 2],
    [79, 1],
    [77, 1],
  ],
  [
    [76, 3],
    [72, 1],
    [76, 2],
    [74, 1],
    [72, 1],
  ],
  [
    [71, 2],
    [71, 1],
    [72, 1],
    [74, 2],
    [76, 2],
  ],
  [
    [72, 2],
    [69, 2],
    [69, 4],
  ],
];
const KORO_A_CH = ['Am', 'Am', 'E', 'Am', 'Dm', 'C', 'E', 'Am'];
// 코로베이니키 B 부분 (2분음표, 8마디)
const KORO_B = [
  [
    [76, 4],
    [72, 4],
  ],
  [
    [74, 4],
    [71, 4],
  ],
  [
    [72, 4],
    [69, 4],
  ],
  [
    [68, 4],
    [71, 4],
  ],
  [
    [76, 4],
    [72, 4],
  ],
  [
    [74, 4],
    [71, 4],
  ],
  [
    [72, 2],
    [76, 2],
    [81, 4],
  ],
  [[80, 8]],
];
const KORO_B_CH = ['Am', 'E', 'Am', 'E', 'Am', 'E', 'Am', 'E'];
const CHORD = { Am: [57, 60, 64], E: [56, 59, 64], Dm: [57, 62, 65], C: [55, 60, 64], F: [57, 60, 65] };
const ROOT = { Am: 45, E: 40, Dm: 38, C: 36, F: 41 };
// 마디 안에서 8분음표 위치 k 에 시작하는 음 찾기
function noteAt(bar, k) {
  let pos = 0;
  for (const [m, l] of bar) {
    if (pos === k) return m ? [m, l] : null;
    pos += l;
  }
  return null;
}

// ---------- 곡: step(i, t, e) — i 는 8분음표(또는 16분음표) 번호, t 는 시각, e 는 한 칸 길이(초)
const TRACKS = {
  menu: {
    bpm: 66,
    div: 2, // 4분음표당 칸 수 (8분음표)
    bars: 32,
    vol: 0.85,
    step(i, t, e) {
      const bar = (i / 8) | 0,
        k = i % 8,
        sec = (bar / 8) | 0,
        b8 = bar % 8,
        isA = sec % 2 === 0,
        mel = isA ? KORO_A[b8] : KORO_B[b8],
        ch = isA ? KORO_A_CH[b8] : KORO_B_CH[b8];
      const n = noteAt(mel, k);
      if (n) {
        const [m, l] = n;
        if (sec === 0) INST.bell(t, m2f(m), l * e, 0.13);
        else if (sec === 1) INST.trem(t, m2f(m - 12), l * e, 0.035);
        else if (sec === 2) INST.str(t, m2f(m - 12), l * e * 0.95, 0.03, 0.18);
        else INST.bell(t, m2f(m - 12), l * e, 0.11);
      }
      if (k === 0) CHORD[ch].forEach(m => INST.pad(t, m2f(m), 8 * e, 0.018));
      if (k === 0 || k === 4) INST.bass(t, m2f(ROOT[ch]), 3.6 * e, 0.07);
      // 잔잔한 뜯는 소리 반주
      if (k % 2 === 1 && sec !== 1) INST.pluck(t, m2f(CHORD[ch][(k >> 1) % 3] + 12), e, 0.012);
    },
  },
  'op-real': {
    bpm: 56,
    div: 2,
    bars: 8,
    vol: 1.5,
    step(i, t, e) {
      const bar = (i / 8) | 0,
        k = i % 8,
        ch = ['Am', 'Am', 'F', 'E', 'Am', 'Dm', 'E', 'E'][bar];
      if (k === 0) {
        INST.str(t, m2f(ROOT[ch] + 12), 8 * e, 0.035, 0.9);
        INST.str(t, m2f(ROOT[ch] + 19), 8 * e, 0.018, 1.2);
      }
      if (k % 2 === 0) INST.tick(t, 0.012);
      const n = noteAt(KORO_B[bar], k);
      if (n) INST.bell(t, m2f(n[0] - 12), n[1] * e, 0.07);
    },
  },
  'op-alt': {
    bpm: 112,
    div: 4, // 16분음표
    bars: 16,
    vol: 1,
    step(i, t, e) {
      const bar = (i / 16) | 0,
        k = i % 16,
        b8 = bar % 8,
        second = bar >= 8,
        ch = second ? KORO_B_CH[b8] : KORO_A_CH[b8],
        root = ROOT[ch];
      // 북: 타이코 리듬 + 4마디마다 스네어 롤
      if ([0, 3, 6, 8, 10, 14].includes(k)) INST.taiko(t, k === 0 ? 0.5 : 0.3);
      if (k === 4 || k === 12) INST.snare(t, 0.09);
      if (bar % 4 === 3 && k >= 8) INST.snare(t, 0.03 + (k - 8) * 0.012);
      // 현악 스타카토 8분음표 오스티나토
      if (k % 2 === 0) {
        const pat = [0, 0, 3, 0, 7, 0, 5, 0][(k >> 1) % 8];
        INST.str(t, m2f(root + 12 + pat), e * 1.6, 0.03, 0.01);
      }
      if (k % 4 === 0) INST.bass(t, m2f(root), e * 3.5, 0.09);
      // 금관 주제 (A: 8분음표 선율 / B: 2분음표 + 팀파니)
      if (k % 2 === 0) {
        const kk = k >> 1,
          n = noteAt(second ? KORO_B[b8] : KORO_A[b8], kk);
        if (n) {
          INST.brass(t, m2f(n[0] - 12), n[1] * e * 2 * 0.92, second ? 0.05 : 0.04);
          if (second) {
            INST.brass(t, m2f(n[0] - 24), n[1] * e * 2 * 0.92, 0.035);
            INST.timp(t, m2f(root + 12), 0.22);
          }
        }
      }
      if (k === 0) CHORD[ch].forEach(m => INST.str(t, m2f(m - 12), 16 * e, 0.012, 0.3));
    },
  },
};

// ---------- 재생기: 25ms 마다 0.2초 앞까지 미리 예약
function musTick() {
  if (!MUS.track || !AC || AC.state !== 'running') return;
  const tr = MUS.track,
    e = 60 / tr.bpm / tr.div,
    total = tr.bars * 4 * tr.div;
  // 이미 지나간 칸은 연주하지 않고 박자만 맞춰 건너뛴다
  if (MUS.next < AC.currentTime) {
    const skip = Math.ceil((AC.currentTime - MUS.next) / e);
    MUS.step += skip;
    MUS.next += skip * e;
  }
  while (MUS.next < AC.currentTime + 0.2) {
    try {
      tr.step(MUS.step % total, MUS.next, e);
    } catch (x) {}
    MUS.step++;
    MUS.next += e;
  }
}
// 음악 크기: 0 끔 · 1 작게 · 2 보통 (설정 화면에서 고르고 저장한다)
const MUS_LEVELS = [0, 0.4, 0.9];
MUS.level = 2;
try {
  const l = +localStorage.getItem('stMusic');
  if (localStorage.getItem('stMusic') !== null && MUS_LEVELS[l] !== undefined) MUS.level = l;
} catch (e) {}
MUS.vol = MUS_LEVELS[MUS.level];
function musicLevel(l) {
  MUS.level = l;
  MUS.vol = MUS_LEVELS[l];
  try {
    localStorage.setItem('stMusic', l);
  } catch (e) {}
  if (MUS.bus && MUS.track) {
    const c = AC.currentTime,
      gg = MUS.bus.gain;
    gg.cancelScheduledValues(c);
    gg.setTargetAtTime(MUS.vol * MUS.track.vol, c, 0.15);
  }
}
// name: 곡 이름 또는 null(끄기), fade: 서서히 바뀌는 시간(초)
function musicCue(name, fade = 1.2) {
  if (name === MUS.name) return;
  // 오디오 준비가 실패하면 이름을 기록하지 않는다 (다음 요청에서 다시 시도)
  if (!musInit()) return;
  MUS.name = name;
  const c = AC.currentTime,
    gg = MUS.bus.gain;
  gg.cancelScheduledValues(c);
  gg.setValueAtTime(gg.value, c);
  gg.linearRampToValueAtTime(0, c + fade * 0.5);
  clearTimeout(MUS.swap);
  MUS.swap = setTimeout(() => {
    MUS.track = name ? TRACKS[name] : null;
    MUS.step = 0;
    MUS.next = AC.currentTime + 0.05;
    if (!MUS.track) return;
    const c2 = AC.currentTime;
    gg.cancelScheduledValues(c2);
    gg.setValueAtTime(0, c2);
    gg.linearRampToValueAtTime(MUS.vol * MUS.track.vol, c2 + fade * 0.5);
  }, fade * 500);
  if (!MUS.timer) MUS.timer = setInterval(musTick, 25);
}
// 메뉴 음악 감시: 오프닝이 아니고 비행 중이 아니면 메뉴 곡
setInterval(() => {
  try {
    if (!AC) return;
    if (window.__stOpeningOpen) return;
    musicCue(S === 'play' ? null : 'menu', S === 'play' ? 1.5 : 2.4);
  } catch (e) {}
}, 300);
// 브라우저는 첫 입력 전에는 소리를 막는다: 키보드만 써도 첫 입력에서 오디오를 켠다
for (const ev of ['keydown', 'pointerdown'])
  addEventListener(
    ev,
    () => {
      try {
        aud();
        if (AC && AC.state === 'suspended') AC.resume();
      } catch (e) {}
    },
    true
  );
