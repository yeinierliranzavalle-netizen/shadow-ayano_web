const WORKER_URL = 'https://shadow-ayano.yeinierliranzavalle.workers.dev';
const UID = 'comandante';
const LIMITE_HISTORIAL = 200;
const MAX_ARCHIVO = 20 * 1024 * 1024;
const DRAFT_INTERVAL = 2500;

const log = document.getElementById('log');
const welcome = document.getElementById('welcome');
const msg = document.getElementById('msg');
const send = document.getElementById('send');
const dot = document.getElementById('dot');
const stat = document.getElementById('stat');
const panel = document.getElementById('panel');
const panelT = document.getElementById('panelT');
const panelB = document.getElementById('panelB');
const fileIn = document.getElementById('file');
const metaInfo = document.getElementById('meta-info');
const scrollBtn = document.getElementById('scrollBtn');
const scanLine = document.getElementById('scanLine');
const sidePanel = document.getElementById('side-panel');
const widgetsToggle = document.getElementById('widgetsToggle');
const panelClose = document.getElementById('panelClose');

let busy = false;
let draftTimer = null;

async function api(path, opts = {}) {
  const r = await fetch(WORKER_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  return r.json();
}

function horaActual(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function renderizarMarkdown(texto) {
  let html = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => '<pre><code>' + code.trim() + '</code></pre>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function addCopyButton(pre) {
  if (pre.querySelector('.copy-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.textContent = 'copiar';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const code = pre.querySelector('code') || pre;
    try {
      await navigator.clipboard.writeText(code.textContent);
      btn.textContent = '✓'; btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'copiar'; btn.classList.remove('copied'); }, 1800);
    } catch (err) {}
  });
  pre.appendChild(btn);
}

function add(texto, tipo = 'a', etiqueta = '', conCorreccion = false, timestamp = null) {
  if (welcome && welcome.parentNode) welcome.remove();
  const d = document.createElement('div');
  d.className = 'msg ' + tipo;
  
  if (etiqueta) {
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.innerHTML = `<span>${etiqueta}</span><span class="time">${horaActual(timestamp)}</span>`;
    d.appendChild(lbl);
  }
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = renderizarMarkdown(texto);
  d.appendChild(bubble);
  
  d.querySelectorAll('pre').forEach(pre => addCopyButton(pre));
  
  if (conCorreccion && tipo === 'a') {
    const btn = document.createElement('button');
    btn.className = 'corregir-btn';
    btn.textContent = '✎ corregir voz';
    btn.addEventListener('click', async () => {
      const correccion = window.prompt('¿Qué debería haber dicho/sonado distinto?');
      if (!correccion) return;
      try {
        await api('/api/corregir', { method: 'POST', body: JSON.stringify({ correccion }) });
        add('Corrección guardada.', 's');
      } catch (e) { add('Error: ' + e.message, 'e'); }
    });
    d.appendChild(btn);
  }
  
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}

function addTyping() {
  if (welcome && welcome.parentNode) welcome.remove();
  const d = document.createElement('div');
  d.className = 'msg a';
  d.innerHTML = '<div class="lbl"><span>Ayanokōji</span><span class="time">' + horaActual() + '</span></div><div class="bubble"><div class="typing"><i></i><i></i><i></i></div></div>';
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}

async function checkEstado() {
  try {
    const d = await api('/api/estado');
    if (d && d.estado === 'activo') {
      dot.classList.add('on'); stat.textContent = 'activo';
      if (d.v) document.getElementById('version-tag').textContent = 'v' + d.v;
    } else {
      dot.classList.remove('on'); stat.textContent = 'error';
    }
  } catch (e) {
    dot.classList.remove('on'); stat.textContent = 'sin conexión';
  }
}

async function checkModos() {
  const modos = ['arquitecto', 'intensivo', 'ausente'];
  const elMap = { arquitecto: 'modo-arquitecto', intensivo: 'modo-intensivo', ausente: 'modo-ausente' };
  for (const modo of modos) {
    const el = document.getElementById(elMap[modo]);
    if (!el) continue;
    try {
      const r = await fetch(WORKER_URL + '/api/kv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'leer', clave: 'modo_' + modo })
      });
      const d = await r.json();
      el.classList.toggle('active', d.valor === 'true');
    } catch (e) {}
  }
}

