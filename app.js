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
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');

let busy = false;
let procTimer = null;
let currentView = 'chat';

async function api(path, opts = {}) {
  const r = await fetch(WORKER_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  return r.json();
}

tabs.forEach(t => {
  t.addEventListener('click', () => {
    const v = t.dataset.view;
    if (!v) return;
    document.body.dataset.view = v;
    tabs.forEach(x => x.classList.toggle('active', x === t));
    views.forEach(x => x.classList.toggle('active', x.id === 'view-' + v));
    currentView = v;
    if (v === 'stats') cargarStats();
    if (v === 'sandbox') cargarSandbox();
    if (v === 'ideas') cargarIdeas();
    if (v === 'bandeja') cargarNotificaciones();
  });
});

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
      btn.textContent = '✓ Copiado';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2000);
    } catch (err) {
      const range = document.createRange();
      range.selectNodeContents(code);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('copy');
      sel.removeAllRanges();
      btn.textContent = '✓ Copiado';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2000);
    }
  });
  pre.style.position = 'relative';
  pre.appendChild(btn);
}

function renderizarMarkdown(texto) {
  let html = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
    return '<pre><code>' + code.trim() + '</code></pre>';
  });
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
    e.preventDefault();
    enviar();
  }
});

log.addEventListener('scroll', () => {
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  scrollBtn.classList.toggle('on', !nearBottom && log.scrollHeight > log.clientHeight + 100);
});
scrollBtn.addEventListener('click', () => {
  log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
});

function add(texto, tipo = 'a', etiqueta = '') {
  if (welcome && welcome.parentNode) welcome.remove();
  const d = document.createElement('div');
  d.className = 'msg ' + tipo;
  if (etiqueta) {
    const l = document.createElement('div');
    l.className = 'lbl';
    l.textContent = etiqueta;
    d.appendChild(l);
  }
  const t = document.createElement('div');
  t.innerHTML = renderizarMarkdown(texto);
  d.appendChild(t);
  d.querySelectorAll('pre').forEach(pre => addCopyButton(pre));
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
      dot.classList.add('on');
      stat.textContent = 'activo';
    } else {
      dot.classList.remove('on');
      stat.textContent = 'error';
    }
  } catch (e) {
    dot.classList.remove('on');
    stat.textContent = 'sin conexión';
  }
}

async function enviar() {
  const texto = msg.value.trim();
  if (!texto || busy) return;
  busy = true;
  send.disabled = true;
  msg.value = '';
  msg.style.height = '26px';
  add(texto, 'u', 'Comandante');
  const t = addTyping();
  try {
    const d = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ mensaje: texto, user_id: UID })
    });
    t.remove();
    add(d.respuesta || d.error || 'sin respuesta', 'a', 'Ayanokōji');
    if (d.intencion && d.intencion !== 'chat') {
      metaInfo.textContent = '· ' + d.intencion;
      setTimeout(() => metaInfo.textContent = '', 3000);
    }
  } catch (e) {
    t.remove();
    add('Error de conexión: ' + e.message, 'e');
  }
  busy = false;
  send.disabled = false;
  msg.focus();
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
      l.className = 'lbl';
      l.textContent = etiqueta;
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
  } catch (e) {
    console.warn('No se pudo cargar el historial largo:', e);
  }
}

document.getElementById('btnFile').addEventListener('click', () => fileIn.click());

