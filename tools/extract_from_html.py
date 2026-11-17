"""One-time: rebuild src/ tree from the built STEEL TEMPEST html."""
import base64, os, re, sys, json
SRC_HTML, OUT = sys.argv[1], sys.argv[2]
L = open(SRC_HTML, encoding='utf-8').read().split('\n')  # last elem '' (trailing \n)
def lines(a, b): return L[a-1:b]          # 1-indexed inclusive
def find(pred, start=1):
    for i in range(start-1, len(L)):
        if pred(L[i]): return i+1
    raise SystemExit('not found')

css_open = find(lambda s: s.strip() == '<style>'); css_close = find(lambda s: s.strip() == '</style>')
js_open = find(lambda s: s.strip() == '<script>'); js_close = find(lambda s: s.strip() == '</script>', js_open)
assets_cmt = find(lambda s: 'ASSETS (코드 아님)' in s)
body_end = find(lambda s: s.strip() == '</body>')

def write(rel, text, mode='w'):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    if mode == 'wb': open(p, 'wb').write(text)
    else: open(p, 'w', encoding='utf-8', newline='\n').write(text)

# ---- CSS
css = lines(css_open+1, css_close-1)
assert css[0].startswith('      '); css[0] = css[0][6:]
CSS_SPLIT = [(1,'00-base.css'),(99,'10-front-menu.css'),(1419,'20-campaign-opening.css'),
             (2019,'30-cabin-terminal.css'),(2850,'40-title.css')]
css_files = []
for k,(st,name) in enumerate(CSS_SPLIT):
    en = CSS_SPLIT[k+1][0]-1 if k+1 < len(CSS_SPLIT) else len(css)
    write('src/css/'+name, '\n'.join(css[st-1:en])+'\n'); css_files.append(name)

# ---- JS
js = lines(js_open+1, js_close-1)
assert js[0].startswith('      '); js[0] = js[0][6:]
boot = next(i for i in range(len(js)-1, 0, -1) if js[i] == 'resize();') + 1
JS_SPLIT = [(1,'00-core.js'),(351,'01-environment.js'),(588,'01-cloud-layer.js'),
 (725,'10-model-f16.js'),(942,'10-model-mig29.js'),(1247,'10-model-mig29-glb.js'),(1507,'10-model-f16-glb.js'),
 (1537,'10-model-la17-glb.js'),(1581,'10-model-missile-glb.js'),(1613,'10-model-su33-glb.js'),
 (1636,'10-model-nike-hercules.js'),(1719,'11-terrain-airbase.js'),(2026,'12-carrier-model.js'),
 (2560,'13-carrier-glb.js'),(2700,'20-game-state.js'),(2755,'20-mission-registry.js'),(3122,'20-game-init.js'),
 (3328,'20-mission-tr1.js'),(3685,'20-mission-tr2.js'),(3946,'20-mission-tr3.js'),(4051,'21-campaign.js'),
 (4628,'30-hitbox-guns.js'),(4763,'31-audio-fx.js'),(4908,'32-missiles.js'),(5311,'33-carrier-weapons.js'),
 (5561,'33-carrier-defense.js'),(5666,'34-flight.js'),(5781,'35-sensors.js'),(5993,'36-enemy-ai.js'),
 (6199,'38-trails-fx.js'),(6478,'39-music.js'),(6943,'40-deck.js'),(7054,'41-mission-flow.js'),
 (7261,'42-carrier-ops.js'),(7495,'43-airbase-ops.js'),(7713,'50-ground-threats.js'),(7997,'60-cockpit.js'),
 (9162,'70-input.js'),(9568,'80-hud.js'),(9617,'81-rear-mirror.js'),(9644,'90-main-loop.js'),
 (9864,'91-front-menu.js'),(10472,'92-flight-fx.js'),(10756,'93-menu-fx.js'),(10837,'94-teaser.js'),
 (10887,'95-intro-logo.js'),(11158,'96-opening.js'),(11611,'97-cabin-terminal.js'),(11789,'98-ace-hud.js'),
 (12506,'99-radio.js'),(12669,'99-dtg-clock.js'),(boot,'99-boot.js')]
js_files = []
for k,(st,name) in enumerate(JS_SPLIT):
    en = JS_SPLIT[k+1][0]-1 if k+1 < len(JS_SPLIT) else len(js)
    write('src/js/'+name, '\n'.join(js[st-1:en])+'\n'); js_files.append(name)

# ---- assets
EXT = {b'glTF':'glb', b'\x89PNG':'png', b'\xff\xd8\xff':'jpg'}
assets, i = [], assets_cmt+1
while i < body_end:
    m = re.match(r'\s*<script type="text/plain" id="([^"]+)"(?: data-mime="([^"]+)")?>$', L[i-1])
    assert m, (i, L[i-1][:80])
    j = find(lambda s: s == '</script>', i+1)
    b64 = ''.join(lines(i+1, j-1)); raw = base64.b64decode(b64, validate=True)
    ext = next((e for k,e in EXT.items() if raw.startswith(k)), 'mp4' if raw[4:8]==b'ftyp' else 'bin')
    aid = m.group(1); name = aid[len('asset-'):]
    rel = ('opening/' + name[3:] if name.startswith('op-') else name.replace('-glb','').replace('-jpeg','').replace('-mp4','')) + '.' + ext
    write('src/assets/'+rel, raw, 'wb')
    assets.append({'id': aid, 'file': rel, 'mime': m.group(2)})
    i = j+1

# ---- template
tpl = L[:css_open] + ['      {{CSS}}'] + L[css_close-1:js_open] + ['      {{JS}}'] + L[js_close-1:assets_cmt] \
      + ['    {{ASSETS}}'] + L[body_end-1:]
write('src/index.template.html', '\n'.join(tpl))
write('src/manifest.json', json.dumps({'css': css_files, 'js': js_files, 'assets': assets}, ensure_ascii=False, indent=2)+'\n')
print(len(css_files), 'css', len(js_files), 'js', len(assets), 'assets')
