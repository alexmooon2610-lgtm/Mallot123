/* ===== 무전(SKYWATCH) · 미사일 경보 · 대응수단 기만 ===== */
(function () {
  try {
    const add = (id, h) => {
      const e = document.createElement('div');
      e.id = id;
      if (h) e.innerHTML = h;
      document.body.appendChild(e);
      return e;
    };
    const rad = add('ac-radio'),
      alr = add('ac-alert', '⚠ MISSILE ALERT<small>BREAK · FLARE [X] / CHAFF [C]</small>');
    let rt = 0,
      lastSay = 0;
    // 무전: 합성 음성(TTS)은 걸리적거려서 뺐다. 자막 상자 + 무전 잡음(스퀠치)만 낸다.
    // who: 말하는 쪽 — SKYWATCH(조기경보기) · ZARYA(모함 관제) · LSO(착함 유도관)
    function acSay(en, ko, force, who = 'SKYWATCH') {
      const n = performance.now();
      if (!force && n - lastSay < 1400) return;
      lastSay = n;
      rad.innerHTML = `<b>${who}</b>${en}<i>${ko}</i>`;
      rad.dataset.who = who;
      rad.classList.add('on');
      clearTimeout(rt);
      rt = setTimeout(() => {
        rad.classList.remove('on');
        try {
          noiseSnd(0.07, 0.025, 2600, 1800, 'bandpass'); // 송신 끝 잡음
        } catch (e) {}
      }, 4300);
      try {
        tone(1900, 0.04, 'square', 0.025);
        noiseSnd(0.16, 0.035, 2800, 1200, 'bandpass'); // 송신 시작 잡음
      } catch (e) {}
    }
    // 에이스 컴뱃식 임무 배너: 가운데 큰 글씨 + 삼색 줄, 3초 뒤 사라진다
    const ban = add('ac-banner');
    let bt = 0;
    function acBanner(head, title, sub, bad) {
      ban.className = bad ? 'bad' : '';
      ban.innerHTML = `<small>${head}</small><b>${title}</b><i aria-hidden="true"><s></s><s></s><s></s></i>${sub ? `<em>${sub}</em>` : ''}`;
      void ban.offsetWidth;
      ban.classList.add('on');
      clearTimeout(bt);
      bt = setTimeout(() => ban.classList.remove('on'), 3200);
      // 임무 끝 배너는 결과 화면보다 먼저 혼자 보여 준다 (결과 화면은 배너가 걷힐 때 나타난다)
      const end = head !== 'MISSION START';
      document.body.classList.toggle('ac-hold', end);
      if (end) setTimeout(() => document.body.classList.remove('ac-hold'), 2700);
      try {
        tone(bad ? 220 : 440, 0.5, 'sawtooth', 0.035, bad ? 110 : 660);
      } catch (e) {}
    }
    const RULES = [
      [/이벤트 발생/, 'Missile launch! Missile launch! Break now!', 'SAM 발사! 회피하라!', 1],
      // 플레이어 자신의 레이더 메시지('표적 TRACK 확정')에는 반응하지 않는다
      [
        /지상 위협 접촉 — TRACK|지상 위협 추적 상태/,
        'Warning, radar lock. SAM site is tracking you.',
        '지대공 레이더 추적 중',
        0,
      ],
      [/지상 위협 접촉 — SEARCH/, 'Enemy radar sweeping. Stay low.', '적 레이더 탐색 중 — 저고도 유지', 0],
      [/미사일 기만 성공/, 'Missile decoyed! Nice work.', '미사일 기만 성공', 1],
      [/능선 차폐/, 'Missile lost track. Nice flying.', '미사일 추적 소실', 0],
      [/지형 차폐/, 'Contact lost. Terrain is masking us.', '지형 차폐 — 접촉 소실', 0],
      [/기체 손상/, 'We are hit! Check your systems!', '피격! 기체 상태 확인', 1],
      // 'WAVE n 격파' 메시지에 '신규 적기' 무전이 나가던 문제 → 두 규칙으로 분리
      [/WAVE \d+ 격파/, 'Wave cleared. Rearm and stand by.', '웨이브 격파 — 재보급', 0],
      [/WAVE \d+ — F-16/, 'New bandits on radar. Engage at will.', '신규 적기 접근 — 교전 개시', 0],
      [/공중 충돌|지형 충돌|해면 충돌|갑판 충돌|지면 충돌/, 'Mayday, mayday! We lost Tempest One.', '기체 상실', 1],
      // 격추 시 실제로 찍히는 메시지는 '명중!' — 예전 /격추/ 는 어떤 메시지와도 맞지 않았다
      // 모함 · 착함
      [/^발진!/, 'Tempest One, launch, launch, launch.', '템페스트 원 — 발진, 발진!', 1, 'ZARYA'],
      [/스키점프 이륙/, 'Clean launch. Climb and report.', '이륙 확인 — 상승 후 보고하라', 0, 'ZARYA'],
      [/착함 접근/, 'Tempest One, on glide path. Call the ball.', '활강 경로 진입 — 볼 확인', 0, 'LSO'],
      [/착함! 어레스팅/, 'Trap! Welcome home, Tempest.', '와이어 포착 — 어서 와라', 1, 'LSO'],
      [/BOLTER/, 'Bolter, bolter! Power up, go around.', '볼터 — 출력 올려 복행!', 1, 'LSO'],
      // TR-2 모의전 (상대는 편대 동료 템페스트 투)
      [/FIGHT'S ON/, "Fight's on! Don't go easy on me, lead.", '시작 — 봐주지 마십쇼, 편대장', 1, 'TEMPEST 2'],
      [/격추 판정/, 'Good kill, good kill. Knock it off, resetting.', '격추 판정 인정 — 다시 갑니다', 1, 'TEMPEST 2'],
      [
        /피격 판정/,
        'Tracking, tracking... kill. You are dead, Tempest One.',
        '추적… 격추. 편대장님 죽었습니다',
        1,
        'TEMPEST 2',
      ],
      [/모의전 승리/, 'Nicely flown. Tempest One, return to mother.', '훌륭했다 — 모함으로 귀환하라', 1, 'ZARYA'],
      // TR-1 훈련
      [
        /1단계 —/,
        'Two drones ahead, eighteen kilometers. Lock them up, fox one.',
        '전방 18 km 표적 2기 — 락온 후 R-27R',
        1,
      ],
      [/2단계 —/, 'Next pair, slow movers ahead. Get on their six, fox two.', '다음 2기 — 뒤로 붙어 R-73', 1],
      [/3단계 —/, 'Last one is slow and turning. Guns only.', '마지막 1기 — 기총으로', 1],
      [/지정 무장 아님/, 'Target down, but wrong weapon. Stick to the syllabus.', '격추 — 지정 무장이 아님', 0],
      [/드론 격추/, 'Target destroyed. Good shooting.', '표적 격추 — 좋은 사격', 0],
      [
        /훈련 표적 전부 격추/,
        'All targets down. Tempest One, return to mother.',
        '전 표적 격추 — 모함으로 귀환하라',
        1,
        'ZARYA',
      ],
      [/블랙아웃/, 'Tempest, ease the stick! You are graying out!', 'G 를 풀어라 — 의식 잃는다!', 1],
      [/명중!/, 'Splash one! Good kill.', '적기 격추', 0],
    ];
    let lastLog = null,
      prevS = S,
      lastBeep = 0;
    setInterval(() => {
      try {
        const l = logs[0];
        if (l && l !== lastLog) {
          lastLog = l;
          for (const r of RULES)
            if (r[0].test(l.s)) {
              acSay(r[1], r[2], r[3], r[4]);
              break;
            }
        }
        if ((prevS === 'menu' || prevS === 'over') && S === 'play') {
          acSay(
            "Tempest One, you are cleared for sortie. Show them what you've got.",
            '출격 허가 — 실력을 보여줘라',
            1,
            curM().env === 'CARRIER' ? 'ZARYA' : 'SKYWATCH'
          );
          acBanner(
            'MISSION START',
            `${curM().label} · ${curM().title}`,
            curM().campaign ? '1999.12.18 · NORTH PACIFIC' : ''
          );
        }
        if (prevS === 'play' && S === 'over' && (missionComplete || missionFailed))
          acBanner(
            missionComplete ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED',
            `${curM().label} · ${curM().title}`,
            '',
            !missionComplete
          );
        prevS = S;
        const live = S === 'play' && p ? SAM_PROJECTILES.filter(q => !q.dead) : [];
        alr.style.display = live.length ? 'block' : 'none';
        if (live.length) {
          const d = Math.min(...live.map(q => q.mesh.position.distanceTo(p.pos))),
            now = performance.now(),
            gap = d < 1500 ? 250 : d < 3500 ? 450 : 700;
          if (now - lastBeep > gap) {
            lastBeep = now;
            tone(d < 1500 ? 1500 : 1100, 0.09, 'square', 0.06);
          }
        }
      } catch (e) {}
    }, 100);
  } catch (e) {
    console.warn('[AC skin]', e);
  }
})();

