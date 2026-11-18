// ===== 멀티플레이 전송 계층 (V15 기틀) — 설계: docs/MULTIPLAYER.md =====
// 방장 중심 별 모양: 방장이 방 코드를 만들고, 참가자(최대 3명)는 방장에게만 연결한다. 방장이 메시지를 중계한다.
// 게임 코드에 의존하지 않는다. 게임은 NET.on(...) 으로 사건을 받고 NET.send(...) 로 보낸다.
// 전송 수단:
//   peer  — PeerJS (WebRTC 데이터 채널). 라이브러리는 멀티 메뉴를 쓸 때만 CDN 에서 불러온다.
//   relay — 시험용. 주소에 ?net=relay 를 붙이면 검사 하네스가 메시지를 직접 날라 준다 (tools/harness/nettest.py).
// 판정 난수(rnd)는 쓰지 않는다 — 방 코드는 crypto 로 만든다.
const NET_PROTO = 1, // 통신 규약 버전. 바꾸면 서로 다른 버전끼리는 접속을 거절한다
  NET_MAX = 4, // 방장 포함 최대 인원
  NET_PREFIX = 'steeltempest-v1-',
  NET_TIMEOUT = 3000, // 이 시간(ms) 동안 아무것도 안 오면 끊긴 것으로 본다
  NET_SIGNAL_WAIT = 20000, // 중개 서버(PeerJS) 접속을 기다리는 최대 시간 (ms)
  NET_LINK_WAIT = 15000, // 참가자: 중개 서버 접속 뒤 방장과 직접 연결(WebRTC)되기까지 기다리는 최대 시간 (ms)
  PEERJS_URL = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';

