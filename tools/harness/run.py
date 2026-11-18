#!/usr/bin/env python3
"""STEEL TEMPEST 결정론 회귀 검사.

    python3 tools/harness/run.py run  <game.html> <out.json> [시나리오 ...]   # 기본: 전부
    python3 tools/harness/run.py diff <a.json> <b.json>                      # 프레임 단위 비교
    python3 tools/harness/run.py fxcheck <out.json>                        # 비행 효과 · 시점이 판정을 바꾸는지
    python3 tools/harness/run.py weapons <game.html>                         # 무장 단위 시험 (미사일 유도 · 기총 · 대응수단)
    python3 tools/harness/run.py list

가짜 시계(det.js)로 프레임을 직접 돌리고, 매 프레임 판정 상태(probe.js)를 해시한다.
같은 입력 · 같은 시드면 같은 빌드는 항상 같은 해시열을 낸다. 연출만 바꾼 빌드도 같아야 한다.
다르면 diff 가 처음 갈라진 프레임과 그때의 상태 차이를 보여 준다.

필요: pip install playwright · 크롬 (CHROME 환경변수 또는 /usr/bin/google-chrome)
SwiftShader 소프트웨어 렌더러로 돌므로 프레임 시간 측정용이 아니다 (판정 비교 전용).
"""
import asyncio, json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')


# ---------------------------------------------------------------- 입력 대본
def keys(*events):
    """events: (frame, code, down) 또는 hold(...) 결과들 → {frame: [[code, down], ...]}"""
    out = {}
    for ev in events:
        for f, code, down in (ev if isinstance(ev, list) else [ev]):
            out.setdefault(f, []).append([code, down])
    return out


def hold(code, f0, f1):
    return [(f0, code, True), (f1, code, False)]


def tap(code, f):
    return hold(code, f, f + 2)


# 항모 발진 공통: 발진 준비(prep 6.2초 = 372프레임) 끝나면 Shift → 스키점프 활주(약 400프레임) → 780 무렵 공중 → 기수 들기
CARRIER_LAUNCH = [hold('KeyW', 0, 150), hold('ShiftLeft', 380, 420), hold('ArrowUp', 820, 900)]
# 공중 전투 조작 (발진 뒤)
COMBAT = [tap('KeyT', 1000), tap('Tab', 1060), tap('KeyY', 1100), tap('Space', 1200),
          tap('Digit2', 1300), tap('Space', 1400), hold('KeyG', 1600, 1700),
          tap('KeyX', 1800), tap('KeyC', 1820), hold('ArrowLeft', 1900, 1960), hold('ArrowUp', 1960, 2100)]

# 착함 직전 자세를 만든다. z: 항모 로컬 앞뒤 위치(+ 가 함미 쪽) · spd: 속도 · sink: 강하 기울기
TRAP = """
setSt('fly'); ops.safe = 0;
es.forEach(e => scene.remove(e.mesh)); es = []; wt = 1e9;
p.pos.copy(CV.localToWorld(V(0, DECK_Y + EYE + 2.5, {z})));
p.q.copy(CV.quaternion);
p.vd.set(0, -{sink}, -1).applyQuaternion(CV.quaternion).normalize();
p.speed = {spd}; p.thr = 0.35; p.ab = 0; p.gearDown = true; p.flap = 1;
"""
ABLAND = """
missionPhase = 'final'; missionGate = curM().gates.length;
airbaseOps.phase = 'airborne'; airbaseOps.far = true; airbaseOps.airT = 60;
p.pos.set(0, 14, -1500);
p.q.setFromRotationMatrix(new T.Matrix4().lookAt(V(), V(0, 0, 1), V(0, 1, 0)));
p.vd.set(0, -0.02, 1).normalize();
p.speed = 110; p.thr = 0.3; p.ab = 0; p.gearDown = true; p.flap = 1;
"""

