// js/app.js

// ── Helpers ─────────────────────────────────────────────────────
const getData = key => JSON.parse(localStorage.getItem(key) || '[]');
const setData = (k, v) => localStorage.setItem(k, JSON.stringify(v));
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

// ── Auth Guard ────────────────────────────────────────────────
if (!localStorage.getItem('authUser')) window.location = 'login.html';
document.getElementById('btn-logout').onclick = () => {
  localStorage.removeItem('authUser');
  window.location = 'login.html';
};
document.getElementById('btn-profile').onclick = () => {
  window.location.hash = '#settings';
};

// ── Router ───────────────────────────────────────────────────
window.addEventListener('load', router);
window.addEventListener('hashchange', router);
function router() {
  const hash = location.hash.slice(1) || 'dashboard';
  const [route] = hash.split('?');
  const params = parseQuery();
  const app = document.getElementById('app');
  app.innerHTML = '';

  const routes = {
    dashboard,
    import: importView,
    listing,
    stc: stcView,
    'stc-new': newStcView,
    'stc-detail': stcDetailView,
    rtc: rtcView,
    'rtc-new': newRtcView,
    'rtc-detail': rtcDetailView,
    pending,
    settings
  };

  const fn = routes[route];
  if (fn) fn(params);
  else app.innerHTML = '<p>View não encontrada.</p>';
}

// ── Dashboard ────────────────────────────────────────────────
function dashboard() {
  const rmt = getData('rmtItems');
  const stcP = getData('stcs').filter(x => x.status === 'PendingRTC');
  const rtcT = getData('rtcs').filter(x => x.status === 'InTransit');
  const pend = rmt.filter(i => !i.linkedStc).length;

  document.getElementById('app').innerHTML = `
    <h2>Dashboard</h2>
    <div class="card-container">
      <div class="card">RMT Imported<br><strong>${rmt.length}</strong></div>
      <div class="card">STC Pending<br><strong>${stcP.length}</strong></div>
      <div class="card">RTC In Transit<br><strong>${rtcT.length}</strong></div>
      <div class="card">Pendentes STC<br><strong>${pend}</strong></div>
    </div>
  `;
}

// ── Importar RMT (Excel) ─────────────────────────────────────
function importView() {
  document.getElementById('app').innerHTML = `
    <h2>Importar RMT (Excel .xlsx/.xls)</h2>
    <input type="file" id="fileInp" accept=".xlsx,.xls" />
    <div id="feedback"></div>
  `;
  // … your SheetJS import logic here …
}

// ── Listar RMT ───────────────────────────────────────────────
function listing() {
  const rmt = getData('rmtItems');
  document.getElementById('app').innerHTML = `
    <h2>Listar RMT</h2>
    <input id="filterId" placeholder="Filtrar por Id. RM" />
    <div class="table-container">
      <table class="table"><thead>
        <tr>
          <th>CAM Fornec.</th><th>Data</th><th>PI</th><th>Nome do Item</th>
          <th>Id. RM</th><th>Tipo de RM</th><th>UF</th><th>Sit. da RM</th>
          <th>Qtde. (UF)</th><th>Preço Unitário</th><th>Total</th>
          <th>NOME_SOLICITANTE</th><th>Solicitante</th>
        </tr>
      </thead><tbody id="rmtBody"></tbody></table>
    </div>
  `;
  const body = document.getElementById('rmtBody');
  function render() {
    const f = document.getElementById('filterId').value.trim();
    body.innerHTML = '';
    rmt.filter(i => !f || i.idRm.includes(f)).forEach(i => {
      body.innerHTML += `<tr>
        <td>${i.supplierCam}</td><td>${i.date}</td><td>${i.piNumber}</td>
        <td>${i.itemName}</td><td>${i.idRm}</td><td>${i.typeRm}</td>
        <td>${i.uf}</td><td>${i.statusRm}</td><td>${i.quantityUf}</td>
        <td>${i.unitPrice}</td><td>${i.totalValue}</td>
        <td>${i.requesterName}</td><td>${i.requesterCode}</td>
      </tr>`;
    });
  }
  document.getElementById('filterId').oninput = render;
  render();
}

