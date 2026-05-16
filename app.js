const ADMIN_PASSWORD = "konehoot2025"; // ← canvia-ho!
const ADMIN_SESSION_KEY = 'konehoot_admin_session';

function entrarModeAdmin() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  if (typeof window.iniciarApp === 'function') window.iniciarApp();
  else window._loginOk = true;
}

function login() {
  const pw = document.getElementById('pw').value;
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
    entrarModeAdmin();
  } else {
    const err = document.getElementById('login-error');
    err.style.display = 'block';
    err.style.animation = 'none';
    requestAnimationFrame(() => err.style.animation = 'shake 0.4s ease');
    document.getElementById('pw').value = '';
    document.getElementById('pw').focus();
  }
}

window.login = login;

document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === 'ok') {
    entrarModeAdmin();
    return;
  }
  document.getElementById('pw').focus();
  document.getElementById('pw').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, query, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch, getDocs, setDoc, getDoc, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── CONFIGURA AQUÍ el teu projecte Firebase ──────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDuHxOAU3hiL-8uUYuFyzP-mTyUCTR-wmw",
  authDomain: "konehoot.firebaseapp.com",
  projectId: "konehoot",
  storageBucket: "konehoot.firebasestorage.app",
  messagingSenderId: "357275257330",
  appId: "1:357275257330:web:a45bd66abb86a0747e836b"
};
// ─────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Estat local ───────────────────────────────────────────────────────
let pendents   = [];
let aprovades  = [];
let jocs       = [];
let usuaris    = [];
let configJoc  = { tempsPregunta: 20, puntsBase: 1000, puntsRapidesa: 500 };
let editantId  = null;
let tabActiva  = 'pendents';
let appIniciada = false;

function timestampToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds !== undefined) return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
  return 0;
}

// ── Subscripcions Firestore ───────────────────────────────────────────
window.iniciarApp = function iniciarApp() {
  if (appIniciada) return;
  appIniciada = true;

  // Pendents
  onSnapshot(collection(db, 'preguntes_pendents'), snap => {
    pendents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    pendents.sort((a, b) => timestampToMillis(a.createdAt) - timestampToMillis(b.createdAt));
    renderPendents();
    actualitzarComptadors();
  }, err => {
    console.error('Error llegint preguntes pendents:', err);
    mostrarToast('No s\'han pogut carregar les pendents.', 'error');
  });

  // Aprovades
  onSnapshot(query(collection(db, 'preguntes'), orderBy('ordre', 'asc')), snap => {
    aprovades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAprovades();
    actualitzarComptadors();
  }, err => {
    console.error('Error llegint preguntes aprovades:', err);
    mostrarToast('No s\'han pogut carregar les preguntes del joc.', 'error');
  });

  onSnapshot(query(collection(db, 'jocs'), orderBy('createdAt', 'asc')), snap => {
    jocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderJocs();
    renderSelectorsJoc();
    actualitzarComptadors();
  }, err => {
    console.error('Error llegint jocs:', err);
    mostrarToast('No s\'han pogut carregar els jocs.', 'error');
  });

  onSnapshot(query(collection(db, 'usuaris'), orderBy('nom', 'asc')), snap => {
    usuaris = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsuaris();
    actualitzarComptadors();
  }, err => {
    console.error('Error llegint usuaris:', err);
    mostrarToast('No s\'han pogut carregar els usuaris.', 'error');
  });

  carregarConfiguracioJoc();
}

// Si el login ja s'havia fet abans que el mòdul acabés de carregar
if (window._loginOk) window.iniciarApp();

// ── Comptadors ────────────────────────────────────────────────────────
function actualitzarComptadors() {
  document.getElementById('cnt-pendents').textContent = pendents.length;
  document.getElementById('cnt-aprovades').textContent = aprovades.length;
  const el = document.getElementById('cnt-jocs');
  if (el) el.textContent = jocs.length;
  const elU = document.getElementById('cnt-usuaris');
  if (elU) elU.textContent = getUsuarisVisibles().length;
}