VCLIMB = """
setSt('fly'); ops.safe = 0;
es.forEach(e => scene.remove(e.mesh)); es = []; wt = 1e9;
p.pos.set(0, 1000, 0); p.q.setFromEuler(new T.Euler(Math.PI / 2, 0, 0)); p.vd.set(0, 1, 0);
p.speed = 250; p.thr = 1; p.ab = 0; p.gearDown = false; p.flap = 0;
"""

# 항모에서 25 km 떨어진 곳, 앞 5 km 에 F-16 두 대를 나란히 (같은 방향으로 날아가게) 둔다 — 다중 락 시험용
MULTILOCK = """
setSt('fly'); ops.safe = 0;
es.forEach(e => scene.remove(e.mesh)); es = []; wt = 1e9; wv = 1; spawnWave();
p.pos.set(20000, 3000, 25000); p.q.identity(); p.vd.set(0, 0, -1);
p.speed = 250; p.thr = 0.9; p.ab = 0; p.gearDown = false; p.flap = 0; p.mesh.userData.setGear?.(false);
es.forEach((e, i) => { e.pos.set(20000 + (i ? 400 : -400), 3000, 20000); e.q.identity(); e.vd.set(0, 0, -1); e.speed = 230; e.ai.hint = 99; });
ACFT.su33.locks = 2;
"""

COBRA_SET = """
setSt('fly'); ops.safe = 0;
es.forEach(e => scene.remove(e.mesh)); es = []; wt = 1e9;
p.pos.set(20000, 1000, 20000); p.q.identity(); p.vd.set(0, 0, -1);
p.speed = 480 / 3.6; p.thr = 0.8; p.ab = 0; p.gearDown = false; p.flap = 0; p.mesh.userData.setGear?.(false);
"""

WAVECLEAR = """
setSt('fly'); ops.safe = 0;
p.pos.set(0, 3000, -20000); p.q.setFromEuler(new T.Euler(0, 0, 0)); p.vd.set(0, 0, -1);
p.speed = 250; p.thr = 0.8; p.ab = 0; p.gearDown = false; p.flap = 0;
p.am.SARH = 1; p.am.IR = 0; p.gun = 20; p.fl = 2; p.ch = 2; p.hp = 0.5;
es.slice().forEach(e => kill(e));
"""

