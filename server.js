require('dotenv').config(); // charge .env automatiquement au démarrage
const express      = require('express');
const XLSX         = require('xlsx');
const path         = require('path');
const fs           = require('fs');
const { Blob }     = require('buffer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── Client Gemini (Smart Import) ─────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const genai  = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const gemini = genai ? genai.getGenerativeModel({ model: 'gemini-1.5-flash' }) : null;
if (GEMINI_API_KEY) {
  console.log('\n🧠  Gemini 2.0 Flash activé — import intelligent image/PDF disponible\n');
}

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('\n⚠️  Module "sharp" introuvable — traitement des visuels désactivé.\n   Exécutez "npm install" et redémarrez.\n');
  sharp = null;
}

// ─── Moteur IA suppression de fond ────────────────────────────────────────────
let aiRemoveBg = null;
let aiReady    = false;
let aiError    = null;

// BRIA RMBG-2.0 — modèle spécialisé produits e-commerce (HuggingFace, gratuit)
// Bien supérieur à @imgly sur les emballages alimentaires (barquettes, films, brillants)
const HF_TOKEN = process.env.HF_TOKEN || null;

async function removeBgBRIA(imageBuffer) {
  if (!HF_TOKEN) throw new Error('HF_TOKEN non configuré');
  // BRIA attend le PNG brut, retourne PNG avec canal alpha
  const pngBuffer = await sharp(imageBuffer).png().toBuffer();
  const resp = await fetch('https://api-inference.huggingface.co/models/briaai/RMBG-2.0', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/octet-stream',
      'Accept': 'image/png',
    },
    body: pngBuffer,
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`BRIA API ${resp.status}: ${err.slice(0, 200)}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

(async () => {
  // Tenter BRIA d'abord (si token configuré)
  if (HF_TOKEN) {
    console.log('\n🔑  HF_TOKEN détecté — BRIA RMBG-2.0 activé (suppression fond de précision)\n');
  }
  // Charger @imgly en fallback local
  try {
    const mod  = await import('@imgly/background-removal-node');
    aiRemoveBg = mod.removeBackground;
    aiReady    = true;
    console.log(HF_TOKEN
      ? '🤖  Moteur @imgly chargé (fallback si BRIA indisponible)\n'
      : '\n🤖  Moteur IA background-removal chargé\n'
    );
  } catch (e) {
    aiError = e.message;
    console.warn('\n⚠️  Moteur IA @imgly non disponible — mode algo classique actif.\n   (' + e.message + ')\n');
  }
})();

// ─── Dossier fonds de scène ───────────────────────────────────────────────────
const TEMPLATES_DIR = path.join(__dirname, 'templates');
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });

const app  = express();
const PORT = process.env.PORT || 3003;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── Protection par mot de passe ─────────────────────────────────────────────
const APP_PASSWORD = process.env.APP_PASSWORD || 'carrefour2024';

app.get('/login', (req, res) => {
  const error = req.query.error ? '<p style="color:red;margin:0 0 12px">Mot de passe incorrect</p>' : '';
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Connexion — Fiche Light PFT</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:sans-serif;background:#f4f4f4;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .box{background:#fff;padding:40px;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,.1);width:340px;text-align:center}
    h2{margin-bottom:24px;color:#1a1a2e;font-size:1.3rem}
    input{width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:6px;font-size:1rem;margin-bottom:16px}
    button{width:100%;padding:11px;background:#0066cc;color:#fff;border:none;border-radius:6px;font-size:1rem;cursor:pointer}
    button:hover{background:#0052a3}
  </style></head><body>
  <div class="box">
    <h2>🔒 Fiche Light PFT</h2>
    ${error}
    <form method="POST" action="/login">
      <input type="password" name="password" placeholder="Mot de passe" autofocus>
      <button type="submit">Accéder</button>
    </form>
  </div></body></html>`);
});

app.post('/login', (req, res) => {
  if (req.body.password === APP_PASSWORD) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `pft_auth=${encodeURIComponent(APP_PASSWORD)}; Path=/; HttpOnly; Max-Age=86400${secure}`);
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

function parseCookies(header) {
  const cookies = {};
  (header || '').split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try { cookies[key] = decodeURIComponent(val); } catch { cookies[key] = val; }
  });
  return cookies;
}

function authMiddleware(req, res, next) {
  if (req.path === '/login') return next();
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.pft_auth === APP_PASSWORD) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Non autorisé' });
  res.redirect('/login');
}

