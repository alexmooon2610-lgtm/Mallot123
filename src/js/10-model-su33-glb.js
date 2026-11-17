/* ===== Su-33 (Flanker-D) 함재기 GLB (실측 모델 · 3톤 블루 위장 텍스처 포함) =====
   모델 축: 기수 -Z, 위 +Y, 바퀴 접지면 Y=0, 원점 전장 중앙 (실기 크기, m).
   실기 21.18 m — 다른 기체·항모와 같은 ×3 배율이라 MiG-29(17.32 m)보다 그대로 1.22 배 길다.
   V14.7.0: 사용자 원본 su33_painted.glb(날개 편 상태)를 고치지 않고 그대로 넣었다 (텍스처 4096×2956 PNG).
     예전에 넣었던 것은 텍스처를 WEBP 로 크게 줄인(1.09 MB → 91 KB) 접은 날개판이었다.
   날개 접은 상태(su33_folded.glb)는 원본과 바이너리가 같고 바깥 날개 두 노드의 회전만 다르다 (기체 축 Z 로 ±115°).
     그래서 파일은 하나만 넣고, 접은 모양은 su33Folded() 가 그 회전값을 그대로 넣어 만든다 (원본 su33_folded.glb 의 값).
   쓰는 곳: 「자랴」 갑판 주기(접은 날개, 13-carrier-glb 의 su33Park). 날개 편 su33GLBTemplate 은 아직 쓰는 곳이 없다.
*/
const SU33_FOLD = {
  wing_outer_R: [0, 0, 0.8433914458128857, 0.5372996083468239],
  wing_outer_L: [0, 0, -0.8433914458128857, 0.5372996083468239],
};
// 날개 접은 Su-33 (형상 · 재질은 원본과 공유하는 복제본)
function su33Folded() {
  if (!su33GLBTemplate) return null;
  const m = su33GLBTemplate.clone();
  for (const [name, q] of Object.entries(SU33_FOLD)) m.getObjectByName(name)?.quaternion.fromArray(q);
  return m;
}
let su33GLBTemplate = null;
const SU33_SCALE = 3;
function loadSu33GLB() {
  try {
    const bytes = assetBytes('asset-su33-glb');
    const model = parseSimpleGLB(bytes.buffer, 1); // 갑판에 여러 대 — 텍스처는 이미 작게 넣었다
    const root = new T.Group();
    root.name = 'Su33_GLB_Template';
    root.add(model);
    su33GLBTemplate = root;
  } catch (err) {
    su33GLBTemplate = null;
    console.error('[STEEL TEMPEST] Su-33 GLB failed; deck stays without parked Flankers', err);
  }
}

// ---------- 플레이어 · 멀티 상대가 타는 Su-33 (날개 편 모양) — V15.0.0-alpha.3
// MiG-29(createMiG29FromUserGLB)와 같은 약속: root.userData.setGear / setAfterburner, 바퀴 바닥을 y −1.09 에 맞춘다.
// 형상 · 재질은 자기 것으로 복제한다 (플레이어 기체는 재출격 때 통째로 해제되는데, 템플릿은 갑판 주기기와 같이 쓰기 때문).
const SU33_GEAR = /^(nose_|main_)/;
function createSu33(opts = {}) {
  if (!su33GLBTemplate) return createMiG29(opts); // 못 읽었으면 MiG 모양으로라도
  const root = new T.Group();
  root.name = 'Player_Su33_GLB';
  const model = cloneGLBWithOwnedResources(su33GLBTemplate);
  model.position.y = MIG29_GLB_Y;
  root.add(model);
  const gear = [];
  model.traverse(n => {
    if (n.isMesh && SU33_GEAR.test(n.name)) gear.push(n);
  });
  const setGear = on => gear.forEach(g => (g.visible = !!on));
  setGear(opts.gearDown);
  // 애프터버너 불꽃: 모델 노즐 출구(x ±1.18, 중심 높이 1.89, z 9.44) 뒤. 모양은 MiG 와 같은 단순 원뿔(사용자가 고른 것) —
  // AL-31F 노즐이 커서 반지름 · 길이만 키웠다
  const flames = [];
  for (const x of [-1.18, 1.18]) {
    const flame = new T.Mesh(
      new T.ConeGeometry(0.34, 2.6, 16, 1, true),
      new T.MeshBasicMaterial({
        color: 0xffa34a,
        transparent: true,
        opacity: 0.76,
        blending: T.AdditiveBlending,
        depthWrite: false,
        side: T.DoubleSide,
      })
    );
    flame.rotation.x = Math.PI / 2;
    flame.position.set(x, 1.89 + MIG29_GLB_Y, 9.44 + 1.3);
    flame.visible = false;
    flame.name = 'Game_Afterburner_Effect';
    root.add(flame);
    flames.push(flame);
  }
  root.userData.setGear = setGear;
  root.userData.setAfterburner = on => flames.forEach(f => (f.visible = !!on));
  root.userData.parts = { gear, flames };
  if (opts.scale) root.scale.setScalar(opts.scale);
  return root;
}