// ── STC List + CRUD ─────────────────────────────────────────
function stcView() {
  document.getElementById('app').innerHTML = `
    <h2>STC Management</h2>
    <button id="newStc" class="btn">
      <i class="bi bi-file-earmark-plus"></i> Nova STC
    </button>
    <h3>STCs Pendentes</h3>
    <ul id="pendingStc"></ul>
  `;
  document.getElementById('newStc').onclick = () =>
    window.location.hash = '#stc-new';

  const pending = getData('stcs').filter(s => s.status === 'PendingRTC');
  document.getElementById('pendingStc').innerHTML =
    pending.map(s => `
      <li>
        <a href="#stc-detail?stcId=${s.stcId}">
          <i class="bi bi-file-earmark-text"></i> ${s.stcId}
        </a>
        <i class="bi bi-pencil-square edit-stc" data-id="${s.stcId}"></i>
        <i class="bi bi-trash delete-stc" data-id="${s.stcId}"></i>
      </li>
    `).join('');

  document.querySelectorAll('.edit-stc').forEach(el => {
    el.onclick = () => window.location.hash = `#stc-new?stcId=${el.dataset.id}`;
  });
  document.querySelectorAll('.delete-stc').forEach(el => {
    el.onclick = () => {
      if (!confirm(`Apagar STC ${el.dataset.id}?`)) return;
      setData('stcs', getData('stcs').filter(s => s.stcId !== el.dataset.id));
      const r = getData('rmtItems').map(i =>
        i.linkedStc === el.dataset.id ? { ...i, linkedStc: null } : i
      );
      setData('rmtItems', r);
      router();
    };
  });
}

// ── Nova / Edit STC Form ─────────────────────────────────────
function newStcView(params) {
  const rmtAll = getData('rmtItems');
  const allRmt = rmtAll.filter(i => !i.linkedStc || i.linkedStc === params.stcId);
  const editing = !!params.stcId;
  let existingItems = [];
  if (editing) {
    existingItems = getData('stcs').find(s => s.stcId === params.stcId).items;
  }

  document.getElementById('app').innerHTML = `
    <h2>${editing ? 'Editar' : 'Nova'} STC</h2>
    <label>Código STC:<br/>
      <input type="text" id="code" placeholder="STC-001" value="${params.stcId || ''}"/>
    </label>
    <div class="table-container">
      <table class="table"><thead><tr>
        <th></th><th>Id. RM</th><th>Item</th><th>Qtde.</th>
      </tr></thead><tbody id="stcBody"></tbody></table>
    </div>
    <button id="saveStc" class="btn">
      <i class="bi bi-save"></i> Salvar STC
    </button>
  `;
  const tbody = document.getElementById('stcBody');
  allRmt.forEach(i => {
    const isChecked = existingItems.some(it => it.idRm === i.idRm);
    const qty = (existingItems.find(it => it.idRm === i.idRm) || {}).quantity || i.quantityUf;
    tbody.innerHTML += `<tr>
      <td><input type="checkbox" data-id="${i.idRm}" ${isChecked ? 'checked' : ''}></td>
      <td>${i.idRm}</td><td>${i.itemName}</td>
      <td><input type="number" step="any" value="${qty}" data-id="${i.idRm}" class="qty"/></td>
    </tr>`;
  });

  const codeInput = document.getElementById('code'),
        btn       = document.getElementById('saveStc'),
        cbs       = tbody.querySelectorAll('input[type=checkbox]'),
        qtys      = tbody.querySelectorAll('.qty');

  function updateBtn() {
    btn.disabled = ![...cbs].some(cb => cb.checked) || !codeInput.value.trim();
  }
  codeInput.oninput = updateBtn;
  cbs.forEach(cb => cb.onchange = updateBtn);
  updateBtn();

  btn.onclick = () => {
    const code   = codeInput.value.trim();
    const selIds = [...cbs].filter(cb => cb.checked).map(cb => cb.dataset.id);
    const items  = [...qtys].filter(i => selIds.includes(i.dataset.id))
                   .map(i => ({ idRm: i.dataset.id, quantity: parseFloat(i.value) }));
    let stcs     = getData('stcs');
    if (editing) {
      stcs = stcs.map(s =>
        s.stcId === params.stcId ? { ...s, stcId: code, items } : s
      );
    } else {
      stcs.push({ stcId: code, items, status: 'PendingRTC', createdAt: new Date().toISOString() });
    }
    setData('stcs', stcs);

    const updatedRmt = rmtAll.map(i => {
      if (selIds.includes(i.idRm)) return { ...i, linkedStc: code };
      if (editing && i.linkedStc === params.stcId) return { ...i, linkedStc: null };
      return i;
    });
    setData('rmtItems', updatedRmt);

    alert(`STC ${code} salva.`);
    window.location.hash = '#stc';
  };
}

