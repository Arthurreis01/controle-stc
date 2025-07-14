// js/app.js

// ── Firebase Init & Firestore Reference ─────────────────────────
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

// ── Firestore Helpers ───────────────────────────────────────────
async function getData(collectionKey) {
  const snapshot = await db.collection(collectionKey).get();
  return snapshot.docs.map(doc => doc.data());
}

async function setData(collectionKey, items, idField) {
  const ref   = db.collection(collectionKey);
  const batch = db.batch();

  // delete anything that’s already there
  const existing = await ref.get();
  existing.docs.forEach(d => batch.delete(d.ref));

  // write new docs
  items.forEach(item => {
    const id = idField ? item[idField] : ref.doc().id;
    batch.set(ref.doc(id), item);
  });

  await batch.commit();
}

// ── Constants ───────────────────────────────────────────────────────
const CENTERS = [
  { code: '84810', name: 'CEIMBE' },
  { code: '86810', name: 'CEIMLA' },
  { code: '88820', name: 'CEIMMA' },
  { code: '83810', name: 'CEIMNA' },
  { code: '85810', name: 'CEIMRG' },
  { code: '82802', name: 'CEIMSA' }
];

// ── Helpers ─────────────────────────────────────────────────────
function parseQuery() {
  const q = {};
  const [_, query] = location.hash.split('?');
  if (query) query.split('&').forEach(p => {
    const [k,v] = p.split('=');
    q[k] = decodeURIComponent(v);
  });
  return q;
}

// ── ALERT UTILITIES ─────────────────────────────────────────────
async function getAlerts() {
  const now = Date.now();

  const pendItems6 = (await getData('rmtItems'))
    .filter(i => !i.linkedStc && i.importedAt)
    .filter(i => now - new Date(i.importedAt).getTime() > 6 * 24 * 60 * 60 * 1000)
    .length;

  const stcAlerts = (await getData('stcs'))
    .filter(s => s.status === 'PendingRTC' && s.createdAt)
    .filter(s => now - new Date(s.createdAt).getTime() > 3 * 24 * 60 * 60 * 1000)
    .length;

  const rtcAlerts = (await getData('rtcs'))
    .filter(r => r.status === 'Aguardando coleta' && r.history[0]?.time)
    .filter(r => now - new Date(r.history[0].time).getTime() > 2 * 24 * 60 * 60 * 1000)
    .length;

  return { pendItems6, stcAlerts, rtcAlerts };
}

async function updateSidebarAlerts() {
  const { pendItems6 } = await getAlerts();
  const link = document.querySelector('.sidebar nav a[href="#pending"]');
  if (!link) return;
  link.querySelectorAll('.alert-badge').forEach(b => b.remove());
  if (pendItems6 > 0) {
    const b = document.createElement('span');
    b.className = 'badge bg-warning text-dark alert-badge ms-auto';
    b.textContent = pendItems6;
    link.appendChild(b);
  }
}

async function updateSidebarBadges() {
  const today = new Date();
  const daysAgo = iso => Math.floor((today - new Date(iso)) / (1000 * 60 * 60 * 24));

  const stcs = await getData('stcs');
  const stcOverdue = stcs
    .filter(s => s.status === 'PendingRTC' && daysAgo(s.createdAt) > 3)
    .length;

  const rtcs = await getData('rtcs');
  const rtcOverdue = rtcs.filter(r => {
    const hCollect = r.history.find(h => h.status === 'Aguardando coleta')?.time;
    const hDeliver = r.history.find(h => h.status === 'Aguardando entrega')?.time;
    const overCollect = r.status === 'Aguardando coleta' && hCollect && daysAgo(hCollect) > 2;
    const overDeliver = r.status === 'Aguardando entrega' && hDeliver && daysAgo(hDeliver) > 1;
    return overCollect || overDeliver;
  }).length;

  document.querySelectorAll('.nav-badge').forEach(b => b.remove());
  const addBadge = (href, count) => {
    if (!count) return;
    const link = document.querySelector(`.sidebar nav a[href="${href}"]`);
    if (!link) return;
    const badge = document.createElement('span');
    badge.className = 'nav-badge';
    badge.textContent = count;
    link.appendChild(badge);
  };

  addBadge('#stc', stcOverdue);
  addBadge('#rtc', rtcOverdue);
}

// run on initial load and on every hash‐change
window.addEventListener('load', async () => { await updateSidebarBadges(); });
window.addEventListener('hashchange', async () => { await updateSidebarBadges(); });

// ── Auth Guard & Sidebar Permissions ─────────────────────────
(async () => {
  const user = localStorage.getItem('authUser');
  const role = localStorage.getItem('authRole');
  const allowedRoutes = {
    admin: ['dashboard','import','listing','stc','stc-new','stc-detail','rtc','rtc-new','rtc-detail','pending','settings'],
    stc:   ['stc','stc-new','stc-detail','settings'],
    rtc:   ['rtc','rtc-new','rtc-detail','settings']
  };
  const allowedNav = {
    admin: ['#dashboard','#import','#listing','#stc','#rtc','#pending','#settings'],
    stc:   ['#stc','#settings'],
    rtc:   ['#rtc','#settings']
  };

  if (!user) {
    window.location = 'login.html';
    return;
  }

  document.querySelectorAll('.sidebar nav a').forEach(a => {
    if (!allowedNav[role].includes(a.getAttribute('href'))) a.remove();
  });

  await updateSidebarAlerts();

  function checkPerms() {
    const route = (location.hash.slice(1) || 'dashboard').split('?')[0];
    if (!allowedRoutes[role].includes(route)) {
      alert('Você não tem permissão para acessar esta página.');
      const home = role === 'stc' ? 'stc' : role === 'rtc' ? 'rtc' : 'dashboard';
      window.location.hash = `#${home}`;
    }
  }

  window.addEventListener('load', checkPerms);
  window.addEventListener('hashchange', checkPerms);

  const btnLogout   = document.getElementById('btn-logout');
  const roleDisplay = document.getElementById('roleDisplay');
  let label = '';
  if (role === 'admin') label = 'Administrador';
  else if (role === 'stc') label = 'DepSIMRj';
  else if (role === 'rtc') label = 'CDAM';
  roleDisplay.textContent = label;

  btnLogout.onclick = () => {
    localStorage.removeItem('authUser');
    localStorage.removeItem('authRole');
    window.location = 'login.html';
  };
})();

// ── Sidebar Toggle ───────────────────────────────────────────
document
  .getElementById('toggle-sidebar')
  .addEventListener('click', () =>
    document.body.classList.toggle('sidebar-collapsed')
  );

