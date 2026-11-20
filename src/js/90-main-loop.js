// ---------- 메인 루프
let last = performance.now();
// ---------- WebGL 컨텍스트 손실 (GPU 메모리 부족 · 그래픽 드라이버 재시작)
// three 가 기본 동작을 막아 두므로 브라우저가 컨텍스트를 돌려주면 자원을 다시 올려 이어서 그린다.
// 그동안은 일시정지하고 안내를 띄운다. 오래 돌아오지 않으면 새로고침을 권한다.
(() => {
  let box = null,
    timer = 0,
    paused = false;
  const show = html => {
    if (!box) {
      box = document.createElement('div');
      box.id = 'st-glost';
      document.body.appendChild(box);
    }
    box.innerHTML = html;
    box.style.display = 'flex';
  };
  R.domElement.addEventListener('webglcontextlost', () => {
    paused = S === 'play';
    if (paused) togglePause();
    show('<b>그래픽 메모리 부족 — 화면 복구 중…</b><span>WEBGL CONTEXT LOST · 잠시 기다리면 이어서 할 수 있다</span>');
    clearTimeout(timer);
    timer = setTimeout(
      () =>
        show(
          '<b>화면이 돌아오지 않는다</b><span>다른 탭 · 앱을 닫고 새로고침해라. 캠페인 진행은 저장돼 있다.</span><button onclick="location.reload()">새로고침</button>'
        ),
      8000
    );
  });
  R.domElement.addEventListener('webglcontextrestored', () => {
    clearTimeout(timer);
    if (box) box.style.display = 'none';
    resize();
    if (paused) msg('화면 복구 — P 를 눌러 계속', '#9cf');
  });
})();
// 최근 프레임 간격을 보고 3D 해상도를 올리고 내린다 (80-hud 의 setResStep).
// 느려지면 바로 한 단 내리고, 한동안 여유로우면 천천히 한 단 올린다.
const FRAME_N = 30;
const frameMs = [];
let framePtr = 0,
  resCool = 0;