app.use(authMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// ─── Constantes ───────────────────────────────────────────────────────────────

const SERVICE_CONSOMMATEUR =
  'Service Consommateurs Carrefour\nTSA 91431 - 91343 MASSY Cedex\nN° CRISTAL : 09 69 7000 - Appel non surtaxé';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function removeAccents(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function capitalizeLibelle(str) {
  if (!str) return '';
  const liaisons = new Set([
    'de','du','des','le','la','les','et','en','au','aux',
    'à','un','une','sur','sous','par','pour','avec','sans',
  ]);
  return str.trim().split(/\s+/).map((word, i) => {
    const lw = word.toLowerCase();
    return (i === 0 || !liaisons.has(lw))
      ? lw.charAt(0).toUpperCase() + lw.slice(1)
      : lw;
  }).join(' ');
}

function buildLibelle(p) {
  const parts = [];
  if (p.natureBrute) parts.push(capitalizeLibelle(p.natureBrute));
  if (p.attribut)    parts.push(capitalizeLibelle(p.attribut));
  if (p.marque)      parts.push(removeAccents(String(p.marque).toUpperCase()));
  return parts.join(' ');
}

// ─── Constructeur de ligne export ─────────────────────────────────────────────

function buildRow(p) {
  const al = p.allergens || {};

  const row = {
    // ── Identification ──────────────────────────────────────────────────────
    'EAN':                              String(p.ean || '').trim(),
    'Libellé client (fr_FR)':           buildLibelle(p),
    'Nature brute':                     p.natureBrute  || '',
    'Attribut':                         p.attribut     || '',
    'Marque produit':                   p.marque ? removeAccents(String(p.marque).toUpperCase()) : '',
    'Conditionnement':                  p.conditionnement || '',
    'Service consommateur':             SERVICE_CONSOMMATEUR,
    // ── Allergènes (14 colonnes TRUE/FALSE) ─────────────────────────────────
    'Gluten':                           al.gluten       ? 'TRUE' : 'FALSE',
    'Lactose':                          al.lait         ? 'TRUE' : 'FALSE',
    'Soja':                             al.soja         ? 'TRUE' : 'FALSE',
    'Arachides':                        al.arachides    ? 'TRUE' : 'FALSE',
    'Céleri':                           al.celeri       ? 'TRUE' : 'FALSE',
    'Oeufs':                            al.oeufs        ? 'TRUE' : 'FALSE',
    'Crustacés':                        al.crustaces    ? 'TRUE' : 'FALSE',
    'Poisson':                          al.poisson      ? 'TRUE' : 'FALSE',
    'Fruits à coque':                   al.fruitsACoque ? 'TRUE' : 'FALSE',
    'Moutarde':                         al.moutarde     ? 'TRUE' : 'FALSE',
    'Sésame':                           al.sesame       ? 'TRUE' : 'FALSE',
    'Sulfites':                         al.sulfites     ? 'TRUE' : 'FALSE',
    'Lupin':                            al.lupin        ? 'TRUE' : 'FALSE',
    'Mollusques':                       al.mollusques   ? 'TRUE' : 'FALSE',
    // ── Flags ────────────────────────────────────────────────────────────────
    'Flag INCO':                        'TRUE',
    'Flag Bio':                         p.flagBio ? 'TRUE' : 'FALSE',
    'Flag FQC':                         p.flagFQC ? 'TRUE' : 'FALSE',
    'Filière Qualité Carrefour':        p.flagFQC ? 'TRUE' : 'FALSE',
    'Exposant':                         'pour 100g',
    // ── Valeurs nutritionnelles ──────────────────────────────────────────────
    'Valeur énergétique (fr_FR)':       p.valeursEnergetiques || '',
    'Matières grasses (fr_FR)':         p.graisses            || '',
    'dont acides gras saturés (fr_FR)': p.grasSatures         || '',
    'Glucides (fr_FR)':                 p.glucides            || '',
    'dont sucres (fr_FR)':              p.sucres              || '',
    'Protéines (fr_FR)':                p.proteines           || '',
    'Sel':                              p.sel                 || '',
    // ── Données commerciales ─────────────────────────────────────────────────
    'Info bandeau':                     p.infoBandeau     || '',
    'Palier de commande':               p.palierCommande  || '',
    'Fourchette prép ± en Gramme':      '0',
  };

  // Colonnes rayon-spécifiques (ajoutées si renseignées)
  if (p.ingredients)         row['Ingrédients']             = p.ingredients;
  if (p.allergenes)          row['Présence allergènes']     = p.allergenes ? 'TRUE' : 'FALSE';
  if (p.conservation)        row['Conservation']            = p.conservation;
  if (p.nomLatin)            row['Nom latin']               = p.nomLatin;
  if (p.facettePecheElevage) row['Facette Pêche/Élevage']   = p.facettePecheElevage;
  if (p.categorie)           row['Catégorie']               = p.categorie;
  if (p.rayon === 'R24') {
    row['Viande Bovine Française'] = p.viandeBovine ? 'TRUE' : 'FALSE';
    row['Porc Français']           = p.porcFrancais ? 'TRUE' : 'FALSE';
  }

  return row;
}

// ─── Formatage Excel ──────────────────────────────────────────────────────────

function forceTextColumns(ws, rows, colNames) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  colNames.forEach(colName => {
    const ci = headers.indexOf(colName);
    if (ci === -1) return;
    rows.forEach((row, ri) => {
      const v = row[colName];
      if (!v && v !== 0) return;
      const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      if (ws[ref]) { ws[ref].t = 's'; ws[ref].v = String(v); delete ws[ref].z; }
    });
  });
}

function setColumnWidths(ws, rows) {
  if (!rows || !rows.length) return;
  ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 4, 16) }));
}

