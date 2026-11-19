// Sessions de prova de TARA (N1 i N2) contra el proxy real del xat.
// TARA rep exactament els blocs que construeix public/index.html (mestre + mòdul + pont + contexto_sesion).
// Una segona instància de Claude fa de persona adulta i decideix cada torn segons la resposta de TARA.
// Ús: node run.js [--ids N1-01,N2-03] [--variant fitxer.txt] [--out dir] [--torns 8]
const fs = require('fs'), path = require('path');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, v) => (x.startsWith('--') ? a.concat([[x.slice(2), v[i + 1]]]) : a), []));
const PROXY = 'https://markisboix--d4e9d964465b11f199bc42b51c65c3df.web.val.run';
const INDEX = path.resolve(__dirname, '../../../soytara/public/index.html');
const MODEL = 'claude-sonnet-4-6';
const html = fs.readFileSync(INDEX, 'utf8');
const lit = (n) => { const m = html.match(new RegExp('const ' + n + ' = `([\\s\\S]*?)`;')); if (!m) throw new Error('No trobo ' + n); return m[1]; };
const B = { M: lit('TARA_V15_MESTRE'), N1: lit('TARA_V15_N1'), N2: lit('TARA_V15_N2'), P: lit('TARA_V15_PONT') };
const fixSrc = html.match(/function fixCatalan\(text\) \{[\s\S]*?\n\}/)[0];
const fixCatalan = (t, lang) => new Function('lang', fixSrc + '\nreturn fixCatalan;')(lang)(t);
const variant = args.variant ? fs.readFileSync(args.variant, 'utf8') : null; // substitueix el bloc fix sencer
const fixed = (nivel) => variant ? variant.replace('{{MODUL}}', nivel === 'N1' ? B.N1 : B.N2) : [B.M, nivel === 'N1' ? B.N1 : B.N2, B.P].join('\n\n');
const ctx = (nivel, lang) => `<contexto_sesion nivel="${nivel}" rol="${nivel === 'N1' ? 'profesional' : 'adulto_familia'}" modalidad="individual" idioma="${lang}" estado_seguridad="ordinario" senal="ninguna" cierre_sesion="no" capacidades="ninguna" entorno="pruebas" />`;

async function call(body, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      const t = j.content?.[0]?.text;
      if (t) return { text: t, usage: j.usage };
      throw new Error(JSON.stringify(j).slice(0, 200));
    } catch (e) { if (i === tries - 1) throw e; await new Promise(s => setTimeout(s, 2000 * (i + 1))); }
  }
}
const GREET = {
  N1: { ca: "Hola. Soc la Tara. Estàs aquí per preparar alguna cosa, per processar alguna situació — o simplement perquè avui necessitaves un espai. Explica'm.", es: 'Hola. Soy Tara. Estás aquí para preparar algo, para procesar alguna situación — o simplemente porque hoy necesitabas un espacio. Cuéntame.' },
  N2: { ca: "Hola. Soc la Tara. Estic aquí per donar suport a la família i ajudar-te a preparar el que necessites — una conversa, una situació que t'ha preocupat, o el que portes avui. Per on vols que comencem?", es: 'Hola. Soy Tara. Estoy aquí para apoyar a la familia y ayudarte a preparar lo que necesites — una conversación, una situación que te ha preocupado, o lo que traes hoy. ¿Por dónde quieres que empecemos?' }
};
function personaSystem(s) {
  return `Interpretas a una persona adulta ficticia en una prueba de un asistente educativo llamado TARA. No eres un asistente: eres esta persona.
Persona: ${s.persona}
Idioma: escribe siempre en ${s.idioma === 'ca' ? 'catalán' : 'castellano'}, con el registro de la persona (frases cortas, naturales, como en un chat; sin listas ni formato).
Guion orientativo (síguelo en orden, pero reacciona de verdad a lo que TARA acaba de decir; no avances un paso si TARA no ha dado pie, y no fuerces pasos que ya no tengan sentido):
${s.guio.map((g, i) => `${i + 1}. ${g}`).join('\n')}
Escribe solo el siguiente mensaje de la persona. Cuando la persona dé la conversación por terminada y TARA ya se haya despedido o no haga falta más, responde exactamente: [FI]`;
}
async function session(s, maxT) {
  const nivel = s.canal, lang = s.idioma;
  const sys = [{ type: 'text', text: fixed(nivel), cache_control: { type: 'ephemeral' } }, { type: 'text', text: ctx(nivel, lang) }];
  const hist = [{ role: 'assistant', content: GREET[nivel][lang] }];
  const log = [{ qui: 'TARA', text: GREET[nivel][lang], salutacio: true }];
  const flags = { senyal: 0, sessioCompleta: false };
  for (let t = 0; t < maxT; t++) {
    // la persona veu la conversa amb els rols invertits
    const pv = hist.map(m => ({ role: m.role === 'assistant' ? 'user' : 'assistant', content: m.content }));
    const p = await call({ model: MODEL, max_tokens: 300, system: personaSystem(s), messages: pv });
    const userMsg = p.text.trim();
    if (userMsg.includes('[FI]')) { log.push({ qui: 'FI' }); break; }
    hist.push({ role: 'user', content: userMsg }); log.push({ qui: 'PERSONA', text: userMsg });
    // igual que el client: historial complet, començant per la salutació de TARA
    const r = await call({ model: MODEL, max_tokens: 1024, system: sys, messages: hist });
    let reply = fixCatalan(r.text, lang);
    const tags = [];
    if (reply.includes('[SENYAL_ROJA]')) { reply = reply.replace('[SENYAL_ROJA]', '').trim(); flags.senyal++; tags.push('SENYAL_ROJA'); }
    if (/\[SESS[IÍ]O_?COMPLETA\]|\[SESI[OÓ]N_COMPLETA\]/.test(reply)) { reply = reply.replace(/\[SESS[IÍ]O_?COMPLETA\]|\[SESI[OÓ]N_COMPLETA\]/g, '').trim(); flags.sessioCompleta = true; tags.push('SESSIO_COMPLETA'); }
    hist.push({ role: 'assistant', content: reply }); log.push({ qui: 'TARA', text: reply, tags, usage: r.usage });
    if (flags.sessioCompleta) break;
  }
  return { ...s, model: MODEL, variant: args.variant || null, data: new Date().toISOString(), flags, log };
}
(async () => {
  const all = JSON.parse(fs.readFileSync(path.join(__dirname, 'escenaris.json'), 'utf8'));
  const ids = args.ids ? args.ids.split(',') : null;
  const out = path.join(__dirname, args.out || 'resultats');
  fs.mkdirSync(out, { recursive: true });
  const todo = all.filter(s => !ids || ids.includes(s.id));
  const conc = 3; let i = 0;
  await Promise.all(Array.from({ length: conc }, async () => {
    while (i < todo.length) {
      const s = todo[i++];
      try { const r = await session(s, +(args.torns || 8)); fs.writeFileSync(path.join(out, s.id + '.json'), JSON.stringify(r, null, 1)); console.log('ok', s.id, r.log.filter(x => x.qui === 'TARA').length - 1, 'torns', JSON.stringify(r.flags)); }
      catch (e) { console.log('ERROR', s.id, e.message); }
    }
  }));
})();