// ── Router & Active Link ─────────────────────────────────────
// Ao carregar a página ou mudar o hash, invoca router() aguardando sua finalização
window.addEventListener('load', async () => { await router(); });
window.addEventListener('hashchange', async () => { await router(); });

async function router() {
  const hash   = location.hash.slice(1) || 'dashboard';
  const [r]    = hash.split('?');
  const params = parseQuery();
  const app    = document.getElementById('app');

  // limpa o container antes de renderizar
  app.innerHTML = '';

  // mapeia rotas para funções async
  const routes = {
    dashboard, import: importView,
    stc: stcView, 'stc-new': newStcView, 'stc-detail': stcDetailView,
    rtc: rtcView, 'rtc-new': newRtcView, 'rtc-detail': rtcDetailView,
    pending, settings
  };

  // seleciona a função ou exibe erro de view não encontrada
  const viewFn = routes[r] || (async () => {
    app.innerHTML = '<p>View não encontrada.</p>';
  });

  // aguarda a execução da view (que pode ser async)
  await viewFn(params);

  // marca o link ativo no sidebar
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    a.classList.toggle(
      'active',
      a.getAttribute('href') === window.location.hash
    );
  });
}

// ── Dashboard ────────────────────────────────────────────────
async function dashboard() {
  // 1) Buscar dados do Firestore
  const allStcs = await getData('stcs');
  const allRtcs = await getData('rtcs');

  // 2) Filtrar STCs pendentes e RTCs não concluídos
  const stcs    = allStcs.filter(s => s.status === 'PendingRTC');
  const rtcsAll = allRtcs.filter(r => r.status !== 'Completed');
  const today   = new Date();
  const daysAgo = iso => Math.floor((today - new Date(iso)) / (1000 * 60 * 60 * 24));

  // 3) Helper para montar o card
  const makeCard = (id, qty, dateIso, overdueDays, overdueLabel, category, isRtc) => {
    const alertHtml = overdueDays > 0
      ? `<i class="alert-icon bi bi-bookmark-fill">
           <span class="tooltip">${overdueDays} dia(s) ${overdueLabel}</span>
         </i>`
      : '';
    const target = isRtc
      ? `#rtc-detail?rtcId=${id}`
      : `#stc-detail?stcId=${id}`;
    return `
      <div class="kanban-item ${category} d-flex flex-column gap-2"
           onclick="window.location.hash='${target}'">
        ${alertHtml}
        <div class="content">
          <div class="title">${id} (${qty} KG)</div>
          <div class="meta">${new Date(dateIso).toLocaleDateString()}</div>
        </div>
      </div>`;
  };

  // 4) Montar container
  const app = document.getElementById('app');
  app.innerHTML = `<div class="kanban-container" id="dashKanban"></div>`;
  const kanban = document.getElementById('dashKanban');

  // 5) Para cada centro, renderizar coluna
  for (const center of CENTERS) {
    // Filtrar STCs/RTCs deste centro
    const myStcs = stcs.filter(s => s.centerCode === center.code);
    const myRtcs = rtcsAll.filter(r => {
      const stc = allStcs.find(x => x.stcId === r.stcId);
      return stc?.centerCode === center.code;
    });

    // Categorias
    const secosStc = myStcs.filter(s => s.items.some(i => i.category === 'Secos'));
    const frigStc  = myStcs.filter(s => s.items.some(i => i.category === 'Frigorificados'));
    const secosRtc = myRtcs.filter(r => {
      const stc = allStcs.find(x => x.stcId === r.stcId);
      return stc.items.some(i => i.category === 'Secos');
    });
    const frigRtc  = myRtcs.filter(r => {
      const stc = allStcs.find(x => x.stcId === r.stcId);
      return stc.items.some(i => i.category === 'Frigorificados');
    });

    // Construir HTML interno
    let inner = `
      <div class="dashboard-section">
        <h3>STC</h3>
        <div class="category">
          <h4>Secos</h4>
          ${secosStc.map(s => {
            const sumQty = s.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
            const overdue = daysAgo(s.createdAt) - 3;
            return makeCard(s.stcId, sumQty, s.createdAt, overdue, 'pendente de RTC', 'category-secos', false);
          }).join('')}
          <h4>Frigorificados</h4>
          ${frigStc.map(s => {
            const sumQty = s.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
            const overdue = daysAgo(s.createdAt) - 3;
            return makeCard(s.stcId, sumQty, s.createdAt, overdue, 'pendente de RTC', 'category-frig', false);
          }).join('')}
        </div>
      </div>

      <div class="dashboard-section">
        <h3>RTC</h3>
        <div class="category">
          <h4>Secos</h4>
          ${secosRtc.map(r => {
            const stc      = allStcs.find(x=>x.stcId===r.stcId);
            const sumQty   = stc.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
            const entry    = r.history[0]?.time;
            const overdue  = r.status==='Aguardando coleta'
              ? daysAgo(entry) - 2
              : 0;
            return makeCard(r.rtcId, sumQty, entry, overdue, 'aguardando coleta', 'category-secos', true);
          }).join('')}
          <h4>Frigorificados</h4>
          ${frigRtc.map(r => {
            const stc     = allStcs.find(x=>x.stcId===r.stcId);
            const sumQty  = stc.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
            const entry   = (r.history.find(h=>h.status==='Aguardando entrega')||{}).time
                         || r.history[0]?.time;
            return makeCard(r.rtcId, sumQty, entry, 0, '', 'category-frig', true);
          }).join('')}
        </div>
      </div>`;

    // Criar coluna e anexar
    const col = document.createElement('div');
    col.className = 'kanban-column';
    col.innerHTML = `
      <div class="kanban-column-header">
        ${center.code} – ${center.name}
      </div>
      ${inner}`;
    kanban.appendChild(col);
  }
}

