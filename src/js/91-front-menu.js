// ---------- 프런트 메뉴: 인트로 → 표지 → 설정(모드·임무 선택) → 브리핑
(() => {
  const $id = id => document.getElementById(id),
    front = $id('mallot-front');
  let stage = 'intro',
    lang = 'ko',
    mode = 'CARRIER',
    campPick = null;
  const tr = {
    ko: {
      settings: '임무 준비',
      lang: '01 / 언어 설정',
      mode: '02 / 게임 모드',
      carrier: '기존 항모 환경에서 시작하는 클래식 아케이드 모드.',
      airbase: '지상 비행장에서 시작하는 비행 훈련 모드.',
      campaign: '메인 캠페인 — 1999년 제3차 세계대전, 항모 ZARYA의 이야기.',
      pitchD: '↑ 상승 · ↓ 하강',
      rollD: '← 좌측 · → 우측',
      throttleD: 'W 증가 · S 감소',
      yawD: 'A 좌측 · D 우측',
      full: '상세 조작 안내',
      open: '키 가이드 열기 ▸',
      hint: '출격 전 설정을 확인하십시오',
      go: '출격',
      back: '표지로 돌아가기',
      flightKeys: '비행 조작',
      airframe: '기체 설정',
      system: '화면 및 시스템',
      updown: '기수 상승 / 하강',
      turn: '좌우 롤',
      yawDesc: '좌우 방향 조절',
      power: '추력 증가 / 감소',
      after: '애프터버너 / 모드별 이륙 활주 시작',
      flaps: '플랩 단계 변경',
      gear: '착륙장치 올리기 / 내리기',
      camera: '콕핏 / 외부 카메라 전환',
      computer: '보조 컴퓨터 화면 전환',
      pause: '일시정지 / 재개',
      close: '닫기',
      quick: '비행 조작 · 빠른 안내',
    },
    en: {
      settings: 'MISSION PREPARATION',
      lang: '01 / LANGUAGE',
      mode: '02 / GAME MODE',
      carrier: 'Classic arcade mode in the carrier environment.',
      airbase: 'Flight-training mode starting from a land airbase.',
      campaign: 'MAIN CAMPAIGN — World War III, 1999. The story of the carrier ZARYA.',
      pitchD: '↑ UP · ↓ DOWN',
      rollD: '← LEFT · → RIGHT',
      throttleD: 'W INCREASE · S DECREASE',
      yawD: 'A LEFT · D RIGHT',
      full: 'FULL CONTROL GUIDE',
      open: 'OPEN KEY GUIDE ▸',
      hint: 'CHECK YOUR SETTINGS BEFORE FLIGHT',
      go: 'GO',
      back: 'BACK TO COVER',
      flightKeys: 'FLIGHT CONTROLS',
      airframe: 'AIRFRAME',
      system: 'DISPLAY & SYSTEM',
      updown: 'Pitch up / down',
      turn: 'Roll left / right',
      yawDesc: 'Directional yaw control',
      power: 'Increase / decrease thrust',
      after: 'Afterburner / mode-specific takeoff roll',
      flaps: 'Cycle flap setting',
      gear: 'Landing gear up / down',
      camera: 'Cockpit / external camera',
      computer: 'Cycle auxiliary computer pages',
      pause: 'Pause / resume',
      close: 'CLOSE',
      quick: 'FLIGHT CONTROLS · QUICK VIEW',
    },
  };
  const ko = () => lang === 'ko';
  function paintMissions() {
    $id('mf-mission-field').classList.toggle('mf-camp', mode === 'CAMPAIGN');
    front.classList.toggle('mf-mode-camp', mode === 'CAMPAIGN');
    if (mode === 'CAMPAIGN') {
      paintCampaign();
      return;
    }
    const env = mode === 'AIRBASE' ? 'AIRBASE' : 'CARRIER',
      M = MISSIONS[activeMission];
    if (!M || M.env !== env) activeMission = defaultMission(env);
    $id('mf-mission-heading').textContent = ko() ? '임무 선택' : 'MISSION SELECT';
    $id('mf-mission-list').innerHTML = missionsOf(env)
      .map(m => {
        const lk = isLocked(m.id),
          pr = PROG.d[m.id];
        return `<button class="mf-btn mf-mission${m.id === activeMission ? ' selected' : ''}${lk ? ' locked' : ''}" data-mission="${m.id}" aria-disabled="${lk}"><span class="mm-id">${m.label}</span><span class="mm-t">${m.title}</span><span class="mm-r">${lk ? 'LOCKED' : pr && pr.rank ? '★' + pr.rank : ''}</span></button>`;
      })
      .join('');
    $id('mf-mission-note').textContent = MISSIONS[activeMission].sub[lang];
  }
  // ---------- 메인 캠페인 목록 (장별 임무 · 진행 · 코어 · Y2K)
  // 아직 안 만든 임무 안내: 임무마다 정해진 한 줄 (id 로 고르니 볼 때마다 바뀌지 않는다)
  const DEV_NAP = {
    ko: [
      '개발자가 낮잠 자느라 아직 못 만들었다. 깨우지 마시오.',
      '정비반장 왈: "이 임무는 아직 격납고에서 조립 중이다. 볼트가 모자라."',
      '기획서는 있다. 개발자가 커피를 다 마시면 시작한다.',
      '이 임무는 Y2K 보다 늦게 도착할 예정이다. 아마도.',
      '보급선이 아직 안 들어왔다. 이 임무도 같이 실려 오는 중.',
      '시공의 폭풍에 휩쓸려 이 임무 파일이 1941년으로 날아갔다.',
      '조종사는 준비됐다. 개발자는 아직 이불 속이다.',
    ],
    en: [
      'The developer is napping. Do not wake the developer.',
      'Crew chief says: "Still bolting this one together in the hangar. We ran out of bolts."',
      'The design doc exists. Work starts once the coffee is gone.',
      'This mission is scheduled to arrive after Y2K. Probably.',
      'The supply ship has not docked yet. This mission is on board.',
      'The time storm blew this mission file back to 1941.',
      'The pilot is ready. The developer is still under the blanket.',
    ],
  };
  function devNap(id) {
    const list = DEV_NAP[ko() ? 'ko' : 'en'];
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return list[h % list.length];
  }
  function campNote(id) {
    const e = campEntry(id);
    if (!e) return '';
    const L = lang;
    if (!campRevealed(e)) return '';
    let n = `${e.label} · ${e.sub[L]}`;
    if (!campAvailable(id)) {
      const pv = campPrev(id),
        pe = pv && campEntry(pv);
      n += pe ? (ko() ? ` — 잠김: 먼저 ${pe.label} 를 클리어하십시오.` : ` — LOCKED: clear ${pe.label} first.`) : '';
    } else if (!campReady(id)) n += ' — ' + devNap(id);
    return n;
  }
  function paintCampaign() {
    const L = lang,
      s = campState();
    if (!campPick || !campEntry(campPick) || !campAvailable(campPick)) campPick = campCurrent();
    if (campReady(campPick) && campAvailable(campPick)) activeMission = campPick;
    $id('mf-mission-heading').textContent = ko() ? '메인 캠페인' : 'MAIN CAMPAIGN';
    const pr = campProgress(),
      core = CAMP_CORE[s.core.state][L] + (s.core.state === 'REPAIRING' ? ' ' + s.core.repair + '%' : '');
    $id('mf-camp-status').innerHTML =
      `<span>${ko() ? '진행' : 'PROGRESS'} <b>${pr.done}/${pr.total}</b></span><span>${CAMPAIGN.coreName[L]} <b>${core}</b></span><span class="mf-camp-clock">${campClockText(s.clock)} · <b>${campY2KText(L)}</b></span>`;
    let h = '';
    for (const c of CAMPAIGN.chapters) {
      h += `<div class="mf-camp-ch">${c.label[L]}</div>`;
      let pend = false;
      for (const m of c.missions) {
        const e = { ...m, chapter: c.id };
        if (!campRevealed(e)) {
          if (campPending(e)) pend = true;
          continue;
        }
        const av = campAvailable(e.id),
          rd = campReady(e.id),
          rec = PROG.d[e.id];
        const st = !av
          ? 'LOCKED'
          : !rd
            ? ko()
              ? '개발자 낮잠 중'
              : 'DEV ASLEEP'
            : s.cleared[e.id]
              ? rec && rec.rank
                ? '★' + rec.rank
                : 'CLEAR'
              : ko()
                ? '출격 가능'
                : 'READY';
        h += `<button class="mf-btn mf-mission mf-camp-m${e.id === campPick ? ' selected' : ''}${av ? '' : ' locked'}${rd ? '' : ' dev'}" data-camp="${e.id}" aria-disabled="${!av}"><span class="mm-id">${e.label}</span><span class="mm-t">${e.title[L]}</span><span class="mm-r">${st}</span></button>`;
      }
      // 아직 정해지지 않은 길은 무엇이 있는지 알려주지 않고 한 줄로만 남긴다
      if (pend && !UNLOCK_ALL)
        h += `<div class="mf-btn mf-mission mf-camp-m locked mf-camp-hidden" aria-disabled="true"><span class="mm-id">${c.missions[0].label.split('-')[0]}-?</span><span class="mm-t">???</span><span class="mm-r">???</span></div>`;
    }
    $id('mf-mission-list').innerHTML = h;
    $id('mf-mission-note').textContent = campNote(campPick);
    $id('mf-camp-crawl').textContent = ko() ? '▶ 오프닝 보기' : '▶ OPENING';
    const rb = $id('mf-camp-reset');
    if (!rb.dataset.armed) rb.textContent = ko() ? '새 캠페인' : 'NEW CAMPAIGN';
    const sel = $id('mf-mission-list').querySelector('.selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }
  function pickCampaign(id) {
    const e = campEntry(id);
    if (!e) return;
    if (!campAvailable(id)) {
      $id('mf-mission-note').textContent = campNote(id);
      return;
    }
    campPick = id;
    paintCampaign();
  }
  function openCrawl(done) {
    playOpening(lang, () => {
      const s = campState();
      s.crawlSeen = true;
      s.started = true;
      campSave();
      if (stage === 'settings') paintMissions();
      if (done) done();
    });
  }
  function goCampaign() {
    const id = campPick || campCurrent();
    const launch = () => {
      if (campReady(id) && campAvailable(id)) {
        activeMission = id;
        activeMode = MISSIONS[id].env === 'AIRBASE' ? 'AIRBASE' : 'CARRIER';
        renderBrief();
        setStage('brief');
        return;
      }
      paintCampaign();
      $id('mf-mission-note').textContent = ko()
        ? '아직 출격할 수 있는 캠페인 임무가 없다 — 임무는 다음 개발 단계에서 추가된다.'
        : 'No campaign mission is flyable yet — missions arrive in the next build.';
    };
    if (!campState().crawlSeen) {
      openCrawl(launch);
      return;
    }
    launch();
  }
  function renderBrief() {
    const M = MISSIONS[activeMission],
      B = M.brief[lang],
      pr = PROG.d[M.id];
    $id('mf-brief-eyebrow').textContent = ko() ? '임무 브리핑' : 'MISSION BRIEFING';
    $id('mf-brief-title').textContent = M.label + ' · ' + M.title;
    $id('mf-brief-h1').textContent = ko() ? '임무 개요' : 'OVERVIEW';
    $id('mf-brief-h2').textContent = ko() ? '목표' : 'OBJECTIVES';
    $id('mf-brief-h3').textContent = ko() ? '비행 노트' : 'FLIGHT NOTES';
    $id('mf-brief-h4').textContent = ko() ? '기록' : 'RECORD';
    $id('mf-brief-sum').textContent = B.sum;
    const w = WEATHER[M.weather] || WEATHER.CLEAR,
      env = M.env === 'AIRBASE' ? 'AIRBASE 29' : 'CARRIER';
    $id('mf-brief-chips').innerHTML =
      `<span class="mf-chip">${ko() ? '분류' : 'TYPE'} <b>${M.category}</b></span><span class="mf-chip">${ko() ? '환경' : 'ENV'} <b>${env}</b></span><span class="mf-chip">${ko() ? '날씨' : 'WEATHER'} <b>${w[lang]}</b></span>` +
      (M.gates ? `<span class="mf-chip">${ko() ? '게이트' : 'GATES'} <b>${M.gates.length}</b></span>` : '') +
      (M.par ? `<span class="mf-chip">${ko() ? '목표 시간' : 'PAR'} <b>${fmtTime(M.par[0])}</b></span>` : '');
    if (M.campaign) {
      const c = campChapter(M.chapter);
      $id('mf-brief-chips').insertAdjacentHTML(
        'beforeend',
        `<span class="mf-chip">${ko() ? '캠페인' : 'CAMPAIGN'} <b>${c ? c.label[lang] : M.chapter}</b></span><span class="mf-chip">${ko() ? '시각' : 'TIME'} <b>${campClockText(campState().clock)}</b></span><span class="mf-chip mf-chip-y2k"><b>${campY2KText(lang)}</b></span>`
      );
    }
    $id('mf-brief-obj').innerHTML = B.obj.map(s => `<li>${s}</li>`).join('');
    $id('mf-brief-tips').innerHTML = B.tips.map(s => `<li>${s}</li>`).join('');
    $id('mf-brief-best').innerHTML =
      pr && pr.done
        ? `<span class="rk">★${pr.rank}</span>　${pr.score}pt${pr.time ? ' · ' + fmtTime(pr.time) : ''} · ${ko() ? '클리어 ' + (pr.plays || 1) + '회' : 'cleared ×' + (pr.plays || 1)}`
        : ko()
          ? '기록 없음'
          : 'No record yet';
    renderLoadout(M);
    $id('mf-brief-hint').textContent = ko() ? '출격 전 브리핑을 확인하십시오' : 'REVIEW THE BRIEFING BEFORE FLIGHT';
    $id('mf-brief-back').textContent = ko() ? '◂ 뒤로' : '◂ BACK';
    $id('mf-brief-launch').innerHTML = (ko() ? '출격' : 'LAUNCH') + ' <span aria-hidden="true">➜</span>';
    requestAnimationFrame(markBriefScroll);
  }
  // 브리핑 · 설정 칸이 넘치면 아래를 흐리게 해 더 읽을 내용이 있다는 걸 알린다 (칸 안에서 스크롤된다)
  const briefHooked = new WeakSet();
  function markPanelScroll(sel) {
    let any = false;
    document.querySelectorAll(sel).forEach(el => {
      const upd = () => {
        const more = el.scrollHeight - el.clientHeight - el.scrollTop > 6;
        el.classList.toggle('mf-more', more);
      };
      if (!briefHooked.has(el)) {
        briefHooked.add(el);
        el.addEventListener('scroll', upd, { passive: true });
      }
      el.scrollTop = 0;
      upd();
      any = any || el.scrollHeight - el.clientHeight > 6;
    });
    return any;
  }
  function markBriefScroll() {
    const any = markPanelScroll('#mf-brief .mf-panel');
    $id('mf-brief-hint').textContent = any
      ? ko()
        ? '브리핑 확인 · 칸 안에서 스크롤 ▾'
        : 'REVIEW BRIEFING · SCROLL IN PANEL ▾'
      : ko()
        ? '출격 전 브리핑을 확인하십시오'
        : 'REVIEW THE BRIEFING BEFORE FLIGHT';
  }
  // 출격 전 무장 구성 (캠페인 항모 임무). 1999년에는 함내 재고 제한이 없다 — 워프 뒤 보급 시스템이 붙는다.
  function renderLoadout(M) {
    const box = $id('mf-brief-load');
    box.hidden = !M.loadout;
    if (!M.loadout) return;
    $id('mf-brief-h5').textContent = ko() ? '탑재 무장' : 'LOADOUT';
    $id('mf-loadout-list').innerHTML = Object.entries(LOADOUTS)
      .map(
        ([k, L]) =>
          `<button class="mf-btn mf-loadout-b${k === loadoutPick ? ' selected' : ''}" data-load="${k}"><b>${L[lang]}</b><span>${L.note[lang]}</span></button>`
      )
      .join('');
    $id('mf-loadout-info').textContent = ko()
      ? '기총 500 · 플레어 30 · 채프 30  |  함내 재고: 제한 없음 (1999)'
      : 'GUN 500 · FLARE 30 · CHAFF 30  |  SHIP STOCK: UNLIMITED (1999)';
  }
  function setStage(next) {
    stage = next;
    document.querySelectorAll('#mallot-front .mf-screen').forEach(el => el.classList.remove('active'));
    const target = $id('mf-' + next);
    if (target) target.classList.add('active');
    if (next !== 'settings') $id('mf-guide-modal').classList.remove('open');
    if (next === 'settings') requestAnimationFrame(() => markPanelScroll('#mf-settings .mf-panel'));
  }
  // 키 가이드 그림: MiG-29 실루엣(위·옆·정면)을 기술 교범식 선화로 그린다. 색은 CSS(currentColor · --g-acc)가 정한다.
  function guideSvg(kind) {
    const id = 'gah-' + kind,
      defs = `<defs><marker id="${id}" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="acf"/></marker></defs>`,
      A = `marker-end="url(#${id})"`,
      AA = `marker-start="url(#${id})" marker-end="url(#${id})"`,
      frame =
        '<path class="gd" d="M2 12V2h10M116 2h10v10M126 72v10h-10M12 82H2V72"/>' +
        '<path class="gd" d="M64 6v4M64 74v4M6 42h4M118 42h4"/>',
      shell = body => `<svg viewBox="0 0 128 84" role="img" aria-hidden="true">${defs}${frame}${body}</svg>`;
    // 위에서 본 MiG-29 (기수 위) — 왼쪽 절반을 그리고 거울로 오른쪽을 만든다
    const topHalf =
      'M64 5L62.6 10L61.6 16L60.8 22Q58.5 30 52 38L28 55L28 59L50 57L50.5 63L38 71L38 74L51 72L52 79L58 79L58 76L64 76';
    const planeTop = (tf = '') =>
      `<g transform="${tf}"><path class="ln fl" d="${topHalf}"/><path class="ln fl" d="${topHalf}" transform="translate(128 0) scale(-1 1)"/>` +
      '<ellipse class="ln" cx="64" cy="19" rx="1.8" ry="5"/><path class="ln" d="M55.5 58L54 70M72.5 58L74 70"/>' +
      '<path class="gd" d="M64 26V70M52 38L50 57M76 38L78 57"/></g>';
    // 옆에서 본 MiG-29 (기수 오른쪽)
    const planeSide = (tf = '') =>
      `<g transform="${tf}"><path class="ln fl" d="M121 40L114 40Q106 37.5 98 36.5L92 35.5Q86 28 76 30L60 32L40 33L33 32.5L24 14L18 14L20 33.5L12 35L12 42L28 43L46 44.5L68 44.5L74 40.5L80 40L98 41Q108 41.5 114 40Z"/>` +
      '<path class="ln" d="M92 35.5L80 30.6M68 44.5L68 40.5L74 40.5M12 38.5L30 38.5M40 38.6L72 38.6"/>' +
      '<path class="gd" d="M22 20L26 32M60 32L60 44.5"/></g>';
    // 정면에서 본 MiG-29: 가운데 동체(레이돔·캐노피), 날개 아래 엔진 나셀 2개, 바깥으로 기운 쌍수직꼬리
    const planeFront = (tf = '') =>
      `<g transform="${tf}"><path class="ln fl" d="M52 41.5L12 44.5L12 46L52 44.5ZM76 41.5L116 44.5L116 46L76 44.5Z"/>` +
      '<path class="ln fl" d="M54 42L50 24L52.5 24L57 42ZM74 42L78 24L75.5 24L71 42Z"/>' +
      '<path class="ln" d="M52 48.5L36 51.5M76 48.5L92 51.5"/>' +
      '<rect class="ln fl" x="51.5" y="42" width="9" height="8" rx="2"/><rect class="ln fl" x="67.5" y="42" width="9" height="8" rx="2"/>' +
      '<path class="ln fl" d="M53.5 44.5h5v3.5h-5zM69.5 44.5h5v3.5h-5z"/>' +
      '<circle class="ln fl" cx="64" cy="40" r="3.6"/><path class="ln" d="M60.6 37.6Q64 30.5 67.4 37.6"/><path class="gd" d="M12 45.2H116"/></g>';
    const horizon = '<path class="gd" stroke-dasharray="3 3" d="M8 66H120"/>';
    const drawings = {
      pitch: shell(
        `${horizon}${planeSide('rotate(-11 64 40)')}<path class="ac" ${AA} d="M108 62A40 40 0 0 0 112 14"/>` +
          '<text class="tx" x="10" y="78">PITCH</text>'
      ),
      roll: shell(
        `<path class="gd" stroke-dasharray="3 3" d="M8 42H120"/>${planeFront('rotate(-18 64 42)')}<path class="ac" ${AA} d="M26 28A44 44 0 0 1 102 28"/>` +
          '<text class="tx" x="10" y="78">ROLL</text>'
      ),
      yaw: shell(
        `${planeTop('translate(64 47) scale(0.8) translate(-64 -42)')}<path class="ac" ${AA} d="M36 15Q64 -3 92 15"/>` +
          '<text class="tx" x="10" y="78">YAW</text>'
      ),
      throttle: shell(
        '<rect class="ln" x="54" y="8" width="20" height="68" rx="3"/><path class="ln" d="M64 14V70"/>' +
          '<path class="gd" d="M48 20h6M48 36h6M48 52h6M48 68h6"/>' +
          '<text class="tx" x="22" y="22">AB</text><text class="tx" x="20" y="38">MIL</text><text class="tx" x="16" y="70">IDLE</text>' +
          '<path class="ln fl" d="M50 30h28a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H50a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z"/><path class="ln" d="M54 34h20M54 38h20"/>' +
          `<path class="ac" ${AA} d="M98 16V66"/><text class="tx" x="102" y="20">W</text><text class="tx" x="102" y="68">S</text>`
      ),
      afterburner: shell(
        `${planeSide('translate(22 6) scale(0.82)')}<path class="acf" opacity="0.45" d="M32 34.5L2 38.6L32 42.7Z"/>` +
          '<path class="acf" d="M32 36.6L14 38.6L32 40.6Z"/>' +
          '<path class="ac" d="M27 36.6L23 38.6L27 40.6L31 38.6ZM18 37.2L15.5 38.6L18 40L20.5 38.6Z"/>' +
          '<path class="ac" stroke-dasharray="6 4" d="M44 14H120M56 66H120"/>'
      ),
      flaps: shell(
        '<path class="ln fl" d="M8 40Q12 30 30 28.5Q55 28 72 35L72 41Q52 45 30 46.5Q12 47 8 40Z"/>' +
          '<path class="ln fl" d="M72 35L102 38L72 41Z"/>' +
          '<path class="ln" stroke-dasharray="3 2" d="M72 35L100.2 48.3L71.5 41M72.5 35L95 57.3L71 41"/>' +
          `<path class="ac" ${A} d="M105 41A33 33 0 0 1 99 57"/>` +
          '<text class="tx" x="108" y="39">UP</text><text class="tx" x="106" y="53">MID</text><text class="tx" x="98" y="67">FULL</text>'
      ),
      gear: shell(
        `${planeSide('translate(0 -6)')}<path class="ln" d="M98 35V55M46 38.5V54M42 38.5L46 47"/>` +
          '<circle class="ln fl" cx="98" cy="59" r="4"/><circle class="ln fl" cx="46" cy="59" r="5"/>' +
          `${horizon.replace('M8 66', 'M8 64.5')}<path class="ac" ${AA} d="M116 30V58"/>`
      ),
      camera: shell(
        '<rect class="ln" x="8" y="14" width="46" height="46" rx="2"/><path class="ln" d="M8 36Q31 18 54 36M31 14V22"/>' +
          '<rect class="ln" x="23" y="38" width="16" height="12"/><path class="gd" d="M27 44h8M31 40v8"/>' +
          '<rect class="ln" x="74" y="14" width="46" height="46" rx="2"/>' +
          `${planeTop('translate(97 39) scale(0.42) translate(-64 -42)')}` +
          `<path class="ac" ${AA} d="M58 37H70"/><text class="tx" x="14" y="74">CKPT</text><text class="tx" x="84" y="74">EXT</text>`
      ),
      display: shell(
        '<rect class="ln fl" x="22" y="8" width="84" height="66" rx="4"/><rect class="ln" x="32" y="16" width="64" height="50"/>' +
          '<path class="gd" d="M26 22h4M26 32h4M26 42h4M26 52h4M98 22h4M98 32h4M98 42h4M98 52h4"/>' +
          '<path class="ln" d="M40 60A28 28 0 0 1 88 60M64 60L52 26"/><path class="gd" d="M46 60A20 20 0 0 1 82 60M64 60V32"/>' +
          '<circle class="acf" cx="75" cy="38" r="2"/><circle class="acf" cx="56" cy="44" r="1.6"/>'
      ),
      pause: shell(
        '<circle class="ln" cx="64" cy="42" r="28"/><rect class="acf" x="52" y="28" width="8" height="28" rx="1"/><rect class="acf" x="68" y="28" width="8" height="28" rx="1"/>'
      ),
    };
    return drawings[kind] || shell(planeTop());
  }
  function paintGuide() {
    const t = tr[lang],
      items = [
        ['pitch', t.updown, '↑ / ↓', t.pitchD],
        ['roll', t.turn, '← / →', t.rollD],
        ['yaw', t.yawDesc, 'A / D', t.yawD],
        ['throttle', t.power, 'W / S', t.throttleD],
        ['afterburner', lang === 'ko' ? '애프터버너 / 모드별 발진' : 'Afterburner / takeoff', 'SHIFT', t.after],
        ['flaps', t.flaps, 'F', lang === 'ko' ? 'UP → MID → FULL' : 'Cycle UP → MID → FULL'],
        ['gear', t.gear, 'N', t.gear],
        ['camera', t.camera, 'V', t.camera],
        ['display', t.computer, 'O', t.computer],
        ['pause', t.pause, 'P / ESC', t.pause],
      ];
    $id('mf-full-guide').innerHTML = items
      .map(
        a =>
          `<div class="mf-guide-item"><div class="mf-guide-drawing">${guideSvg(a[0])}</div><div><b>${a[1]}</b><p><span class="mf-keycap">${a[2]}</span>　${a[3]}</p></div></div>`
      )
      .join('');
  }
  function render() {
    const t = tr[lang];
    $id('mf-settings-title').textContent = t.settings;
    $id('mf-language-heading').textContent = t.lang;
    $id('mf-mode-heading').textContent = t.mode;
    $id('mf-mode-note').textContent = mode === 'CAMPAIGN' ? t.campaign : mode === 'AIRBASE' ? t.airbase : t.carrier;
    $id('mf-go-hint').textContent = t.hint;
    $id('mf-go').innerHTML = (lang === 'ko' ? '출격' : 'GO') + ' <span aria-hidden="true">➜</span>';
    $id('mf-open-guide').textContent = t.open;
    $id('mf-guide-modal-title').textContent = t.full;
    $id('mf-close-guide').textContent = t.close;
    $id('mf-lang-ko').classList.toggle('selected', lang === 'ko');
    $id('mf-lang-en').classList.toggle('selected', lang === 'en');
    $id('mf-mode-campaign').classList.toggle('selected', mode === 'CAMPAIGN');
    $id('mf-mode-carrier').classList.toggle('selected', mode === 'CARRIER');
    $id('mf-mode-airbase').classList.toggle('selected', mode === 'AIRBASE');
    paintGuide();
    paintMissions();
    requestAnimationFrame(() => markPanelScroll('#mf-settings .mf-panel'));
  }
  function showFront() {
    if (mode === 'CAMPAIGN') campPick = null;
    front.style.display = 'block';
    $id('ov').style.display = 'none';
    if (stage === 'brief') stage = 'settings';
    paintMissions();
    setStage(stage);
  }
  function hideFront() {
    front.style.display = 'none';
    $id('mf-guide-modal').classList.remove('open');
  }
  $id('mf-enter-intro').addEventListener('click', () => setStage('cover'));
  $id('mf-start').addEventListener('click', () => {
    setStage('settings');
    render();
  });
  $id('mf-lang-ko').addEventListener('click', () => {
    lang = 'ko';
    render();
  });
  $id('mf-lang-en').addEventListener('click', () => {
    lang = 'en';
    render();
  });
  $id('mf-mode-campaign').addEventListener('click', () => {
    mode = 'CAMPAIGN';
    campPick = null;
    render();
  });
  $id('mf-mode-carrier').addEventListener('click', () => {
    mode = 'CARRIER';
    activeMode = 'CARRIER';
    activeMission = defaultMission('CARRIER');
    render();
  });
  $id('mf-mode-airbase').addEventListener('click', () => {
    mode = 'AIRBASE';
    activeMode = 'AIRBASE';
    activeMission = defaultMission('AIRBASE');
    render();
  });
  $id('mf-open-guide').addEventListener('click', () => {
    $id('mf-guide-modal').classList.add('open');
  });
  $id('mf-close-guide').addEventListener('click', () => {
    $id('mf-guide-modal').classList.remove('open');
  });
  $id('mf-guide-modal').addEventListener('click', e => {
    if (e.target === $id('mf-guide-modal')) $id('mf-guide-modal').classList.remove('open');
  });
  $id('mf-go').addEventListener('click', () => {
    if (mode === 'CAMPAIGN') {
      goCampaign();
      return;
    }
    activeMode = mode;
    const m = MISSIONS[activeMission];
    if (!m || m.env !== mode || isLocked(m.id)) activeMission = defaultMission(mode);
    renderBrief();
    setStage('brief');
  });
  $id('mf-brief-back').addEventListener('click', () => setStage('settings'));
  $id('mf-loadout-list').addEventListener('click', e => {
    const b = e.target.closest('[data-load]');
    if (!b || !LOADOUTS[b.dataset.load]) return;
    loadoutPick = b.dataset.load;
    renderLoadout(MISSIONS[activeMission]);
  });
  $id('mf-brief-launch').addEventListener('click', () => {
    hideFront();
    start();
  });
  $id('mf-mission-list').addEventListener('click', e => {
    const c = e.target.closest('[data-camp]');
    if (c) {
      pickCampaign(c.dataset.camp);
      return;
    }
    const b = e.target.closest('[data-mission]');
    if (!b) return;
    const id = b.dataset.mission,
      m = MISSIONS[id];
    if (isLocked(id)) {
      $id('mf-mission-note').textContent =
        (lang === 'ko' ? '잠김 — 먼저 ' : 'LOCKED — clear ') +
        MISSIONS[m.requires].label +
        (lang === 'ko' ? ' 를 클리어하십시오.' : ' first.');
      return;
    }
    activeMission = id;
    lastMission[m.env] = id;
    paintMissions();
  });
  $id('mf-camp-crawl').addEventListener('click', () => openCrawl());
  $id('mf-camp-reset').addEventListener('click', () => {
    const b = $id('mf-camp-reset');
    if (!b.dataset.armed) {
      b.dataset.armed = '1';
      b.classList.add('armed');
      b.textContent = ko() ? '정말 초기화? 다시 누르기' : 'RESET? PRESS AGAIN';
      clearTimeout(b._t);
      b._t = setTimeout(() => {
        delete b.dataset.armed;
        b.classList.remove('armed');
        paintMissions();
      }, 4000);
      return;
    }
    clearTimeout(b._t);
    delete b.dataset.armed;
    b.classList.remove('armed');
    campReset();
    campPick = null;
    paintMissions();
    $id('mf-mission-note').textContent = ko()
      ? '새 캠페인을 시작했다. 임무별 최고 기록은 그대로 남는다.'
      : 'New campaign started. Best records per mission are kept.';
  });
  // Replace only the initial menu presentation. The original green pause/debrief overlay stays intact.
  const previousShowOv = showOv;
  showOv = function () {
    if (S === 'menu') {
      showFront();
      return;
    }
    hideFront();
    previousShowOv();
  };
  // Cover/settings navigation by keyboard. Stop the legacy Enter-to-start shortcut while the front-end is open.
  window.addEventListener(
    'keydown',
    ev => {
      if (front.style.display !== 'block' || window.__stOpeningOpen) return;
      if (ev.key === 'Escape') {
        if ($id('mf-guide-modal').classList.contains('open')) $id('mf-guide-modal').classList.remove('open');
        else if (stage === 'brief') setStage('settings');
        else if (stage === 'settings') setStage('cover');
        else if (stage === 'cover') setStage('intro');
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
      if (ev.key === 'Enter') {
        if (stage === 'intro') setStage('cover');
        else if (stage === 'cover') $id('mf-start').click();
        else if (stage === 'settings' && !$id('mf-guide-modal').classList.contains('open')) $id('mf-go').click();
        else if (stage === 'brief') $id('mf-brief-launch').click();
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
    },
    true
  );
  render();
  // Initial boot begins with the MALLOT mark; no automatic start into the simulation.
  setStage('intro');
  window.setTimeout(() => {
    if (stage === 'intro') setStage('cover');
  }, 3900);
})();
