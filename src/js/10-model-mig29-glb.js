/* ===== MiG-29 GLB — V15.0.0-alpha.9 부터 '뉴 MiG-29' = MiG-29K (izd. 9.41) 실측 모델 (claude/mig29k_model_spec.md) =====
   MAKS 2007 청색 도색 · 보르트 952 · 도색 텍스처가 GLB 안에 WEBP 로 들어 있다(EXT_texture_webp, 1.10 MB —
   예전 9-12 모델 0.54 MB + 따로 읽던 도색 PNG 0.59 MB 보다 작다). 원본 PNG 판은 src/assets/source/ 에 보관.
   모델 축: 기수 -Z, 위 +Y, 바퀴 바닥 y=0 (실기 크기, m). 게임 축과 방향이 같아 회전하지 않는다.
   바퀴 바닥을 예전 기어 높이(y≈-1.09)에 맞춰 아래로 옮긴다. 비행 계산 · 히트박스는 모델과 무관하다 (모델만 바꿈).
   노드: landing_gear(내린 상태) · tailhook(피벗에서 X +31° = 내림) · wing_outer_R/L(Z ±118° = 접힘, 갑판 주기용)
*/
let mig29GLBTemplate = null;
const MIG29_GLB_Y = -1.09;
const MIG29K_HOOK_DOWN = (31 * Math.PI) / 180,
  MIG29K_FOLD = (118 * Math.PI) / 180;
