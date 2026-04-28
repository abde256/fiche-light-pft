require('dotenv').config(); // charge .env automatiquement au démarrage
const express      = require('express');
const XLSX         = require('xlsx');
const path         = require('path');
const fs           = require('fs');
const { Blob }     = require('buffer');

// ─── Client Gemini (Smart Import — REST natif, sans SDK) ──────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
if (GEMINI_API_KEY) {
  console.log('\n🧠  Gemini activé — import intelligent image/PDF disponible\n');
}

// Modèles préférés par ordre — seuls ceux disponibles sur la clé seront utilisés
const PREFERRED_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
  'gemini-pro-vision',
];

let GEMINI_MODELS = [...PREFERRED_MODELS]; // sera filtré au démarrage

// Auto-détecte les modèles réellement disponibles sur la clé via ListModels
async function detectGeminiModels() {
  if (!GEMINI_API_KEY) return;
  try {
    const url  = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`ListModels HTTP ${resp.status}`);
    const data = await resp.json();

    const available = new Set(
      (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', ''))
    );

    const filtered = PREFERRED_MODELS.filter(m => available.has(m));

    if (filtered.length) {
      GEMINI_MODELS = filtered;
      console.log(`\n📋  Modèles Gemini actifs : ${GEMINI_MODELS.join(' → ')}\n`);
    } else {
      // Aucun modèle préféré → utiliser n'importe quel modèle vision disponible
      GEMINI_MODELS = [...available].filter(m =>
        /flash|pro|vision/.test(m) && !m.includes('embedding') && !m.includes('aqa')
      ).slice(0, 3);
      console.log(`\n⚠️  Modèles de secours détectés : ${GEMINI_MODELS.join(' → ')}\n`);
    }
  } catch (err) {
    console.warn(`\n⚠️  Impossible de lister les modèles Gemini (${err.message}) — liste par défaut conservée\n`);
  }
}

async function callGeminiModel(model, bodyObj) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyObj),
    signal: AbortSignal.timeout(40000),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    const error   = new Error(`Gemini API ${resp.status}: ${errText.slice(0, 400)}`);
    error.status  = resp.status;
    throw error;
  }
  return resp.json();
}

// Retry exponentiel par modèle, puis passage au modèle suivant
async function callGeminiWithFallback(bodyObj) {
  const MAX_RETRIES = 4; // tentatives par modèle : 1 + 3 retries
  let lastError;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const data = await callGeminiModel(model, bodyObj);

        const candidate = data.candidates?.[0];
        if (!candidate) throw new Error(`Gemini: aucun candidat`);
        if (candidate.finishReason && candidate.finishReason !== 'STOP')
          throw new Error(`Gemini bloqué (${candidate.finishReason})`);
        const text = candidate.content?.parts?.[0]?.text;
        if (!text) throw new Error(`Gemini: réponse vide`);

        if (model !== GEMINI_MODELS[0])
          console.log(`  ✓ ${model} utilisé (fallback)`);

        return {
          text,
          tokens: (data.usageMetadata?.promptTokenCount || 0) + (data.usageMetadata?.candidatesTokenCount || 0),
          model,
        };
      } catch (err) {
        lastError = err;

        if (err.status === 503 || err.status === 429) {
          // Saturation / quota — backoff exponentiel avec jitter
          const delay = Math.min(3000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
          console.warn(`  ⚠️  ${model} surchargé (${err.status}) — tentative ${attempt + 1}/${MAX_RETRIES}, attente ${Math.round(delay / 1000)}s`);
          await new Promise(r => setTimeout(r, delay));
          // Dernier retry épuisé → passer au modèle suivant
          if (attempt === MAX_RETRIES - 1)
            console.warn(`  → Tous les essais épuisés pour ${model}, modèle suivant`);
        } else if (err.status === 404) {
          // Modèle non disponible sur cette clé → modèle suivant immédiatement
          console.warn(`  ⚠️  ${model} non trouvé (404) — modèle suivant`);
          break;
        } else {
          throw err; // 400, 401, 403 → ne pas réessayer
        }
      }
    }
  }

  throw lastError || new Error('Tous les modèles Gemini sont temporairement indisponibles — réessayez dans quelques minutes');
}

async function callGemini(fileBase64, mimeType, prompt) {
  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: fileBase64 } },
        { text: prompt },
      ],
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
  };
  return callGeminiWithFallback(body);
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