async function guardarDraft() {
  const texto = msg.value.trim();
  if (!texto) {
    try { await fetch(WORKER_URL + '/api/draft?user_id=' + UID, { method: 'DELETE' }); } catch (e) {}
    return;
  }
  try {
    await fetch(WORKER_URL + '/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: UID, texto })
    });
  } catch (e) {}
}

async function cargarDraft() {
  try {
    const d = await api('/api/draft?user_id=' + UID);
    if (d.draft && d.draft.texto && !msg.value.trim()) {
      msg.value = d.draft.texto;
      msg.dispatchEvent(new Event('input'));
    }
  } catch (e) {}
}

async function enviar() {
  const texto = msg.value.trim();
  if (!texto || busy) return;
  busy = true; send.disabled = true;
  msg.value = ''; msg.style.height = '26px';
  metaInfo.textContent = '';
  try { await fetch(WORKER_URL + '/api/draft?user_id=' + UID, { method: 'DELETE' }); } catch (e) {}
  
  const tEnv = Date.now();
  add(texto, 'u', 'Comandante', false, tEnv);
  scanLine.classList.add('active');
  const t = addTyping();
  
  try {
    const d = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ mensaje: texto, user_id: UID })
    });
    t.remove();
    scanLine.classList.remove('active');
    const tResp = Date.now();
    add(d.respuesta || d.error || 'sin respuesta', 'a', 'Ayanokōji', true, tResp);
    
    if (d.intencion && d.intencion !== 'chat') {
      metaInfo.textContent = '→ ' + d.intencion;
      setTimeout(() => { if (metaInfo.textContent === '→ ' + d.intencion) metaInfo.textContent = ''; }, 3000);
    }
    if (d.modo_arquitecto_activo || d.modo_intensivo_activo || d.modo_activo) {
      checkModos();
    }
    cargarWidgets();
  } catch (e) {
    t.remove();
    scanLine.classList.remove('active');
    add('Error de conexión: ' + e.message, 'e');
  }
  busy = false; send.disabled = false; msg.focus();
}

send.addEventListener('click', enviar);

msg.addEventListener('input', () => {
  msg.style.height = 'auto';
  msg.style.height = Math.min(msg.scrollHeight, 180) + 'px';
});

msg.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault(); enviar();
  }
});

