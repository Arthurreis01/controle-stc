// js/app.js

// ── Firebase Initialization ────────────────────────────────────
import firebase from 'firebase/app';
import 'firebase/firestore';

// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  // ...other config
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── Constants ─────────────────────────────────────────────────
const CENTERS = [
  { code: '84810', name: 'CEIMBE' },
  { code: '86810', name: 'CEIMLA' },
  { code: '88820', name: 'CEIMMA' },
  { code: '83810', name: 'CEIMNA' },
  { code: '85810', name: 'CEIMRG' },
  { code: '82802', name: 'CEIMSA' }
];

// ── Helpers ─────────────────────────────────────────────────────
// Fetch an array stored under `data/{key}`→{ items: [...] }
async function getData(key) {
  const doc = await db.collection('data').doc(key).get();
  return doc.exists ? doc.data().items : [];
}
// Overwrite the array under `data/{key}`→{ items: v }
async function setData(key, v) {
  await db.collection('data').doc(key).set({ items: v });
}
const parseQuery = () => {
  const q = {};
  const [_, query] = location.hash.split('?');
  if (query) {
    query.split('&').forEach(p => {
      const [k, v] = p.split('=');
      q[k] = decodeURIComponent(v);
    });
  }
  return q;
};

// ── Auth Guard & Sidebar Permissions ──────────────────────────
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
} else {
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    if (!allowedNav[role].includes(a.getAttribute('href'))) a.remove();
  });

  const checkPerms = () => {
    const route = (location.hash.slice(1) || 'dashboard').split('?')[0];
    if (!allowedRoutes[role].includes(route)) {
      alert('Você não tem permissão para acessar esta página.');
      const home = role === 'stc' ? 'stc' : role === 'rtc' ? 'rtc' : 'dashboard';
      window.location.hash = `#${home}`;
    }
  };
  window.addEventListener('load', checkPerms);
  window.addEventListener('hashchange', checkPerms);

  const btnLogout   = document.getElementById('btn-logout');
  const roleDisplay = document.getElementById('roleDisplay');

  let label = role === 'admin' ? 'Administrador' : role === 'stc' ? 'DepSIMRj' : 'CDAM';
  roleDisplay.textContent = label;

  btnLogout.onclick = () => {
    localStorage.removeItem('authUser');
    localStorage.removeItem('authRole');
    window.location = 'login.html';
  };
}

// ── Sidebar Toggle ───────────────────────────────────────────
const btnToggle = document.getElementById('toggle-sidebar');
btnToggle.addEventListener('click', () => {
  document.body.classList.toggle('sidebar-collapsed');
});

// ── Router ───────────────────────────────────────────────────
window.addEventListener('load',   async () => { await router(); markActiveLink(); });
window.addEventListener('hashchange', async () => { await router(); markActiveLink(); });

async function router() {
  const hash    = location.hash.slice(1) || 'dashboard';
  const [route] = hash.split('?');
  const params  = parseQuery();
  const app     = document.getElementById('app');
  app.innerHTML = '';

  const routes = {
    dashboard,
    import: importView,
    stc: stcView,
    'stc-new': newStcView,
    'stc-detail': stcDetailView,
    rtc: rtcView,
    'rtc-new': newRtcView,
    'rtc-detail': rtcDetailView,
    pending,
    settings
  };

  if (routes[route]) {
    await routes[route](params);
  } else {
    app.innerHTML = '<p>View não encontrada.</p>';
  }
}

// ── Active Link Highlighting ────────────────────────────────
function markActiveLink() {
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === window.location.hash);
  });
}

