# STEEL TEMPEST

브라우저에서 도는 항모 공중전 게임. 빌드 결과는 HTML 파일 하나이고, 더블클릭하면 켜진다
(three.js 를 CDN 에서 받으므로 인터넷이 필요하다).

현재 버전: **V14.4.2**

## 빌드

```bash
python3 build.py      # → dist/STEEL_TEMPEST_V14_4_2.html
```

순서와 에셋 목록은 `src/manifest.json` 에서 정한다. 새 JS/CSS 파일은 여기에 넣어야 빌드에 들어간다.

## 검사

```bash
pip install playwright
python3 tools/harness/run.py run dist/STEEL_TEMPEST_V14_4_2.html /tmp/new.json
python3 tools/harness/run.py diff tools/harness/baseline/V14_4_2.json /tmp/new.json
```

연출만 바꿨다면 모든 시나리오가 `동일` 이어야 한다.

## 문서

- `docs/HANDOVER.md`: 전체 인수인계 문서. 구조, 규칙, 설계, 알려진 문제가 다 들어 있다. **작업 전에 먼저 읽을 것.**
- 3D 모델 실측 사양은 claude.ai 프로젝트 문서(`claude/*_model_spec.md`)에 있다.
