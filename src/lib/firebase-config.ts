// Firebase Configuration for Real-time Chat
import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
}

let app: FirebaseApp
let db: Firestore
let storage: FirebaseStorage

if (typeof window !== 'undefined') {
  // Initialize Firebase only on client side
  if (!getApps().length) {
    app = initializeApp(firebaseConfig)
    console.log('🔥 Firebase initialized for real-time chat')
  } else {
    app = getApps()[0]
  }
  
  db = getFirestore(app)
  storage = getStorage(app)
  
  // Enable offline persistence
  // enableIndexedDbPersistence(db).catch((err) => {
  //   if (err.code === 'failed-precondition') {
  //     console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.')
  //   } else if (err.code === 'unimplemented') {
  //     console.warn('The current browser does not support persistence.')
  //   }
  // })
}

export { app, db, storage }
