// ---------- 후방 거울 렌더링
function updateRearMirror(now) {
  if (!p || S !== 'play' || cameraMode !== 'cockpit' || now - mirrorLast < mirrorInterval) return;
  mirrorLast = now;

  mirrorCam.position.copy(cam.position).add(V(0, 0.82, 0).applyQuaternion(p.q));
  mirrorCam.quaternion.copy(cam.quaternion).multiply(mirrorYaw);
  mirrorCam.updateMatrixWorld(true);

  // 오프스크린 렌더링 후 메인 화면의 출력 상태를 원래대로 복구한다.
  const previousTarget = R.getRenderTarget();
  const previousViewport = R.getViewport(new T.Vector4());
  const previousScissor = R.getScissor(new T.Vector4());
  const previousScissorTest = R.getScissorTest();

  try {
    R.setRenderTarget(mirrorRT);
    R.setScissorTest(false);
    R.clear(true, true, true);
    R.render(scene, mirrorCam);
  } finally {
    R.setRenderTarget(previousTarget);
    R.setViewport(previousViewport);
    R.setScissor(previousScissor);
    R.setScissorTest(previousScissorTest);
  }
}
