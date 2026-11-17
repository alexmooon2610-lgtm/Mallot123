/* ===== Su-33 (Flanker-D) 함재기 GLB — 날개 접은 상태 (실측 모델 · 3톤 블루 위장 텍스처 포함) =====
   모델 축: 기수 -Z, 위 +Y, 바퀴 접지면 Y=0, 원점 전장 중앙 (실기 크기, m).
   실기 21.18 m — 다른 기체·항모와 같은 ×3 배율이라 MiG-29(17.32 m)보다 그대로 1.22 배 길다.
   지금은 「자랴」 갑판 주기용으로만 쓴다 (13-carrier-glb 의 su33Park).
   접힌 바깥 날개(wing_outer_R · _L)는 모델에 이미 접힌 채로 들어 있다.
*/
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
