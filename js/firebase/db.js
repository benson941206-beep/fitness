import {
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { app } from "./app.js";

export const db = initializeFirestore(app, {
	localCache: persistentLocalCache({
		tabManager: persistentMultipleTabManager(),
	}),
});
