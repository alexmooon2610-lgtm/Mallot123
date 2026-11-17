#!/usr/bin/env python3
"""멀티플레이 두 페이지 시험 (relay 전송).

    python3 tools/harness/nettest.py <game.html> [--latency 60] [--jitter 20] [--shots DIR]

브라우저 페이지 둘(A 방장 · B 참가자)을 띄우고, 둘 사이 메시지를 이 스크립트가 직접 날라 준다 (?net=relay).
지연(ms)과 흔들림을 넣을 수 있다. 실제 PeerJS 서버는 거치지 않는다 — 실제 인터넷 연결은 사람이 두 기기로 시험한다.

확인하는 것
  1. 방 만들기 · 코드로 참가 · 자리 배정(방장 0 · 참가자 1) · 접속자 목록
  2. 방장 출격 → 둘 다 VERSUS 시작
  3. 서로의 기체가 보이는가, 보간 위치가 상대의 '지연만큼 과거' 실제 위치와 얼마나 맞는가
  4. 방장 신호가 끊기면 참가자가 3초 안에 알아채고 판을 끝내는가
"""
import asyncio, json, math, os, random, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import run as R  # noqa: E402

DT = 1000 / 60


class Relay:
    """두 페이지 사이 메시지 배달부. 시간은 프레임 수로 센다 (두 페이지가 같은 가짜 시계로 같이 간다)."""

    def __init__(self, latency_ms, jitter_ms, seed=1):
        self.lat, self.jit = latency_ms, jitter_ms
        self.rng = random.Random(seed)
        self.pages, self.rooms, self.q, self.frame = {}, {}, [], 0
        self.cut = set()  # 이 페이지에서 나가는 메시지는 버린다 (끊김 흉내)
        self.last_due = {}

    def due(self, src, dst):
        d = self.lat + self.rng.uniform(-self.jit, self.jit)
        f = self.frame + max(0, round(d / DT))
        # 같은 길의 메시지는 순서를 지킨다 (신뢰 연결)
        f = max(f, self.last_due.get((src, dst), 0))
        self.last_due[(src, dst)] = f
        return f

    def attach(self, name, page):
        self.pages[name] = page

        async def ctl(kind, code):
            if kind == 'host':
                self.rooms[code] = name
            elif kind == 'join':
                h = self.rooms.get(code)
                if h:
                    self.q.append((self.due(h, name), h, name, 'open', ''))
                    self.q.append((self.due(name, h), name, h, 'open', ''))
            return True

        async def send(to, data):
            if name in self.cut:
                return
            self.q.append((self.due(name, to), to, name, 'data', data))

        return ctl, send

    async def flush(self, all_=False):
        now = [m for m in self.q if all_ or m[0] <= self.frame]
        self.q = [m for m in self.q if m not in now]
        for _, dst, src, kind, data in sorted(now, key=lambda m: m[0]):
            await self.pages[dst].evaluate('([f, k, d]) => window.__netDeliver(f, k, d)', [src, kind, data])


