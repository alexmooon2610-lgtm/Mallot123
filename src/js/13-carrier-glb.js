// ===== 항모 실측 모델 (쿠즈네초프 v2, 도면 실측 GLB) =====
// 축: X 우현 · Y 위(수선 0) · -Z 함수, 원점 전장 중앙, 단위 m — 게임 항모(CV) 의 로컬 좌표와 같다 (CV.scale 3).
// 비행갑판 높이 16.56 m · 스키점프는 함미에서 258 m(로컬 z −105.75)부터 상승. 갑판 판정(DECK_Y · rampY · deckEdges)도 이 모델을 따른다.
// 옛 절차 모델(createKuznetsov)은 물보라·항적(cv_wake / cv_spray)과 update/setSpeed 를 위해 남기고 모양만 숨긴다.
const CV_DECK_Y = 16.56;
// 스키점프 실측 단면: [함미에서 거리 m, 수선 위 갑판 높이 m] (도면값, 선 중심 보정 −1.04 는 아래에서 뺀다)
const CV_SKI = [
  [258, 17.6],
  [262, 17.8],
  [266, 18.05],
  [270, 18.3],
  [274, 18.55],
  [278, 18.9],
  [282, 19.4],
  [286, 19.93],
  [290, 20.45],
  [294, 20.97],
  [298, 21.6],
  [301, 22.05],
  [304.5, 22.3],
];
// 로컬 z 에서 갑판 위로 솟은 높이 (z = 152.25 − 함미 거리)
function cvRampY(z) {
  const x = 152.25 - z;
  if (x <= CV_SKI[0][0]) return 0;
  for (let i = 1; i < CV_SKI.length; i++)
    if (x <= CV_SKI[i][0]) {
      const a = CV_SKI[i - 1],
        b = CV_SKI[i];
      return a[1] - 17.6 + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
  return CV_SKI[CV_SKI.length - 1][1] - 17.6;
}
// 경사(라디안): 앞뒤 4 m 평균 기울기
const cvRampPitch = z => (z < -105.75 ? Math.atan((cvRampY(z - 2) - cvRampY(z + 2)) / 4) : 0);

// ---------- 정적 메시 합치기 (그리기 호출 줄이기)
// root 아래 메시를 root 좌표로 구워 재질마다 형상 하나로 합친다. 반환: [{ material, geometry }]
// skip(o) 이 참인 객체(와 그 아래)는 건너뛴다. 속성 구성이 다른 메시가 섞인 재질은 합치지 않고 그대로 둔다(keep).
function mergeByMaterial(root, skip) {
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert(),
    groups = new Map(),
    keep = [];
  const walk = o => {
    if (skip && skip(o)) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && o.geometry.attributes.position) {
      if (!groups.has(o.material)) groups.set(o.material, []);
      groups.get(o.material).push(o);
    }
    o.children.forEach(walk);
  };
  walk(root);
  const out = [],
    m = new T.Matrix4();
  for (const [material, list] of groups) {
    const names = Object.keys(list[0].geometry.attributes).sort(),
      sig = g => Object.keys(g.attributes).sort().map(n => n + g.attributes[n].itemSize).join();
    if (list.some(o => sig(o.geometry) !== sig(list[0].geometry))) {
      keep.push(...list);
      continue;
    }
    let nv = 0,
      ni = 0;
    for (const o of list) {
      nv += o.geometry.attributes.position.count;
      ni += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
    }
    const geo = new T.BufferGeometry(),
      arrs = {};
    for (const n of names) arrs[n] = new Float32Array(nv * list[0].geometry.attributes[n].itemSize);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0,
      io = 0;
    for (const o of list) {
      m.multiplyMatrices(inv, o.matrixWorld);
      const g = o.geometry.clone().applyMatrix4(m),
        cnt = g.attributes.position.count;
      for (const n of names) {
        const a = g.attributes[n],
          s = a.itemSize,
          dst = arrs[n];
        for (let i = 0; i < cnt; i++) {
          dst[(vo + i) * s] = a.getX(i);
          if (s > 1) dst[(vo + i) * s + 1] = a.getY(i);
          if (s > 2) dst[(vo + i) * s + 2] = a.getZ(i);
          if (s > 3) dst[(vo + i) * s + 3] = a.getW(i);
        }
      }
      // 거울상(음수 배율)으로 놓인 메시는 구우면 면 방향이 뒤집히므로 삼각형 순서를 바꿔 준다
      const flip = m.determinant() < 0,
        src = g.index ? g.index.array : null,
        n3 = g.index ? g.index.count : cnt;
      for (let i = 0; i < n3; i += 3) {
        const a = src ? src[i] : i,
          b = src ? src[i + 1] : i + 1,
          c = src ? src[i + 2] : i + 2;
        idx[io++] = vo + a;
        idx[io++] = vo + (flip ? c : b);
        idx[io++] = vo + (flip ? b : c);
      }
      g.dispose();
      vo += cnt;
    }
    for (const n of names) {
      const a0 = list[0].geometry.attributes[n];
      geo.setAttribute(n, new T.BufferAttribute(arrs[n], a0.itemSize, a0.normalized));
    }
    geo.setIndex(new T.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    out.push({ material, geometry: geo, from: list });
  }
  return out;
}

// 움직이지 않는 메시를 재질별로 합쳐 root 아래 메시 하나씩으로 바꾼다 (그리기 호출 절감 · V15.0.0-alpha.3).
// keep(o) 가 참인 것과 그 아래, 안 보이는 것, 투명 재질, renderOrder 가 있는 것은 그대로 둔다 (정렬 · 토글 · 애니메이션 보존).
// 같은 재질이 한 개뿐이면 합칠 이득이 없어 원래 메시를 둔다. 반환: 줄어든 메시 수.
function mergeStaticInPlace(root, keep) {
  const skip = o => (keep && keep(o)) || !o.visible || (o.isMesh && (o.renderOrder || o.material?.transparent)),
    before = [];
  root.traverse(o => o.isMesh && before.push(o));
  let saved = 0;
  for (const part of mergeByMaterial(root, skip)) {
    if (part.from.length < 2) {
      part.geometry.dispose();
      continue;
    }
    const mesh = new T.Mesh(part.geometry, part.material);
    mesh.name = 'merged_' + (part.material.name || 'mat');
    mesh.castShadow = part.from.some(o => o.castShadow);
    mesh.receiveShadow = part.from.some(o => o.receiveShadow);
    part.from.forEach(o => o.parent.remove(o)); // 형상은 다른 메시와 같이 쓸 수 있어 해제하지 않는다
    root.add(mesh);
    saved += part.from.length - 1;
  }
  return saved;
}
// 복제하면서 메시마다 따로 생긴 똑같은 재질을 하나로 모은다 (합치기 전에 — 재질이 다르면 못 합친다)
function dedupeMaterials(root) {
  const canon = new Map(),
    key = m =>
      [m.type, m.name, m.map?.uuid, m.color?.getHex(), m.emissive?.getHex(), m.roughness, m.metalness, m.opacity, m.transparent, m.side, m.normalMap?.uuid, m.roughnessMap?.uuid, m.metalnessMap?.uuid, m.emissiveMap?.uuid, m.alphaTest].join('|');
  root.traverse(n => {
    if (!n.isMesh || Array.isArray(n.material)) return;
    const k = key(n.material);
    if (canon.has(k)) n.material = canon.get(k);
    else canon.set(k, n.material);
  });
}
let carrierGLB = null;
function applyCarrierGLB() {
  try {
    const bytes = assetBytes('asset-carrier-glb');
    const model = parseSimpleGLB(bytes.buffer, 2, true); // 갑판이 가까이 보이므로 텍스처 두 배 · 먼저 펼친다
    model.name = 'Kuznetsov_GLB';
    // 옛 모델은 물보라 · 항적만 남긴다
    CV.children.forEach(c => {
      if (!/^cv_(wake|spray)$/.test(c.name)) c.visible = false;
    });
    // 게임 조명(태양 1.15 + 하늘빛)이 모델 뷰어보다 밝아 텍스처가 바래 보이므로 조금 어둡게 곱한다
    model.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const k = { deck: 0.66, hull: 0.8 }[o.material.name];
      if (k && o.material.userData.baseColor) o.material.userData.baseColor.setScalar(k);
    });
    CV.add(model);
    carrierGLB = model;
    // 갑판 가장자리: 비행갑판 메시 꼭짓점에서 z 별 좌현/우현 끝을 뽑는다
    let deck = null;
    model.traverse(o => {
      if (o.isMesh && o.name === 'flight_deck') deck = o;
    });
    if (deck) {
      const pa = deck.geometry.attributes.position.array,
        rows = new Map();
      for (let i = 0; i < pa.length; i += 3) {
        const k = Math.round(pa[i + 2] * 10) / 10,
          r = rows.get(k) || [Infinity, -Infinity];
        r[0] = Math.min(r[0], pa[i]);
        r[1] = Math.max(r[1], pa[i]);
        rows.set(k, r);
      }
      const T2 = [...rows.entries()].sort((a, b) => a[0] - b[0]);
      CV.userData.deckEdges = z => {
        if (z <= T2[0][0]) return T2[0][1].slice();
        for (let i = 1; i < T2.length; i++)
          if (z <= T2[i][0]) {
            const [za, a] = T2[i - 1],
              [zb, b] = T2[i],
              k = (z - za) / (zb - za);
            return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
          }
        return T2[T2.length - 1][1].slice();
      };
    }
    // 우현 후방 주기장의 MiG-29 2대 (실측 모델의 주기 위치 · 기수 방향)
    if (mig29GLBTemplate)
      // 가장자리에서 안쪽으로: 우현 갑판 끝은 z 96 에서 +27.3, z 116 에서 +25.9 다 (deckEdges).
      for (const [bx, by, hd] of [
        [36.0, 16.5, 135],
        [56.0, 18.0, 135],
      ]) {
        const m = createMiG29FromUserGLB({ gearDown: true, folded: true }); // 9.41: 바깥 날개를 접어 세운다
        m.position.set(by, CV_DECK_Y - MIG29_GLB_Y, -(bx - 152.25));
        m.rotation.y = (hd * Math.PI) / 180;
        m.name = 'Parked_MiG29';
        paintMiG29(m);
        // 주기 기체는 움직이지 않는다 → 재질별로 합친다 (50 메시 → 재질 수). 도색은 재질에 걸리므로 나중에 와도 그대로 먹는다
        m.updateMatrixWorld(true);
        dedupeMaterials(m);
        mergeStaticInPlace(m);
        mig29Extras.push(m);
        deckParking(model).add(m);
      }
    su33Park(model);
    // 선체 메시 51개 → 재질 수(8개)로. 주기장은 따로(인스턴스) 처리했으니 건너뛴다.
    // 월드 렌더 · 그림자 패스 둘 다 그리기 호출이 줄어든다. 판정(deckEdges · rampY)은 위에서 이미 뽑았다.
    for (const part of mergeByMaterial(model, o => o === CV_PARKING)) {
      part.from.forEach(o => {
        o.parent.remove(o);
        o.geometry.dispose();
      });
      const mesh = new T.Mesh(part.geometry, part.material);
      mesh.name = 'cv_hull_' + (part.material.name || 'mat');
      model.add(mesh);
    }
  } catch (e) {
    console.warn('[STEEL TEMPEST] carrier GLB failed; procedural carrier stays', e);
    CV.children.forEach(c => (c.visible = true));
  }
}