log.addEventListener('scroll', () => {
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  scrollBtn.classList.toggle('on', !nearBottom && log.scrollHeight > log.clientHeight + 100);
});
scrollBtn.addEventListener('click', () => log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' }));

document.querySelectorAll('.chip').forEach(c => {
  c.addEventListener('click', () => {
    msg.value = c.dataset.t;
    msg.dispatchEvent(new Event('input'));
    enviar();
  });
});

// Draft auto-save
msg.addEventListener('input', () => {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(guardarDraft, DRAFT_INTERVAL);
});

// SIDE PANEL
widgetsToggle.addEventListener('click', () => sidePanel.classList.add('open'));
panelClose.addEventListener('click', () => sidePanel.classList.remove('open'));

document.querySelectorAll('.widget').forEach(w => {
  w.addEventListener('click', () => {
    abrirWidget(w.dataset.view);
    if (window.innerWidth <= 820) sidePanel.classList.remove('open');
  });
});

// WIDGETS
async function cargarWidgets() {
  try {
    const conf = await api('/api/confianza').catch(() => ({}));
    if (conf.actual !== undefined) {
      document.getElementById('w-confianza').textContent = conf.actual + '/100';
      document.getElementById('w-confianza-bar').style.width = conf.actual + '%';
    }
  } catch (e) {}
  
  try {
    const mis = await api('/api/mision').catch(() => ({}));
    document.getElementById('w-mision').textContent = mis.mision?.fase_actual || 'sin misión';
  } catch (e) {}
  
  try {
    const dia = await api('/api/diario/leer?limite=1').catch(() => ({}));
    const ult = dia.entradas && dia.entradas[0];
    document.getElementById('w-pensamiento').textContent = ult ? ult.entrada.substring(0, 40) + '…' : 'sin entradas';
  } catch (e) {}
  
  try {
    const act = await api('/api/actividad').catch(() => ({}));
    document.getElementById('w-actividad').textContent = act.ultima_accion || '—';
  } catch (e) {}
  
  try {
    const not = await api('/api/notificaciones').catch(() => ({}));
    document.getElementById('w-bandeja').textContent = (not.no_leidas || 0).toString();
  } catch (e) {}
  
  try {
    const ex = await api('/api/examen/pendiente').catch(() => ({}));
    document.getElementById('w-examen').textContent = ex.pendiente ? '1 pendiente' : 'libre';
  } catch (e) {}
  
  try {
    const sb = await api('/api/sandbox').catch(() => ({}));
    const total = (sb.escenarios || []).length;
    document.getElementById('w-sandbox').textContent = total.toString();
  } catch (e) {}
  
  try {
    const dec = await api('/api/decisiones').catch(() => ({}));
    document.getElementById('w-decisiones').textContent = ((dec.decisiones || []).length).toString();
  } catch (e) {}
  
  try {
    const sh = await api('/api/shadow_stats').catch(() => ({}));
    document.getElementById('w-shadow').textContent = (sh.stats?.usuarios_totales || 0).toString();
  } catch (e) {}
  
  try {
    const sys = await api('/api/capacidades').catch(() => ({}));
    if (sys.limites_cloudflare?.d1_reads) {
      document.getElementById('w-stats').textContent = 'D1 ' + (sys.limites_cloudflare.d1_reads.pct || 0) + '%';
    } else {
      document.getElementById('w-stats').textContent = 'ver';
    }
  } catch (e) {}
  
  try {
    const est = await api('/api/estrategias').catch(() => ({}));
    document.getElementById('w-estrategias').textContent = ((est.estrategias || []).length).toString();
  } catch (e) {}
  
  try {
    const ideas = await fetch(WORKER_URL + '/api/d1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'leer', tabla: 'contexto', condicion: "WHERE fuente='idea'" })
    }).then(r => r.json()).catch(() => ({}));
    document.getElementById('w-ideas').textContent = ((ideas.resultado || []).length).toString();
  } catch (e) {}
}

// MODAL WIDGET
function abrirModal(titulo) {
  panelT.textContent = titulo;
  panel.classList.add('on');
}
function cerrarModal() { panel.classList.remove('on'); }
document.getElementById('panelX').addEventListener('click', cerrarModal);
panel.addEventListener('click', (e) => { if (e.target === panel) cerrarModal(); });

