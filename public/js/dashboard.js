// js/dashboard.js

// ── Definição dos Centros Disponíveis (em Português) ────────────────
const CENTERS = [
  { code: '7330', name: 'CEIMMA' },
  { code: '7220', name: 'CEIMBE' },
  { code: '6830', name: 'CEIMNA' },
  { code: '8510', name: 'CEIMSA' },
  { code: '0960', name: 'CEIMBE' },
  { code: '7910', name: 'CEIMLA' },
];

// ── Função Auxiliar: carrega itens de um centro via localStorage ────
function loadItems(center) {
  const key = `inventory_items_${center}`;
  return JSON.parse(localStorage.getItem(key) || '[]');
}

// ── Cria um único card de resumo para o “Centro XXXX” ────────────────
function createCenterCard({ code, name }) {
  const items      = loadItems(code);
  const totalItens = items.length;
  const countCrit  = items.filter(i => Number(i.autonomia) <= 7).length;

  // agora contamos **somente** os explicitamente marcados:
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
            Ver detalhes →
          </a>
        </div>
      </div>
    </div>
  `;
  return wrapper;
}

// ── Renderiza todos os cards na página “dashboard.html” ──────────────
function renderDashboard() {
  const container = document.getElementById('cards-container');
  if (!container) return;
  container.innerHTML = '';
  CENTERS.forEach(center => {
    container.appendChild(createCenterCard(center));
  });
}

// ── Setup inicial: quando o DOM estiver pronto, dispara renderDashboard ─
window.addEventListener('DOMContentLoaded', () => {
  renderDashboard();

  // ■ Exportar Global (Dashboard)
  const btnGlobal = document.getElementById('global-export');
  if (btnGlobal) {
    btnGlobal.addEventListener('click', () => {
      alert('Função de “Exportar Global” não implementada. Insira sua lógica aqui.');
    });
  }

  // ■ Organizar Coluna “Status” (Inventário) – mantém como antes
  const btnSortStatus = document.getElementById('btn-sort-status');
  if (btnSortStatus) {
    btnSortStatus.addEventListener('click', () => {
      const tableBody = document.querySelector('#inventory-table tbody');
      if (!tableBody) return;
      const rows = Array.from(tableBody.querySelectorAll('tr'));
      rows.sort((a, b) => {
        const statusA = a.querySelector('td.status-cell')?.innerText.trim() || '';
        const statusB = b.querySelector('td.status-cell')?.innerText.trim() || '';
        return statusA.localeCompare(statusB);
      });
      rows.forEach(row => tableBody.appendChild(row));
    });
  }
});