// ── STC Detail ───────────────────────────────────────────────
function stcDetailView(params) {
  const { stcId } = params;
  const stc = getData('stcs').find(s => s.stcId === stcId);
  if (!stc) {
    document.getElementById('app').innerHTML = '<p>STC não encontrada.</p>';
    return;
  }

  document.getElementById('app').innerHTML = `
    <h2>Detalhes STC: ${stcId}</h2>
    <p>Status: ${stc.status}</p>
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Data</th><th>PI</th><th>Nome do Item</th><th>Id. RM</th>
            <th>Tipo de RM</th><th>UF</th><th>Sit. da RM</th>
            <th>Qtde. (UF)</th><th>Preço Unitário</th><th>Total</th>
            <th>NOME_SOLICITANTE</th><th>Solicitante</th><th>Qtde. STC</th>
          </tr>
        </thead>
        <tbody id="stcDetailBody"></tbody>
      </table>
    </div>
  `;

  const body = document.getElementById('stcDetailBody');
  const allRmt = getData('rmtItems');
  stc.items.forEach(it => {
    const r = allRmt.find(r => r.idRm === it.idRm);
    body.innerHTML += `<tr>
      <td>${r.date}</td><td>${r.piNumber}</td><td>${r.itemName}</td><td>${r.idRm}</td>
      <td>${r.typeRm}</td><td>${r.uf}</td><td>${r.statusRm}</td>
      <td>${r.quantityUf}</td><td>${r.unitPrice}</td><td>${r.totalValue}</td>
      <td>${r.requesterName}</td><td>${r.requesterCode}</td><td>${it.quantity}</td>
    </tr>`;
  });
}

// ── RTC List + CRUD ──────────────────────────────────────────
function rtcView() {
  document.getElementById('app').innerHTML = `
    <h2>RTC Management</h2>
    <button id="newRtc" class="btn"><i class="bi bi-file-earmark-plus"></i> Nova RTC</button>
    <h3>STCs Aguardando RTC</h3><ul id="stcForRtc"></ul>
    <h3>RTCs Em Trânsito</h3><ul id="rtcInTransit"></ul>
  `;
  document.getElementById('newRtc').onclick = () =>
    window.location.hash = '#rtc-new';

  const stcs = getData('stcs').filter(s => s.status === 'PendingRTC');
  document.getElementById('stcForRtc').innerHTML =
    stcs.map(s => `<li><a href="#rtc-new?stcId=${s.stcId}">
      <i class="bi bi-truck"></i> ${s.stcId}
    </a></li>`).join('');

  const rtcs = getData('rtcs').filter(r => r.status === 'InTransit');
  document.getElementById('rtcInTransit').innerHTML =
    rtcs.map(r => `
      <li>
        <a href="#rtc-detail?rtcId=${r.rtcId}">
          <i class="bi bi-truck-flatbed"></i> ${r.rtcId}
        </a>
        <i class="bi bi-pencil-square edit-rtc" data-id="${r.rtcId}"></i>
        <i class="bi bi-trash delete-rtc" data-id="${r.rtcId}"></i>
      </li>
    `).join('');

  document.querySelectorAll('.edit-rtc').forEach(el => {
    el.onclick = () => window.location.hash = `#rtc-new?rtcId=${el.dataset.id}`;
  });
  document.querySelectorAll('.delete-rtc').forEach(el => {
    el.onclick = () => {
      if (!confirm(`Apagar RTC ${el.dataset.id}?`)) return;
      setData('rtcs', getData('rtcs').filter(r => r.rtcId !== el.dataset.id));
      router();
    };
  });
}

