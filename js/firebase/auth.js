import {
	browserLocalPersistence,
	inMemoryPersistence,
	GoogleAuthProvider,
	getAuth,
	getRedirectResult,
	onAuthStateChanged,
	setPersistence,
	signInWithPopup,
	signInWithRedirect,
	signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { app } from "./app.js";

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export {
	browserLocalPersistence,
	getRedirectResult,
	inMemoryPersistence,
	onAuthStateChanged,
	setPersistence,
	signInWithPopup,
	signInWithRedirect,
	signOut,
};
