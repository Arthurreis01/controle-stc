// js/dashboard.js

// ── Firebase Firestore ───────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyChlOCcH7Pgxfv1Xe7Kv-UXTTGjeHalbmo",
  authDomain: "stc-rtc.firebaseapp.com",
  projectId: "stc-rtc",
  storageBucket: "stc-rtc.firebasestorage.app",
  messagingSenderId: "629264031087",
  appId: "1:629264031087:web:832c04326769088752dc9a"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── Definição dos Centros Disponíveis ─────────────────────────────────
const CENTERS = [
  { code: '7330', name: 'CEIMMA' },
  { code: '7220', name: 'CEIMBE' },
  { code: '6830', name: 'CEIMNA' },
  { code: '8510', name: 'CEIMSA' },
  { code: '0960', name: 'CEIMBE' },
  { code: '7910', name: 'CEIMLA' },
];

// ── Busca todos os itens de um centro no Firestore ────────────────────
async function loadItems(centerCode) {
  const snap = await db
    .collection('inventarios')
    .doc(centerCode)
    .collection('itens')
    .get();
  return snap.docs.map(doc => doc.data());
}

// ── Cria um único card de resumo para o “Centro XXXX” ────────────────
async function createCenterCard({ code, name }) {
  const items = await loadItems(code);

  const totalItens = items.length;
  const countCrit  = items.filter(i => Number(i.autonomia) <= 7).length;

  // separa por categoria
  const recFrio = items
    .filter(i => i.category === 'Frigorificados')
    .reduce((sum, i) => sum + Number(i.recomenda || 0), 0);

  const recSec = items
    .filter(i => i.category === 'Secos')
    .reduce((sum, i) => sum + Number(i.recomenda || 0), 0);

  const wrapper = document.createElement('div');
  wrapper.className = 'col-custom';
  wrapper.innerHTML = `
    <div class="card-summary">
      <div class="card-header">${code} — ${name}</div>
      <div class="card-body">
        <p><small>Itens Totais</small></p>
        <h4>${totalItens}</h4>

        <p><small>Itens Críticos (≤7 dias)</small></p>
        <h4>${countCrit}</h4>

        <p><small>Recompletamento Frigorificados (kg)</small></p>
        <h4>${recFrio}</h4>

        <p><small>Recompletamento Secos (kg)</small></p>
        <h4>${recSec}</h4>

        <div class="link-container">
          <a href="inventory.html?center=${code}" class="link-details">
            Acessar inventário →
          </a>
        </div>
      </div>
    </div>
  `;
  return wrapper;
}

// ── Renderiza todos os cards na página “dashboard.html” ──────────────
async function renderDashboard() {
  const container = document.getElementById('cards-container');
  if (!container) return;

  container.innerHTML = ''; // limpa
  // Para cada centro, cria o card (await garante ordem estável)
  for (const center of CENTERS) {
    const cardEl = await createCenterCard(center);
    container.appendChild(cardEl);
  }
}

// ── Setup inicial: quando o DOM estiver pronto, dispara renderDashboard ─
window.addEventListener('DOMContentLoaded', () => {
  renderDashboard();

  // (mantém seus outros listeners, se houver)
  const btnGlobal = document.getElementById('global-export');
  if (btnGlobal) {
    btnGlobal.addEventListener('click', () => {
      alert('Função de “Exportar Global” não implementada.');
    });
  }
});