SCENARIOS = {
    # 이름: (env, 임무 id, 프레임 수, 입력, 시드[, localStorage 초기값])
    'carrier': ('CARRIER', 'LEGACY', 3000, keys(*CARRIER_LAUNCH, *COMBAT), 1),
    # 비행 효과 OFF. 연출 설정이라 'carrier' 와 판정이 같아야 한다 (compare-fx 로 확인)
    'carrier-fx0': ('CARRIER', 'LEGACY', 3000, keys(*CARRIER_LAUNCH, *COMBAT), 1, {'stFx': '0'}),
    # 외부 시점(V)으로 같은 조작. 시점도 연출이라 'carrier' 와 판정이 같아야 한다
    'carrier-ext': ('CARRIER', 'LEGACY', 3000, keys(tap('KeyV', 5), *CARRIER_LAUNCH, *COMBAT), 1),
    # 기총 연사로 탄창 비우기 (V14.4.2: 150발 = 20발/초 × 7.5초 → 약 450프레임)
    'gun-empty': ('CARRIER', 'LEGACY', 1800, keys(*CARRIER_LAUNCH, hold('KeyG', 1000, 1600), tap('KeyG', 1700)), 1),
    # ---- 상태를 직접 만들어 넣는 시나리오 (setup 코드는 출격 직후 같은 프레임에서 돈다)
    # 착함: 갑판 뒤쪽 120 단위 · 갑판 위 2.5 단위에서 완만히 내려온다 → 와이어 포착 → 급유 · 재무장 (탄을 줄여 두고 보급 확인)
    'trap': ('CARRIER', 'LEGACY', 900, {}, 1, {}, TRAP.format(z=120, spd=140, sink=0.04) + 'p.gun = 10; p.fl = 3; p.am.IR = 0;'),
    # 볼터: 착함 지점(z 10)을 지나서 닿음 → 재상승
    'bolter': ('CARRIER', 'LEGACY', 300, {}, 1, {}, TRAP.format(z=5, spd=140, sink=0.04)),
    # 갑판 충돌: 너무 빠름 (220) → 격추
    'deckcrash': ('CARRIER', 'LEGACY', 120, {}, 1, {}, TRAP.format(z=120, spd=220, sink=0.04)),
    # 비행장 착륙: T-02 최종 접근 단계 · 활주로 앞 1.5 km 고도 14 m → 활주로 포착 → 접지 · 감속 → 평가
    'abland': ('AIRBASE', 'T02', 600, {}, 1, {}, ABLAND),
    # 수직 상승 (V14.7.0 물리): 고도 1000 m · 900 km/h 에서 기수 수직 · 애프터버너. 약 36초 · 8 km 에서 실속 → 기수가 떨어진다
    'vclimb': ('CARRIER', 'LEGACY', 3000, keys(hold('ShiftLeft', 0, 3000)), 1, {}, VCLIMB),
    # 웨이브 격파 (V14.8.0): 공중 재보급 없음 · 다음 웨이브 30초 뒤 (비행 중이라 흐른다 → 약 1800 프레임에 새 적)
    'waveclear': ('CARRIER', 'LEGACY', 2100, {}, 1, {}, WAVECLEAR),
    # 웨이브 격파 직후 착함: 갑판 위에서는 웨이브 시계가 멈춘다 (보급 · 견인이 끝나도 발진 전까지 30초 그대로)
    'wavedeck': ('CARRIER', 'LEGACY', 1200, {}, 1, {}, TRAP.format(z=120, spd=140, sink=0.04).replace('es = []; wt = 1e9;', '') + 'es.slice().forEach(e => kill(e));'),
    # ---- Su-33 (V15.0.0-alpha.3): 설정에서 Su-33 을 고른 상태 (localStorage stAc)
    # Su-33 은 추력이 작아 MiG 와 같은 수직 당김(820~900)이면 손을 놓은 채 실속해 바다에 떨어진다 → 짧게 당긴다
    'su33-carrier': ('CARRIER', 'LEGACY', 3000, keys(hold('KeyW', 0, 150), hold('ShiftLeft', 380, 420),
                                                     hold('ArrowUp', 820, 850), *COMBAT), 1, {'stAc': 'su33'}),
    'su33-vclimb': ('CARRIER', 'LEGACY', 3000, keys(hold('ShiftLeft', 0, 3000)), 1, {'stAc': 'su33'}, VCLIMB),
    'su33-trap': ('CARRIER', 'LEGACY', 900, {}, 1, {'stAc': 'su33'},
                  TRAP.format(z=120, spd=140, sink=0.04) + 'p.gun = 10; p.fl = 3; p.am.SARH = 0;'),
    # 다중 락 코드 시험: 실기 Su-33 은 1개 교전이라 시험 안에서만 ACFT.su33.locks = 2 로 켠다 (MULTILOCK 끝 줄).
    # 앞 5 km F-16 두 대 → MULTI-TRK → 락 → Tab → 두 번째 락 → SARH → Tab(주 락 전환) → SARH
    'multilock': ('CARRIER', 'LEGACY', 1500, keys(tap('KeyT', 10), tap('KeyY', 150), tap('Tab', 170), tap('KeyY', 260),
                                                       tap('Space', 290), tap('Tab', 340), tap('Space', 380)),
                       1, {'stAc': 'su33'}, MULTILOCK),
    # 무장 구성 (alpha.3): MiG 를 R-27R 2 · R-73 6 으로 골라 둔 상태 → 출격 무장 · 착함 보급이 그 구성대로인지
    'loadout-trap': ('CARRIER', 'LEGACY', 900, {}, 1, {'stLoad': '{"mig":2}'},
                     TRAP.format(z=120, spd=140, sink=0.04) + 'p.am.SARH = 0; p.am.IR = 1;'),
    # 코브라 (alpha.3, Su-33 카나드): 1000 m · 480 km/h 수평 → Q → 약 2.4초 뒤 실속속도 1.05배 언저리로 빠져나오는지
    'su33-cobra': ('CARRIER', 'LEGACY', 400, keys(tap('KeyQ', 10)), 1, {'stAc': 'su33'}, COBRA_SET),
    'carrier-s2': ('CARRIER', 'LEGACY', 1200, keys(*CARRIER_LAUNCH), 2),  # 시드 2: 판정이 시드를 따르는지 확인용
    'idle': ('CARRIER', 'LEGACY', 1800, {}, 1),                           # 아무 조작 없이 두기 (갑판 대기)
    'airbase': ('AIRBASE', None, 2400, keys(hold('KeyW', 0, 120), tap('ShiftLeft', 130),
                hold('ArrowUp', 900, 1000), tap('KeyN', 1300)), 1),
    'tr1': ('CARRIER', 'TR1', 3000, keys(*CARRIER_LAUNCH, *COMBAT), 1),
    'tr2': ('CARRIER', 'TR2', 3000, keys(*CARRIER_LAUNCH, hold('KeyG', 1200, 1300), tap('KeyX', 1500),
            hold('ArrowRight', 1600, 1650), hold('ArrowUp', 1650, 1900)), 1),
    'tr3': ('AIRBASE', 'TR3', 2400, keys(tap('KeyX', 400), tap('KeyC', 420),
            hold('ArrowRight', 600, 640), hold('ArrowUp', 640, 700)), 1),
}


