// js/app.js

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
const getData    = key => JSON.parse(localStorage.getItem(key) || '[]');
const setData    = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const parseQuery = () => {
  const q = {};
  const [_, query] = location.hash.split('?');
  if (query) query.split('&').forEach(p => {
    const [k,v] = p.split('=');
    q[k] = decodeURIComponent(v);
  });
  return q;
};

// ── ALERT UTILITIES ─────────────────────────────────────────────
function getAlerts() {
  const now = Date.now();
  // 1) RMT pendentes >6d
  const pendItems6 = getData('rmtItems')
    .filter(i => !i.linkedStc && i.importedAt)
    .filter(i => now - new Date(i.importedAt).getTime() > 6*24*60*60*1000)
    .length;
  // 2) STC >3d
  const stcAlerts = getData('stcs')
    .filter(s => s.status==='PendingRTC' && s.createdAt)
    .filter(s => now - new Date(s.createdAt).getTime() > 3*24*60*60*1000)
    .length;
  // 3) RTC “Aguardando coleta” >2d
  const rtcAlerts = getData('rtcs')
    .filter(r => r.status==='Aguardando coleta' && r.history[0]?.time)
    .filter(r => now - new Date(r.history[0].time).getTime() > 2*24*60*60*1000)
    .length;
  return { pendItems6, stcAlerts, rtcAlerts };
}

function updateSidebarAlerts() {
  const { pendItems6 } = getAlerts();
  const link = document.querySelector('.sidebar nav a[href="#pending"]');
  if (!link) return;
  link.querySelectorAll('.alert-badge').forEach(b=>b.remove());
  if (pendItems6>0) {
    const b = document.createElement('span');
    b.className = 'badge bg-warning text-dark alert-badge ms-auto';
    b.textContent = pendItems6;
    link.appendChild(b);
  }
}

// ── Auth Guard & Sidebar Permissions ─────────────────────────
const user = localStorage.getItem('authUser');
const role = localStorage.getItem('authRole');
const allowedRoutes = {
  admin:['dashboard','import','listing','stc','stc-new','stc-detail','rtc','rtc-new','rtc-detail','pending','settings'],
  stc:  ['stc','stc-new','stc-detail','settings'],
  rtc:  ['rtc','rtc-new','rtc-detail','settings']
};
const allowedNav = {
  admin:['#dashboard','#import','#listing','#stc','#rtc','#pending','#settings'],
  stc:  ['#stc','#settings'],
  rtc:  ['#rtc','#settings']
};

if (!user) {
  window.location = 'login.html';
} else {
  document.querySelectorAll('.sidebar nav a').forEach(a=>{
    if (!allowedNav[role].includes(a.getAttribute('href'))) a.remove();
  });
  updateSidebarAlerts();

  function checkPerms() {
    const route = (location.hash.slice(1)||'dashboard').split('?')[0];
    if (!allowedRoutes[role].includes(route)) {
      alert('Você não tem permissão para acessar esta página.');
      const home = role==='stc'?'stc':role==='rtc'?'rtc':'dashboard';
      window.location.hash = `#${home}`;
    }
  }
  window.addEventListener('load', checkPerms);
  window.addEventListener('hashchange', checkPerms);

  const btnLogout   = document.getElementById('btn-logout');
  const roleDisplay = document.getElementById('roleDisplay');
  let label = '';
  if (role==='admin') label='Administrador';
  else if(role==='stc')label='DepSIMRj';
  else if(role==='rtc')label='CDAM';
  roleDisplay.textContent = label;
  btnLogout.onclick = ()=>{
    localStorage.removeItem('authUser');
    localStorage.removeItem('authRole');
    window.location='login.html';
  };
}

// ── Sidebar Toggle ───────────────────────────────────────────
document.getElementById('toggle-sidebar')
  .addEventListener('click',()=>document.body.classList.toggle('sidebar-collapsed'));