// ── Importar RMT (Excel) ─────────────────────────────────────
async function importView() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <h2>Importar RMT (Excel .xlsx/.xls)</h2>
    <input type="file" id="fileInp" accept=".xlsx,.xls" />
    <div id="feedback" class="alert" style="display:none;"></div>
  `;

  document.getElementById('fileInp').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;

    const fb = document.getElementById('feedback');
    fb.style.display = 'none';

    try {
      // 1) Ler arquivo com cellDates para captar datas como Date objects
      const data = new Uint8Array(await file.arrayBuffer());
      const wb   = XLSX.read(data, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // 2) Buscar existentes e identificar duplicados
      const existing = await getData('rmtItems');
      const dupes = new Set();

      const mapped = rows.map(row => {
        const idRm = String(row['Id. RM'] || row['Id RM'] || '').trim();
        if (!idRm || existing.some(x => x.idRm === idRm)) {
          dupes.add(idRm || '[sem Id]');
        }

        // Normalizar a data em ISO:
        let dateISO = '';
        const rawDate = row['Data'];
        if (rawDate instanceof Date) {
          dateISO = rawDate.toISOString();
        } else if (typeof rawDate === 'string') {
          const parts = rawDate.split('/');
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const y = parseInt(parts[2], 10);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              dateISO = new Date(y, m - 1, d).toISOString();
            }
          }
        }

        return {
          supplierCam:   row['CAM Fornec.']    || '',
          date:          dateISO,
          piNumber:      row['PI']             || '',
          itemName:      row['Nome do Item']   || '',
          idRm,
          typeRm:        row['Tipo de RM']     || '',
          uf:            row['UF']             || '',
          statusRm:      row['Sit. da RM']     || '',
          quantityUf:    parseFloat(row['Qtde. (UF)'] || 0),
          unitPrice:     parseFloat(row['Preço Unitário'] || 0),
          totalValue:    parseFloat(row['Total'] || 0),
          requesterName: row['NOME_SOLICITANTE']|| '',
          requesterCode: row['Solicitante']    || '',
          importedBy:    localStorage.getItem('authUser'),
          importedAt:    new Date().toISOString(),
          status:        'Imported',
          linkedStc:     null
        };
      });

      // 3) Mostrar feedback
      fb.style.display = 'block';
      if (dupes.size) {
        fb.textContent = `IDs duplicados ou faltando: ${[...dupes].join(', ')}`;
      } else {
        // 4) Gravar no Firestore (substitui tudo)
        await setData('rmtItems', existing.concat(mapped), 'idRm');
        fb.classList.remove('alert-danger');
        fb.classList.add('alert-success');
        fb.textContent = `${mapped.length} itens importados com sucesso!`;
      }

    } catch (err) {
      console.error(err);
      fb.style.display = 'block';
      fb.classList.remove('alert-success');
      fb.classList.add('alert-danger');
      fb.textContent = 'Erro ao processar o arquivo Excel.';
    }
  };
}
// ── STC Management (async) ───────────────────────────────────
async function stcView() {
  const app = document.getElementById('app');
  let showArchived = false;
  const today = new Date();
  const daysAgo = iso => Math.floor((today - new Date(iso)) / (1000 * 60 * 60 * 24));

  // 1) Setup inicial da tela
  app.innerHTML = `
    <div class="flex justify-between align-center mb-4">
      <h2 style="font-weight:700;">STC Kanban</h2>
      <div class="flex gap-2">
        <button id="toggleArchived" class="btn btn-outline-primary">
          <i class="bi bi-archive-fill"></i> STC Arquivadas
        </button>
        <button id="newStc" class="btn btn-primary">
          <i class="bi bi-plus-lg"></i> Nova STC
        </button>
      </div>
    </div>
    <div class="kanban-container" id="stcKanban"></div>
  `;

  document.getElementById('newStc').onclick = () => {
    window.location.hash = '#stc-new';
  };
  document.getElementById('toggleArchived').onclick = () => {
    showArchived = !showArchived;
    render();
  };

  // 2) Função interna de renderização
  async function render() {
    // Atualiza o texto do botão
    const tog = document.getElementById('toggleArchived');
    if (showArchived) {
      tog.innerHTML = `<i class="bi bi-arrow-counterclockwise"></i> Ver Pendentes`;
      tog.classList.replace('btn-outline-primary', 'btn-outline-secondary');
    } else {
      tog.innerHTML = `<i class="bi bi-archive-fill"></i> STC Arquivadas`;
      tog.classList.replace('btn-outline-secondary', 'btn-outline-primary');
    }

    // 3) Buscar todas as STCs
    const allStcs = await getData('stcs');
    // Filtrar de acordo com o estado
    const list = allStcs.filter(s =>
      showArchived
        ? s.status === 'RTCGenerated'
        : s.status === 'PendingRTC'
    );

    const kanban = document.getElementById('stcKanban');
    kanban.innerHTML = '';

    // 4) Para cada centro, criar coluna
    for (const center of CENTERS) {
      const col = document.createElement('div');
      col.className = 'kanban-column';

      const myStcs = list.filter(s => s.centerCode === center.code);

      let inner;
      if (myStcs.length === 0) {
        inner = `<p class="text-secondary p-2">
                   ${showArchived ? 'Nenhum gerado' : 'Nenhum STC'}
                 </p>`;
      } else {
        inner = myStcs.map(s => {
          const sumQty  = s.items.reduce((a,i) => a + i.quantity, 0).toFixed(2);
          const created = s.createdAt;
          const overdue = showArchived
            ? 0
            : daysAgo(created) - 3;
          const alertIcon = overdue > 0
            ? `<i class="alert-icon bi bi-bookmark-fill"
                 title="${overdue} dia(s) pendente de RTC"></i>`
            : '';
          const statusLabel = showArchived
            ? `<span class="badge bg-success">Gerado</span>`
            : `<span class="badge bg-warning text-dark">RTC Pendente</span>`;
          const actions = showArchived
            ? `<button class="btn btn-outline-info btn-sm view-stc" data-id="${s.stcId}">
                 <i class="bi bi-eye-fill"></i> Ver
               </button>`
            : `<div class="btn-group btn-group-sm">
                 <button class="btn btn-outline-info view-stc" data-id="${s.stcId}">
                   <i class="bi bi-eye-fill"></i>
                 </button>
                 <button class="btn btn-outline-secondary edit-stc" data-id="${s.stcId}">
                   <i class="bi bi-pencil-fill"></i>
                 </button>
                 <button class="btn btn-outline-danger delete-stc" data-id="${s.stcId}">
                   <i class="bi bi-trash-fill"></i>
                 </button>
               </div>`;

          return `
            <div class="kanban-item d-flex flex-column gap-2">
              ${alertIcon}
              <div class="d-flex justify-content-between align-items-start w-100">
                <div>
                  <div class="title">${s.stcId} (${sumQty} KG)</div>
                  <div class="meta">${new Date(created).toLocaleDateString()}</div>
                </div>
                ${actions}
              </div>
              ${statusLabel}
            </div>`;
        }).join('');
      }

      col.innerHTML = `
        <div class="kanban-column-header">
          ${center.code} – ${center.name}
        </div>
        <div class="kanban-column-list">${inner}</div>
      `;
      kanban.appendChild(col);

      // 5) Delegar eventos
      col.querySelectorAll('.view-stc').forEach(b =>
        b.onclick = () => window.location.hash = `#stc-detail?stcId=${b.dataset.id}`
      );
      if (!showArchived) {
        col.querySelectorAll('.edit-stc').forEach(b =>
          b.onclick = () => window.location.hash = `#stc-new?stcId=${b.dataset.id}`
        );
        col.querySelectorAll('.delete-stc').forEach(b =>
          b.onclick = async () => {
            if (!confirm(`Excluir STC ${b.dataset.id}?`)) return;
            // Atualiza Firestore removendo esta STC
            const updated = (await getData('stcs'))
              .filter(x => x.stcId !== b.dataset.id);
            await setData('stcs', updated, 'stcId');
            render();
          }
        );
      }
    }
  }

  // 6) Disparar render inicial
  await render();
}