function autoRes(ms) {
  if (S !== 'play' || !(ms > 0) || ms > 2000) return; // 탭을 다시 열었을 때의 큰 간격은 무시
  frameMs[framePtr++ % FRAME_N] = ms;
  if ((resCool -= ms) > 0 || frameMs.length < FRAME_N) return; // 쿨다운은 실제 시간으로 센다
  const med = frameMs.slice().sort((a, b) => a - b)[FRAME_N >> 1];
  if (med > 26 && setResStep(resStep + 1))
    resCool = 1500; // 38 fps 아래로 떨어지면 낮춘다
  else if (med < 15 && setResStep(resStep - 1)) resCool = 4000; // 66 fps 위로 여유로우면 올린다
}
function loop(n) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0, (n - last) / 1000));
  autoRes(n - last);
  last = n;
  if (S !== 'play') gunSnd(false); // 일시정지 · 결과 화면에서 연사음이 남지 않게
  if (S == 'play' && dt > 0) {
    t += dt;
    if (p && p.fuel > 0) {
      const burn = (0.01 + 0.1 * p.thr + 0.14 * (p.ab ? 1 : 0)) * dt * ACFT[playerAc].burn; // 기체별 체공 (00-core ACFT)
      p.fuel = Math.max(0, p.fuel - burn);
    }
    if (p && p.fuel <= 20 && p.fuelWarn < 1) {
      p.fuelWarn = 1;
      msg('연료 20% 이하 — 귀환을 권장합니다', '#ffcf66');
    }
    if (p && p.fuel <= 0) {
      p.thr = Math.min(p.thr, 0.35);
      p.ab = 0;
      if (p.fuelWarn < 2) {
        p.fuelWarn = 2;
        msg('연료 소진 — 엔진 출력 제한', '#f66');
      }
    }
    if (!isAirbase()) {
      cvUpdate(dt);
      cvWeaponsUpdate(dt);
      deckParkingUpdate(cam.position);
    }
    if (opsUpdate(dt)) {
      updP(dt);
      if (isAirbase()) {
        airbaseAfterPhysics();
        terrainCollisionUpdate();
        groundThreatUpdate(dt);
      } else carrierDefenseUpdate(dt);
      es.slice().forEach(x => aiUpdate(dt, x));
      collide();
      radarUpdate(dt);
      seekerUpdate(dt);
      ms.forEach(m => {
        updMsl(m, dt);
        trailPush(trailFor(m), m.pos);
      });
      updBul(dt);
      rwrUpdate(dt);
    }
    curM().update(dt);
    for (const f of fl) {
      f.age += dt;
      f.pos.addScaledVector(f.vel, dt);
      f.vel.y -= 4 * dt;
      f.s.position.copy(f.pos);
      f.s.material.opacity = f.op = clamp(1 - f.age / f.life, 0, 1);
      if (f.viz) flareViz(f, dt);
    }
    fl = fl.filter(f => {
      if (f.age > f.life) {
        freeSprite(f.s);
        flareFree(f);
        return false;
      }
      return true;
    });
    ms = ms.filter(m => {
      if (m.dead) {
        scene.remove(m.mesh);
        return false;
      }
      return true;
    });
    // 다음 웨이브 시계는 비행 중에만 흐른다 (착함 · 보급 · 갑판 대기 중에는 멈춤, V14.8.0)
    pilotRecord(dt); // 조종사 습관 기록 (읽기만, 37-adaptive-ai)
    if (EVO.on) evoWaveTimer(); // 진화: 착함 매복 (37-adaptive-ai)
    if (!isAirbase() && !es.length && wt > 0 && ops.st === 'fly' && (wt -= dt) <= 0) spawnWave();
  }
  // 연출 입자. 선택 항목: delay(늦게 켜짐) · vel/grav(움직임) · c0→c1(색이 식음) · fade(사라지는 곡선 지수) · tr(연기 꼬리)
  for (const f of fx) {
    f.t += dt;
    if (f.t < 0) {
      f.s.material.opacity = 0;
      continue;
    }
    const k = clamp(f.t / f.life, 0, 1);
    f.s.material.opacity = f.op = Math.pow(1 - k, f.fade || 1) * (f.opMax || 0.9);
    f.s.scale.setScalar(f.size * (1 + f.grow * k));
    if (f.vel) {
      f.s.position.addScaledVector(f.vel, dt);
      if (f.grav) f.vel.y -= f.grav * dt;
      if (f.drag) f.vel.multiplyScalar(Math.max(0, 1 - f.drag * dt));
      if (f.tr) trailPush(f.tr, f.s.position, 2);
    }
    if (f.c0) f.s.material.color.copy(f.c0).lerp(f.c1, Math.pow(k, f.cPow || 1));
  }
  fx = fx.filter(f => {
    if (f.t > f.life) {
      freeSprite(f.s);
      if (f.tr) f.tr.done = () => true; // 연기 꼬리는 스스로 옅어져 사라진다
      return false;
    }
    return true;
  });
  if (p) {
    if (p.mesh) {
      p.mesh.position.copy(p.pos);
      p.mesh.quaternion.copy(p.q);
      p.mesh.visible = cameraMode === 'external' && (S === 'play' || S === 'pause');
      p.mesh.userData.setAfterburner?.(!!p.ab);
      p.mesh.userData.setGear?.(!!p.gearDown);
    }
    if (cameraMode === 'cockpit') {
      cam.fov = 78; // 전체 화면 HUD: 콕핏 시야를 넓힌다
      cam.position.copy(p.pos);
      cam.quaternion.copy(p.q);
      if (p.stl || p.ovs) cam.position.add(V(vrnd() - 0.5, vrnd() - 0.5, 0).multiplyScalar(0.4)); // 연출 난수 (시점 전환이 판정을 바꾸면 안 된다)
    } else {
      const f = p.fwd(),
        aircraftUp = V(0, 1, 0).applyQuaternion(p.q);
      // 외부 시점: 기체가 잘 보이도록 바짝 붙여 따라간다 (부드러운 추종 유지).
      const wantedPos = p.pos.clone().addScaledVector(f, -60).addScaledVector(aircraftUp, 14);
      const wantedTarget = p.pos
        .clone()
        .addScaledVector(f, 15)
        .add(V(0, 2, 0));
      if (!chaseCamera.initialized) {
        chaseCamera.position.copy(wantedPos);
        chaseCamera.target.copy(wantedTarget);
        chaseCamera.initialized = true;
      }
      const follow = 1 - Math.exp(-dt * 5.2);
      chaseCamera.position.lerp(wantedPos, follow);
      chaseCamera.target.lerp(wantedTarget, follow);
      chaseCamera.up.copy(V(0, 1, 0).lerp(aircraftUp, 0.22).normalize());
      cam.fov = 72;
      cam.position.copy(chaseCamera.position);
      cam.up.copy(chaseCamera.up);
      cam.lookAt(chaseCamera.target);
    }
    cam.updateProjectionMatrix();
    sea.position.set(Math.floor(p.pos.x / 1000) * 1000, 0, Math.floor(p.pos.z / 1000) * 1000);
    cloudLayer.update(p.pos, dt);
    // 짙은 구름 속에서는 바다가 구름판에 완전히 가려진다 — 그릴 필요가 없다
    if (!isAirbase()) sea.visible = !cloudLayer.opaqueAround(cam.position);
    for (const c of clouds) {
      const d = c.position.clone().sub(p.pos);
      if (Math.abs(d.x) > 40000) c.position.x -= Math.sign(d.x) * 80000;
      if (Math.abs(d.z) > 40000) c.position.z -= Math.sign(d.z) * 80000;
    }
  }
  if (TCINE.on) titleCineUpdate(dt); // 표지 시네마틱: 위에서 정한 카메라를 덮어쓴다 (89-title-cine)
  weatherUpdate(dt, S === 'play', TCINE.on); // 빗줄기 · 번개 · 빗소리 (02-weather, 보이는 것만 — 표지에서도)
  nightLightsUpdate(dt); // 밤: 갑판 조명 · 광학 착함 장치 · 전투기 항법등 (44-night-lights)
  // MiG-29K 테일훅 (보이는 것만): 항모 모드에서 비행 중 기어를 내리면 내린다
  if (p && p.mesh && p.mesh.userData.setHook)
    p.mesh.userData.setHook(!!p.gearDown && typeof ops !== 'undefined' && ops.st === 'fly' && !isAirbase());
  ckUpdate(dt);
  trailsUpdate();
  // 월드 렌더링과 콕핏 렌더링을 분리해 배경/항모 모델의 깊이 테스트를 독립시킨다.
  cam.updateMatrixWorld(true);
  // 후방 거울은 실제 비행 중에만 15Hz로 갱신한다.
  updateRearMirror(n);
  // 비행 화면 효과(카메라 흔들림·FOV·G 시야)는 월드 렌더 직전에 적용한다
  if (S === 'play') flightFx();
  sunShadowUpdate(dt, TCINE.on && TCINE.jet ? TCINE.jet.position : p ? p.pos : cam.position);
  fxNearFade();
  R.clear();
  R.shadowMap.needsUpdate = shadowLive; // 그림자 지도는 여기서만 갱신 (01-environment). 꺼져 있으면 다시 그리지 않는다
  R.render(scene, cam);
  if (cameraMode === 'cockpit' && !TCINE.on) {
    R.clearDepth();
    R.render(cockpitScene, ckCam);
  }
  if (p && !TCINE.on) {
    if (cameraMode === 'cockpit') drawHud();
    else drawExternalHud();
    drawGroundThreatHud();
  }
  renderGuardTick(dt); // 렌더 점검 · 자동 복구 (04-render-guard)
}
