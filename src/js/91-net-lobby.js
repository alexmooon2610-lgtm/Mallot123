// ---------- 멀티플레이 로비 (V15 기틀): 설정 화면의 MULTI PLAYER 버튼 → 방 만들기 / 코드로 참가 / 출격
// 방장이 출격을 누르면 NET 'start' 가 모두에게 가고, 받은 쪽은 저마다 VERSUS 임무를 시작한다 (20-mission-versus).
(() => {
  const $id = id => document.getElementById(id),
    front = $id('mallot-front'),
    btn = $id('mf-mode-multi');
  if (!btn) return;
  const box = document.createElement('div');
  box.className = 'mf-modal';
  box.id = 'mf-net-modal';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `
    <div class="mf-modal-card mf-net">
      <div class="mf-modal-title"><h3>MULTIPLAYER · 1대1 대전 <small>ALPHA</small></h3>
        <button class="mf-btn" id="mf-net-close">닫기 ✕</button></div>
      <p class="mf-net-note">친구와 방 코드로 연결한다. 연결 중개는 무료 공용 서버(PeerJS)를 쓰고, 게임 데이터는 두 사람이 직접 주고받는다.
        <b>알파</b>: 서로의 비행이 보이는 단계다. 무장 명중 판정은 다음 단계에서 들어간다.</p>
      <div class="mf-net-grid">
        <section>
          <h4>방 만들기</h4>
          <button class="mf-btn" id="mf-net-host">방 만들기</button>
          <div class="mf-net-code" id="mf-net-code">— — — — — —</div>
          <p class="mf-net-sub" id="mf-net-codehint">방을 만들면 코드가 나온다. 상대에게 알려 줘라.</p>
        </section>
        <section>
          <h4>코드로 참가</h4>
          <input id="mf-net-input" maxlength="6" placeholder="ABC234" autocomplete="off" spellcheck="false" />
          <button class="mf-btn" id="mf-net-join">참가</button>
          <p class="mf-net-sub">방장이 출격을 누르면 시작한다.</p>
        </section>
      </div>
      <div class="mf-net-roster" id="mf-net-roster"></div>
      <div class="mf-net-status" id="mf-net-status">대기</div>
      <div class="mf-go-row"><button class="mf-btn" id="mf-net-leave">방 나가기</button>
        <button class="mf-btn mf-go" id="mf-net-go" disabled>출격 <span aria-hidden="true">➜</span></button></div>
    </div>`;
  front.appendChild(box);
  const status = (s, bad) => {
    $id('mf-net-status').textContent = s;
    $id('mf-net-status').classList.toggle('bad', !!bad);
  };
  function paint() {
    const st = NET.st;
    $id('mf-net-code').textContent = st.role === 'host' && st.code ? st.code : '— — — — — —';
    $id('mf-net-codehint').textContent =
      st.role === 'host' && st.code
        ? '이 코드를 상대에게 알려 줘라. 들어오면 아래에 보인다.'
        : '방을 만들면 코드가 나온다. 상대에게 알려 줘라.';
    $id('mf-net-roster').innerHTML = st.roster.length
      ? st.roster
          .map(
            r =>
              `<span class="mf-chip${r.slot === st.slot ? ' me' : ''}">${r.slot === 0 ? '방장' : '참가자'} ${r.slot}${r.slot === st.slot ? ' (나)' : ''}</span>`,
          )
          .join('') + (st.rtt ? `<span class="mf-chip">핑 ${Math.round(st.rtt)} ms</span>` : '')
      : '';
    $id('mf-net-go').disabled = !(st.role === 'host' && st.status === 'open' && st.roster.length >= 2);
    $id('mf-net-go').style.display = st.role === 'client' ? 'none' : '';
    $id('mf-net-host').disabled = st.status === 'connecting';
    $id('mf-net-join').disabled = st.status === 'connecting';
  }
  const waited = () => (NET.st.since ? Math.floor((Date.now() - NET.st.since) / 1000) + '초' : '');
  NET.on('status', st => {
    if (st.status === 'connecting')
      status(
        st.role === 'host'
          ? `방 만드는 중… ${waited()} (중개 서버 접속 — 보통 몇 초, 길면 20초)`
          : `${st.code} 방에 접속하는 중… ${waited()}`,
      );
    else if (st.status === 'open')
      status(
        st.role === 'host' ? '방 열림 — 상대를 기다리는 중' : `${st.code} 방에 들어왔다 — 방장이 출격하길 기다리는 중`,
      );
    else if (st.status === 'error' || st.status === 'closed') status(st.error || '연결 실패', true);
    paint();
  });
  NET.on('roster', () => {
    paint();
    if (NET.st.role === 'host' && NET.st.roster.length >= 2) status('상대가 들어왔다 — 출격을 누르면 시작한다');
  });
  NET.on('msg', m => {
    if (m.t !== 'start') return;
    // 판 시작: 메뉴를 닫고 VERSUS 임무로
    box.classList.remove('open');
    front.style.display = 'none';
    activeMode = 'CARRIER';
    activeMission = 'VERSUS';
    start();
  });
  // 1초마다: 핑 표시 · 연결 중이면 기다린 시간
  const waitMsg = () =>
    NET.st.role === 'host'
      ? `방 만드는 중… ${waited()} (중개 서버 접속 — 보통 몇 초, 길면 20초)`
      : `${NET.st.code} 방에 접속하는 중… ${waited()}`;
  setInterval(() => {
    if (!box.classList.contains('open')) return;
    paint();
    if (NET.st.status === 'connecting') status(waitMsg());
  }, 1000);
  btn.addEventListener('click', () => {
    box.classList.add('open');
    paint();
    // 멀티가 막힌 환경(claude.ai 링크 등)이면 열자마자 알려 준다
    const env = /[?&]net=relay/.test(location.search) ? '' : NET.envProblem();
    if (env && NET.st.status === 'idle') status(env, true);
  });
  $id('mf-net-close').addEventListener('click', () => box.classList.remove('open'));
  $id('mf-net-host').addEventListener('click', () => NET.host());
  $id('mf-net-join').addEventListener('click', () => NET.join($id('mf-net-input').value));
  $id('mf-net-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') NET.join($id('mf-net-input').value);
    if (e.key === 'Escape') box.classList.remove('open');
  });
  $id('mf-net-input').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  $id('mf-net-leave').addEventListener('click', () => {
    NET.leave();
    status('방에서 나왔다');
    paint();
  });
  $id('mf-net-go').addEventListener('click', () => NET.startMatch({ mode: 'VERSUS' }));
  // 판이 끝나 메뉴로 돌아오면 연결은 그대로 두되 '시작함' 표시를 풀어 다시 출격할 수 있게 한다
  const prevReturn = returnToMenu;
  returnToMenu = function () {
    if (activeMission === 'VERSUS') {
      NET.st.started = false;
      activeMission = defaultMission('CARRIER');
    }
    prevReturn();
  };
})();
