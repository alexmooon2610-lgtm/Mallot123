// ---------- HUD / 계기
// 적응 해상도: 프레임이 느려지면 3D 를 더 낮은 해상도로 그린다 (HUD 글씨는 그대로 선명하게).
// 구름 속처럼 화면을 가득 채우는 장면에서 폰이 버티게 해 주는 장치다. 게임 판정에는 영향이 없다.
const RES_STEPS = [1, 0.85, 0.7, 0.55];
let resStep = 0;
function renderScale() {
  return Math.min(devicePixelRatio || 1, 2) * RES_STEPS[resStep];
}
function setResStep(i) {
  i = clamp(i, 0, RES_STEPS.length - 1);
  if (i === resStep) return false;
  resStep = i;
  resize();
  return true;
}
function resize() {
  W = innerWidth;
  H = innerHeight;
  const d = renderScale();
  R.setPixelRatio(d);
  R.setSize(W, H);
  const hd = Math.min(devicePixelRatio || 1, 2);
  if (hud.width !== W * hd || hud.height !== H * hd) {
    // 크기를 다시 넣으면 그때마다 버퍼를 새로 잡으므로 실제로 바뀔 때만
    hud.width = W * hd;
    hud.height = H * hd;
    hud.style.width = W + 'px';
    hud.style.height = H + 'px';
  }
  g.setTransform(hd, 0, 0, hd, 0, 0);
  PH = 0; // 아래 계기 패널 없음: 3D 를 전체 화면으로 (98-ace-hud)
  VH = Math.max(1, H - PH);
  cam.aspect = W / VH;
  cam.updateProjectionMatrix();
  R.setScissorTest(true);
  R.setViewport(0, PH, W, VH);
  R.setScissor(0, PH, W, VH);
}
addEventListener('resize', resize);
const tx = (s, x, y, c = G, al = 'left', sz = 12) => {
  g.fillStyle = c;
  g.textAlign = al;
  g.font = '600 ' + (sz + 1) + 'px "Segoe UI","Roboto Condensed","Helvetica Neue",Arial,sans-serif';
  g.fillText(s, x, y);
};
function proj(v) {
  const q = v.clone().project(cam);
  return q.z > 1 ? null : { x: ((q.x + 1) / 2) * W, y: ((1 - q.y) / 2) * VH };
}
