/* ===== R-27R (SARH) · R-73 (IR) 미사일 GLB (실측 모델 · 스텐실 텍스처 포함) =====
   모델 축: 기수 -Z, 위 +Y, 원점은 미사일 축 위 전장 중앙 (실기 크기, m). 러그가 +Y.
   게임의 미사일 진행 방향도 -Z 라 (32-missiles 의 setFromUnitVectors(0,0,-1 → dir)) 그대로 쓴다.
   기체와 같은 ×3 배율. R-27R 4.08 m → 12.2, R-73 2.92 m → 8.8 단위.
   MiG-29 가 쏘는 미사일(플레이어 · TR-2 상대기)에만 쓴다. F-16 의 AIM-7 · AIM-9 는 절차 모델 그대로.
   GLB 를 못 읽으면 00-core 의 절차 모델이 그대로 쓰인다.
*/
const MSL_GLB_SCALE = 3,
  mslGLBTemplate = { SARH: null, IR: null };
function loadMissileGLBs() {
  for (const [ty, id, name] of [
    ['SARH', 'asset-r27r-glb', 'R27R'],
    ['IR', 'asset-r73-glb', 'R73'],
  ]) {
    try {
      const bytes = assetBytes(id);
      const model = parseSimpleGLB(bytes.buffer, 0.5); // 4096×1024 띠 텍스처: 절반이면 충분
      const root = new T.Group();
      root.name = name + '_GLB_Template';
      root.add(model);
      root.scale.setScalar(MSL_GLB_SCALE);
      mslGLBTemplate[ty] = root;
    } catch (err) {
      mslGLBTemplate[ty] = null;
      console.error('[STEEL TEMPEST] ' + name + ' GLB failed; procedural missile remains active', err);
    }
  }
}
// Su-33 GLB 데이터는 파일 맨 아래 <script id="asset-su33-glb"> 블록에 있음 (readAsset 로 읽음)