function cloneGLBWithOwnedResources(source) {
  const clone = source.clone(true);
  clone.traverse(node => {
    if (!node.isMesh) return;
    if (node.geometry) node.geometry = node.geometry.clone();
    if (Array.isArray(node.material)) node.material = node.material.map(m => m.clone());
    else if (node.material) node.material = node.material.clone();
    node.castShadow = true;
    node.receiveShadow = true;
  });
  return clone;
}
function createMiG29FromUserGLB(opts = {}) {
  const root = new T.Group();
  root.name = 'Player_MiG29_GLB';
  const model = cloneGLBWithOwnedResources(mig29GLBTemplate);
  model.position.y = MIG29_GLB_Y;
  root.add(model);
  const gearNode = model.getObjectByName('landing_gear'),
    hook = model.getObjectByName('tailhook'),
    gear = gearNode ? [gearNode] : [];
  const setGear = on => gear.forEach(g => (g.visible = !!on));
  // 테일훅: 갑판 위 · 순항 중에는 접고, 항모로 내려앉을 때(비행 중 기어 내림)만 내린다 — 메인 루프가 매 프레임 정한다
  const setHook = on => hook && (hook.rotation.x = on ? MIG29K_HOOK_DOWN : 0);
  setGear(opts.gearDown);
  if (opts.folded)
    for (const [n, a] of [
      ['wing_outer_R', MIG29K_FOLD],
      ['wing_outer_L', -MIG29K_FOLD],
    ]) {
      const w = model.getObjectByName(n);
      if (w) w.rotation.z = a;
    }

  // 애프터버너 불꽃 (모양은 예전 그대로 — 사용자 지시): 9.41 노즐 출구(y ±0.88 · 높이 1.22 m · 출구 z 6.95) 뒤에 붙인다.
  const flames = [];
  for (const x of [-0.88, 0.88]) {
    const flame = new T.Mesh(
      new T.ConeGeometry(0.24, 2.15, 16, 1, true),
      new T.MeshBasicMaterial({
        color: 0xffa34a,
        transparent: true,
        opacity: 0.76,
        blending: T.AdditiveBlending,
        depthWrite: false,
        side: T.DoubleSide,
      })
    );
    flame.rotation.x = Math.PI / 2;
    flame.position.set(x, 1.22 + MIG29_GLB_Y, 6.95 + 1.075);
    flame.visible = false;
    flame.name = 'Game_Afterburner_Effect';
    root.add(flame);
    flames.push(flame);
  }
  root.userData.setGear = setGear;
  root.userData.setHook = setHook;
  root.userData.setAfterburner = on =>
    flames.forEach(f => {
      f.visible = !!on;
    });
  root.userData.parts = { gear, flames };
  if (opts.scale) root.scale.setScalar(opts.scale);
  return root;
}
// 도색: alpha.9 부터 GLB 안에 들어 있다 (예전엔 도색 PNG 를 따로 읽어 'body' 재질에 붙였다).
// 갑판 주기 기체 · 표지 기체가 부르던 paintMiG29 는 이제 할 일이 없다 (남겨 둔 이름).
const mig29Extras = []; // 항모 갑판 주기 MiG
function paintMiG29() {}
function createMiG29(opts = {}) {
  return mig29GLBTemplate ? createMiG29FromUserGLB(opts) : createMiG29Procedural(opts);
}
function applyLoadedMiG29ToPlayer() {
  if (!mig29GLBTemplate || !p || !p.mesh || playerAc !== 'mig') return;
  const previous = p.mesh;
  const replacement = createMiG29FromUserGLB({ gearDown: !!p.gearDown });
  replacement.scale.setScalar(3);
  replacement.position.copy(p.pos);
  replacement.quaternion.copy(p.q);
  replacement.visible = previous.visible;
  scene.add(replacement);
  p.mesh = replacement;
  replacement.userData.setGear?.(!!p.gearDown);
  replacement.userData.setAfterburner?.(!!p.ab);
  disposePlayerModel(previous);
  console.info('[STEEL TEMPEST] MiG-29 GLB applied', mig29GLBTemplate);
}
// 단순 GLB 읽기: 이 모델이 쓰는 기능(메시 · 인덱스 · 위치/법선/UV · 기본 재질)만 읽는다.
// CDN 의 GLTFLoader 없이도 모델이 뜨도록 게임 안에서 직접 읽는다.
function parseSimpleGLB(buf, texScale = 1, texHi = false) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = dv.getUint32(12, true);
  const g = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const TA = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
  const acc = i => {
    const a = g.accessors[i],
      v = g.bufferViews[a.bufferView],
      C = TA[a.componentType],
      off = binStart + (v.byteOffset || 0) + (a.byteOffset || 0),
      n = a.count * N[a.type];
    return { arr: new C(buf.slice(off, off + n * C.BYTES_PER_ELEMENT)), size: N[a.type] };
  };
  const texCache = {};
  function texOf(ti) {
    if (ti in texCache) return texCache[ti];
    const t = g.textures && g.textures[ti],
      src = t && (t.source ?? t.extensions?.EXT_texture_webp?.source), // WEBP 텍스처판(EXT_texture_webp)도 읽는다
      im = src != null && g.images && g.images[src];
    if (!im || im.bufferView == null) return (texCache[ti] = null);
    const v = g.bufferViews[im.bufferView],
      bytes = new Uint8Array(buf, binStart + (v.byteOffset || 0), v.byteLength);
    return (texCache[ti] = decodeTexQueued(bytes, im.mimeType, texCap(texScale), texHi)
      .then(src => {
        const tex = new T.Texture(src);
        tex.flipY = false; // glTF UV 기준
        tex.encoding = T.sRGBEncoding; // 도색 텍스처는 sRGB
        tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
        tex.minFilter = T.LinearMipmapLinearFilter;
        tex.magFilter = T.LinearFilter;
        try {
          tex.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());
        } catch (e) {}
        tex.needsUpdate = true;
        return guardTex(tex);
      })
      .catch(e => {
        console.warn('[STEEL TEMPEST] GLB texture failed to decode', e);
        return null;
      }));
  }
  const mats = (g.materials || []).map(m => {
    const pb = m.pbrMetallicRoughness || {},
      c = pb.baseColorFactor || [1, 1, 1, 1];
    const mat = new T.MeshStandardMaterial({
      color: new T.Color(c[0], c[1], c[2]),
      metalness: pb.metallicFactor ?? 1,
      roughness: pb.roughnessFactor ?? 1,
      side: m.doubleSided ? T.DoubleSide : T.FrontSide,
      transparent: m.alphaMode === 'BLEND',
      opacity: c[3],
    });
    mat.name = m.name || '';
    // 텍스처: GLB 안의 이미지를 data URL 로 읽어 다 읽히면 붙인다 (그 전에는 회색으로 보인다)
    const ti = pb.baseColorTexture && pb.baseColorTexture.index;
    if (ti != null && texOf(ti)) {
      mat.userData.baseColor = mat.color.clone(); // 텍스처에 곱할 색 (불러온 쪽에서 밝기 조절 가능)
      mat.color.set(0x8f989c);
      texOf(ti).then(tex => {
        if (!tex) return; // 펼치기 실패: 회색(텍스처 없음 색) 그대로
        guardTex(tex, mat);
        mat.map = tex;
        mat.color.copy(mat.userData.baseColor);
        mat.needsUpdate = true;
      });
    }
    return mat;
  });
  const meshOf = mi =>
    g.meshes[mi].primitives.map(pr => {
      const geo = new T.BufferGeometry(),
        at = pr.attributes;
      for (const [k, name] of [
        ['POSITION', 'position'],
        ['NORMAL', 'normal'],
        ['TEXCOORD_0', 'uv'],
      ])
        if (at[k] != null) {
          const a = acc(at[k]);
          geo.setAttribute(name, new T.BufferAttribute(a.arr, a.size));
        }
      if (pr.indices != null) geo.setIndex(new T.BufferAttribute(acc(pr.indices).arr, 1));
      if (at.NORMAL == null) geo.computeVertexNormals();
      const mesh = new T.Mesh(geo, pr.material != null ? mats[pr.material] : new T.MeshStandardMaterial());
      mesh.name = g.meshes[mi].name || '';
      return mesh;
    });
  const nodeOf = ni => {
    const nd = g.nodes[ni],
      o = new T.Group();
    o.name = nd.name || '';
    if (nd.matrix) o.applyMatrix4(new T.Matrix4().fromArray(nd.matrix));
    if (nd.translation) o.position.fromArray(nd.translation);
    if (nd.rotation) o.quaternion.fromArray(nd.rotation);
    if (nd.scale) o.scale.fromArray(nd.scale);
    if (nd.mesh != null) {
      const ms = meshOf(nd.mesh);
      if (ms.length === 1 && !nd.children) {
        ms[0].name = o.name || ms[0].name;
        ms[0].position.copy(o.position);
        ms[0].quaternion.copy(o.quaternion);
        ms[0].scale.copy(o.scale);
        return ms[0];
      }
      ms.forEach(m => o.add(m));
    }
    (nd.children || []).forEach(c => o.add(nodeOf(c)));
    return o;
  };
  const root = new T.Group();
  const sc = g.scenes ? g.scenes[g.scene || 0] : { nodes: [0] };
  sc.nodes.forEach(n => root.add(nodeOf(n)));
  return root;
}
function loadUserMiG29GLB() {
  try {
    const bytes = assetBytes('asset-mig29-glb');
    mig29GLBTemplate = parseSimpleGLB(bytes.buffer, 1, true); // 내 기체 도색은 먼저 펼친다
    mig29GLBTemplate.name = 'MiG29_GLB_Template';
    paintMiG29(mig29GLBTemplate);
    applyLoadedMiG29ToPlayer();
  } catch (err) {
    mig29GLBTemplate = null;
    console.error('[STEEL TEMPEST] MiG-29 GLB failed; procedural fallback remains active', err);
  }
}
// F-16C GLB 데이터는 파일 맨 아래 <script id="asset-f16-glb"> 블록에 있음 (readAsset 로 읽음)

