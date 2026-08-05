import {
  buildCafeAliases,
  cafeMetadataCatalog,
  normalizeCafeText,
  type CafeMetadataEntry,
} from "../src/data/cafeMetadataCatalog.ts";

type CafeDoc = {
  id: string;
  name?: string;
  address?: string;
  website?: string;
  aliases?: string[];
  lat?: number;
  lng?: number;
  [key: string]: unknown;
};

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const shouldCreateMissing = args.has("--create-missing");
const shouldForceLocation = args.has("--force-location");
const shouldPrintCatalogOnly = args.has("--catalog-only");

let serverTimestampFactory: (() => unknown) | null = null;

function getProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "coffee-37b81"
  );
}

async function initializeFirebaseAdmin() {
  const adminApp = await import("firebase-admin/app");
  if (adminApp.getApps().length > 0) {
    return;
  }

  const projectId = getProjectId();
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccount) {
    adminApp.initializeApp({
      credential: adminApp.cert(JSON.parse(serviceAccount)),
      projectId,
    });
    return;
  }

  adminApp.initializeApp({
    credential: adminApp.applicationDefault(),
    projectId,
  });
}

function getWebsiteBrandKey(website?: string) {
  if (!website) {
    return "";
  }

  try {
    return new URL(website).hostname.replace(/^www\./, "").split(".")[0] || "";
  } catch {
    return "";
  }
}

function buildLookupKeys(entry: Pick<CafeMetadataEntry, "name" | "aliases" | "website" | "id">) {
  const keys = new Set<string>();
  keys.add(normalizeCafeText(entry.name));
  keys.add(normalizeCafeText(entry.id));
  (entry.aliases || []).forEach((alias) => keys.add(normalizeCafeText(alias)));

  const websiteKey = getWebsiteBrandKey(entry.website);
  if (websiteKey) {
    keys.add(normalizeCafeText(websiteKey));
  }

  return Array.from(keys).filter(Boolean);
}

