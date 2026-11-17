/* ===== 인트로 DTG 시계 (UTC 날짜·시각) ===== */
(function () {
  try {
    const el = document.getElementById('mil-dtg'),
      f = n => String(n).padStart(2, '0'),
      M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const tick = () => {
      const d = new Date();
      el.textContent = `DTG ${f(d.getUTCDate())}${f(d.getUTCHours())}${f(d.getUTCMinutes())}Z ${M[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
    };
    tick();
    setInterval(tick, 1000);
  } catch (e) {
    console.warn('[MIL]', e);
  }
})();