# 기총으로 F-16(hp 1)을 격추하는 데 필요한 명중 수 (사용자 결정 2026-11-17: 10발). weapons 시험이 확인한다
GUN_HITS_TO_KILL = 10


# ---------------------------------------------------------------- 실행
async def open_game(browser, html, seed, storage=None, errs=None):
    """게임을 열고 모델 로딩이 끝날 때까지 기다린다. 3D 렌더는 끈다."""
    page = await browser.new_page(viewport={'width': 480, 'height': 270})
    if errs is not None:
        page.on('pageerror', lambda e: errs.append(str(e)[:300]))
    await page.add_init_script(path=os.path.join(HERE, 'det.js'))
    if storage:
        await page.add_init_script('Object.entries(' + json.dumps(storage) + ').forEach(([k, v]) => localStorage.setItem(k, v))')
    await page.goto(f'file://{os.path.abspath(html)}?unlock&seed={seed}', timeout=180000)
    t0 = time.time()
    while time.time() - t0 < 90:
        try:
            if all(await page.evaluate(READY)):
                break
        except Exception:
            pass
        await page.wait_for_timeout(250)
    await page.wait_for_timeout(500)
    await page.evaluate('() => { __det.render = R.render.bind(R); R.render = () => {}; '
                        'const f = document.getElementById("mallot-front"); if (f) f.style.display = "none"; }')
    return page


READY = """() => [typeof mig29GLBTemplate !== 'undefined' && !!mig29GLBTemplate, !!f16GLBTemplate, !!la17GLBTemplate,
                !!su33GLBTemplate, !!(mslGLBTemplate.SARH && mslGLBTemplate.IR)]"""


