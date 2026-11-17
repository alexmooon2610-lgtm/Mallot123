// ===== 인트로 로고 · 로딩 문구 · 표지 사진 =====
(() => {
  const $id = i => document.getElementById(i),
    intro = $id('mf-intro'),
    logo = $id('mallot-logo-canvas'),
    ko = () => $id('mf-lang-ko').classList.contains('selected');
  // 로고: 스텐실 MALLOT + 빨·파·초 비행운 세 줄이 전투기 한 대로 모인다 (THREE LINES. ONE FLIGHT.)
  const LOGO = { W: 540, H: 190, cols: ['#e8444b', '#4a8be0', '#5bc58a'] };
  function logoGlyphs() {
    // cut: 스텐실 틈 [왼쪽, 위, 폭, 높이]
    // 글자 뼈대(선 중심) · 단위: 글자 높이 10 · 폭 7 기준. 획 끝은 bevel 이음으로 각지게 깎인다.
    return {
      M: {
        w: 7,
        p: [
          [
            [1.1, 8.9],
            [1.1, 1.1],
            [3.5, 5.2],
            [5.9, 1.1],
            [5.9, 8.9],
          ],
        ],
      },
      A: {
        w: 7,
        p: [
          [
            [1.1, 8.9],
            [1.1, 3],
            [3, 1.1],
            [4, 1.1],
            [5.9, 3],
            [5.9, 8.9],
          ],
          [
            [1.1, 5.7],
            [5.9, 5.7],
          ],
        ],
        cut: [[3.25, 0, 0.5, 2.2]],
      },
      L: {
        w: 6.4,
        p: [
          [
            [1.1, 0.6],
            [1.1, 8.9],
            [6.1, 8.9],
          ],
        ],
      },
      O: {
        w: 7,
        p: [
          [
            [2.7, 1.1],
            [4.3, 1.1],
            [5.9, 2.7],
            [5.9, 7.3],
            [4.3, 8.9],
            [2.7, 8.9],
            [1.1, 7.3],
            [1.1, 2.7],
            [2.7, 1.1],
          ],
        ],
        cut: [
          [3.25, 0, 0.5, 2.2],
          [3.25, 7.8, 0.5, 2.2],
        ],
      },
      T: {
        w: 7,
        p: [
          [
            [0.4, 1.1],
            [6.6, 1.1],
          ],
          [
            [3.5, 1.1],
            [3.5, 9.4],
          ],
        ],
        cut: [[1.9, 2.2, 3.2, 0.5]],
      },
    };
  }
  function drawLogo(k) {
    k = k == null ? 1 : k;
    const c = logo,
      x = c.getContext('2d'),
      R = 2,
      { W, H, cols } = LOGO;
    if (c.width !== W * R) {
      c.width = W * R;
      c.height = H * R;
    }
    x.setTransform(R, 0, 0, R, 0, 0);
    x.clearRect(0, 0, W, H);
    const G = logoGlyphs(),
      word = 'MALLOT',
      u = 8.2,
      gap = 1.5,
      sk = -0.2,
      stroke = 2.3;
    const tw = [...word].reduce((t, ch, i) => t + G[ch].w + (i ? gap : 0), 0) * u,
      x0 = (W - tw) / 2 + 9,
      y0 = 16;
    // 글자 한 겹 그리기 (기울임 + 스텐실 틈)
    const word1 = (dx, dy, fill) => {
      const off = document.createElement('canvas');
      off.width = W * R;
      off.height = H * R;
      const o = off.getContext('2d');
      o.setTransform(R, 0, 0, R, 0, 0);
      o.translate(x0 + dx, y0 + dy);
      o.transform(1, 0, sk, 1, -sk * 10 * u, 0);
      o.lineWidth = stroke * u;
      o.lineJoin = 'bevel';
      o.lineCap = 'butt';
      o.strokeStyle = fill;
      let cx = 0;
      for (const ch of word) {
        const g = G[ch];
        for (const path of g.p) {
          o.beginPath();
          path.forEach(([px, py], i) => (i ? o.lineTo(cx + px * u, py * u) : o.moveTo(cx + px * u, py * u)));
          o.stroke();
        }
        o.globalCompositeOperation = 'destination-out';
        (g.cut || []).forEach(([cx0, cy0, cw, ch2]) => o.fillRect(cx + cx0 * u, cy0 * u, cw * u, ch2 * u));
        o.globalCompositeOperation = 'source-over';
        cx += (g.w + gap) * u;
      }
      x.save();
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.drawImage(off, 0, 0);
      x.restore();
    };
    word1(5, 5, '#02050d');
    word1(2.5, 2.5, '#40587d');
    const gr = x.createLinearGradient(0, y0, 0, y0 + 10 * u);
    gr.addColorStop(0, '#fbfaf3');
    gr.addColorStop(0.62, '#e9e6da');
    gr.addColorStop(1, '#b9c5d3');
    word1(0, 0, gr);
    // 비행운: 왼쪽에서 흘러와 오른쪽 끝의 한 점(전투기)으로 모인다
    const jx = W - 46,
      jy = y0 + 10 * u + 16,
      lx = 40,
      base = jy + 30,
      ang = -0.2;
    const curve = (i, t) => {
      const y1 = base + (i - 1) * 11,
        ex = jx - 10,
        ey = jy + (i - 1) * 1.6,
        mx = lx + (ex - lx) * 0.62;
      const P = (a, b, c2, d, t2) => {
        const m = 1 - t2;
        return m * m * m * a + 3 * m * m * t2 * b + 3 * m * t2 * t2 * c2 + t2 * t2 * t2 * d;
      };
      return [P(lx, mx - 60, mx, ex, t), P(y1, y1, y1 - 2, ey, t)];
    };
    const end = Math.max(0, Math.min(1, k));
    cols.forEach((col, i) => {
      const N = 80;
      let prev = curve(i, 0);
      for (let n = 1; n <= N * end; n++) {
        const t = n / N,
          pt = curve(i, t);
        x.strokeStyle = col;
        x.globalAlpha = Math.min(1, 0.08 + t * 1.25);
        x.lineWidth = 1.6 + t * 2.4;
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(prev[0], prev[1]);
        x.lineTo(pt[0], pt[1]);
        x.stroke();
        prev = pt;
      }
    });
    x.globalAlpha = 1;
    // 전투기 실루엣 (비행운이 다 모인 뒤 나타난다)
    if (end >= 0.98) {
      const head = curve(1, 1);
      x.save();
      x.translate(head[0] + 12, head[1] - 2);
      x.rotate(ang);
      x.fillStyle = '#02050d';
      x.globalAlpha = 0.7;
      x.translate(1.5, 1.5);
      const jet = () => {
        x.beginPath();
        x.moveTo(16, 0);
        x.lineTo(5, -2);
        x.lineTo(-3, -10);
        x.lineTo(-6, -10);
        x.lineTo(-3, -2.2);
        x.lineTo(-9, -2);
        x.lineTo(-12, -6);
        x.lineTo(-13.5, -6);
        x.lineTo(-12, 0);
        x.lineTo(-13.5, 6);
        x.lineTo(-12, 6);
        x.lineTo(-9, 2);
        x.lineTo(-3, 2.2);
        x.lineTo(-6, 10);
        x.lineTo(-3, 10);
        x.lineTo(5, 2);
        x.closePath();
        x.fill();
      };
      jet();
      x.globalAlpha = 1;
      x.translate(-1.5, -1.5);
      x.fillStyle = '#f4f1e6';
      jet();
      x.restore();
    }
    // 부제
    const ty = H - 14;
    x.fillStyle = '#8aa0bd';
    x.font = '600 10px ui-monospace,Consolas,Menlo,monospace';
    x.textBaseline = 'middle';
    x.textAlign = 'left';
    const t = 'THREE LINES. ONE FLIGHT.',
      sp = 3.4,
      ws = [...t].map(ch => x.measureText(ch).width),
      tl = ws.reduce((a2, b2) => a2 + b2 + sp, 0) - sp;
    let tx = (W - tl) / 2;
    [...t].forEach((ch, i) => {
      x.fillText(ch, tx, ty);
      tx += ws[i] + sp;
    });
  }
  (function animateLogo() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      drawLogo(1);
      return;
    }
    const T0 = performance.now() + 650,
      D = 1300;
    drawLogo(0);
    const step = now => {
      const k = Math.max(0, (now - T0) / D),
        e = 1 - Math.pow(1 - Math.min(1, k), 3);
      drawLogo(e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  })();
  // 인트로 로딩 문구 (0.85초마다 다음 단계)
  const M = {
    ko: ['지휘 통신망 연결', '레이더·RWR 점검', '기체 데이터 로딩', '출격 준비 완료'],
    en: ['ESTABLISHING SECURE LINK', 'RADAR / RWR CHECK', 'LOADING AIRFRAME DATA', 'SORTIE READY'],
  };
  let mi = 0;
  setInterval(() => {
    if (!intro.classList.contains('active')) {
      mi = 0;
      return;
    }
    $id('mf-load-t').textContent = M[ko() ? 'ko' : 'en'][Math.min(3, mi++)];
  }, 850);
  // 표지 사진: 파일 안의 asset-cover-jpeg (문서를 다 읽은 뒤에 읽을 수 있다)
  const ph = $id('mf-cover').querySelector('.mf-cover-photo');
  document.addEventListener('DOMContentLoaded', () => {
    ph.src = 'data:image/jpeg;base64,' + readAsset('asset-cover-jpeg');
  });
})();