// ── New / Edit STC Form (async) ─────────────────────────────────
async function newStcView(params) {
  // 1) Buscar dados necessários
  const rmtAll   = await getData('rmtItems');
  const editing  = Boolean(params.stcId);
  const allStcs  = await getData('stcs');
  const existing = editing
    ? (allStcs.find(s => s.stcId === params.stcId) || {}).items || []
    : [];

  // 2) Construir opções de centro
  const centerOpts = CENTERS.map(c =>
    `<option value="${c.code}">${c.code} – ${c.name}</option>`
  ).join('');

  // 3) Montar HTML inicial
  document.getElementById('app').innerHTML = `
    <h2>${editing ? 'Editar' : 'Nova'} STC</h2>

    <label id="lblCode" style="display:block; margin-bottom:1rem;">
      Código STC:<br/>
      <input type="text" id="code" placeholder="STC-001" value="${params.stcId||''}" />
    </label>

    <label id="lblCenter" style="display:block; margin-bottom:1.5rem;">
      Centro de Destino:<br/>
      <select id="stcCenter">
        <option value="">Selecione um centro</option>
        ${centerOpts}
      </select>
    </label>

    <div class="table-container" style="transition: border 0.3s;">
      <table class="table">
        <thead><tr>
          <th></th><th>Id. RM</th><th>Item</th><th>Qtde.</th><th>Categoria</th>
        </tr></thead>
        <tbody id="stcBody"></tbody>
      </table>
    </div>

    <div class="mb-4">
      <strong>Total Qtde:</strong> <span id="sumQty">0</span>
    </div>

    <button id="saveStc" class="btn" disabled>
      <i class="bi bi-save"></i> Salvar STC
    </button>
  `;

  // 4) Referências aos elementos
  const tbody          = document.getElementById('stcBody');
  const codeInput      = document.getElementById('code');
  const lblCode        = document.getElementById('lblCode');
  const centerSel      = document.getElementById('stcCenter');
  const lblCenter      = document.getElementById('lblCenter');
  const saveBtn        = document.getElementById('saveStc');
  const sumSpan        = document.getElementById('sumQty');
  const tableContainer = document.querySelector('.table-container');

  // 5) Helpers de UI
  function clearHighlights() {
    codeInput.style.border = '';
    lblCode.style.color    = '';
    centerSel.style.border = '';
    lblCenter.style.color  = '';
    tableContainer.style.border = '';
    tbody.querySelectorAll('.qty, .cat-select').forEach(el => el.style.border = '');
  }

  function validateAndHighlight() {
    let valid = true;
    clearHighlights();

    if (!codeInput.value.trim()) {
      codeInput.style.border = '2px solid red';
      lblCode.style.color    = 'red';
      valid = false;
    }
    if (!centerSel.value) {
      centerSel.style.border = '2px solid red';
      lblCenter.style.color  = 'red';
      valid = false;
    }

    const checked = Array.from(tbody.querySelectorAll('input.item-cb:checked'));
    if (!checked.length) {
      tableContainer.style.border = '2px solid red';
      valid = false;
    } else {
      checked.forEach(cb => {
        const id    = cb.dataset.id;
        const qtyEl = tbody.querySelector(`.qty[data-id="${id}"]`);
        const catEl = tbody.querySelector(`.cat-select[data-id="${id}"]`);
        const qty   = parseFloat(qtyEl.value) || 0;
        if (qty <= 0) {
          qtyEl.style.border = '2px solid red';
          valid = false;
        }
        if (!catEl.value) {
          catEl.style.border = '2px solid red';
          valid = false;
        }
      });
    }
    return valid;
  }

  function updateUI() {
    const hasCode   = !!codeInput.value.trim();
    const hasCenter = !!centerSel.value;
    const anyChecked = !!tbody.querySelector('input.item-cb:checked');
    saveBtn.disabled = !(hasCode && hasCenter && anyChecked);

    const total = Array.from(tbody.querySelectorAll('input.item-cb:checked'))
      .reduce((sum, cb) => {
        const id = cb.dataset.id;
        const val = parseFloat(tbody.querySelector(`.qty[data-id="${id}"]`).value) || 0;
        return sum + val;
      }, 0);
    sumSpan.textContent = total.toFixed(2);
  }

  function attachRowListeners() {
    tbody.querySelectorAll('input.item-cb').forEach(cb => cb.onchange = updateUI);
    tbody.querySelectorAll('input.qty').forEach(q => q.oninput = updateUI);
    tbody.querySelectorAll('select.cat-select').forEach(s => s.onchange = updateUI);
  }

  // 6) Popula a tabela ao escolher um centro
  function populateTable() {
    const code   = centerSel.value;
    const center = CENTERS.find(c => c.code === code);
    if (!center) {
      tbody.innerHTML = '';
      updateUI();
      return;
    }

    const filtered = rmtAll.filter(i =>
      i.requesterName.includes(center.name) &&
      (!i.linkedStc || i.linkedStc === params.stcId)
    );

    tbody.innerHTML = filtered.map(i => {
      const it      = existing.find(x => x.idRm === i.idRm) || {};
      const checked = it.idRm ? 'checked' : '';
      const qty     = it.quantity ?? i.quantityUf;
      const cat     = it.category  || '';
      return `
        <tr>
          <td><input type="checkbox" class="item-cb" data-id="${i.idRm}" ${checked} /></td>
          <td>${i.idRm}</td>
          <td>${i.itemName}</td>
          <td><input type="number" class="qty" step="any" value="${qty}" data-id="${i.idRm}" /></td>
          <td>
            <select class="cat-select" data-id="${i.idRm}">
              <option value="">--</option>
              <option value="Secos"        ${cat==='Secos' ? 'selected' : ''}>Secos</option>
              <option value="Frigorificados" ${cat==='Frigorificados' ? 'selected' : ''}>
                Frigorificados
              </option>
            </select>
          </td>
        </tr>`;
    }).join('');

    attachRowListeners();
    updateUI();
  }

  centerSel.onchange = populateTable;
  if (editing) {
    const stc = allStcs.find(s => s.stcId === params.stcId);
    if (stc) centerSel.value = stc.centerCode;
  }
  populateTable();

  // 7) Ao salvar, valida, grava no Firestore e atualiza RMT items
  saveBtn.onclick = async () => {
    if (!validateAndHighlight()) return;

    const codeVal   = codeInput.value.trim();
    const centerVal = centerSel.value;

    // get each checked row and read its inputs
    const selRows = Array.from(
      tbody.querySelectorAll('input.item-cb:checked')
    ).map(cb => cb.closest('tr'));

    const items = selRows.map(row => {
      const idRmEl   = row.querySelector('input.item-cb');
      const qtyEl    = row.querySelector('input.qty');
      const catEl    = row.querySelector('select.cat-select');

      return {
        idRm:     idRmEl.dataset.id,
        quantity: parseFloat(qtyEl.value)    || 0,
        category: (catEl.value || '').trim()
      };
    });

    // rebuild STC list
    let allStcs = await getData('stcs');
    if (editing) {
      allStcs = allStcs.map(s =>
        s.stcId === params.stcId
          ? { ...s, stcId: codeVal, centerCode: centerVal, items }
          : s
      );
    } else {
      allStcs.push({
        stcId:      codeVal,
        centerCode: centerVal,
        items,
        status:     'PendingRTC',
        createdAt:  new Date().toISOString()
      });
    }
    await setData('stcs', allStcs, 'stcId');

    // update RMT links
    const rmtAll = await getData('rmtItems');
    const selIds = items.map(i => i.idRm);
    const updatedRmt = rmtAll.map(r => {
      if (selIds.includes(r.idRm))           return { ...r, linkedStc: codeVal };
      if (editing && r.linkedStc === params.stcId) return { ...r, linkedStc: null };
      return r;
    });
    await setData('rmtItems', updatedRmt, 'idRm');

    alert(`STC ${codeVal} salva.`);
    window.location.hash = '#stc';
  };
}
// ── STC Detail View (async) ─────────────────────────────────────────
async function stcDetailView(params) {
  // 1) Carrega dados do Firestore
  const allStcs = await getData('stcs');
  const allRmt  = await getData('rmtItems');
  const allRtcs = await getData('rtcs');

  // 2) Encontra a STC e o RTC relacionado
  const stc = allStcs.find(s => s.stcId === params.stcId);
  if (!stc) {
    document.getElementById('app').innerHTML = '<p>STC não encontrada.</p>';
    return;
  }
  const rtc = allRtcs.find(r => r.stcId === stc.stcId);
  const rtcDate = rtc
    ? new Date(rtc.history[0].time).toLocaleString()
    : '';

  // 3) Monta o header com botão Voltar e informações
  const centerName = (CENTERS.find(c => c.code === stc.centerCode) || {}).name || '';
  document.getElementById('app').innerHTML = `
    <div class="mb-4">
      <button class="btn btn-outline-secondary" onclick="window.history.back()">
        <i class="bi bi-arrow-left"></i> Voltar
      </button>
    </div>

    <div class="bg-light p-3 rounded mb-4">
      <div class="d-flex flex-wrap gap-4 align-items-center">
        <div>
          <i class="bi bi-ticket-perforated-fill text-primary"></i>
          <strong>STC:</strong>
          <span class="badge bg-primary">${stc.stcId}</span>
        </div>
        <div>
          <i class="bi bi-geo-alt-fill text-secondary"></i>
          <strong>Destino:</strong>
          ${stc.centerCode} – ${centerName}
        </div>
        ${rtc ? `
        <div>
          <i class="bi bi-truck-flatbed-fill text-success"></i>
          <strong>RTC:</strong>
          <span class="badge bg-success">${rtc.rtcId}</span>
        </div>
        <div>
          <i class="bi bi-calendar-event-fill text-muted"></i>
          <strong>Gerado em:</strong>
          ${rtcDate}
        </div>
        ` : ''}
      </div>
    </div>

    <div class="card shadow-sm">
      <div class="card-header bg-primary text-white">
        <i class="bi bi-list-check"></i> Itens da STC
      </div>
      <div class="table-responsive">
        <table class="table table-striped table-bordered mb-0">
          <thead class="table-light">
            <tr>
              <th>Id. RM</th>
              <th>Item</th>
              <th>Categoria</th>
              <th class="text-end">Qtde.</th>
            </tr>
          </thead>
          <tbody id="stcDetailBody"></tbody>
          <tfoot class="table-primary text-white">
            <tr>
              <th colspan="3" class="text-end">Total Qtde</th>
              <th id="totalStcQty" class="text-end"></th>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  // 4) Preenche linhas da tabela
  const body = document.getElementById('stcDetailBody');
  let totalQty = 0;
  stc.items.forEach(it => {
    const r = allRmt.find(x => x.idRm === it.idRm) || {};
    const qty = it.quantity || 0;
    totalQty += qty;
    body.innerHTML += `
      <tr>
        <td>${it.idRm}</td>
        <td>${r.itemName || ''}</td>
        <td>${it.category || ''}</td>
        <td class="text-end">${qty}</td>
      </tr>`;
  });

  // 5) Exibe total
  document.getElementById('totalStcQty').textContent = totalQty.toFixed(2);
}
// ── RTC View (async) ─────────────────────────────────────────
async function rtcView() {
  let showCompleted = false;
  const today = new Date();
  const daysAgo = iso => Math.floor((today - new Date(iso)) / (1000 * 60 * 60 * 24));

  const THRESHOLDS = {
    PendingRTC: 3,
    'Aguardando coleta': 2,
    'Aguardando entrega': 1
  };

  // 1) Monta o shell inicial
  document.getElementById('app').innerHTML = `
    <div class="flex justify-between align-center mb-4">
      <h2 style="font-weight:700;">RTC Kanban</h2>
      <button id="completedToggle" class="btn btn-outline-primary">
        <i class="bi bi-check2-circle"></i> Ver Concluídos
      </button>
    </div>
    <div class="kanban-container" id="rtcKanban"></div>
  `;

  document.getElementById('completedToggle').onclick = () => {
    showCompleted = !showCompleted;
    render();
  };

  // 2) Função de renderização
  async function render() {
    // Atualiza o texto do botão
    const toggle = document.getElementById('completedToggle');
    toggle.innerHTML = showCompleted
      ? `<i class="bi bi-arrow-counterclockwise"></i> Ver Pendentes`
      : `<i class="bi bi-check2-circle"></i> Ver Concluídos`;

    // Busca dados no Firestore
    const allStcs = await getData('stcs');
    const allRtcs = await getData('rtcs');

    // Filtra STCs pendentes
    const stcsPend = allStcs.filter(s => s.status === 'PendingRTC');
    // RTCs
    const rtcsAll = allRtcs;

    const kanban = document.getElementById('rtcKanban');
    kanban.innerHTML = '';

    for (const center of CENTERS) {
      const col = document.createElement('div');
      col.className = 'kanban-column';

      // Pendente (STCs)
      const pend = showCompleted
        ? []
        : stcsPend.filter(s => s.centerCode === center.code);

      // Aguardando coleta
      const collecting = !showCompleted
        ? rtcsAll.filter(r => {
            const stc = allStcs.find(x => x.stcId === r.stcId);
            return r.status === 'Aguardando coleta' && stc?.centerCode === center.code;
          })
        : [];

      // Aguardando entrega
      const delivering = !showCompleted
        ? rtcsAll.filter(r => {
            const stc = allStcs.find(x => x.stcId === r.stcId);
            return r.status === 'Aguardando entrega' && stc?.centerCode === center.code;
          })
        : [];

      // Concluídos
      const completed = showCompleted
        ? rtcsAll.filter(r => {
            const stc = allStcs.find(x => x.stcId === r.stcId);
            return r.status === 'Completed' && stc?.centerCode === center.code;
          })
        : [];

      let inner = '';

      // Se não estiver vendo concluídos, monta 3 seções
      if (!showCompleted) {
        // Pendente
        inner += `
          <div class="dashboard-section">
            <h3><i class="bi bi-hourglass-split"></i> Pendente</h3>
            ${pend.length
              ? pend.map(s => {
                  const qty      = s.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
                  const created  = s.createdAt;
                  const overDays = daysAgo(created) - THRESHOLDS.PendingRTC;
                  const alertHtml = overDays > 0
                    ? `<i class="alert-icon bi bi-bookmark-fill">
                         <span class="tooltip">${overDays} dia(s) pendente de RTC</span>
                       </i>`
                    : '';
                  return `
                    <div class="kanban-item d-flex flex-column gap-2">
                      ${alertHtml}
                      <div class="content">
                        <div class="title">${s.stcId} (${qty} KG)</div>
                        <div class="meta">${new Date(created).toLocaleDateString()}</div>
                      </div>
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-success emit-rtc" data-stc="${s.stcId}">
                          <i class="bi bi-truck"></i> Emitir RTC
                        </button>
                        <button class="btn btn-outline-danger delete-stc" data-stc="${s.stcId}">
                          <i class="bi bi-trash-fill"></i> Excluir
                        </button>
                        <button class="btn btn-outline-info btn-sm view-rtc" data-id="${s.stcId}">
                          <i class="bi bi-eye-fill"></i> Ver
                        </button>
                      </div>
                    </div>`;
                }).join('')
              : `<p class="text-secondary p-2">Nenhum STC</p>`}
          </div>`;

        // Aguardando coleta
        inner += `
          <div class="dashboard-section">
            <h3><i class="bi bi-clock-history"></i> Aguardando coleta</h3>
            ${collecting.length
              ? collecting.map(r => {
                  const stc      = allStcs.find(x=>x.stcId===r.stcId);
                  const qty      = stc.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
                  const entry    = r.history.find(h=>h.status==='Aguardando coleta').time;
                  const overDays = daysAgo(entry) - THRESHOLDS['Aguardando coleta'];
                  const alertHtml = overDays > 0
                    ? `<i class="alert-icon bi bi-bookmark-fill">
                         <span class="tooltip">${overDays} dia(s) aguardando coleta</span>
                       </i>`
                    : '';
                  return `
                    <div class="kanban-item d-flex flex-column gap-2">
                      ${alertHtml}
                      <div class="content">
                        <div class="title">${r.rtcId} (${qty} KG)</div>
                        <div class="meta">${new Date(entry).toLocaleDateString()}</div>
                      </div>
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-warning complete-collect" data-id="${r.rtcId}">
                          <i class="bi bi-check2-square"></i> Coleta realizada
                        </button>
                        <button class="btn btn-outline-info btn-sm view-rtc" data-id="${r.rtcId}">
                          <i class="bi bi-eye-fill"></i> Ver
                        </button>
                      </div>
                    </div>`;
                }).join('')
              : `<p class="text-secondary p-2">Nenhuma aguardando coleta</p>`}
          </div>`;

        // Aguardando entrega
        inner += `
          <div class="dashboard-section">
            <h3><i class="bi bi-truck"></i> Aguardando entrega</h3>
            ${delivering.length
              ? delivering.map(r => {
                  const stc      = allStcs.find(x=>x.stcId===r.stcId);
                  const qty      = stc.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
                  const entry    = r.history.find(h=>h.status==='Aguardando entrega').time;
                  const overDays = daysAgo(entry) - THRESHOLDS['Aguardando entrega'];
                  const alertHtml = overDays > 0
                    ? `<i class="alert-icon bi bi-bookmark-fill">
                         <span class="tooltip">${overDays} dia(s) aguardando entrega</span>
                       </i>`
                    : '';
                  return `
                    <div class="kanban-item d-flex flex-column gap-2">
                      ${alertHtml}
                      <div class="content">
                        <div class="title">${r.rtcId} (${qty} KG)</div>
                        <div class="meta"><strong>Data coleta:</strong> ${new Date(entry).toLocaleDateString()}</div>
                      </div>
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-success finalize-rtc" data-id="${r.rtcId}">
                          <i class="bi bi-check2"></i> Finalizar entrega
                        </button>
                        <button class="btn btn-outline-info btn-sm view-rtc" data-id="${r.rtcId}">
                          <i class="bi bi-eye-fill"></i> Ver
                        </button>
                      </div>
                    </div>`;
                }).join('')
              : `<p class="text-secondary p-2">Nenhuma aguardando entrega</p>`}
          </div>`;
      } else {
        // Se mostrar concluídos
        inner += `
          <div class="dashboard-section">
            <h3><i class="bi bi-check2-circle"></i> Concluídos</h3>
            ${completed.length
              ? completed.map(r => {
                  const stc  = allStcs.find(x=>x.stcId===r.stcId);
                  const qty  = stc.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
                  const hist = r.history.find(h=>h.status==='Completed').time;
                  return `
                    <div class="kanban-item d-flex flex-column gap-2">
                      <div class="content">
                        <div class="title">${r.rtcId} (${qty} KG)</div>
                        <div class="meta"><strong>Data entrega:</strong> ${new Date(hist).toLocaleDateString()}</div>
                      </div>
                      <button class="btn btn-outline-info btn-sm view-rtc" data-id="${r.rtcId}">
                        <i class="bi bi-eye-fill"></i> Ver
                      </button>
                    </div>`;
                }).join('')
              : `<p class="text-secondary p-2">Nenhum concluído</p>`}
          </div>`;
      }

      col.innerHTML = `
        <div class="kanban-column-header">
          ${center.code} – ${center.name}
        </div>
        ${inner}
      `;
      kanban.appendChild(col);

      // 3) Delegação de eventos (emitir, excluir, coletar, finalizar, ver)
      col.querySelectorAll('.emit-rtc').forEach(b =>
        b.onclick = () => window.location.hash = `#rtc-new?stcId=${b.dataset.stc}`
      );
      col.querySelectorAll('.delete-stc').forEach(b =>
        b.onclick = async () => {
          if (!confirm(`Excluir STC ${b.dataset.stc}?`)) return;
          // remove STC
          const updatedStcs = (await getData('stcs'))
            .filter(x=>x.stcId!==b.dataset.stc);
          await setData('stcs', updatedStcs, 'stcId');
          render();
        }
      );
      col.querySelectorAll('.complete-collect').forEach(b =>
        b.onclick = async () => {
          if (!confirm('Confirmar coleta realizada?')) return;
          const id = b.dataset.id;
          const updated = (await getData('rtcs')).map(r =>
            r.rtcId===id
              ? { ...r,
                  status: 'Aguardando entrega',
                  history: [...r.history, { status:'Aguardando entrega', time: new Date().toISOString() }]
                }
              : r
          );
          await setData('rtcs', updated, 'rtcId');
          render();
        }
      );
      col.querySelectorAll('.finalize-rtc').forEach(b =>
        b.onclick = async () => {
          if (!confirm('Confirmar entrega concluída?')) return;
          const id = b.dataset.id;
          const updated = (await getData('rtcs')).map(r =>
            r.rtcId===id
              ? { ...r,
                  status: 'Completed',
                  history: [...r.history, { status:'Completed', time: new Date().toISOString() }]
                }
              : r
          );
          await setData('rtcs', updated, 'rtcId');
          render();
        }
      );
      col.querySelectorAll('.view-rtc').forEach(b =>
        b.onclick = () => window.location.hash = `#rtc-detail?rtcId=${b.dataset.id}`
      );
    }
  }

  // 4) Renderização inicial
  await render();
}

