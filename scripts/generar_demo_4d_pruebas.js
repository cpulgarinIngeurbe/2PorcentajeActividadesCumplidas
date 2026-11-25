// Demo 4D realista para el "Proyecto de Pruebas" (slug pruebas).
// Se pega en la consola de la app (sesion admin) y se llama:
//   await generarDemo4D({ escribir: false })  -> solo calcula y muestra cifras
//   await generarDemo4D({ escribir: true })   -> reemplaza los datos en Firestore
// A partir del modelo BIM ya subido arma un cronograma por especialidad >
// torre > piso (cada actividad vinculada a sus elementos), asigna los
// contratistas de Albura y simula 11 semanas de programacion, calificacion y
// PAC, con estados por elemento (ejecutado / programado / no ejecutado).
// Determinista (semilla fija). OJO: actas, calificaciones y PAC no se pueden
// borrar desde la app (reglas de Firestore): correrlo de nuevo los duplica.
// Respaldo del cronograma anterior: cronogramasGenerales/zz_respaldo_pruebas_20261125.
async function generarDemo4D({ escribir = false, slug = 'pruebas', corte = '2026-11-23', semanas = 11, plan = null, pilotesPorGrupo = 40 } = {}) {
  const db = firebase.firestore();
  const D = 86400000;
  const POR = 'script-demo-4d';
  const ahora = new Date().toISOString();
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const iso = d => new Date(d).toISOString().slice(0, 10);
  const dia = s => +new Date(s + 'T00:00:00Z');
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const largo = t => { const d = new Date(t); return d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()] + ' de ' + d.getUTCFullYear(); };
  let semilla = 101; // PAC semanal 75-93 % y elementos no ejecutados visibles al corte
  const rnd = () => { semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0; let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const gunzip = async parts => JSON.parse(await new Response(new Blob(parts).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  const gzip = async obj => new Uint8Array(await new Response(new Blob([new TextEncoder().encode(JSON.stringify(obj))]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const sha = async u8 => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', u8))).map(b => b.toString(16).padStart(2, '0')).join('');
  const claveActividadPac = wbs => { let h = 0; const s = String(wbs); for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return 'w' + Math.abs(h).toString(36); };
  const idVinculo = wbs => String(wbs).replace(/\//g, '_') || '_';

  // ---- 1. Modelo -----------------------------------------------------------
  const meta = (await db.doc('modelosBIM/' + slug).get()).data();
  const partes = await Promise.all(Array.from({ length: meta.numTrozos }, (_, i) => db.doc('modelosBIM/' + slug + '/trozos/' + i).get().then(d => d.data().data.toUint8Array())));
  const els = (await gunzip(partes)).elements.map(e => {
    let sx = 0, sy = 0, zmin = Infinity;
    (e.vertices || []).forEach(v => { sx += v[0]; sy += v[1]; if (v[2] < zmin) zmin = v[2]; });
    const n = (e.vertices || []).length || 1;
    return { g: e.globalId, ed: e.edificacion || '', niv: e.nivel || '', cat: e.categoria || '', txt: norm([e.actividad, e.name, e.descGrupo].join(' ')), x: sx / n, y: sy / n, z: zmin };
  }).filter(e => !/andamio/.test(e.txt)); // obra provisional: queda sin vincular (gris)

  // Edificacion: la del IFC; si no, por el texto o por la huella en planta
  const ED = ['Torre 1', 'Torre 2', 'Plataforma'];
  const caja = {};
  ED.forEach(ed => { const l = els.filter(e => e.ed === ed); caja[ed] = { x0: Math.min(...l.map(e => e.x)), x1: Math.max(...l.map(e => e.x)), y0: Math.min(...l.map(e => e.y)), y1: Math.max(...l.map(e => e.y)) }; });
  const dentro = (e, c) => e.x >= c.x0 && e.x <= c.x1 && e.y >= c.y0 && e.y <= c.y1;
  els.forEach(e => {
    if (e.ed) return;
    if (/torre\s*1/.test(e.txt)) e.ed = 'Torre 1';
    else if (/torre\s*2/.test(e.txt)) e.ed = 'Torre 2';
    else e.ed = ['Torre 1', 'Torre 2'].find(ed => dentro(e, caja[ed])) ||
      ED.map(ed => [ed, Math.hypot(e.x - (caja[ed].x0 + caja[ed].x1) / 2, e.y - (caja[ed].y0 + caja[ed].y1) / 2)]).sort((a, b) => a[1] - b[1])[0][0];
  });
  // Nivel: el del IFC (normalizado); si no, por altura dentro de su edificacion
  const NIV = ['Pilotaje', 'Cimentación', 'Semisótano'].concat(Array.from({ length: 14 }, (_, i) => 'Piso ' + String(i + 1).padStart(2, '0')), ['Cubierta']);
  const canon = n => /cub/i.test(n) ? 'Cubierta' : (NIV.includes(n) ? n : '');
  els.forEach(e => { e.niv = canon(e.niv); });
  const zNivel = {};
  ED.concat(['*']).forEach(ed => {
    zNivel[ed] = NIV.map(n => {
      const zs = els.filter(e => e.niv === n && (ed === '*' || e.ed === ed)).map(e => e.z).sort((a, b) => a - b);
      return zs.length >= 3 ? [n, zs[Math.floor(zs.length / 2)]] : null;
    }).filter(Boolean);
  });
  els.forEach(e => {
    if (e.niv) return;
    const tabla = zNivel[e.ed].length >= 3 ? zNivel[e.ed] : zNivel['*'];
    const bajo = tabla.filter(([, z]) => z <= e.z + 0.5);
    e.niv = bajo.length ? bajo[bajo.length - 1][0] : tabla[0][0];
  });
  // Especialidad
  els.forEach(e => {
    const t = e.txt;
    e.esp = (e.niv === 'Pilotaje' || /pilote/.test(t)) ? 'PIL'
      : /panete|repello/.test(t) ? 'PAN'
      : /enchape|cinta|gravilla|porcelanato/.test(t) ? 'ENC'
      : /mamposter|bloque|ladrillo|hilada|viga canchada|viga corona|viga intermedia|angulo/.test(t) ? 'MAM'
      : /remate|foso/.test(t) ? 'REM'
      : (e.niv === 'Cimentación' || e.niv === 'Semisótano' || /cimentaci/.test(norm(e.cat))) ? 'CIM'
      : /muro|pilar/.test(norm(e.cat)) ? 'ESTM' : 'ESTP';
  });

  // ---- 2. Plan: especialidad x edificacion ----------------------------------
  const CAP = [
    ['PIL', 'Pilotaje'], ['CIM', 'Cimentación y semisótano'], ['EST', 'Estructura en concreto'], ['REM', 'Remates estructurales (punto fijo, escaleras y fosos)'],
    ['MAM', 'Mampostería y fachada'], ['PAN', 'Pañetes y repellos'], ['ENC', 'Enchapes, cintas y remates finos'],
  ];
  const CONTR = {
    PIL: 'SOLETANCHE BACHY COLOMBIA SAS', CIM: 'S & S INGENIERIA CIVIL S.A.S.', REM: 'ASPI CONSTRUCTORA SAS',
    'EST|Torre 1': 'FORMACO S A S', 'EST|Torre 2': 'CONSTRUCTORA S & S S.A.S', 'EST|Plataforma': 'GRUPO QUINTERO Y ASOCIADOS S A S',
    'MAM|Torre 1': 'INVERSIONES Y CONSTRUCCIONES WILCAJAR S A S', 'MAM|Torre 2': 'EXPRESS CONSTRUCCIONES SAS', 'MAM|Plataforma': 'INVERSIONES Y CONSTRUCCIONES WILCAJAR S A S',
    PAN: 'CONSTRU-OBRAS G & B SAS', ENC: 'AD CONSTRUCCIONES A S.A.S.',
  };
  const contrDe = (k, ed) => CONTR[k + '|' + ed] || CONTR[k];
  // Cumplimiento tipico de cada contratista (PAC esperado)
  const CUMPLE = {
    'SOLETANCHE BACHY COLOMBIA SAS': 0.95, 'S & S INGENIERIA CIVIL S.A.S.': 0.9, 'ASPI CONSTRUCTORA SAS': 0.84, 'FORMACO S A S': 0.92,
    'CONSTRUCTORA S & S S.A.S': 0.76, 'GRUPO QUINTERO Y ASOCIADOS S A S': 0.88, 'INVERSIONES Y CONSTRUCCIONES WILCAJAR S A S': 0.86,
    'EXPRESS CONSTRUCCIONES SAS': 0.74, 'CONSTRU-OBRAS G & B SAS': 0.8, 'AD CONSTRUCCIONES A S.A.S.': 0.82,
  };
  // [inicio linea base, dias por piso, atraso acumulado al ultimo piso]
  const PLAN = plan || {
    // Al corte: Plataforma terminada; Torre 1 cerrando estructura con
    // acabados en curso; Torre 2 en estructura (atrasada frente a la linea
    // base). Mantiene estadoEjecucion bajo el limite de campos de Firestore.
    'Plataforma': { PIL: ['2025-11-03', 7, 0], CIM: ['2026-01-05', 14, 4], EST: ['2026-02-09', 16, 8], REM: ['2026-04-06', 10, 5], MAM: ['2026-05-04', 14, 6], PAN: ['2026-06-15', 14, 8], ENC: ['2026-07-20', 14, 10] },
    'Torre 1': { PIL: ['2025-12-01', 7, 0], CIM: ['2026-02-02', 12, 3], EST: ['2026-04-27', 13, 18], REM: ['2026-06-15', 13, 15], MAM: ['2026-07-13', 13, 12], PAN: ['2026-09-07', 13, 10], ENC: ['2026-10-26', 13, 12] },
    'Torre 2': { PIL: ['2026-02-02', 7, 4], CIM: ['2026-04-06', 12, 8], EST: ['2026-07-20', 13, 21], REM: ['2026-09-14', 13, 18], MAM: ['2026-10-19', 13, 14], PAN: ['2027-01-11', 13, 15], ENC: ['2027-03-08', 13, 20] },
  };
  // Mamposteria, pañetes y enchapes van por sectores del piso en paralelo
  const SECTORES = { MAM: ['Sector A', 'Sector B'], PAN: ['Sector A', 'Sector B'], ENC: ['Sector A', 'Sector B'] };
  const grupos = new Map(); // "esp|ed|niv" -> elementos
  els.forEach(e => { const k = e.esp + '|' + e.ed + '|' + e.niv; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(e); });
  // Orden de avance dentro de una actividad: barrido por el eje largo
  const barrido = l => { const xs = l.map(e => e.x), ys = l.map(e => e.y); const ejeX = (Math.max(...xs) - Math.min(...xs)) >= (Math.max(...ys) - Math.min(...ys)); return l.slice().sort((a, b) => ejeX ? a.x - b.x : a.y - b.y); };

  const actividades = []; // hojas
  CAP.forEach(([k, capNom], ci) => ED.forEach(ed => {
    const p = PLAN[ed][k];
    const niveles = NIV.filter(n => (k === 'EST' ? ['ESTM', 'ESTP'] : [k]).some(s => grupos.has(s + '|' + ed + '|' + n)));
    if (!niveles.length) return;
    const lista = [];
    if (k === 'PIL') {
      const pil = barrido(niveles.flatMap(n => grupos.get('PIL|' + ed + '|' + n)));
      const nG = Math.max(1, Math.round(pil.length / pilotesPorGrupo));
      for (let i = 0; i < nG; i++) lista.push({ nombre: 'Pilotes grupo ' + (i + 1) + ' de ' + nG, els: pil.slice(Math.floor(i * pil.length / nG), Math.floor((i + 1) * pil.length / nG)), paso: i, dur: p[1] });
    } else if (k === 'EST') {
      niveles.forEach((n, i) => {
        if (grupos.has('ESTM|' + ed + '|' + n)) lista.push({ nombre: 'Muros y columnas - ' + n, els: barrido(grupos.get('ESTM|' + ed + '|' + n)), paso: i, desfase: 0, dur: Math.round(p[1] * 0.65) });
        if (grupos.has('ESTP|' + ed + '|' + n)) lista.push({ nombre: 'Placa y vigas - ' + n, els: barrido(grupos.get('ESTP|' + ed + '|' + n)), paso: i, desfase: Math.round(p[1] * 0.45), dur: Math.round(p[1] * 0.6) });
      });
    } else {
      const ACT = { CIM: 'Cimentación', REM: 'Remates de concreto', MAM: 'Mampostería', PAN: 'Pañetes', ENC: 'Enchapes y cintas' };
      niveles.forEach((n, i) => {
        const nom = (k === 'CIM' && n === 'Semisótano' ? 'Muros y placa de semisótano' : k === 'CIM' && n !== 'Cimentación' ? 'Elementos de cimentación' : k === 'CIM' ? 'Dados, vigas y placa de cimentación' : ACT[k]) + ' - ' + n;
        const todos = barrido(grupos.get(k + '|' + ed + '|' + n));
        const sec = SECTORES[k] && todos.length >= 40 ? SECTORES[k] : null;
        if (!sec) { lista.push({ nombre: nom, els: todos, paso: i, dur: p[1] }); return; }
        // Sectores en paralelo, el segundo arranca unos dias despues
        sec.forEach((s, j) => lista.push({ nombre: nom + ' - ' + s, els: todos.slice(Math.floor(j * todos.length / sec.length), Math.floor((j + 1) * todos.length / sec.length)),
          paso: i, desfase: Math.round(j * p[1] * 0.3), dur: Math.round(p[1] * 0.85) }));
      });
    }
    const pasos = Math.max(1, Math.max(...lista.map(a => a.paso)));
    lista.forEach(a => {
      const bs = dia(p[0]) + (a.paso * p[1] + (a.desfase || 0)) * D;
      const atraso = Math.round(p[2] * a.paso / pasos);
      Object.assign(a, { cap: ci, capNom, ed, k, contr: contrDe(k, ed), bs, bf: bs + (a.dur - 1) * D, ps: bs + atraso * D, pf: bs + (atraso + a.dur - 1) * D });
      actividades.push(a);
    });
  }));

  // ---- 3. Ejecucion semana a semana ----------------------------------------
  const tCorte = dia(corte);
  const lunes = Array.from({ length: semanas }, (_, i) => tCorte - (semanas - 1 - i) * 7 * D);
  const frac = (a, t) => Math.max(0, Math.min(1, (t - a.ps) / ((a.pf - a.ps) + D)));
  const estado = new Map(), noEjec = new Map();
  actividades.forEach(a => {
    a.hechos = Math.round(a.els.length * frac(a, lunes[0]));
    a.els.slice(0, a.hechos).forEach(e => estado.set(e.g, 'Ejecutado'));
    a.plan = a.hechos; a.pend = [];
  });
  const RAZON = ['Lluvia', 'Falta de personal', 'Falta de materiales', 'Bajo rendimiento', 'Actividad previa no ejecutada', 'Daño en equipo', 'Falla logistica', 'Imprevistos'];
  const OBS = {
    'Lluvia': 'Lluvias en la tarde suspendieron el vaciado y el trabajo en fachada.', 'Falta de personal': 'La cuadrilla llegó incompleta (faltaron oficiales).',
    'Falta de materiales': 'El proveedor no entregó a tiempo el material programado.', 'Bajo rendimiento': 'Rendimiento inferior al planeado en la semana.',
    'Actividad previa no ejecutada': 'El frente no estaba liberado por la actividad anterior.', 'Daño en equipo': 'Falla de la torre grúa / mezcladora durante dos días.',
    'Falla logistica': 'Cruce de frentes con otro contratista en el mismo piso.', 'Imprevistos': 'Ajustes de obra solicitados por la interventoría.',
  };
  const actas = [], califs = [], pacs = [];
  lunes.forEach((L, wi) => {
    const fin = L + 7 * D, sab = L + 5 * D, ultima = wi === lunes.length - 1;
    const tareas = [];
    actividades.forEach((a, orden) => {
      const meta = Math.round(a.els.length * frac(a, fin));
      const nuevos = a.els.slice(a.plan, Math.max(a.plan, meta));
      a.plan = Math.max(a.plan, meta);
      const prog = a.pend.concat(nuevos);
      if (!prog.length) return;
      tareas.push({ a, orden, prog, conPend: a.pend.length > 0 });
    });
    const tsActa = new Date(L + 14 * 3600000).toISOString(); // lunes 9:00 a. m. (Colombia)
    const acta = {
      timestamp: tsActa, project: 'Proyecto', actaDate: largo(L), closureDate: largo(L + 7 * D),
      totalTasks: tareas.length, imagenesBIM: [], generadoPor: POR, contractors: [],
    };
    const porContr = new Map();
    tareas.forEach(t => {
      if (!porContr.has(t.a.contr)) porContr.set(t.a.contr, []);
      porContr.get(t.a.contr).push({ _a: t.a, activity: t.a.nombre, wbs: null, text: t.a.nombre + ' — ' + t.a.ed + (t.conPend ? ' (incluye pendientes de la semana anterior)' : ''),
        qty: String(t.prog.length), unit: 'Unidad', aptos: [], elementosBIM: t.prog.map(e => e.g), manualId: null, orden: t.orden, fecha: iso(sab) });
    });
    acta.contractors = Array.from(porContr.entries()).sort((x, y) => x[0].localeCompare(y[0])).map(([name, tasks]) => ({ name, tasks }));
    actas.push(acta);
    if (ultima) { tareas.forEach(t => t.prog.forEach(e => { if (estado.get(e.g) !== 'Ejecutado') estado.set(e.g, 'Programado'); })); tareas.forEach(t => { t.a.pend = t.prog; }); return; }
    // Calificacion el lunes siguiente, 8:00 a. m.
    const ratings = [], resumen = new Map();
    tareas.forEach(t => {
      const cumplio = rnd() < (CUMPLE[t.a.contr] || 0.8);
      const n = cumplio ? t.prog.length : Math.floor(t.prog.length * (0.35 + rnd() * 0.45));
      const hechos = t.prog.slice(0, n), faltan = t.prog.slice(n);
      hechos.forEach(e => { estado.set(e.g, 'Ejecutado'); noEjec.delete(e.g); });
      faltan.forEach(e => { estado.delete(e.g); noEjec.set(e.g, largo(L)); });
      t.a.pend = faltan;
      const razon = cumplio ? null : RAZON[Math.floor(rnd() * (L >= dia('2026-10-01') ? RAZON.length : RAZON.length - 1)) % RAZON.length];
      ratings.push({ _a: t.a, activity: t.a.nombre, wbs: null, text: t.a.nombre + ' — ' + t.a.ed, qty: String(t.prog.length), unit: 'Unidad', aptos: [], manualId: null,
        contractor: t.a.contr, cumplio, reason: razon, observacion: cumplio ? null : OBS[razon] + ' Ejecutado ' + n + ' de ' + t.prog.length + '.',
        elementosBIM: t.prog.map(e => e.g), elementosEjecutadosBIM: hechos.map(e => e.g) });
      const r = resumen.get(t.a.contr) || { contractor: t.a.contr, cumplidas: 0, noCumplidas: 0, total: 0 };
      r.total++; if (cumplio) r.cumplidas++; else r.noCumplidas++;
      resumen.set(t.a.contr, r);
    });
    const tsCal = new Date(fin + 13 * 3600000).toISOString();
    califs.push({ timestamp: tsCal, slug, project: acta.project, actaTimestamp: tsActa, actaDate: acta.actaDate, totalTasks: ratings.length, ratings, generadoPor: POR });
    pacs.push({ timestamp: new Date(fin + 13 * 3600000 + 60000).toISOString(), slug, project: acta.project, actaDate: acta.actaDate, actaTimestamp: tsActa, generadoPor: POR,
      contractors: Array.from(resumen.values()).map(r => Object.assign(r, { pac: r.total ? r.cumplidas / r.total : 0 })) });
  });

  // ---- 4. Cronograma ----------------------------------------------------------
  const tasks = [];
  const base = { milestone: false, predecessors: '', successors: '', resources: '', cost: 0, notes: '', total_slack: '', free_slack: '', actual_start: '', actual_duration: '', remaining_duration: '', constraint_type: '', priority: null, task_type: '' };
  const dur = (a, b) => Math.round((b - a) / D) + 1 + 'd';
  const fila = (o) => { const id = tasks.length + 1; const t = Object.assign({ id, uid: id }, base, o); tasks.push(t); return t; };
  const resumenDe = (t, hojas) => {
    const s = Math.min(...hojas.map(a => a.ps)), f = Math.max(...hojas.map(a => a.pf)), bs = Math.min(...hojas.map(a => a.bs)), bf = Math.max(...hojas.map(a => a.bf));
    const n = hojas.reduce((x, a) => x + a.els.length, 0), h = hojas.reduce((x, a) => x + a.els.filter(e => estado.get(e.g) === 'Ejecutado').length, 0);
    Object.assign(t, { start: iso(s), finish: iso(f), duration: dur(s, f), baseline_start: iso(bs), baseline_finish: iso(bf), baseline_duration: dur(bs, bf), pct: n ? Math.round(h / n * 100) : 0 });
  };
  const raiz = fila({ name: 'Programación de obra - Proyecto', level: 0, wbs: '1', summary: true, critical: false });
  CAP.forEach(([k, capNom], ci) => {
    const delCap = actividades.filter(a => a.cap === ci);
    if (!delCap.length) return;
    const wc = '1.' + (tasks.filter(t => t.level === 1).length + 1);
    const tc = fila({ name: capNom, level: 1, wbs: wc, summary: true, critical: false });
    ED.forEach(ed => {
      const hojas = delCap.filter(a => a.ed === ed);
      if (!hojas.length) return;
      const we = wc + '.' + (tasks.filter(t => t.level === 2 && t.wbs.startsWith(wc + '.')).length + 1);
      const te = fila({ name: ed, level: 2, wbs: we, summary: true, critical: false });
      hojas.sort((x, y) => x.ps - y.ps).forEach((a, i) => {
        a.wbs = we + '.' + (i + 1);
        const h = a.els.filter(e => estado.get(e.g) === 'Ejecutado').length;
        fila({ name: a.nombre, level: 3, wbs: a.wbs, summary: false, critical: k === 'EST' && ed === 'Torre 2',
          start: iso(a.ps), finish: iso(a.pf), duration: dur(a.ps, a.pf), baseline_start: iso(a.bs), baseline_finish: iso(a.bf), baseline_duration: dur(a.bs, a.bf),
          pct: Math.round(h / a.els.length * 100), resources: a.contr });
      });
      resumenDe(te, hojas);
    });
    resumenDe(tc, delCap);
  });
  resumenDe(raiz, actividades);
  // Las actas se armaron antes de tener WBS: se completan ahora
  const ordenDe = new Map(tasks.map((t, i) => [t.wbs, i]));
  const resolver = t => { t.wbs = t._a.wbs; t.orden = ordenDe.get(t.wbs); delete t._a; };
  actas.forEach(doc => doc.contractors.forEach(c => { c.tasks.forEach(resolver); c.tasks.sort((x, y) => x.orden - y.orden); }));
  califs.forEach(doc => doc.ratings.forEach(resolver));

  const resumenCifras = {
    elementos: els.length, actividades: actividades.length, filasCronograma: tasks.length,
    ejecutados: Array.from(estado.values()).filter(v => v === 'Ejecutado').length, programados: Array.from(estado.values()).filter(v => v === 'Programado').length,
    noEjecutados: noEjec.size, camposEstado: estado.size + noEjec.size,
    actas: actas.map(a => a.actaDate + ': ' + a.totalTasks + ' tareas'), pac: pacs.map(p => { const c = p.contractors.reduce((x, r) => x + r.cumplidas, 0), t = p.contractors.reduce((x, r) => x + r.total, 0); return p.actaDate + ' ' + Math.round(c / t * 100) + '%'; }),
    porEspecialidad: CAP.map(([k]) => k + ':' + els.filter(e => (k === 'EST' ? /^EST/ : new RegExp('^' + k + '$')).test(e.esp)).length).join(' '),
    avance: ED.map(ed => ed + ' ' + CAP.map(([k]) => { const l = actividades.filter(a => a.ed === ed && a.k === k).flatMap(a => a.els); return l.length ? k + ' ' + Math.round(l.filter(e => estado.get(e.g) === 'Ejecutado').length / l.length * 100) + '%' : ''; }).filter(Boolean).join(' · ')),
    porContratista: Object.fromEntries(Object.entries(actividades.reduce((o, a) => { o[a.contr] = (o[a.contr] || 0) + 1; return o; }, {}))),
  };
  window.__demo4d = { actividades, tasks, actas, califs, pacs, estado, noEjec, resumenCifras };
  if (!escribir) return resumenCifras;
  if (resumenCifras.camposEstado > 19000) throw new Error('estadoEjecucion superaria el limite de campos de Firestore: ' + resumenCifras.camposEstado);

  // ---- 5. Escritura -----------------------------------------------------------
  const lotes = async (ops) => { for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); ops.slice(i, i + 400).forEach(f => f(b)); await b.commit(); } };
  // Limpia lo operativo anterior del proyecto
  for (const c of ['actas', 'calificaciones', 'pac']) {
    const s = await db.collection(c + '/' + slug + '/historial').get();
    await lotes(s.docs.map(d => b => b.delete(d.ref)));
  }
  const viejosV = await db.collection('modelosBIM/' + slug + '/vinculos').get();
  await lotes(viejosV.docs.map(d => b => b.delete(d.ref)));
  const viejosC = await db.collection('cantidadesPac/' + slug + '/items').get();
  await lotes(viejosC.docs.map(d => b => b.delete(d.ref)));
  // Cronograma
  const datos = { slug, nombreProyecto: 'Proyecto', tasks, generatedAt: ahora };
  const crudo = new TextEncoder().encode(JSON.stringify(datos));
  const comp = await gzip(datos);
  const TAM = 900000, trozos = [];
  for (let i = 0; i < comp.length; i += TAM) trozos.push(comp.slice(i, i + TAM));
  const metaC = (await db.doc('cronogramasGenerales/' + slug).get()).data() || {};
  await lotes(trozos.map((t, i) => b => b.set(db.doc('cronogramasGenerales/' + slug + '/trozos/' + i), { data: firebase.firestore.Blob.fromUint8Array(t) })));
  for (let i = trozos.length; i < (metaC.numTrozos || 0); i++) await db.doc('cronogramasGenerales/' + slug + '/trozos/' + i).delete();
  await db.doc('cronogramasGenerales/' + slug).set({ slug, nombreProyecto: datos.nombreProyecto, estado: 'listo', mensaje: '', huella: await sha(comp), bytes: comp.length, bytesOriginales: crudo.length,
    numTrozos: trozos.length, totalTasks: tasks.length, generatedAt: ahora, subidoPor: POR, fechaCorte: corte });
  // Vinculos con el modelo y atributos (contratista, cantidades)
  await lotes(actividades.map(a => b => b.set(db.doc('modelosBIM/' + slug + '/vinculos/' + idVinculo(a.wbs)), { wbs: a.wbs, globalIds: a.els.map(e => e.g), actualizado: ahora, por: POR })));
  await db.doc('modelosBIM/' + slug).update({ wbsVinculados: actividades.map(a => a.wbs) });
  await lotes(actividades.map(a => b => b.set(db.doc('cantidadesPac/' + slug + '/items/' + claveActividadPac(a.wbs)), {
    wbs: a.wbs, nombre: a.nombre + ' - ' + a.ed, contratista: a.contr, contratistaPor: POR, contratistaEn: ahora, cantidadTotal: a.els.length,
    cantidadEjecutada: a.els.filter(e => estado.get(e.g) === 'Ejecutado').length, actualizadoPor: POR, actualizadoEn: ahora })));
  // Historial semanal
  for (const a of actas) await db.collection('actas/' + slug + '/historial').add(a);
  for (const c of califs) await db.collection('calificaciones/' + slug + '/historial').add(c);
  for (const p of pacs) await db.collection('pac/' + slug + '/historial').add(p);
  await db.doc('estadoEjecucion/' + slug).set({ elementosBIM: Object.fromEntries(estado), elementosNoEjecutadosBIM: Object.fromEntries(noEjec), actualizadoEn: ahora });
  return Object.assign({ escrito: true }, resumenCifras);
}