async def main(html, latency, jitter, shots):
    from playwright.async_api import async_playwright
    bad = 0

    def check(ok, label):
        nonlocal bad
        bad += not ok
        print(f"  {'OK ' if ok else 'BAD'} {label}")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path=R.CHROME, args=[
            '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--mute-audio'])
        relay = Relay(latency, jitter)
        pages = {}
        for name, seed in (('A', 1), ('B', 2)):
            pg = await browser.new_page(viewport={'width': 640, 'height': 360})
            errs = []
            pg.on('pageerror', lambda e, errs=errs: errs.append(str(e)[:300]))
            ctl, send = relay.attach(name, pg)
            await pg.expose_function('__relayCtl', ctl)
            await pg.expose_function('__relaySend', send)
            await pg.add_init_script(path=os.path.join(HERE, 'det.js'))
            await pg.goto(f'file://{os.path.abspath(html)}?unlock&net=relay&seed={seed}', timeout=180000)
            pages[name] = (pg, errs)
        A, B = pages['A'][0], pages['B'][0]
        for pg in (A, B):
            while not all(await pg.evaluate(R.READY)):
                await pg.wait_for_timeout(250)
            await pg.evaluate('() => { __det.render = R.render.bind(R); R.render = () => {}; }')
        print(f'— 로비 (지연 {latency} ms ± {jitter})')
        code = await A.evaluate('() => NET.host()')
        check(bool(code) and len(code) == 6, f'방장이 방을 만들었다: {code}')
        await B.evaluate(f'() => NET.join({json.dumps(code)})')
        for _ in range(6):
            await relay.flush(all_=True)
            await asyncio.sleep(0.05)
        sa = await A.evaluate('() => ({ role: NET.st.role, slot: NET.st.slot, roster: NET.st.roster.length, status: NET.st.status })')
        sb = await B.evaluate('() => ({ role: NET.st.role, slot: NET.st.slot, roster: NET.st.roster.length, status: NET.st.status })')
        check(sa['slot'] == 0 and sb['slot'] == 1, f"자리 배정 — 방장 {sa['slot']} · 참가자 {sb['slot']}")
        check(sa['roster'] == 2 and sb['roster'] == 2, f"접속자 목록 — 양쪽 다 2명 ({sa['roster']} · {sb['roster']})")
        check(sb['status'] == 'open', f"참가자 상태 {sb['status']}")

        print('— 대전 시작')
        await A.evaluate("() => NET.startMatch({ mode: 'VERSUS' })")
        await relay.flush(all_=True)
        ma = await A.evaluate('() => [S, activeMission]')
        mb = await B.evaluate('() => [S, activeMission]')
        check(ma == ['play', 'VERSUS'] and mb == ['play', 'VERSUS'], f'둘 다 VERSUS 시작 (A {ma} · B {mb})')

        # 조작: A 는 왼쪽으로 크게 선회, B 는 오른쪽으로 선회하며 상승 (보간이 곡선을 따라가는지 보려고)
        inA = {'60': [['ArrowLeft', True]], '100': [['ArrowLeft', False], ['ArrowUp', True]], '400': [['ArrowUp', False]],
               '700': [['ArrowRight', True]], '730': [['ArrowRight', False]]}
        inB = {'30': [['ArrowRight', True]], '70': [['ArrowRight', False], ['ArrowUp', True]], '300': [['ArrowUp', False]]}
        histA = {}  # A 의 프레임별 실제 위치
        errs_m = []
        seen_frames = 0
        F = 1500
        for f in range(F):
            relay.frame = f
            await A.evaluate('([inp]) => __det.step(1, inp)', [inA])
            await B.evaluate('([inp]) => __det.step(1, inp)', [inB])
            await relay.flush()
            histA[f] = await A.evaluate('() => p.pos.toArray()') if f % 3 == 0 else histA.get(f - 1)
            if f % 30 == 0 and f > 60:
                r = await B.evaluate('() => { const x = es.find(e => e.net && e.net.slot === 0); return x ? x.pos.toArray() : null; }')
                if r:
                    seen_frames += 1
                    # B 는 A 를 (지연 + 보간 지연 100 ms) 만큼 과거로 그린다
                    back = round((latency + 100) / DT)
                    ref = histA.get(f - back - (f - back) % 3)
                    if ref:
                        errs_m.append(math.dist(r, ref))
        check(seen_frames > 0, f'B 가 A 의 기체를 본다 ({seen_frames}번 확인)')
        if errs_m:
            errs_m.sort()
            med, mx = errs_m[len(errs_m) // 2], errs_m[-1]
            # 기체 속도 약 235 m/s 라 프레임 하나(16.7 ms)가 약 4 단위다. 흔들림만큼 더 허용한다
            check(med < 25 and mx < 80, f'보간 오차 — 가운데값 {med:.1f} · 최대 {mx:.1f} 단위 (기체 길이 약 52 단위)')
        ra = await A.evaluate('() => { const x = es.find(e => e.net && e.net.slot === 1); return x ? 1 : 0; }')
        check(ra == 1, 'A 도 B 의 기체를 본다')
        rad = await A.evaluate('() => rd.ct.length')
        print(f'  · A 레이더 접촉 {rad}')
        if shots:
            os.makedirs(shots, exist_ok=True)
            for name, pg in (('A', A), ('B', B)):
                await pg.evaluate("() => { cameraMode = 'external'; R.render = __det.render; __det.step(1); R.render = () => {}; }")
                await pg.screenshot(path=os.path.join(shots, f'net_{name}.png'))

        print('— 끊김: 방장 메시지를 모두 버린다')
        relay.cut.add('A')
        t0 = None
        for f in range(F, F + 300):
            relay.frame = f
            await A.evaluate('() => __det.step(1)')
            await B.evaluate('() => __det.step(1)')
            await relay.flush()
            if t0 is None and await B.evaluate("() => S !== 'play'"):
                t0 = (f - F) * DT / 1000
        check(t0 is not None and t0 <= 3.5, f'참가자가 끊김을 알아채고 판을 끝냈다 ({t0} 초)')
        over = await B.evaluate('() => over')
        print(f'  · B 화면: {over}')
        for name in ('A', 'B'):
            e = pages[name][1] + await pages[name][0].evaluate('() => __det.errors')
            check(not e, f'{name} 페이지 오류 없음' + (f': {e[:2]}' if e else ''))
        await browser.close()
    return 1 if bad else 0


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        sys.exit(2)

    def opt(name, d):
        return type(d)(a[a.index(name) + 1]) if name in a else d

    sys.exit(asyncio.run(main(a[0], opt('--latency', 60), opt('--jitter', 20), opt('--shots', ''))))