// ─── Trame DDM : champ → spec technique ───────────────────────────────────────
// Ligne 1 = label champ, Ligne 2 = spec, Ligne 3+ = données

const TRAME_DDM = [
  { col: 'EAN',                                                      spec: 'specProduit_DDM/tradeItemGTIN',                    get: p => String(p.ean || '').trim() },
  { col: 'Nature brute produit (fr_FR)',                             spec: 'specProduit_DDM/pdctProductNature/fr_FR',           get: p => p.natureBrute || '' },
  { col: 'Attribut / caractéristiques comm. (fr_FR)',               spec: 'specProduit_DDM/pdctProductQualifier/fr_FR',        get: p => p.attribut || '' },
  { col: 'Marque Produit (fr_FR)',                                   spec: 'specProduit_DDM/pdctProductSubBrand/fr_FR',         get: p => p.marque ? removeAccents(String(p.marque).toUpperCase()) : '' },
  { col: 'Conditionnement',                                          spec: 'specProduit_DDM/pdctPackaging',                    get: p => p.conditionnement || '' },
  { col: 'Service consommateur',                                     spec: 'specProduit_DDM/pdctServiceConso',                 get: () => SERVICE_CONSOMMATEUR },
  { col: 'Ingrédients (fr_FR)',                                      spec: 'specProduit_DDM/ingredientStatement/fr_FR',        get: p => p.ingredients || '' },
  { col: 'Contient du Gluten',                                       spec: 'specProduit_DDM/pdctGlutenIncluded',               get: p => (p.allergens||{}).gluten       ? 'TRUE' : 'FALSE' },
  { col: 'Contient du Lactose',                                      spec: 'specProduit_DDM/pdctLactoseIncluded',              get: p => (p.allergens||{}).lait         ? 'TRUE' : 'FALSE' },
  { col: 'Contient du Soja',                                         spec: 'specProduit_DDM/pdctSoyIncluded',                  get: p => (p.allergens||{}).soja         ? 'TRUE' : 'FALSE' },
  { col: "Contient de l'Arachide",                                   spec: 'specProduit_DDM/pdctArachidIncluded',              get: p => (p.allergens||{}).arachides    ? 'TRUE' : 'FALSE' },
  { col: 'Contient du Céleri',                                       spec: 'specProduit_DDM/pdctCeleryIncluded',               get: p => (p.allergens||{}).celeri       ? 'TRUE' : 'FALSE' },
  { col: "Contient de l'Œuf",                                        spec: 'specProduit_DDM/pdctEggIncluded',                  get: p => (p.allergens||{}).oeufs        ? 'TRUE' : 'FALSE' },
  { col: 'Contient des crustacés',                                   spec: 'specProduit_DDM/pdctCrustaceansIncluded',          get: p => (p.allergens||{}).crustaces    ? 'TRUE' : 'FALSE' },
  { col: 'Contient du poisson',                                      spec: 'specProduit_DDM/pdctFishIncluded',                 get: p => (p.allergens||{}).poisson      ? 'TRUE' : 'FALSE' },
  { col: 'Contient des fruits à coque',                              spec: 'specProduit_DDM/pdctFruitACoqueIncluded',          get: p => (p.allergens||{}).fruitsACoque ? 'TRUE' : 'FALSE' },
  { col: 'Contient de la Moutarde',                                  spec: 'specProduit_DDM/pdctMustardIncluded',              get: p => (p.allergens||{}).moutarde     ? 'TRUE' : 'FALSE' },
  { col: 'Contient du Sésame',                                       spec: 'specProduit_DDM/pdctSesamIncluded',                get: p => (p.allergens||{}).sesame       ? 'TRUE' : 'FALSE' },
  { col: 'Contient du Sulfite',                                      spec: 'specProduit_DDM/pdctSulfiteIncluded',              get: p => (p.allergens||{}).sulfites     ? 'TRUE' : 'FALSE' },
  { col: 'Contient du Lupin',                                        spec: 'specProduit_DDM/pdctLupinIncluded',                get: p => (p.allergens||{}).lupin        ? 'TRUE' : 'FALSE' },
  { col: 'Contient des Mollusques',                                  spec: 'specProduit_DDM/pdctMollusqueIncluded',            get: p => (p.allergens||{}).mollusques   ? 'TRUE' : 'FALSE' },
  { col: 'Flag Inco',                                                spec: 'specProduit_DDM/flagInco',                         get: () => 'TRUE' },
  { col: 'Conservation (fr_FR)',                                     spec: 'specProduit_DDM/pdctStorageBloc/fr_FR',            get: p => p.conservation || '' },
  { col: 'Flag Bio',                                                 spec: 'specProduit_DDM/organicTradeItemCode',             get: p => p.flagBio ? 'TRUE' : 'FALSE' },
  { col: 'Flag Filière Qualité Carrefour',                           spec: 'specProduit_DDM/flagEngagementQualCarrefour',      get: p => p.flagFQC ? 'TRUE' : 'FALSE' },
  { col: 'Exposant',                                                 spec: 'specProduit_DDM/pdctTabNutriExposant',             get: () => 'pour 100g' },
  { col: 'Unité énergétique (fr_FR)',                                spec: 'specProduit_DDM/pdctValNutriUnitEnerg/fr_FR',      get: p => p.uniteEnergetique || '' },
  { col: 'Valeur énergétique (fr_FR)',                               spec: 'specProduit_DDM/pdctValNutriValEnerg/fr_FR',       get: p => p.valeursEnergetiques || '' },
  { col: 'Proteines (fr_FR)',                                        spec: 'specProduit_DDM/pdctValNutriProtide/fr_FR',        get: p => p.proteines || '' },
  { col: 'Glucides (fr_FR)',                                         spec: 'specProduit_DDM/pdctValNutriGlucides/fr_FR',       get: p => p.glucides || '' },
  { col: 'Glucides dont sucre (fr_FR)',                              spec: 'specProduit_DDM/pdctValNutriDontSucre/fr_FR',      get: p => p.sucres || '' },
  { col: 'Matières grasses (fr_FR)',                                 spec: 'specProduit_DDM/pdctValNutriLipides/fr_FR',        get: p => p.graisses || '' },
  { col: 'Matières grasses dont Acides Gras Saturés (fr_FR)',       spec: 'specProduit_DDM/pdctValNutriAcGrasSat/fr_FR',      get: p => p.grasSatures || '' },
  { col: 'Fibres alimentaires (fr_FR)',                              spec: 'specProduit_DDM/pdctValNutriFibres/fr_FR',         get: p => p.fibres || '' },
  { col: 'Sodium (fr_FR)',                                           spec: 'specProduit_DDM/pdctValNutriSodium/fr_FR',         get: p => p.sodium || '' },
  { col: 'Sel',                                                      spec: 'specProduit_DDM/pdctValNutriSel',                  get: p => p.sel || '' },
  { col: 'Info Bandeau (Coupe,…)',                                   spec: 'specProduit_DDM/infoBandeau',                      get: p => p.infoBandeau || '' },
  { col: 'Palier de commande (en quantité, Kilo ou Litre)',          spec: 'specProduit_DDM/StepPurchase',                     get: p => p.palierCommande || '' },
  { col: 'Fourchette prép + ou - en Gramme',                        spec: 'specProduit_DDM/pdctMinMaxPrepPoidsVariable',      get: () => '0' },
];

