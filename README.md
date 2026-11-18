# STEEL TEMPEST

브라우저에서 도는 항모 공중전 게임. 빌드 결과는 HTML 파일 하나이고, 더블클릭하면 켜진다
(three.js 를 CDN 에서 받으므로 인터넷이 필요하다).

현재 버전: **V15.0.0-alpha.3**

**바로 플레이: https://alexmooon2610-lgtm.github.io/mallot123/** (GitHub Pages — 멀티플레이 가능)

`index.html` 은 GitHub Pages 용 빌드 결과다 (`dist/` 는 gitignore). 새 버전을 낼 때는
`python3 build.py` 뒤 `cp dist/STEEL_TEMPEST_*.html index.html` 로 덮어쓰고 커밋한다.

## 빌드

```bash
python3 build.py      # → dist/STEEL_TEMPEST_V15_0_0_alpha_3.html
```

순서와 에셋 목록은 `src/manifest.json` 에서 정한다. 새 JS/CSS 파일은 여기에 넣어야 빌드에 들어간다.

## 검사

```bash
pip install playwright
python3 tools/harness/run.py run dist/STEEL_TEMPEST_V15_0_0_alpha_3.html /tmp/new.json
python3 tools/harness/run.py diff tools/harness/baseline/V14_8_0.json /tmp/new.json
```

연출만 바꿨다면 모든 시나리오가 `동일` 이어야 한다.

```bash
python3 tools/harness/run.py fxcheck /tmp/new.json                     # 비행 효과 · 시점이 판정을 바꾸지 않는지
python3 tools/harness/run.py weapons dist/STEEL_TEMPEST_V15_0_0_alpha_3.html   # 미사일 유도 · 기총 · 대응수단 단위 시험
```

## 문서

- `docs/HANDOVER.md`: 전체 인수인계 문서. 구조, 규칙, 설계, 알려진 문제가 다 들어 있다. **작업 전에 먼저 읽을 것.**
- 3D 모델 실측 사양은 claude.ai 프로젝트 문서(`claude/*_model_spec.md`)에 있다.
