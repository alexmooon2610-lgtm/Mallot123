/* ===== La-17M 표적 드론 GLB (실측 모델 · 녹색 윗면 / 회색 아랫면 도색 텍스처 포함) =====
   모델 축: 기수 -Z, 위 +Y, 엔진 나셀 바닥 y=0, 전장 중앙이 원점 (실기 크기, m).
   게임에서는 다른 기체처럼 ×3 배율로 쓰고, 동체 중심선(y 1.285)을 원점 높이로 내린다.
   지상 발사용 고체 부스터 2개는 이륙 직후 떨어지므로 숨긴다.
   기수의 풍차 프로펠러(발전기 구동)는 축 하나에 모아 비행 중 돌린다 (20-mission-tr1 의 droneUpdate).
   GLB 를 못 읽으면 TR-1 의 절차 드론 모델이 그대로 쓰인다.
*/
let la17GLBTemplate = null;
const LA17_SCALE = 3,
  LA17_AXIS_Y = 1.285,
  LA17_PROP = V(0, 1.285, -3.83);
function loadLa17GLB() {
  try {
    const bytes = assetBytes('asset-la17-glb');
    const model = parseSimpleGLB(bytes.buffer, 0.5); // 작은 드론: 텍스처 절반
    const prop = new T.Group(),
      blades = [];
    prop.name = 'prop_pivot';
    prop.position.copy(LA17_PROP);
    model.traverse(n => {
      if (n.name === 'boosters') n.visible = false;
      if (n.isMesh && /^prop_/.test(n.name)) blades.push(n);
    });
    for (const b of blades) {
      b.parent.remove(b);
      b.geometry.translate(-LA17_PROP.x, -LA17_PROP.y, -LA17_PROP.z);
      prop.add(b);
    }
    model.add(prop);
    model.position.y = -LA17_AXIS_Y;
    const root = new T.Group();
    root.name = 'La17_GLB_Template';
    root.add(model);
    root.scale.setScalar(LA17_SCALE);
    la17GLBTemplate = root;
  } catch (err) {
    la17GLBTemplate = null;
    console.error('[STEEL TEMPEST] La-17M GLB failed; procedural drone remains active', err);
  }
}
// R-27R · R-73 GLB 데이터는 파일 맨 아래 <script id="asset-r27r-glb"> · <script id="asset-r73-glb"> 블록에 있음 (readAsset 로 읽음)