// ─── Constructeur AOA (Array of Arrays) pour la trame DDM ─────────────────────

function buildExportAOA(products) {
  const headers  = TRAME_DDM.map(c => c.col);
  const specs    = TRAME_DDM.map(c => c.spec);
  const dataRows = products.map(p => TRAME_DDM.map(c => c.get(p)));
  return [headers, specs, ...dataRows];
}

// ─── Formatage Excel ──────────────────────────────────────────────────────────

function forceTextColumnsAOA(ws, aoa, textColIndices) {
  // aoa[0] = headers, aoa[1] = specs, aoa[2+] = données
  textColIndices.forEach(ci => {
    for (let ri = 2; ri < aoa.length; ri++) {
      const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
      if (ws[ref]) { ws[ref].t = 's'; ws[ref].v = String(aoa[ri][ci]); delete ws[ref].z; }
    }
  });
}

function setColumnWidthsAOA(ws, headers) {
  ws['!cols'] = headers.map(h => ({ wch: Math.max(String(h).length + 4, 16) }));
}

function styleSpecRow(ws, colCount) {
  // Mettre la ligne 2 (specs) en gris italic
  for (let ci = 0; ci < colCount; ci++) {
    const ref = XLSX.utils.encode_cell({ r: 1, c: ci });
    if (!ws[ref]) ws[ref] = { t: 's', v: '' };
    ws[ref].s = { font: { italic: true, color: { rgb: 'A0A0A0' } } };
  }
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
  "uniteEnergetique": "unité de la valeur énergétique, ex: 'kcal / kJ', ou null",
  "valeursEnergetiques": "valeur numérique seule, ex: '250 / 1045', ou valeur complète '250 kcal / 1045 kJ', ou null",
  "graisses": "ex: '12g', ou null",
  "grasSatures": "ex: '4g', ou null",
  "glucides": "ex: '30g', ou null",
  "sucres": "ex: '5g', ou null",
  "proteines": "ex: '8g', ou null",
  "fibres": "ex: '2.5g', ou null",
  "sodium": "ex: '0.48g', ou null",
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
  res.json({ available: !!GEMINI_API_KEY, configured: !!GEMINI_API_KEY });
});