// ── Canvi de tab ──────────────────────────────────────────────────────
window.canviarTab = function(tab) {
  tabActiva = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activa'));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('activa');
  document.getElementById('panel-pendents').style.display  = tab === 'pendents'  ? 'block' : 'none';
  document.getElementById('panel-aprovades').style.display = tab === 'aprovades' ? 'block' : 'none';
  document.getElementById('panel-nova').style.display      = tab === 'nova'      ? 'block' : 'none';
  document.getElementById('panel-jocs').style.display      = tab === 'jocs'      ? 'block' : 'none';
  document.getElementById('panel-config').style.display    = tab === 'config'    ? 'block' : 'none';
  document.getElementById('panel-usuaris').style.display   = tab === 'usuaris'   ? 'block' : 'none';
};

function renderUsuaris() {
  const container = document.getElementById('llista-usuaris');
  if (!container) return;
  const visibles = getUsuarisVisibles();
  if (!visibles.length) {
    container.innerHTML = '<div class="empty-state">Encara no hi ha usuaris registrats</div>';
    return;
  }
  container.innerHTML = visibles.map(u => `
    <div class="card-pregunta">
      <div class="card-meta">
        <div style="font-family:var(--font-display);font-weight:700">${esc(u.nom || u.id)}</div>
        <div class="card-actions">
          <button class="btn-icon btn-editar-aprovar" onclick="editarUsuari('${u.id || ''}', '${escAttr(u.nom || '')}')" title="Editar">✎</button>
          <button class="btn-icon btn-rebutjar" onclick="eliminarUsuari('${u.id || ''}', '${escAttr(u.nom || '')}')" title="Eliminar">✕</button>
        </div>
      </div>
    </div>
  `).join('');
}

function getUsuarisVisibles() {
  const map = new Map();
  usuaris.forEach(u => {
    const nom = (u.nom || '').trim();
    if (!nom) return;
    map.set(nom.toLowerCase(), { id: u.id, nom });
  });
  [...pendents, ...aprovades].forEach(p => {
    const nom = (p.autor || '').trim();
    if (!nom) return;
    const key = nom.toLowerCase();
    if (!map.has(key)) map.set(key, { id: '', nom });
  });
  return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));
}

window.editarUsuari = async function(id, nomFallback) {
  const u = usuaris.find(x => x.id === id);
  const nomOriginal = (u?.nom || nomFallback || '').trim();
  if (!nomOriginal) return;
  const nouNom = prompt('Nou nom d\'usuari', nomOriginal);
  if (!nouNom) return;
  const nomNet = nouNom.trim();
  if (!nomNet) return;
  const nomAntic = nomOriginal;
  if (id) {
    await updateDoc(doc(db, 'usuaris', id), { nom: nomNet, updatedAt: serverTimestamp() });
  } else {
    const idNou = nomNet.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || ('usuari_' + Date.now());
    await setDoc(doc(db, 'usuaris', idNou), { nom: nomNet, updatedAt: serverTimestamp() }, { merge: true });
  }

  const batch = writeBatch(db);
  const pPend = await getDocs(query(collection(db, 'preguntes_pendents'), where('autor', '==', nomAntic)));
  pPend.forEach(d => batch.update(d.ref, { autor: nomNet }));
  const pApr = await getDocs(query(collection(db, 'preguntes'), where('autor', '==', nomAntic)));
  pApr.forEach(d => batch.update(d.ref, { autor: nomNet }));
  const jugs = await getDocs(query(collection(db, 'partida', 'estat', 'jugadors'), where('nom', '==', nomAntic)));
  jugs.forEach(d => batch.update(d.ref, { nom: nomNet }));
  await batch.commit();
  mostrarToast('Usuari actualitzat.', 'ok');
};

window.eliminarUsuari = async function(id, nomFallback) {
  const u = usuaris.find(x => x.id === id);
  const nom = (u?.nom || nomFallback || '').trim();
  if (!nom) return;
  if (!confirm(`Eliminar usuari ${nom}?`)) return;
  if (id) await deleteDoc(doc(db, 'usuaris', id));
  mostrarToast('Usuari eliminat.', 'ok');
};

function jocLabel(jocId, jocNom) {
  if (jocNom) return jocNom;
  const joc = jocs.find(j => j.id === jocId);
  return joc?.nom || 'Sense joc';
}

