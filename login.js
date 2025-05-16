// js/login.js
document.addEventListener('DOMContentLoaded', () => {
  // 1) Preload the three profiles on first visit
  if (!localStorage.getItem('accounts')) {
    const initial = [
      { username: 'CSupAb',   password: 'admin123', role: 'admin' },
      { username: 'DepSIMRj', password: 'dep123',   role: 'stc'   },
      { username: 'CDAM',     password: 'cdam123',  role: 'rtc'   },
    ];
    localStorage.setItem('accounts', JSON.stringify(initial));
  }

  // 2) Grab form elements
  const form    = document.getElementById('loginForm');
  const roleSel = document.getElementById('roleSelect');
  const pwdInp  = document.getElementById('password');
  const err     = document.getElementById('error');

  // 3) Handle submit
  form.addEventListener('submit', e => {
    e.preventDefault();
    err.textContent = '';

    const username = roleSel.value;
    const password = pwdInp.value;
    const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
    const acct     = accounts.find(a => a.username === username);

    if (!acct) {
      err.textContent = 'Perfil inválido.';
      return;
    }
    if (acct.password !== password) {
      err.textContent = 'Senha incorreta.';
      return;
    }

    // 4) Success → store session & redirect to home
    localStorage.setItem('authUser', acct.username);
    localStorage.setItem('authRole', acct.role);

    // decide which hash to send them to
    let homeHash = '#dashboard';
    if (acct.role === 'stc') homeHash = '#stc';
    else if (acct.role === 'rtc') homeHash = '#rtc';

    window.location.href = `index.html${homeHash}`;
  });
});
