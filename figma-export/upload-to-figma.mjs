/**
 * SMC Viewer → Figma Export
 *
 * This script:
 * 1. Starts a local OAuth callback server on port 8788
 * 2. Opens the Figma OAuth authorization URL in your browser
 * 3. Exchanges the authorization code for an access token
 * 4. Creates a new Figma file and uploads each screenshot as an image-fill frame
 *
 * Usage:
 *   node upload-to-figma.mjs
 */

import http from "node:http";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

// ─── Config ────────────────────────────────────────────────────────────────
const CLIENT_ID = "LxwqvfOyzc3LEfMwmeFbbI";
const CLIENT_SECRET = "1Y28JUVxORGDb9wbstUzPYG0D1MI0e";
const REDIRECT_URI = "http://localhost:8788/callback";
const CALLBACK_PORT = 8788;

// Absolute paths to the screenshots
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = "/Users/m4/.gemini/antigravity/brain/c6542d0c-002f-4393-8a17-20aab3c3b8a6";

const SCREENS = [
  { name: "Home", file: "home_1771731462021.png", width: 1440, height: 900 },
  { name: "SMC Viewer – Chart", file: "smc_viewer_1771731470308.png", width: 1440, height: 900 },
  { name: "Engine 2 – Reference", file: "engine2_reference_1771731477554.png", width: 1440, height: 900 },
  { name: "Engine 2 – Diagnostics", file: "engine2_diagnostics_1771731484039.png", width: 1440, height: 900 },
  { name: "Engine 2 – Evaluate (Checklist)", file: "engine2_evaluate_1771731490672.png", width: 1440, height: 900 },
  { name: "Engine 2 – Tune", file: "engine2_tune_1771731497254.png", width: 1440, height: 900 },
];

// ─── Step 1: Start OAuth callback server ───────────────────────────────────
function waitForOAuthCode() {
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString("hex");

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<h2>Authorization failed: ${error}</h2><p>You can close this tab.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }
      if (!code || returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h2>Invalid callback</h2><p>State mismatch or missing code.</p>");
        server.close();
        reject(new Error("Invalid OAuth callback"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#1a1a2e;color:#e0e0e0">
          <h2 style="color:#4ade80">✅ Authorization successful!</h2>
          <p>You can close this tab. The export is running in your terminal.</p>
        </body></html>
      `);
      server.close();
      resolve({ code, state });
    });

    server.listen(CALLBACK_PORT, () => {
      const authUrl =
        `https://www.figma.com/oauth` +
        `?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=files:write` +
        `&state=${state}` +
        `&response_type=code`;

      console.log("\n🔐 Opening Figma OAuth authorization in your browser...");
      console.log(`   If your browser does not open, visit:\n   ${authUrl}\n`);

      // macOS: open URL in default browser
      try {
        execSync(`open "${authUrl}"`);
      } catch {
        // ignore — user will open manually
      }
    });

    server.on("error", reject);

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth timeout – no callback received within 5 minutes"));
    }, 5 * 60 * 1000);
  });
}

// ─── Step 2: Exchange code for access token ────────────────────────────────
async function exchangeCodeForToken(code) {
  console.log("\n🔄 Exchanging authorization code for access token...");

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    redirect_uri: REDIRECT_URI,
    code,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://www.figma.com/api/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  console.log("✅ Access token obtained.");
  return data.access_token;
}

// ─── Step 3: Upload image to Figma & get image hash ───────────────────────
async function uploadImageToFigma(token, fileKey, imagePath) {
  const imageBytes = readFileSync(imagePath);
  const base64 = imageBytes.toString("base64");

  // Figma Images API - POST /v1/images/:file_key
  const response = await fetch(`https://api.figma.com/v1/images/${fileKey}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageData: base64,
      mimeType: "image/png",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Image upload failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.hash; // The image hash to use as an image fill
}

// ─── Step 4: Create a new Figma file + frames ─────────────────────────────
async function createFigmaFile(token) {
  console.log("\n📄 Creating new Figma file: SMC Viewer Designs...");

  // We need to POST to /v1/files to create a new file in Drafts
  const response = await fetch("https://api.figma.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "SMC Viewer Designs",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`File creation failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  console.log(`✅ File created. File key: ${data.key}`);
  console.log(`   https://www.figma.com/file/${data.key}`);
  return data.key;
}

// ─── Step 5: Patch file with image frames ─────────────────────────────────
async function addFramesToFile(token, fileKey, frames) {
  // Build children array: one FRAME per screen, with an image-fill RECTANGLE inside
  const GAP = 120;
  const children = frames.map((f, i) => ({
    type: "FRAME",
    name: f.name,
    x: i * (f.width + GAP),
    y: 0,
    width: f.width,
    height: f.height,
    fills: [],
    children: [
      {
        type: "RECTANGLE",
        name: "Screenshot",
        x: 0,
        y: 0,
        width: f.width,
        height: f.height,
        fills: [
          {
            type: "IMAGE",
            scaleMode: "FILL",
            imageHash: f.imageHash,
          },
        ],
        strokes: [],
        effects: [],
        cornerRadius: 0,
      },
    ],
  }));

  const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nodes: children,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Add frames failed (${response.status}): ${text}`);
  }

  return response.json();
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  SMC Viewer → Figma Export");
  console.log("═══════════════════════════════════════════════════════════\n");

  // OAuth flow
  const { code } = await waitForOAuthCode();
  const token = await exchangeCodeForToken(code);

  // Create file
  const fileKey = await createFigmaFile(token);

  // Upload images
  console.log("\n🖼  Uploading screenshots to Figma...");
  const framesWithHashes = [];

  for (const screen of SCREENS) {
    const imagePath = resolve(SCREENSHOTS_DIR, screen.file);
    console.log(`   Uploading: ${screen.name}...`);
    const imageHash = await uploadImageToFigma(token, fileKey, imagePath);
    framesWithHashes.push({ ...screen, imageHash });
    console.log(`   ✅ ${screen.name} → hash: ${imageHash}`);
  }

  // Add frames to file
  console.log("\n🏗  Adding frames to Figma file...");
  await addFramesToFile(token, fileKey, framesWithHashes);

  console.log("\n✨ Done! Open your Figma file:");
  console.log(`   https://www.figma.com/file/${fileKey}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