// ── Router & Active Link ─────────────────────────────────────
window.addEventListener('load', router);
window.addEventListener('hashchange', router);
function router() {
  const hash    = location.hash.slice(1)||'dashboard';
  const [r]     = hash.split('?');
  const params  = parseQuery();
  const app     = document.getElementById('app');
  app.innerHTML = '';
  const routes = {
    dashboard, import:importView,
    stc:stcView,'stc-new':newStcView,'stc-detail':stcDetailView,
    rtc:rtcView,'rtc-new':newRtcView,'rtc-detail':rtcDetailView,
    pending, settings
  };
  (routes[r]||(()=>{app.innerHTML='<p>View não encontrada.</p>'}))(params);
  document.querySelectorAll('.sidebar nav a').forEach(a=>{
    a.classList.toggle('active',a.getAttribute('href')===window.location.hash);
  });
}

// ── Dashboard ────────────────────────────────────────────────
function dashboard() {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3*24*60*60*1000);
  const twoDaysAgo   = new Date(now.getTime() - 2*24*60*60*1000);

  // 1) STCs still waiting for an RTC
  const stcsAll      = getData('stcs').filter(s => s.status === 'PendingRTC');
  //    which of those are >3 days old?
  const stcOverdue   = stcsAll.filter(s => new Date(s.createdAt) < threeDaysAgo);

  // 2) RTCs in “Aguardando coleta”
  const rtcsColeta   = getData('rtcs').filter(r => r.status === 'Aguardando coleta');
  //    which of those have been in coleta >2 days?
  const rtcOverdue   = rtcsColeta.filter(r => {
    const hist = r.history.find(h => h.status === 'Aguardando coleta');
    return hist && new Date(hist.time) < twoDaysAgo;
  });

  // Only show RTCs not yet completed
  const rtcsAll      = getData('rtcs').filter(r => r.status !== 'Completed');

  // build top‐of‐dashboard alerts
  let alertsHtml = '';
  if (stcOverdue.length) {
    alertsHtml += `
      <div class="alert mb-4">
        <i class="bi bi-exclamation-triangle-fill"></i>
        Existem ${stcOverdue.length} STC(s) pendentes de emissão há mais de 3 dias!
      </div>`;
  }
  if (rtcOverdue.length) {
    alertsHtml += `
      <div class="alert mb-4">
        <i class="bi bi-clock-history"></i>
        Existem ${rtcOverdue.length} RTC(s) aguardando coleta há mais de 2 dias!
      </div>`;
  }

  document.getElementById('app').innerHTML = `
    ${alertsHtml}
    <div class="kanban-container" id="dashKanban"></div>
  `;

  const kanban = document.getElementById('dashKanban');
  CENTERS.forEach(center => {
    // STCs for this center
    const myStcs = stcsAll.filter(s => s.centerCode === center.code);
    // RTCs (coleta or entrega) for this center
    const myRtcs = rtcsAll.filter(r => {
      const s = getData('stcs').find(x => x.stcId === r.stcId);
      return s?.centerCode === center.code;
    });

    // split by category
    const secosStc = myStcs.filter(s => s.items.some(i => i.category === 'Secos'));
    const frigStc  = myStcs.filter(s => s.items.some(i => i.category === 'Frigorificados'));
    const secosRtc = myRtcs.filter(r => {
      const s = getData('stcs').find(x => x.stcId === r.stcId);
      return s.items.some(i => i.category === 'Secos');
    });
    const frigRtc  = myRtcs.filter(r => {
      const s = getData('stcs').find(x => x.stcId === r.stcId);
      return s.items.some(i => i.category === 'Frigorificados');
    });

    const col = document.createElement('div');
    col.className = 'kanban-column';
    col.innerHTML = `
      <div class="kanban-column-header">
        ${center.code} – ${center.name}
      </div>

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
            const s      = getData('stcs').find(x => x.stcId === r.stcId);
            const sumQty = s.items.reduce((sum,i) => sum + i.quantity, 0).toFixed(2);
            // choose correct icon
            const icon = r.status === 'Aguardando coleta'
              ? 'bi-clock-history'
              : 'bi-truck';
            return `
              <div class="kanban-item category-secos"
                   onclick="window.location.hash='#rtc-detail?rtcId=${r.rtcId}'">
                <div class="content">
                  <div class="title">
                    <i class="bi ${icon}" title="${r.status}"></i>
                    ${r.rtcId} (${sumQty} KG)
                  </div>
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
            const s      = getData('stcs').find(x => x.stcId === r.stcId);
            const sumQty = s.items.reduce((sum,i) => sum + i.quantity, 0).toFixed(2);
            const icon = r.status === 'Aguardando coleta'
              ? 'bi-clock-history'
              : 'bi-truck';
            return `
              <div class="kanban-item category-frig"
                   onclick="window.location.hash='#rtc-detail?rtcId=${r.rtcId}'">
                <div class="content">
                  <div class="title">
                    <i class="bi ${icon}" title="${r.status}"></i>
                    ${r.rtcId} (${sumQty} KG)
                  </div>
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
function importView() {
  document.getElementById('app').innerHTML = `
    <h2>Importar RMT (Excel .xlsx/.xls)</h2>
    <input type="file" id="fileInp" accept=".xlsx,.xls" />
    <div id="feedback" class="alert" style="display:none;"></div>
  `;
  document.getElementById('fileInp').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb   = XLSX.read(data, { type:'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
        const existing = getData('rmtItems'), dupes = new Set();
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
            requesterName: row['NOME_SOLICITANTE']||'',
            requesterCode: row['Solicitante']     || '',
            importedBy:    localStorage.getItem('authUser'),
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
          setData('rmtItems', existing.concat(mapped));
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
// ── STC KANBAN VIEW (updated) ─────────────────────────────────────────
function stcView() {
  const app = document.getElementById('app');
  let showArchived = false;

  // 1) SETUP: header + wire toggle & new
  function setup() {
    app.innerHTML = `
      <div class="flex justify-between align-center mb-4">
        <h2 style="font-weight:700;"></h2>
        <div class="flex gap-2">
          <button id="toggleArchived" class="btn btn-outline-primary">
            <i class="bi bi-archive-fill"></i> STC arquivadas
          </button>
          <button id="newStc" class="btn btn-primary">
            <i class="bi bi-plus-lg"></i> Nova STC
          </button>
        </div>
      </div>
      <div class="kanban-container" id="stcKanban"></div>
    `;

    // New STC (only makes sense when viewing pendentes)
    document.getElementById('newStc').onclick = () =>
      window.location.hash = '#stc-new';

    // Toggle pendentes <-> gerados
    document.getElementById('toggleArchived').onclick = () => {
      showArchived = !showArchived;
      render();
    };
  }

  // 2) RENDER: redraw columns based on showArchived
  function render() {
    // update toggle text/icon
    const tog = document.getElementById('toggleArchived');
    if (showArchived) {
      tog.innerHTML = `<i class="bi bi-arrow-counterclockwise"></i> Ver Pendentes`;
      tog.classList.replace('btn-outline-primary','btn-outline-secondary');
    } else {
      tog.innerHTML = `<i class="bi bi-archive-fill"></i> STC Arquivadas`;
      tog.classList.replace('btn-outline-secondary','btn-outline-primary');
    }

    // filter STCs
    const all = getData('stcs');
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

      // STCs for this center
      const myStcs = list.filter(s => s.centerCode === center.code);

      // build cards or placeholder
      let inner;
      if (myStcs.length === 0) {
        inner = `<p class="text-secondary p-2">
                   ${showArchived ? 'Nenhum gerado' : 'Nenhum STC'}
                 </p>`;
      } else {
        inner = myStcs.map(s => {
          const sumQty  = s.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
          const created = new Date(s.createdAt).toLocaleDateString();
          const statusLabel = showArchived
            ? `<span class="badge bg-success">Gerado</span>`
            : `<span class="badge bg-warning text-dark">RTC Pendente</span>`;
          // only view button when archived
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
        <div class="kanban-column-header">
          ${center.code} – ${center.name}
        </div>
        <div class="kanban-column-list">${inner}</div>
      `;
      kanban.appendChild(col);

      // wire up per-card buttons
      col.querySelectorAll('.view-stc').forEach(b =>
        b.onclick = () =>
          window.location.hash = `#stc-detail?stcId=${b.dataset.id}`
      );
      if (!showArchived) {
        col.querySelectorAll('.edit-stc').forEach(b =>
          b.onclick = () =>
            window.location.hash = `#stc-new?stcId=${b.dataset.id}`
        );
        col.querySelectorAll('.delete-stc').forEach(b =>
          b.onclick = () => {
            if (!confirm(`Excluir STC ${b.dataset.id}?`)) return;
            const updated = getData('stcs').filter(s => s.stcId !== b.dataset.id);
            setData('stcs', updated);
            render();
          }
        );
      }
    });
  }

  // initial
  setup();
  render();
}


