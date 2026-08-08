"use strict";

// ---------------------------------------------------------------------
// Stato globale
// ---------------------------------------------------------------------
let dirHandle = null;
let fileHandles = [];      // [{handle, name}], ordinati per nome
let currentIndex = 0;
let currentImgBitmap = null;
let naturalW = 0, naturalH = 0;
let scale = 1, offsetX = 0, offsetY = 0;
let areas = [];
let rectStart = null;
let excelRecords = null;
let tesseractWorker = null;
let exiv2 = null;

const CHARSET_UTF8 = new Uint8Array([0x1b, 0x25, 0x47]); // ESC % G -> IPTC CharacterSet = UTF-8

const canvas = document.getElementById("imgCanvas");
const ctx = canvas.getContext("2d");

function log(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent += msg + "\n";
  el.scrollTop = el.scrollHeight;
}

function setProgress(elId, pct) {
  document.getElementById(elId).style.width = pct + "%";
}

// ---------------------------------------------------------------------
// Init librerie (tutte locali, nessuna chiamata esterna)
// ---------------------------------------------------------------------
async function initEngines() {
  document.getElementById("engineStatus").textContent = "Inizializzazione OCR e libreria metadati...";

  exiv2 = await createExiv2Module();

  tesseractWorker = await Tesseract.createWorker("eng", 1, {
    workerPath: "vendor/tesseract/worker.min.js",
    corePath: "vendor/tesseract/tesseract-core-simd.wasm.js",
    langPath: "vendor/tessdata",
    gzip: true,
    logger: () => {},
  });
  await tesseractWorker.setParameters({
    tessedit_pageseg_mode: "6",
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  });

  document.getElementById("engineStatus").textContent = "Pronto.";
  document.getElementById("pickFolderBtn").disabled = false;
}

// ---------------------------------------------------------------------
// Selezione cartella (File System Access API - Chrome/Edge)
// ---------------------------------------------------------------------
document.getElementById("pickFolderBtn").addEventListener("click", async () => {
  if (!("showDirectoryPicker" in window)) {
    alert("Il browser non supporta l'accesso diretto alle cartelle. Usa Chrome o Edge su desktop.");
    return;
  }
  try {
    dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  } catch (e) {
    return; // utente ha annullato
  }
  fileHandles = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "file" && /\.(jpe?g|png)$/i.test(name)) {
      fileHandles.push({ handle, name });
    }
  }
  fileHandles.sort((a, b) => a.name.localeCompare(b.name));

  document.getElementById("folderStatus").textContent =
    `${fileHandles.length} immagini trovate in "${dirHandle.name}"`;

  if (fileHandles.length > 0) {
    currentIndex = 0;
    document.getElementById("areaPanel").style.display = "block";
    document.getElementById("step1Panel").style.display = "block";
    document.getElementById("step2Panel").style.display = "block";
    await loadCurrentImage();
  }
});

// ---------------------------------------------------------------------
// Canvas: caricamento e disegno area
// ---------------------------------------------------------------------
async function loadCurrentImage() {
  const { handle, name } = fileHandles[currentIndex];
  document.getElementById("navLabel").textContent = `${currentIndex + 1} / ${fileHandles.length} | ${name}`;
  const file = await handle.getFile();
  const bitmap = await createImageBitmap(file);
  currentImgBitmap = bitmap;
  naturalW = bitmap.width;
  naturalH = bitmap.height;
  drawCanvas();
}