// ── New / Edit RTC (async, correção) ───────────────────────────────────────────
async function newRtcView(params) {
  const editing = Boolean(params.rtcId);
  const allRtcs = await getData('rtcs');
  const allStcs = await getData('stcs');
  const allRmt  = await getData('rmtItems');  // pré-carrega aqui

  // Determinar a STC de origem
  const stcId = params.stcId
    || (allRtcs.find(r => r.rtcId === params.rtcId) || {}).stcId;
  const stc = allStcs.find(s => s.stcId === stcId);
  if (!stc) {
    document.getElementById('app').innerHTML = '<p>STC não encontrada.</p>';
    return;
  }

  // Construir linhas da tabela usando allRmt, sem await dentro do map
  const rowsHtml = stc.items.map(it => {
    const r = allRmt.find(x => x.idRm === it.idRm) || {};
    return `
      <tr>
        <td>${it.idRm}</td>
        <td>${r.itemName || ''}</td>
        <td>${r.requesterName || ''}</td>
        <td>${r.uf || ''}</td>
        <td>${it.quantity}</td>
      </tr>`;
  }).join('');

  // Montar o HTML completo
  document.getElementById('app').innerHTML = `
    <h2>${editing ? 'Editar' : 'Nova'} RTC</h2>

    <label style="display:block; margin-bottom:1rem;">
      Código RTC:<br/>
      <input type="text" id="rtcCode" value="${params.rtcId||''}" />
    </label>

    <p><strong>STC:</strong> ${stcId} — ${stc.centerCode}</p>

    <div class="table-container mb-4">
      <table class="table">
        <thead>
          <tr>
            <th>Id. RM</th>
            <th>Nome do Item</th>
            <th>Centro</th>
            <th>UF</th>
            <th>Qtd. (UF)</th>
          </tr>
        </thead>
        <tbody id="rtcBody">
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <button id="saveRtc" class="btn btn-primary">
      <i class="bi bi-save"></i> Salvar RTC
    </button>
  `;

  // Handler do botão Salvar
  document.getElementById('saveRtc').onclick = async () => {
    const code = document.getElementById('rtcCode').value.trim();
    if (!code) {
      alert('Por favor, informe o código da RTC.');
      return;
    }

    let updatedRtcs;
    if (editing) {
      // Apenas renomear
      updatedRtcs = allRtcs.map(r =>
        r.rtcId === params.rtcId
          ? { ...r, rtcId: code }
          : r
      );
    } else {
      // Criar nova RTC em “Aguardando coleta”
      updatedRtcs = [
        ...allRtcs,
        {
          rtcId: code,
          stcId,
          status: 'Aguardando coleta',
          history: [
            { status: 'Aguardando coleta', time: new Date().toISOString() }
          ]
        }
      ];
    }
    await setData('rtcs', updatedRtcs, 'rtcId');

    // Marcar STC como gerada na primeira vez
    if (!editing) {
      const updatedStcs = allStcs.map(s =>
        s.stcId === stcId
          ? { ...s, status: 'RTCGenerated' }
          : s
      );
      await setData('stcs', updatedStcs, 'stcId');
    }

    alert(`RTC ${code} salva.`);
    window.location.hash = '#rtc';
  };
}


