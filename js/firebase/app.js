import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

const firebaseConfig = {
	apiKey: "AIzaSyCRGuu8zRsuWBxXSZN-QwBhAsK5LKxEPAc",
	authDomain: "loquacious-selkie-62ab04.netlify.app",
	projectId: "fitness-tracker-b514c",
	storageBucket: "fitness-tracker-b514c.firebasestorage.app",
	messagingSenderId: "322630732471",
	appId: "1:322630732471:web:86d5c59bfc4287cffa9b32",
	measurementId: "G-NM5D39GZDY",
};

export const app = initializeApp(firebaseConfig);
