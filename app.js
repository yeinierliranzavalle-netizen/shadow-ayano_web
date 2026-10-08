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

// ============ NAVEGACIÓN ============
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

// ============ UTILIDADES ============
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

// ============ BOTONES ============
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

// ============ PANEL ============
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

// ============ STATS con capacidad REAL ============
async function cargarStats() {
  const cont = document.getElementById('stats-content');
  if (!cont) return;
  cont.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const [cap, proc, ctx] = await Promise.all([
      api('/api/capacidades').catch(() => ({})),
      api('/api/proceso').catch(() => ({ procesos: [] })),
      api('/api/contexto').catch(() => ({ contextos: [] }))
    ]);

    let html = '';

    // Capacidad real Cloudflare
    if (cap && cap.limites_cloudflare) {
      const lim = cap.limites_cloudflare;
      const items = [
        { key: 'workers_requests', nombre: 'Workers requests' },
        { key: 'workers_subrequests', nombre: 'Subrequests' },
        { key: 'd1_reads', nombre: 'D1 reads' },
        { key: 'd1_writes', nombre: 'D1 writes' },
        { key: 'kv_reads', nombre: 'KV reads' },
        { key: 'kv_writes', nombre: 'KV writes' }
      ];

      html += '<div class="card"><h4>Capacidad REAL de Cloudflare (hoy)</h4><div class="cf-grid">';
      items.forEach(it => {
        const d = lim[it.key];
        if (!d) return;
        const pct = d.pct != null ? d.pct : 0;
        const cls = pct > 80 ? 'err' : pct > 50 ? 'warn' : 'ok';
        html += '<div class="cf-row">' +
          '<span class="cf-nombre">' + it.nombre + '</span>' +
          '<div class="cf-barra"><div class="cf-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
          '<span class="cf-val">' + (d.usado || 0).toLocaleString() + ' / ' + (d.limite || 0).toLocaleString() + ' · ' + pct + '%</span>' +
          '</div>';
      });
      html += '</div>';
      if (cap.fecha_consulta) {
        const t = new Date(cap.fecha_consulta).toLocaleTimeString('es-ES');
        html += '<div class="cf-timestamp">Actualizado a las ' + t + (cap.consulta_real ? ' · datos reales' : ' · sin datos reales') + '</div>';
      }
      html += '</div>';

      // Estado de procesos
      html += '<div class="card"><h4>Estado</h4>' +
        '<div class="grid-3">' +
        '<div class="metric"><div class="metric-val">' + (cap.procesos_activos || 0) + '</div><div class="metric-lbl">Procesos activos</div></div>' +
        '<div class="metric"><div class="metric-val">' + (cap.mensajes_historial || 0) + '</div><div class="metric-lbl">Mensajes historial</div></div>' +
        '<div class="metric"><div class="metric-val">' + (cap.temas_indexados || 0) + '</div><div class="metric-lbl">Temas indexados</div></div>' +
        '</div>' +
        '<div class="v" style="margin-top:10px;text-align:center;color:var(--fg3);font-size:12px">Modo índice: ' + (cap.modo_indice || 'ninguno') + '</div>' +
        '</div>';
    } else {
      html += '<div class="card"><h4>Capacidad Cloudflare</h4><div class="v" style="color:var(--err)">No se pudo consultar la capacidad real. Verifica CF_API_TOKEN y CF_ACCOUNT_ID.</div></div>';
    }

    // Procesos
    const procesos = proc.procesos || [];
    html += '<div class="card"><h4>Procesos</h4><div class="grid-3">' +
      '<div class="metric"><div class="metric-val">' + procesos.filter(p => p.estado === 'procesando').length + '</div><div class="metric-lbl">Activos</div></div>' +
      '<div class="metric"><div class="metric-val ok">' + procesos.filter(p => p.estado === 'completado').length + '</div><div class="metric-lbl">Completados</div></div>' +
      '<div class="metric"><div class="metric-val err">' + procesos.filter(p => p.estado === 'error').length + '</div><div class="metric-lbl">Errores</div></div>' +
      '</div></div>';

    // Contexto
    const ctxs = ctx.contextos || [];
    html += '<div class="card"><h4>Contexto</h4><div class="metric"><div class="metric-val">' + ctxs.length + '</div><div class="metric-lbl">Resúmenes guardados</div></div></div>';

    cont.innerHTML = html;
  } catch (e) { cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>'; }
}

