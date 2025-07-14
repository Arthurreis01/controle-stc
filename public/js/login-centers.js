// js/login-centers.js

// ── Firebase Auth (apenas para admin) ───────────────────────────
const auth = firebase.auth();

// ── Senhas dos Centros ──────────────────────────────────────────
const centerPw = {
  '7330': 'ceimma2025',  // CEIMMA
  '7220': 'ceimbe2025',  // CEIMBE
  '0960': 'ceimsa2025',  // CEIMSA
  '6830': 'ceimna2025',  // CEIMNA
  '8510': 'ceimrg2025',  // CEIMRG
  '7910': 'ceimla2025'   // CEIMLA
};

// ── DOM Refs ─────────────────────────────────────────────────────
const form       = document.getElementById('loginForm');
const roleSelect = document.getElementById('roleSelect');
const pwdInput   = document.getElementById('password');
const errorEl    = document.getElementById('error');

// ── Form Submit ──────────────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  errorEl.textContent = '';

  const role = roleSelect.value;
  const pwd  = pwdInput.value;

  if (!role) {
    return errorEl.textContent = 'Selecione um perfil.';
  }
  if (!pwd) {
    return errorEl.textContent = 'Informe a senha.';
  }

  // —— 1) Administrador (Firebase Auth) ——
  if (role === 'admin') {
    const email = 'admin@stc-rtc.firebaseapp.com';
    try {
      const { user } = await auth.signInWithEmailAndPassword(email, pwd);
      localStorage.setItem('authUser', user.email);
      localStorage.setItem('authRole', 'admin');
      window.location.href = 'dashboard.html';
    } catch (err) {
      errorEl.textContent = err.message.includes('password')
        ? 'Senha incorreta.'
        : err.message;
    }
    return;
  }

  // —— 2) Centro — verifica senha na tabela centerPw ——
  const correct = centerPw[role];
  if (!correct) {
    return errorEl.textContent = 'Perfil de centro inválido.';
  }
  if (pwd !== correct) {
    return errorEl.textContent = 'Senha incorreta para este centro.';
  }

  // login bem-sucedido
  localStorage.setItem('authUser', role);
  localStorage.setItem('authRole', 'center');
  window.location.href = `inventory.html?center=${role}`;
});
