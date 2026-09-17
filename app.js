const WORKER_URL = 'https://shadow-ayano.yeinierliranzavalle.workers.dev';
const UID = 'comandante';

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

let busy = false;
let procTimer = null;

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
  t.textContent = texto;
  d.appendChild(t);
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

async function api(path, opts = {}) {
  const r = await fetch(WORKER_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  return r.json();
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

document.getElementById('btnFile').addEventListener('click', () => fileIn.click());

fileIn.addEventListener('change', async () => {
  const f = fileIn.files[0];
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) {
    add('El archivo supera 5MB (' + (f.size / 1048576).toFixed(2) + ' MB)', 'e');
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
    if (d.error) {
      add('Error: ' + d.error, 'e');
    } else {
      add('Archivo subido · ID: ' + d.id + ' · ' + d.chunks + ' fragmentos · Procesando en segundo plano', 's');
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
      if (p.estado === 'procesando' || p.estado === 'pendiente') {
        const avance = p.fecha_avance || p.fecha_inicio || 0;
        if (ahora - avance > 45000) {
          try {
            await api('/api/retomar', {
              method: 'POST',
              body: JSON.stringify({ archivoId: p.id, destino: 'agente' })
            });
          } catch (e) {}
        }
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
      panelB.innerHTML = '<div class="empty">Sin contexto guardado.<br><br>Sube un archivo JSON a tu núcleo para generarlo.</div>';
      return;
    }
    const TITULOS = [
      'Identidad',
      'Contexto',
      'Objetivo',
      'Proyecto Shadow Arise',
      'Aliado Digital',
      'IA Publicadora',
      'Reglas Operativas',
      'Decisiones Tomadas',
      'Ideas Pendientes'
    ];
    panelB.innerHTML = d.contextos.map(c => {
      const fecha = new Date(c.fecha).toLocaleString('es-ES', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
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
  if (!confirm('¿Limpiar el historial de chat del Comandante?')) return;
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

checkEstado();
setInterval(checkEstado, 30000);
msg.focus();

setInterval(async () => {
  try {
    const d = await api('/api/proceso');
    if (!d.procesos) return;
    const ahora = Date.now();
    for (const p of d.procesos) {
      if ((p.estado === 'procesando' || p.estado === 'pendiente') &&
          p.fecha_avance &&
          ahora - p.fecha_avance > 60000) {
        await api('/api/retomar', {
          method: 'POST',
          body: JSON.stringify({ archivoId: p.id, destino: 'agente' })
        });
      }
    }
  } catch (e) {}
}, 45000);
