const fs = require("fs");
const path = require("path");

const requiredKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
};

const missingKeys = requiredKeys.filter((key) => !process.env[key]);

const lines = [];

if (missingKeys.length > 0) {
  lines.push(
    "console.error('Firebase configuration is missing required values: %s', '" +
      missingKeys.join(", ") +
      "');",
    "self.firebaseConfig = null;",
  );
} else {
  if (!config.measurementId) {
    delete config.measurementId;
  }

  lines.push(`self.firebaseConfig = ${JSON.stringify(config)};`);
}

const outputDir = path.join(__dirname, "..", "out", "api");
fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, "firebase-config");
fs.writeFileSync(outputPath, lines.join("\n"), "utf8");

console.log(`Firebase config script written to ${outputPath}`);