// ─── Route : Import fichier ───────────────────────────────────────────────────

app.post('/api/import', (req, res) => {
  const { fileBase64 } = req.body;
  if (!fileBase64) return res.status(400).json({ error: 'Fichier manquant' });

  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const wb     = XLSX.read(buffer, { type: 'buffer', cellText: true });
    const ws     = wb.Sheets[wb.SheetNames[0]];
    const rows   = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ error: 'Le fichier est vide' });
    }

    res.json({
      headers:   Object.keys(rows[0]),
      preview:   rows.slice(0, 3),
      totalRows: rows.length,
      rows,
    });
  } catch (err) {
    res.status(400).json({ error: 'Fichier invalide : ' + err.message });
  }
});

// ─── Prompt extraction Claude Vision ─────────────────────────────────────────
const SMART_IMPORT_PROMPT = `Tu es un expert en référencement produit Carrefour, spécialisé rayons frais (R20-R24).
Analyse ce document (étiquette produit, capture SAP, photo, PDF fournisseur) et extrais les données en JSON strict.

Retourne UNIQUEMENT un objet JSON valide, sans texte autour, sans markdown.
Pour chaque champ absent ou incertain, retourne null — ne devine JAMAIS.

{
  "ean": "code EAN 8 ou 13 chiffres uniquement, ou null",
  "natureBrute": "nom principal du produit, ex: Saumon, Baguette, Camembert, Steak haché",
  "attribut": "spécificité complémentaire, ex: Atlantique, de Normandie, Tradition, Façon Bouchère",
  "marque": "marque en MAJUSCULES sans accents, ex: CARREFOUR, MAISON MONTFORT, ou null",
  "rayon": "déduire depuis le produit: R20=Charcuterie/Fromage/Traiteur, R21=Poissonnerie, R22=Fruits&Légumes, R23=Boulangerie/Pâtisserie, R24=Boucherie, ou null",
  "conditionnement": "construire intelligemment depuis le contexte, ex: 'la barquette de 200g', 'la pièce', 'le kilo', ou null",
  "infoBandeau": "extraire uniquement le poids/quantité, ex: '200g', '1kg', 'la pièce', ou null",
  "palierCommande": "poids en kg avec exactement 3 décimales, ex: '0.200', '1.500', ou null si non pertinent",
  "flagBio": true ou false,
  "flagFQC": true ou false,
  "conservation": "ex: 'A conserver entre +0°C et +4°C', 'A conserver à température ambiante', ou null",
  "ingredients": "liste complète des ingrédients si visible, sinon null",
  "valeursEnergetiques": "ex: '250 kcal / 1045 kJ', ou null",
  "graisses": "ex: '12g', ou null",
  "grasSatures": "ex: '4g', ou null",
  "glucides": "ex: '30g', ou null",
  "sucres": "ex: '5g', ou null",
  "proteines": "ex: '8g', ou null",
  "sel": "ex: '1.2g', ou null",
  "allergens": {
    "gluten": false, "lait": false, "soja": false, "arachides": false,
    "celeri": false, "oeufs": false, "crustaces": false, "poisson": false,
    "fruitsACoque": false, "moutarde": false, "sesame": false,
    "sulfites": false, "lupin": false, "mollusques": false
  },
  "nomLatin": "nom scientifique si poisson/crustacé visible, ex: 'Salmo salar', ou null",
  "facettePecheElevage": "'pêché' ou 'élevé' si visible, ou null",
  "categorie": "'1' ou '2' si fruits/légumes avec catégorie visible, ou null",
  "viandeBovine": true ou false,
  "porcFrancais": true ou false,
  "confidence": {
    "overall": "high/medium/low — qualité globale de l'extraction",
    "ean": "high/medium/low",
    "natureBrute": "high/medium/low",
    "conditionnement": "high/medium/low",
    "ingredients": "high/medium/low",
    "allergens": "high/medium/low"
  }
}

Règles métier Carrefour obligatoires:
- palierCommande: toujours 3 décimales. 200g → "0.200", 1.5kg → "1.500", kilo → null (prix au kg)
- conditionnement: construire depuis le contexte produit. "barquette 4 tranches 200g" → "la barquette de 4 tranches - 200g"
- marque: MAJUSCULES, supprimer tous les accents. "Île de France" → "ILE DE FRANCE"
- allergens: détecter depuis les ingrédients (mots en MAJUSCULES = allergènes en convention Carrefour)
- rayon: déduire depuis la nature. Poisson → R21, Viande rouge → R24, Charcuterie/Fromage → R20, Pain/Viennoiserie → R23, Légumes/Fruits → R22
- flagBio: true si "bio", "biologique", "AB" ou logo AB visible
- flagFQC: true si "Filière Qualité Carrefour" ou "FQC" visible`;

