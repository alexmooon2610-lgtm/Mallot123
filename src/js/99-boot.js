resize();
init();
const nikeInstalled = applyNikeHerculesVisuals();
if (nikeInstalled === GROUND_THREATS.length) msg('NIKE HERCULES 3D 배치 완료 — ECHO-1 / ECHO-2 / ECHO-3', '#9ee6bb');
showOv();
document.addEventListener('DOMContentLoaded', () => {
  loadUserMiG29GLB();
  loadF16GLB(); // 적기 F-16C 실측 모델
  loadLa17GLB(); // TR-1 표적 드론 La-17M 실측 모델
  loadMissileGLBs(); // R-27R · R-73 실측 모델
  loadSu33GLB(); // 갑판 주기 Su-33
  applyCarrierGLB(); // 항모 실측 모델 (MiG 모델을 주기 기체로 쓰므로 뒤에)
  cvBuildWeapons(); // 현측 포좌 · 수직발사기 (실측 모델 위에 얹는다)
});
requestAnimationFrame(loop);
