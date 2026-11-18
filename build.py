#!/usr/bin/env python3
"""STEEL TEMPEST 빌드: src/ 를 HTML 한 개로 합친다.

    python3 build.py              # → dist/STEEL_TEMPEST_V<버전>.html
    python3 build.py -o out.html  # 출력 경로 지정

순서는 src/manifest.json 이 정한다 (파일 이름 정렬이 아니다).
  - js     : 이 순서대로 이어 붙인다. 순서가 곧 의존성이다.
             임무 파일(20-mission-*.js)은 반드시 21-campaign.js 보다 앞에 둔다.
  - css    : 이 순서대로 이어 붙인다.
  - assets : <script type="text/plain" id="..."> 블록으로 base64(120자 줄바꿈) 삽입.
             게임 코드는 readAsset(id) 로 읽는다. 오프닝 사진은 data-mime 이 붙는다.
새 파일을 추가하면 manifest.json 에 이름을 넣어야 빌드에 들어간다.
"""
import argparse, base64, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')


def read(rel):
    with open(os.path.join(SRC, rel), encoding='utf-8') as f:
        return f.read()


def wrap(s, n=120):
    return '\n'.join(s[i:i + n] for i in range(0, len(s), n))


def build():
    man = json.loads(read('manifest.json'))
    tpl = read('index.template.html')

    css = ''.join(read('css/' + n) for n in man['css'])
    js = ''.join(read('js/' + n) for n in man['js'])

    blocks = []
    for a in man['assets']:
        with open(os.path.join(SRC, 'assets', a['file']), 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('ascii')
        mime = f' data-mime="{a["mime"]}"' if a.get('mime') else ''
        blocks.append(f'<script type="text/plain" id="{a["id"]}"{mime}>\n{wrap(b64)}\n</script>\n')

    for key in ('{{CSS}}', '{{JS}}', '{{ASSETS}}'):
        if tpl.count(key) != 1:
            sys.exit(f'template: {key} 가 정확히 한 번 있어야 한다')
    # 자리표시 줄의 들여쓰기는 첫 줄에만 붙는다 (원래 빌드와 같은 모양)
    out = (tpl.replace('{{CSS}}\n', css)
              .replace('{{JS}}\n', js)
              .replace('{{ASSETS}}\n', ''.join(blocks)))
    m = re.search(r'STEEL TEMPEST V(\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?)', out)
    return out, (m.group(1) if m else 'dev')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out')
    args = ap.parse_args()
    html, ver = build()
    out = args.out or os.path.join(ROOT, 'dist', f'STEEL_TEMPEST_V{ver.replace(".", "_").replace("-", "_")}.html')
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print(f'{out}  {len(html.encode("utf-8")) / 1024 / 1024:.2f} MB')


if __name__ == '__main__':
    main()
