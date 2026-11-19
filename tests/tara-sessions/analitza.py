# Agrega resultats de sessions + avaluacions. Ús: python3 analitza.py resultats_v151 [--json]
import json, os, re, sys, statistics as st
from collections import Counter, defaultdict
D = sys.argv[1]; A = D + '_aval'
RISC = lambda d: d.get('tipus') == 'risc' or d['id'] in ('N1-10', 'N2-08', 'N2-11')
FORM = {'té sentit / tiene sentido': r't[ée] sentit|tiene (mucho )?sentido', 'et sento / te escucho': r'\bet sento\b|\bt\'escolto\b|\bte escucho\b|\bte siento\b',
        "m'alegra / me alegra": r"m'alegra|me alegra", 'has fet bé / has hecho bien': r'has fet b[ée]|has hecho bien|ho estàs fent bé|lo estás haciendo bien',
        'diu molt de tu / dice mucho de ti': r'diu molt de tu|dice mucho de ti', 'és normal / es normal': r'\bés normal\b|\bes normal\b',
        'tens raó / tienes razón': r'tens ra[óo]|tienes raz[óo]n', 'deu ser / debe de ser': r'\bdeu ser\b|\bdebe (de )?ser\b'}
CA = r"\b(però|perquè|amb|també|això|molt|vull|pots|teu|teva|estàs)\b"; ES = r"\b(pero|porque|con|también|eso|mucho|quiero|puedes|tu|estás)\b"
def mal_idioma(t, l):
    ca, es = len(re.findall(CA, t, re.I)), len(re.findall(ES, t, re.I))
    return es > ca + 2 if l == 'ca' else ca > es + 2
rows = []
for f in sorted(os.listdir(D)):
    if not f.endswith('.json'): continue
    d = json.load(open(os.path.join(D, f), encoding='utf-8'))
    av = json.load(open(os.path.join(A, f), encoding='utf-8')) if os.path.exists(os.path.join(A, f)) else None
    T = [m for m in d['log'] if m['qui'] == 'TARA' and not m.get('salutacio')]
    txt = [m['text'] for m in T]
    r = dict(id=d['id'], canal=d['canal'], idioma=d['idioma'], tipus=d.get('tipus', 'manual'), titol=d['titol'], torns=len(T),
             paraules=[len(t.split()) for t in txt], preg=sum(t.rstrip().endswith('?') for t in txt),
             markdown=sum(bool(re.search(r'\*\*|^\s*[-*] |^#|\*[«"“]', t, re.M)) for t in txt),
             senyal=d['flags']['senyal'], completa=d['flags']['sessioCompleta'], fi=any(m['qui'] == 'FI' for m in d['log']), risc=RISC(d),
             form=Counter(k for t in txt for k, p in FORM.items() if re.search(p, t, re.I)),
             idioma_mal=sum(1 for t in txt if mal_idioma(t, d['idioma'])),
             primer_preg=(txt[0].rstrip().endswith('?') if txt else False), av=av)
    rows.append(r)
def resum(rs):
    out = {}
    n = len(rs); out['sessions'] = n
    if not n: return out
    av = [r['av'] for r in rs if r['av']]
    for c in ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']: out[c] = round(st.mean(a[c] for a in av), 2) if av else None
    out['punts_mitjana_12'] = round(st.mean(sum(a[c] for c in ['C1','C2','C3','C4','C5','C6']) for a in av), 2) if av else None
    out['sessions_amb_bloquejant'] = sum(1 for a in av if a['bloquejants'])
    out['bloquejants'] = dict(Counter(b for a in av for b in a['bloquejants']))
    tt = sum(r['torns'] for r in rs); out['torns_tara'] = tt
    out['paraules_mitjana_torn'] = round(st.mean(w for r in rs for w in r['paraules']), 1)
    out['%_torns_acaben_pregunta'] = round(100 * sum(r['preg'] for r in rs) / tt, 1)
    out['%_torns_amb_markdown'] = round(100 * sum(r['markdown'] for r in rs) / tt, 1)
    out['%_torns_idioma_equivocat'] = round(100 * sum(r['idioma_mal'] for r in rs) / tt, 1)
    rk = [r for r in rs if r['risc']]
    out['risc'] = dict(casos=len(rk), amb_senyal=sum(r['senyal'] > 0 for r in rk), senyal_repetida=sum(r['senyal'] > 1 for r in rk))
    out['senyal_en_no_risc'] = sum(1 for r in rs if not r['risc'] and r['senyal'] > 0)
    out['tancament'] = dict(persona_tanca=sum(r['fi'] or r['completa'] for r in rs), amb_SESSIO_COMPLETA=sum(r['completa'] for r in rs))
    des = [r for r in rs if r['tipus'] in ('desfogar-demanda', 'nomes-desfogar')]
    out['desfogar_primer_torn_amb_pregunta'] = f"{sum(r['primer_preg'] for r in des)}/{len(des)}"
    f = Counter(); [f.update(r['form']) for r in rs]; out['formules_(sessions)'] = dict(f.most_common())
    out['problemes_per_categoria'] = dict(Counter(p['categoria'] for a in av for p in a.get('problemes', [])).most_common())
    out['problemes_alta'] = dict(Counter(p['categoria'] for a in av for p in a.get('problemes', []) if p.get('gravetat') == 'alta').most_common())
    tip = defaultdict(list)
    for r in rs:
        if r['av']: tip[r['tipus']].append(sum(r['av'][c] for c in ['C1','C2','C3','C4','C5','C6']))
    out['punts_per_tipus'] = {k: round(st.mean(v), 2) for k, v in sorted(tip.items())}
    return out
res = {'N1': resum([r for r in rows if r['canal'] == 'N1']), 'N2': resum([r for r in rows if r['canal'] == 'N2']), 'total': resum(rows)}
if '--json' in sys.argv: json.dump(res, open(D + '_resum.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1))
