// js/inventory.js

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

// ── Lista de Centros (em Português) ────────────────────────────────────
const CENTERS = ['0960','0961','0962','0963','0964','0965'];

// ── Helpers de Firestore ────────────────────────────────────────────────

// Carrega itens (array) do Firestore para este centro
async function loadItems(center) {
  const snapshot = await db
    .collection('inventarios')
    .doc(center)
    .collection('itens')
    .get();
  return snapshot.docs.map(doc => doc.data());
}

// Salva itens (array) no Firestore para este centro
async function saveItems(center, items) {
  const colRef = db.collection('inventarios').doc(center).collection('itens');
  const batch = db.batch();
  // Sobrescreve cada item pelo seu PI
  items.forEach(item => {
    const docRef = colRef.doc(item.pi);
    batch.set(docRef, item);
  });
  await batch.commit();
}

// ── Cálculo de Métricas ────────────────────────────────────────────────────

// Recalcula “autonomia”, “recomenda” e “status” para todos os itens do array
function calculateAllMetrics(items) {
  items.forEach(item => {
    const rate = Number(item.consum_dia) || 1;
    const disp = Number(item.disponivel) || 0;
    const auto = disp / (rate || 1);
    const ideal = rate * 7; // meta: 7 dias
    const rec = Math.max(0, Math.round(ideal - disp));

    item.autonomia = Number(auto.toFixed(1));
    item.recomenda = rec;
    item.status = item.autonomia <= 7 ? 'Repor' : 'OK';
  });
}

// Formata número para exibição (garante string ou “0”)
function fmtNum(n) {
  return isNaN(n) ? '0' : String(n);
}

// ── Obtém parâmetro “center” da URL ────────────────────────────────────────
function getCenterParam() {
  return new URLSearchParams(window.location.search).get('center');
}

