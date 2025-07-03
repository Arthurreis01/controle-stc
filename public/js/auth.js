// js/auth.js
import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.6.1/firebase-auth.js';

// Monitor auth state
onAuthStateChanged(auth, user => {
  if (user) {
    // If on login page, redirect to app
    if (location.pathname.endsWith('login.html')) {
      window.location.href = 'index.html';
    }
  } else {
    // If not logged in, force login
    if (!location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
    }
  }
});

// Login function
export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert(err.message);
  }
}

// Logout
document.getElementById('btn-logout')?.addEventListener('click', () => {
  signOut(auth);
});