// ─── Appel Gemini texte seul (sans image) — avec fallback automatique ────────
async function callGeminiText(prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  };
  const { text } = await callGeminiWithFallback(body);
  return text;
}

// ─── Prompt réécriture libellé ────────────────────────────────────────────────
const REWRITE_LIBELLE_PROMPT = `Tu es un expert en référencement produit Carrefour (rayons frais R20-R24).
Ta mission : décomposer et corriger des libellés produits qui peuvent être en abréviation BCP ou mal orthographiés.

ABRÉVIATIONS BCP À DÉCODER :
BF/VBF/VB = Boeuf/Viande Bovine Française · PC/PF = Porc/Porc Français · AG = Agneau
VL = Veau · VG = Veau de grain · PO = Poulet · DI = Dinde · LAP = Lapin · EQ = Équin
BQ = Barquette · ST = Sachet · FL = Filet · TR = Tranchés · PCE = Pièce · KG = Kilo
CRF/CARREF = CARREFOUR · FQC = FILIERE QUALITE CARREFOUR · LR = LABEL ROUGE
FR = Français/Française · IMP = Importé · CEE/UE = Europe · BIO/AB = Biologique · ELV = Élevé

RÈGLES OBLIGATOIRES :
1. natureBrute : nom principal, 1ère lettre majuscule, reste en minuscule. Ex : "Viande Bovine", "Saumon Atlantique", "Foie Gras de Canard"
2. attribut : caractéristiques complémentaires (origine, format, qualité). Ex : "100% Française", "façon bouchère", "barquette de 200g tranchée". Null si rien à dire.
3. marque : MAJUSCULES obligatoires, sans accents. Null si aucune marque identifiable. Ex : "CARREFOUR", "MAISON MONTFORT"
4. libelleFinal : natureBrute + attribut + marque (concaténés avec espaces, en ignorant les null)

EXEMPLES :
"Viand bov 100% fr CRF" → {"natureBrute":"Viande Bovine","attribut":"100% Française","marque":"CARREFOUR","libelleFinal":"Viande Bovine 100% Française CARREFOUR"}
"BF BQ 200G TR FQC FR" → {"natureBrute":"Viande Bovine","attribut":"Tranchée Française en barquette de 200g","marque":"FILIERE QUALITE CARREFOUR","libelleFinal":"Viande Bovine Tranchée Française en barquette de 200g FILIERE QUALITE CARREFOUR"}
"Saum atl ELV 400g" → {"natureBrute":"Saumon Atlantique","attribut":"Élevé 400g","marque":null,"libelleFinal":"Saumon Atlantique Élevé 400g"}
"Foie gras canard entier MAISON MONTFORT 200g" → {"natureBrute":"Foie Gras de Canard","attribut":"Entier 200g","marque":"MAISON MONTFORT","libelleFinal":"Foie Gras de Canard Entier 200g MAISON MONTFORT"}
"camambert de normandi CRF" → {"natureBrute":"Camembert de Normandie","attribut":null,"marque":"CARREFOUR","libelleFinal":"Camembert de Normandie CARREFOUR"}

Retourne UNIQUEMENT un tableau JSON valide (même ordre que l'input, sans texte autour) :
[{"idx":0,"natureBrute":"...","attribut":"..." ou null,"marque":"..." ou null,"libelleFinal":"..."},...]`;

