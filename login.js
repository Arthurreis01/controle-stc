// Simple offline auth
document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    // default demo user
    if ((email==='admin@example.com' && password==='password')) {
      localStorage.setItem('authUser', email);
      window.location = 'index.html';
    } else {
      alert('Credenciais inválidas. Use admin@example.com / password');
    }
  });
  