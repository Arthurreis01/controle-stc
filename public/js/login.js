// js/login.js

// firebase.initializeApp(…) já foi chamado no HTML
const auth = firebase.auth();

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const role    = document.getElementById('roleSelect').value;
  const pass    = document.getElementById('password').value;
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';

  // Mapeamento perfil → email (crie esses usuários no Firebase Auth)
  const emailMap = {
    admin: 'admin@stc-rtc.firebaseapp.com',
    stc:   'stc@stc-rtc.firebaseapp.com',
    rtc:   'rtc@stc-rtc.firebaseapp.com'
  };
  const email = emailMap[role];
  if (!email) {
    errorEl.textContent = 'Selecione um perfil válido.';
    return;
  }

  try {
    // Tenta autenticar
    const { user } = await auth.signInWithEmailAndPassword(email, pass);

    // Opcional: verifique claims customizadas para reforçar o role
    // const idToken = await user.getIdTokenResult();
    // if (idToken.claims.role !== role) {
    //   throw new Error('Permissão insuficiente para este perfil.');
    // }

    // Grava no localStorage para suas pages de rota
    localStorage.setItem('authUser', user.email);
    localStorage.setItem('authRole', role);

    // Redireciona para a página principal
    window.location.href = 'index.html';
  } catch (err) {
    console.error(err);
    // Mostra mensagem de erro amigável
    errorEl.textContent = err.message.includes('password') 
      ? 'Senha incorreta.' 
      : err.message;
  }
});