fileIn.addEventListener('change', async () => {
  const f = fileIn.files[0];
  if (!f) return;
  if (f.size > MAX_ARCHIVO) {
    add('El archivo supera ' + (MAX_ARCHIVO / 1048576) + 'MB (' + (f.size / 1048576).toFixed(2) + ' MB)', 'e');
    fileIn.value = '';
    return;
  }

  const nombre = f.name.toLowerCase();
  const esJSON = nombre.endsWith('.json');

  if (esJSON && confirm('¿Importar como historial largo? (Sí = ventana deslizante. No = procesar y resumir.)')) {
    add('Importando "' + f.name + '" al historial largo...', 's');
    const fd = new FormData();
    fd.append('archivo', f);
    fd.append('user_id', UID);
    fd.append('limite', '500');
    try {
      const r = await fetch(WORKER_URL + '/api/importar', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.error) {
        add('Error: ' + d.error, 'e');
        if (d.diagnostico) add('DIAGNÓSTICO:\n' + JSON.stringify(d.diagnostico, null, 2), 'e');
      } else {
        add('Importado · ' + d.insertados + ' mensajes de ' + d.total + ' totales.', 's');
        if (d.stats_extractor) add('STATS:\n' + JSON.stringify(d.stats_extractor, null, 2), 's');
      }
    } catch (e) {
      add('Error al importar: ' + e.message, 'e');
    }
    fileIn.value = '';
    return;
  }

  add('Subiendo "' + f.name + '" (' + (f.size / 1024).toFixed(0) + ' KB)...', 's');
  const fd = new FormData();
  fd.append('archivo', f);
  fd.append('nombre', f.name);
  fd.append('destino', 'agente');
  fd.append('autoProcesar', 'true');
  try {
    const r = await fetch(WORKER_URL + '/api/subir', { method: 'POST', body: fd });
    const d = await r.json();
    if (d.error) add('Error: ' + d.error, 'e');
    else {
      add('Archivo subido · ID: ' + d.id + ' · ' + d.chunks + ' fragmentos', 's');
      setTimeout(() => abrirProcesos(), 2000);
    }
  } catch (e) {
    add('Error al subir: ' + e.message, 'e');
  }
  fileIn.value = '';
});

function abrirPanel(titulo) {
  panelT.textContent = titulo;
  panel.classList.add('on');
}
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
      panelB.innerHTML = '<div class="empty">Sin procesos registrados.</div>';
      return;
    }
    const ahora = Date.now();
    for (const p of d.procesos) {
      if ((p.estado === 'procesando' || p.estado === 'pendiente') &&
          p.fecha_avance && (ahora - p.fecha_avance) > 45000) {
        try {
          await api('/api/retomar', {
            method: 'POST',
            body: JSON.stringify({ archivoId: p.id, destino: 'agente' })
          });
        } catch (e) {}
      }
    }
    panelB.innerHTML = d.procesos.map(p => {
      const total = p.bloques_total || 0;
      const hecho = p.bloques_hechos || 0;
      const pct = total > 0 ? Math.round((hecho / total) * 100) : 0;
      const cls = p.estado === 'completado' ? 'c' : p.estado === 'error' ? 'e' : 'p';
      const hace = p.fecha_avance ? Math.round((Date.now() - p.fecha_avance) / 1000) : 0;
      return '<div class="item">' +
        '<div class="k">ID · ' + (p.id || '').substring(0, 32) + '</div>' +
        '<div class="st ' + cls + '">' + (p.estado || '?') + (p.estado === 'procesando' && hace > 30 ? ' · hace ' + hace + 's' : '') + '</div>' +
        (total > 0 ? '<div class="bar"><div class="bar-i" style="width:' + pct + '%"></div></div>' +
          '<div class="k" style="margin-top:6px">' + hecho + ' / ' + total + ' bloques · ' + pct + '%</div>' : '') +
        (p.error ? '<div class="k" style="color:var(--err);margin-top:8px">' + p.error + '</div>' : '') +
        '</div>';
    }).join('');
  } catch (e) {
    panelB.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
}
document.getElementById('btnProc').addEventListener('click', abrirProcesos);