async function abrirWidget(view) {
  abrirModal(view.toUpperCase());
  panelB.innerHTML = '<div class="empty">cargando…</div>';
  
  try {
    if (view === 'confianza') return await modalConfianza();
    if (view === 'mision') return await modalMision();
    if (view === 'pensamiento') return await modalPensamiento();
    if (view === 'actividad') return await modalActividad();
    if (view === 'bandeja') return await modalBandeja();
    if (view === 'calibracion') return await modalCalibracion();
    if (view === 'sandbox') return await modalSandbox();
    if (view === 'decisiones') return await modalDecisiones();
    if (view === 'shadow') return await modalShadow();
    if (view === 'stats') return await modalStats();
    if (view === 'estrategias') return await modalEstrategias();
    if (view === 'ideas') return await modalIdeas();
  } catch (e) {
    panelB.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
}

async function modalConfianza() {
  const c = await api('/api/confianza');
  if (c.error) { panelB.innerHTML = `<div class="empty">${c.error}</div>`; return; }
  const sig = c.siguiente_desbloqueo;
  let html = `<div class="metric-grid">
    <div class="metric-card"><div class="lbl">Confianza</div><div class="val">${c.actual}/100</div></div>
    <div class="metric-card"><div class="lbl">Faltan</div><div class="val">${c.faltan}</div></div>
  </div>`;
  if (sig) html += `<div class="card"><h4>Próximo desbloqueo</h4><div class="v">${sig.descripcion}</div></div>`;
  panelB.innerHTML = html;
}

async function modalMision() {
  const m = await api('/api/mision');
  const mi = m.mision || {};
  let html = '<div class="card"><h4>Misión actual</h4>';
  if (mi.fase_actual) html += `<div class="v"><strong>Fase:</strong> ${mi.fase_actual}</div>`;
  if (mi.objetivo_semana) html += `<div class="v"><strong>Objetivo:</strong> ${mi.objetivo_semana}</div>`;
  if (mi.siguiente_paso) html += `<div class="v"><strong>Siguiente:</strong> ${mi.siguiente_paso}</div>`;
  if (!mi.fase_actual) html += '<div class="empty">Sin misión definida aún.</div>';
  html += '</div>';
  panelB.innerHTML = html;
}

async function modalPensamiento() {
  const d = await api('/api/diario/leer?limite=15');
  if (!d.entradas || !d.entradas.length) { panelB.innerHTML = '<div class="empty">Sin entradas de diario aún.</div>'; return; }
  panelB.innerHTML = d.entradas.map(e => {
    const fecha = new Date(e.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<div class="item"><div class="k">${e.tipo || 'observación'} · ${fecha}</div><div class="v">${(e.entrada || '').substring(0, 500)}</div></div>`;
  }).join('');
}

async function modalActividad() {
  const a = await api('/api/actividad');
  if (!a.acciones || !a.acciones.length) { panelB.innerHTML = '<div class="empty">Sin actividad aún.</div>'; return; }
  panelB.innerHTML = a.acciones.slice(0, 30).map(x => {
    const fecha = new Date(x.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `<div class="item"><div class="k">${x.tipo} · ${fecha}</div><div class="v">${(x.descripcion || '').substring(0, 200)}</div></div>`;
  }).join('');
}

async function modalBandeja() {
  const d = await api('/api/notificaciones');
  if (!d.notificaciones || !d.notificaciones.length) { panelB.innerHTML = '<div class="empty">Bandeja vacía.</div>'; return; }
  panelB.innerHTML = '<div class="idea-box" style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:var(--fg2)">Notificaciones del sistema</span><button id="marcar-leidas">Marcar leídas</button></div>' +
    d.notificaciones.map(n => {
      const fecha = new Date(n.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `<div class="item"><div class="k">${n.tipo} · ${fecha}</div><div class="v"><strong>${n.titulo || ''}</strong><br>${n.mensaje || ''}</div></div>`;
    }).join('');
  const btn = document.getElementById('marcar-leidas');
  if (btn) btn.addEventListener('click', async () => {
    await api('/api/notificaciones/leer', { method: 'POST', body: JSON.stringify({ ids: [] }) });
    abrirWidget('bandeja');
    cargarWidgets();
  });
}

async function modalCalibracion() {
  const pend = await api('/api/examen/pendiente');
  const hist = await api('/api/examen/listar');
  let html = '';
  
  if (pend.pendiente) {
    const p = pend.pendiente;
    html += `<div class="card" style="border-color:var(--cyan)"><h4>Pregunta pendiente</h4>
      <div class="v" style="margin-bottom:12px">${p.pregunta}</div>`;
    html += `<button class="respuesta-btn" data-id="${p.id}" data-resp="A">A) ${p.opcion_a}</button>`;
    html += `<button class="respuesta-btn" data-id="${p.id}" data-resp="B">B) ${p.opcion_b}</button>`;
    if (p.opcion_c) html += `<button class="respuesta-btn" data-id="${p.id}" data-resp="C">C) ${p.opcion_c}</button>`;
    html += '</div>';
  } else {
    html += `<div class="card"><h4>Sin preguntas pendientes</h4>
      <div class="v" style="margin-bottom:12px">Ayanokōji puede generar una pregunta de criterio.</div>
      <button id="gen-examen" style="background:var(--cyan);color:#000;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-family:var(--mono);font-weight:600">Generar pregunta</button></div>`;
  }
  
  if (hist.estadisticas) {
    html += `<div class="metric-grid">
      <div class="metric-card"><div class="lbl">Total</div><div class="val">${hist.estadisticas.total || 0}</div></div>
      <div class="metric-card"><div class="lbl">Aciertos</div><div class="val ok">${hist.estadisticas.aciertos || 0}</div></div>
      <div class="metric-card"><div class="lbl">% Acierto</div><div class="val">${hist.estadisticas.porcentaje || 0}%</div></div>
    </div>`;
  }
  
  panelB.innerHTML = html;
  
  document.querySelectorAll('.respuesta-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const r = await api('/api/examen/responder', { method: 'POST', body: JSON.stringify({ id: parseInt(btn.dataset.id), respuesta: btn.dataset.resp }) });
      if (r.error) { alert(r.error); btn.disabled = false; return; }
      const color = r.acierto ? 'var(--ok)' : 'var(--err)';
      panelB.innerHTML = `<div class="card"><h4>Resultado</h4>
        <div class="v" style="color:${color};font-size:15px;font-weight:600">${r.acierto ? '✓ ACERTÓ' : '✗ FALLÓ'}</div>
        <div class="v" style="margin-top:6px">Tu respuesta: <strong>${btn.dataset.resp}</strong> · Predicción: <strong>${r.respuesta_correcta}</strong></div>
        ${r.razon_prediccion ? `<div class="v" style="margin-top:6px;color:var(--fg2)">${r.razon_prediccion}</div>` : ''}
        <div class="v" style="margin-top:6px">Confianza: <strong>${r.confianza?.actual || 0}/100</strong></div></div>`;
      setTimeout(() => abrirWidget('calibracion'), 2500);
      cargarWidgets();
    });
  });
  
  const gen = document.getElementById('gen-examen');
  if (gen) gen.addEventListener('click', async () => {
    gen.disabled = true; gen.textContent = 'Generando...';
    const r = await api('/api/examen/generar', { method: 'POST' });
    if (r.error) { alert(r.error); gen.disabled = false; gen.textContent = 'Generar pregunta'; return; }
    abrirWidget('calibracion');
  });
}

async function modalSandbox() {
  const d = await api('/api/sandbox');
  const esc = d.escenarios || [];
  let html = `<div class="metric-grid">
    <div class="metric-card"><div class="lbl">Escenarios</div><div class="val">${esc.length}</div></div>
    <div class="metric-card"><div class="lbl">Resueltos</div><div class="val ok">${esc.filter(e => e.completado).length}</div></div>
  </div>`;
  if (!esc.length) html += '<div class="empty">Sin escenarios aún. El cron los genera.</div>';
  else html += esc.slice(0, 15).map(e => {
    const fecha = new Date(e.creado).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<div class="item"><div class="k">${e.tipo} · ${fecha} · ${e.completado ? 'resuelto' : 'pendiente'}</div><div class="v">${(e.contexto || '').substring(0, 300)}</div></div>`;
  }).join('');
  panelB.innerHTML = html;
}