// ── New / Edit STC Form ───────────────────────────────────────
function newStcView(params) {
  const rmtAll   = getData('rmtItems');
  const editing  = Boolean(params.stcId);
  const existing = editing
    ? (getData('stcs').find(s => s.stcId === params.stcId) || {}).items || []
    : [];

  // Build the center <option>s
  const centerOpts = CENTERS.map(c =>
    `<option value="${c.code}">${c.code} – ${c.name}</option>`
  ).join('');

  // Initial HTML
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

  const tbody     = document.getElementById('stcBody');
  const centerSel = document.getElementById('stcCenter');
  const saveBtn   = document.getElementById('saveStc');
  const sumSpan   = document.getElementById('sumQty');

  // Attach listeners after rows are rendered
  function attachRowListeners() {
    const cbs  = tbody.querySelectorAll('input.item-cb');
    const qts  = tbody.querySelectorAll('input.qty');
    const cats = tbody.querySelectorAll('select.cat-select');
    cbs.forEach(cb => cb.onchange = updateUI);
    qts.forEach(q => q.oninput = updateUI);
    cats.forEach(s => s.onchange = updateUI);
  }

  // Enable save only when a center is chosen and at least one box checked
  function updateUI() {
    const hasCenter  = !!centerSel.value;
    const anyChecked = !!tbody.querySelector('input.item-cb:checked');
    saveBtn.disabled = !(hasCenter && anyChecked);

    // Sum quantities of checked rows
    const total = Array.from(tbody.querySelectorAll('input.item-cb'))
      .filter(cb => cb.checked)
      .reduce((sum, cb) => {
        const id = cb.dataset.id;
        const val = parseFloat(tbody.querySelector(`.qty[data-id="${id}"]`).value) || 0;
        return sum + val;
      }, 0);
    sumSpan.textContent = total.toFixed(2);
  }

  // Rebuild table based on selected center
  function populateTable() {
    const code = centerSel.value;
    const center = CENTERS.find(c => c.code === code);
    if (!center) {
      tbody.innerHTML = '';
      updateUI();
      return;
    }

    // Filter RMT items by requesterName containing center.name
    const filtered = rmtAll.filter(i =>
      i.requesterName.includes(center.name) &&
      (!i.linkedStc || i.linkedStc === params.stcId)
    );

    // Render rows
    tbody.innerHTML = filtered.map(i => {
      const it      = existing.find(x => x.idRm === i.idRm) || {};
      const checked = it.idRm ? 'checked' : '';
      const qty     = it.quantity ?? i.quantityUf;
      const cat     = it.category  || '';
      return `
        <tr>
          <td>
            <input type="checkbox"
                   class="item-cb"
                   data-id="${i.idRm}"
                   ${checked} />
          </td>
          <td>${i.idRm}</td>
          <td>${i.itemName}</td>
          <td>
            <input type="number"
                   class="qty"
                   step="any"
                   value="${qty}"
                   data-id="${i.idRm}" />
          </td>
          <td>
            <select class="cat-select" data-id="${i.idRm}">
              <option value="">--</option>
              <option value="Secos"        ${cat==='Secos'?'selected':''}>
                Secos
              </option>
              <option value="Frigorificados" ${cat==='Frigorificados'?'selected':''}>
                Frigorificados
              </option>
            </select>
          </td>
        </tr>`;
    }).join('');

    attachRowListeners();
    updateUI();
  }

  // Wire up center change
  centerSel.onchange = populateTable;

  // If editing, preselect center and populate immediately
  if (editing) {
    const stc = getData('stcs').find(s => s.stcId === params.stcId);
    if (stc) centerSel.value = stc.centerCode;
  }
  populateTable();

  // Save handler (unchanged)
  saveBtn.onclick = () => {
    const code   = document.getElementById('code').value.trim();
    const center = centerSel.value;
    if (!code || !center) return;

    const selIds = Array.from(tbody.querySelectorAll('input.item-cb:checked'))
      .map(cb => cb.dataset.id);

    const items = selIds.map(id => {
      const quantity = parseFloat(
        tbody.querySelector(`.qty[data-id="${id}"]`).value
      ) || 0;
      const category = tbody.querySelector(`.cat-select[data-id="${id}"]`)
                            .value;
      return { idRm: id, quantity, category };
    });

    let stcs = getData('stcs');
    if (editing) {
      stcs = stcs.map(s =>
        s.stcId === params.stcId
          ? { ...s, stcId: code, centerCode: center, items }
          : s
      );
    } else {
      stcs.push({
        stcId: code,
        centerCode: center,
        items,
        status: 'PendingRTC',
        createdAt: new Date().toISOString()
      });
    }
    setData('stcs', stcs);

    // Update linkedStc on RMT items
    const updatedRmt = rmtAll.map(r =>
      selIds.includes(r.idRm)
        ? { ...r, linkedStc: code }
        : (editing && r.linkedStc === params.stcId)
          ? { ...r, linkedStc: null }
          : r
    );
    setData('rmtItems', updatedRmt);

    alert(`STC ${code} salva.`);
    window.location.hash = '#stc';
  };
}

