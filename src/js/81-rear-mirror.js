// ---------- 후방 거울 렌더링
let parkVis = null,
  cvwVis = null;
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
    // 손바닥만 한 거울에 갑판 주기기(삼각형 20만 개)까지 그릴 필요는 없다. 거울에서만 잠깐 끈다.
    // 함포 · 발사기(메시 150개)도 거울에서는 점 하나라 같이 끈다 (거울 그리기 호출 218 → 약 70, V15.0.0-alpha.3)
    parkVis = CV_PARKING ? CV_PARKING.visible : null;
    if (CV_PARKING) CV_PARKING.visible = false;
    cvwVis = CVW.root ? CVW.root.visible : null;
    if (CVW.root) CVW.root.visible = false;
    R.render(scene, mirrorCam);
  } finally {
    if (CV_PARKING && parkVis !== null) CV_PARKING.visible = parkVis;
    if (CVW.root && cvwVis !== null) CVW.root.visible = cvwVis;
    R.setRenderTarget(previousTarget);
    R.setViewport(previousViewport);
    R.setScissor(previousScissor);
    R.setScissorTest(previousScissorTest);
  }
}