async function modalDecisiones() {
  const d = await api('/api/decisiones');
  if (!d.decisiones || !d.decisiones.length) { panelB.innerHTML = '<div class="empty">Sin decisiones aún.</div>'; return; }
  panelB.innerHTML = d.decisiones.slice(0, 30).map(x => {
    const fecha = new Date(x.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<div class="item"><div class="k">${x.tipo} · ${fecha}</div><div class="v"><strong>${(x.decision || '').substring(0, 200)}</strong>${x.resultado ? `<br><span style="color:var(--fg2);font-size:12px">${x.resultado.substring(0, 200)}</span>` : ''}</div></div>`;
  }).join('');
}

async function modalShadow() {
  const d = await api('/api/shadow_stats');
  if (d.error) { panelB.innerHTML = `<div class="empty">${d.error}</div>`; return; }
  const s = d.stats || {};
  panelB.innerHTML = `<div class="metric-grid">
    <div class="metric-card"><div class="lbl">Usuarios</div><div class="val">${s.usuarios_totales || 0}</div></div>
    <div class="metric-card"><div class="lbl">De pago</div><div class="val ok">${s.usuarios_pago || 0}</div></div>
    <div class="metric-card"><div class="lbl">Activos hoy</div><div class="val">${s.usuarios_activos_dia || 0}</div></div>
    <div class="metric-card"><div class="lbl">Ingresos</div><div class="val">${s.ingresos_mes || 0}</div></div>
  </div>
  <div class="card"><h4>Resumen</h4><div class="v">${d.resumen_ayanokoji || 'Sin datos.'}</div></div>`;
}

async function modalStats() {
  const d = await api('/api/capacidades');
  if (d.error) { panelB.innerHTML = `<div class="empty">${d.error}</div>`; return; }
  let html = '<div class="card"><h4>Cloudflare hoy</h4>';
  const lim = d.limites_cloudflare || {};
  for (const [k, v] of Object.entries(lim)) {
    if (!v || v.pct == null) continue;
    const color = v.pct > 80 ? 'var(--err)' : v.pct > 50 ? 'var(--warn)' : 'var(--ok)';
    html += `<div class="stat-row"><span class="stat-name">${k.replace(/_/g,' ')}</span><div class="bar"><div class="bar-i" style="width:${Math.min(v.pct,100)}%;background:${color}"></div></div><span class="stat-val">${v.pct}%</span></div>`;
  }
  html += '</div>';
  html += `<div class="card"><h4>Sistema</h4>
    <div class="stat-row"><span class="stat-name">Mensajes historial</span><span class="stat-val">${d.mensajes_historial || 0}</span></div>
    <div class="stat-row"><span class="stat-name">Procesos activos</span><span class="stat-val">${d.procesos_activos || 0}</span></div>
    <div class="stat-row"><span class="stat-name">Temas indexados</span><span class="stat-val">${d.temas_indexados || 0}</span></div>
  </div>`;
  panelB.innerHTML = html;
}

async function modalEstrategias() {
  const d = await api('/api/estrategias');
  if (!d.estrategias || !d.estrategias.length) { panelB.innerHTML = '<div class="empty">Sin estrategias activas.</div>'; return; }
  panelB.innerHTML = d.estrategias.map(e => {
    const fecha = new Date(e.creada || Date.now()).toLocaleDateString('es-ES');
    return `<div class="item"><div class="k">${e.tipo} · prioridad ${e.prioridad} · ${fecha}</div><div class="v"><strong>${e.nombre}</strong><br><span style="color:var(--fg2);font-size:12.5px">${e.contenido}</span></div></div>`;
  }).join('');
}

async function modalIdeas() {
  const r = await fetch(WORKER_URL + '/api/d1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'leer', tabla: 'contexto', condicion: "WHERE fuente='idea' ORDER BY fecha DESC LIMIT 50" })
  });
  const d = await r.json();
  let html = '<div class="idea-box"><textarea id="idea-input" placeholder="Escribe una idea, tarea futura, o pensamiento..."></textarea><button id="idea-save">Guardar idea</button></div>';
  if (d.resultado && d.resultado.length) {
    html += d.resultado.map(i => {
      const fecha = new Date(i.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `<div class="item"><div class="k">${fecha}</div><div class="v">${(i.resumen || '')}</div></div>`;
    }).join('');
  } else {
    html += '<div class="empty">Sin ideas aún.</div>';
  }
  panelB.innerHTML = html;
  document.getElementById('idea-save').addEventListener('click', async () => {
    const ta = document.getElementById('idea-input');
    const texto = ta.value.trim();
    if (!texto) return;
    await fetch(WORKER_URL + '/api/d1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'escribir', tabla: 'contexto', datos: { fecha: Date.now(), resumen: texto, fases: JSON.stringify([texto]), fuente: 'idea' } })
    });
    modalIdeas();
    cargarWidgets();
  });
}

// TOOLS
document.getElementById('btnFile').addEventListener('click', () => fileIn.click());
fileIn.addEventListener('change', async () => {
  const f = fileIn.files[0];
  if (!f) return;
  if (f.size > MAX_ARCHIVO) { add('El archivo supera 20MB', 'e'); fileIn.value = ''; return; }
  const nombre = f.name.toLowerCase();
  const esJSON = nombre.endsWith('.json');
  if (esJSON && confirm('¿Importar como historial largo?')) {
    add('Importando "' + f.name + '"...', 's');
    const fd = new FormData();
    fd.append('archivo', f);
    fd.append('user_id', UID);
    fd.append('limite', '2000');
    try {
      const r = await fetch(WORKER_URL + '/api/importar', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.error) add('Error: ' + d.error, 'e');
      else add('Importado · ' + d.insertados + ' mensajes.', 's');
    } catch (e) { add('Error: ' + e.message, 'e'); }
    fileIn.value = ''; return;
  }
  add('Subiendo "' + f.name + '"...', 's');
  const fd = new FormData();
  fd.append('archivo', f);
  fd.append('nombre', f.name);
  fd.append('destino', 'agente');
  fd.append('autoProcesar', 'false');
  try {
    const r = await fetch(WORKER_URL + '/api/subir', { method: 'POST', body: fd });
    const d = await r.json();
    if (d.error) add('Error: ' + d.error, 'e');
    else add('Archivo guardado · ID: ' + d.id, 's');
  } catch (e) { add('Error: ' + e.message, 'e'); }
  fileIn.value = '';
});

document.getElementById('btnImagen').addEventListener('click', async () => {
  const prompt = window.prompt('Describe la imagen a generar:');
  if (!prompt) return;
  add('Generando: "' + prompt + '"...', 's');
  scanLine.classList.add('active');
  try {
    const d = await api('/api/imagen', { method: 'POST', body: JSON.stringify({ prompt, user_id: UID }) });
    scanLine.classList.remove('active');
    if (d.error) add('Error: ' + d.error, 'e');
    else if (d.url) add('![imagen](' + WORKER_URL + d.url + ')\n\nID: `' + d.id + '`', 'a', 'Ayanokōji', true);
  } catch (e) { scanLine.classList.remove('active'); add('Error: ' + e.message, 'e'); }
});

document.getElementById('btnDiag').addEventListener('click', async () => {
  add('Diagnóstico...', 's');
  try {
    const d = await api('/api/salud');
    add('SALUD:\n' + JSON.stringify(d, null, 2).substring(0, 2500), 's');
  } catch (e) { add('Error: ' + e.message, 'e'); }
});

document.getElementById('btnCorregir').addEventListener('click', async () => {
  const correccion = window.prompt('¿Qué debería sonar distinto en Ayanokōji?');
  if (!correccion) return;
  try {
    await api('/api/corregir', { method: 'POST', body: JSON.stringify({ correccion }) });
    add('Corrección guardada.', 's');
  } catch (e) { add('Error: ' + e.message, 'e'); }
});

// HISTORIAL
async function cargarHistorialLargo() {
  try {
    const d = await api('/api/historial_largo?user_id=' + encodeURIComponent(UID) + '&limite=' + LIMITE_HISTORIAL);
    if (!d.historial || !d.historial.length) return;
    if (welcome && welcome.parentNode) welcome.remove();
    const marca = document.createElement('div');
    marca.className = 'msg s';
    marca.textContent = '— historial previo · ' + d.historial.length + ' mensajes —';
    log.appendChild(marca);
    
    for (const m of d.historial) {
      const rol = m.rol === 'assistant' ? 'a' : 'u';
      const etiqueta = m.rol === 'assistant' ? 'Ayanokōji' : 'Comandante';
      const d2 = document.createElement('div');
      d2.className = 'msg ' + rol;
      const lbl = document.createElement('div');
      lbl.className = 'lbl';
      lbl.innerHTML = `<span>${etiqueta}</span><span class="time">${m.fecha_formateada || horaActual(m.fecha)}</span>`;
      d2.appendChild(lbl);
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.innerHTML = renderizarMarkdown(m.contenido || '');
      d2.appendChild(bubble);
      d2.querySelectorAll('pre').forEach(pre => addCopyButton(pre));
      log.appendChild(d2);
    }
    const fin = document.createElement('div');
    fin.className = 'msg s';
    fin.textContent = '— fin del historial —';
    log.appendChild(fin);
    log.scrollTop = log.scrollHeight;
  } catch (e) {}
}

// INIT
checkEstado();
setInterval(checkEstado, 30000);
cargarHistorialLargo();
cargarDraft();
cargarWidgets();
setTimeout(checkModos, 1000);
setInterval(checkModos, 30000);
setInterval(cargarWidgets, 60000);
msg.focus();
