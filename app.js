const ADMIN_PASSWORD = "konehoot2025"; // ← canvia-ho!

function login() {
  const pw = document.getElementById('pw').value;
  if (pw === ADMIN_PASSWORD) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    if (typeof window.iniciarApp === 'function') window.iniciarApp();
    else window._loginOk = true; // el mòdul encara carrega, s'iniciarà quan estigui llest
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
  document.getElementById('pw').focus();
  document.getElementById('pw').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, query, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch, getDocs
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
}

// Si el login ja s'havia fet abans que el mòdul acabés de carregar
if (window._loginOk) window.iniciarApp();

// ── Comptadors ────────────────────────────────────────────────────────
function actualitzarComptadors() {
  document.getElementById('cnt-pendents').textContent = pendents.length;
  document.getElementById('cnt-aprovades').textContent = aprovades.length;
}

// ── Canvi de tab ──────────────────────────────────────────────────────
window.canviarTab = function(tab) {
  tabActiva = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activa'));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('activa');
  document.getElementById('panel-pendents').style.display  = tab === 'pendents'  ? 'block' : 'none';
  document.getElementById('panel-aprovades').style.display = tab === 'aprovades' ? 'block' : 'none';
  document.getElementById('panel-nova').style.display      = tab === 'nova'      ? 'block' : 'none';
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
  const pregunta = document.getElementById('nova-pregunta').value.trim();
  const respostes = [
    document.getElementById('nova-r1').value.trim(),
    document.getElementById('nova-r2').value.trim(),
    document.getElementById('nova-r3').value.trim(),
    document.getElementById('nova-r4').value.trim(),
  ];
  const correcta = document.querySelector('input[name="nova-correcta"]:checked')?.value;

  if (!autor || !pregunta || respostes.some(r => !r) || correcta === undefined) {
    mostrarToast('Omple tots els camps i marca la resposta correcta.', 'error');
    return;
  }
  await addDoc(collection(db, 'preguntes'), {
    autor, pregunta, respostes, correcta: parseInt(correcta),
    ordre: aprovades.length, createdAt: serverTimestamp()
  });
  document.getElementById('form-nova').reset();
  mostrarToast('Pregunta afegida al joc!', 'ok');
  canviarTab('aprovades');
};

// ── MODAL EDICIÓ ──────────────────────────────────────────────────────
function omplirModal(p, tipus) {
  document.getElementById('modal-tipus').value  = tipus;
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
  const autor    = document.getElementById('modal-autor').value.trim();
  const pregunta = document.getElementById('modal-pregunta').value.trim();
  const respostes = [
    document.getElementById('modal-r1').value.trim(),
    document.getElementById('modal-r2').value.trim(),
    document.getElementById('modal-r3').value.trim(),
    document.getElementById('modal-r4').value.trim(),
  ];
  const correcta = document.querySelector('input[name="modal-correcta"]:checked')?.value;

  if (!autor || !pregunta || respostes.some(r => !r) || correcta === undefined) {
    mostrarToast('Omple tots els camps.', 'error');
    return;
  }

  const data = { autor, pregunta, respostes, correcta: parseInt(correcta) };

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