async def weapons(html, gun_hits=None):
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path=CHROME, args=[
            '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--mute-audio'])
        errs = []
        page = await open_game(browser, html, 1, errs=errs)
        await page.add_script_tag(path=os.path.join(HERE, 'weapons.js'))
        await page.evaluate('() => { __det.reseed(1); if (rnd.seed) __det.rndState = rnd.state; }')
        bad = 0
        print('— 직접 시험 (updMsl 만, 표적은 정해진 대로 이동)')
        for name in await page.evaluate('() => Object.keys(__wpn.direct)'):
            r = await page.evaluate(f'() => __wpn.direct.{name}()')
            exp = await page.evaluate(f'() => __wpn.EXPECT.{name}')
            ok = r['hit'] == exp
            bad += not ok
            print(f"  {'OK ' if ok else 'BAD'} {name:15s} {'명중' if r['hit'] else '빗나감':4s} {r['t']:6.2f}s"
                  f"  (기대: {'명중' if exp else '빗나감'}){'  ' + r.get('why', '') if not r['hit'] else ''}")
        g = await page.evaluate('() => __wpn.gunHits()')
        gok = g['killed'] and (gun_hits is None or g['hits'] == gun_hits)
        bad += not gok
        print(f"  {'OK ' if gok else 'BAD'} gun_hits        {'격추' if g['killed'] else '생존'} — {g['hits']}발 명중 / {g['shots']}발 발사"
              + (f'  (기대: {gun_hits}발)' if gun_hits else ''))
        print('— 대응수단 (실제 게임 루프 · 적 IR 꼬리 3 km · 플레이어 직진 · 시드 1~20)')
        for n in (0, 2, 4):
            hits = 0
            for seed in range(1, 21):
                hits += await page.evaluate(f'() => __wpn.cmTrial({seed}, {n})')
            print(f'  플레어 {n}번: {hits}/20 피격')
        if errs:
            print('  페이지 오류:', errs[:3])
        await browser.close()
        return 1 if bad or errs else 0


async def run_one(browser, html, name, spec, shots_dir):
    env, mission, frames, inputs, seed = spec[:5]
    storage = spec[5] if len(spec) > 5 else {}
    setup = spec[6] if len(spec) > 6 else ''
    errs, logs = [], []
    t0 = time.time()
    page = await open_game(browser, html, seed, storage, errs)
    page.on('console', lambda m: logs.append(m.text))
    ready = await page.evaluate(READY)
    if not all(ready):
        errs.append(f'모델 로딩 미완료 (mig29,f16,la17,su33,msl) = {ready}')
    t_load = time.time() - t0
    await page.add_script_tag(path=os.path.join(HERE, 'probe.js'))
    # 판정 난수 시드 고정. V14.4.0 까지는 rnd 가 Math.random 이라 det.js 의 시드가 곧 판정 시드였고,
    # V14.4.1 부터는 rnd 가 독립 함수라 rnd.seed() 로 따로 고정한다. 해시 옆에는 rnd 상태(=당긴 횟수)를 붙인다.
    await page.evaluate(f'''() => {{
        __det.reseed({seed});
        if (rnd.seed) {{ rnd.seed({seed}); __det.rndState = rnd.state; }}
    }}''')
    # 출격은 첫 프레임 안에서 한다 (init() 이 판정 난수를 당기므로 프레임 밖에서 부르면 안 된다).
    # setup: 출격 직후 같은 프레임에서 상태를 바로 만들어 넣는 코드 (착함 직전 자세 등)
    pre = (f"activeMode = {json.dumps(env)}; activeMission = {json.dumps(mission)} || defaultMission(activeMode); start();"
           + setup)
    hashes = []
    CH = 300  # 한 번에 돌리는 프레임 수
    js_inputs = {str(k): v for k, v in inputs.items()}
    for i in range(0, frames, CH):
        n = min(CH, frames - i)
        hashes += await page.evaluate(
            "([n, inp, pre]) => __det.step(n, inp, () => __probe.hash() + '/' + (rnd.state ? rnd.state().toString(16) : __det.calls), pre)",
            [n, js_inputs, pre if i == 0 else None])
    brief = await page.evaluate('() => __probe.brief()')
    state = await page.evaluate('() => __probe.state()')
    det_errs = await page.evaluate('() => __det.errors')
    outside = await page.evaluate('() => __det.outside')
    if outside:
        det_errs.append('프레임 밖에서 판정 난수 호출 (실제 시간에 따라 결과가 흔들림): ' + ' | '.join(outside[:5]))
    if shots_dir:
        os.makedirs(shots_dir, exist_ok=True)
        await page.evaluate('() => { R.render = __det.render; __det.step(1); }')  # 화면을 한 번 그려 둔다
        await page.screenshot(path=os.path.join(shots_dir, name + '.png'))
    await page.close()
    return {'frames': frames, 'final': hashes[-1], 'hashes': hashes, 'brief': brief, 'state': state,
            'errors': errs + det_errs, 'load_s': round(t_load, 1)}