function drawCanvas() {
  const cw = canvas.clientWidth || 700;
  const ch = canvas.clientHeight || 500;
  canvas.width = cw;
  canvas.height = ch;
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, cw, ch);
  if (!currentImgBitmap) return;

  scale = Math.min(cw / naturalW, ch / naturalH);
  const nw = naturalW * scale, nh = naturalH * scale;
  offsetX = (cw - nw) / 2;
  offsetY = (ch - nh) / 2;
  ctx.drawImage(currentImgBitmap, offsetX, offsetY, nw, nh);

  areas.forEach((a, i) => {
    const [x1, y1, x2, y2] = [a[0] * scale + offsetX, a[1] * scale + offsetY, a[2] * scale + offsetX, a[3] * scale + offsetY];
    ctx.strokeStyle = i === 0 ? "yellow" : "cyan";
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.fillStyle = i === 0 ? "yellow" : "cyan";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Area ${i + 1}`, x1 + 4, y1 + 14);
  });
}

function toImageCoords(cx, cy) {
  return [Math.max(0, Math.round((cx - offsetX) / scale)), Math.max(0, Math.round((cy - offsetY) / scale))];
}

function numAreasWanted() {
  return parseInt(document.getElementById("numAreas").value, 10);
}

function updateAreaStatus() {
  const wanted = numAreasWanted();
  const el = document.getElementById("areaStatus");
  el.textContent = `${areas.length}/${wanted} aree selezionate`;
  el.style.color = areas.length === wanted ? "#27ae60" : "#e67e22";
}

canvas.addEventListener("mousedown", (e) => {
  if (!currentImgBitmap) return;
  const wanted = numAreasWanted();
  if (areas.length >= wanted) areas = [];
  const rect = canvas.getBoundingClientRect();
  rectStart = [e.clientX - rect.left, e.clientY - rect.top];
});
canvas.addEventListener("mousemove", (e) => {
  if (!rectStart) return;
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
  drawCanvas();
  ctx.strokeStyle = "yellow";
  ctx.lineWidth = 2;
  ctx.strokeRect(rectStart[0], rectStart[1], cx - rectStart[0], cy - rectStart[1]);
});
canvas.addEventListener("mouseup", (e) => {
  if (!rectStart) return;
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
  const x1c = Math.min(rectStart[0], cx), y1c = Math.min(rectStart[1], cy);
  const x2c = Math.max(rectStart[0], cx), y2c = Math.max(rectStart[1], cy);
  rectStart = null;
  const [ix1, iy1] = toImageCoords(x1c, y1c);
  const [ix2, iy2] = toImageCoords(x2c, y2c);
  if (Math.abs(ix2 - ix1) < 3 || Math.abs(iy2 - iy1) < 3) { drawCanvas(); return; }
  areas.push([ix1, iy1, ix2, iy2]);
  drawCanvas();
  updateAreaStatus();
});

document.getElementById("resetAreasBtn").addEventListener("click", () => { areas = []; drawCanvas(); updateAreaStatus(); });
document.getElementById("numAreas").addEventListener("change", () => { areas = []; drawCanvas(); updateAreaStatus(); });
document.getElementById("prevBtn").addEventListener("click", async () => { if (currentIndex > 0) { currentIndex--; await loadCurrentImage(); } });
document.getElementById("nextBtn").addEventListener("click", async () => { if (currentIndex < fileHandles.length - 1) { currentIndex++; await loadCurrentImage(); } });
window.addEventListener("resize", () => drawCanvas());

// ---------------------------------------------------------------------
// OCR: crop + preprocessing + tesseract
// ---------------------------------------------------------------------
const AUTO_CORRECTIONS = [
  ["rn", "m"], ["cl", "d"], ["vv", "w"],
  ["lI", "H"], ["Il", "H"], ["ii", "N"], ["oo", "O"],
  ["VV", "W"], ["IJ", "U"], ["FI", "A"],
];

function autoCorrect(text) {
  return text.split(" ").map((word) => {
    let w = word;
    for (const [wrong, correct] of AUTO_CORRECTIONS) w = w.split(wrong).join(correct);
    return w;
  }).join(" ");
}

function cleanText(text) {
  return text.replace(/\|/g, "").split(/\s+/).filter(Boolean).join(" ");
}

function cropPreprocessed(bitmap, area, orientation) {
  const [x1, y1, x2, y2] = area;
  const w = x2 - x1, h = y2 - y1;
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const octx = off.getContext("2d");
  octx.drawImage(bitmap, x1, y1, w, h, 0, 0, w, h);

  // Preprocessing: scala di grigi + contrasto (approssima grayscale+ImageEnhance.Contrast di PIL)
  const imgData = octx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const contrastFactor = 2.0;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let v = (gray - 128) * contrastFactor + 128;
    v = Math.max(0, Math.min(255, v));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  octx.putImageData(imgData, 0, 0);

  // Orientamento
  let outCanvas = off;
  if (orientation === "orizzontale_dx_sx") {
    outCanvas = document.createElement("canvas");
    outCanvas.width = w; outCanvas.height = h;
    const oc = outCanvas.getContext("2d");
    oc.translate(w, 0); oc.scale(-1, 1);
    oc.drawImage(off, 0, 0);
  } else if (orientation === "verticale_alto_basso" || orientation === "verticale_basso_alto") {
    outCanvas = document.createElement("canvas");
    outCanvas.width = h; outCanvas.height = w;
    const oc = outCanvas.getContext("2d");
    if (orientation === "verticale_alto_basso") {
      oc.translate(h, 0); oc.rotate(Math.PI / 2);
    } else {
      oc.translate(0, w); oc.rotate(-Math.PI / 2);
    }
    oc.drawImage(off, 0, 0);
  }
  return outCanvas;
}

async function ocrArea(bitmap, area, orientation) {
  const canvasCrop = cropPreprocessed(bitmap, area, orientation);
  const { data } = await tesseractWorker.recognize(canvasCrop);
  return cleanText(autoCorrect(data.text));
}

// ---------------------------------------------------------------------
// Metadati (exiv2-wasm)
// ---------------------------------------------------------------------
async function writeStep1Metadata(u8, name, author, objectName) {
  u8 = exiv2.writeBytes(u8, "Iptc.Envelope.CharacterSet", CHARSET_UTF8);
  u8 = exiv2.writeString(u8, "Iptc.Application2.Caption", name);
  u8 = exiv2.writeString(u8, "Iptc.Application2.Writer", author);
  u8 = exiv2.writeString(u8, "Iptc.Application2.ObjectName", objectName);
  u8 = exiv2.writeString(u8, "Xmp.dc.description", name);
  return u8;
}

async function writeStep2Metadata(u8, description) {
  u8 = exiv2.writeBytes(u8, "Iptc.Envelope.CharacterSet", CHARSET_UTF8);
  u8 = exiv2.writeString(u8, "Iptc.Application2.Caption", description);
  u8 = exiv2.writeString(u8, "Xmp.dc.description", description);
  return u8;
}

async function readCaption(u8) {
  const meta = exiv2.read(u8);
  return (meta.iptc && meta.iptc["Iptc.Application2.Caption"]) || "";
}

async function writeFileBack(handle, u8) {
  const writable = await handle.createWritable();
  await writable.write(u8);
  await writable.close();
}

// ---------------------------------------------------------------------
// Step 1
// ---------------------------------------------------------------------
document.getElementById("runStep1Btn").addEventListener("click", async () => {
  const wanted = numAreasWanted();
  if (areas.length < wanted) { alert(`Seleziona ${wanted} area/e prima di procedere.`); return; }

  const orientation = document.getElementById("orientation").value;
  const author = document.getElementById("authorInput").value.trim() || "PAN";
  const objectNameOverride = document.getElementById("objectNameInput").value.trim();

  const btn = document.getElementById("runStep1Btn");
  btn.disabled = true;
  document.getElementById("step1Log").textContent = "";
  const total = fileHandles.length;

  let processed = 0, errors = 0;
  for (let i = 0; i < total; i++) {
    const { handle, name } = fileHandles[i];
    try {
      const file = await handle.getFile();
      const bitmap = await createImageBitmap(file);

      let ocrName;
      if (areas.length === 1) {
        ocrName = TextUtils.cleanSpecialChars(await ocrArea(bitmap, areas[0], orientation));
      } else {
        const t1 = await ocrArea(bitmap, areas[0], orientation);
        const t2 = await ocrArea(bitmap, areas[1], orientation);
        ocrName = TextUtils.cleanSpecialChars(`${t1} ${t2}`.trim());
      }
      const objName = objectNameOverride || ocrName;

      let u8 = new Uint8Array(await file.arrayBuffer());
      u8 = await writeStep1Metadata(u8, ocrName, author, objName);
      await writeFileBack(handle, u8);

      log("step1Log", `[${i + 1}/${total}] OK: ${name} -> ${ocrName}`);
      processed++;
    } catch (e) {
      log("step1Log", `[${i + 1}/${total}] ERRORE: ${name} | ${e.message || e}`);
      errors++;
    }
    setProgress("step1Progress", Math.round(((i + 1) / total) * 100));
  }
  log("step1Log", `COMPLETATO Step 1: ${processed}/${total} OK, ${errors} errori`);
  btn.disabled = false;
});

// ---------------------------------------------------------------------
// Excel + Step 2
// ---------------------------------------------------------------------
document.getElementById("excelInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  excelRecords = [];
  for (const row of rows) {
    const name = (row[0] !== undefined ? String(row[0]) : "").trim();
    if (!name || ["nan", "titolo", "nome"].includes(name.toLowerCase())) continue;
    const team = row[1] !== undefined ? String(row[1]).trim() : "";
    const stkn = row[2] !== undefined ? String(row[2]).trim() : "";
    let numero = row[3] !== undefined ? String(row[3]).trim() : "";
    const asInt = parseInt(parseFloat(numero), 10);
    if (!Number.isNaN(asInt) && String(asInt) === String(parseFloat(numero))) numero = String(asInt);
    excelRecords.push({ name, team, stkn, numero });
  }
  document.getElementById("excelStatus").textContent = `Excel caricato: ${excelRecords.length} righe`;
  document.getElementById("runStep2Btn").disabled = false;
});

document.getElementById("runStep2Btn").addEventListener("click", async () => {
  if (!excelRecords) return;
  const btn = document.getElementById("runStep2Btn");
  btn.disabled = true;
  document.getElementById("step2Log").textContent = "";
  const total = fileHandles.length;
  let processed = 0, noMatchList = [];

  for (let i = 0; i < total; i++) {
    const { handle, name } = fileHandles[i];
    try {
      const file = await handle.getFile();
      let u8 = new Uint8Array(await file.arrayBuffer());
      const current = await readCaption(u8);
      if (!current) {
        log("step2Log", `[${i + 1}/${total}] SKIP (nessun dato Step 1): ${name}`);
        setProgress("step2Progress", Math.round(((i + 1) / total) * 100));
        continue;
      }
      const { rec, ratio } = TextUtils.bestMatch(current, excelRecords, SeqMatch.ratio, 0.75);
      if (rec) {
        const nome = TextUtils.cleanSpecialChars(rec.name);
        const team = TextUtils.cleanSpecialChars(rec.team);
        const desc = `${nome} - ${team} ${rec.stkn} ${rec.numero}`;
        u8 = await writeStep2Metadata(u8, desc);
        await writeFileBack(handle, u8);
        log("step2Log", `[${i + 1}/${total}] OK: ${name} -> ${desc}`);
        processed++;
      } else {
        log("step2Log", `[${i + 1}/${total}] NO MATCH (${ratio.toFixed(2)}): ${name} | OCR: ${current}`);
        noMatchList.push(`${name} | OCR: ${current} | Score: ${ratio.toFixed(2)}`);
      }
    } catch (e) {
      log("step2Log", `[${i + 1}/${total}] ERRORE: ${name} | ${e.message || e}`);
    }
    setProgress("step2Progress", Math.round(((i + 1) / total) * 100));
  }
  log("step2Log", `COMPLETATO Step 2: ${processed}/${total} OK, ${noMatchList.length} da rivedere`);

  if (noMatchList.length > 0) {
    const blob = new Blob([noMatchList.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.getElementById("reportLink");
    a.href = url;
    a.download = "REPORT_NO_MATCH.txt";
    a.style.display = "inline-block";
  }
  btn.disabled = false;
});

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
initEngines();
