const WORKER_URL = 'https://shadow-ayano.yeinierliranzavalle.workers.dev';
const UID = 'comandante';
const LIMITE_HISTORIAL = 500;
const MAX_ARCHIVO = 20 * 1024 * 1024;

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
const backToChat = document.getElementById('backToChat');
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');

let busy = false;
let procTimer = null;
let currentView = 'chat';
let scrollChatGuardado = 0;

async function api(path, opts = {}) {
  const r = await fetch(WORKER_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  return r.json();
}

async function registrarConciencia(accion, detalle, pestana) {
  try {
    await fetch(WORKER_URL + '/api/conciencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, detalle, pestana, user_id: UID })
    });
  } catch (e) {}
}

// ============================================================
// NAVEGACIÓN
// ============================================================
function cambiarVista(v) {
  if (v === currentView) return;
  if (currentView === 'chat' && log) scrollChatGuardado = log.scrollTop;

  document.body.dataset.view = v;
  tabs.forEach(x => x.classList.toggle('active', x.dataset.view === v));
  views.forEach(x => x.classList.toggle('active', x.id === 'view-' + v));
  currentView = v;
  backToChat.classList.toggle('on', v !== 'chat');
  registrarConciencia('abrir_pestana', v, v);

  if (v === 'stats') cargarStats();
  if (v === 'sandbox') cargarSandbox();
  if (v === 'estrategias') cargarEstrategias();
  if (v === 'actividad') cargarActividad();
  if (v === 'ideas') cargarIdeas();
  if (v === 'bandeja') cargarNotificaciones();
  if (v === 'decisiones') cargarDecisiones();
  if (v === 'shadow') cargarShadow();

  if (v === 'chat') {
    setTimeout(() => { if (log) log.scrollTop = scrollChatGuardado; }, 20);
  }
}

tabs.forEach(t => t.addEventListener('click', () => cambiarVista(t.dataset.view)));
backToChat.addEventListener('click', () => cambiarVista('chat'));

// ============================================================
// UTILIDADES
// ============================================================
function addCopyButton(pre) {
  if (pre.querySelector('.copy-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.textContent = 'Copiar';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const code = pre.querySelector('code') || pre;
    try {
      await navigator.clipboard.writeText(code.textContent);
      btn.textContent = '✓ Copiado'; btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2000);
    } catch (err) {
      const range = document.createRange();
      range.selectNodeContents(code);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('copy'); sel.removeAllRanges();
      btn.textContent = '✓ Copiado'; btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2000);
    }
  });
  pre.style.position = 'relative';
  pre.appendChild(btn);
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

function addCorregirButton(container) {
  const btn = document.createElement('button');
  btn.className = 'corregir-btn';
  btn.textContent = '✏️ Corregir voz';
  btn.addEventListener('click', async () => {
    const correccion = window.prompt('¿Qué debería haber dicho/sonado distinto?');
    if (!correccion) return;
    try {
      await api('/api/corregir', { method: 'POST', body: JSON.stringify({ correccion }) });
      add('Corrección guardada como capa. Núcleo intacto.', 's');
      registrarConciencia('correccion_voz', correccion.substring(0, 200), currentView);
    } catch (e) { add('Error: ' + e.message, 'e'); }
  });
  container.appendChild(btn);
}

function add(texto, tipo = 'a', etiqueta = '', conCorreccion = false) {
  if (welcome && welcome.parentNode) welcome.remove();
  const d = document.createElement('div');
  d.className = 'msg ' + tipo;
  if (etiqueta) {
    const l = document.createElement('div');
    l.className = 'lbl'; l.textContent = etiqueta;
    d.appendChild(l);
  }
  const t = document.createElement('div');
  t.innerHTML = renderizarMarkdown(texto);
  d.appendChild(t);
  d.querySelectorAll('pre').forEach(pre => addCopyButton(pre));
  if (conCorreccion && tipo === 'a') addCorregirButton(d);
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}

function addTyping() {
  if (welcome && welcome.parentNode) welcome.remove();
  const d = document.createElement('div');
  d.className = 'msg a';
  d.innerHTML = '<div class="lbl">Ayanokōji</div><div class="typing"><i></i><i></i><i></i></div>';
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}

async function checkEstado() {
  try {
    const d = await api('/api/estado');
    if (d && d.estado === 'activo') {
      dot.classList.add('on'); stat.textContent = 'activo';
    } else {
      dot.classList.remove('on'); stat.textContent = 'error';
    }
  } catch (e) {
    dot.classList.remove('on'); stat.textContent = 'sin conexión';
  }
}

