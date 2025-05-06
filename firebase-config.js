// js/firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.6.1/firebase-app.js';
import { getAuth }      from 'https://www.gstatic.com/firebasejs/10.6.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.6.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "<YOUR_API_KEY>",
  authDomain: "<YOUR_AUTH_DOMAIN>",
  projectId: "<YOUR_PROJECT_ID>",
  storageBucket: "<YOUR_STORAGE_BUCKET>",
  messagingSenderId: "<YOUR_MSG_ID>",
  appId: "<YOUR_APP_ID>"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