async function abrirContexto() {
  abrirPanel('Contexto guardado');
  panelB.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const d = await api('/api/contexto');
    if (!d.contextos || !d.contextos.length) {
      panelB.innerHTML = '<div class="empty">Sin contexto guardado.</div>';
      return;
    }
    const TITULOS = ['Identidad','Contexto','Objetivo','Proyecto Shadow Arise','Aliado Digital','IA Publicadora','Reglas Operativas','Decisiones Tomadas','Ideas Pendientes'];
    panelB.innerHTML = d.contextos.map(c => {
      const fecha = new Date(c.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      let fases = [];
      try { fases = JSON.parse(c.fases || '[]'); } catch (e) {}
      return '<div class="item">' +
        '<div class="k">' + fecha + ' · fuente: ' + (c.fuente || '?') + '</div>' +
        (fases.length
          ? '<div class="fases">' + fases.map((f, i) =>
              '<div class="fase"><div class="k">' + (TITULOS[i] || 'Fase ' + (i + 1)) + '</div><div class="v">' + (f || '') + '</div></div>'
            ).join('') + '</div>'
          : '<div class="v">' + (c.resumen || '').substring(0, 500) + '</div>') +
        '</div>';
    }).join('');
  } catch (e) {
    panelB.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
}
document.getElementById('btnCtx').addEventListener('click', abrirContexto);

document.getElementById('btnReset').addEventListener('click', async () => {
  if (!confirm('¿Limpiar el historial de chat y el historial largo?')) return;
  try {
    const d = await api('/api/reset', {
      method: 'POST',
      body: JSON.stringify({ user_id: UID, destino: 'agente' })
    });
    add(d.message || 'Historial limpiado.', 's');
  } catch (e) {
    add('Error: ' + e.message, 'e');
  }
});

async function cargarStats() {
  const cont = document.getElementById('stats-content');
  if (!cont) return;
  cont.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const [pres, proc, pub, ctx] = await Promise.all([
      api('/api/presupuesto').catch(() => ({})),
      api('/api/proceso').catch(() => ({ procesos: [] })),
      api('/api/publicaciones').catch(() => ({ publicaciones: [] })),
      api('/api/contexto').catch(() => ({ contextos: [] }))
    ]);

    let html = '';

    html += '<div class="card"><h4>Presupuesto diario</h4>';
    const areas = ['chat','procesamiento','sandbox','publisher','vision'];
    areas.forEach(a => {
      const p = pres[a] || { usado: 0, limite: 50, restante: 50 };
      const pct = Math.round((p.usado / p.limite) * 100);
      html += '<div class="stat-row">' +
        '<span class="stat-name">' + a + '</span>' +
        '<div class="bar"><div class="bar-i" style="width:' + pct + '%"></div></div>' +
        '<span class="stat-val">' + p.usado + '/' + p.limite + '</span>' +
        '</div>';
    });
    html += '</div>';

    const procesos = proc.procesos || [];
    const activos = procesos.filter(p => p.estado === 'procesando').length;
    const completados = procesos.filter(p => p.estado === 'completado').length;
    const errores = procesos.filter(p => p.estado === 'error').length;
    html += '<div class="card"><h4>Procesos</h4>' +
      '<div class="grid-3">' +
      '<div class="metric"><div class="metric-val">' + activos + '</div><div class="metric-lbl">Activos</div></div>' +
      '<div class="metric"><div class="metric-val ok">' + completados + '</div><div class="metric-lbl">Completados</div></div>' +
      '<div class="metric"><div class="metric-val err">' + errores + '</div><div class="metric-lbl">Errores</div></div>' +
      '</div></div>';

    const pubs = pub.publicaciones || [];
    const publicadas = pubs.filter(p => p.estado === 'publicada').length;
    const pendientes = pubs.filter(p => p.estado === 'pendiente').length;
    html += '<div class="card"><h4>Publicaciones</h4>' +
      '<div class="grid-2">' +
      '<div class="metric"><div class="metric-val ok">' + publicadas + '</div><div class="metric-lbl">Publicadas</div></div>' +
      '<div class="metric"><div class="metric-val">' + pendientes + '</div><div class="metric-lbl">Pendientes</div></div>' +
      '</div></div>';

    const ctxs = ctx.contextos || [];
    html += '<div class="card"><h4>Contexto</h4>' +
      '<div class="metric"><div class="metric-val">' + ctxs.length + '</div><div class="metric-lbl">Resúmenes guardados</div></div>' +
      '</div>';

    cont.innerHTML = html;
  } catch (e) {
    cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
}

async function cargarSandbox() {
  const cont = document.getElementById('sandbox-content');
  if (!cont) return;
  cont.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const d = await api('/api/sandbox');
    if (!d.escenarios || !d.escenarios.length) {
      cont.innerHTML = '<div class="empty">Sin escenarios aún.<br><br>El cron genera uno cada cierto tiempo.</div>';
      return;
    }
    const TIPOS = { proyecto:'Proyecto', economico:'Económico', social:'Social', etico:'Ético', publicacion:'Publicación', tactico:'Táctico' };
    cont.innerHTML = d.escenarios.map(e => {
      const fecha = new Date(e.creado).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const decidido = e.decision_tomada ? true : false;
      return '<div class="item">' +
        '<div class="k">' + (TIPOS[e.tipo] || e.tipo) + ' · ' + fecha + '</div>' +
        '<div class="v" style="white-space:pre-wrap;font-size:12.5px">' + (e.contexto || '').substring(0, 600) + '</div>' +
        (decidido ? '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)">' +
          '<div class="k" style="color:var(--acc-hi)">Decisión de Ayanokōji</div>' +
          '<div class="v">' + e.decision_tomada + '</div>' +
          '<div class="k" style="margin-top:8px;color:var(--warn)">Resultado simulado</div>' +
          '<div class="v" style="font-size:12.5px">' + (e.resultado || '').substring(0, 500) + '</div>' +
          (e.autoevaluacion ? '<div class="k" style="margin-top:8px;color:var(--ok)">Autoevaluación</div>' +
          '<div class="v" style="font-size:12.5px">' + e.autoevaluacion.substring(0, 500) + '</div>' : '') +
          '</div>' : '<div class="k" style="margin-top:8px;color:var(--fg3)">Pendiente de decisión</div>') +
        '</div>';
    }).join('');
  } catch (e) {
    cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
}

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
    if (!d.resultado || !d.resultado.length) {
      cont.innerHTML = '<div class="empty">Sin ideas aún.<br><br>Escribe algo arriba y púlsalo. Ayanokōji no lo leerá ni lo juzgará hasta que tú se lo pidas.</div>';
      return;
    }
    cont.innerHTML = d.resultado.map(i => {
      const fecha = new Date(i.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      return '<div class="item">' +
        '<div class="k">' + fecha + '</div>' +
        '<div class="v" style="white-space:pre-wrap">' + (i.resumen || '') + '</div>' +
        '</div>';
    }).join('');
  } catch (e) {
    cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
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
  } catch (e) {
    alert('Error guardando idea: ' + e.message);
  }
});

