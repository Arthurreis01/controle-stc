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

// ── Definição dos Centros (código + nome) ─────────────────────────────
const CENTERS = [
  { code: '7330', name: 'CEIMMA' },
  { code: '7220', name: 'CEIMBE' },
  { code: '6830', name: 'CEIMNA' },
  { code: '8510', name: 'CEIMRG' },
  { code: '0960', name: 'CEIMSA' },
  { code: '7910', name: 'CEIMLA' },
];

// ── Helpers Firestore + LocalStorage ──────────────────────────────────
async function loadItems(center) {
  // Always read from Firestore
  const snap = await db
    .collection('inventarios')
    .doc(center)
    .collection('itens')
    .get();

  const items = snap.docs.map(d => d.data());
  // Keep localStorage in sync so dashboard has data
  localStorage.setItem(`inventory_items_${center}`, JSON.stringify(items));
  return items;
}

async function saveItems(center, items) {
  // Batch write to Firestore
  const col = db.collection('inventarios').doc(center).collection('itens');
  const batch = db.batch();
  items.forEach(item => batch.set(col.doc(item.pi), item));
  await batch.commit();
  // Mirror to localStorage
  localStorage.setItem(`inventory_items_${center}`, JSON.stringify(items));
}

// ── Cálculo de Métricas ────────────────────────────────────────────────
function calculateAllMetrics(items) {
  items.forEach(item => {
    const rate = Number(item.consum_dia) || 1;
    const disp = Number(item.disponivel)   || 0;
    const comp = Number(item.comprometida) || 0;
    const auto = (disp + comp) / (rate || 1);
    const rec  = Math.max(0, Math.round(rate * 7 - (disp + comp)));

    item.autonomia = Number(auto.toFixed(1));
    item.recomenda = rec;
    item.status    = item.autonomia < 7 ? 'Repor' : 'OK';
  });
}

// ── Utilitários ───────────────────────────────────────────────────────
function fmtNum(n) {
  return isNaN(n) ? '0' : String(n);
}

function getCenterParam() {
  return new URLSearchParams(window.location.search).get('center');
}