async function enviar() {
  const texto = msg.value.trim();
  if (!texto || busy) return;
  busy = true; send.disabled = true;
  msg.value = ''; msg.style.height = '26px';
  add(texto, 'u', 'Comandante');
  registrarConciencia('mensaje_chat', texto.substring(0, 300), currentView);
  const t = addTyping();
  try {
    const d = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ mensaje: texto, user_id: UID })
    });
    t.remove();
    add(d.respuesta || d.error || 'sin respuesta', 'a', 'Ayanokōji', true);
    if (d.intencion && d.intencion !== 'chat') {
      metaInfo.textContent = '· ' + d.intencion;
      setTimeout(() => metaInfo.textContent = '', 3000);
    }
  } catch (e) {
    t.remove();
    add('Error de conexión: ' + e.message, 'e');
  }
  busy = false; send.disabled = false; msg.focus();
}

send.addEventListener('click', enviar);

document.querySelectorAll('.chip').forEach(c => {
  c.addEventListener('click', () => {
    msg.value = c.dataset.t;
    msg.dispatchEvent(new Event('input'));
    enviar();
  });
});

async function cargarHistorialLargo() {
  try {
    const d = await api('/api/historial_largo?user_id=' + encodeURIComponent(UID) + '&limite=' + LIMITE_HISTORIAL);
    if (!d.historial || !d.historial.length) return;
    if (welcome && welcome.parentNode) welcome.remove();
    const marca = document.createElement('div');
    marca.className = 'msg s';
    marca.textContent = '—— Historial previo · ' + d.historial.length + ' mensajes ——';
    log.appendChild(marca);
    for (const m of d.historial) {
      const rol = m.rol === 'assistant' ? 'a' : 'u';
      const etiqueta = m.rol === 'assistant' ? 'Ayanokōji' : 'Comandante';
      const d2 = document.createElement('div');
      d2.className = 'msg ' + rol;
      const l = document.createElement('div');
      l.className = 'lbl'; l.textContent = etiqueta;
      d2.appendChild(l);
      const t2 = document.createElement('div');
      t2.innerHTML = renderizarMarkdown(m.contenido || '');
      d2.appendChild(t2);
      d2.querySelectorAll('pre').forEach(pre => addCopyButton(pre));
      log.appendChild(d2);
    }
    const fin = document.createElement('div');
    fin.className = 'msg s';
    fin.textContent = '—— Fin del historial · continúa la conversación ——';
    log.appendChild(fin);
    log.scrollTop = log.scrollHeight;
  } catch (e) {}
}

// ============================================================
// BOTONES
// ============================================================
document.getElementById('btnFile').addEventListener('click', () => fileIn.click());

document.getElementById('btnImagen')?.addEventListener('click', async () => {
  const prompt = window.prompt('Describe la imagen a generar:');
  if (!prompt) return;
  add('Generando imagen: "' + prompt + '"...', 's');
  try {
    const d = await api('/api/imagen', { method: 'POST', body: JSON.stringify({ prompt, user_id: UID }) });
    if (d.error) add('Error: ' + d.error, 'e');
    else if (d.url) add('![imagen](' + WORKER_URL + d.url + ')\n\nID: `' + d.id + '`', 'a', 'Ayanokōji', true);
  } catch (e) { add('Error: ' + e.message, 'e'); }
});

document.getElementById('btnIndexar')?.addEventListener('click', async () => {
  if (!confirm('¿Indexar el historial largo? Tarda 10-20 min.')) return;
  add('Indexando historial largo...', 's');
  registrarConciencia('indexar', 'iniciado', currentView);
  try {
    const r = await fetch(WORKER_URL + '/api/indexar', { method: 'POST' });
    const d = await r.json();
    if (d.error) add('Error: ' + d.error, 'e');
    else add(`Indexado.\nModo: ${d.modo}\nProcesados: ${d.procesados}/${d.total}\nTemas insertados: ${d.temas_insertados}`, 's');
  } catch (e) { add('Error: ' + e.message, 'e'); }
});

document.getElementById('btnMigrar')?.addEventListener('click', async () => {
  if (!confirm('¿Forzar migración de tablas?')) return;
  add('Migrando...', 's');
  try {
    const r = await fetch(WORKER_URL + '/api/migrar', { method: 'POST' });
    const d = await r.json();
    add('Migración:\n' + JSON.stringify(d, null, 2), 's');
  } catch (e) { add('Error: ' + e.message, 'e'); }
});

document.getElementById('btnDiag')?.addEventListener('click', async () => {
  add('Cargando diagnóstico...', 's');
  try {
    const d = await api('/api/diagnostico');
    add('DIAGNÓSTICO:\n' + JSON.stringify(d, null, 2).substring(0, 2500), 's');
  } catch (e) { add('Error: ' + e.message, 'e'); }
});

document.getElementById('btnCorregir')?.addEventListener('click', async () => {
  const correccion = window.prompt('¿Qué debería sonar distinto en Ayanokōji?');
  if (!correccion) return;
  try {
    await api('/api/corregir', { method: 'POST', body: JSON.stringify({ correccion }) });
    add('Corrección guardada como capa. Núcleo intacto.', 's');
  } catch (e) { add('Error: ' + e.message, 'e'); }
});

