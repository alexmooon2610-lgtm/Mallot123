// 결정론 계층 — 게임 스크립트보다 먼저 주입된다 (playwright add_init_script).
//  - Math.random  : 고정 시드 난수로 바꾼다. 게임의 rnd 는 로드 시점에 Math.random 을 잡으므로 이것이 된다.
//  - performance.now · requestAnimationFrame : 가짜 시계. __det.step() 을 불러야만 시간이 흐르고 프레임이 돈다.
//  - 키 입력      : __det.key(code, down) 로 같은 프레임에 같은 순서로 넣는다.
// setTimeout 은 실제 시간 그대로 둔다 (게임 판정에는 쓰이지 않고 소리·자막에만 쓰인다).
(() => {
  const seed0 = Number(new URLSearchParams(location.search).get('seed') || 1);
  let s = seed0 >>> 0,
    s2 = 0x9e3779b9; // 프레임 밖 호출용 별도 난수열
  const mulberry = st => {
    let z = st;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
  // 게임의 판정 난수 rnd 는 Math.random 그 자체다(00-core). three.js 도 객체 uuid 를 만들 때 Math.random 을 쓴다.
  // 모델 텍스처 업로드처럼 실제 시간에 맞춰 도는 비동기 콜백이 그 사이에 끼면 판정 난수열이 밀린다.
  // 그래서 reseed 이후 프레임 밖에서 불린 호출은 별도 난수열로 돌리고, 게임 코드가 부른 것이면 기록해 둔다.
  Math.random = function () {
    const d = window.__det;
    if (d && d.armed && !d.inFrame) {
      const site = (new Error().stack.split('\n')[2] || '').trim();
      if (!/three(\.min)?\.js/.test(site) && d.outside.length < 50) d.outside.push(`${d.frame}:${site}`);
      s2 = (s2 + 0x6d2b79f5) >>> 0;
      return mulberry(s2);
    }
    if (d) {
      d.calls++;
      if (d.trace) d.sites.push(`${d.frame}:${(new Error().stack.split('\n')[2] || '').trim()}`);
    }
    s = (s + 0x6d2b79f5) >>> 0; // mulberry32
    return mulberry(s);
  };

  let now = 1000;
  performance.now = () => now;
  let q = [],
    nextId = 1;
  window.requestAnimationFrame = cb => {
    const id = nextId++;
    q.push([id, cb]);
    return id;
  };
  window.cancelAnimationFrame = id => {
    q = q.filter(e => e[0] !== id);
  };

  const DT = 1000 / 60;
  window.__det = {
    frame: 0,
    errors: [],
    calls: 0, // 지금까지 난수를 당긴 횟수 (판정 rnd 와 Math.random 공용)
    trace: false, // true 면 호출 위치를 sites 에 모은다 (디버깅용)
    sites: [],
    outside: [],
    armed: false, // reseed 이후부터 프레임 밖 호출을 감시한다
    inFrame: false,
    reseed(v) {
      s = v >>> 0;
      this.calls = 0;
      this.armed = true;
    },
    get now() {
      return now;
    },
    key(code, down) {
      const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true, cancelable: true });
      window.dispatchEvent(ev);
    },
    // n 프레임을 돌린다. 매 프레임 뒤 hash() 결과를 모아 돌려준다.
    // pre: 첫 프레임 안에서 먼저 실행할 코드 문자열 (start() 처럼 판정 난수를 당기는 준비 동작)
    step(n, inputs, hash, pre) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const f = this.frame;
        now += DT;
        this.inFrame = true;
        if (pre && i === 0) (0, eval)(pre);
        for (const e of (inputs && inputs[f]) || []) this.key(e[0], e[1]);
        const run = q;
        q = [];
        for (const [, cb] of run) {
          try {
            cb(now);
          } catch (err) {
            this.errors.push(`frame ${f}: ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`);
          }
        }
        this.inFrame = false;
        this.frame++;
        if (hash) out.push(hash());
      }
      return out;
    },
  };
})();