// ── 1) Seleção de Centro ───────────────────────────────────────────────
function renderCenterSelection() {
  const container = document.getElementById('inventory-container');
  container.innerHTML = `
    <div class="p-4">
      <h2>Selecione o Centro</h2>
      <div class="mt-3">
        ${CENTERS.map(c => `
          <a href="inventory.html?center=${c.code}"
             class="btn btn-primary me-2 mb-2">
            ${c.code} — ${c.name}
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

// ── 2) Página do Centro ────────────────────────────────────────────────
async function renderCenterPage() {
  const centerCode = getCenterParam();
  const container  = document.getElementById('inventory-container');

  // Se não há center=, renderiza seleção
  if (!centerCode) {
    renderCenterSelection();
    return;
  }

  // Valida se o código existe
  const centerObj = CENTERS.find(c => c.code === centerCode);
  if (!centerObj) {
    container.innerHTML = `
      <div class="p-4"><p class="text-danger">
        Centro "${centerCode}" inválido.
      </p></div>`;
    return;
  }

  // Shell HTML (inclui search abaixo dos cards, sticky header)
  container.innerHTML = `
    <nav class="navbar bg-primary text-white px-3">
      <button id="btn-back" class="btn btn-outline-light btn-sm">
        &larr; Sair
      </button>
      <span id="inv-title" class="navbar-text ms-3"></span>

      <div class="ms-auto d-flex align-items-center">
        <!-- small group stays together -->
        <div class="btn-group btn-group-sm">
          <button id="btn-add-product" class="btn btn-outline-light">
            <i class="bi bi-plus-lg"></i> Adicionar Produto
          </button>
          <button id="btn-import" class="btn btn-outline-light">
            <i class="bi bi-box-arrow-in-up"></i> Importar Estoque
          </button>
        </div>

        <!-- extra‐wide gap before this one -->
        <button
          id="btn-import-base"
          class="btn btn-outline-light btn-sm ms-5"
        >
          <i class="bi bi-file-earmark-arrow-up"></i>
          Iniciar Inventário
        </button>
      </div>
    </nav>
    <div id="inv-msg" class="alert" style="display:none;margin:1rem;"></div>

    <section id="center-metrics-section" class="px-3 py-2 d-none">
      <div id="center-cards" class="d-flex gap-3 flex-wrap"></div>
    </section>

    <div class="px-3 mb-3 d-none" id="search-container">
      <input id="search-input"
             type="text"
             class="form-control"
             placeholder="Buscar por PI, nome ou categoria…">
    </div>

    <section id="center-section" class="px-3 py-2 d-none">
      <div class="table-responsive">
        <table class="table table-hover align-middle inv-table">
          <thead class="table-dark sticky-top">
            <tr>
              <th>PI</th>
              <th>Categoria</th>
              <th>Item</th>
              <th>Disp.</th>
              <th>Comp.</th>
              <th>Cons./dia</th>
              <th>Autonomia</th>
              <th>Status</th>
              <th>Recomenda</th>
              <th>Editar</th>
              <th>Excluir</th>
            </tr>
          </thead>
          <tbody id="center-body"></tbody>
        </table>
      </div>
    </section>
  `;

  // ── Hooks ────────────────────────────────────────────────────────────
  const btnBack        = document.getElementById('btn-back');
  const invTitle       = document.getElementById('inv-title');
  const invMsg         = document.getElementById('inv-msg');
  const cardsContainer = document.getElementById('center-cards');
  const metricsSection = document.getElementById('center-metrics-section');
  const tableSection   = document.getElementById('center-section');
  const searchContainer= document.getElementById('search-container');
  const searchInput    = document.getElementById('search-input');
  const tbody          = document.getElementById('center-body');
  const btnAdd         = document.getElementById('btn-add-product');
  const btnImpBase     = document.getElementById('btn-import-base');
  const btnImpEstoque  = document.getElementById('btn-import');
  const fileInputBase  = document.getElementById('file-input-base');
  const importBaseMsg  = document.getElementById('import-base-msg');
  const fileInputCenter= document.getElementById('file-input-center');
  const importMsgEst   = document.getElementById('import-msg-center');
  const addForm        = document.getElementById('add-product-form');
  const inputPI        = document.getElementById('input-pi');
  const inputName      = document.getElementById('input-name');
  const inputConsume   = document.getElementById('input-consume');

  invTitle.textContent = `Centro ${centerObj.code} — ${centerObj.name}`;

  // ── Carrega dados e calcula métricas ─────────────────────────────────
  let items = await loadItems(centerObj.code);
  calculateAllMetrics(items);

  // ── Funções de Renderização ──────────────────────────────────────────
  function createCard(title, value) {
    const d = document.createElement('div');
    d.className = 'card metric-card flex-fill shadow-sm bg-white';
    d.innerHTML = `
      <div class="card-body">
        <small class="text-muted">${title}</small>
        <h4 class="mt-1">${value}</h4>
      </div>`;
    return d;
  }

  function renderMetrics() {
    const total = items.length;
    const crit  = items.filter(i => i.autonomia < 7).length;
    const recF  = items.filter(i => i.category==='Frigorificados')
                       .reduce((s,i)=> s+Number(i.recomenda||0),0);
    const recS  = items.filter(i => i.category==='Secos')
                       .reduce((s,i)=> s+Number(i.recomenda||0),0);

    cardsContainer.innerHTML = '';
    cardsContainer.appendChild(createCard('Itens Totais', total));
    cardsContainer.appendChild(createCard('Itens Críticos (≤7 dias)', crit));
    cardsContainer.appendChild(createCard('Recompletamento Frigorificados (kg)', recF));
    cardsContainer.appendChild(createCard('Recompletamento Secos (kg)', recS));
    metricsSection.classList.remove('d-none');
    searchContainer.classList.remove('d-none');
  }

  function renderTable(filter='') {
    // Ordena por categoria → PI
    items.sort((a,b)=>{
      const ca = a.category||'', cb=b.category||'';
      return ca!==cb ? ca.localeCompare(cb) : a.pi.localeCompare(b.pi);
    });
    tbody.innerHTML = '';
    items.forEach(item=>{
      const hay = [item.pi, item.category, item.nome].join(' ').toLowerCase();
      if(filter && !hay.includes(filter.toLowerCase())) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><a href="#">${item.pi}</a></td>
        <td>
          <select class="form-select form-select-sm cat-select" data-pi="${item.pi}" style="width:130px">
            <option value="" disabled ${!item.category?'selected':''}>––</option>
            <option value="Frigorificados" ${item.category==='Frigorificados'?'selected':''}>
              Frigorificados
            </option>
            <option value="Secos" ${item.category==='Secos'?'selected':''}>
              Secos
            </option>
          </select>
        </td>
        <td>${item.nome}</td>
        <td>${fmtNum(item.disponivel)}</td>
        <td>${fmtNum(item.comprometida)}</td>
        <td>
          <input type="number"
                 class="form-control form-control-sm cons-input"
                 data-pi="${item.pi}"
                 value="${item.consum_dia||0}"
                 min="0"
                 style="width:80px;">
        </td>
        <td>${fmtNum(item.autonomia)}</td>
        <td>
          <span class="badge ${item.status==='Repor'?'bg-danger':'bg-success'}">
            ${item.status}
          </span>
        </td>
        <td>${fmtNum(item.recomenda)}</td>
        <td>
          <button class="btn btn-sm btn-outline-secondary btn-edit" data-pi="${item.pi}">
            <i class="bi bi-pencil"></i>
          </button>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-danger btn-delete" data-pi="${item.pi}">
            <i class="bi bi-trash"></i>
          </button>
        </td>`;
      tbody.appendChild(tr);
    });
    tableSection.classList.remove('d-none');
  }

  // ── Filtros e Eventos ────────────────────────────────────────────────
  // Search
  searchInput.addEventListener('input', e => {
    renderTable(e.target.value);
  });

  // Importar base (sobrescreve tudo)
  fileInputBase.addEventListener('change', async evt => {
    const f = evt.target.files[0];
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const wb  = XLSX.read(buf,{type:'array'});
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
      items = raw.map(row=>{
        const mapKey = k=> k.normalize('NFD')
                             .replace(/[\u0300-\u036f]/g,'')
                             .replace(/\s+/g,'_').toUpperCase();
        const norm = {};
        Object.keys(row).forEach(k=> norm[mapKey(k)] = String(row[k]).trim());
        return {
          pi:           norm.PI                  || '',
          nome:         norm.NOME_ITEM           || norm.ITEM || '',
          disponivel:   Number(norm.QTDE_DISPONIVEL)   || 0,
          comprometida: Number(norm.QTDE_COMPROMETIDA) || 0,
          consum_dia:   Number(norm.CONSUM_DIA)         || 0,
          category:     '', // inicia vazia
          autonomia:    0,
          recomenda:    0,
          status:       'OK'
        };
      });
      calculateAllMetrics(items);
      await saveItems(centerObj.code, items);
      renderMetrics();
      renderTable(searchInput.value);
      importBaseMsg.textContent   = 'Inventário base importado!';
      importBaseMsg.className     = 'alert alert-success';
      importBaseMsg.style.display = 'block';
    } catch(e) {
      console.error(e);
      importBaseMsg.textContent   = 'Erro ao importar inventário.';
      importBaseMsg.className     = 'alert alert-danger';
      importBaseMsg.style.display = 'block';
    }
    setTimeout(()=>importBaseMsg.style.display='none',3000);
  });

  // Importar estoque (atualiza qtd+consumo)
  fileInputCenter.addEventListener('change', async evt => {
    const f = evt.target.files[0];
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const wb  = XLSX.read(buf,{type:'array'});
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
      raw.forEach(row=>{
        const mapKey = k=> k.normalize('NFD')
                             .replace(/[\u0300-\u036f]/g,'')
                             .replace(/\s+/g,'_').toUpperCase();
        const norm = {};
        Object.keys(row).forEach(k=> norm[mapKey(k)] = String(row[k]).trim());
        const piVal = norm.PI;
        const it    = items.find(i=>i.pi===piVal);
        if(it){
          it.disponivel   = Number(norm.QTDE_DISPONIVEL)   || it.disponivel;
          it.comprometida = Number(norm.QTDE_COMPROMETIDA) || it.comprometida;
          it.consum_dia   = Number(norm.CONSUM_DIA)         || it.consum_dia;
        }
      });
      calculateAllMetrics(items);
      await saveItems(centerObj.code, items);
      renderMetrics();
      renderTable(searchInput.value);
      importMsgEst.textContent   = 'Estoque importado!';
      importMsgEst.className     = 'alert alert-success';
      importMsgEst.style.display = 'block';
    } catch(e) {
      console.error(e);
      importMsgEst.textContent   = 'Erro ao importar estoque.';
      importMsgEst.className     = 'alert alert-danger';
      importMsgEst.style.display = 'block';
    }
    setTimeout(()=>importMsgEst.style.display='none',3000);
  });

  // Salvar cons_dia ao teclar Enter
  tbody.addEventListener('keydown', async e => {
    if(!e.target.matches('.cons-input') || e.key!=='Enter') return;
    document.querySelectorAll('.cons-input').forEach(inp=>{
      const it = items.find(i=>i.pi===inp.dataset.pi);
      if(it) it.consum_dia = Number(inp.value)||0;
    });
    calculateAllMetrics(items);
    await saveItems(centerObj.code, items);
    invMsg.textContent       = 'Consumo atualizado.';
    invMsg.className         = 'alert alert-success';
    invMsg.style.display     = 'block';
    setTimeout(()=>invMsg.style.display='none',2500);
    renderMetrics();
    renderTable(searchInput.value);
  });

  // Mudar categoria
  tbody.addEventListener('change', async e=>{
    if(!e.target.matches('.cat-select')) return;
    const it = items.find(i=>i.pi===e.target.dataset.pi);
    if(!it) return;
    it.category = e.target.value;
    await saveItems(centerObj.code, items);
    invMsg.textContent       = `Categoria de PI ${it.pi} atualizada.`;
    invMsg.className         = 'alert alert-success';
    invMsg.style.display     = 'block';
    setTimeout(()=>invMsg.style.display='none',2500);
    renderMetrics();
    renderTable(searchInput.value);
  });

  // Editar / Excluir
  tbody.addEventListener('click', async e=>{
    const btn = e.target.closest('.btn-edit, .btn-delete');
    if(!btn) return;
    const pi = btn.dataset.pi;
    if(btn.classList.contains('btn-delete')){
      if(!confirm(`Excluir item PI ${pi}?`)) return;
      await db.collection('inventarios').doc(centerObj.code)
              .collection('itens').doc(pi).delete();
      items = items.filter(i=>i.pi!==pi);
    } else {
      const it = items.find(i=>i.pi===pi);
      const newName = prompt('Novo nome:', it.nome);
      if(newName) it.nome = newName.trim();
      const newRate = prompt('Novo Cons./dia:', it.consum_dia);
      if(newRate && !isNaN(Number(newRate))) it.consum_dia = Number(newRate);
    }
    calculateAllMetrics(items);
    await saveItems(centerObj.code, items);
    invMsg.textContent       = `Item PI ${pi} atualizado.`;
    invMsg.className         = 'alert alert-success';
    invMsg.style.display     = 'block';
    setTimeout(()=>invMsg.style.display='none',2500);
    renderMetrics();
    renderTable(searchInput.value);
  });

  // Modais e voltar
  btnBack.addEventListener('click',()=>window.history.back());
  btnAdd.addEventListener('click',()=>new bootstrap.Modal(
    document.getElementById('modalAddProduct')
  ).show());
  document.getElementById('btn-import-base').addEventListener('click', () => {
    const ok = confirm(
      'Ao importar, toda sua base de estoque irá ser atualizada.\n\nDeseja continuar?'
    );
    if (!ok) return;
    new bootstrap.Modal(
      document.getElementById('modalImportBase')
    ).show();
  });
    document.getElementById('btn-import').addEventListener('click',()=>new bootstrap.Modal(
    document.getElementById('modalImport')
  ).show());

  // Primeiro desenho
  renderMetrics();
  renderTable('');
}

window.addEventListener('DOMContentLoaded', renderCenterPage);
