import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId);

async function run() {
  const collections = ['appointments', 'corretores', 'realtors', 'events'];
  for (const c of collections) {
    try {
      const snap = await getDocs(collection(db, c));
      console.log(`Collection ${c}: ${snap.size} docs`);
      if (snap.size > 0) {
        console.log(snap.docs[0].data());
      }
    } catch (e) {
      console.log(`Error reading ${c}:`, e.message);
    }
  }
}
run().catch(console.error);