// ─── Route : Réécriture libellé produit ──────────────────────────────────────
app.post('/api/rewrite-libelle', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Clé API Gemini non configurée.',
      hint: 'Ajoutez GEMINI_API_KEY=... dans vos variables d\'environnement et redémarrez.',
    });
  }

  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Champ items[] requis' });
  }

  const BATCH_SIZE = 15; // libellés par appel Gemini
  const allResults = [];

  try {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);

      const libellesBlock = chunk.map((item, j) => {
        const rayon = item.rayon ? ` [rayon ${item.rayon}]` : '';
        return `${i + j}: "${item.libelle}"${rayon}`;
      }).join('\n');

      const prompt = `${REWRITE_LIBELLE_PROMPT}\n\nLibellés à réécrire :\n${libellesBlock}`;
      const text   = await callGeminiText(prompt);

      const stripped  = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const jsonMatch = stripped.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Réponse IA non parsable pour le lot');

      const parsed = JSON.parse(jsonMatch[0]);
      parsed.forEach((r, j) => {
        r.idx = chunk[j]?.idx ?? (i + j);
        allResults.push(r);
      });
    }

    res.json({ results: allResults, total: allResults.length });
  } catch (err) {
    console.error('Rewrite libellé error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ─── Route : Smart Import (image + PDF → Gemini Vision) ──────────────────────
app.post('/api/smart-import', async (req, res) => {
  if (!GEMINI_API_KEY) {
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
    const { text, tokens } = await callGemini(fileBase64, mimeType, SMART_IMPORT_PROMPT);

    // Gemini peut envelopper la réponse dans ```json ... ```
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Réponse Gemini brute:', text.slice(0, 500));
      throw new Error('Réponse IA non parsable — réessayez ou vérifiez le fichier');
    }

    const data = JSON.parse(jsonMatch[0]);

    const fields = ['ean','natureBrute','attribut','marque','conditionnement','infoBandeau',
                    'palierCommande','conservation','ingredients','valeursEnergetiques'];
    const filled = fields.filter(f => data[f] != null).length;

    res.json({ extracted: data, filledCount: filled, totalFields: fields.length, tokens });

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
    const aoa = buildExportAOA(products);
    const wb  = XLSX.utils.book_new();
    const ws  = XLSX.utils.aoa_to_sheet(aoa);

    // Colonnes à forcer en texte : EAN, Palier de commande, Fourchette
    const textCols = TRAME_DDM.reduce((acc, c, i) => {
      if (['EAN','Palier de commande (en quantité, Kilo ou Litre)','Fourchette prép + ou - en Gramme'].includes(c.col)) acc.push(i);
      return acc;
    }, []);
    forceTextColumnsAOA(ws, aoa, textCols);
    setColumnWidthsAOA(ws, aoa[0]);
    styleSpecRow(ws, aoa[0].length);

    XLSX.utils.book_append_sheet(wb, ws, 'Fiches Light PFT');

    const buffer   = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `fiche-light-DDM-${new Date().toISOString().slice(0, 10)}.xlsx`;

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

// ─── Route : diagnostic modèles Gemini disponibles ───────────────────────────
app.get('/api/gemini-models', async (_req, res) => {
  if (!GEMINI_API_KEY) return res.json({ error: 'GEMINI_API_KEY non configurée', active: [] });
  try {
    const url  = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return res.status(resp.status).json({ error: `ListModels HTTP ${resp.status}` });
    const data = await resp.json();

    const all = (data.models || []).map(m => ({
      name:    m.name.replace('models/', ''),
      methods: m.supportedGenerationMethods || [],
    }));

    res.json({
      active:    GEMINI_MODELS,
      available: all.filter(m => m.methods.includes('generateContent')).map(m => m.name),
      all:       all.map(m => m.name),
    });
  } catch (err) {
    res.status(500).json({ error: err.message, active: GEMINI_MODELS });
  }
});

// ─── Démarrage ────────────────────────────────────────────────────────────────

// Servir JSZip depuis node_modules (pour la création de ZIP côté navigateur)
app.get('/jszip.min.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/jszip/dist/jszip.min.js'));
});

app.listen(PORT, async () => {
  console.log(`\n✅  Fiche Light PFT — http://localhost:${PORT}\n`);
  await detectGeminiModels(); // détecte les modèles disponibles après démarrage
});
