/* ===== 구름층 (맑은 날에도 늘 있는 층운) =====
   현실처럼 하늘에는 일정 고도부터 구름층이 깔려 있다. 맑은 날이면 듬성듬성(산개운), 흐린 날이면 두껍게.
   - 바닥판(CLOUD_BASE)과 윗판(CLOUD_BASE + CLOUD_THICK) 두 장의 가로 면에 같은 이음매 없는 잡음 무늬를 깐다.
     밑에서 보면 회색 구름 밑면, 위에서 보면 흰 구름 윗면, 그 사이에선 구름 속이다.
   - 기존 구름 스프라이트 34개는 층 위로 솟은 뭉게구름 꼭대기로 옮긴다 (구름이 짙은 자리에만).
   - 무늬는 20 km 마다 반복되고, 판은 20 km 단위로만 플레이어를 따라가 무늬가 땅에 고정돼 보인다.
   - 연출 전용이라 게임 난수(rnd)를 쓰지 않는다. 기존 스프라이트를 만들 때 쓴 rnd 호출은 그대로다.
*/
const CLOUD_BASE = 2600,
  CLOUD_THICK = 520,
  CLOUD_TILE = 20000,
  CLOUD_COVER = { CLEAR: [0.5, 0.64], CLOUDY: [0.36, 0.52], RAIN: [0.22, 0.4], FOG: [0.3, 0.46], STORM: [0.1, 0.26] };
const cloudLayer = (() => {
  let seed = 19991218;
  const lr = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const N = 256,
    noise = new Float32Array(N * N);
  // 이음매 없는 값 잡음 (격자 크기 8·16·32·64 를 겹친 fbm)
  for (const [g, w] of [
    [4, 0.5],
    [8, 0.25],
    [16, 0.15],
    [32, 0.1],
  ]) {
    const grid = new Float32Array(g * g).map(lr),
      at = (i, j) => grid[((j + g) % g) * g + ((i + g) % g)],
      sm = x => x * x * (3 - 2 * x);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const fx = (x / N) * g,
          fy = (y / N) * g,
          i = Math.floor(fx),
          j = Math.floor(fy),
          u = sm(fx - i),
          v = sm(fy - j);
        noise[y * N + x] +=
          w * ((at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v);
      }
  }
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const cx = cv.getContext('2d'),
    img = cx.createImageData(N, N);
  const tex = new T.CanvasTexture(cv);
  tex.encoding = T.sRGBEncoding;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  const REP = 6; // 120 km 판 위에 20 km 무늬 6번
  tex.repeat.set(REP, REP);
  let cover = CLOUD_COVER.CLEAR;
  const alphaAt = n => clamp((n - cover[0]) / (cover[1] - cover[0]), 0, 1);
  function paint() {
    for (let k = 0; k < N * N; k++) {
      const a = alphaAt(noise[k]);
      img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = 255;
      img.data[k * 4 + 3] = Math.round(255 * a * a * (3 - 2 * a));
    }
    cx.putImageData(img, 0, 0);
    tex.needsUpdate = true;
  }
  paint();
  const mk = (color, y, op) => {
    const m = new T.Mesh(
      new T.PlaneGeometry(CLOUD_TILE * REP, CLOUD_TILE * REP),
      new T.MeshBasicMaterial({
        map: tex,
        color,
        transparent: true,
        opacity: op,
        depthWrite: false,
        side: T.DoubleSide,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = -1;
    scene.add(m);
    return m;
  };
  const bottom = mk(0xbcc7d1, CLOUD_BASE, 0.9),
    top = mk(0xffffff, CLOUD_BASE + CLOUD_THICK, 0.85);
  // 월드 좌표 → 잡음 값 (판의 무늬와 같은 자리). 판 중심이 타일 경계에 맞춰져 있어 타일 기준으로 바로 잰다.
  const sample = (x, z) => {
    const u = (((x / CLOUD_TILE) % 1) + 1) % 1,
      v = (((-z / CLOUD_TILE) % 1) + 1) % 1;
    return noise[(Math.floor((1 - v) * N) % N) * N + (Math.floor(u * N) % N)];
  };
  // 뭉게구름 꼭대기: 기존 스프라이트를 짙은 자리로 옮긴다 (80 km 주기 = 타일의 4배라 래핑해도 무늬와 맞는다)
  for (const c of clouds) {
    let x = 0,
      z = 0;
    for (let k = 0; k < 40; k++) {
      x = (lr() - 0.5) * 80000;
      z = (lr() - 0.5) * 80000;
      if (alphaAt(sample(x, z)) > 0.85) break;
    }
    c.position.set(x, CLOUD_BASE + CLOUD_THICK * 0.75 + lr() * 380, z);
    c.scale.set(2600 + lr() * 2600, 900 + lr() * 700, 1);
  }
  return {
    mats: [bottom.material, top.material], // 날씨 · 시간대 색 (02-weather)
    // 날씨에 따라 덮인 정도를 바꾼다 (지금 임무는 전부 CLEAR — 맑아도 산개운은 있다)
    setWeather(w) {
      const c = CLOUD_COVER[w] || CLOUD_COVER.CLEAR;
      if (c === cover) return;
      cover = c;
      paint();
    },
    // 판을 20 km 단위로만 옮겨 무늬를 땅에 고정하고, 바람에 아주 천천히 흘린다
    update(pos, dt) {
      const sx = Math.round(pos.x / CLOUD_TILE) * CLOUD_TILE,
        sz = Math.round(pos.z / CLOUD_TILE) * CLOUD_TILE;
      bottom.position.x = top.position.x = sx;
      bottom.position.z = top.position.z = sz;
      tex.offset.x = (tex.offset.x + dt * 0.0004) % 1;
      for (const c of clouds) c.position.x -= dt * 0.0004 * CLOUD_TILE; // 뭉게구름도 같은 바람에 (−x 로 8 m/s)
    },
    // 이 자리에서 구름판이 사방을 완전히 가리는가 (가리면 그 너머는 그릴 필요가 없다).
    // 층 한가운데이면서 주변 400 m 가 모두 짙을 때만 참이라, 구름이 옅은 틈에서는 바다가 그대로 보인다.
    opaqueAround(pos) {
      if (pos.y < CLOUD_BASE + 40 || pos.y > CLOUD_BASE + CLOUD_THICK - 40) return false;
      const x = pos.x + tex.offset.x * CLOUD_TILE;
      for (const [dx, dz] of [
        [0, 0],
        [400, 0],
        [-400, 0],
        [0, 400],
        [0, -400],
      ])
        if (alphaAt(sample(x + dx, pos.z + dz)) < 0.97) return false;
      return true;
    },
    // 구름 속 정도 (0~1): 층 높이 안이고 그 자리 구름이 짙을수록 크다. 무늬가 바람에 흐른 만큼 더해서 잰다.
    density(pos) {
      if (pos.y < CLOUD_BASE - 60 || pos.y > CLOUD_BASE + CLOUD_THICK + 60) return 0;
      return alphaAt(sample(pos.x + tex.offset.x * CLOUD_TILE, pos.z));
    },
  };
})();