// ── STC Detail View ─────────────────────────────────────────
function stcDetailView(params) {
  const stc = getData('stcs').find(s=>s.stcId===params.stcId);
  if (!stc) return document.getElementById('app').innerHTML = '<p>STC não encontrada.</p>';
  const all = getData('rmtItems');
  document.getElementById('app').innerHTML = `
    <h2>Detalhes STC: ${stc.stcId}</h2>
    <p>
      <strong>Destino:</strong>
      ${stc.centerCode} – ${
        (CENTERS.find(c => c.code === stc.centerCode) || {}).name
      }
    </p>
    <div class="table-container">
      <table class="table">
        <thead><tr>
          <th>Id. RM</th><th>Item</th><th>Categoria</th><th>Qtde.</th>
        </tr></thead>
        <tbody id="stcDetailBody"></tbody>
        <tfoot>
          <tr><th colspan="3">Total Qtde</th><th id="totalStcQty"></th></tr>
        </tfoot>
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
      </tr>
    `;
  });
  const total = stc.items.reduce((a,i)=>a+i.quantity,0);
  document.getElementById('totalStcQty').textContent = total;
}

// ── RTC View ────────────────────────────────────────────────
function rtcView() {
  let showCompleted = false;

  // render header + toggle/new buttons
  document.getElementById('app').innerHTML = `
    <div class="flex justify-between align-center mb-4">
      <h2 style="font-weight:700;">RTC Kanban</h2>
      <div class="flex gap-2">
        <button id="completedToggle" class="btn btn-outline-primary">
          <i class="bi bi-check2-circle"></i> Ver Concluídos
        </button>
      </div>
    </div>
    <div class="kanban-container" id="rtcKanban"></div>
  `;

  // toggle between active vs completed view
  document.getElementById('completedToggle').onclick = () => {
    showCompleted = !showCompleted;
    render();
  };

  function render() {
    // update toggle label/icon
    const toggle = document.getElementById('completedToggle');
    toggle.innerHTML = showCompleted
      ? `<i class="bi bi-arrow-counterclockwise"></i> Ver Pendentes`
      : `<i class="bi bi-check2-circle"></i> Ver Concluídos`;

    // clear columns
    const kanban = document.getElementById('rtcKanban');
    kanban.innerHTML = '';

    // fetch stored STCs & RTCs
    const stcsPend = getData('stcs').filter(s => s.status === 'PendingRTC');
    const rtcsAll  = getData('rtcs');

    CENTERS.forEach(c => {
      const col = document.createElement('div');
      col.className = 'kanban-column';

      // Pendente (no RTC yet)
      const pend = !showCompleted
        ? stcsPend.filter(s => s.centerCode === c.code)
        : [];

      // Aguardando coletagem
      const collecting = !showCompleted
        ? rtcsAll.filter(r => {
            const s = getData('stcs').find(x => x.stcId === r.stcId);
            return r.status === 'Aguardando coletagem'
               && s?.centerCode === c.code;
          })
        : [];

      // Aguardando entrega
      const delivering = !showCompleted
        ? rtcsAll.filter(r => {
            const s = getData('stcs').find(x => x.stcId === r.stcId);
            return r.status === 'Aguardando entrega'
               && s?.centerCode === c.code;
          })
        : [];

      // Concluídos
      const completed = showCompleted
        ? rtcsAll.filter(r => {
            const s = getData('stcs').find(x => x.stcId === r.stcId);
            return r.status === 'Completed'
               && s?.centerCode === c.code;
          })
        : [];

      let inner = '';

      if (!showCompleted) {
        // ── Pendente ─────────────────────────
        inner += `
          <div class="dashboard-section">
            <h3><i class="bi bi-hourglass-split"></i> Pendente</h3>
            ${
              pend.length
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
                : `<p class="text-secondary p-2">Nenhum STC</p>`
            }
          </div>`;

        // ── Aguardando coletagem ───────────────
        inner += `
          <div class="dashboard-section">
            <h3><i class="bi bi-clock-history"></i> Aguardando coletagem</h3>
            ${
              collecting.length
                ? collecting.map(r => {
                    const s    = getData('stcs').find(x=>x.stcId===r.stcId);
                    const qty  = s.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
                    const ti   = r.transportInfo || {};
                    const date = r.history[0]?.time
                                   ? new Date(r.history[0].time).toLocaleDateString()
                                   : '—';
                    return `
                      <div class="kanban-item d-flex flex-column gap-2">
                        <div class="content">
                          <div class="title">${r.rtcId} (${qty} KG)</div>
                          <div class="meta"><strong>Data:</strong> ${date}</div>
                        </div>
                        <button class="btn btn-warning complete-collect" data-id="${r.rtcId}">
                          <i class="bi bi-check2-square"></i> Coleta realizada
                        </button>
                      </div>`;
                  }).join('')
                : `<p class="text-secondary p-2">Nenhuma aguardando coletagem</p>`
            }
          </div>`;

        // ── Aguardando entrega ─────────────────
        inner += `
          <div class="dashboard-section">
            <h3><i class="bi bi-truck"></i> Aguardando entrega</h3>
            ${
              delivering.length
                ? delivering.map(r => {
                    const s    = getData('stcs').find(x=>x.stcId===r.stcId);
                    const qty  = s.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
                    const ti   = r.transportInfo || {};
                    const date = r.history.find(h=>h.status==='Aguardando entrega')?.time
                                   ? new Date(
                                       r.history.find(h=>h.status==='Aguardando entrega').time
                                     ).toLocaleDateString()
                                   : '—';
                    return `
                      <div class="kanban-item d-flex flex-column gap-2">
                        <div class="content">
                          <div class="title">${r.rtcId} (${qty} KG)</div>
                          <div class="meta"><strong>Data coleta:</strong> ${date}</div>
                        </div>
                        <button class="btn btn-success finalize-rtc" data-id="${r.rtcId}">
                          <i class="bi bi-check2"></i> Finalizar entrega
                        </button>
                      </div>`;
                  }).join('')
                : `<p class="text-secondary p-2">Nenhuma aguardando entrega</p>`
            }
          </div>`;
      } else {
        // ── Concluídos ───────────────────────────
        inner += `
          <div class="dashboard-section">
            <h3><i class="bi bi-check2-circle"></i> Concluídos</h3>
            ${
              completed.length
                ? completed.map(r => {
                    const s    = getData('stcs').find(x=>x.stcId===r.stcId);
                    const qty  = s.items.reduce((a,i)=>a+i.quantity,0).toFixed(2);
                    const hist = r.history.find(h=>h.status==='Completed')?.time;
                    const date = hist ? new Date(hist).toLocaleDateString() : '—';
                    return `
                      <div class="kanban-item d-flex flex-column gap-2">
                        <div class="content">
                          <div class="title">${r.rtcId} (${qty} KG)</div>
                          <div class="meta"><strong>Data entrega:</strong> ${date}</div>
                        </div>
                        <button class="btn btn-outline-info btn-sm view-rtc" data-id="${r.rtcId}">
                          <i class="bi bi-eye-fill"></i> Ver
                        </button>
                      </div>`;
                  }).join('')
                : `<p class="text-secondary p-2">Nenhum concluído</p>`
            }
          </div>`;
      }

      col.innerHTML = `
        <div class="kanban-column-header">
          ${c.code} – ${c.name}
        </div>
        ${inner}
      `;
      kanban.appendChild(col);

      // ── Handlers ───────────────────────────
      col.querySelectorAll('.emit-rtc').forEach(b =>
        b.onclick = () => window.location.hash = `#rtc-new?stcId=${b.dataset.stc}`
      );
      col.querySelectorAll('.delete-stc').forEach(b =>
        b.onclick = () => {
          if (!confirm(`Excluir STC ${b.dataset.stc}?`)) return;
          setData('stcs',
            getData('stcs').filter(x=>x.stcId!==b.dataset.stc)
          );
          render();
        }
      );
      col.querySelectorAll('.complete-collect').forEach(b =>
        b.onclick = () => {
          if (!confirm('Confirmar coleta realizada?')) return;
          const id = b.dataset.id;
          const updated = getData('rtcs').map(r =>
            r.rtcId===id
              ? {
                  ...r,
                  status: 'Aguardando entrega',
                  history: [...r.history,
                    { status:'Aguardando entrega', time: new Date().toISOString() }
                  ]
                }
              : r
          );
          setData('rtcs', updated);
          render();
        }
      );
      col.querySelectorAll('.finalize-rtc').forEach(b =>
        b.onclick = () => {
          if (!confirm('Confirmar entrega concluída?')) return;
          const id = b.dataset.id;
          const updated = getData('rtcs').map(r =>
            r.rtcId===id
              ? {
                  ...r,
                  status: 'Completed',
                  history: [...r.history,
                    { status:'Completed', time: new Date().toISOString() }
                  ]
                }
              : r
          );
          setData('rtcs', updated);
          render();
        }
      );
      col.querySelectorAll('.view-rtc').forEach(b =>
        b.onclick = () => window.location.hash = `#rtc-detail?rtcId=${b.dataset.id}`
      );
    });
  }

  render();
}