async def run(html, out, names, shots_dir=None):
    from playwright.async_api import async_playwright
    res = {'html': os.path.basename(html), 'scenarios': {}}
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path=CHROME, args=[
            '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--mute-audio'])
        for name in names:
            t0 = time.time()
            r = await run_one(browser, html, name, SCENARIOS[name], shots_dir)
            res['scenarios'][name] = r
            print(f"{name:11s} {r['final']}  {time.time() - t0:5.1f}s  {json.dumps(r['brief'], ensure_ascii=False)}"
                  + (f"  ERRORS {len(r['errors'])}" if r['errors'] else ''))
            for e in r['errors'][:5]:
                print('   !', e)
        await browser.close()
    with open(out, 'w') as f:
        json.dump(res, f)


def diff_states(a, b, path=''):
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            out += diff_states(a.get(k), b.get(k), f'{path}.{k}' if path else k)
    elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(a, b)):
            out += diff_states(x, y, f'{path}[{i}]')
    elif a != b:
        out.append(f'{path}: {json.dumps(a)[:80]} → {json.dumps(b)[:80]}')
    return out


def diff(a_path, b_path):
    A, B = (json.load(open(p))['scenarios'] for p in (a_path, b_path))
    same = True
    for name in sorted(set(A) | set(B)):
        if name not in A or name not in B:
            print(f'{name:11s} 한쪽에만 있음')
            continue
        ha, hb = A[name]['hashes'], B[name]['hashes']
        first = next((i for i, (x, y) in enumerate(zip(ha, hb)) if x != y), None)
        if first is None and len(ha) == len(hb):
            print(f'{name:11s} 동일 ({len(ha)} 프레임)')
            continue
        same = False
        print(f'{name:11s} 다름 — 처음 갈라진 프레임 {first} / {len(ha)}  (해시/난수호출수 {ha[first]} vs {hb[first]})'
              if first is not None else f'{name:11s} 다름 — 길이 {len(ha)} vs {len(hb)}')
        for d in diff_states(A[name]['state'], B[name]['state'])[:12]:
            print('   마지막 상태', d)
    return 0 if same else 1


# 연출 설정만 다른 짝. 판정이 같아야 한다.
VIS_PAIRS = [('carrier', 'carrier-fx0', '비행 효과 ON/OFF'), ('carrier', 'carrier-ext', '콕핏/외부 시점')]


def fxcheck(path):
    S = json.load(open(path))['scenarios']
    bad = 0
    for x, y, label in VIS_PAIRS:
        if x not in S or y not in S:
            print(f'{label}: 시나리오 없음 ({x}, {y})')
            continue
        a, b = S[x]['hashes'], S[y]['hashes']
        first = next((i for i, (u, v) in enumerate(zip(a, b)) if u != v), None)
        if first is None:
            print(f'{label}: 판정 동일')
        else:
            bad = 1
            print(f'{label}: 프레임 {first} 부터 판정이 다름 ({a[first]} vs {b[first]}) — 연출 코드가 rnd() 를 당기고 있다')
    return bad


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('run', 'diff', 'list', 'fxcheck', 'weapons'):
        print(__doc__)
        sys.exit(2)
    if a[0] == 'list':
        print(' '.join(SCENARIOS))
    elif a[0] == 'run':
        shots = None
        if '--shots' in a:
            i = a.index('--shots')
            shots = a[i + 1]
            del a[i:i + 2]
        names = a[3:] or list(SCENARIOS)
        asyncio.run(run(a[1], a[2], names, shots))
    elif a[0] == 'weapons':
        sys.exit(asyncio.run(weapons(a[1], GUN_HITS_TO_KILL)))
    elif a[0] == 'fxcheck':
        sys.exit(fxcheck(a[1]))
    else:
        sys.exit(diff(a[1], a[2]))
