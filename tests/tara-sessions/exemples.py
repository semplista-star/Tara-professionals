import json,os,sys
D=sys.argv[1]; cats=sys.argv[2].split(','); n=int(sys.argv[3]) if len(sys.argv)>3 else 3; grav=sys.argv[4] if len(sys.argv)>4 else 'alta'
out=0
for f in sorted(os.listdir(D+'_aval')):
    a=json.load(open(os.path.join(D+'_aval',f))); d=json.load(open(os.path.join(D,f)))
    T=[i for i,m in enumerate(d['log']) if m['qui']=='TARA' and not m.get('salutacio')]
    for p in a.get('problemes',[]):
        if p['categoria'] in cats and (grav=='*' or p.get('gravetat')==grav):
            k=p.get('torn',1)-1
            if k<0 or k>=len(T): continue
            i=T[k]; prev=d['log'][i-1]['text'] if i>0 else ''
            print(f"### {d['id']} ({d['canal']}, {d['idioma']}) · {d['titol']} · {p['categoria']}/{p.get('gravetat')}")
            print('PERSONA:',prev.replace('\n',' / ')[:500]); print('TARA:',d['log'][i]['text'].replace('\n',' / ')[:900]); print('ESPERAT:',p['esperat']); print('CITA:',p['cita']); print()
            out+=1
            if out>=n: sys.exit()