// ── RTC Detail View (async) ──────────────────────────────────────────
async function rtcDetailView(params) {
  // 1) Buscar todos os conjuntos de dados
  const allRtcs  = await getData('rtcs');
  const allStcs  = await getData('stcs');
  const allRmt   = await getData('rmtItems');

  // 2) Encontrar a RTC e sua STC
  const rtc = allRtcs.find(r => r.rtcId === params.rtcId);
  if (!rtc) {
    document.getElementById('app').innerHTML = '<p>RTC não encontrado.</p>';
    return;
  }
  const stc = allStcs.find(s => s.stcId === rtc.stcId) || {};
  const items = stc.items || [];

  // 3) Gerar linhas da tabela de itens
  const rowsHtml = items.map(it => {
    const r = allRmt.find(x => x.idRm === it.idRm) || {};
    return `
      <tr>
        <td>${it.idRm}</td>
        <td>${r.itemName || ''}</td>
        <td>${stc.centerCode || ''}</td>
        <td>${r.uf || ''}</td>
        <td>${it.quantity}</td>
      </tr>`;
  }).join('');

  // 4) Gerar histórico de status
  const histHtml = (rtc.history || []).map(h => {
    const time = new Date(h.time).toLocaleString();
    return `<li><strong>${h.status}</strong> – ${time}</li>`;
  }).join('');

  // 5) Montar todo o HTML de uma vez só
  document.getElementById('app').innerHTML = `
    <button
      class="btn btn-outline-secondary mb-3"
      onclick="window.history.back()">
      <i class="bi bi-arrow-left"></i> Voltar
    </button>

    <h2 class="mb-4">Detalhes RTC: ${rtc.rtcId}</h2>

    <div class="card mb-4 p-3">
      <div class="flex justify-between">
        <div><strong>STC:</strong> ${rtc.stcId} — ${stc.centerCode || ''}</div>
        <div><strong>Status:</strong> ${rtc.status}</div>
      </div>
    </div>

    <div class="table-container mb-4">
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Id. RM</th>
            <th>Item</th>
            <th>Centro</th>
            <th>UF</th>
            <th>Qtd. (UF)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <div class="card p-3">
      <h3>Histórico</h3>
      <ul class="mb-0">
        ${histHtml}
      </ul>
    </div>
  `;
}


