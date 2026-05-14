import admin from 'firebase-admin';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

admin.initializeApp({
  projectId: config.projectId
});

const db = admin.firestore();

async function run() {
  try {
    const snap = await db.collection('appointments').get();
    console.log(`Admin OK, docs: ${snap.size}`);
  } catch (e) {
    console.log("Admin failed:", e);
  }
}
run();