function renderSelectorsJoc() {
  const options = ['<option value="">Selecciona joc</option>']
    .concat(jocs.filter(j => j.actiu !== false).map(j => `<option value="${j.id}">${esc(j.nom || j.id)}</option>`))
    .join('');
  const nova = document.getElementById('nova-joc');
  const modal = document.getElementById('modal-joc');
  if (nova) nova.innerHTML = options;
  if (modal) modal.innerHTML = options;
}

function renderJocs() {
  const container = document.getElementById('llista-jocs');
  if (!container) return;
  if (!jocs.length) {
    container.innerHTML = '<div class="empty-state">Encara no hi ha jocs creats</div>';
    return;
  }
  container.innerHTML = jocs.map(j => `
    <div class="card-pregunta">
      <div class="card-meta">
        <div style="font-family:var(--font-display);font-weight:700">${esc(j.nom || j.id)}</div>
        <div class="card-actions">
          <button class="btn-icon" onclick="toggleJocActiu('${j.id}', ${j.actiu === false ? 'true' : 'false'})" title="Activar/Desactivar">${j.actiu === false ? '○' : '●'}</button>
        </div>
      </div>
      <div style="font-size:13px;color:var(--muted)">${j.actiu === false ? 'Inactiu' : 'Actiu'}</div>
    </div>
  `).join('');
}

window.crearJoc = async function() {
  const nom = document.getElementById('joc-nom').value.trim();
  if (!nom) {
    mostrarToast('Escriu un nom de joc.', 'error');
    return;
  }
  await addDoc(collection(db, 'jocs'), { nom, actiu: true, createdAt: serverTimestamp() });
  document.getElementById('joc-nom').value = '';
  mostrarToast('Joc creat!', 'ok');
};

window.toggleJocActiu = async function(id, nouEstat) {
  await updateDoc(doc(db, 'jocs', id), { actiu: !!nouEstat });
};

async function carregarConfiguracioJoc() {
  try {
    const cfg = await getDoc(doc(db, 'partida', 'config'));
    if (cfg.exists()) configJoc = { ...configJoc, ...cfg.data() };
  } catch (_) {}
  document.getElementById('cfg-temps').value = String(configJoc.tempsPregunta);
  document.getElementById('cfg-punts-base').value = String(configJoc.puntsBase);
  document.getElementById('cfg-punts-rapidesa').value = String(configJoc.puntsRapidesa);
}

window.desarConfiguracioJoc = async function() {
  const tempsPregunta = parseInt(document.getElementById('cfg-temps').value, 10);
  const puntsBase = parseInt(document.getElementById('cfg-punts-base').value, 10);
  const puntsRapidesa = parseInt(document.getElementById('cfg-punts-rapidesa').value, 10);
  if (!Number.isFinite(tempsPregunta) || !Number.isFinite(puntsBase) || !Number.isFinite(puntsRapidesa)) {
    mostrarToast('Parametres invalids.', 'error');
    return;
  }
  configJoc = { tempsPregunta, puntsBase, puntsRapidesa };
  await setDoc(doc(db, 'partida', 'config'), configJoc, { merge: true });
  mostrarToast('Parametres desats.', 'ok');
};