// ============ SANDBOX ============
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
    const cap = d.capacidad_real_cloudflare;

    let html = '<div class="metric-grid">' +
      '<div class="metric-card"><div class="lbl">Shadow-Tokens</div><div class="val ' + (estado.st > 5 ? 'ok' : estado.st > 0 ? 'warn' : '') + '">' + (estado.st || 0).toFixed(2) + '</div><div class="sub">Simulan USDT</div></div>' +
      '<div class="metric-card"><div class="lbl">Usuarios simulados</div><div class="val">' + (estado.usuarios || 0) + '</div></div>' +
      '<div class="metric-card"><div class="lbl">Escenarios</div><div class="val">' + total + '</div><div class="sub">' + completados + ' resueltos · ' + pendientes + ' pendientes</div></div>' +
      '<div class="metric-card"><div class="lbl">Temas dominados</div><div class="val ok">' + (ap.dominados || []).length + '</div></div>' +
      '</div>';

    // Capacidad real
    if (cap) {
      html += '<div class="card"><h4>Capacidad real Cloudflare</h4><div class="cf-grid">';
      const items = [
        { key: 'workers_requests', nombre: 'Workers requests' },
        { key: 'workers_subrequests', nombre: 'Subrequests' },
        { key: 'd1_reads', nombre: 'D1 reads' },
        { key: 'd1_writes', nombre: 'D1 writes' },
        { key: 'kv_reads', nombre: 'KV reads' },
        { key: 'kv_writes', nombre: 'KV writes' }
      ];
      items.forEach(it => {
        const dd = cap[it.key];
        if (!dd) return;
        const pct = dd.pct != null ? dd.pct : 0;
        const cls = pct > 80 ? 'err' : pct > 50 ? 'warn' : 'ok';
        html += '<div class="cf-row">' +
          '<span class="cf-nombre">' + it.nombre + '</span>' +
          '<div class="cf-barra"><div class="cf-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
          '<span class="cf-val">' + (dd.usado || 0).toLocaleString() + ' · ' + pct + '%</span>' +
          '</div>';
      });
      html += '</div></div>';
    }

    // Currículum actual
    if (d.curriculum_actual) {
      const c = d.curriculum_actual;
      html += '<div class="card"><h4>Currículum actual</h4>' +
        '<div class="v"><strong>Fase ' + c.fase + '</strong> · ' + c.tema + '</div>' +
        '<div class="v" style="color:var(--fg2);font-size:12.5px;margin-top:6px">' + c.descripcion + '</div>' +
        '</div>';
    }

    // Dominados
    if (ap.dominados && ap.dominados.length) {
      html += '<div class="card"><h4>Temas dominados</h4><div class="v">' +
        ap.dominados.map(t => '✓ ' + t).join('<br>') + '</div></div>';
    }

    contM.innerHTML = html;

    if (!esc.length) {
      cont.innerHTML = '<div class="empty">Sin escenarios aún. El cron los genera automáticamente. Vuelve en unos minutos.</div>';
      return;
    }

    const TIPOS = { proyecto:'Proyecto', economico:'Económico', social:'Social', etico:'Ético', publicacion:'Publicación', tactico:'Táctico', monetizacion:'Monetización', x402:'x402', crisis:'Crisis', retencion:'Retención', escalado:'Escalado', preparacion_shadow_arise:'Preparación', limite_cf_real:'Límite CF' };

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

// ============ ESTRATEGIAS ============
async function cargarEstrategias() {
  const cont = document.getElementById('estrategias-content');
  if (!cont) return;
  cont.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const d = await api('/api/estrategias');
    const lista = d.estrategias || [];
    if (!lista.length) {
      cont.innerHTML = '<div class="empty">Sin estrategias guardadas. Escribe una arriba y guárdala.</div>';
      return;
    }
    cont.innerHTML = lista.map(e => {
      const fecha = new Date(e.creada || Date.now()).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      return '<div class="estrategia-card">' +
        '<span class="tipo">' + (e.tipo || 'general') + '</span>' +
        '<span class="fecha">' + fecha + '</span>' +
        '<div class="texto">' + (e.contenido || '') + '</div>' +
        '<div class="acciones">' +
          '<button class="primary" data-simular="' + e.id + '">🧪 Simular en sandbox</button>' +
          '<button data-publicar="' + e.id + '">📤 Enviar al chat</button>' +
          '<button data-eliminar="' + e.id + '">🗑️ Eliminar</button>' +
        '</div>' +
        '</div>';
    }).join('');

    // Handlers
    cont.querySelectorAll('button[data-simular]').forEach(b => {
      b.addEventListener('click', () => simularEstrategia(b.dataset.simular));
    });
    cont.querySelectorAll('button[data-publicar]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.publicar;
        const est = lista.find(x => String(x.id) === String(id));
        if (est) {
          cambiarVista('chat');
          msg.value = 'Analiza y simula esta estrategia: ' + est.contenido;
          msg.dispatchEvent(new Event('input'));
        }
      });
    });
    cont.querySelectorAll('button[data-eliminar]').forEach(b => {
      b.addEventListener('click', () => eliminarEstrategia(b.dataset.eliminar));
    });
  } catch (e) {
    cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
}

async function guardarEstrategia() {
  const ta = document.getElementById('estrategia-input');
  const sel = document.getElementById('estrategia-tipo');
  const texto = ta.value.trim();
  const tipo = sel.value;
  if (!texto) return alert('Escribe algo primero.');
  try {
    const r = await fetch(WORKER_URL + '/api/estrategias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: texto.substring(0, 60), tipo, contenido: texto, prioridad: 3 })
    });
    const d = await r.json();
    if (d.error) return alert('Error: ' + d.error);
    ta.value = '';
    cargarEstrategias();
  } catch (e) { alert('Error: ' + e.message); }
}

async function simularEstrategia(id) {
  if (!confirm('¿Enviar esta estrategia al sandbox para que Ayanokōji la simule?')) return;
  try {
    const r = await fetch(WORKER_URL + '/api/sandbox/simular_estrategia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estrategia_id: id })
    });
    const d = await r.json();
    if (d.error) return alert('Error: ' + d.error);
    alert('Estrategia enviada al sandbox. En 2-3 minutos Ayanokōji la habrá simulado. Revisa la pestaña Sandbox.');
    cambiarVista('sandbox');
  } catch (e) { alert('Error: ' + e.message); }
}

async function eliminarEstrategia(id) {
  if (!confirm('¿Eliminar esta estrategia?')) return;
  try {
    await fetch(WORKER_URL + '/api/estrategias/' + id, { method: 'DELETE' });
    cargarEstrategias();
  } catch (e) { alert('Error: ' + e.message); }
}

document.getElementById('estrategia-save')?.addEventListener('click', guardarEstrategia);

// ============ SHADOW ============
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

// ============ DECISIONES ============
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

// ============ IDEAS ============
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

// ============ BANDEJA ============
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
        '<div class="v" style="color:var(--fg2);font-size:12.5px;white-space:pre-wrap">' + (n.mensaje || '') + '</div></div>';
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

// ============ INIT ============
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
