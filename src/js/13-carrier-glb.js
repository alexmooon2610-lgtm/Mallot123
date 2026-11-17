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

let carrierGLB = null;
function applyCarrierGLB() {
  try {
    const binary = atob(readAsset('asset-carrier-glb')),
      bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const model = parseSimpleGLB(bytes.buffer, 2); // 갑판이 가까이 보이므로 텍스처 두 배
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
        const m = createMiG29FromUserGLB({ gearDown: true });
        m.position.set(by, CV_DECK_Y - MIG29_GLB_Y, -(bx - 152.25));
        m.rotation.y = (hd * Math.PI) / 180;
        m.name = 'Parked_MiG29';
        paintMiG29(m);
        mig29Extras.push(m);
        deckParking(model).add(m);
      }
    su33Park(model);
  } catch (e) {
    console.warn('[STEEL TEMPEST] carrier GLB failed; procedural carrier stays', e);
    CV.children.forEach(c => (c.visible = true));
  }
}

// 우현 주기장의 Su-33 (날개 접음). 항모 로컬 좌표 [x(우현 +), z(함미 +), 기수 방위°] — 단위 m.
// 갑판 우현 가장자리는 z 20~100 에서 x +28~31, z 110 뒤로는 +26 까지 좁아진다 (CV.userData.deckEdges).
// MiG-29 주기 2 대가 z 97 · 112 를 쓰므로 그 앞뒤로 비켜 세운다.
const SU33_PARK = [
  [18.0, 28.0, 135],
  [18.0, 52.0, 135],
  [18.0, 76.0, 135],
  [18.0, 4.0, 135],
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
function deckParkingUpdate(camPos) {
  if (CV_PARKING) CV_PARKING.visible = camPos.distanceToSquared(CV.position) < PARKING_DRAW_DIST * PARKING_DRAW_DIST;
}
function su33Park(model) {
  if (!su33GLBTemplate) return;
  for (const [x, z, hd] of SU33_PARK) {
    const m = su33GLBTemplate.clone();
    m.position.set(x, CV_DECK_Y, z);
    m.rotation.y = (hd * Math.PI) / 180;
    m.name = 'Parked_Su33';
    deckParking(model).add(m);
  }
}