const NET = (() => {
  const st = {
    role: null, // 'host' | 'client' | null
    code: '',
    slot: -1, // 내 자리: 0 방장, 1~3 참가자
    status: 'idle', // idle · connecting · open · error · closed
    error: '',
    roster: [], // [{ slot, name }]
    peers: new Map(), // 전송 아이디 → { slot, last, rtt, hello }
    started: false,
    rtt: 0,
    since: 0, // 연결을 시작한 시각 (Date.now) — 로비가 기다린 시간을 보여 준다
    welcomed: false, // 참가자: 방장과 실제로 연결된 적이 있는가 (끊김 · 처음부터 실패 구분)
  };
  // 이 실행 환경에서 멀티가 막혀 있는지 미리 본다. claude.ai 링크(아티팩트)는 바깥 웹소켓과 WebRTC 를 막는다.
  function envProblem() {
    let inFrame = false;
    try {
      inFrame = window.self !== window.top;
    } catch (e) {
      inFrame = true;
    }
    const host = (location.hostname || '') + ' ' + (document.referrer || '');
    if (inFrame && /claude|anthropic/i.test(host))
      return 'claude.ai 링크(아티팩트)에서는 멀티가 막혀 있다 — 게임 파일을 내려받아 브라우저로 직접 열어라';
    if (typeof RTCPeerConnection === 'undefined')
      return '이 브라우저(또는 실행 환경)는 WebRTC 를 쓸 수 없다 — 크롬 · 엣지 · 파이어폭스 최신판으로 열어라';
    return '';
  }
  // PeerJS 오류 종류 → 사람 말
  const peerErr = t =>
    ({
      'browser-incompatible': '이 브라우저는 WebRTC 를 쓸 수 없다',
      network: '중개 서버에 연결하지 못했다 — 인터넷 연결을 확인하라',
      'server-error': '중개 서버(PeerJS) 오류 — 잠시 뒤 다시 해 봐라',
      'socket-error': '중개 서버 연결이 끊겼다',
      'socket-closed': '중개 서버 연결이 끊겼다',
      'peer-unavailable': '방을 찾을 수 없다 — 코드를 확인하라 (방장이 방을 닫았을 수도 있다)',
      webrtc: '상대와 직접 연결하지 못했다 (WebRTC)',
    })[t] || String(t);
  // 약속(promise)에 시간 제한
  const timed = (pr, ms, why) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(why)), ms))]);
  let linkTimer = 0;
  const handlers = {};
  let tr = null,
    pingT = 0;
  const now = () => performance.now();
  const emit = (type, ...a) => (handlers[type] || []).forEach(fn => fn(...a));
  const on = (type, fn) => (handlers[type] = handlers[type] || []).push(fn);
  const build = () => {
    const m = document.title.match(/V\d+\.\d+\.\d+\S*/);
    return m ? m[0] : 'dev';
  };
  // 헷갈리는 글자(0 O 1 I L)를 뺀 6자리
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function makeCode() {
    const b = new Uint8Array(6);
    crypto.getRandomValues(b);
    return [...b].map(x => ALPHA[x % ALPHA.length]).join('');
  }
  const cleanCode = s =>
    String(s || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);

  // ---------- 전송 수단: PeerJS
  function peerTransport() {
    let peer = null;
    const conns = new Map();
    const load = () =>
      window.Peer
        ? Promise.resolve()
        : new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = PEERJS_URL;
            s.onload = () => res();
            s.onerror = () => rej(new Error('PeerJS 를 불러오지 못했다 — 인터넷 연결을 확인하라'));
            document.head.appendChild(s);
          });
    const wire = (c, h) => {
      c.on('open', () => {
        conns.set(c.peer, c);
        h.open(c.peer);
      });
      c.on('data', d => h.data(c.peer, d));
      c.on('close', () => {
        conns.delete(c.peer);
        h.close(c.peer);
      });
      c.on('error', () => {
        conns.delete(c.peer);
        h.close(c.peer);
      });
    };
    return {
      async host(code, h) {
        await load();
        await new Promise((res, rej) => {
          peer = new window.Peer(NET_PREFIX + code, { debug: 0 });
          peer.on('open', () => res());
          peer.on('error', e => rej(new Error(e.type === 'unavailable-id' ? 'ID_TAKEN' : peerErr(e.type || e))));
          peer.on('connection', c => wire(c, h));
        });
        peer.on('error', e => h.error(peerErr(e.type || e)));
      },
      async join(code, h) {
        await load();
        await new Promise((res, rej) => {
          peer = new window.Peer(undefined, { debug: 0 });
          peer.on('open', () => res());
          peer.on('error', e => rej(new Error(peerErr(e.type || e))));
        });
        peer.on('error', e => h.error(peerErr(e.type || e)));
        // 1단계는 신뢰 연결 하나로 모든 메시지를 보낸다 (순서 보장). 상태 전송용 비신뢰 채널은 나중에 나눈다.
        wire(peer.connect(NET_PREFIX + code, { reliable: true, serialization: 'json' }), h);
      },
      send(to, msg) {
        const c = conns.get(to);
        if (c && c.open) c.send(msg);
      },
      close() {
        conns.forEach(c => c.close());
        conns.clear();
        if (peer) peer.destroy();
        peer = null;
      },
    };
  }
  // ---------- 전송 수단: 시험용 relay (하네스가 window.__relay* 를 넣어 준다)
  function relayTransport() {
    let h = null;
    window.__netDeliver = (from, kind, data) => {
      if (!h) return;
      if (kind === 'open') h.open(from);
      else if (kind === 'data') h.data(from, JSON.parse(data));
      else if (kind === 'close') h.close(from);
    };
    return {
      async host(code, hh) {
        h = hh;
        await window.__relayCtl('host', code);
      },
      async join(code, hh) {
        h = hh;
        await window.__relayCtl('join', code);
      },
      send(to, msg) {
        window.__relaySend(to, JSON.stringify(msg));
      },
      close() {
        window.__relayCtl('close', '');
        h = null;
      },
    };
  }
  const pickTransport = () => (/[?&]net=relay/.test(location.search) ? relayTransport() : peerTransport());

  // ---------- 방장 쪽
  const freeSlot = () => {
    for (let s = 1; s < NET_MAX; s++) if (![...st.peers.values()].some(q => q.slot === s)) return s;
    return -1;
  };
  function sendRoster() {
    st.roster = [{ slot: 0 }, ...[...st.peers.values()].filter(q => q.slot > 0).map(q => ({ slot: q.slot }))].sort(
      (a, b) => a.slot - b.slot,
    );
    for (const id of st.peers.keys()) tr.send(id, { t: 'roster', players: st.roster });
    emit('roster', st.roster);
  }
  const hostHandlers = {
    open(id) {
      st.peers.set(id, { slot: -1, last: now(), rtt: 0, hello: false });
    },
    data(id, m) {
      const q = st.peers.get(id);
      if (!q) return;
      q.last = now();
      if (m.t === 'hello') {
        const why =
          m.v !== NET_PROTO
            ? `통신 규약이 다르다 (방 ${NET_PROTO} · 참가자 ${m.v}) — 같은 버전으로 접속하라`
            : st.started
              ? '이미 시작한 판이다'
              : freeSlot() < 0
                ? `방이 가득 찼다 (${NET_MAX}명)`
                : '';
        if (why) {
          tr.send(id, { t: 'reject', why });
          return;
        }
        q.slot = freeSlot();
        q.hello = true;
        tr.send(id, { t: 'welcome', slot: q.slot, v: NET_PROTO, build: build() });
        sendRoster();
        emit('joined', q.slot);
        return;
      }
      if (!q.hello) return;
      if (m.t === 'ping') return tr.send(id, { t: 'pong', a: m.a, b: now() });
      if (m.t === 'pong') {
        q.rtt = now() - m.a;
        return;
      }
      if (m.t === 'bye') return hostHandlers.close(id);
      // 그 밖의 메시지는 보낸 자리를 붙여 다른 참가자에게 중계하고, 나도 받는다
      m.from = q.slot;
      for (const [oid, o] of st.peers) if (oid !== id && o.hello) tr.send(oid, m);
      emit('msg', m);
    },
    close(id) {
      const q = st.peers.get(id);
      if (!q) return;
      st.peers.delete(id);
      if (q.hello) {
        sendRoster();
        emit('left', q.slot);
      }
    },
    error(e) {
      st.error = String(e);
      emit('status', st);
    },
  };
  // ---------- 참가자 쪽 (상대는 방장 한 명: 아이디 'host' 대신 실제 아이디를 그대로 쓴다)
  let hostId = null;
  const clientHandlers = {
    open(id) {
      hostId = id;
      st.peers.set(id, { slot: 0, last: now(), rtt: 0, hello: true });
      tr.send(id, { t: 'hello', v: NET_PROTO, build: build() });
    },
    data(id, m) {
      const q = st.peers.get(id);
      if (q) q.last = now();
      if (m.t === 'welcome') {
        clearTimeout(linkTimer);
        st.welcomed = true;
        st.slot = m.slot;
        st.status = 'open';
        emit('status', st);
        return;
      }
      if (m.t === 'reject') {
        st.status = 'error';
        st.error = m.why;
        emit('status', st);
        leave();
        return;
      }
      if (m.t === 'roster') {
        st.roster = m.players;
        emit('roster', st.roster);
        return;
      }
      if (m.t === 'ping') return tr.send(id, { t: 'pong', a: m.a, b: now() });
      if (m.t === 'pong') {
        st.rtt = now() - m.a;
        return;
      }
      if (m.t === 'start') st.started = true;
      if (m.from === undefined) m.from = 0; // 방장이 직접 보낸 것
      emit('msg', m);
    },
    close() {
      if (st.status === 'closed' || st.status === 'error') return;
      clearTimeout(linkTimer);
      st.status = st.welcomed ? 'closed' : 'error';
      st.error = st.error || (st.welcomed ? '방장과 연결이 끊겼다' : '방장과 연결하지 못했다');
      emit('status', st);
      if (st.welcomed) emit('left', 0);
    },
    error(e) {
      clearTimeout(linkTimer);
      st.status = 'error';
      st.error = String(e);
      emit('status', st);
    },
  };

  // ---------- 바깥에 보이는 것
  const fail = why => {
    st.status = 'error';
    st.error = why;
    emit('status', st);
  };
  async function host() {
    leave();
    const relay = /[?&]net=relay/.test(location.search),
      env = relay ? '' : envProblem();
    if (env) return (fail(env), null);
    st.role = 'host';
    st.status = 'connecting';
    st.since = Date.now();
    emit('status', st);
    tr = pickTransport();
    for (let i = 0; i < 4; i++) {
      const code = makeCode();
      try {
        await timed(
          tr.host(code, hostHandlers),
          NET_SIGNAL_WAIT,
          `중개 서버(PeerJS)에 ${NET_SIGNAL_WAIT / 1000}초 동안 연결하지 못했다 — 인터넷 · 방화벽을 확인하라. ` +
            'claude.ai 링크로 열었다면 거기서는 멀티가 막혀 있다 (게임 파일을 내려받아 직접 열어라)',
        );
        st.code = code;
        st.slot = 0;
        st.status = 'open';
        st.roster = [{ slot: 0 }];
        emit('status', st);
        emit('roster', st.roster);
        return code;
      } catch (e) {
        if (e.message !== 'ID_TAKEN') {
          if (tr) tr.close();
          tr = null;
          fail(e.message);
          return null;
        }
      }
    }
    st.status = 'error';
    st.error = '방 코드를 만들지 못했다';
    emit('status', st);
    return null;
  }
  async function join(code) {
    leave();
    code = cleanCode(code);
    if (code.length !== 6) {
      st.status = 'error';
      st.error = '방 코드는 6자리다';
      emit('status', st);
      return false;
    }
    const relay = /[?&]net=relay/.test(location.search),
      env = relay ? '' : envProblem();
    if (env) return (fail(env), false);
    st.role = 'client';
    st.code = code;
    st.status = 'connecting';
    st.since = Date.now();
    st.welcomed = false;
    emit('status', st);
    tr = pickTransport();
    try {
      await timed(
        tr.join(code, clientHandlers),
        NET_SIGNAL_WAIT,
        `중개 서버(PeerJS)에 ${NET_SIGNAL_WAIT / 1000}초 동안 연결하지 못했다 — 인터넷 · 방화벽을 확인하라. ` +
          'claude.ai 링크로 열었다면 거기서는 멀티가 막혀 있다 (게임 파일을 내려받아 직접 열어라)',
      );
    } catch (e) {
      if (tr) tr.close();
      tr = null;
      fail(e.message);
      return false;
    }
    // 중개 서버까지는 됐다. 이제 방장과 직접 연결(WebRTC)이 열려 welcome 이 와야 한다
    clearTimeout(linkTimer);
    linkTimer = setTimeout(() => {
      if (st.welcomed || st.role !== 'client' || st.status !== 'connecting') return;
      if (tr) tr.close();
      tr = null;
      fail(
        `방장과 ${NET_LINK_WAIT / 1000}초 동안 직접 연결하지 못했다 — 코드가 맞는지, 방장 화면에 방이 열려 있는지 확인하라. ` +
          '회사망 · 휴대폰 데이터 등 일부 네트워크는 직접 연결을 막는다 (그때는 다른 네트워크로)',
      );
    }, NET_LINK_WAIT);
    return true;
  }
  function leave() {
    clearTimeout(linkTimer);
    if (tr) {
      for (const id of st.peers.keys()) tr.send(id, { t: 'bye' });
      tr.close();
    }
    tr = null;
    hostId = null;
    st.peers.clear();
    Object.assign(st, {
      role: null,
      code: '',
      slot: -1,
      status: 'idle',
      error: '',
      roster: [],
      started: false,
      rtt: 0,
      since: 0,
      welcomed: false,
    });
  }
  // 모두에게 (참가자는 방장에게 → 방장이 중계)
  function send(m) {
    if (!tr) return;
    if (st.role === 'host') {
      m.from = 0;
      for (const [id, q] of st.peers) if (q.hello) tr.send(id, m);
    } else if (hostId) tr.send(hostId, m);
  }
  // 방장만: 판 시작
  function startMatch(info) {
    if (st.role !== 'host') return;
    st.started = true;
    const m = { t: 'start', ...info };
    send(m);
    emit('msg', { ...m, from: 0 });
  }
  // 매 프레임 (게임) 또는 로비에서 주기적으로: 핑 · 끊김 감지
  function tick() {
    if (!tr) return;
    const n = now();
    if (n - pingT > 1000) {
      pingT = n;
      for (const [id, q] of st.peers) if (q.hello) tr.send(id, { t: 'ping', a: n });
    }
    for (const [id, q] of [...st.peers]) {
      if (n - q.last > NET_TIMEOUT) (st.role === 'host' ? hostHandlers : clientHandlers).close(id);
    }
    if (st.role === 'host') st.rtt = Math.max(0, ...[...st.peers.values()].map(q => q.rtt || 0));
  }
  setInterval(tick, 250); // 메뉴(로비)에서도 핑 · 끊김 감지가 돌게
  return {
    st,
    envProblem,
    on,
    host,
    join,
    leave,
    send,
    startMatch,
    tick,
    get active() {
      return !!tr && st.status === 'open';
    },
  };
})();