// ── Nova / Edit RTC Form ─────────────────────────────────────
function newRtcView(params) {
  const editing = !!params.rtcId;
  const stcId = params.stcId || getData('rtcs').find(r => r.rtcId === params.rtcId)?.stcId;
  const stc = getData('stcs').find(s => s.stcId === stcId);
  if (!stc) {
    document.getElementById('app').innerHTML = '<p>STC não encontrada.</p>';
    return;
  }

  let rtcData = { truck: '', driver: '', eta: '' };
  if (editing) {
    rtcData = getData('rtcs').find(r => r.rtcId === params.rtcId).transportInfo;
  }

  document.getElementById('app').innerHTML = `
    <h2>${editing ? 'Editar' : 'Nova'} RTC</h2>
    <label>Código RTC:<br/><input type="text" id="rtcCode" placeholder="RTC-001" value="${params.rtcId||''}"/></label>
    <p>STC: ${stcId}</p>
    <div class="table-container">
      <table class="table">
        <thead><tr><th>Id. RM</th><th>Qtde.</th></tr></thead>
        <tbody>${stc.items.map(it => `<tr><td>${it.idRm}</td><td>${it.quantity}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <label>Placa:<input id="truck" type="text" value="${rtcData.truck}"/></label>
    <label>Motorista:<input id="driver" type="text" value="${rtcData.driver}"/></label>
    <label>ETA:<input id="eta" type="datetime-local" value="${rtcData.eta}"/></label>
    <button id="saveRtc" class="btn"><i class="bi bi-save"></i> Salvar RTC</button>
  `;

  document.getElementById('saveRtc').onclick = () => {
    const code   = document.getElementById('rtcCode').value.trim();
    const truck  = document.getElementById('truck').value.trim();
    const driver = document.getElementById('driver').value.trim();
    const eta    = document.getElementById('eta').value;
    if (!code || !truck || !driver || !eta) {
      return alert('Preencha todas as informações.');
    }

    let rtcs = getData('rtcs');
    if (editing) {
      rtcs = rtcs.map(r =>
        r.rtcId === params.rtcId
          ? { ...r, rtcId: code, transportInfo: { truck, driver, eta } }
          : r
      );
    } else {
      rtcs.push({
        rtcId: code,
        stcId,
        transportInfo: { truck, driver, eta },
        status: 'InTransit',
        history: [{ status: 'InTransit', time: new Date().toISOString() }]
      });
    }
    setData('rtcs', rtcs);

    if (!editing) {
      setData('stcs',
        getData('stcs').map(s =>
          s.stcId === stcId ? { ...s, status: 'RTCGenerated' } : s
        )
      );
    }

    alert(`RTC ${code} salva.`);
    window.location.hash = '#rtc';
  };
}

// ── RTC Detail ───────────────────────────────────────────────
function rtcDetailView(params) {
  const { rtcId } = params;
  const rtc       = getData('rtcs').find(r => r.rtcId === rtcId);
  if (!rtc) {
    document.getElementById('app').innerHTML = '<p>RTC não encontrado.</p>';
    return;
  }
  const stc    = getData('stcs').find(s => s.stcId === rtc.stcId);
  const allRmt = getData('rmtItems');

  document.getElementById('app').innerHTML = `
    <h2>Detalhes RTC: ${rtcId}</h2>
    <p>STC: ${rtc.stcId}</p>
    <p>Placa: ${rtc.transportInfo.truck}</p>
    <p>Motorista: ${rtc.transportInfo.driver}</p>
    <p>ETA: ${new Date(rtc.transportInfo.eta).toLocaleString()}</p>
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Data</th><th>PI</th><th>Nome do Item</th><th>Id. RM</th>
            <th>Tipo de RM</th><th>UF</th><th>Sit. da RM</th>
            <th>Qtde. (UF)</th><th>Preço Unitário</th><th>Total</th>
            <th>NOME_SOLICITANTE</th><th>Solicitante</th><th>Qtde. RTC</th>
          </tr>
        </thead>
        <tbody id="rtcDetailBody"></tbody>
      </table>
    </div>
    <h3>Histórico</h3>
    <ul>${rtc.history.map(h =>
      `<li>${h.status} – ${new Date(h.time).toLocaleString()}</li>`
    ).join('')}</ul>
  `;

  const bodyItems = document.getElementById('rtcDetailBody');
  stc.items.forEach(it => {
    const r = allRmt.find(r => r.idRm === it.idRm);
    bodyItems.innerHTML += `<tr>
      <td>${r.date}</td><td>${r.piNumber}</td><td>${r.itemName}</td><td>${r.idRm}</td>
      <td>${r.typeRm}</td><td>${r.uf}</td><td>${r.statusRm}</td>
      <td>${r.quantityUf}</td><td>${r.unitPrice}</td><td>${r.totalValue}</td>
      <td>${r.requesterName}</td><td>${r.requesterCode}</td><td>${it.quantity}</td>
    </tr>`;
  });
}

// ── Pendentes de STC ─────────────────────────────────────────
function pending() {
  const pend = getData('rmtItems').filter(i => !i.linkedStc);
  document.getElementById('app').innerHTML = `
    <h2>Pendentes de STC</h2>
    <button id="expCsv" class="btn outline">
      <i class="bi bi-file-earmark-spreadsheet"></i> Exportar CSV
    </button>
    <div class="table-container">
      <table class="table">
        <thead><tr><th>Id. RM</th><th>Nome</th><th>Centro</th></tr></thead>
        <tbody>
          ${pend.map(i => `
            <tr><td>${i.idRm}</td><td>${i.itemName}</td><td>${i.requesterName}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  document.getElementById('expCsv').onclick = () => {
    const csv = ['Id. RM,Nome,Centro', ...pend.map(i =>
      `${i.idRm},"${i.itemName}",${i.requesterName}`
    )].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'pendentes.csv';
    a.click();
  };
}

// ── Settings / Perfil ────────────────────────────────────────
function settings() {
  const user = localStorage.getItem('authUser');
  const cfg = JSON.parse(localStorage.getItem('settings') || '{"emailNotif":false}');
  document.getElementById('app').innerHTML = `
    <h2>Configurações & Perfil</h2>
    <div class="card">
      <h3>Perfil</h3>
      <p>E-mail: <strong>${user}</strong></p>
      <button id="chgPass" class="btn outline">
        <i class="bi bi-key"></i> Mudar Senha
      </button>
    </div>
    <div class="card">
      <h3>App Settings</h3>
      <label>
        <input type="checkbox" id="emailNotif" ${cfg.emailNotif ? 'checked' : ''}/>
        Notificações por E-mail
      </label>
      <button id="saveCfg" class="btn"><i class="bi bi-save"></i> Salvar</button>
    </div>
  `;
  document.getElementById('saveCfg').onclick = () => {
    cfg.emailNotif = document.getElementById('emailNotif').checked;
    localStorage.setItem('settings', JSON.stringify(cfg));
    alert('Configurações salvas.');
  };
}

// ── CSV Download Utility ─────────────────────────────────────
function downloadCSV(objArray, filename) {
  const keys = Object.keys(objArray[0] || {});
  const csv = [
    keys.join(','),
    ...objArray.map(o =>
      keys.map(k => `"${String(o[k] ?? '').replace(/"/g, '""')}"`).join(',')
    )
  ].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
