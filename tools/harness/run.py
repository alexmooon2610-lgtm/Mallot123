#!/usr/bin/env python3
"""STEEL TEMPEST 결정론 회귀 검사.

    python3 tools/harness/run.py run  <game.html> <out.json> [시나리오 ...]   # 기본: 전부
    python3 tools/harness/run.py diff <a.json> <b.json>                      # 프레임 단위 비교
    python3 tools/harness/run.py fxcheck <out.json>                        # 비행 효과 · 시점이 판정을 바꾸는지
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

SCENARIOS = {
    # 이름: (env, 임무 id, 프레임 수, 입력, 시드[, localStorage 초기값])
    'carrier': ('CARRIER', 'LEGACY', 3000, keys(*CARRIER_LAUNCH, *COMBAT), 1),
    # 비행 효과 OFF. 연출 설정이라 'carrier' 와 판정이 같아야 한다 (compare-fx 로 확인)
    'carrier-fx0': ('CARRIER', 'LEGACY', 3000, keys(*CARRIER_LAUNCH, *COMBAT), 1, {'stFx': '0'}),
    # 외부 시점(V)으로 같은 조작. 시점도 연출이라 'carrier' 와 판정이 같아야 한다
    'carrier-ext': ('CARRIER', 'LEGACY', 3000, keys(tap('KeyV', 5), *CARRIER_LAUNCH, *COMBAT), 1),
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


# ---------------------------------------------------------------- 실행
async def run_one(browser, html, name, spec, shots_dir):
    env, mission, frames, inputs, seed = spec[:5]
    storage = spec[5] if len(spec) > 5 else {}
    page = await browser.new_page(viewport={'width': 480, 'height': 270})
    errs, logs = [], []
    page.on('pageerror', lambda e: errs.append(str(e)[:300]))
    page.on('console', lambda m: logs.append(m.text))
    await page.add_init_script(path=os.path.join(HERE, 'det.js'))
    if storage:
        await page.add_init_script('(' + json.dumps(storage) + ') && Object.entries(' + json.dumps(storage)
                                   + ').forEach(([k, v]) => localStorage.setItem(k, v))')
    await page.goto(f'file://{os.path.abspath(html)}?unlock&seed={seed}', timeout=180000)
    # 모델 로딩(비동기)이 끝날 때까지 실제 시간으로 기다린다. 로딩 도중에 프레임을 돌리면 결과가 흔들린다.
    t0 = time.time()
    READY = """() => [typeof mig29GLBTemplate !== 'undefined' && !!mig29GLBTemplate, !!f16GLBTemplate, !!la17GLBTemplate,
                    !!su33GLBTemplate, !!(mslGLBTemplate.SARH && mslGLBTemplate.IR)]"""
    ready = []
    while time.time() - t0 < 90:
        try:
            ready = await page.evaluate(READY)
            if all(ready):
                break
        except Exception:
            pass
        await page.wait_for_timeout(250)
    if not all(ready):
        errs.append(f'모델 로딩 미완료 (mig29,f16,la17,su33,msl) = {ready}')
    await page.wait_for_timeout(500)
    t_load = time.time() - t0
    await page.add_script_tag(path=os.path.join(HERE, 'probe.js'))
    # 3D 렌더는 판정에 관여하지 않으므로 끈다 (SwiftShader 에서 한 프레임 0.4초 → 수 ms). 스크린숏 때만 되살린다.
    await page.evaluate('() => { __det.render = R.render.bind(R); R.render = () => {}; }')
    await page.evaluate('() => { const f = document.getElementById("mallot-front"); if (f) f.style.display = "none"; }')
    # 판정 난수 시드 고정. V14.4.0 까지는 rnd 가 Math.random 이라 det.js 의 시드가 곧 판정 시드였고,
    # V14.4.1 부터는 rnd 가 독립 함수라 rnd.seed() 로 따로 고정한다. 해시 옆에는 rnd 상태(=당긴 횟수)를 붙인다.
    await page.evaluate(f'''() => {{
        __det.reseed({seed});
        if (rnd.seed) {{ rnd.seed({seed}); __det.rndState = rnd.state; }}
    }}''')
    # 출격은 첫 프레임 안에서 한다 (init() 이 판정 난수를 당기므로 프레임 밖에서 부르면 안 된다)
    pre = f"activeMode = {json.dumps(env)}; activeMission = {json.dumps(mission)} || defaultMission(activeMode); start();"
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
            'errors': errs + det_errs, 'load_s': round(t_load, 1), 'glb_logs': [l for l in logs if 'GLB' in l]}


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
    if not a or a[0] not in ('run', 'diff', 'list', 'fxcheck'):
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
    elif a[0] == 'fxcheck':
        sys.exit(fxcheck(a[1]))
    else:
        sys.exit(diff(a[1], a[2]))
