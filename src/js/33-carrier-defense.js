// ---------- 항모 방공: 자동 추적, 제한적 명중, 적 AI 회피 선택
let cvGunCd = 0,
  cvSamCd = 0,
  cvTracers = [];
function carrierDefenseUpdate(dt) {
  cvGunCd -= dt;
  cvSamCd -= dt;
  const threats = es
    .filter(e => e.hp > 0 && !e.drone && !e.mock)
    .map(e => ({ e, d: e.pos.distanceTo(CV.position) }))
    .sort((a, b) => a.d - b.d);
  for (const q of threats) {
    q.e.ai.cvThreat = q.d < 9200;
  }

  // 근접 함포: 짧은 추적 사격. 명중은 확률적이며 한 번에 큰 피해를 주지 않는다.
  const gunTarget = threats.find(q => q.d < 4800);
  if (gunTarget && cvGunCd <= 0) {
    cvGunCd = 0.48;
    // 예광탄은 표적 쪽 현측 포탑(코르티크 · AK-630)의 포구에서 나간다 (33-carrier-weapons). 판정은 그대로.
    const start = cvGunFire(gunTarget.e.pos) || CV.position.clone().add(V(0, 64, 0));
    const lineGeom = new T.BufferGeometry().setFromPoints([start, gunTarget.e.pos.clone()]);
    const line = new T.Line(lineGeom, new T.LineBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.85 }));
    scene.add(line);
    cvTracers.push({ line, age: 0, life: 0.14, target: gunTarget.e });
    if (rnd() < 0.2) hurt(gunTarget.e, 0.025);
  }

  // 방공 미사일: 중거리에서 발사하며 제한된 선회율을 가져 회피 기동으로 빗나갈 수 있다.
  const samTarget = threats.find(q => q.d > 2200 && q.d < 9200);
  if (samTarget && cvSamCd <= 0) {
    cvSamCd = 5.8;
    const mesh = new T.Mesh(new T.SphereGeometry(9, 8, 6), new T.MeshBasicMaterial({ color: 0xff8844 }));
    mesh.position.copy(CV.position).add(V(0, 66, 0));
    scene.add(mesh);
    const dir = samTarget.e.pos.clone().sub(mesh.position).normalize();
    cvTracers.push({ line: mesh, age: 0, life: 4.5, target: samTarget.e, sam: 1, dir, speed: 2700, turn: 1.7 });
    cvSamLaunch(cvTracers[cvTracers.length - 1]); // 킨잘 수직발사 모션 (겉모습만)
    // 적 AI가 회피를 선택할 기회를 부여한다. 선택하지 않으면 기존 공격 행동을 계속한다.
    samTarget.e.ai.cvMissileResponseChosen = rnd() < 0.62 ? 1 : 0;
    samTarget.e.ai.cvMissileResponseTimer = 3.2;
  }

  cvTracers = cvTracers.filter(q => {
    q.age += dt;
    if (q.sam) {
      if (!q.target || q.target.hp <= 0) {
        scene.remove(q.line);
        q.line.geometry?.dispose();
        q.line.material?.dispose();
        return false;
      }
      const prev = q.line.position.clone();
      const toTarget = q.target.pos.clone().sub(prev);
      const distance = toTarget.length();
      if (distance < 48) {
        if (rnd() < 0.48) hurt(q.target, 0.12);
        boom(q.line.position, 24);
        scene.remove(q.line);
        q.line.geometry.dispose();
        q.line.material.dispose();
        return false;
      }
      const desired = toTarget.normalize();
      const angle = Math.acos(clamp(q.dir.dot(desired), -1, 1));
      q.dir.lerp(desired, Math.min(1, (q.turn * dt) / Math.max(angle, 1e-4))).normalize();
      q.line.position.addScaledVector(q.dir, q.speed * dt);
      const closest = V();
      new T.Line3(prev, q.line.position).closestPointToPoint(q.target.pos, true, closest);
      if (closest.distanceTo(q.target.pos) < 48) {
        if (rnd() < 0.48) hurt(q.target, 0.12);
        boom(closest, 24);
        scene.remove(q.line);
        q.line.geometry.dispose();
        q.line.material.dispose();
        return false;
      }
    }
    if (q.age >= q.life) {
      scene.remove(q.line);
      if (q.line.geometry) q.line.geometry.dispose();
      q.line.material?.dispose();
      return false;
    }
    return true;
  });
}
// ---------- 항모 착함 유도: 활공각·중심선 오차 (HUD 표시용 — 판정과 무관)
// alpha.6: 실측 착함 구역(좌현 7.5° 꺾인 착함축, 와이어 4줄)과 광학 착함 장치(44-night-lights)에 맞췄다.
// 예전엔 배 중심선 · 함미에서 92 m(z 60) · 3° 였다 — 착함 구역 오른쪽 가장자리로 안내하고 있었다.
function carrierGuide() {
  const a = nlApproach(p.pos),
    fw = p.fwd(),
    ax = NL_D.clone().transformDirection(CV.matrixWorld);
  const fh = V(fw.x, 0, fw.z).normalize(),
    ah = V(ax.x, 0, ax.z).normalize();
  if (a.along < NL_TD || a.along > 1500 || Math.abs(a.lat) > 250 || fh.dot(ah) < 0.6) return null;
  return {
    x: a.lat * 3,
    gs: (a.h - a.along * Math.tan(NL_GS)) * 3,
    sink: Math.max(0, -p.vd.y * p.speed),
    d: a.along * 3,
  };
}
