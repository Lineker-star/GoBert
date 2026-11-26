// Generates optimized brand assets for the GoBert web app from /images.
// usage (from repo root): node apps/web/scripts/brand-assets.cjs .
const path = require("path");
const root = process.argv[2];
const sharp = require(path.join(root, "apps/web/node_modules/.pnpm/sharp@0.33.5/node_modules/sharp"));
const IMG = (f) => path.join(root, "images", f);
const OUT = path.join(root, "apps/web/public/brand");
const PUB = path.join(root, "apps/web/public");
require("fs").mkdirSync(OUT, { recursive: true });

// White -> alpha (GIMP "color to alpha" for white).
async function whiteToAlpha(input, extract) {
  let img = sharp(input);
  if (extract) img = img.extract(extract);
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let a = Math.max(255 - r, 255 - g, 255 - b) / 255;
    if (a < 0.04) a = 0;
    if (a > 0) {
      out[j] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - a)) / a)));
      out[j + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - a)) / a)));
      out[j + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - a)) / a)));
    }
    out[j + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

async function main() {
  const logo = IMG("GoBert LOGO.png");
  // Full logo (mark + wordmark + tagline), transparent
  const full = await whiteToAlpha(logo, { left: 40, top: 160, width: 1710, height: 540 });
  await full.clone().resize({ width: 640 }).png({ compressionLevel: 9, palette: true }).toFile(path.join(OUT, "logo-full.png"));
  // Mark only
  const markBuf = await (await whiteToAlpha(logo, { left: 45, top: 170, width: 560, height: 510 })).toBuffer();
  await sharp(markBuf).trim().resize({ width: 256, height: 256, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 }).toFile(path.join(OUT, "logo-mark.png"));
  // White silhouette of full logo (for dark backgrounds)
  const fullRaw = await full.clone().resize({ width: 640 }).raw().toBuffer({ resolveWithObject: true });
  const w = Buffer.from(fullRaw.data);
  for (let j = 0; j < w.length; j += 4) { w[j] = 255; w[j + 1] = 255; w[j + 2] = 255; }
  await sharp(w, { raw: { width: fullRaw.info.width, height: fullRaw.info.height, channels: 4 } })
    .png({ compressionLevel: 9 }).toFile(path.join(OUT, "logo-full-white.png"));

  // App icons: mark on white rounded tile
  const markPng = await sharp(markBuf).trim().toBuffer();
  for (const [size, pad, name] of [[192, 0.14, "icon-192.png"], [512, 0.14, "icon-512.png"], [512, 0.24, "icon-maskable.png"], [180, 0.14, "apple-touch-icon.png"]]) {
    const inner = Math.round(size * (1 - pad * 2));
    const m = await sharp(markPng).resize({ width: inner, height: inner, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{ input: m, gravity: "center" }]).png({ compressionLevel: 9 }).toFile(path.join(PUB, name));
  }
  await sharp(markPng).resize(48, 48, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toFile(path.join(PUB, "favicon-48.png"));

  // Photos
  await sharp(IMG("648ef461-9a6d-4108-83c1-513ae5550171.png")).extract({ left: 0, top: 272, width: 1672, height: 512 })
    .resize({ width: 1400 }).webp({ quality: 68 }).toFile(path.join(OUT, "hero-scene.webp"));
  await sharp(IMG("648ef461-9a6d-4108-83c1-513ae5550171.png")).resize({ width: 1280 }).webp({ quality: 70 }).toFile(path.join(OUT, "poster-bertoua.webp"));
  await sharp(IMG("750319f9-b0e4-4dd7-b8ad-e121b39305f3.png")).extract({ left: 902, top: 575, width: 628, height: 355 })
    .resize({ width: 900, withoutEnlargement: true }).webp({ quality: 72 }).toFile(path.join(OUT, "driver.webp"));
  await sharp(IMG("750319f9-b0e4-4dd7-b8ad-e121b39305f3.png")).extract({ left: 690, top: 568, width: 225, height: 365 })
    .resize({ width: 300, withoutEnlargement: true }).webp({ quality: 75 }).toFile(path.join(OUT, "app-phone.webp"));
  await sharp(IMG("AAA-Zemidjan-benin-1536x1138-1.jpg")).resize({ width: 1000 }).webp({ quality: 62 }).toFile(path.join(OUT, "moto-traffic.webp"));
  await sharp(IMG("images.jpg")).webp({ quality: 70 }).toFile(path.join(OUT, "moto-rider.webp"));
  await sharp(IMG("pexels-photo-36875810.avif")).webp({ quality: 72 }).toFile(path.join(OUT, "riders-group.webp"));
  // OG image
  await sharp(IMG("648ef461-9a6d-4108-83c1-513ae5550171.png")).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 72, mozjpeg: true }).toFile(path.join(PUB, "og-image.jpg"));
}
main().then(() => console.log("done")).catch((e) => { console.error(e); process.exit(1); });