// ─── Route : Statut Smart Import ──────────────────────────────────────────────
app.get('/api/smart-import-status', (_req, res) => {
  res.json({ available: !!gemini, configured: !!GEMINI_API_KEY });
});

// ─── Route : Smart Import (image + PDF → Gemini Vision) ──────────────────────
app.post('/api/smart-import', async (req, res) => {
  if (!gemini) {
    return res.status(503).json({
      error: 'Clé API Gemini non configurée.',
      hint: 'Ajoutez GEMINI_API_KEY=... dans vos variables d\'environnement et redémarrez. Clé gratuite sur aistudio.google.com'
    });
  }

  const { fileBase64, mimeType } = req.body;
  if (!fileBase64 || !mimeType) return res.status(400).json({ error: 'Fichier ou type MIME manquant' });

  const SUPPORTED_IMAGES = ['image/jpeg','image/png','image/webp','image/gif'];
  const isPDF   = mimeType === 'application/pdf';
  const isImage = SUPPORTED_IMAGES.includes(mimeType);
  if (!isPDF && !isImage) {
    return res.status(400).json({ error: `Format non supporté : ${mimeType}. Acceptés : JPG, PNG, WEBP, PDF` });
  }

  try {
    const result = await gemini.generateContent([
      { inlineData: { data: fileBase64, mimeType } },
      SMART_IMPORT_PROMPT,
    ]);

    const raw = result.response.text().trim();

    // Extraire le JSON même si Gemini ajoute du texte autour
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Réponse IA non parsable — réessayez ou vérifiez le fichier');

    const data = JSON.parse(jsonMatch[0]);

    const fields = ['ean','natureBrute','attribut','marque','conditionnement','infoBandeau',
                    'palierCommande','conservation','ingredients','valeursEnergetiques'];
    const filled = fields.filter(f => data[f] != null).length;

    const usage = result.response.usageMetadata || {};
    res.json({
      extracted:   data,
      filledCount: filled,
      totalFields: fields.length,
      tokens:      (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0),
    });

  } catch (err) {
    console.error('Smart import error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Route : Export Excel ─────────────────────────────────────────────────────

app.post('/api/export', (req, res) => {
  const { products } = req.body;
  if (!products || !products.length) {
    return res.status(400).json({ error: 'Aucun produit à exporter' });
  }

  try {
    const wb   = XLSX.utils.book_new();
    const rows = products.map(buildRow);
    const ws   = XLSX.utils.json_to_sheet(rows);

    forceTextColumns(ws, rows, ['EAN', 'Palier de commande', 'Fourchette prép ± en Gramme']);
    setColumnWidths(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Fiches Light PFT');

    const buffer   = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `fiche-light-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération : ' + err.message });
  }
});

// ─── Helpers traitement image (3 passes) ─────────────────────────────────────

// Échantillonne la couleur de fond depuis les 4 coins + bords
function sampleBgColor(data, w, h) {
  const size = Math.min(25, Math.floor(Math.min(w, h) / 12));
  const regions = [
    [0, 0], [w - size, 0], [0, h - size], [w - size, h - size],
    [Math.floor(w / 2) - size / 2, 0],
    [Math.floor(w / 2) - size / 2, h - size],
    [0, Math.floor(h / 2) - size / 2],
    [w - size, Math.floor(h / 2) - size / 2],
  ];
  const samples = [];
  for (const [ox, oy] of regions) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = Math.max(0, oy); y < Math.min(oy + size, h); y++)
      for (let x = Math.max(0, ox); x < Math.min(ox + size, w); x++) {
        const i = (y * w + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
    if (n > 0) samples.push({ r: r / n, g: g / n, b: b / n });
  }
  if (!samples.length) return null;
  // Garder les échantillons cohérents entre eux (même couleur)
  const ref = samples[0];
  const ok  = samples.filter(s => Math.sqrt((s.r-ref.r)**2+(s.g-ref.g)**2+(s.b-ref.b)**2) < 70);
  if (ok.length < 4) return null; // fond trop hétérogène
  const avg = ok.reduce((a, s) => ({ r: a.r + s.r, g: a.g + s.g, b: a.b + s.b }), { r:0,g:0,b:0 });
  return { r: Math.round(avg.r/ok.length), g: Math.round(avg.g/ok.length), b: Math.round(avg.b/ok.length) };
}

// PASSE 1 — Flood fill depuis tous les bords (supprime le fond connexe)
function floodFill(data, w, h, bg, tol) {
  const tolSq   = tol * tol;
  const visited = new Uint8Array(w * h);
  const queue   = new Uint32Array(w * h);
  let head = 0, tail = 0;
  const { r:br, g:bg2, b:bb } = bg;

  const push = (idx) => { if (!visited[idx]) { visited[idx] = 1; queue[tail++] = idx; } };

  // Graines : tous les pixels sur les 4 bords
  for (let x = 0; x < w; x++) { push(x); push((h-1)*w + x); }
  for (let y = 0; y < h; y++) { push(y*w); push(y*w + w-1); }

  while (head < tail) {
    const idx = queue[head++];
    const pi  = idx * 4;
    const dr  = data[pi]-br, dg = data[pi+1]-bg2, db = data[pi+2]-bb;
    if (dr*dr + dg*dg + db*db > tolSq) continue;
    data[pi+3] = 0;
    const px = idx % w, py = (idx - px) / w;
    if (px > 0)   push(idx-1);
    if (px < w-1) push(idx+1);
    if (py > 0)   push(idx-w);
    if (py < h-1) push(idx+w);
  }
}

// PASSE 2 — Étend la transparence aux halos/ombres légères (pixels quasi-blancs adjacents)
function expandLight(data, w, h, bgBrightness) {
  const threshold = Math.max(210, bgBrightness - 20);
  const visited   = new Uint8Array(w * h);
  const queue     = new Uint32Array(w * h);
  let head = 0, tail = 0;

  const isLight = (idx) => {
    const i = idx * 4;
    return (data[i] + data[i+1] + data[i+2]) / 3 >= threshold;
  };
  const push = (idx) => {
    if (!visited[idx] && data[idx*4+3] > 0 && isLight(idx)) {
      visited[idx] = 1; queue[tail++] = idx;
    }
  };

  // Amorcer depuis les pixels déjà transparents
  for (let i = 0; i < w * h; i++) {
    if (data[i*4+3] === 0) {
      visited[i] = 1;
      const x = i % w, y = (i - x) / w;
      if (x > 0)   push(i-1);
      if (x < w-1) push(i+1);
      if (y > 0)   push(i-w);
      if (y < h-1) push(i+w);
    }
  }
  while (head < tail) {
    const idx = queue[head++];
    data[idx*4+3] = 0;
    const x = idx % w, y = (idx - x) / w;
    if (x > 0)   push(idx-1);
    if (x < w-1) push(idx+1);
    if (y > 0)   push(idx-w);
    if (y < h-1) push(idx+w);
  }
}

// PASSE 3 — Supprime les îlots opaques isolés (particules résiduelles)
function removeIslands(data, w, h) {
  const minSize = Math.max(400, Math.floor(w * h * 0.004));
  const visited = new Uint8Array(w * h);
  const q       = new Uint32Array(w * h);

  for (let start = 0; start < w * h; start++) {
    if (visited[start]) continue;
    visited[start] = 1;
    if (data[start*4+3] === 0) continue;

    let head = 0, tail = 0;
    q[tail++] = start;
    while (head < tail) {
      const idx = q[head++];
      const x   = idx % w, y = (idx - x) / w;
      const push = (n) => { if (!visited[n]) { visited[n]=1; if (data[n*4+3]>0) q[tail++]=n; } };
      if (x > 0)   push(idx-1);
      if (x < w-1) push(idx+1);
      if (y > 0)   push(idx-w);
      if (y < h-1) push(idx+w);
    }
    if (tail < minSize) for (let i = 0; i < tail; i++) data[q[i]*4+3] = 0;
  }
}

// ─── Nettoyage halos post-suppression fond ────────────────────────────────────
// Pré-composite les bords semi-transparents contre blanc → élimine toute
// couleur parasite du fond original sur les pixels de bordure.
async function cleanAlphaHalos(rgbaPng) {
  const { data, info } = await sharp(rgbaPng).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    data[i]     = Math.round(data[i]     * a + 255 * (1 - a));
    data[i + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
    data[i + 2] = Math.round(data[i + 2] * a + 255 * (1 - a));
    data[i + 3] = data[i + 3] < 10 ? 0 : data[i + 3];
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// ─── Centrage automatique par bounding box ────────────────────────────────────
// Détecte le vrai contour du sujet (pixels alpha > seuil), recadre, puis
// re-centre avec marges symétriques — élimine tout blanc/espace parasite autour.
async function autoCropToSubject(rgbaPng) {
  const { data, info } = await sharp(rgbaPng)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  let minX = w, maxX = 0, minY = h, maxY = 0;
  let hasOpaque = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasOpaque = true;
      }
    }
  }

  if (!hasOpaque || minX >= maxX || minY >= maxY) return rgbaPng;

  // Légère marge autour du sujet détecté (évite de couper les bords nets)
  const margin = Math.max(2, Math.round(Math.min(w, h) * 0.005));
  const left   = Math.max(0, minX - margin);
  const top    = Math.max(0, minY - margin);
  const right  = Math.min(w - 1, maxX + margin);
  const bottom = Math.min(h - 1, maxY + margin);

  return sharp(rgbaPng)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toBuffer();
}

// ─── Profils d'amélioration marketing par catégorie ──────────────────────────

function getCategoryProfile(rayon) {
  const r = String(rayon).toUpperCase();

  if (/R24/.test(r)) return {           // Boucherie — rouge profond, texture viande
    gamma: 1.06,
    warmth: [1.07, 0.98, 0.94],         // chaud : rouge fort, bleu réduit
    saturation: 1.40,
    brightness: 1.03,
    claheSlope: 5,
    sharpSigma: 1.1, sharpM1: 1.0, sharpM2: 2.8,
  };
  if (/R21/.test(r)) return {           // Poissonnerie — fraîcheur, bleu-argent
    gamma: 1.05,
    warmth: [0.97, 1.01, 1.06],         // frais : bleu légèrement boosté
    saturation: 1.28,
    brightness: 1.04,
    claheSlope: 4,
    sharpSigma: 1.0, sharpM1: 0.9, sharpM2: 2.5,
  };
  if (/R20/.test(r)) return {           // Charcuterie/Fromage — doré, appétissant
    gamma: 1.08,
    warmth: [1.05, 1.01, 0.95],         // chaud doré
    saturation: 1.32,
    brightness: 1.04,
    claheSlope: 4,
    sharpSigma: 0.9, sharpM1: 0.9, sharpM2: 2.5,
  };
  if (/R22/.test(r)) return {           // Fruits & Légumes — vivid, éclat naturel
    gamma: 1.10,
    warmth: [1.02, 1.03, 0.97],
    saturation: 1.45,
    brightness: 1.06,
    claheSlope: 4,
    sharpSigma: 0.8, sharpM1: 0.8, sharpM2: 2.2,
  };
  if (/R23/.test(r)) return {           // Boulangerie — doré chaud, croûte
    gamma: 1.09,
    warmth: [1.07, 1.02, 0.92],         // très chaud, ambre
    saturation: 1.25,
    brightness: 1.05,
    claheSlope: 3,
    sharpSigma: 0.8, sharpM1: 0.8, sharpM2: 2.0,
  };
  return {                               // Standard (pas de rayon sélectionné)
    gamma: 1.06,
    warmth: [1.0, 1.0, 1.0],
    saturation: 1.20,
    brightness: 1.03,
    claheSlope: 3,
    sharpSigma: 0.8, sharpM1: 0.8, sharpM2: 2.2,
  };
}

// ─── Routes : Fonds de scène par catégorie ───────────────────────────────────

const RAYONS_VALIDES = ['R20','R21','R22','R23','R24'];

// Lister quels rayons ont un fond configuré
app.get('/api/templates', (_req, res) => {
  const result = {};
  RAYONS_VALIDES.forEach(r => {
    result[r] = fs.existsSync(path.join(TEMPLATES_DIR, `${r}.png`));
  });
  res.json(result);
});

// Servir l'image d'aperçu d'un fond
app.get('/api/templates/:rayon/image', (req, res) => {
  const r = String(req.params.rayon).toUpperCase();
  const p = path.join(TEMPLATES_DIR, `${r}.png`);
  if (!fs.existsSync(p)) return res.status(404).end();
  res.sendFile(p);
});

// Enregistrer / remplacer un fond
app.post('/api/templates/:rayon', async (req, res) => {
  const r = String(req.params.rayon).toUpperCase();
  if (!RAYONS_VALIDES.includes(r)) return res.status(400).json({ error: 'Rayon invalide' });
  if (!sharp) return res.status(500).json({ error: 'Module sharp manquant' });
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Image manquante' });
  try {
    const resized = await sharp(Buffer.from(imageBase64, 'base64'))
      .resize(1500, 1500, { fit:'cover', position:'centre', kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(TEMPLATES_DIR, `${r}.png`), resized);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un fond
app.delete('/api/templates/:rayon', (req, res) => {
  const p = path.join(TEMPLATES_DIR, `${String(req.params.rayon).toUpperCase()}.png`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  res.json({ ok: true });
});

// ─── Route : Statut moteur IA ─────────────────────────────────────────────────

app.get('/api/ai-status', (_req, res) => {
  res.json({
    ready:     aiReady || !!HF_TOKEN,
    available: !!aiRemoveBg || !!HF_TOKEN,
    engine:    HF_TOKEN ? 'BRIA RMBG-2.0' : aiReady ? '@imgly' : 'flood-fill',
    bria:      !!HF_TOKEN,
    error:     (!HF_TOKEN && !aiReady) ? aiError : null,
  });
});

// ─── Route : Traitement visuel ────────────────────────────────────────────────

app.post('/api/process-image', async (req, res) => {
  if (!sharp) return res.status(500).json({ error: 'Module "sharp" non installé. Relancez demarrer.bat.' });

  const { imageBase64, ean='', removeBg=true, sensitivity=30, rayon='', sceneScale=0.68, vertOffset=0 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Image manquante' });

  try {
    const inputBuffer = Buffer.from(imageBase64, 'base64');
    const profile     = getCategoryProfile(rayon);
    const WHITE       = { r:255, g:255, b:255 };
    const TRANS       = { r:0, g:0, b:0, alpha:0 };
    const SZ          = 1500;   // canvas final
    const PAD         = 70;     // marge blanc autour du produit
    const PROD_SZ     = SZ - PAD * 2; // 1360 : zone produit

    // ── ÉTAPE 1 : Suppression du fond → PNG RGBA avec transparence ────────
    let rgbaPng;

    if (removeBg) {
      let bgDone = false;

      // ── VOIE 1 : BRIA RMBG-2.0 (prioritaire si HF_TOKEN configuré) ──────
      // Modèle fine-tuné sur produits e-commerce — zéro halo sur emballages
      if (HF_TOKEN && !bgDone) {
        try {
          console.log('  → BRIA RMBG-2.0 en cours…');
          rgbaPng = await removeBgBRIA(inputBuffer);
          rgbaPng = await cleanAlphaHalos(rgbaPng);
          bgDone  = true;
          console.log('  ✓ BRIA OK');
        } catch (briaErr) {
          console.warn('  ⚠ BRIA échec, fallback @imgly :', briaErr.message);
        }
      }

      // ── VOIE 2 : @imgly local (fallback si BRIA indisponible) ────────────
      if (aiRemoveBg && !bgDone) {
        try {
          const AI_MAX = 1024;
          const meta = await sharp(inputBuffer).metadata();
          const needsResize = (meta.width > AI_MAX || meta.height > AI_MAX);
          const aiInput = needsResize
            ? await sharp(inputBuffer).resize(AI_MAX, AI_MAX, { fit:'inside', withoutEnlargement:true, kernel:sharp.kernel.lanczos3 }).png().toBuffer()
            : await sharp(inputBuffer).png().toBuffer();
          const inputBlob  = new Blob([aiInput], { type: 'image/png' });
          const resultBlob = await aiRemoveBg(inputBlob, {
            output: { format: 'image/png', quality: 1.0, type: 'foreground' },
          });
          rgbaPng = Buffer.from(await resultBlob.arrayBuffer());
          rgbaPng = await cleanAlphaHalos(rgbaPng);
          bgDone  = true;
        } catch (aiErr) {
          console.error('  ⚠ @imgly échec, fallback flood-fill :', aiErr.message);
        }
      }

      // ── FALLBACK : flood fill 3 passes ────────────────────────────────
      if (!bgDone) {
        const meta = await sharp(inputBuffer).metadata();
        if (!meta.hasAlpha) {
          const { data, info } = await sharp(inputBuffer)
            .resize(2000, 2000, { fit:'inside', withoutEnlargement:true })
            .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const w = info.width, h = info.height;
          const bgColor = sampleBgColor(data, w, h);
          if (bgColor) {
            const bgBrightness = (bgColor.r + bgColor.g + bgColor.b) / 3;
            let tol = Number(sensitivity) || 30;
            if      (bgBrightness > 230) tol = Math.max(tol, 35);
            else if (bgBrightness > 180) tol = Math.max(tol, 45);
            else if (bgBrightness > 120) tol = Math.max(tol, 30);
            floodFill(data, w, h, bgColor, tol);
            if (bgBrightness > 160) expandLight(data, w, h, bgBrightness);
            removeIslands(data, w, h);
            rgbaPng = await sharp(data, { raw: { width:w, height:h, channels:4 } }).png().toBuffer();
          } else {
            rgbaPng = await sharp(inputBuffer).ensureAlpha().png().toBuffer();
          }
        } else {
          rgbaPng = await sharp(inputBuffer).png().toBuffer();
        }
      }
    } else {
      rgbaPng = await sharp(inputBuffer).ensureAlpha().png().toBuffer();
    }

    // ── ÉTAPE 1b : Recadrage automatique sur le sujet ────────────────────
    // Élimine tout espace vide autour du produit avant le centrage —
    // garantit des marges symétriques quel que soit le cadrage original.
    if (removeBg) rgbaPng = await autoCropToSubject(rgbaPng);

    // ── ÉTAPE 2 : Déterminer le fond ──────────────────────────────────────
    const rayonKey    = String(rayon).toUpperCase();
    const tplPath     = RAYONS_VALIDES.includes(rayonKey)
      ? path.join(TEMPLATES_DIR, `${rayonKey}.png`) : null;
    const hasTemplate = tplPath && fs.existsSync(tplPath);

    // ── ÉTAPE 3 : Redimensionner et positionner le produit ────────────────
    //   Fond de scène : produit à 88% du canvas, légèrement décalé vers le bas
    //                   pour se poser naturellement sur le décor
    //   Fond blanc    : produit à 91%, centré
    let scaledPng;

    if (hasTemplate) {
      const scale  = Math.min(0.95, Math.max(0.40, Number(sceneScale) || 0.68));
      const AREA   = Math.round(SZ * scale);
      const MH     = Math.floor((SZ - AREA) / 2);

      // vertOffset : -100 = monter / 0 = centré / +100 = descendre
      const vPct  = Math.min(100, Math.max(-100, Number(vertOffset)  || 0));
      const hPct  = Math.min(100, Math.max(-100, Number(req.body.horizOffset) || 0));
      const shift = Math.round(MH * vPct  / 100);
      const hShift= Math.round(MH * hPct  / 100);

      const MT = Math.max(0, Math.min(SZ - AREA, MH + shift));
      const MB = SZ - AREA - MT;
      const ML = Math.max(0, Math.min(SZ - AREA, MH + hShift));
      const MR = SZ - AREA - ML;

      scaledPng = await sharp(rgbaPng)
        .resize(AREA, AREA, {
          fit: 'contain', background: TRANS,
          kernel: sharp.kernel.lanczos3, withoutEnlargement: false,
        })
        .extend({ top: MT, bottom: MB, left: ML, right: MR, background: TRANS })
        .png()
        .toBuffer();
    } else {
      scaledPng = await sharp(rgbaPng)
        .resize(PROD_SZ, PROD_SZ, {
          fit: 'contain', background: TRANS,
          kernel: sharp.kernel.lanczos3, withoutEnlargement: false,
        })
        .extend({ top:PAD, bottom:PAD, left:PAD, right:PAD, background: TRANS })
        .png()
        .toBuffer();
    }

    // ── ÉTAPE 4 : Composition finale ─────────────────────────────────────
    let composited;

    if (hasTemplate) {
      // Ombre ultra-subtile uniquement sur décor (pas sur fond blanc)
      const alphaRaw  = await sharp(scaledPng).extractChannel('alpha').raw().toBuffer();
      const shadowRaw = Buffer.allocUnsafe(SZ * SZ * 4);
      for (let i = 0; i < SZ * SZ; i++) {
        shadowRaw[i*4] = 30; shadowRaw[i*4+1] = 25; shadowRaw[i*4+2] = 20;
        shadowRaw[i*4+3] = Math.round(alphaRaw[i] * 0.15);
      }
      const shadowPng = await sharp(shadowRaw, { raw: { width:SZ, height:SZ, channels:4 } })
        .blur(8).png().toBuffer();

      composited = await sharp(fs.readFileSync(tplPath))
        .resize(SZ, SZ, { fit:'cover', position:'centre' })
        .composite([
          { input: shadowPng, blend: 'over', left: 0, top: 20 },
          { input: scaledPng, blend: 'over', left: 0, top: 0  },
        ])
        .flatten({ background: WHITE })
        .png()
        .toBuffer();
    } else {
      // Fond blanc pur — pas d'ombre (standard e-commerce Carrefour/Amazon)
      composited = await sharp({ create: { width:SZ, height:SZ, channels:3, background:WHITE } })
        .composite([{ input: scaledPng, blend: 'over', left: 0, top: 0 }])
        .flatten({ background: WHITE })
        .png()
        .toBuffer();
    }

    // ── ÉTAPE 5 : Color grading marketing par catégorie ───────────────────
    //  gamma       → correction d'exposition naturelle
    //  recomb      → température couleur (chaleur/fraîcheur) propre à chaque rayon
    //  modulate    → saturation + luminosité pour rendu appétissant
    //  clahe       → contraste local adaptatif → texture visible (écailles, grain)
    //  sharpen     → netteté professionnelle photo produit
    let outBuffer = await sharp(composited)
      .gamma(profile.gamma)
      .recomb([
        [profile.warmth[0], 0, 0],
        [0, profile.warmth[1], 0],
        [0, 0, profile.warmth[2]],
      ])
      .modulate({ brightness: profile.brightness, saturation: profile.saturation })
      .clahe({ width: 128, height: 128, maxSlope: profile.claheSlope })
      .sharpen({ sigma: profile.sharpSigma, m1: profile.sharpM1, m2: profile.sharpM2 })
      .jpeg({ quality: 94, mozjpeg: false })
      .toBuffer();

    if (outBuffer.length > 2 * 1024 * 1024) {
      outBuffer = await sharp(outBuffer).jpeg({ quality: 80 }).toBuffer();
    }

    const eanStr = String(ean).replace(/\s/g,'') || 'EAN';
    res.json({
      imageBase64: outBuffer.toString('base64'),
      filename:    `${eanStr}_0.jpg`,
      sizeKB:      Math.round(outBuffer.length / 1024),
    });
  } catch (err) {
    console.error('Process image error:', err);
    res.status(500).json({ error: 'Erreur traitement : ' + err.message });
  }
});

// ─── Démarrage ────────────────────────────────────────────────────────────────

// Servir JSZip depuis node_modules (pour la création de ZIP côté navigateur)
app.get('/jszip.min.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/jszip/dist/jszip.min.js'));
});

app.listen(PORT, () => {
  console.log(`\n✅  Fiche Light PFT — http://localhost:${PORT}\n`);
});