fileIn.addEventListener('change', async () => {
  const f = fileIn.files[0];
  if (!f) return;
  if (f.size > MAX_ARCHIVO) {
    add('El archivo supera ' + (MAX_ARCHIVO / 1048576) + 'MB', 'e');
    fileIn.value = ''; return;
  }
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
      else add('Importado · ' + d.insertados + ' mensajes de ' + d.total + '.', 's');
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

// ============================================================
// PANEL
// ============================================================
function abrirPanel(titulo) { panelT.textContent = titulo; panel.classList.add('on'); }
function cerrarPanel() {
  panel.classList.remove('on');
  if (procTimer) { clearInterval(procTimer); procTimer = null; }
}
document.getElementById('panelX').addEventListener('click', cerrarPanel);
panel.addEventListener('click', (e) => { if (e.target === panel) cerrarPanel(); });

async function abrirProcesos() {
  abrirPanel('Procesos activos');
  panelB.innerHTML = '<div class="empty">cargando...</div>';
  await refrescarProcesos();
  if (procTimer) clearInterval(procTimer);
  procTimer = setInterval(refrescarProcesos, 10000);
}

async function refrescarProcesos() {
  try {
    const d = await api('/api/proceso');
    if (!d.procesos || !d.procesos.length) {
      panelB.innerHTML = '<div class="empty">Sin procesos registrados.</div>'; return;
    }
    panelB.innerHTML = d.procesos.map(p => {
      const total = p.bloques_total || 0, hecho = p.bloques_hechos || 0;
      const pct = total > 0 ? Math.round((hecho / total) * 100) : 0;
      const cls = p.estado === 'completado' ? 'c' : p.estado === 'error' ? 'e' : 'p';
      return '<div class="item"><div class="k">ID · ' + (p.id || '').substring(0, 32) + '</div>' +
        '<div class="st ' + cls + '">' + (p.estado || '?') + '</div>' +
        (total > 0 ? '<div class="bar"><div class="bar-i" style="width:' + pct + '%"></div></div><div class="k" style="margin-top:6px">' + hecho + ' / ' + total + ' · ' + pct + '%</div>' : '') + '</div>';
    }).join('');
  } catch (e) { panelB.innerHTML = '<div class="empty">Error: ' + e.message + '</div>'; }
}
document.getElementById('btnProc').addEventListener('click', abrirProcesos);

async function abrirContexto() {
  abrirPanel('Contexto guardado');
  panelB.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const d = await api('/api/contexto');
    if (!d.contextos || !d.contextos.length) { panelB.innerHTML = '<div class="empty">Sin contexto guardado.</div>'; return; }
    const TITULOS = ['Identidad','Contexto','Objetivo','Proyecto Shadow Arise','Aliado Digital','IA Publicadora','Reglas Operativas','Decisiones Tomadas','Ideas Pendientes'];
    panelB.innerHTML = d.contextos.map(c => {
      const fecha = new Date(c.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      let fases = []; try { fases = JSON.parse(c.fases || '[]'); } catch (e) {}
      return '<div class="item"><div class="k">' + fecha + ' · fuente: ' + (c.fuente || '?') + '</div>' +
        (fases.length ? '<div class="fases">' + fases.map((f, i) => '<div class="fase"><div class="k">' + (TITULOS[i] || 'Fase ' + (i + 1)) + '</div><div class="v">' + (f || '') + '</div></div>').join('') + '</div>' : '<div class="v">' + (c.resumen || '').substring(0, 500) + '</div>') + '</div>';
    }).join('');
  } catch (e) { panelB.innerHTML = '<div class="empty">Error: ' + e.message + '</div>'; }
}
document.getElementById('btnCtx').addEventListener('click', abrirContexto);

document.getElementById('btnReset').addEventListener('click', async () => {
  if (!confirm('¿Limpiar el historial de chat y el historial largo?')) return;
  try {
    const d = await api('/api/reset', { method: 'POST', body: JSON.stringify({ user_id: UID, destino: 'agente' }) });
    add(d.message || 'Historial limpiado.', 's');
  } catch (e) { add('Error: ' + e.message, 'e'); }
});

// ============================================================
// STATS con capacidad REAL
// ============================================================
async function cargarStats() {
  const contUso = document.getElementById('uso-real-content');
  const cont = document.getElementById('stats-content');
  if (!cont || !contUso) return;

  contUso.innerHTML = '<div class="empty">cargando uso real...</div>';
  cont.innerHTML = '<div class="empty">cargando...</div>';

  // === Uso real de Cloudflare ===
  try {
    const d = await api('/api/capacidades');
    if (d.error || !d.ok) {
      contUso.innerHTML = '<div class="card"><h4>Uso Cloudflare</h4><div class="empty">' + (d.error || 'Sin datos') + '</div></div>';
    } else {
      const lim = d.limites_cloudflare || {};
      const fecha = new Date(d.fecha_consulta).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' });
      let html = '<div class="card"><h4>Uso Cloudflare hoy · ' + fecha + '</h4>';
      const recursos = [
        ['workers_requests', 'Workers requests'],
        ['d1_reads', 'D1 reads'],
        ['d1_writes', 'D1 writes'],
        ['kv_reads', 'KV reads'],
        ['kv_writes', 'KV writes']
      ];
      for (const [clave, nombre] of recursos) {
        const info = lim[clave];
        if (!info) continue;
        const pct = info.pct != null ? info.pct : (info.usado ? Math.round(info.usado / info.limite * 100) : 0);
        const color = pct > 80 ? 'var(--err)' : pct > 50 ? 'var(--warn)' : 'var(--ok)';
        html += '<div class="stat-row"><span class="stat-name">' + nombre + '</span>' +
          '<div class="bar"><div class="bar-i" style="width:' + Math.min(pct, 100) + '%;background:' + color + '"></div></div>' +
          '<span class="stat-val">' + (info.usado || 0).toLocaleString() + '/' + info.limite.toLocaleString() + '</span></div>';
      }
      if (lim.workers_errores) {
        html += '<div class="stat-row"><span class="stat-name">Workers errores</span><span class="stat-val" style="color:var(--err)">' + (lim.workers_errores.usado || 0) + '</span></div>';
      }
      if (lim.workers_subrequests) {
        html += '<div class="stat-row"><span class="stat-name">Subrequests</span><span class="stat-val">' + (lim.workers_subrequests.usado || 0).toLocaleString() + '</span></div>';
      }
      html += '</div>';

      html += '<div class="card"><h4>Estado del sistema</h4>' +
        '<div class="v">Procesos activos: <strong>' + (d.procesos_activos || 0) + '</strong></div>' +
        '<div class="v">Mensajes en historial: <strong>' + (d.mensajes_historial || 0) + '</strong></div>' +
        '<div class="v">Temas indexados: <strong>' + (d.temas_indexados || 0) + '</strong></div>' +
        '<div class="v">Modo índice: <strong>' + (d.modo_indice || 'ninguno') + '</strong></div>' +
        '</div>';

      contUso.innerHTML = html;
    }
  } catch (e) {
    contUso.innerHTML = '<div class="card"><h4>Uso Cloudflare</h4><div class="empty">Error: ' + e.message + '</div></div>';
  }

  // === Stats locales ===
  try {
    const [pres, proc, pub, ctx] = await Promise.all([
      api('/api/presupuesto').catch(() => ({})),
      api('/api/proceso').catch(() => ({ procesos: [] })),
      api('/api/publicaciones').catch(() => ({ publicaciones: [] })),
      api('/api/contexto').catch(() => ({ contextos: [] }))
    ]);
    let html = '<div class="card"><h4>Presupuesto interno diario</h4>';
    ['chat','procesamiento','sandbox','publisher','vision'].forEach(a => {
      const p = pres[a] || { usado: 0, limite: 50 };
      const pct = Math.round((p.usado / p.limite) * 100);
      html += '<div class="stat-row"><span class="stat-name">' + a + '</span><div class="bar"><div class="bar-i" style="width:' + pct + '%"></div></div><span class="stat-val">' + p.usado + '/' + p.limite + '</span></div>';
    });
    html += '</div>';
    const procesos = proc.procesos || [];
    html += '<div class="card"><h4>Procesos</h4><div class="grid-3">' +
      '<div class="metric"><div class="metric-val">' + procesos.filter(p => p.estado === 'procesando').length + '</div><div class="metric-lbl">Activos</div></div>' +
      '<div class="metric"><div class="metric-val ok">' + procesos.filter(p => p.estado === 'completado').length + '</div><div class="metric-lbl">Completados</div></div>' +
      '<div class="metric"><div class="metric-val err">' + procesos.filter(p => p.estado === 'error').length + '</div><div class="metric-lbl">Errores</div></div>' +
      '</div></div>';
    const pubs = pub.publicaciones || [];
    html += '<div class="card"><h4>Publicaciones</h4><div class="grid-2">' +
      '<div class="metric"><div class="metric-val ok">' + pubs.filter(p => p.estado === 'publicada').length + '</div><div class="metric-lbl">Publicadas</div></div>' +
      '<div class="metric"><div class="metric-val">' + pubs.filter(p => p.estado === 'pendiente').length + '</div><div class="metric-lbl">Pendientes</div></div>' +
      '</div></div>';
    const ctxs = ctx.contextos || [];
    html += '<div class="card"><h4>Contexto</h4><div class="metric"><div class="metric-val">' + ctxs.length + '</div><div class="metric-lbl">Resúmenes guardados</div></div></div>';
    cont.innerHTML = html;
  } catch (e) {
    cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
}

// ============================================================
// SANDBOX
// ============================================================
async function cargarSandbox() {
  const contM = document.getElementById('sandbox-metricas');
  const cont = document.getElementById('sandbox-content');
  if (!cont || !contM) return;
  cont.innerHTML = '<div class="empty">cargando...</div>';
  contM.innerHTML = '';
  try {
    const d = await api('/api/sandbox');
    const esc = d.escenarios || [];
    const lec = d.lecciones || [];
    const total = esc.length;
    const completados = esc.filter(e => e.completado).length;
    const pendientes = total - completados;
    const estado = d.estado_economico || {};
    const ap = d.aprendizaje || { dominados: [] };
    const lim = d.limites_cloudflare || {};
    const curr = d.curriculum || d.curriculum_actual || null;

    let html = '<div class="metric-grid">' +
      '<div class="metric-card"><div class="lbl">Shadow-Tokens</div><div class="val ' + (estado.st > 5 ? 'ok' : estado.st > 0 ? 'warn' : '') + '">' + (estado.st || 0).toFixed(2) + '</div></div>' +
      '<div class="metric-card"><div class="lbl">Usuarios simulados</div><div class="val">' + (estado.usuarios || 0) + '</div></div>' +
      '<div class="metric-card"><div class="lbl">Escenarios</div><div class="val">' + total + '</div><div class="sub">' + completados + ' resueltos · ' + pendientes + ' pendientes</div></div>' +
      '<div class="metric-card"><div class="lbl">Temas dominados</div><div class="val ok">' + (ap.dominados || []).length + '</div></div>' +
      '</div>';

    if (curr) {
      const pct = curr.total_etapas ? Math.round((curr.completadas || 0) / curr.total_etapas * 100) : 0;
      html += '<div class="card"><h4>Currículum de Shadow Arise</h4>' +
        '<div class="bar"><div class="bar-i" style="width:' + pct + '%"></div></div>' +
        '<div class="v" style="margin-top:8px">' + (curr.completadas || 0) + ' / ' + (curr.total_etapas || 0) + ' etapas · ' + pct + '%</div>' +
        (curr.actual ? '<div class="v" style="color:var(--acc-hi);margin-top:8px">Ejecutando: <strong>' + curr.actual + '</strong></div>' : '') +
        (curr.fase_actual ? '<div class="v" style="color:var(--fg3);margin-top:4px">Fase actual: ' + curr.fase_actual + '</div>' : '') +
        '</div>';
    }

    const limKeys = Object.keys(lim);
    if (limKeys.length) {
      html += '<div class="card"><h4>Límites Cloudflare (plan gratuito)</h4>';
      limKeys.forEach(k => {
        const info = lim[k];
        const cls = info.pct > 80 ? 'err' : info.pct > 50 ? 'warn' : 'ok';
        html += '<div class="stat-row"><span class="stat-name">' + k.replace(/_/g, ' ') + '</span><div class="bar"><div class="bar-i" style="width:' + info.pct + '%;background:var(--' + cls + ')"></div></div><span class="stat-val">' + info.pct + '%</span></div>';
      });
      html += '</div>';
    }

    if (d.construccion_completada) {
      html += '<div class="card"><h4>Shadow Arise construido</h4><div class="v" style="color:var(--ok)">✓ Ayanokōji documentó el blueprint completo.</div>';
      if (d.plan_shadow_arise) {
        html += '<div class="v" style="margin-top:10px;white-space:pre-wrap;font-size:12.5px;max-height:300px;overflow-y:auto;background:var(--bg);padding:10px;border-radius:8px;border:1px solid var(--bd)">' + d.plan_shadow_arise.substring(0, 1500) + '...</div>';
      }
      html += '</div>';
    }

    contM.innerHTML = html;

    if (!esc.length) {
      cont.innerHTML = '<div class="empty">Sin escenarios aún. El cron los genera automáticamente.</div>';
      return;
    }

    const TIPOS = { proyecto:'Proyecto', economico:'Económico', social:'Social', etico:'Ético', publicacion:'Publicación', tactico:'Táctico', monetizacion:'Monetización', x402:'x402', crisis:'Crisis', retencion:'Retención', escalado:'Escalado', construccion_shadow_arise:'Construcción', limite_cf_real:'Límite CF' };

    cont.innerHTML = esc.map(e => {
      const fecha = new Date(e.creado).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const estadoTxt = e.completado ? 'Resuelto' : 'Pendiente';
      return '<div class="item"><div class="k">' + (TIPOS[e.tipo] || e.tipo) + ' · ' + fecha + ' · ' + estadoTxt + '</div>' +
        '<div class="v" style="white-space:pre-wrap;font-size:12.5px">' + (e.contexto || '').substring(0, 800) + '</div>' +
        (e.decision_tomada ? '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)">' +
          '<div class="k" style="color:var(--acc-hi)">Decisión tomada</div><div class="v">' + e.decision_tomada + '</div>' +
          '<div class="k" style="margin-top:8px;color:var(--warn)">Resultado simulado</div><div class="v" style="font-size:12.5px">' + (e.resultado || '').substring(0, 700) + '</div>' +
          (e.autoevaluacion ? '<div class="k" style="margin-top:8px;color:var(--ok)">Autoevaluación</div><div class="v" style="font-size:12.5px">' + e.autoevaluacion.substring(0, 700) + '</div>' : '') +
          '</div>' : '') + '</div>';
    }).join('');
  } catch (e) { cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>'; }
}

// ============================================================
// ESTRATEGIAS
// ============================================================
async function cargarEstrategias() {
  const cont = document.getElementById('estrategias-content');
  if (!cont) return;
  cont.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const d = await api('/api/estrategias');
    if (!d.estrategias || !d.estrategias.length) {
      cont.innerHTML = '<div class="empty">Sin estrategias activas.</div>';
      return;
    }
    cont.innerHTML = d.estrategias.map(e => {
      const fecha = new Date(e.creada || Date.now()).toLocaleDateString('es-ES');
      return '<div class="item">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
          '<div style="flex:1">' +
            '<div class="k">' + (e.tipo || 'general') + ' · prioridad ' + e.prioridad + ' · ' + fecha + '</div>' +
            '<div class="v" style="font-weight:500;margin-bottom:6px">' + (e.nombre || '') + '</div>' +
            '<div class="v" style="color:var(--fg2);font-size:12.5px">' + (e.contenido || '') + '</div>' +
          '</div>' +
          '<button class="tool" onclick="eliminarEstrategia(' + e.id + ')" style="padding:4px 10px;font-size:11px;flex-shrink:0">Eliminar</button>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch (e) { cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>'; }
}

async function eliminarEstrategia(id) {
  if (!confirm('¿Eliminar esta estrategia?')) return;
  try {
    await fetch(WORKER_URL + '/api/estrategias/' + id, { method: 'DELETE' });
    cargarEstrategias();
  } catch (e) { alert('Error: ' + e.message); }
}
window.eliminarEstrategia = eliminarEstrategia;

document.getElementById('estr-save')?.addEventListener('click', async () => {
  const nombre = document.getElementById('estr-nombre').value.trim();
  const tipo = document.getElementById('estr-tipo').value;
  const contenido = document.getElementById('estr-contenido').value.trim();
  if (!nombre || !contenido) return;
  try {
    await api('/api/estrategias', {
      method: 'POST',
      body: JSON.stringify({ nombre, tipo, contenido, prioridad: 5 })
    });
    document.getElementById('estr-nombre').value = '';
    document.getElementById('estr-contenido').value = '';
    cargarEstrategias();
  } catch (e) { alert('Error: ' + e.message); }
});

// ============================================================
// SHADOW
// ============================================================
async function cargarShadow() {
  const cont = document.getElementById('shadow-content');
  if (!cont) return;
  cont.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const d = await api('/api/shadow_stats');
    if (d.error) { cont.innerHTML = '<div class="empty">' + d.error + '</div>'; return; }
    const s = d.stats || {};
    const escala = d.escala || {};
    const pasos = ['Prototipo', 'Beta cerrada', 'Lanzamiento', 'Tracción', 'Escala'];
    let escalaHtml = '<div class="escala">';
    pasos.forEach((p, i) => {
      const estado = i < escala.actual ? 'completado' : i === escala.actual ? 'activo' : '';
      escalaHtml += '<div class="paso ' + estado + '">' + p + '</div>';
    });
    escalaHtml += '</div>';

    cont.innerHTML =
      '<div class="stats-grid">' +
        '<div class="stat-big"><div class="n">' + (s.usuarios_totales || 0) + '</div><div class="l">Usuarios totales</div></div>' +
        '<div class="stat-big"><div class="n ok">' + (s.usuarios_pago || 0) + '</div><div class="l">Usuarios de pago</div></div>' +
        '<div class="stat-big"><div class="n">' + (s.usuarios_activos_dia || 0) + '</div><div class="l">Activos hoy</div></div>' +
        '<div class="stat-big"><div class="n warn">' + (s.usuarios_nuevos_semana || 0) + '</div><div class="l">Nuevos esta semana</div></div>' +
      '</div>' +
      '<div class="card"><h4>Conversión</h4>' +
        '<div class="barra-progreso"><div class="fill" style="width:' + (s.conversion_pct || 0) + '%"></div></div>' +
        '<div class="v" style="margin-top:6px">' + (s.conversion_pct || 0) + '% gratis → pago</div></div>' +
      '<div class="card"><h4>Retención</h4>' +
        '<div class="v">Día 1: <strong>' + (s.retencion_d1 || 0) + '%</strong></div>' +
        '<div class="v">Día 7: <strong>' + (s.retencion_d7 || 0) + '%</strong></div></div>' +
      '<div class="card"><h4>Ingresos</h4>' +
        '<div class="v">Mes: <strong>' + (s.ingresos_mes || 0) + ' USDT</strong></div>' +
        '<div class="v">Total: <strong>' + (s.ingresos_total || 0) + ' USDT</strong></div>' +
        '<div class="v">ARPU: <strong>' + (s.arpu || 0) + ' USDT</strong></div></div>' +
      '<div class="card"><h4>Escala del proyecto</h4>' + escalaHtml + '</div>' +
      '<div class="card"><h4>Resumen</h4><div class="v">' + (d.resumen_ayanokoji || 'Sin datos aún.') + '</div></div>';
  } catch (e) { cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>'; }
}

// ============================================================
// DECISIONES
// ============================================================
async function cargarDecisiones() {
  const cont = document.getElementById('decisiones-content');
  if (!cont) return;
  cont.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const d = await api('/api/decisiones');
    if (!d.decisiones || !d.decisiones.length) {
      cont.innerHTML = '<div class="empty">Sin decisiones autónomas aún.</div>';
      return;
    }
    cont.innerHTML = d.decisiones.map(dd => {
      const fecha = new Date(dd.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const exito = dd.exito ? '' : 'err';
      return '<div class="decision-card">' +
        '<span class="tipo">' + (dd.tipo || 'general') + '</span>' +
        '<span class="fecha">' + fecha + '</span>' +
        '<div class="decision-text"><strong>Decisión:</strong> ' + (dd.decision || '') + '</div>' +
        (dd.simulacion ? '<div class="simulacion"><strong>Simulación:</strong> ' + dd.simulacion.substring(0, 300) + '</div>' : '') +
        (dd.resultado ? '<div class="resultado ' + exito + '"><strong>Resultado:</strong> ' + dd.resultado.substring(0, 300) + '</div>' : '') +
        '</div>';
    }).join('');
  } catch (e) { cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>'; }
}

// ============================================================
// ACTIVIDAD EN VIVO
// ============================================================
let actividadTimer = null;

function renderActividadLive(d) {
  let liveHtml = '<div class="metric-grid">' +
    '<div class="metric-card"><div class="lbl">Estado</div><div class="val ' + (d.estado === 'operando' ? 'ok' : 'warn') + '">' + (d.estado || '—') + '</div></div>' +
    '<div class="metric-card"><div class="lbl">Etapa actual</div><div class="val">' + (d.etapa_actual?.id || '—') + '</div></div>' +
    '<div class="metric-card"><div class="lbl">Última acción</div><div class="val">' + (d.ultima_accion || '—') + '</div></div>' +
    '<div class="metric-card"><div class="lbl">Último cron</div><div class="val">' + (d.ultimo_cron_hace || '—') + '</div></div>' +
  '</div>';
  if (d.etapa_actual) {
    liveHtml += '<div class="card"><h4>Ejecutando ahora</h4>' +
      '<div class="v"><strong>' + (d.etapa_actual.id || '') + '</strong>' +
        (d.etapa_actual.fase != null ? ' · fase ' + d.etapa_actual.fase : '') +
        (d.etapa_actual.prioridad != null ? ' · prioridad ' + d.etapa_actual.prioridad + '/10' : '') +
        (d.etapa_actual.dia != null ? ' · día ' + d.etapa_actual.dia + '/' + (d.etapa_actual.dias || '?') : '') +
      '</div>' +
      (d.etapa_actual.descripcion ? '<div class="v" style="color:var(--fg2);font-size:12.5px;margin-top:6px">' + d.etapa_actual.descripcion + '</div>' : '') +
      (d.etapa_actual.metrica ? '<div class="v" style="color:var(--acc-hi);font-size:12px;margin-top:8px">Métrica: ' + d.etapa_actual.metrica + ' ≥ ' + (d.etapa_actual.umbral || '?') + '</div>' : '') +
      '</div>';
  }
  return liveHtml;
}

function renderActividadAcciones(acciones) {
  if (!acciones || !acciones.length) return '<div class="empty">Sin actividad registrada aún. El cron empezará a generar en breve.</div>';
  return '<h3 style="font-size:16px;font-weight:500;margin:20px 0 12px;color:var(--fg2)">Últimas acciones</h3>' +
    acciones.map(a => {
      const fecha = new Date(a.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const exito = a.exito ? 'ok' : 'err';
      return '<div class="item" style="padding:10px 14px">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:12.5px;color:var(--acc-hi);font-weight:600">' + (a.tipo || '—') + '</div>' +
            '<div style="font-size:12.5px;color:var(--fg2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (a.descripcion || '') + '</div>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--' + exito + ');white-space:nowrap">' + fecha + '</div>' +
        '</div>' +
        (a.detalle ? '<div style="font-size:12px;color:var(--fg3);margin-top:6px;padding-top:6px;border-top:1px solid var(--bd);word-break:break-word">' + a.detalle.substring(0, 300) + '</div>' : '') +
      '</div>';
    }).join('');
}

async function cargarActividad() {
  const live = document.getElementById('actividad-live');
  const cont = document.getElementById('actividad-content');
  if (!live || !cont) return;
  live.innerHTML = '<div class="empty">cargando...</div>';
  cont.innerHTML = '';

  try {
    const d = await api('/api/actividad');
    if (d.error) { live.innerHTML = '<div class="empty">' + d.error + '</div>'; return; }
    live.innerHTML = renderActividadLive(d);
    cont.innerHTML = renderActividadAcciones(d.acciones);
  } catch (e) {
    live.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
    return;
  }

  if (actividadTimer) clearInterval(actividadTimer);
  actividadTimer = setInterval(async () => {
    if (currentView !== 'actividad') {
      clearInterval(actividadTimer);
      actividadTimer = null;
      return;
    }
    try {
      const d = await api('/api/actividad');
      const live2 = document.getElementById('actividad-live');
      const cont2 = document.getElementById('actividad-content');
      if (!live2 || !cont2) return;
      live2.innerHTML = renderActividadLive(d);
      cont2.innerHTML = renderActividadAcciones(d.acciones);
    } catch (e) {}
  }, 15000);
}

// ============================================================
// IDEAS
// ============================================================
async function cargarIdeas() {
  const cont = document.getElementById('ideas-content');
  if (!cont) return;
  cont.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const r = await fetch(WORKER_URL + '/api/d1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'leer', tabla: 'contexto', condicion: "WHERE fuente='idea' ORDER BY fecha DESC LIMIT 50" })
    });
    const d = await r.json();
    if (!d.resultado || !d.resultado.length) { cont.innerHTML = '<div class="empty">Sin ideas aún.</div>'; return; }
    cont.innerHTML = d.resultado.map(i => {
      const fecha = new Date(i.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      return '<div class="item"><div class="k">' + fecha + '</div><div class="v" style="white-space:pre-wrap">' + (i.resumen || '') + '</div></div>';
    }).join('');
  } catch (e) { cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>'; }
}

document.getElementById('idea-save')?.addEventListener('click', async () => {
  const ta = document.getElementById('idea-input');
  const texto = ta.value.trim();
  if (!texto) return;
  try {
    await fetch(WORKER_URL + '/api/d1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'escribir',
        tabla: 'contexto',
        datos: { fecha: Date.now(), resumen: texto, fases: JSON.stringify([texto]), fuente: 'idea' }
      })
    });
    ta.value = '';
    cargarIdeas();
  } catch (e) { alert('Error: ' + e.message); }
});

// ============================================================
// BANDEJA
// ============================================================
async function cargarNotificaciones() {
  const cont = document.getElementById('notif-content');
  if (!cont) return;
  cont.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const d = await api('/api/notificaciones');
    actualizarBadge(d.no_leidas || 0);
    if (!d.notificaciones || !d.notificaciones.length) { cont.innerHTML = '<div class="empty">Sin notificaciones aún.</div>'; return; }
    cont.innerHTML = d.notificaciones.map(n => {
      const fecha = new Date(n.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const nueva = n.leida ? '' : ' style="border-left:2px solid var(--acc)"';
      return '<div class="item"' + nueva + '><div class="k">' + (n.tipo || 'general') + ' · ' + fecha + '</div>' +
        '<div class="v" style="font-weight:500;margin-bottom:4px">' + (n.titulo || '') + '</div>' +
        '<div class="v" style="color:var(--fg2);font-size:12.5px">' + (n.mensaje || '') + '</div></div>';
    }).join('');
  } catch (e) { cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>'; }
}

function actualizarBadge(n) {
  const b = document.getElementById('notif-badge');
  if (!b) return;
  if (n > 0) { b.textContent = n; b.style.display = 'inline-block'; }
  else b.style.display = 'none';
}

document.getElementById('marcar-leidas')?.addEventListener('click', async () => {
  await api('/api/notificaciones/leer', { method: 'POST', body: JSON.stringify({ ids: [] }) });
  cargarNotificaciones();
});

// ============================================================
// INIT
// ============================================================
checkEstado();
setInterval(checkEstado, 30000);
msg.focus();

cargarHistorialLargo();

setInterval(async () => {
  try {
    const d = await api('/api/notificaciones');
    actualizarBadge(d.no_leidas || 0);
  } catch (e) {}
}, 60000);

setInterval(async () => {
  if (currentView !== 'chat') return;
  try {
    const d = await api('/api/proceso');
    if (!d.procesos) return;
    const ahora = Date.now();
    for (const p of d.procesos) {
      if ((p.estado === 'procesando' || p.estado === 'pendiente') && p.fecha_avance && (ahora - p.fecha_avance) > 60000) {
        await api('/api/retomar', { method: 'POST', body: JSON.stringify({ archivoId: p.id, destino: 'agente' }) });
      }
    }
  } catch (e) {}
}, 45000);