// 우현 주기장의 Su-33 (날개 접음 — su33Folded). 항모 로컬 좌표 [x(우현 +), z(함미 +), 기수 방위°] — 단위 m.
// 갑판 우현 가장자리는 z 20~100 에서 x +28~31, z 110 뒤로는 +26 까지 좁아진다 (CV.userData.deckEdges).
// MiG-29 주기 2 대가 z 97 · 112 를 쓰므로 그 앞뒤로 비켜 세운다.
// 버그 수정(alpha.3): 예전 네 자리 중 z 4 · 28 · 52 는 함교(우현 x 15~30 · z −6~54, 위에서 광선으로 잰 값) 안에 묻혀
// 기수만 보였다. 갑판에 그려진 주기 칸(노랑·검정 점선)은 함교 앞(z −30~−10)과 뒤(z 67~87) 두 개뿐이라 한 칸에 한 대씩 둔다.
// 함교에 묻혀 안 보이던 두 대는 뺐다 (보이지 않으면서 삼각형 약 9만 개를 그리고 있었다).
const SU33_PARK = [
  [21.5, -20.0, 135], // 함교 앞 주기 칸
  [18.0, 76.0, 135], // 함교 뒤 주기 칸
];
// 주기기 전부를 한 그룹에 모은다. 장식일 뿐인데 삼각형이 20 만 개라, 멀면 통째로 끈다 (cvUpdate).
let CV_PARKING = null;
function deckParking(model) {
  if (!CV_PARKING || CV_PARKING.parent !== model) {
    CV_PARKING = new T.Group();
    CV_PARKING.name = 'Deck_Parking';
    model.add(CV_PARKING);
  }
  return CV_PARKING;
}
// 5 km 보다 멀면 한 대가 몇 픽셀이라 그릴 값어치가 없다 (월드 단위 = m × 3)
const PARKING_DRAW_DIST = 15000;
// 함포 · 발사기(메시 150개)도 작아서 약 6.7 km 밖에서는 몇 픽셀이다 → 끈다. 보이지 않아도 위치 행렬은 계속 갱신된다(판정 무관).
const CVW_DRAW_DIST = 20000;
function deckParkingUpdate(camPos) {
  const d2 = camPos.distanceToSquared(CV.position);
  if (CV_PARKING) CV_PARKING.visible = d2 < PARKING_DRAW_DIST * PARKING_DRAW_DIST;
  if (typeof CVW !== 'undefined' && CVW.root) CVW.root.visible = d2 < CVW_DRAW_DIST * CVW_DRAW_DIST;
}
// 같은 Su-33 네 대: 기체 하나를 재질별로 합친 형상(52 → 10 조각)을 만들고, 네 자리에 같은 형상을 공유하는 메시로 놓는다.
// 예전엔 복제본 4개 × 메시 52개 = 그리기 호출 208번(그림자 패스까지 두 배) → 이제 40번. 형상은 복사하지 않는다.
// 인스턴스 메시 한 개로 묶으면 10번까지 줄지만, 네 대를 한 경계구로 컬링해 안 보일 때도 삼각형 18만 개를
// 그리게 돼서(화면 아래 가장자리에 걸칠 때) 기체마다 따로 컬링되는 이 방식을 쓴다.
function su33Park(model) {
  if (!su33GLBTemplate) return;
  const parts = mergeByMaterial(su33Folded()); // 날개 접은 모양 (10-model-su33-glb)
  for (const [x, z, hd] of SU33_PARK) {
    const g = new T.Group();
    g.position.set(x, CV_DECK_Y, z);
    g.rotation.y = (hd * Math.PI) / 180;
    g.name = 'Parked_Su33';
    for (const part of parts) g.add(new T.Mesh(part.geometry, part.material));
    deckParking(model).add(g);
  }
}
