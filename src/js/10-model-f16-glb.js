/* ===== F-16C GLB (실측 모델 · USAF 3톤 그레이 도색 텍스처 포함) =====
   모델 축: 기수 -Z, 위 +Y, 바퀴 바닥 y=0, 원점은 전장 중앙 (실기 크기, m). 게임 축과 방향이 같다.
   예전 절차 모델 자리에 맞춰 동체 중심선(y≈1.89)을 원점 높이로, 기체 중심을 z -2.5 로 옮긴다.
   그러면 기존 F-16 히트박스(동체 ±8 m · 날개 ±5 m, f16Mesh 의 ×3 배율 기준)와 그대로 겹친다.
   공중의 적기이므로 착륙장치는 숨긴다. 날개 끝 미사일 · 파일런은 그대로 보인다.
   GLB 를 못 읽으면 예전 절차 모델(createF16)이 그대로 쓰인다.
*/
let f16GLBTemplate = null;
const F16_GLB_Y = -1.89,
  F16_GLB_Z = -2.5;
function loadF16GLB() {
  try {
    const bytes = assetBytes('asset-f16-glb');
    const root = parseSimpleGLB(bytes.buffer);
    root.name = 'F16_GLB_Template';
    root.traverse(n => {
      if (n.name === 'landing_gear') n.visible = false;
      if (n.isMesh) n.castShadow = true;
    });
    root.position.set(0, F16_GLB_Y, F16_GLB_Z);
    f16GLBTemplate = root;
  } catch (err) {
    f16GLBTemplate = null;
    console.error('[STEEL TEMPEST] F-16 GLB failed; procedural F-16 remains active', err);
  }
}
// La-17M GLB 데이터는 파일 맨 아래 <script id="asset-la17-glb"> 블록에 있음 (readAsset 로 읽음)

