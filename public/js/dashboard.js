// js/dashboard.js

// ── Definição dos Centros Disponíveis (em Português) ────────────────
const CENTERS = ['0960', '0961', '0962', '0963', '0964', '0965'];

// ── Função Auxiliar: carrega itens de um centro via localStorage ────
function loadItems(center) {
  const key = `inventory_items_${center}`;
  return JSON.parse(localStorage.getItem(key) || '[]');
}

// ── Função Auxiliar: calcula Fill Rate (porcentagem arredondada) ───
function calculateFillRate(total, criticos) {
  if (total === 0) return '0%';
  return `${Math.round(((total - criticos) / total) * 100)}%`;
}

// ── Cria um único card de resumo para o “Centro XXXX” ────────────────
function createCenterCard(center) {
  // 1) Lê os itens armazenados no localStorage
  const items = loadItems(center);

  // 2) Calcula as métricas em Português
  const totalItens = items.length;
  const countCrit = items.filter(i => Number(i.autonomia) <= 7).length;
  const totalRec = items.reduce((acum, i) => acum + Number(i.recomenda || 0), 0);
  const fillRate = calculateFillRate(totalItens, countCrit);

  // 3) Monta o elemento DOM do card
  const wrapper = document.createElement('div');
  wrapper.className = 'col-custom';

  wrapper.innerHTML = `
    <div class="card-summary">
      <div class="card-header">Centro ${center}</div>
      <div class="card-body">
        <p><small>Itens Totais</small></p>
        <h4>${totalItens}</h4>

        <p><small>Itens Críticos (≤7 dias)</small></p>
        <h4>${countCrit}</h4>

        <p><small>Total a Recomprar</small></p>
        <h4>${totalRec}</h4>

        <p><small>Taxa de Atendimento</small></p>
        <h4>${fillRate}</h4>

        <div class="link-container">
          <a href="inventory.html?center=${center}" class="link-details">
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

  // Limpa o container antes de criar novo conteúdo
  container.innerHTML = '';

  CENTERS.forEach(center => {
    const card = createCenterCard(center);
    container.appendChild(card);
  });
}

// ── Setup inicial: quando o DOM estiver pronto, dispara renderDashboard e listeners ─
window.addEventListener('DOMContentLoaded', () => {
  // Dashboard
  renderDashboard();

  // ■ Exportar Global (Dashboard)
  const btnGlobal = document.getElementById('global-export');
  if (btnGlobal) {
    btnGlobal.addEventListener('click', () => {
      alert('Função de “Exportar Global” não implementada. Insira sua lógica aqui.');
    });
  }

  // ■ Organizar Coluna “Status” (Inventário)
  const btnSortStatus = document.getElementById('btn-sort-status');
  if (btnSortStatus) {
    btnSortStatus.addEventListener('click', () => {
      // identifica a <tbody> da tabela de inventário
      const tableBody = document.querySelector('#inventory-table tbody');
      if (!tableBody) return;

      // pega todas as linhas e ordena pelo texto da célula .status-cell
      const rows = Array.from(tableBody.querySelectorAll('tr'));
      rows.sort((a, b) => {
        const statusA = a.querySelector('td.status-cell')?.innerText.trim() || '';
        const statusB = b.querySelector('td.status-cell')?.innerText.trim() || '';
        return statusA.localeCompare(statusB);
      });

      // reanexa as linhas em ordem alfabética
      rows.forEach(row => tableBody.appendChild(row));
    });
  }
});
