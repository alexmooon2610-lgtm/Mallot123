resize();
init();
const nikeInstalled = applyNikeHerculesVisuals();
if (nikeInstalled === GROUND_THREATS.length) msg('NIKE HERCULES 3D 배치 완료 — ECHO-1 / ECHO-2 / ECHO-3', '#9ee6bb');
showOv();
// 모델 읽기 (V15.0.0-alpha.3): 단계 사이마다 브라우저에 한 번 쉬게 해서(setTimeout 0) 인트로 로고 애니메이션과
// 진행 막대가 그려지게 한다. 예전엔 한 번에 몰아 읽어 그동안 화면이 멈췄다. 순서 · 내용은 그대로다.
// 다 읽으면 window.__stBoot = 'done' — 인트로가 표지로 넘어가는 조건이고, 검사 하네스도 이걸 기다린다.
document.addEventListener('DOMContentLoaded', async () => {
  const ko = !document.getElementById('mf-lang-en')?.classList.contains('selected'),
    rest = () => new Promise(r => setTimeout(r, 0)),
    steps = [
      [ko ? '기체 모델 · MiG-29' : 'AIRFRAME · MiG-29', loadUserMiG29GLB],
      [ko ? '적기 모델 · F-16C' : 'HOSTILE · F-16C', loadF16GLB], // 적기 F-16C 실측 모델
      [ko ? '표적기 · La-17M' : 'TARGET DRONE · La-17M', loadLa17GLB], // TR-1 표적 드론
      [ko ? '미사일 · R-27R · R-73' : 'MISSILES · R-27R · R-73', loadMissileGLBs],
      [ko ? '함재기 · Su-33' : 'CARRIER FIGHTER · Su-33', loadSu33GLB],
      [ko ? '항공모함 자랴' : 'CARRIER ZARYA', applyCarrierGLB], // MiG 모델을 주기 기체로 쓰므로 뒤에
      [ko ? '함 방공 무장' : 'SHIP DEFENCES', cvBuildWeapons], // 실측 모델 위에 얹는다
    ];
  for (let i = 0; i < steps.length; i++) {
    window.stBootProgress?.(steps[i][0], 0.1 + (0.75 * i) / steps.length);
    await rest();
    try {
      steps[i][1]();
    } catch (e) {
      console.error('[STEEL TEMPEST] boot step failed', steps[i][0], e);
    }
  }
  window.stBootProgress?.(ko ? '텍스처 준비' : 'PREPARING TEXTURES', 0.88);
  window.__stBoot = 'done';
});
requestAnimationFrame(loop);
