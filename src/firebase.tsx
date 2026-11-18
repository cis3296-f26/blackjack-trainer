// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAsZKPvCHRfe41QjNM8ts20cT-K4ZYd3Q0",
  authDomain: "blackjack-trainer-3450d.firebaseapp.com",
  projectId: "blackjack-trainer-3450d",
  storageBucket: "blackjack-trainer-3450d.firebasestorage.app",
  messagingSenderId: "159578977250",
  appId: "1:159578977250:web:ff2cbfe5a3b92c98f47fbb",
  measurementId: "G-RQ1Y96SSZF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);