// ── Pendentes de STC (async) ─────────────────────────────────────────
async function pending() {
  const app      = document.getElementById('app');
  // 1) Buscar dados de RMT de forma assíncrona
  const allItemsRaw = await getData('rmtItems');
  const allItems    = allItemsRaw.filter(i => !i.linkedStc);

  app.innerHTML = `
    <h2>Pendentes de STC</h2>
    <div class="flex align-center mb-4">
      <label>
        Centro:&nbsp;
        <select id="filterCenter" class="btn outline" style="padding:0.4rem;">
          <option value="">Todos Centros</option>
          ${CENTERS.map(c =>
            `<option value="${c.name}">${c.code} – ${c.name}</option>`
          ).join('')}
        </select>
      </label>
      <label style="margin-left:1rem;">
        Filtrar Id. RM:&nbsp;
        <input id="filterId" class="btn outline"
               style="padding:0.4rem; width:140px;"
               placeholder="digite Id. RM…" />
      </label>
      <button id="expCsv" class="btn outline" style="margin-left:auto;">
        <i class="bi bi-file-earmark-spreadsheet"></i> Exportar Excel
      </button>
    </div>
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th></th>
            <th>Data</th>
            <th>Id. RM</th>
            <th>Nome do Item</th>
            <th>Centro</th>
            <th>UF</th>
            <th>Qtd. (UF)</th>
          </tr>
        </thead>
        <tbody id="pendBody"></tbody>
      </table>
    </div>
  `;

  const filterCenter = document.getElementById('filterCenter');
  const filterId     = document.getElementById('filterId');
  const body         = document.getElementById('pendBody');
  const exportBtn    = document.getElementById('expCsv');

  // 2) Função de renderização da tabela
  function render() {
    const fc  = filterCenter.value;
    const fid = filterId.value.trim().toLowerCase();

    const filtered = allItems.filter(i => {
      const matchCenter = !fc || i.requesterName.includes(fc);
      const matchId     = !fid || i.idRm.toLowerCase().includes(fid);
      return matchCenter && matchId;
    });

    let html = '';
    CENTERS.forEach(c => {
      const rows = filtered.filter(i => i.requesterName.includes(c.name));
      if (!rows.length) return;

      html += `
        <tr class="group-header">
          <td colspan="7"><strong>${c.code} – ${c.name}</strong></td>
        </tr>`;

      rows.forEach(i => {
        const date = i.date
          ? new Date(i.date).toLocaleDateString()
          : '';
        html += `
          <tr>
            <td></td>
            <td>${date}</td>
            <td>${i.idRm}</td>
            <td>${i.itemName}</td>
            <td>${i.requesterName}</td>
            <td>${i.uf}</td>
            <td>${i.quantityUf}</td>
          </tr>`;
      });
    });

    if (!html) {
      html = `
        <tr>
          <td colspan="7" style="text-align:center;color:#777;">
            Nenhum item pendente encontrado.
          </td>
        </tr>`;
    }
    body.innerHTML = html;
  }

  // 3) Associar filtros e renderizar inicialmente
  filterCenter.onchange = render;
  filterId.oninput      = render;
  render();

  // 4) Exportar Excel (.xlsx)
  exportBtn.textContent = 'Exportar Excel';

  exportBtn.onclick = () => {
    const fc  = filterCenter.value;
    const fid = filterId.value.trim().toLowerCase();
    const filtered = allItems.filter(i =>
      (!fc || i.requesterName.includes(fc)) &&
      (!fid || i.idRm.toLowerCase().includes(fid))
    );

    // 4.1) Montar matriz de dados (array of arrays)
    const wsData = [
      ['Data','Id. RM','Nome do Item','Centro','UF','Qtd. (UF)'],
      ...filtered.map(i => [
        i.date ? new Date(i.date).toLocaleDateString('pt-BR') : '',
        i.idRm,
        i.itemName,
        i.requesterName,
        i.uf,
        i.quantityUf
      ])
    ];

    // 4.2) Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Pendentes');

    // 4.3) Disparar download
    XLSX.writeFile(wb, 'pendentes_stc.xlsx');
  };
}

