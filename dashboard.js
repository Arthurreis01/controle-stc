// js/dashboard.js
import { db } from './firebase-config.js';
import {
  collection,
  query,
  where,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.6.1/firebase-firestore.js';

// Simple hash-based router
function loadView() {
  const hash = window.location.hash || '#dashboard';
  const main = document.getElementById('app');
  switch (hash) {
    case '#dashboard':
      renderDashboard(main);
      break;
    // TODO: add other cases: '#import', '#stc', '#rtc', '#settings'
    default:
      main.innerHTML = '<p>View not found.</p>';
  }
}

window.addEventListener('hashchange', loadView);
window.addEventListener('load', loadView);

// Render Dashboard view
async function renderDashboard(container) {
  container.innerHTML = `
    <h2>Dashboard</h2>
    <div id="kpis" class="card-container"></div>
  `;

  const kpis = document.getElementById('kpis');
  // Fetch counts from Firestore
  const rmtSnap = await getDocs(collection(db, 'rmtItems'));
  const stcSnap = await getDocs(query(collection(db, 'stcs'), where('status','==','PendingRTC')));
  const rtcSnap = await getDocs(query(collection(db, 'rtcs'), where('status','==','InTransit')));

  kpis.innerHTML = `
    <div class="card">RMT Imported:<br>${rmtSnap.size}</div>
    <div class="card">STC Pending:<br>${stcSnap.size}</div>
    <div class="card">RTC In Transit:<br>${rtcSnap.size}</div>
  `;
}