// ── New / Edit RTC ───────────────────────────────────────────
function newRtcView(params) {
  const editing = Boolean(params.rtcId);
  const allRtcs = getData('rtcs');
  const allStcs = getData('stcs');

  // figure out which STC we're working from
  const stcId = params.stcId
    || (allRtcs.find(r => r.rtcId === params.rtcId) || {}).stcId;
  const stc = allStcs.find(s => s.stcId === stcId);
  if (!stc) {
    return document.getElementById('app')
      .innerHTML = '<p>STC não encontrada.</p>';
  }

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
        <tbody>
          ${stc.items.map(it => {
            const r = getData('rmtItems').find(x => x.idRm === it.idRm) || {};
            return `
            <tr>
              <td>${it.idRm}</td>
              <td>${r.itemName || ''}</td>
              <td>${r.requesterName || ''}</td>
              <td>${r.uf || ''}</td>
              <td>${it.quantity}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <button id="saveRtc" class="btn btn-primary">
      <i class="bi bi-save"></i> Salvar RTC
    </button>
  `;

  document.getElementById('saveRtc').onclick = () => {
    const code = document.getElementById('rtcCode').value.trim();
    if (!code) {
      return alert('Por favor, informe o código da RTC.');
    }

    let updated;
    if (editing) {
      // just rename
      updated = allRtcs.map(r =>
        r.rtcId === params.rtcId
          ? { ...r, rtcId: code }
          : r
      );
    } else {
      // create new in “Aguardando coletagem”
      updated = [
        ...allRtcs,
        {
          rtcId: code,
          stcId,
          status: 'Aguardando coletagem',
          history: [
            { status: 'Aguardando coletagem', time: new Date().toISOString() }
          ]
        }
      ];
    }
    setData('rtcs', updated);

    // mark STC as generated on first save
    if (!editing) {
      setData('stcs',
        allStcs.map(s =>
          s.stcId === stcId
            ? { ...s, status: 'RTCGenerated' }
            : s
        )
      );
    }

    alert(`RTC ${code} salva.`);
    window.location.hash = '#rtc';
  };
}


// ── RTC Detail View ──────────────────────────────────────────
function rtcDetailView(params) {
  const rtc = getData('rtcs').find(r => r.rtcId === params.rtcId);
  if (!rtc) {
    document.getElementById('app').innerHTML = '<p>RTC não encontrado.</p>';
    return;
  }

  const stc     = getData('stcs').find(s => s.stcId === rtc.stcId) || {};
  const items   = stc.items || [];
  const allRmt  = getData('rmtItems');

  // build table rows
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

  // build history
  const histHtml = (rtc.history||[]).map(h => {
    const time = new Date(h.time).toLocaleString();
    return `<li><strong>${h.status}</strong> – ${time}</li>`;
  }).join('');

  document.getElementById('app').innerHTML = `
    <button
      class="btn btn-outline-secondary mb-3"
      onclick="window.history.back()">
      <i class="bi bi-arrow-left"></i> Voltar
    </button>

    <h2 class="mb-4">Detalhes RTC: ${rtc.rtcId}</h2>

    <div class="card mb-4 p-3">
      <div class="flex justify-between">
        <div><strong>STC:</strong> ${rtc.stcId} — ${stc.centerCode}</div>
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


// ── Pendentes de STC ─────────────────────────────────────────
// Atualiza a view “Pendentes de STC” incluindo alerta para itens > 6 dias
function pending() {
  // atualiza badge no sidebar
  updateSidebarAlerts();

  // calcula quantos itens estão pendentes há mais de 6 dias
  const { pendItems6 } = getAlerts();
  const app = document.getElementById('app');

  // coleta apenas itens sem STC
  const allItems = getData('rmtItems').filter(i => !i.linkedStc);

  // banner de alerta se houver itens antigos
  const banner = pendItems6 > 0
    ? `<div class="alert alert-warning mb-4">
         ⚠️ Há ${pendItems6} item(ns) sem STC há mais de 6 dias.
       </div>`
    : '';

  // constrói HTML inicial
  app.innerHTML = `
    ${banner}
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
        <i class="bi bi-file-earmark-spreadsheet"></i> Exportar CSV
      </button>
    </div>
    <div class="table-container">
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
        <tbody id="pendBody"></tbody>
      </table>
    </div>
  `;

  // referências aos elementos
  const filterCenter = document.getElementById('filterCenter');
  const filterId     = document.getElementById('filterId');
  const body         = document.getElementById('pendBody');
  const exportBtn    = document.getElementById('expCsv');

  // renderiza tabela com filtros
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
          <td colspan="5"><strong>${c.code} – ${c.name}</strong></td>
        </tr>
      `;
      rows.forEach(i => {
        html += `
          <tr>
            <td>${i.idRm}</td>
            <td>${i.itemName}</td>
            <td>${i.requesterName}</td>
            <td>${i.uf}</td>
            <td>${i.quantityUf}</td>
          </tr>
        `;
      });
    });

    if (!html) {
      html = `
        <tr>
          <td colspan="5" style="text-align:center;color:#777;">
            Nenhum item pendente encontrado.
          </td>
        </tr>
      `;
    }
    body.innerHTML = html;
  }

  // associa eventos e dispara primeira renderização
  filterCenter.onchange = render;
  filterId.oninput      = render;
  render();

  // exporta CSV
  exportBtn.onclick = () => {
    const fc  = filterCenter.value;
    const fid = filterId.value.trim().toLowerCase();
    const filtered = allItems.filter(i =>
      (!fc || i.requesterName.includes(fc)) &&
      (!fid || i.idRm.toLowerCase().includes(fid))
    );
    const header = ['Id. RM','Nome do Item','Centro','UF','Qtd. (UF)'];
    const rows = filtered.map(i => [
      i.idRm,
      `"${i.itemName.replace(/"/g,'""')}"`,
      i.requesterName,
      i.uf,
      i.quantityUf
    ].join(','));
    const csv = [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pendentes_stc.csv';
    a.click();
  };
}

// ── Settings / Perfil ────────────────────────────────────────
function settings() {
  const user = localStorage.getItem('authUser');
  const cfg  = JSON.parse(localStorage.getItem('settings')||'{"emailNotif":false}');
  document.getElementById('app').innerHTML = `
    <h2>Configurações & Perfil</h2>
    <div class="card"><h3>Perfil</h3><p>E-mail: <strong>${user}</strong></p>
      <button id="chgPass" class="btn outline"><i class="bi bi-key"></i> Mudar Senha</button>
    </div>
  `;
  document.getElementById('saveCfg').onclick = () => {
    cfg.emailNotif = document.getElementById('emailNotif').checked;
    setData('settings', cfg);
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
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