// ── RENDER PENDENTS ───────────────────────────────────────────────────
function renderPendents() {
  const container = document.getElementById('llista-pendents');
  if (!pendents.length) {
    container.innerHTML = '<div class="empty-state">Cap pregunta pendent ✓</div>';
    return;
  }
  container.innerHTML = pendents.map(p => `
    <div class="card-pregunta" id="pend-${p.id}">
      <div class="card-meta">
        <span class="autor-badge">${esc(p.autor)}</span>
        <span class="autor-badge">${esc(jocLabel(p.jocId, p.jocNom))}</span>
        <div class="card-actions">
          <button class="btn-icon btn-aprovar" onclick="aprovar('${p.id}')" title="Aprovar">✓</button>
          <button class="btn-icon btn-editar-aprovar" onclick="editarPendent('${p.id}')" title="Editar i aprovar">✎</button>
          <button class="btn-icon btn-rebutjar" onclick="rebutjar('${p.id}')" title="Rebutjar">✕</button>
        </div>
      </div>
      <div class="pregunta-text">${esc(p.pregunta)}</div>
      <div class="respostes-preview">
        ${p.respostes.map((r, i) => `
          <div class="resp-preview ${i === p.correcta ? 'correcta' : ''}">
            <span class="resp-lletra">${'ABCD'[i]}</span>
            <span>${esc(r)}</span>
            ${i === p.correcta ? '<span class="tick">✓</span>' : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ── RENDER APROVADES ──────────────────────────────────────────────────
function renderAprovades() {
  const container = document.getElementById('llista-aprovades');
  if (!aprovades.length) {
    container.innerHTML = '<div class="empty-state">Encara no hi ha preguntes aprovades</div>';
    return;
  }
  container.innerHTML = aprovades.map((p, idx) => `
    <div class="card-pregunta aprovada" id="aprov-${p.id}">
      <div class="card-meta">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="ordre-num">${idx + 1}</span>
          <span class="autor-badge">${esc(p.autor)}</span>
          <span class="autor-badge">${esc(jocLabel(p.jocId, p.jocNom))}</span>
        </div>
        <div class="card-actions">
          <button class="btn-icon btn-up"    onclick="moureAmunt('${p.id}')"  title="Amunt"   ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-icon btn-down"  onclick="mourAvall('${p.id}')"   title="Avall"   ${idx === aprovades.length-1 ? 'disabled' : ''}>↓</button>
          <button class="btn-icon btn-editar-aprovar" onclick="editarAprovada('${p.id}')" title="Editar">✎</button>
          <button class="btn-icon btn-rebutjar" onclick="eliminarAprovada('${p.id}')" title="Eliminar">✕</button>
        </div>
      </div>
      <div class="pregunta-text">${esc(p.pregunta)}</div>
      <div class="respostes-preview">
        ${p.respostes.map((r, i) => `
          <div class="resp-preview ${i === p.correcta ? 'correcta' : ''}">
            <span class="resp-lletra">${'ABCD'[i]}</span>
            <span>${esc(r)}</span>
            ${i === p.correcta ? '<span class="tick">✓</span>' : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ── ACCIONS PENDENTS ──────────────────────────────────────────────────
window.aprovar = async function(id) {
  const p = pendents.find(x => x.id === id);
  if (!p) return;
  const batch = writeBatch(db);
  batch.set(doc(db, 'preguntes', id), {
    autor: p.autor, pregunta: p.pregunta,
    respostes: p.respostes, correcta: p.correcta,
    jocId: p.jocId || '', jocNom: p.jocNom || jocLabel(p.jocId),
    ordre: aprovades.length,
    createdAt: serverTimestamp()
  });
  batch.delete(doc(db, 'preguntes_pendents', id));
  await batch.commit();
};

window.rebutjar = async function(id) {
  if (!confirm('Rebutjar i eliminar aquesta pregunta?')) return;
  await deleteDoc(doc(db, 'preguntes_pendents', id));
};

window.editarPendent = function(id) {
  const p = pendents.find(x => x.id === id);
  if (!p) return;
  editantId = id;
  omplirModal(p, 'pendent');
  obrirModal();
};

// ── ACCIONS APROVADES ─────────────────────────────────────────────────
window.editarAprovada = function(id) {
  const p = aprovades.find(x => x.id === id);
  if (!p) return;
  editantId = id;
  omplirModal(p, 'aprovada');
  obrirModal();
};

window.eliminarAprovada = async function(id) {
  if (!confirm('Eliminar aquesta pregunta del joc?')) return;
  await deleteDoc(doc(db, 'preguntes', id));
  // Recalcula ordre
  const resta = aprovades.filter(x => x.id !== id);
  const batch = writeBatch(db);
  resta.forEach((p, i) => batch.update(doc(db, 'preguntes', p.id), { ordre: i }));
  await batch.commit();
};

window.moureAmunt = async function(id) {
  const idx = aprovades.findIndex(x => x.id === id);
  if (idx <= 0) return;
  const batch = writeBatch(db);
  batch.update(doc(db, 'preguntes', aprovades[idx].id),   { ordre: idx - 1 });
  batch.update(doc(db, 'preguntes', aprovades[idx-1].id), { ordre: idx });
  await batch.commit();
};

window.mourAvall = async function(id) {
  const idx = aprovades.findIndex(x => x.id === id);
  if (idx >= aprovades.length - 1) return;
  const batch = writeBatch(db);
  batch.update(doc(db, 'preguntes', aprovades[idx].id),   { ordre: idx + 1 });
  batch.update(doc(db, 'preguntes', aprovades[idx+1].id), { ordre: idx });
  await batch.commit();
};

// ── NOVA PREGUNTA (tab) ───────────────────────────────────────────────
window.crearNova = async function() {
  const autor    = document.getElementById('nova-autor').value.trim();
  const jocId    = document.getElementById('nova-joc').value;
  const pregunta = document.getElementById('nova-pregunta').value.trim();
  const respostes = [
    document.getElementById('nova-r1').value.trim(),
    document.getElementById('nova-r2').value.trim(),
    document.getElementById('nova-r3').value.trim(),
    document.getElementById('nova-r4').value.trim(),
  ];
  const correcta = document.querySelector('input[name="nova-correcta"]:checked')?.value;

  if (!autor || !jocId || !pregunta || respostes.some(r => !r) || correcta === undefined) {
    mostrarToast('Omple tots els camps i marca la resposta correcta.', 'error');
    return;
  }
  const joc = jocs.find(j => j.id === jocId);
  await addDoc(collection(db, 'preguntes'), {
    autor, pregunta, respostes, correcta: parseInt(correcta), jocId, jocNom: joc?.nom || jocId,
    ordre: aprovades.length, createdAt: serverTimestamp()
  });
  document.getElementById('form-nova').reset();
  mostrarToast('Pregunta afegida al joc!', 'ok');
  canviarTab('aprovades');
};

// ── MODAL EDICIÓ ──────────────────────────────────────────────────────
function omplirModal(p, tipus) {
  document.getElementById('modal-tipus').value  = tipus;
  document.getElementById('modal-joc').value = p.jocId || '';
  document.getElementById('modal-autor').value    = p.autor    || '';
  document.getElementById('modal-pregunta').value = p.pregunta || '';
  document.getElementById('modal-r1').value = p.respostes[0] || '';
  document.getElementById('modal-r2').value = p.respostes[1] || '';
  document.getElementById('modal-r3').value = p.respostes[2] || '';
  document.getElementById('modal-r4').value = p.respostes[3] || '';
  const radios = document.querySelectorAll('input[name="modal-correcta"]');
  radios.forEach(r => { r.checked = parseInt(r.value) === p.correcta; });
}

function obrirModal() {
  document.getElementById('modal-overlay').classList.add('obert');
}

window.tancarModal = function() {
  document.getElementById('modal-overlay').classList.remove('obert');
  editantId = null;
};

window.desarModal = async function() {
  const tipus    = document.getElementById('modal-tipus').value;
  const jocId    = document.getElementById('modal-joc').value;
  const autor    = document.getElementById('modal-autor').value.trim();
  const pregunta = document.getElementById('modal-pregunta').value.trim();
  const respostes = [
    document.getElementById('modal-r1').value.trim(),
    document.getElementById('modal-r2').value.trim(),
    document.getElementById('modal-r3').value.trim(),
    document.getElementById('modal-r4').value.trim(),
  ];
  const correcta = document.querySelector('input[name="modal-correcta"]:checked')?.value;

  if (!autor || !jocId || !pregunta || respostes.some(r => !r) || correcta === undefined) {
    mostrarToast('Omple tots els camps.', 'error');
    return;
  }

  const joc = jocs.find(j => j.id === jocId);
  const data = { autor, pregunta, respostes, correcta: parseInt(correcta), jocId, jocNom: joc?.nom || jocId };

  if (tipus === 'pendent') {
    // Aprovar: mou de pendents a preguntes
    const batch = writeBatch(db);
    batch.set(doc(db, 'preguntes', editantId), { ...data, ordre: aprovades.length, createdAt: serverTimestamp() });
    batch.delete(doc(db, 'preguntes_pendents', editantId));
    await batch.commit();
    mostrarToast('Pregunta aprovada i editada!', 'ok');
  } else {
    // Actualitza aprovada
    await updateDoc(doc(db, 'preguntes', editantId), data);
    mostrarToast('Pregunta actualitzada!', 'ok');
  }
  tancarModal();
};

// ── TOAST ─────────────────────────────────────────────────────────────
function mostrarToast(msg, tipus) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + tipus + ' visible';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('visible'), 3000);
}

// ── UTILS ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g, '&#39;');
}
