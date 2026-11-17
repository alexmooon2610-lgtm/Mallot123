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
    const binary = atob(readAsset('asset-su33-glb')),
      bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
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
