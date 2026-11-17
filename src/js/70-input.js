// ---------- V9 공통 키보드 입력 계층
// 물리 키 위치(code)를 최우선으로 사용하고, keyCode/which는 구형 WebView용 보조 경로로 둔다.
function gameKey(ev) {
  if (!ev) return '';
  const code = typeof ev.code === 'string' ? ev.code : '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  const codeMap = {
    Space: ' ',
    Tab: 'Tab',
    Enter: 'Enter',
    NumpadEnter: 'Enter',
    Escape: 'Escape',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    ControlLeft: 'Control',
    ControlRight: 'Control',
    AltLeft: 'Alt',
    AltRight: 'Alt',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
  };
  if (Object.prototype.hasOwnProperty.call(codeMap, code)) return codeMap[code];
  const kc = Number(ev.keyCode || ev.which || 0);
  if (kc >= 65 && kc <= 90) return String.fromCharCode(kc).toLowerCase();
  if (kc >= 48 && kc <= 57) return String.fromCharCode(kc);
  if (kc >= 96 && kc <= 105) return String(kc - 96);
  const keyCodeMap = {
    8: 'Backspace',
    9: 'Tab',
    13: 'Enter',
    16: 'Shift',
    17: 'Control',
    18: 'Alt',
    27: 'Escape',
    32: ' ',
    33: 'PageUp',
    34: 'PageDown',
    35: 'End',
    36: 'Home',
    37: 'ArrowLeft',
    38: 'ArrowUp',
    39: 'ArrowRight',
    40: 'ArrowDown',
    46: 'Delete',
  };
  if (Object.prototype.hasOwnProperty.call(keyCodeMap, kc)) return keyCodeMap[kc];
  const key = typeof ev.key === 'string' ? ev.key : '';
  if (key === ' ' || key === 'Spacebar') return ' ';
  if (key === 'Esc') return 'Escape';
  if (key === 'Left') return 'ArrowLeft';
  if (key === 'Right') return 'ArrowRight';
  if (key === 'Up') return 'ArrowUp';
  if (key === 'Down') return 'ArrowDown';
  // 마지막 문자 기반 대체는 영문/숫자만 허용한다. 한글 IME 문자를 키 명령으로 오인하지 않는다.
  if (/^[a-zA-Z0-9]$/.test(key)) return key.toLowerCase();
  if (
    [
      'Enter',
      'Escape',
      'Tab',
      'Shift',
      'Control',
      'Alt',
      'Backspace',
      'Delete',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ].includes(key)
  )
    return key;
  return '';
}
function keySource(ev) {
  const code = typeof ev.code === 'string' ? ev.code : '';
  if (code && code !== 'Unidentified') return 'code:' + code;
  const kc = Number(ev.keyCode || ev.which || 0);
  if (kc) return 'legacy:' + kc + ':' + (ev.location || 0);
  const key = typeof ev.key === 'string' ? ev.key : '';
  return key ? 'key:' + key + ':' + (ev.location || 0) : '';
}
function setHeldKey(source, key) {
  if (!source || !key) return;
  heldKeys.set(source, key);
  K[key] = 1;
}
function releaseHeldKey(ev) {
  const source = keySource(ev);
  let key = heldKeys.get(source);
  if (key) heldKeys.delete(source);
  else {
    key = gameKey(ev);
    if (key) {
      // code가 keydown/up 사이에 달라지는 일부 WebView에서는 같은 표준 키의 한 입력만 해제한다.
      const entry = [...heldKeys.entries()].find(([, value]) => value === key);
      if (entry) heldKeys.delete(entry[0]);
    }
  }
  if (key) K[key] = [...heldKeys.values()].some(value => value === key) ? 1 : 0;
  return key;
}
function togglePause() {
  if (S == 'play') {
    clearInput();
    S = 'pause';
    showOv();
  } else if (S == 'pause') {
    S = 'play';
    $('ov').style.display = 'none';
  }
}
function cycleFlap() {
  const [ok, label] = flapNext();
  if (ok) {
    p.flap = (p.flap + 1) % 3;
    msg('플랩 ' + label);
  } else rej('플랩 불가: ' + label);
}
window.addEventListener('keydown', ev => {
  if (ev.metaKey || ev.ctrlKey) return;
  // 글자 입력 칸(멀티 방 코드 등)에 치는 글자는 게임 조작이 아니다
  if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
  const k = gameKey(ev);
  if (!k) return;
  // 메뉴의 select/button은 브라우저 기본 키보드 조작(방향키/Enter)을 보존한다.
  if ((S === 'menu' || S === 'over') && ev.target && ['SELECT', 'BUTTON'].includes(ev.target.tagName)) return;
  const source = keySource(ev),
    alreadyDown = source && heldKeys.has(source);
  setHeldKey(source, k);
  ev.preventDefault();
  if (alreadyDown || ev.repeat) return;
  aud();
  if (AC && AC.state === 'suspended') AC.resume();
  if (k === 'Enter' && (S === 'menu' || S === 'over')) {
    start();
    return;
  }
  if (k === 'p' || k === 'Escape') {
    togglePause();
    return;
  }
  if (S !== 'play') return;
  switch (k) {
    case 'f':
      cycleFlap();
      break;
    case 'v':
      cameraMode = cameraMode === 'cockpit' ? 'external' : 'cockpit';
      chaseCamera.initialized = false;
      msg('카메라: ' + (cameraMode === 'cockpit' ? 'COCKPIT' : 'EXTERNAL'), '#9cf');
      break;
    case 'n':
      p.gearDown = !p.gearDown;
      p.mesh?.userData.setGear?.(p.gearDown);
      msg('착륙장치 ' + (p.gearDown ? 'DOWN' : 'UP'), p.gearDown ? '#9cf' : '#fa4');
      break;
    case 'o':
      computerPage = (computerPage + 1) % 5;
      msg('보조 컴퓨터: ' + ['FLIGHT', 'NAV', 'STATUS', 'MISSION', 'RECORD'][computerPage], '#9cf');
      break;
    case 'r':
      rd.on = !rd.on;
      if (!rd.on) {
        rd.ct = [];
        rd.lock = null;
        rd.sel = null;
      }
      msg('레이더 ' + (rd.on ? 'ON' : 'OFF'));
      break;
    case 't':
      if (!rd.on) rej('레이더 OFF');
      else {
        rd.mode = (rd.mode + 1) % 4;
        if (rd.mode !== 2) rd.lock = null;
        rd.ct.forEach(c => {
          c.tTrk = 0;
          if (rd.mode === 0) c.st = 'DET';
        });
        rd.q = { st: '', t: 0, c: null, w: 0 };
        msg('레이더 모드: ' + RM[rd.mode].n, '#9cf');
      }
      break;
    case 'y':
      tryLock();
      break;
    case 'Tab':
      if (!rd.ct.length) rej('선택 가능한 접촉 없음');
      else {
        rd.sel = rd.ct[(rd.ct.indexOf(rd.sel) + 1) % rd.ct.length];
        msg('표적 선택 (락 아님)');
      }
      break;
    case 'h':
      sk.on = !sk.on;
      sk.st = sk.on ? 'SEARCH' : 'OFF';
      sk.tg = null;
      msg('IR 시커 자동탐색 ' + (sk.on ? 'ON' : 'OFF'));
      break;
    case '1':
      p.sel = 'SARH';
      msg('무장: 레이더 유도 (SARH)');
      break;
    case '2':
      p.sel = 'IR';
      if (!sk.on) {
        sk.on = 1;
        sk.st = 'SEARCH';
      }
      msg('무장: 열추적 (IR) — 시커 자동 탐색 ON');
      break;
    case ' ': {
      const [ok, reason] = canFire();
      if (!ok) rej('발사 불가: ' + reason);
      else fire(p, p.sel, p.sel === 'SARH' ? rd.lock.tg : sk.st === 'LOCKED' ? sk.tg : null);
      break;
    }
    case 'm':
      hmd.on = !hmd.on;
      hmd.az = hmd.el = 0;
      msg('HMD ' + (hmd.on ? 'ON — I/J/K/L 로 시커 조준' : 'OFF'), '#9cf');
      break;
    case 'u':
      hmd.az = hmd.el = 0;
      break;
    case 'b':
      showHB = !showHB;
      es.forEach(x => (x.viz.visible = !!showHB));
      msg('히트박스 표시 ' + (showHB ? 'ON' : 'OFF'));
      break;
    case 'g':
      if (p.gun <= 0) rej('기총 탄약 없음');
      break;
    case 'x':
      if (!flare(p)) rej('플레어 없음');
      break;
    case 'c':
      if (!chaff(p)) rej('채프 없음'); // chaff() 가 이미 효과음을 낸다 (중복 재생 제거)
      break;
  }
});
window.addEventListener('keyup', ev => {
  const k = releaseHeldKey(ev);
  if (k) ev.preventDefault();
});
window.addEventListener('blur', () => {
  clearInput();
  if (S === 'play') {
    S = 'pause';
    showOv();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInput();
    if (S === 'play') {
      S = 'pause';
      showOv();
    }
  }
});
function setGameMode(mode) {
  if (S !== 'menu' && S !== 'over') return;
  activeMode = mode === 'AIRBASE' ? 'AIRBASE' : 'CARRIER';
  activeMission = defaultMission(activeMode);
  showOv();
}
function setMission(id) {
  if (S !== 'menu' && S !== 'over') return;
  const m = MISSIONS[id];
  if (!m || m.env !== (activeMode === 'AIRBASE' ? 'AIRBASE' : 'CARRIER') || isLocked(id)) return;
  activeMission = id;
  lastMission[m.env] = id;
  showOv();
}
function returnToMenu() {
  clearInput();
  S = 'menu';
  showOv();
}
function start() {
  // 선택 상태(activeMission)만 신뢰한다. 숨겨진 #ov 의 오래된 select 값에 영향받지 않게 한다.
  const env = activeMode === 'AIRBASE' ? 'AIRBASE' : 'CARRIER',
    m = MISSIONS[activeMission];
  activeMission = m && m.env === env && !isLocked(m.id) ? m.id : defaultMission(env);
  activeMode = curM().env === 'AIRBASE' ? 'AIRBASE' : 'CARRIER';
  lastMission[activeMode] = activeMission;
  init();
  S = 'play';
  $('ov').style.display = 'none';
}
function nextMission() {
  const id = nextMissionId();
  if (id) {
    activeMission = id;
    if (!curM().campaign) lastMission[curM().env] = id;
    start();
  }
}
function resultHtml() {
  const M = curM(),
    r = missionResult,
    rec = r.rec || {},
    nx = nextMissionId(),
    unl = Object.values(MISSIONS).filter(m => m.requires === M.id && rec.first);
  return `<section style="margin:12px 0;padding:11px;border:1px solid #28543a;background:#081810"><b>DEBRIEFING · ${M.label} ${M.title}</b>
 <div style="font-size:16px;color:${missionFailed ? '#ff8b7a' : '#52ffc0'};margin:6px 0">${missionFailed ? 'MISSION FAILED' : 'MISSION COMPLETE'}</div><div style="font-size:34px;color:#ffd36b;margin:6px 0">RANK ${r.rank}</div>
 <table>${r.lines.map(l => `<tr><td>${l[0]}</td><td><b>${l[1]}</b></td></tr>`).join('')}</table>
 ${rec.first ? '<p style="color:#52ffc0">FIRST CLEAR</p>' : rec.better ? '<p style="color:#52ffc0">NEW BEST</p>' : ''}
 ${PROG.d[M.id] ? `<p style="color:#9aafa2">BEST ★${PROG.d[M.id].rank} · ${PROG.d[M.id].score}pt · ${fmtTime(PROG.d[M.id].time || 0)}</p>` : ''}
 ${unl.map(m => `<p style="color:#ffd36b">UNLOCKED — ${m.label} ${m.title}</p>`).join('')}
 ${((r.camp && r.camp.unlocked) || [])
   .map(id => {
     const e = campEntry(id);
     return e && campRevealed(e) ? `<p style="color:#ffd36b">CAMPAIGN UNLOCKED — ${e.label} ${e.title.en}</p>` : '';
   })
   .join('')}</section>`;
}
function showOv() {
  const o = $('ov');
  o.style.display = 'flex';
  const [fo, fr] = canFire(),
    fn = flapNext();
  const menuVisible = S === 'menu' || S === 'over';
  const modeInfo =
    activeMode === 'AIRBASE'
      ? 'AIRBASE 29 — 지상 비행장 기반 훈련. MiG-29 9.12로 이륙·접근·착륙 훈련을 수행합니다.'
      : 'LEGACY CARRIER — 기존 항모 발진·착함 및 웨이브형 아케이드 전투를 유지하는 클래식 모드입니다.';
  const keys = [
    ['↑ ↓', '기수 상승/하강'],
    ['← →', '좌우 롤'],
    ['A D', '좌우 요'],
    ['W S', '추력 증가/감소'],
    ['Shift', activeMode === 'AIRBASE' ? '이륙 활주 시작 (이륙 임무)' : 'LEGACY: 애프터버너 / 갑판 발진'],
    ['비행장 착륙', '활주로 접근 회랑에서 기어·플랩 자동 · 양방향 착륙 가능 · 완만하게 접지'],
    ['F', '플랩 UP→MID→FULL'],
    ['N', '착륙장치 올리기/내리기'],
    ['V', '콕핏 / 부드러운 추적 외부 카메라 전환'],
    ['O', '보조 컴퓨터 화면 전환'],
    ['R', '레이더 전원'],
    ['T', '레이더 모드 순환'],
    ['Y', '선택 표적 락 설정/해제'],
    ['Tab', '표적 선택'],
    ['H', 'IR 시커 자동 탐색'],
    ['1 / 2', 'SARH / IR 선택'],
    ['Space', '발사'],
    ['G', '기총'],
    ['M', 'HMD 켜기/끄기'],
    ['I J K L', 'HMD 시커 조준선 이동'],
    ['U', 'HMD 정면 복귀'],
    ['B', '히트박스 표시'],
    ['X / C', '플레어 / 채프'],
    ['P / Esc', '일시정지'],
    ['Enter', '출격 / 재시작'],
  ];
  const title = S == 'over' ? over : S == 'pause' ? '일시정지' : 'STEEL TEMPEST <span class="version">V15.0.0-alpha.1</span>';
  // 결과(디브리핑)와 버튼을 먼저 보여 주고, 모드 선택 · 조작 키 · 상태는 접어 둔다
  const debrief =
    S == 'over' && (isAirbase() || curM().campaign) && (missionComplete || missionFailed) && missionResult
      ? resultHtml()
      : '';
  let modes = '';
  if (menuVisible) {
    modes = `<section style="margin:12px 0;padding:11px;border:1px solid #28543a;background:#081810"><b>GAME MODE SELECT</b><p style="margin:5px 0 8px;color:#9aafa2">플레이할 게임 모드를 먼저 선택하십시오. 모드를 바꾸면 해당 모드의 기본 임무와 환경이 자동으로 설정됩니다.</p><select id="gameModeSelect" aria-label="Game mode" onchange="setGameMode(this.value)"><option value="CARRIER" ${activeMode === 'CARRIER' ? 'selected' : ''}>LEGACY CARRIER — 항모 전투 모드</option><option value="AIRBASE" ${activeMode === 'AIRBASE' ? 'selected' : ''}>AIRBASE 29 — 지상 비행장 모드</option></select><p style="margin:8px 0 0;color:#cfe">${modeInfo}</p></section>`;
    modes += `<p><b>MISSION SELECT</b><br><select id="missionSelect" aria-label="Mission select" onchange="setMission(this.value)">${missionsOf(
      activeMode === 'AIRBASE' ? 'AIRBASE' : 'CARRIER'
    )
      .map(
        m =>
          `<option value="${m.id}" ${m.id === activeMission ? 'selected' : ''} ${isLocked(m.id) ? 'disabled' : ''}>${m.label} ${m.title}${isLocked(m.id) ? ' — 잠김 (' + MISSIONS[m.requires].label + ' 클리어 필요)' : PROG.d[m.id]?.rank ? ' — ★' + PROG.d[m.id].rank : ''}</option>`
      )
      .join('')}</select></p>`;
    modes +=
      activeMode === 'AIRBASE'
        ? `<p>${curM().label} ${curM().title} — ${curM().sub.ko}</p>`
        : `<p>LEGACY CARRIER · 기존 쿠즈네초프 항모 운용과 웨이브 전투를 즐길 수 있습니다. 항모 발진 → 전투 → 착함 보급 루프입니다 (공중 재보급 없음).</p>`;
  }
  const status =
    S != 'menu' && S != 'pause'
      ? `<p><b>상태</b><br>무장 ${p.sel} (SARH ${p.am.SARH} / IR ${p.am.IR}) · 기총 ${p.gun} · 플레어 ${p.fl} · 채프 ${p.ch}<br>레이더 ${rd.on ? RM[rd.mode].n + (rd.lock ? ' · LOCK' : '') : 'OFF'} · IR 시커 ${sk.st}<br>Space: ${fo ? '발사 가능' : '<span class=w>불가 — ' + fr + '</span>'}<br>F 플랩: ${fn[0] ? '가능 → ' + fn[1] : '<span class=w>불가 — ' + fn[1] + '</span>'}<br>Shift: ${isAirbase() ? (airbaseOps.phase === 'ready' ? '이륙 활주 시작' : '이미 활주 절차 중') : p.thr > 0.85 ? '가능' : '<span class=w>추력 85% 이상 필요</span>'}</p>`
      : '';
  const buttons =
    S === 'pause'
      ? `<button onclick="S='play';$('ov').style.display='none'">계속하기 (P)</button> <button style="background:#c8d8ce" onclick="returnToMenu()">모드 선택 / 메인 메뉴</button>`
      : `<button onclick="start()">${S == 'over' ? '다시 출격 (Enter)' : '출격 (Enter)'}</button>${S === 'over' && missionComplete && nextMissionId() ? ` <button style="background:#ffd36b" onclick="nextMission()">다음 임무 ▸ ${MISSIONS[nextMissionId()].label}</button>` : ''}${S === 'over' ? ` <button style="background:#c8d8ce" onclick="returnToMenu()">모드 / 임무 선택</button>` : ''}`;
  const keyTable = `<table>${keys.map(k => `<tr><td><b>${k[0]}</b></td><td>${k[1]}</td></tr>`).join('')}</table>`;
  const h =
    `<div><h1>${title}</h1>` +
    debrief +
    `<p class="ov-act">${buttons}</p>` +
    `<details class="ov-more"${debrief ? '' : ' open'}><summary>${[menuVisible ? '모드 · 임무 선택' : '', '조작 키', status ? '상태' : ''].filter(Boolean).join(' · ')}</summary>${modes}${keyTable}${status}</details>` +
    `<p style="color:#789;font-size:11px">수치는 모두 게임용 조정값이며 실제 기체·무장 성능이 아닙니다.</p></div>`;
  o.innerHTML = h;
}
