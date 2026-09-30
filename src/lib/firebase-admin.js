import admin from "firebase-admin";
import fs from "fs";
import path from "path";

function localKeyFile() {
  const name = fs.readdirSync(process.cwd()).find((f) => /firebase-adminsdk.*\.json$/.test(f));
  return name ? path.join(process.cwd(), name) : null;
}

if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    // Vercel: full service account JSON encoded as base64
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf8");
    credential = admin.credential.cert(JSON.parse(decoded));
  } else if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY && localKeyFile()) {
    // Local: a downloaded service account key dropped into the project folder
    credential = admin.credential.cert(JSON.parse(fs.readFileSync(localKeyFile(), "utf8")));
  } else {
    // Local: individual env vars from .env.local
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    });
  }

  admin.initializeApp({ credential });
}

export default admin;