// ── Renderização da Página “Seleção de Centro” ───────────────────────────
function renderCenterSelection() {
  const container = document.getElementById('inventory-container');
  container.innerHTML = `
    <div class="p-4">
      <h2>Selecione o Centro</h2>
      <div class="mt-3">
        ${CENTERS.map(c => `
          <a href="inventory.html?center=${c}" class="btn btn-primary me-2 mb-2">
            Centro ${c}
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

// ── Renderização da Página do Centro (com ?center=XXXX) ───────────────────
async function renderCenterPage() {
  const center = getCenterParam();
  const container = document.getElementById('inventory-container');

  if (!center) {
    renderCenterSelection();
    return;
  }
  if (!CENTERS.includes(center)) {
    container.innerHTML = `<div class="p-4"><p class="text-danger">Centro "${center}" inválido.</p></div>`;
    return;
  }

  // Monta HTML estático
  container.innerHTML = `
    <nav class="navbar bg-primary text-white px-3">
      <button id="btn-back" class="btn btn-outline-light btn-sm">&larr; Voltar</button>
      <span id="inv-title" class="navbar-text ms-3"></span>
      <div class="ms-auto">
        <button id="btn-add-product" class="btn btn-outline-light btn-sm me-2">
          <i class="bi bi-plus-lg"></i> Adicionar Produto
        </button>
        <button id="btn-import-base" class="btn btn-outline-light btn-sm me-2">
          <i class="bi bi-box-arrow-in-up"></i> Importar Inventário
        </button>
        <button id="btn-import" class="btn btn-outline-light btn-sm">
          <i class="bi bi-upload"></i> Importar Estoque
        </button>
      </div>
    </nav>
    <div id="inv-msg" class="alert" style="display:none; margin:1rem;"></div>
    <section id="center-metrics-section" class="px-3 py-2">
      <div id="center-cards" class="d-flex gap-3 flex-wrap"></div>
    </section>
    <section id="center-section" class="px-3 py-2">
      <div class="table-responsive">
        <table class="table table-hover align-middle inv-table">
          <thead class="table-dark">
            <tr>
              <th>PI</th><th>Item</th><th>Disp.</th><th>Comp.</th>
              <th>Cons./dia</th><th>Autonomia</th><th>Status</th>
              <th>Recomenda</th><th>Editar</th><th>Excluir</th>
            </tr>
          </thead>
          <tbody id="center-body"></tbody>
        </table>
      </div>
      <button id="save-consumption" class="btn btn-primary btn-sm" disabled>
        Salvar “Cons./dia”
      </button>
    </section>
  `;

  // Hooks no DOM
  const btnBack      = document.getElementById('btn-back');
  const invTitle     = document.getElementById('inv-title');
  const invMsg       = document.getElementById('inv-msg');
  const cardsContainer= document.getElementById('center-cards');
  const metricsSection= document.getElementById('center-metrics-section');
  const tableSection = document.getElementById('center-section');
  const tbody         = document.getElementById('center-body');
  const saveBtn       = document.getElementById('save-consumption');
  const btnAdd        = document.getElementById('btn-add-product');
  const btnImpEstoque= document.getElementById('btn-import');
  const btnImpBase   = document.getElementById('btn-import-base');
  const addForm      = document.getElementById('add-product-form');
  const inputPI      = document.getElementById('input-pi');
  const inputName    = document.getElementById('input-name');
  const inputConsume = document.getElementById('input-consume');
  const fileInputCenter= document.getElementById('file-input-center');
  const importMsg    = document.getElementById('import-msg-center');
  const fileInputBase= document.getElementById('file-input-base');
  const importBaseMsg= document.getElementById('import-base-msg');

  invTitle.textContent = `Centro ${center}`;

  // Carrega e inicializa
  let items = await loadItems(center);
  calculateAllMetrics(items);

  // ── Funções de Renderização ────────────────────────────────────────────
  function createCard(title, value) {
    const div = document.createElement('div');
    div.className = 'card metric-card flex-fill shadow-sm bg-white';
    div.innerHTML = `<div class="card-body"><small class="text-muted">${title}</small><h4 class="mt-1">${value}</h4></div>`;
    return div;
  }
  function renderMetrics() {
    cardsContainer.innerHTML = '';
    const totalItens = items.length;
    const countCrit  = items.filter(i => i.autonomia <= 7).length;
    const totalRec   = items.reduce((ac, i) => ac + Number(i.recomenda||0), 0);
    const fillRate   = totalItens===0?'0%':`${Math.round(((totalItens-countCrit)/totalItens)*100)}%`;

    cardsContainer.appendChild(createCard('Itens Totais', totalItens));
    cardsContainer.appendChild(createCard('Itens Críticos (≤7 dias)', countCrit));
    cardsContainer.appendChild(createCard('Total a Recomprar', totalRec));
    cardsContainer.appendChild(createCard('Taxa de Atendimento', fillRate));
    metricsSection.classList.remove('d-none');
  }
  function renderTable() {
    tbody.innerHTML = '';
    items.forEach((item, idx) => {
      const tr = document.createElement('tr');
      if (idx%2) tr.classList.add('table-light');
      tr.innerHTML = `
        <td><a href="#">${item.pi}</a></td>
        <td>${item.nome}</td>
        <td>${fmtNum(item.disponivel)}</td>
        <td>${fmtNum(item.comprometida)}</td>
        <td>
          <input type="number" class="form-control form-control-sm cons-input"
            data-pi="${item.pi}" value="${item.consum_dia||0}" min="0" style="width:80px;">
        </td>
        <td>${fmtNum(item.autonomia)}</td>
        <td>
          <span class="badge ${item.status==='Repor'?'bg-danger':'bg-success'}">
            ${item.status}
          </span>
        </td>
        <td>${fmtNum(item.recomenda)}</td>
        <td><button class="btn btn-sm btn-outline-secondary btn-edit" data-pi="${item.pi}">
          <i class="bi bi-pencil"></i>
        </button></td>
        <td><button class="btn btn-sm btn-outline-danger btn-delete" data-pi="${item.pi}">
          <i class="bi bi-trash"></i>
        </button></td>
      `;
      tbody.appendChild(tr);
    });
    saveBtn.disabled = items.length===0;
    tableSection.classList.remove('d-none');
  }

  // ── Ações do Usuário (todas async quando salvam no Firestore) ───────────
  btnBack.addEventListener('click', ()=> window.history.back());

  saveBtn.addEventListener('click', async () => {
    document.querySelectorAll('.cons-input').forEach(inp => {
      const pi = inp.dataset.pi;
      const val = Number(inp.value)||0;
      const it = items.find(i=>i.pi===pi);
      if (it) it.consum_dia=val;
    });
    calculateAllMetrics(items);
    await saveItems(center, items);
    renderMetrics();
    renderTable();
    invMsg.textContent='Consumo diário atualizado com sucesso.';
    invMsg.className='alert alert-success'; invMsg.style.display='block';
    setTimeout(()=>invMsg.style.display='none',2500);
  });

  tbody.addEventListener('click', async evt => {
    const btn = evt.target.closest('.btn-delete, .btn-edit');
    if (!btn) return;
    const pi = btn.dataset.pi;
    if (btn.classList.contains('btn-delete')) {
      if (!confirm(`Excluir item PI ${pi}?`)) return;
      // Deleta do Firestore e do array
      await db.collection('inventarios').doc(center)
        .collection('itens').doc(pi).delete();
      items = items.filter(i=>i.pi!==pi);
    } else {
      const it = items.find(i=>i.pi===pi);
      const newName = prompt('Novo nome (vazio=mantém):', it.nome);
      if (newName!==null && newName.trim()) it.nome=newName.trim();
      const newRate = prompt('Novo Cons./dia (vazio=mantém):', it.consum_dia);
      if (newRate!==null && newRate.trim() && !isNaN(Number(newRate))) {
        it.consum_dia=Number(newRate);
      }
    }
    calculateAllMetrics(items);
    await saveItems(center, items);
    renderMetrics();
    renderTable();
    invMsg.textContent=`Item PI ${pi} atualizado.`;
    invMsg.className='alert alert-success'; invMsg.style.display='block';
    setTimeout(()=>invMsg.style.display='none',2500);
  });

  btnAdd.addEventListener('click', ()=> new bootstrap.Modal(
    document.getElementById('modalAddProduct')
  ).show());
  addForm.addEventListener('submit', async evt => {
    evt.preventDefault();
    const piVal = inputPI.value.trim();
    const nameVal = inputName.value.trim();
    const consVal = Number(inputConsume.value)||0;
    if (!piVal||!nameVal) return;
    if (items.some(i=>i.pi===piVal)) {
      invMsg.textContent=`PI ${piVal} já existe.`; invMsg.className='alert alert-warning';
      invMsg.style.display='block'; setTimeout(()=>invMsg.style.display='none',2500);
      return;
    }
    items.push({ pi:piVal, nome:nameVal, disponivel:0, comprometida:0,
      consum_dia:consVal, autonomia:0, status:'Repor', recomenda:0 });
    calculateAllMetrics(items);
    await saveItems(center, items);
    renderMetrics(); renderTable();
    invMsg.textContent=`Produto PI ${piVal} adicionado.`; invMsg.className='alert alert-success';
    invMsg.style.display='block'; setTimeout(()=>invMsg.style.display='none',2500);
    addForm.reset(); bootstrap.Modal.getInstance(
      document.getElementById('modalAddProduct')
    ).hide();
  });

  btnImpEstoque.addEventListener('click', ()=> new bootstrap.Modal(
    document.getElementById('modalImport')
  ).show());
  fileInputCenter.addEventListener('change', async evt => {
    // mesma lógica de leitura XLSX, só que ao final:
    // calculateAllMetrics(items);
    // await saveItems(center, items);
    // renderMetrics(); renderTable(); mostrar importMsg…
  });

  btnImpBase.addEventListener('click', ()=> new bootstrap.Modal(
    document.getElementById('modalImportBase')
  ).show());
  fileInputBase.addEventListener('change', async evt => {
    // mesma lógica de leitura XLSX de base, e ao final:
    // calculateAllMetrics(items);
    // await saveItems(center, items);
    // renderMetrics(); renderTable(); mostrar importBaseMsg…
  });

  calculateAllMetrics(items);
  renderMetrics();
  renderTable();
}

window.addEventListener('DOMContentLoaded', renderCenterPage);