// ── Settings / Perfil (async) ────────────────────────────────────────
async function settings() {
  // 1) Buscar usuário (continua em localStorage) e configurações (Firestore)
  const user = localStorage.getItem('authUser');
  const storedCfg = await getData('settings');
  const cfg = {
    emailNotif: false,
    ... (Array.isArray(storedCfg) ? {} : storedCfg)
  };

  // 2) Montar UI com toggle de notificação e botão de mudar senha
  document.getElementById('app').innerHTML = `
    <h2>Configurações & Perfil</h2>
    <div class="card p-4 mb-4">
      <h3>Perfil</h3>
      <p>E-mail: <strong>${user}</strong></p>
      <button id="chgPass" class="btn outline mb-3">
        <i class="bi bi-key"></i> Mudar Senha
      </button>
      <div class="form-check mb-3">
        <input type="checkbox" class="form-check-input" id="emailNotif"
               ${cfg.emailNotif ? 'checked' : ''}>
        <label class="form-check-label" for="emailNotif">
          Receber notificações por e-mail
        </label>
      </div>
      <button id="saveCfg" class="btn btn-primary">
        <i class="bi bi-save"></i> Salvar Configurações
      </button>
    </div>
  `;

  // 3) Handler do botão “Mudar Senha”
  document.getElementById('chgPass').onclick = () => {
    // aqui você pode abrir modal ou redirecionar
    alert('Funcionalidade de mudança de senha ainda não implementada.');
  };

  // 4) Handler do botão Salvar Configurações
  document.getElementById('saveCfg').onclick = async () => {
    const newCfg = { emailNotif: document.getElementById('emailNotif').checked };
    await setData('settings', newCfg);
    alert('Configurações salvas.');
  };
}
// ── CSV Download Utility ─────────────────────────────────────
function downloadCSV(objArray, filename) {
  if (!objArray.length) return;
  const keys = Object.keys(objArray[0]);
  const csv  = [
    keys.join(','),
    ...objArray.map(o =>
      keys
        .map(k => `"${String(o[k] ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
  ].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