// ── Dashboard ────────────────────────────────────────────────
async function dashboard() {
  const stcs    = (await getData('stcs')).filter(s => s.status === 'PendingRTC');
  const rtcsAll = (await getData('rtcs')).filter(r => r.status === 'InTransit');

  document.getElementById('app').innerHTML = `<div class="kanban-container" id="dashKanban"></div>`;
  const kanban = document.getElementById('dashKanban');

  CENTERS.forEach(center => {
    const myStcs = stcs.filter(s => s.centerCode === center.code);
    const myRtcs = rtcsAll.filter(r => {
      const s = stcs.find(x => x.stcId === r.stcId);
      return s?.centerCode === center.code;
    });

    const secosStc = myStcs.filter(s => s.items.some(i => i.category === 'Secos'));
    const frigStc  = myStcs.filter(s => s.items.some(i => i.category === 'Frigorificados'));
    const secosRtc = myRtcs.filter(r => {
      const s = stcs.find(x => x.stcId === r.stcId);
      return s.items.some(i => i.category === 'Secos');
    });
    const frigRtc  = myRtcs.filter(r => {
      const s = stcs.find(x => x.stcId === r.stcId);
      return s.items.some(i => i.category === 'Frigorificados');
    });

    const col = document.createElement('div');
    col.className = 'kanban-column';
    col.innerHTML = `
      <div class="kanban-column-header">${center.code} – ${center.name}</div>
      <div class="dashboard-section">
        <h3><i class="bi bi-folder2-open"></i> STC</h3>
        <div class="category">
          <h4>Secos</h4>
          ${secosStc.map(s => {
            const date   = new Date(s.createdAt).toLocaleDateString();
            const sumQty = s.items.reduce((sum,i) => sum + i.quantity, 0).toFixed(2);
            return `
              <div class="kanban-item category-secos"
                   onclick="window.location.hash='#stc-detail?stcId=${s.stcId}'">
                <div class="content">
                  <div class="title">${s.stcId} (${sumQty} KG)</div>
                  <div class="meta">${date}</div>
                </div>
              </div>`;
          }).join('')}
        </div>
        <div class="category">
          <h4>Frigorificados</h4>
          ${frigStc.map(s => {
            const date   = new Date(s.createdAt).toLocaleDateString();
            const sumQty = s.items.reduce((sum,i) => sum + i.quantity, 0).toFixed(2);
            return `
              <div class="kanban-item category-frig"
                   onclick="window.location.hash='#stc-detail?stcId=${s.stcId}'">
                <div class="content">
                  <div class="title">${s.stcId} (${sumQty} KG)</div>
                  <div class="meta">${date}</div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
      <div class="dashboard-section">
        <h3><i class="bi bi-truck"></i> RTC</h3>
        <div class="category">
          <h4>Secos</h4>
          ${secosRtc.map(r => {
            const hist   = r.history[0]?.time;
            const date   = hist ? new Date(hist).toLocaleDateString() : '';
            const s      = stcs.find(x => x.stcId === r.stcId);
            const sumQty = s.items.reduce((sum,i) => sum + i.quantity, 0).toFixed(2);
            return `
              <div class="kanban-item category-secos"
                   onclick="window.location.hash='#rtc-detail?rtcId=${r.rtcId}'">
                <div class="content">
                  <div class="title">${r.rtcId} (${sumQty} KG)</div>
                  <div class="meta">${date}</div>
                </div>
              </div>`;
          }).join('')}
        </div>
        <div class="category">
          <h4>Frigorificados</h4>
          ${frigRtc.map(r => {
            const hist   = r.history[0]?.time;
            const date   = hist ? new Date(hist).toLocaleDateString() : '';
            const s      = stcs.find(x => x.stcId === r.stcId);
            const sumQty = s.items.reduce((sum,i) => sum + i.quantity, 0).toFixed(2);
            return `
              <div class="kanban-item category-frig"
                   onclick="window.location.hash='#rtc-detail?rtcId=${r.rtcId}'">
                <div class="content">
                  <div class="title">${r.rtcId} (${sumQty} KG)</div>
                  <div class="meta">${date}</div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
    `;
    kanban.appendChild(col);
  });
}

// ── Importar RMT (Excel) ─────────────────────────────────────
async function importView() {
  document.getElementById('app').innerHTML = `
    <h2>Importar RMT (Excel .xlsx/.xls)</h2>
    <input type="file" id="fileInp" accept=".xlsx,.xls" />
    <div id="feedback" class="alert" style="display:none;"></div>
  `;
  document.getElementById('fileInp').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb   = XLSX.read(data, { type:'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
        const existing = await getData('rmtItems'), dupes = new Set();
        const mapped = rows.map(row => {
          const idRm = String(row['Id. RM']||row['Id RM']||'').trim();
          if (!idRm || existing.find(x=>x.idRm===idRm)) dupes.add(idRm||'[sem Id]');
          return {
            supplierCam:   row['CAM Fornec.']    || '',
            date:          row['Data']            || '',
            piNumber:      row['PI']              || '',
            itemName:      row['Nome do Item']    || '',
            idRm,
            typeRm:        row['Tipo de RM']      || '',
            uf:            row['UF']              || '',
            statusRm:      row['Sit. da RM']      || '',
            quantityUf:    parseFloat(row['Qtde. (UF)']||0),
            unitPrice:     parseFloat(row['Preço Unitário']||0),
            totalValue:    parseFloat(row['Total']||0),
            requesterName: localStorage.getItem('authUser'),
            requesterCode: localStorage.getItem('authUser'),
            importedAt:    new Date().toISOString(),
            status:        'Imported',
            linkedStc:     null
          };
        });
        const fb = document.getElementById('feedback');
        if (dupes.size) {
          fb.style.display='block';
          fb.textContent = `IDs duplicados ou faltando: ${[...dupes].join(', ')}`;
        } else {
          await setData('rmtItems', existing.concat(mapped));
          fb.style.display='block'; fb.style.color='green';
          fb.textContent = `${mapped.length} itens importados com sucesso!`;
        }
      } catch (err) {
        const fb = document.getElementById('feedback');
        fb.style.display='block';
        fb.textContent = 'Erro ao processar o arquivo Excel.';
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };
}

// ── STC Management ───────────────────────────────────────────
// ── STC KANBAN VIEW ─────────────────────────────────────────
async function stcView() {
  let showArchived = false;
  const app = document.getElementById('app');

  function setup() {
    app.innerHTML = `
      <div class="flex justify-between align-center mb-4">
        <h2 style="font-weight:700;"></h2>
        <div class="flex gap-2">
          <button id="toggleArchived" class="btn btn-outline-primary">
            <i class="bi bi-archive-fill"></i> Ver Gerados
          </button>
          <button id="newStc" class="btn btn-primary">
            <i class="bi bi-plus-lg"></i> Nova STC
          </button>
        </div>
      </div>
      <div class="kanban-container" id="stcKanban"></div>
    `;
    document.getElementById('newStc').onclick = () =>
      window.location.hash = '#stc-new';
    document.getElementById('toggleArchived').onclick = () => {
      showArchived = !showArchived;
      render();
    };
  }

  async function render() {
    const tog = document.getElementById('toggleArchived');
    if (showArchived) {
      tog.innerHTML = `<i class="bi bi-arrow-counterclockwise"></i> Ver Pendentes`;
      tog.classList.replace('btn-outline-primary','btn-outline-secondary');
    } else {
      tog.innerHTML = `<i class="bi bi-archive-fill"></i> Ver Gerados`;
      tog.classList.replace('btn-outline-secondary','btn-outline-primary');
    }

    const all = await getData('stcs');
    const list = all.filter(s =>
      showArchived
        ? s.status === 'RTCGenerated'
        : s.status === 'PendingRTC'
    );

    const kanban = document.getElementById('stcKanban');
    kanban.innerHTML = '';

    CENTERS.forEach(center => {
      const col = document.createElement('div');
      col.className = 'kanban-column';
      const myStcs = list.filter(s => s.centerCode === center.code);

      let inner = '';
      if (myStcs.length === 0) {
        inner = `<p class="text-secondary p-2">${showArchived ? 'Nenhum gerado' : 'Nenhum STC'}</p>`;
      } else {
        inner = myStcs.map(s => {
          const sumQty  = s.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
          const created = new Date(s.createdAt).toLocaleDateString();
          const statusLabel = showArchived
            ? `<span class="badge bg-success">Gerado</span>`
            : `<span class="badge bg-warning text-dark">Pendente</span>`;
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
              <div class="d-flex justify-content-between align-items-start w-100">
                <div>
                  <div class="title">${s.stcId} (${sumQty} KG)</div>
                  <div class="meta">${created}</div>
                </div>
                ${actions}
              </div>
              ${statusLabel}
            </div>`;
        }).join('');
      }

      col.innerHTML = `
        <div class="kanban-column-header">${center.code} – ${center.name}</div>
        <div class="kanban-column-list">${inner}</div>
        <div class="kanban-column-footer">${myStcs.length} STC(s)</div>
      `;
      kanban.appendChild(col);

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
            const updated = (await getData('stcs')).filter(s => s.stcId !== b.dataset.id);
            await setData('stcs', updated);
            render();
          }
        );
      }
    });
  }

  setup();
  render();
}

// ── New / Edit STC Form ───────────────────────────────────────
async function newStcView(params) {
  const rmtAll   = await getData('rmtItems');
  const allRmt   = rmtAll.filter(i => !i.linkedStc || i.linkedStc === params.stcId);
  const editing  = Boolean(params.stcId);
  let existing   = [];

  if (editing) {
    existing = (await getData('stcs')).find(s => s.stcId === params.stcId).items;
  }

  const centerOpts = CENTERS.map(c =>
    `<option value="${c.code}">${c.code} – ${c.name}</option>`
  ).join('');

  document.getElementById('app').innerHTML = `
    <h2>${editing ? 'Editar' : 'Nova'} STC</h2>

    <label style="display:block; margin-bottom:1rem;">
      Código STC:<br/>
      <input type="text" id="code" placeholder="STC-001" value="${params.stcId||''}" />
    </label>

    <label style="display:block; margin-bottom:1.5rem;">
      Centro de Destino:<br/>
      <select id="stcCenter" class="emphasis-center">
        <option value="">Selecione um centro</option>
        ${centerOpts}
      </select>
    </label>

    <div class="table-container">
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

  if (editing) {
    const stc = (await getData('stcs')).find(s => s.stcId === params.stcId);
    document.getElementById('stcCenter').value = stc.centerCode;
  }

  const tbody = document.getElementById('stcBody');
  allRmt.forEach(i => {
    const it      = existing.find(x => x.idRm === i.idRm) || {};
    const checked = it.idRm ? 'checked' : '';
    const qty     = it.quantity ?? i.quantityUf;
    const cat     = it.category  || '';
    tbody.innerHTML += `
      <tr>
        <td><input type="checkbox" data-id="${i.idRm}" ${checked}></td>
        <td>${i.idRm}</td>
        <td>${i.itemName}</td>
        <td><input type="number" class="qty" step="any" value="${qty}" data-id="${i.idRm}" /></td>
        <td>
          <select class="cat-select" data-id="${i.idRm}">
            <option value="">--</option>
            <option value="Secos"        ${cat==='Secos'?'selected':''}>Secos</option>
            <option value="Frigorificados"${cat==='Frigorificados'?'selected':''}>Frigorificados</option>
          </select>
        </td>
      </tr>
    `;
  });

  const centerSel  = document.getElementById('stcCenter');
  const saveBtn    = document.getElementById('saveStc');
  const checkboxes = tbody.querySelectorAll('input[type=checkbox]');
  const qtyInputs  = tbody.querySelectorAll('.qty');
  const catSelects = tbody.querySelectorAll('.cat-select');
  const sumSpan    = document.getElementById('sumQty');

  function updateUI() {
    const hasCenter = !!centerSel.value;
    saveBtn.disabled = !hasCenter;
    const sum = [...qtyInputs].reduce((acc, inp) => {
      const cb = [...checkboxes].find(c => c.dataset.id === inp.dataset.id);
      return acc + (cb.checked ? parseFloat(inp.value) || 0 : 0);
    }, 0);
    sumSpan.textContent = sum.toFixed(2);
  }

  centerSel.onchange     = updateUI;
  checkboxes.forEach(cb => cb.onchange = updateUI);
  qtyInputs.forEach(q   => q.oninput   = updateUI);
  catSelects.forEach(s  => s.onchange  = updateUI);
  updateUI();

  saveBtn.onclick = async () => {
    const code   = document.getElementById('code').value.trim();
    const center = centerSel.value;
    const selIds = [...checkboxes].filter(c => c.checked).map(c => c.dataset.id);
    const items  = selIds.map(id => ({
      idRm: id,
      quantity: parseFloat([...qtyInputs].find(q => q.dataset.id === id).value) || 0,
      category: [...catSelects].find(s => s.dataset.id === id).value
    }));

    let stcs = await getData('stcs');
    if (editing) {
      stcs = stcs.map(s =>
        s.stcId === params.stcId
          ? { ...s, stcId: code, centerCode: center, items }
          : s
      );
    } else {
      stcs.push({ stcId: code, centerCode: center, items, status: 'PendingRTC', createdAt: new Date().toISOString() });
    }
    await setData('stcs', stcs);

    const updatedRmt = rmtAll.map(r => {
      if (selIds.includes(r.idRm)) return { ...r, linkedStc: code };
      if (editing && r.linkedStc === params.stcId) return { ...r, linkedStc: null };
      return r;
    });
    await setData('rmtItems', updatedRmt);

    alert(`STC ${code} salva.`);
    window.location.hash = '#stc';
  };
}

// ── STC Detail View ─────────────────────────────────────────
async function stcDetailView(params) {
  const stc = (await getData('stcs')).find(s=>s.stcId===params.stcId);
  if (!stc) return document.getElementById('app').innerHTML = '<p>STC não encontrada.</p>';
  const all = await getData('rmtItems');
  document.getElementById('app').innerHTML = `
    <h2>Detalhes STC: ${stc.stcId}</h2>
    <p><strong>Destino:</strong> ${stc.centerCode}</p>
    <div class="table-container">
      <table class="table">
        <thead><tr><th>Id. RM</th><th>Item</th><th>Categoria</th><th>Qtde.</th></tr></thead>
        <tbody id="stcDetailBody"></tbody>
        <tfoot><tr><th colspan="3">Total Qtde</th><th id="totalStcQty"></th></tr></tfoot>
      </table>
    </div>
  `;
  const body = document.getElementById('stcDetailBody');
  stc.items.forEach(it=>{
    const r = all.find(x=>x.idRm===it.idRm)||{};
    body.innerHTML += `
      <tr>
        <td>${it.idRm}</td>
        <td>${r.itemName||''}</td>
        <td>${it.category||''}</td>
        <td>${it.quantity}</td>
      </tr>`;
  });
  document.getElementById('totalStcQty').textContent = stc.items.reduce((a,i)=>a+i.quantity,0);
}

// ── RTC View ────────────────────────────────────────────────
async function rtcView() {
  let showCompleted = false;
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="flex justify-between align-center mb-4">
      <h2 style="font-weight:700;"></h2>
      <div class="flex gap-2">
        <button id="completedToggle" class="btn btn-outline-primary">
          <i class="bi bi-check2-circle"></i> Ver Concluídos
        </button>
        <button id="newRtc" class="btn btn-primary">
          <i class="bi bi-plus-lg"></i> Nova RTC
        </button>
      </div>
    </div>
    <div class="kanban-container" id="rtcKanban"></div>
  `;
  document.getElementById('newRtc').onclick = () => window.location.hash = '#rtc-new';
  document.getElementById('completedToggle').onclick = () => { showCompleted = !showCompleted; render(); };

  async function render() {
    const toggle = document.getElementById('completedToggle');
    toggle.innerHTML = showCompleted
      ? `<i class="bi bi-arrow-counterclockwise"></i> Ver Pendentes`
      : `<i class="bi bi-check2-circle"></i> Ver Concluídos`;

    const stcsPend = (await getData('stcs')).filter(s => s.status === 'PendingRTC');
    const rtcsAll  = await getData('rtcs');
    const kanban   = document.getElementById('rtcKanban');
    kanban.innerHTML = '';

    CENTERS.forEach(c => {
      const col = document.createElement('div');
      col.className = 'kanban-column';

      const pend = showCompleted ? [] : stcsPend.filter(s => s.centerCode === c.code);
      const transit = showCompleted ? [] : rtcsAll.filter(r => {
        const s = stcsPend.find(x => x.stcId === r.stcId);
        return r.status === 'InTransit' && s?.centerCode === c.code;
      });
      const completed = showCompleted
        ? rtcsAll.filter(r => {
            const s = stcsPend.find(x => x.stcId === r.stcId);
            return r.status === 'Completed' && s?.centerCode === c.code;
          })
        : [];

      let inner = '';
      if (!showCompleted) {
        inner += `
          <div class="dashboard-section">
            <h3><i class="bi bi-hourglass-split"></i> Pendente</h3>
            ${pend.length
              ? pend.map(s => {
                  const qty     = s.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
                  const created = new Date(s.createdAt).toLocaleDateString();
                  return `
                    <div class="kanban-item d-flex flex-column gap-2">
                      <div class="content">
                        <div class="title">${s.stcId} (${qty} itens)</div>
                        <div class="meta">${created}</div>
                      </div>
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-success emit-rtc" data-stc="${s.stcId}">
                          <i class="bi bi-truck"></i> Emitir RTC
                        </button>
                        <button class="btn btn-outline-danger delete-stc" data-stc="${s.stcId}">
                          <i class="bi bi-trash-fill"></i> Excluir
                        </button>
                      </div>
                    </div>`;
                }).join('')
              : `<p class="text-secondary p-2">Nenhum STC</p>`}
          </div>
          <div class="dashboard-section">
            <h3><i class="bi bi-truck"></i> Em Trânsito</h3>
            ${transit.length
              ? transit.map(r => {
                  const s   = stcsPend.find(x => x.stcId === r.stcId);
                  const qty = s.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
                  const ti  = r.transportInfo || {};
                  const date = r.history[0]?.time
                                 ? new Date(r.history[0].time).toLocaleDateString()
                                 : '—';
                  const eta  = ti.eta ? new Date(ti.eta).toLocaleString() : '—';
                  return `
                    <div class="kanban-item d-flex flex-column gap-2">
                      <div class="content">
                        <div class="title">${r.rtcId} (${qty} KG)</div>
                        <div class="meta"><strong>Data:</strong> ${date}</div>
                        <div class="meta"><strong>Placa:</strong> ${ti.truck||'—'}</div>
                        <div class="meta"><strong>Motorista:</strong> ${ti.driver||'—'}</div>
                        <div class="meta"><strong>ETA:</strong> ${eta}</div>
                      </div>
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info view-rtc" data-id="${r.rtcId}">
                          <i class="bi bi-eye-fill"></i> Ver
                        </button>
                        <button class="btn btn-success complete-rtc" data-id="${r.rtcId}">
                          <i class="bi bi-check2"></i> Entrega Concluída
                        </button>
                      </div>
                    </div>`;
                }).join('')
              : `<p class="text-secondary p-2">Nenhuma em trânsito</p>`}
          </div>`;
      } else {
        inner += `
          <div class="dashboard-section">
            <h3><i class="bi bi-check2-circle"></i> Concluídos</h3>
            ${completed.length
              ? completed.map(r => {
                  const s   = stcsPend.find(x => x.stcId === r.stcId);
                  const qty = s.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
                  const ti  = r.transportInfo || {};
                  const date = r.history[0]?.time
                                 ? new Date(r.history[0].time).toLocaleDateString()
                                 : '—';
                  const eta  = ti.eta ? new Date(ti.eta).toLocaleString() : '—';
                  return `
                    <div class="kanban-item d-flex flex-column gap-2">
                      <div class="content">
                        <div class="title">${r.rtcId} (${qty} KG)</div>
                        <div class="meta"><strong>Data:</strong> ${date}</div>
                        <div class="meta"><strong>Placa:</strong> ${ti.truck||'—'}</div>
                        <div class="meta"><strong>Motorista:</strong> ${ti.driver||'—'}</div>
                        <div class="meta"><strong>ETA:</strong> ${eta}</div>
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
        <div class="kanban-column-header">${c.code} – ${c.name}</div>
        ${inner}
      `;
      kanban.appendChild(col);

      col.querySelectorAll('.emit-rtc').forEach(b =>
        b.onclick = () => window.location.hash = `#rtc-new?stcId=${b.dataset.stc}`
      );
      col.querySelectorAll('.delete-stc').forEach(b =>
        b.onclick = async () => {
          if (!confirm(`Excluir STC ${b.dataset.stc}?`)) return;
          const updated = (await getData('stcs')).filter(s => s.stcId !== b.dataset.stc);
          await setData('stcs', updated);
          render();
        }
      );
      col.querySelectorAll('.view-rtc').forEach(b =>
        b.onclick = () => window.location.hash = `#rtc-detail?rtcId=${b.dataset.id}`
      );
      col.querySelectorAll('.complete-rtc').forEach(b =>
        b.onclick = async () => {
          if (!confirm('Confirmar entrega concluída?')) return;
          const id = b.dataset.id;
          const updated = (await getData('rtcs')).map(r =>
            r.rtcId === id ? { ...r, status: 'Completed' } : r
          );
          await setData('rtcs', updated);
          render();
        }
      );
    });
  }

  render();
}

// ── New / Edit RTC ───────────────────────────────────────────
async function newRtcView(params) {
  const editing = !!params.rtcId;
  const allRtcs = await getData('rtcs');
  const allStcs = await getData('stcs');
  const stcId   = params.stcId || (allRtcs.find(r=>r.rtcId===params.rtcId)||{}).stcId;
  const stc     = allStcs.find(s=>s.stcId===stcId);
  if (!stc) return document.getElementById('app').innerHTML = '<p>STC não encontrada.</p>';

  let rtcData = { truck:'', driver:'', eta:'' };
  if (editing) rtcData = allRtcs.find(r=>r.rtcId===params.rtcId).transportInfo;

  document.getElementById('app').innerHTML = `
    <h2>${editing?'Editar':'Nova'} RTC</h2>
    <label>Código RTC:<br/><input type="text" id="rtcCode" value="${params.rtcId||''}"/></label>
    <p><strong>STC:</strong> ${stcId}</p>
    <div class="table-container">
      <table class="table">
        <thead><tr><th>Id. RM</th><th>Qtde.</th></tr></thead>
        <tbody>${stc.items.map(it=>`<tr><td>${it.idRm}</td><td>${it.quantity}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <label>Placa:<input id="truck" type="text" value="${rtcData.truck}"/></label>
    <label>Motorista:<input id="driver" type="text" value="${rtcData.driver}"/></label>
    <label>ETA:<input id="eta" type="datetime-local" value="${rtcData.eta}"/></label>
    <button id="saveRtc" class="btn"><i class="bi bi-save"></i> Salvar RTC</button>
  `;
  document.getElementById('saveRtc').onclick = async () => {
    const code   = document.getElementById('rtcCode').value.trim();
    const truck  = document.getElementById('truck').value.trim();
    const driver = document.getElementById('driver').value.trim();
    const eta    = document.getElementById('eta').value;
    if (!code||!truck||!driver||!eta) return alert('Preencha todas as informações.');

    let rtcs = allRtcs;
    if (editing) {
      rtcs = rtcs.map(r=> r.rtcId===params.rtcId
        ? {...r, rtcId:code, transportInfo:{truck,driver,eta}}
        : r
      );
    } else {
      rtcs.push({
        rtcId:code,
        stcId,
        transportInfo:{truck,driver,eta},
        status:'InTransit',
        history:[{status:'InTransit', time:new Date().toISOString()}]
      });
    }
    await setData('rtcs', rtcs);

    if (!editing) {
      const updatedStcs = allStcs.map(s=>
        s.stcId===stcId ? {...s, status:'RTCGenerated'} : s
      );
      await setData('stcs', updatedStcs);
    }

    alert(`RTC ${code} salva.`);
    window.location.hash = '#rtc';
  };
}

// ── RTC Detail View ──────────────────────────────────────────
async function rtcDetailView(params) {
  const rtc = (await getData('rtcs')).find(r => r.rtcId === params.rtcId);
  if (!rtc) {
    document.getElementById('app').innerHTML = '<p>RTC não encontrado.</p>';
    return;
  }
  const stc    = (await getData('stcs')).find(s => s.stcId === rtc.stcId) || {};
  const items  = stc.items || [];
  const allRmt = await getData('rmtItems');

  const rowsHtml = items.map(it => {
    const r = allRmt.find(x => x.idRm === it.idRm) || {};
    return `
      <tr>
        <td>${new Date(r.date).toLocaleDateString() || ''}</td>
        <td>${r.piNumber || ''}</td>
        <td>${r.itemName || ''}</td>
        <td>${it.idRm}</td>
        <td>${r.typeRm || ''}</td>
        <td>${r.uf || ''}</td>
        <td>${r.statusRm || ''}</td>
        <td>${r.quantityUf?.toFixed(2) || ''}</td>
        <td>${r.unitPrice?.toFixed(2) || ''}</td>
        <td>${r.totalValue?.toFixed(2) || ''}</td>
        <td>${r.requesterName || ''}</td>
        <td>${r.requesterCode || ''}</td>
        <td>${it.quantity.toFixed(2)}</td>
      </tr>`;
  }).join('');

  const historyHtml = rtc.history.map(h => {
    const time = new Date(h.time).toLocaleString();
    return `<li><strong>${h.status}</strong> – ${time}</li>`;
  }).join('');

  document.getElementById('app').innerHTML = `
    <button class="btn btn-outline-secondary mb-3" onclick="window.history.back()">
      <i class="bi bi-arrow-left"></i> Voltar
    </button>
    <h2 class="mb-4">Detalhes RTC: ${rtc.rtcId}</h2>
    <div class="card mb-4 p-3">
      <div class="flex justify-between">
        <div><strong>STC:</strong> ${rtc.stcId}</div>
        <div><strong>Placa:</strong> ${rtc.transportInfo.truck||'—'}</div>
        <div><strong>Motorista:</strong> ${rtc.transportInfo.driver||'—'}</div>
        <div><strong>ETA:</strong> ${new Date(rtc.transportInfo.eta).toLocaleString()}</div>
      </div>
    </div>
    <div class="table-container mb-4">
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Data</th><th>PI</th><th>Item</th><th>Id. RM</th>
            <th>Tipo</th><th>UF</th><th>Sit. RM</th>
            <th>Qtde. (UF)</th><th>Preço</th><th>Total</th>
            <th>Solicitante</th><th>Cód. Sol.</th><th>Qtde. RTC</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <div class="card p-3">
      <h3>Histórico</h3>
      <ul class="mb-0">${historyHtml}</ul>
    </div>`;
}

// ── Pendentes de STC ─────────────────────────────────────────
async function pending() {
  const allItems = (await getData('rmtItems')).filter(i => !i.linkedStc);
  const app = document.getElementById('app');
  app.innerHTML = `
    <h2>Pendentes de STC</h2>
    <div class="flex align-center mb-4">
      <label>
        Centro:&nbsp;
        <select id="filterCenter" class="btn outline" style="padding:0.4rem;">
          <option value="">Todos Centros</option>
          ${CENTERS.map(c=>`<option value="${c.name}">${c.code} – ${c.name}</option>`).join('')}
        </select>
      </label>
      <label style="margin-left:1rem;">
        Filtrar Id. RM:&nbsp;
        <input id="filterId" class="btn outline" style="padding:0.4rem; width:140px;" placeholder="digite Id. RM…" />
      </label>
      <button id="expCsv" class="btn outline" style="margin-left:auto;">
        <i class="bi bi-file-earmark-spreadsheet"></i> Exportar CSV
      </button>
    </div>
    <div class="table-container">
      <table class="table">
        <thead><tr>
          <th>Id. RM</th><th>Nome do Item</th><th>Centro</th><th>UF</th><th>Qtd. (UF)</th>
        </tr></thead>
        <tbody id="pendBody"></tbody>
      </table>
    </div>
  `;

  const filterCenter = document.getElementById('filterCenter');
  const filterId     = document.getElementById('filterId');
  const body         = document.getElementById('pendBody');
  const exportBtn    = document.getElementById('expCsv');

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
      html += `<tr class="group-header"><td colspan="5"><strong>${c.code} – ${c.name}</strong></td></tr>`;
      rows.forEach(i => {
        html += `
          <tr>
            <td>${i.idRm}</td>
            <td>${i.itemName}</td>
            <td>${i.requesterName}</td>
            <td>${i.uf}</td>
            <td>${i.quantityUf}</td>
          </tr>`;
      });
    });

    if (!html) {
      html = `<tr><td colspan="5" style="text-align:center;color:#777;">
                Nenhum item pendente encontrado.
              </td></tr>`;
    }
    body.innerHTML = html;
  }

  filterCenter.onchange = render;
  filterId.oninput      = render;
  render();

  exportBtn.onclick = () => {
    const fc  = filterCenter.value;
    const fid = filterId.value.trim().toLowerCase();
    const filtered = allItems.filter(i => (!fc || i.requesterName.includes(fc)) && (!fid || i.idRm.toLowerCase().includes(fid)));

    const header = ['Id. RM','Nome do Item','Centro','UF','Qtd. (UF)'];
    const rows = filtered.map(i => [
      i.idRm,
      `"${i.itemName.replace(/"/g,'""')}"`,
      i.requesterName,
      i.uf,
      i.quantityUf
    ].join(','));

    const csv = [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pendentes_stc.csv';
    a.click();
  };
}

// ── Settings / Perfil ────────────────────────────────────────
async function settings() {
  const cfg  = JSON.parse(localStorage.getItem('settings')||'{"emailNotif":false}');
  document.getElementById('app').innerHTML = `
    <h2>Configurações & Perfil</h2>
    <div class="card"><h3>Perfil</h3><p>E-mail: <strong>${user}</strong></p>
      <button id="chgPass" class="btn outline"><i class="bi bi-key"></i> Mudar Senha</button>
    </div>
  `;
  document.getElementById('saveCfg')?.onclick = async () => {
    cfg.emailNotif = document.getElementById('emailNotif').checked;
    await setData('settings', cfg);
    alert('Configurações salvas.');
  };
}

// ── CSV Download Utility ─────────────────────────────────────
function downloadCSV(objArray, filename) {
  const keys = Object.keys(objArray[0]||{});
  const csv  = [
    keys.join(','),
    ...objArray.map(o => keys.map(k=>`"${String(o[k]||'').replace(/"/g,'""')}"`).join(','))
  ].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