async function cargarNotificaciones() {
  const cont = document.getElementById('notif-content');
  if (!cont) return;
  cont.innerHTML = '<div class="empty">cargando...</div>';
  try {
    const d = await api('/api/notificaciones');
    actualizarBadge(d.no_leidas || 0);
    if (!d.notificaciones || !d.notificaciones.length) {
      cont.innerHTML = '<div class="empty">Sin notificaciones aún.</div>';
      return;
    }
    cont.innerHTML = d.notificaciones.map(n => {
      const fecha = new Date(n.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const nueva = n.leida ? '' : ' style="border-left:2px solid var(--acc)"';
      return '<div class="item"' + nueva + '>' +
        '<div class="k">' + (n.tipo || 'general') + ' · ' + fecha + '</div>' +
        '<div class="v" style="font-weight:500;margin-bottom:4px">' + (n.titulo || '') + '</div>' +
        '<div class="v" style="color:var(--fg2);font-size:12.5px">' + (n.mensaje || '') + '</div>' +
        '</div>';
    }).join('');
  } catch (e) {
    cont.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
}

function actualizarBadge(n) {
  const b = document.getElementById('notif-badge');
  if (!b) return;
  if (n > 0) { b.textContent = n; b.style.display = 'inline-block'; }
  else b.style.display = 'none';
}

document.getElementById('marcar-leidas')?.addEventListener('click', async () => {
  await api('/api/notificaciones/leer', {
    method: 'POST',
    body: JSON.stringify({ ids: [] })
  });
  cargarNotificaciones();
});

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
      if ((p.estado === 'procesando' || p.estado === 'pendiente') &&
          p.fecha_avance && (ahora - p.fecha_avance) > 60000) {
        await api('/api/retomar', {
          method: 'POST',
          body: JSON.stringify({ archivoId: p.id, destino: 'agente' })
        });
      }
    }
  } catch (e) {}
}, 45000);
