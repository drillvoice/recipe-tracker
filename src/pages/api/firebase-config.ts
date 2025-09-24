import type { NextApiRequest, NextApiResponse } from "next";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

type FirebaseConfigResponse = string;

function buildFirebaseConfig(): FirebaseConfig | null {
  const config: FirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? undefined,
  };

  const requiredKeys: Array<keyof FirebaseConfig> = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];

  const hasAllRequiredValues = requiredKeys.every((key) => Boolean(config[key]));

  if (!hasAllRequiredValues) {
    return null;
  }

  if (!config.measurementId) {
    delete config.measurementId;
  }

  return config;
}

function buildResponseScript(config: FirebaseConfig | null): FirebaseConfigResponse {
  if (!config) {
    return [
      "console.error('Firebase configuration is missing required values.');",
      "self.firebaseConfig = null;",
    ].join("\n");
  }

  const serializedConfig = JSON.stringify(config);
  return `self.firebaseConfig = ${serializedConfig};`;
}

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<FirebaseConfigResponse>,
): void {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const firebaseConfig = buildFirebaseConfig();
  const body = buildResponseScript(firebaseConfig);

  res.status(200).send(body);
}
