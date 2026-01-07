"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.db = exports.app = void 0;
// Firebase Configuration for Real-time Chat
const app_1 = require("firebase/app");
const firestore_1 = require("firebase/firestore");
const storage_1 = require("firebase/storage");
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};
let app;
let db;
let storage;
if (typeof window !== 'undefined') {
    // Initialize Firebase only on client side
    if (!(0, app_1.getApps)().length) {
        exports.app = app = (0, app_1.initializeApp)(firebaseConfig);
        console.log('🔥 Firebase initialized for real-time chat');
    }
    else {
        exports.app = app = (0, app_1.getApps)()[0];
    }
    exports.db = db = (0, firestore_1.getFirestore)(app);
    exports.storage = storage = (0, storage_1.getStorage)(app);
    // Enable offline persistence
    // enableIndexedDbPersistence(db).catch((err) => {
    //   if (err.code === 'failed-precondition') {
    //     console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.')
    //   } else if (err.code === 'unimplemented') {
    //     console.warn('The current browser does not support persistence.')
    //   }
    // })
}