function pickMetadataForDoc(doc: CafeDoc, catalog: CafeMetadataEntry[]) {
  const docKeys = new Set<string>();

  if (doc.id) {
    docKeys.add(normalizeCafeText(doc.id));
  }
  if (typeof doc.name === "string") {
    docKeys.add(normalizeCafeText(doc.name));
  }
  if (typeof doc.website === "string") {
    const websiteKey = getWebsiteBrandKey(doc.website);
    if (websiteKey) {
      docKeys.add(normalizeCafeText(websiteKey));
    }
  }
  if (Array.isArray(doc.aliases)) {
    doc.aliases.forEach((alias) => docKeys.add(normalizeCafeText(String(alias))));
  }

  let bestMatch: CafeMetadataEntry | null = null;
  let bestScore = 0;

  for (const entry of catalog) {
    const keys = buildLookupKeys(entry);
    let score = 0;
    for (const key of keys) {
      if (docKeys.has(key)) {
        score = Math.max(score, key.length + (key === normalizeCafeText(entry.name) ? 5 : 0));
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestScore >= 4 ? bestMatch : null;
}

function mergeAliases(existing: unknown, metadata: CafeMetadataEntry) {
  const seed = Array.isArray(existing) ? existing.map((alias) => String(alias)) : [];
  return Array.from(
    new Set([
      ...seed,
      ...buildCafeAliases(metadata.name, metadata.website, metadata.aliases),
    ])
  ).filter(Boolean);
}

function buildPatch(doc: CafeDoc, metadata: CafeMetadataEntry) {
  const patch: Record<string, unknown> = {};

  const mergedAliases = mergeAliases(doc.aliases, metadata);
  if (JSON.stringify(mergedAliases) !== JSON.stringify(doc.aliases || [])) {
    patch.aliases = mergedAliases;
  }

  if (!doc.website && metadata.website) {
    patch.website = metadata.website;
  }

  if (!doc.address && metadata.address) {
    patch.address = metadata.address;
  }

  const hasLat = Number.isFinite(Number(doc.lat));
  const hasLng = Number.isFinite(Number(doc.lng));
  if (metadata.lat && metadata.lng && (shouldForceLocation || !hasLat || !hasLng)) {
    patch.lat = metadata.lat;
    patch.lng = metadata.lng;
    if (metadata.address) {
      patch.address = metadata.address;
    }
  }

  if (Object.keys(patch).length > 0) {
    patch.metadataSource = "codex-cafe-metadata-catalog";
    patch.lastMetadataSyncAt = serverTimestampFactory ? serverTimestampFactory() : "SERVER_TIMESTAMP";
  }

  return patch;
}

function toCreatePayload(metadata: CafeMetadataEntry) {
  return {
    name: metadata.name,
    address: metadata.address || "",
    website: metadata.website || "",
    aliases: buildCafeAliases(metadata.name, metadata.website, metadata.aliases),
    ...(typeof metadata.lat === "number" ? { lat: metadata.lat } : {}),
    ...(typeof metadata.lng === "number" ? { lng: metadata.lng } : {}),
    metadataSource: "codex-cafe-metadata-catalog",
    createdAt: serverTimestampFactory ? serverTimestampFactory() : "SERVER_TIMESTAMP",
    lastUpdated: serverTimestampFactory ? serverTimestampFactory() : "SERVER_TIMESTAMP",
    lastMetadataSyncAt: serverTimestampFactory ? serverTimestampFactory() : "SERVER_TIMESTAMP",
  };
}

async function main() {
  if (shouldPrintCatalogOnly) {
    console.log(JSON.stringify(cafeMetadataCatalog, null, 2));
    return;
  }

  await initializeFirebaseAdmin();
  const adminFirestore = await import("firebase-admin/firestore");
  serverTimestampFactory = () => adminFirestore.FieldValue.serverTimestamp();
  const firestore = adminFirestore.getFirestore();
  const cafesRef = firestore.collection("cafes");
  const snapshot = await cafesRef.get();
  const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as CafeDoc) }));

  const updates: Array<{ id: string; name: string; patch: Record<string, unknown> }> = [];
  const matchedCatalogIds = new Set<string>();

  for (const doc of docs) {
    const metadata = pickMetadataForDoc(doc, cafeMetadataCatalog);
    if (!metadata) {
      continue;
    }

    matchedCatalogIds.add(metadata.id);
    const patch = buildPatch(doc, metadata);
    if (Object.keys(patch).length === 0) {
      continue;
    }

    updates.push({
      id: doc.id,
      name: typeof doc.name === "string" ? doc.name : metadata.name,
      patch,
    });
  }

  const missingMetadata = shouldCreateMissing
    ? cafeMetadataCatalog.filter((entry) => !matchedCatalogIds.has(entry.id))
    : [];

  console.log(`\nCafe metadata sync (${shouldWrite ? "WRITE" : "DRY-RUN"})`);
  console.log(`- Existing docs scanned: ${docs.length}`);
  console.log(`- Matching updates: ${updates.length}`);
  console.log(`- Missing catalog entries: ${missingMetadata.length}`);

  if (updates.length > 0) {
    console.log("\nPlanned updates:");
    updates.slice(0, 20).forEach((update) => {
      console.log(`- ${update.name} (${update.id})`);
      console.log(`  ${Object.keys(update.patch).join(", ")}`);
    });
  }

  if (missingMetadata.length > 0) {
    console.log("\nCatalog entries available to create:");
    missingMetadata.slice(0, 20).forEach((entry) => {
      console.log(`- ${entry.name} (${entry.id})`);
    });
  }

  if (!shouldWrite) {
    console.log("\nDry-run only. Use --write to apply changes.");
    return;
  }

  const batch = firestore.batch();

  for (const update of updates) {
    batch.set(cafesRef.doc(update.id), update.patch, { merge: true });
  }

  if (shouldCreateMissing) {
    for (const entry of missingMetadata) {
      batch.set(cafesRef.doc(entry.id), toCreatePayload(entry), { merge: true });
    }
  }

  await batch.commit();

  console.log("\nFirestore cafe metadata sync complete.");
  console.log(`- Updated docs: ${updates.length}`);
  console.log(`- Created docs: ${shouldCreateMissing ? missingMetadata.length : 0}`);
}

main().catch((error) => {
  console.error("\nCafe metadata sync failed.");
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);

  if (/default credentials/i.test(message)) {
    console.error("\nAuthentication help:");
    console.error("- Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path, or");
    console.error("- Set FIREBASE_SERVICE_ACCOUNT_KEY to the JSON contents of the service account.");
    console.error("- Then rerun `npm run cafes:metadata:plan` before `write`.");
  }

  process.exitCode = 1;
});
