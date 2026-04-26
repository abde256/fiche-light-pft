'use strict';

// ─── Abréviations BCP ────────────────────────────────────────────────────────
const BCP_ABBR = {
  ST:'Sachet', FL:'Filet', BQ:'Barquette', FQC:'Filière Qualité Carrefour',
  CRF:'CARREFOUR', LR:'Label Rouge', TR:'Tranchés', CAISS:'Barquette',
  KG:'Kilo', PC:'Porc', AG:'Agneau', BF:'Boeuf', PCE:'Pièce',
  IMP:'Import', FR:'Français', CEE:'Europe',
};

// ─── Config rayons ────────────────────────────────────────────────────────────
const RAYON = {
  R20:{ label:'R20 — Charcuterie · Traiteur · Fromage', sub:'Charcuterie, plats préparés, fromages à la coupe',
    cond:['la tranche','2 tranches','la barquette de 120g','la pièce','2 pièces',
          'la barquette de 8 tranches - 480g','la barquette de 480g','la barquette de 16 pièces',
          'la pièce de 350g','la portion de 250g','la pièce de 150g','la pizza de 900g'],
    band:['120g','480g','8 tranches','16 pièces','2 pièces','350g','900g','la pièce','250g','150g'] },
  R21:{ label:'R21 — Poissonnerie', sub:'Poissons, crustacés, fruits de mer',
    cond:['la pièce','2 pièces','la barquette de 200g','la barquette de 300g','la barquette de 500g','le kilo'],
    band:['150g','200g','300g','500g','la pièce'] },
  R22:{ label:'R22 — Fruits et Légumes', sub:'Fruits et légumes vendus à la pièce ou au poids',
    cond:['la pièce','le kilo','500g','1kg','la barquette de 500g','la barquette de 1kg'],
    band:['la pièce','500g','1kg'] },
  R23:{ label:'R23 — BVP · Boulangerie · Pâtisserie · Viennoiserie', sub:'Pains, gâteaux, viennoiseries',
    cond:['la pièce','2 pièces','la barquette de 2 - 260g','les 2 crèpes de 140g','la pizza de 900g'],
    band:['la pièce','2 pièces','260g','140g'] },
  R24:{ label:'R24 — Boucherie', sub:'Viandes, découpes, volailles',
    cond:['la pièce','2 pièces','5 pièces','la pièce de 1,5Kg','la barquette de 200g','la barquette de 400g'],
    band:['la pièce','200g','400g','500g','1kg'] },
};

const CONSERVATION_OPTIONS = [
  { value:'', label:'— Sélectionner —' },
  { value:'A conserver entre +0°C et +4°C',    label:'Produit frais — A conserver entre +0°C et +4°C' },
  { value:'A conserver à température ambiante', label:'Produit ambiant — A conserver à température ambiante' },
];

// ─── Mapping d'import : variations de noms de colonnes → champ interne ────────
const IMPORT_FIELD_ALIASES = {
  ean:                  ['ean','code ean','code-barres','code barre','barcode','gtin','upc','code article'],
  natureBrute:          ['nature brute','naturebrute','libelle bcp','libellé bcp','libellé','libelle','nom produit','nom'],
  attribut:             ['attribut','attribute','specificite','spécificité','sous libelle'],
  marque:               ['marque','marque produit','brand','fabricant','marque fournisseur'],
  rayon:                ['rayon','rayon code','departement','département','famille','code rayon','r20','r21','r22','r23','r24'],
  conditionnement:      ['conditionnement','packaging'],
  infoBandeau:          ['info bandeau','info_bandeau','bandeau'],
  palierCommande:       ['palier de commande','palier commande','palier'],
  flagBio:              ['flag bio','bio','biologique'],
  flagFQC:              ['flag fqc','fqc'],
  ingredients:          ['ingrédients','ingredients','ingredient','composition'],
  valeursEnergetiques:  ['valeur energetique','valeur énergétique','energie','énergie','calories','kcal'],
  graisses:             ['matieres grasses','matières grasses','graisses','lipides'],
  grasSatures:          ['acides gras satures','acides gras saturés','graisses saturees','gras saturés'],
  glucides:             ['glucides','glucide'],
  sucres:               ['dont sucres','sucres'],
  proteines:            ['proteines','protéines'],
  sel:                  ['sel','sodium'],
  conservation:         ['conservation','conditions de conservation'],
  nomLatin:             ['nom latin','latin','nom scientifique'],
  facettePecheElevage:  ['peche elevage','pêche elevage','peche','elevage'],
  categorie:            ['categorie','catégorie','category'],
  viandeBovine:         ['viande bovine francaise','viande bovine française','viande bovine'],
  porcFrancais:         ['porc francais','porc français'],
  // Allergènes individuels
  'al.gluten':          ['gluten'],
  'al.lait':            ['lait','lactose'],
  'al.soja':            ['soja'],
  'al.arachides':       ['arachides','arachide','arachides (cacahuetes)'],
  'al.celeri':          ['celeri','céleri'],
  'al.oeufs':           ['oeufs','oeuf'],
  'al.crustaces':       ['crustacés','crustaces'],
  'al.poisson':         ['poisson'],
  'al.fruitsACoque':    ['fruits a coque','fruits à coque','noix','fruits coque'],
  'al.moutarde':        ['moutarde'],
  'al.sesame':          ['sesame','sésame'],
  'al.sulfites':        ['sulfites','sulfite','anhydride sulfureux'],
  'al.lupin':           ['lupin'],
  'al.mollusques':      ['mollusques'],
};

// Libellé lisible pour chaque champ interne (dans les dropdowns du mapping)
const FIELD_LABELS = {
  '':                   '— Ignorer cette colonne —',
  ean:                  'EAN',
  natureBrute:          'Nature brute',
  attribut:             'Attribut',
  marque:               'Marque produit',
  rayon:                'Rayon (R20/R21/R22/R23/R24)',
  conditionnement:      'Conditionnement',
  infoBandeau:          'Info bandeau',
  palierCommande:       'Palier de commande',
  flagBio:              'Flag Bio',
  flagFQC:              'Flag FQC',
  ingredients:          'Ingrédients',
  valeursEnergetiques:  'Valeur énergétique (fr_FR)',
  graisses:             'Matières grasses (fr_FR)',
  grasSatures:          'dont acides gras saturés (fr_FR)',
  glucides:             'Glucides (fr_FR)',
  sucres:               'dont sucres (fr_FR)',
  proteines:            'Protéines (fr_FR)',
  sel:                  'Sel',
  conservation:         'Conservation',
  nomLatin:             'Nom latin',
  facettePecheElevage:  'Facette Pêche / Élevage',
  categorie:            'Catégorie',
  viandeBovine:         'Viande Bovine Française',
  porcFrancais:         'Porc Français',
  'al.gluten':          'Allergène — Gluten',
  'al.lait':            'Allergène — Lactose',
  'al.soja':            'Allergène — Soja',
  'al.arachides':       'Allergène — Arachides',
  'al.celeri':          'Allergène — Céleri',
  'al.oeufs':           'Allergène — Oeufs',
  'al.crustaces':       'Allergène — Crustacés',
  'al.poisson':         'Allergène — Poisson',
  'al.fruitsACoque':    'Allergène — Fruits à coque',
  'al.moutarde':        'Allergène — Moutarde',
  'al.sesame':          'Allergène — Sésame',
  'al.sulfites':        'Allergène — Sulfites',
  'al.lupin':           'Allergène — Lupin',
  'al.mollusques':      'Allergène — Mollusques',
};

// ─── État global ──────────────────────────────────────────────────────────────
let currentRayon  = null;
let products      = [];
let importedRows  = [];   // lignes brutes du fichier importé
let columnMapping = {};   // { sourceHeader: targetField }

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier que la page est bien servie par le serveur Node (pas file://)
  if (window.location.protocol === 'file:') {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#7f1d1d;color:white;padding:10px 20px;font-size:13px;font-weight:600;text-align:center';
    banner.textContent = '⚠️  Ouvrez l\'application via http://localhost:3003 (démarrez le serveur avec "npm start")';
    document.body.prepend(banner);
  }

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );

  // Rayon
  document.querySelectorAll('.rayon-btn').forEach(btn =>
    btn.addEventListener('click', () => selectRayon(btn.dataset.rayon))
  );

  // Libellé preview
  ['natureBrute','attribut','marque'].forEach(id =>
    document.getElementById(id).addEventListener('input', () => {
      updateLibellePreview(); autoDetectFlags();
    })
  );

  // Marques Carrefour
  document.querySelectorAll('.mc-chip').forEach(chip =>
    chip.addEventListener('click', () => {
      document.getElementById('marque').value = chip.dataset.m;
      updateLibellePreview(); autoDetectFlags();
    })
  );

  // Poids variable
  document.getElementById('poidsVariable').addEventListener('change', e => {
    document.getElementById('palierRow').style.display = e.target.checked ? 'grid' : 'none';
    if (!e.target.checked) { document.getElementById('palierCommande').value = ''; clearErr('palierErr'); }
  });

  // Auto-extraction palier/bandeau depuis le conditionnement
  document.getElementById('conditionnement').addEventListener('input', applyConditionnementExtraction);

  // BCP decoder
  document.getElementById('decodeBcpBtn').addEventListener('click', decodeBCP);
  document.getElementById('bcpInput').addEventListener('keydown', e => { if (e.key==='Enter'){e.preventDefault();decodeBCP();} });

  // Validation
  document.getElementById('ean').addEventListener('blur', () => validateEAN(true));
  document.getElementById('palierCommande').addEventListener('blur', () => validatePalier(true));

  // Form submit
  document.getElementById('ficheForm').addEventListener('submit', e => { e.preventDefault(); addProduct(); });

  // Reset
  document.getElementById('resetBtn').addEventListener('click', () => resetForm(true));

  // Export + clear
  document.getElementById('exportBtn').addEventListener('click', exportExcel);
  document.getElementById('clearBtn').addEventListener('click', clearBatch);

  // Toggles collapsibles
  setupToggle('autoToggle',     'autoContent',     'autoArrow',     false);
  setupToggle('allergenToggle', 'allergenContent', 'allergenArrow', false);
  setupToggle('nutriToggle',    'nutriContent',    'nutriArrow',    true);  // nutrition fermé par défaut

  // ── Import ──
  const uploadZone    = document.getElementById('uploadZone');
  const fileInput     = document.getElementById('fileInput');

  document.getElementById('uploadBrowseBtn').addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') fileInput.click(); });

  uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop',      e => {
    e.preventDefault(); uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  document.getElementById('changeFileBtn').addEventListener('click', resetImport);
  document.getElementById('doImportBtn').addEventListener('click', doImport);

  // ── Import intelligent ──
  initImportSubtabs();
  initSmartImport();

  // ── Visuels ──
  initImageProcessing();
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('tabManual').style.display = tab === 'manual' ? 'flex' : 'none';
  document.getElementById('tabImport').style.display = tab === 'import' ? 'flex' : 'none';
  document.getElementById('tabImages').style.display = tab === 'images' ? 'flex' : 'none';
  document.getElementById('tabManual').classList.toggle('active', tab === 'manual');
  document.getElementById('tabImport').classList.toggle('active', tab === 'import');
  document.getElementById('tabImages').classList.toggle('active', tab === 'images');
}

// ─── Rayon ────────────────────────────────────────────────────────────────────
function selectRayon(rayon) {
  currentRayon = rayon;
  const cfg = RAYON[rayon];
  document.querySelectorAll('.rayon-btn').forEach(b => b.classList.toggle('active', b.dataset.rayon === rayon));
  document.getElementById('mainTitle').textContent = cfg.label;
  document.getElementById('mainSub').textContent   = cfg.sub;
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('ficheForm').style.display   = 'block';
  renderChips('condSugg', cfg.cond, 'conditionnement');
  renderChips('bandSugg', cfg.band, 'infoBandeau');
  renderRayonFields(rayon);
  document.getElementById('ean').focus();
}

function renderChips(containerId, items, targetId) {
  const c = document.getElementById(containerId);
  c.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'chip'; btn.textContent = item;
    btn.addEventListener('click', () => {
      const el = document.getElementById(targetId);
      el.value = item;
      el.dispatchEvent(new Event('input'));
    });
    c.appendChild(btn);
  });
}

// ─── Champs spécifiques rayon ─────────────────────────────────────────────────
function renderRayonFields(rayon) {
  const card   = document.getElementById('rayonCard');
  const title  = document.getElementById('rayonCardTitle');
  const badge  = document.getElementById('rayonCardBadge');
  const fields = document.getElementById('rayonFields');
  badge.textContent = rayon;
  let html = '';

  switch (rayon) {
    case 'R20':
      title.textContent = 'Champs spécifiques — Charcuterie / Traiteur / Fromage';
      html = `<div class="rfields-grid">
        <div class="field full">
          <label for="ingredients">Ingrédients <span class="req">*</span></label>
          <textarea id="ingredients" rows="3" placeholder="Copier-coller depuis la source…"></textarea>
          <div class="hint">Obligatoire — allergènes en MAJUSCULES dans la liste</div>
        </div>
        <div class="field">
          <label class="flag-toggle"><input type="checkbox" id="allergenes">
            <div class="ft-box"><div><div class="ft-label">Allergènes présents</div><div class="ft-hint">TRUE si mots en MAJUSCULES dans les ingrédients</div></div></div>
          </label>
        </div>
        <div class="field"><label for="valeursNutri">Valeurs nutritionnelles</label>
          <textarea id="valeursNutri" rows="2" placeholder="Si disponibles…"></textarea>
        </div>
        <div class="field"><label for="conservation">Conservation <span class="req">*</span></label>
          ${buildSelect('conservation', CONSERVATION_OPTIONS)}</div>
      </div>`;
      break;
    case 'R21':
      title.textContent = 'Champs spécifiques — Poissonnerie';
      html = `<div class="rfields-grid">
        <div class="field full"><label for="ingredients">Ingrédients</label>
          <textarea id="ingredients" rows="2" placeholder="Laisser vide pour produits bruts"></textarea>
          <div class="hint">Produits bruts → champ vide</div>
        </div>
        <div class="field"><label for="facettePecheElevage">Facette Pêche / Élevage <span class="req">*</span></label>
          <select id="facettePecheElevage"><option value="">— Sélectionner —</option><option value="pêché">Pêché</option><option value="élevé">Élevé</option></select>
          <div class="hint">ELV dans BCP → élevé · Huîtres → toujours élevé</div>
        </div>
        <div class="field"><label for="nomLatin">Nom latin <span class="req">*</span></label>
          <input type="text" id="nomLatin" placeholder="Ex : Salmo salar" autocomplete="off">
          <div class="hint">Obligatoire pour poissons et crustacés</div>
        </div>
        <div class="field"><label for="conservation">Conservation <span class="req">*</span></label>
          ${buildSelect('conservation', CONSERVATION_OPTIONS)}</div>
      </div>`;
      break;
    case 'R22':
      title.textContent = 'Champs spécifiques — Fruits et Légumes';
      html = `<div class="rfields-grid">
        <div class="field"><label for="categorie">Catégorie <span class="req">*</span></label>
          <select id="categorie"><option value="">— Sélectionner —</option><option value="1">1 — Non bio</option><option value="2">2 — Bio</option></select>
          <div class="hint">Bio → catégorie 2</div>
        </div>
      </div>`;
      break;
    case 'R23':
      title.textContent = 'Champs spécifiques — BVP';
      html = `<div class="rfields-grid">
        <div class="field full"><label for="ingredients">Ingrédients <span class="req">*</span></label>
          <textarea id="ingredients" rows="3" placeholder="Obligatoire…"></textarea>
        </div>
        <div class="field"><label class="flag-toggle"><input type="checkbox" id="allergenes">
            <div class="ft-box"><div><div class="ft-label">Allergènes présents</div><div class="ft-hint">Mots en MAJUSCULES dans les ingrédients</div></div></div>
          </label>
        </div>
        <div class="field"><label for="valeursEnergetiques2">Valeurs énergétiques</label>
          <textarea id="valeursEnergetiques2" rows="2" placeholder="Si disponibles…"></textarea>
        </div>
        <div class="field"><label for="conservation">Conservation <span class="req">*</span></label>
          ${buildSelect('conservation', CONSERVATION_OPTIONS)}</div>
      </div>`;
      break;
    case 'R24':
      title.textContent = 'Champs spécifiques — Boucherie';
      html = `<div class="rfields-grid">
        <div class="field"><label class="flag-toggle"><input type="checkbox" id="viandeBovine">
          <div class="ft-box"><div><div class="ft-label">Viande Bovine Française</div><div class="ft-hint">TRUE si indiqué dans le libellé BCP</div></div></div>
        </label></div>
        <div class="field"><label class="flag-toggle"><input type="checkbox" id="porcFrancais">
          <div class="ft-box"><div><div class="ft-label">Porc Français</div><div class="ft-hint">TRUE si indiqué dans le libellé BCP</div></div></div>
        </label></div>
      </div>`;
      break;
  }
  fields.innerHTML = html;
  card.style.display = html ? 'block' : 'none';
}

function buildSelect(id, options) {
  return `<select id="${id}">${options.map(o=>`<option value="${o.value}">${o.label}</option>`).join('')}</select>`;
}

// ─── Libellé preview ─────────────────────────────────────────────────────────
function updateLibellePreview() {
  const nature  = val('natureBrute');
  const preview = document.getElementById('libellePreview');
  if (!nature) { preview.innerHTML='<span class="lp-placeholder">Le libellé apparaîtra ici en temps réel…</span>'; return; }
  const parts = [capitalizeLibelle(nature)];
  const attr  = val('attribut');
  const marq  = val('marque');
  if (attr) parts.push(capitalizeLibelle(attr));
  if (marq) parts.push(removeAccents(marq.toUpperCase()));
  preview.textContent = parts.join(' ');
}

function autoDetectFlags() {
  const txt = [val('natureBrute'),val('attribut'),val('marque')].join(' ').toLowerCase();
  document.getElementById('flagBio').checked = /\bbio\b/.test(txt);
  document.getElementById('flagFQC').checked = /\bfqc\b|\bfili[eè]re\s+qualit[eé]\b/.test(txt);
}

// ─── Auto-extraction palier / bandeau depuis le conditionnement ───────────────
// "la barquette de 480g" → bandeau:"480g", palier:"0.480"
// "la pièce de 1,5kg"   → bandeau:"1.5kg", palier:"1.500"
function extractFromConditionnement(cond) {
  if (!cond) return null;

  // Cherche d'abord en kilogrammes, puis en grammes (ordre de priorité)
  const kgMatch = cond.match(/(\d+[.,]?\d*)\s*kg/i);
  const gMatch  = cond.match(/(\d+[.,]?\d*)\s*g\b/i);

  let kg = null;
  let band = null;

  if (kgMatch) {
    kg   = parseFloat(kgMatch[1].replace(',', '.'));
    band = `${kg}kg`;
  } else if (gMatch) {
    const g = parseFloat(gMatch[1].replace(',', '.'));
    kg   = g / 1000;
    band = `${g}g`;
  }

  if (kg === null || isNaN(kg) || kg <= 0) return null;
  return { band, palier: kg.toFixed(3) };
}

function applyConditionnementExtraction() {
  const cond    = val('conditionnement');
  const result  = extractFromConditionnement(cond);
  if (!result) return;

  const bandEl   = document.getElementById('infoBandeau');
  const palierEl = document.getElementById('palierCommande');

  // N'écrase que les champs vides pour respecter la saisie manuelle
  if (!bandEl.value) bandEl.value = result.band;
  // Le palier n'est pertinent que si "poids variable" est activé
  const poidsVar = document.getElementById('poidsVariable');
  if (poidsVar && poidsVar.checked && !palierEl.value) palierEl.value = result.palier;
}

// ─── BCP decoder ──────────────────────────────────────────────────────────────
function decodeBCP() {
  const input = document.getElementById('bcpInput').value.trim();
  if (!input) return;
  const decoded = input.split(/\s+/).map(w => BCP_ABBR[w.toUpperCase()] || w).join(' ');
  const res = document.getElementById('bcpResult');
  res.textContent = decoded; res.style.display = 'block';
}

// ─── Lecture du formulaire ────────────────────────────────────────────────────
function getFormData() {
  // Allergènes checkboxes
  const allergens = {};
  document.querySelectorAll('[data-al]').forEach(cb => { allergens[cb.dataset.al] = cb.checked; });

  const data = {
    rayon:               currentRayon,
    ean:                 val('ean'),
    natureBrute:         val('natureBrute'),
    attribut:            val('attribut'),
    marque:              val('marque'),
    conditionnement:     val('conditionnement'),
    infoBandeau:         val('infoBandeau'),
    palierCommande:      document.getElementById('poidsVariable').checked ? val('palierCommande') : '',
    flagBio:             checked('flagBio'),
    flagFQC:             checked('flagFQC'),
    allergens,
    valeursEnergetiques: val('valeursEnergetiques'),
    graisses:            val('graisses'),
    grasSatures:         val('grasSatures'),
    glucides:            val('glucides'),
    sucres:              val('sucres'),
    proteines:           val('proteines'),
    sel:                 val('sel'),
  };

  switch (currentRayon) {
    case 'R20':
      data.ingredients  = val('ingredients');
      data.allergens    = checked('allergens');
      data.valeursNutri = val('valeursNutri');
      data.conservation = val('conservation');
      break;
    case 'R21':
      data.ingredients         = val('ingredients');
      data.facettePecheElevage = val('facettePecheElevage');
      data.nomLatin            = val('nomLatin');
      data.conservation        = val('conservation');
      break;
    case 'R22':
      data.categorie = val('categorie');
      break;
    case 'R23':
      data.ingredients         = val('ingredients');
      data.allergens           = checked('allergens');
      data.valeursEnergetiques = val('valeursEnergetiques2') || data.valeursEnergetiques;
      data.conservation        = val('conservation');
      break;
    case 'R24':
      data.viandeBovine = checked('viandeBovine');
      data.porcFrancais = checked('porcFrancais');
      break;
  }
  return data;
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateEAN(show=true) {
  const ean = val('ean');
  if (!ean) return true;
  if (/\s/.test(ean))         { if(show) showFieldErr('eanErr',"L'EAN ne doit pas contenir d'espaces"); return false; }
  if (!/^\d{8,13}$/.test(ean)){ if(show) showFieldErr('eanErr',"L'EAN doit contenir 8 à 13 chiffres"); return false; }
  clearErr('eanErr'); return true;
}
function validatePalier(show=true) {
  const p = val('palierCommande');
  if (!p) return true;
  if (!/^\d+\.\d{3}$/.test(p)) { if(show) showFieldErr('palierErr','Format requis : X.XXX (ex: 0.080)'); return false; }
  clearErr('palierErr'); return true;
}
function validateForm(data) {
  if (!data.ean)             { toast("L'EAN est obligatoire",'error'); return false; }
  if (!validateEAN(true))    return false;
  if (!data.natureBrute)     { toast('La Nature brute est obligatoire','error'); return false; }
  if (!data.conditionnement) { toast('Le Conditionnement est obligatoire','error'); return false; }
  if (document.getElementById('poidsVariable').checked && !validatePalier(true)) return false;
  return true;
}

// ─── Lot de produits ──────────────────────────────────────────────────────────
function addProduct() {
  const data = getFormData();
  if (!validateForm(data)) return;
  products.push(data);
  renderProductList(); updateButtons();
  toast('Produit ajouté au lot !','success');
  resetForm(true);
}

function removeProduct(idx) {
  products.splice(idx, 1);
  renderProductList(); updateButtons();
}

function clearBatch() {
  if (!products.length) return;
  if (!confirm(`Vider le lot de ${products.length} produit(s) ?`)) return;
  products = []; renderProductList(); updateButtons();
}

function renderProductList() {
  const list  = document.getElementById('rpList');
  const badge = document.getElementById('rpBadge');
  const cnt   = document.getElementById('topCount');
  badge.textContent = products.length;
  cnt.textContent   = products.length;
  if (!products.length) { list.innerHTML='<div class="rp-empty">Aucun produit ajouté</div>'; return; }
  list.innerHTML = products.map((p,i) => {
    const lib = buildLibelle(p) || '(sans libellé)';
    return `<div class="prod-item">
      <div class="prod-header">
        <div style="flex:1;min-width:0">
          <div class="prod-libelle">${lib}</div>
          <div class="prod-ean">EAN : ${p.ean||'—'}</div>
        </div>
        <span class="prod-rayon-tag">${p.rayon||'?'}</span>
        <button class="prod-dup" onclick="duplicateProduct(${i})" title="Dupliquer cette fiche">⧉</button>
        <button class="prod-del" onclick="removeProduct(${i})" title="Supprimer">×</button>
      </div>
    </div>`;
  }).join('');
}

// ─── Duplication de fiche ─────────────────────────────────────────────────────
function duplicateProduct(idx) {
  const src = products[idx];
  if (!src) return;

  // Basculer sur l'onglet saisie manuelle
  switchTab('manual');

  // Sélectionner le rayon source
  if (src.rayon) selectRayon(src.rayon);

  // Remplir les champs standard (micro-délai pour que renderRayonFields soit terminé)
  setTimeout(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

    set('ean',                '');           // EAN vide → l'utilisateur doit le saisir
    set('natureBrute',        src.natureBrute);
    set('attribut',           src.attribut);
    set('marque',             src.marque);
    set('conditionnement',    src.conditionnement);
    set('infoBandeau',        src.infoBandeau);
    set('valeursEnergetiques',src.valeursEnergetiques);
    set('graisses',           src.graisses);
    set('grasSatures',        src.grasSatures);
    set('glucides',           src.glucides);
    set('sucres',             src.sucres);
    set('proteines',          src.proteines);
    set('sel',                src.sel);
    chk('flagBio',            src.flagBio);
    chk('flagFQC',            src.flagFQC);

    // Poids variable + palier
    if (src.palierCommande) {
      chk('poidsVariable', true);
      document.getElementById('palierRow').style.display = 'grid';
      set('palierCommande', src.palierCommande);
    }

    // Allergènes
    if (src.allergens) {
      document.querySelectorAll('[data-al]').forEach(cb => {
        cb.checked = !!src.allergens[cb.dataset.al];
      });
    }

    // Champs spécifiques rayon
    const setIfExists = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    const chkIfExists = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    setIfExists('ingredients',          src.ingredients);
    setIfExists('conservation',         src.conservation);
    setIfExists('nomLatin',             src.nomLatin);
    setIfExists('facettePecheElevage',  src.facettePecheElevage);
    setIfExists('categorie',            src.categorie);
    chkIfExists('allergenes',           src.allergenes);
    chkIfExists('viandeBovine',         src.viandeBovine);
    chkIfExists('porcFrancais',         src.porcFrancais);

    updateLibellePreview();
    document.getElementById('ean').focus();
    toast(`Fiche dupliquée — saisissez le nouvel EAN`, 'info');
  }, 60);
}

function updateButtons() {
  const has = products.length > 0;
  document.getElementById('exportBtn').disabled = !has;
  document.getElementById('clearBtn').disabled  = !has;
}

// ─── Reset formulaire ─────────────────────────────────────────────────────────
function resetForm(keepRayon=true) {
  ['ean','natureBrute','attribut','marque','conditionnement','infoBandeau','palierCommande',
   'valeursEnergetiques','graisses','grasSatures','glucides','sucres','proteines','sel'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  ['poidsVariable','flagBio','flagFQC'].forEach(id => { const el=document.getElementById(id); if(el) el.checked=false; });
  document.querySelectorAll('[data-al]').forEach(cb => cb.checked=false);
  document.getElementById('palierRow').style.display='none';
  document.getElementById('libellePreview').innerHTML='<span class="lp-placeholder">Le libellé apparaîtra ici en temps réel…</span>';
  document.getElementById('bcpInput').value='';
  document.getElementById('bcpResult').style.display='none';
  clearErr('eanErr'); clearErr('palierErr');
  if (keepRayon && currentRayon) { renderRayonFields(currentRayon); document.getElementById('ean').focus(); }
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTRÔLE QUALITÉ PRÉ-EXPORT
// ═════════════════════════════════════════════════════════════════════════════


// Extrait le poids en kg depuis un texte libre
function extractKgFromText(text) {
  if (!text) return null;
  const kg = text.match(/(\d+[.,]?\d*)\s*kg/i);
  if (kg) return parseFloat(kg[1].replace(',', '.'));
  const g  = text.match(/(\d+[.,]?\d*)\s*g\b/i);
  if (g)  return parseFloat(g[1].replace(',', '.')) / 1000;
  return null;
}

// Mapping allergène → mots-clés MAJUSCULES dans les ingrédients
const ALLERGEN_KEYWORDS = {
  gluten:      ['GLUTEN','BLE','FROMENT','SEIGLE','ORGE','AVOINE','EPEAUTRE','KAMUT','TRITICALE'],
  lait:        ['LAIT','LACTOSE','BEURRE','CREME','FROMAGE','WHEY','CASÉINE','CASEINE'],
  soja:        ['SOJA','SOYA'],
  arachides:   ['ARACHIDE','CACAHUETE','CACAHUÈTE'],
  celeri:      ['CELERI','CÉLERI'],
  oeufs:       ['OEUF','ŒUF','ALBUMINE','LYSOZYME'],
  crustaces:   ['CRUSTACE','CRUSTACÉ','CREVETTE','HOMARD','LANGOUSTE','CRABE'],
  poisson:     ['POISSON','ANCHOIS','SARDINE','THON','SAUMON','CABILLAUD','MERLU'],
  fruitsACoque:['NOIX','AMANDE','NOISETTE','NOIX DE CAJOU','PISTACHE','PECAN','MACADAMIA','PÉCAN'],
  moutarde:    ['MOUTARDE'],
  sesame:      ['SESAME','SÉSAME','TAHINI'],
  sulfites:    ['SULFITE','DIOXYDE DE SOUFRE','ANHYDRIDE SULFUREUX'],
  lupin:       ['LUPIN'],
  mollusques:  ['MOLLUSQUE','MOULE','HUÎTRE','HUITRE','CALAMAR','SEICHE','ESCARGOT'],
};

function auditProduct(p, idx) {
  const errors   = []; // bloquants
  const warnings = []; // non-bloquants

  const label = buildLibelle(p) || `Produit #${idx + 1}`;

  // ── Champs obligatoires universels ──────────────────────────────────────────
  if (!p.ean)           errors.push('EAN manquant');
  if (!p.natureBrute)   errors.push('Nature brute manquante');
  if (!p.conditionnement) errors.push('Conditionnement manquant');

  // ── EAN : format uniquement ────────────────────────────────────────────────
  if (p.ean && !/^\d{8,13}$/.test(p.ean))
    errors.push(`EAN invalide : "${p.ean}" (doit être 8 à 13 chiffres)`);

  // ── Palier cohérent avec le poids du conditionnement ────────────────────────
  if (p.palierCommande && p.conditionnement) {
    const palierKg = parseFloat(p.palierCommande);
    const condKg   = extractKgFromText(p.conditionnement);
    if (condKg && palierKg && Math.abs(palierKg - condKg) / condKg > 0.15) {
      warnings.push(`Palier ${p.palierCommande} kg incohérent avec "${p.conditionnement}" (attendu ~${condKg.toFixed(3)} kg)`);
    }
  }

  // ── Flags Bio / FQC cohérents avec le libellé ────────────────────────────────
  const libLow = (buildLibelle(p) + ' ' + (p.attribut || '')).toLowerCase();
  if (!p.flagBio && /\bbio\b/.test(libLow))
    warnings.push('Flag Bio non coché alors que "bio" apparaît dans le libellé');
  if (!p.flagFQC && /\bfqc\b|\bfili.re qualit/.test(libLow))
    warnings.push('Flag FQC non coché alors que "FQC" apparaît dans le libellé');

  // ── Allergènes cohérents avec les ingrédients ───────────────────────────────
  if (p.ingredients) {
    const ingUp = p.ingredients.toUpperCase();
    Object.entries(ALLERGEN_KEYWORDS).forEach(([al, keywords]) => {
      const found    = keywords.some(kw => ingUp.includes(kw));
      const checked  = p.allergens && p.allergens[al];
      if (found && !checked)
        errors.push(`Allergène détecté dans les ingrédients (${keywords[0]}) mais "${al}" non coché`);
    });
  }

  // ── Champs obligatoires spécifiques rayon ───────────────────────────────────
  if (p.rayon === 'R20' || p.rayon === 'R23') {
    if (!p.ingredients)  warnings.push('Ingrédients non renseignés (obligatoire en R20/R23)');
    if (!p.conservation) warnings.push('Conservation non renseignée');
  }
  if (p.rayon === 'R21') {
    if (!p.nomLatin)             warnings.push('Nom latin manquant (obligatoire en poissonnerie)');
    if (!p.facettePecheElevage)  warnings.push('Facette Pêche/Élevage manquante');
    if (!p.conservation)         warnings.push('Conservation non renseignée');
  }
  if (p.rayon === 'R22' && !p.categorie)
    warnings.push('Catégorie (Bio/Non-bio) non renseignée');

  return { label, errors, warnings, idx };
}

function runQualityCheck() {
  return products.map((p, i) => auditProduct(p, i));
}

// ─── Modal contrôle qualité ───────────────────────────────────────────────────
function showQCModal(results, onConfirm) {
  // Compter erreurs et avertissements totaux
  const totalErrors   = results.reduce((n, r) => n + r.errors.length,   0);
  const totalWarnings = results.reduce((n, r) => n + r.warnings.length, 0);
  const hasErrors     = totalErrors > 0;

  // Construire le contenu
  const rows = results
    .filter(r => r.errors.length || r.warnings.length)
    .map(r => {
      const errHtml = r.errors.map(e =>
        `<li class="qc-item qc-error"><span class="qc-icon">✗</span>${e}</li>`).join('');
      const wrnHtml = r.warnings.map(w =>
        `<li class="qc-item qc-warn"><span class="qc-icon">⚠</span>${w}</li>`).join('');
      return `<div class="qc-product">
        <div class="qc-product-label">${r.label} <span class="qc-rayon">${products[r.idx].rayon||'?'}</span></div>
        <ul class="qc-list">${errHtml}${wrnHtml}</ul>
      </div>`;
    }).join('');

  const bodyHtml = rows || '<div class="qc-ok">✅ Toutes les fiches sont valides !</div>';

  const modal = document.createElement('div');
  modal.className = 'qc-overlay';
  modal.innerHTML = `
    <div class="qc-modal">
      <div class="qc-header">
        <div class="qc-title">Contrôle qualité avant export</div>
        <div class="qc-summary ${hasErrors ? 'has-errors' : totalWarnings ? 'has-warnings' : 'all-ok'}">
          ${hasErrors
            ? `${totalErrors} erreur(s) bloquante(s) · ${totalWarnings} avertissement(s)`
            : totalWarnings
              ? `${totalWarnings} avertissement(s) — export possible`
              : `${products.length} fiche(s) validée(s) — aucun problème`
          }
        </div>
      </div>
      <div class="qc-body">${bodyHtml}</div>
      <div class="qc-footer">
        <button class="btn btn-ghost" id="qcCloseBtn">Corriger</button>
        ${!hasErrors
          ? `<button class="btn btn-export" id="qcConfirmBtn">📥 Exporter quand même</button>`
          : ''
        }
        ${!hasErrors && !totalWarnings
          ? `<button class="btn btn-export" id="qcConfirmBtn">📥 Exporter</button>`
          : ''
        }
      </div>
    </div>`;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('qc-visible'));

  modal.querySelector('#qcCloseBtn').addEventListener('click', () => closeQCModal(modal));
  const confirmBtn = modal.querySelector('#qcConfirmBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => { closeQCModal(modal); onConfirm(); });
  }
  modal.addEventListener('click', e => { if (e.target === modal) closeQCModal(modal); });
}

function closeQCModal(modal) {
  modal.classList.remove('qc-visible');
  setTimeout(() => modal.remove(), 250);
}

// ─── Export Excel ─────────────────────────────────────────────────────────────
async function exportExcel() {
  if (!products.length) return;

  // Contrôle qualité avant export
  const qcResults  = runQualityCheck();
  const hasErrors  = qcResults.some(r => r.errors.length > 0);
  const hasIssues  = qcResults.some(r => r.errors.length || r.warnings.length);

  if (hasErrors || hasIssues) {
    showQCModal(qcResults, () => doExport());
    return;
  }
  doExport();
}

async function doExport() {
  const btn = document.getElementById('exportBtn');
  btn.textContent='⏳ Génération…'; btn.disabled=true;
  try {
    const res = await fetch('/api/export',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ products })
    });
    if (!res.ok) { const e=await res.json(); throw new Error(e.error||'Erreur serveur'); }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `fiche-light-${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
    toast(`${products.length} fiche(s) exportée(s) !`,'success');
  } catch(err) {
    const msg = err.message || '';
    if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('Load failed')) {
      toast('Serveur injoignable — lancez "npm start" puis ouvrez http://localhost:3003', 'error');
    } else {
      toast('Erreur export : ' + msg, 'error');
    }
  } finally {
    btn.innerHTML='📥 Exporter en Excel'; btn.disabled=!products.length;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// IMPORT FICHIER
// ═════════════════════════════════════════════════════════════════════════════

function handleFile(file) {
  const allowed = ['.xlsx','.xls','.csv'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowed.includes(ext)) { toast('Format non supporté. Utilisez .xlsx, .xls ou .csv','error'); return; }

  const reader = new FileReader();
  reader.onload = async e => {
    const b64 = btoa(String.fromCharCode(...new Uint8Array(e.target.result)));
    try {
      const res  = await fetch('/api/import',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ fileBase64: b64 })
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Erreur import','error'); return; }
      showMappingUI(file.name, data);
    } catch(err) {
      toast('Erreur lors de la lecture du fichier : '+err.message,'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function showMappingUI(fileName, data) {
  importedRows = data.rows;
  columnMapping = autoDetectMapping(data.headers);

  document.getElementById('uploadZone').style.display   = 'none';
  document.getElementById('mappingSection').style.display = 'block';
  document.getElementById('importFileName').textContent = '📄 ' + fileName;
  document.getElementById('importRowCount').textContent = data.totalRows + ' lignes détectées';
  document.getElementById('importActionInfo').textContent = `${data.totalRows} produit(s) à importer`;

  // Table de mapping
  const tbody = document.getElementById('mappingTableBody');
  tbody.innerHTML = '';
  data.headers.forEach(header => {
    const mapped = columnMapping[header] || '';
    const sample = data.preview[0] ? String(data.preview[0][header] || '').slice(0, 60) : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="source-col">${header}</span></td>
      <td>${buildMappingSelect(header, mapped)}</td>
      <td><span class="sample-val" title="${sample}">${sample || '—'}</span></td>`;
    tbody.appendChild(tr);
  });

  // Coloriser les selects déjà mappés
  document.querySelectorAll('.mapping-select').forEach(sel => {
    sel.classList.toggle('mapped', !!sel.value);
    sel.addEventListener('change', () => {
      columnMapping[sel.dataset.col] = sel.value;
      sel.classList.toggle('mapped', !!sel.value);
    });
  });

  // Preview table
  buildPreviewTable(data.headers, data.preview);
}

function buildMappingSelect(sourceCol, detectedField) {
  const opts = Object.entries(FIELD_LABELS).map(([k,v]) =>
    `<option value="${k}" ${k===detectedField?'selected':''}>${v}</option>`
  ).join('');
  return `<select class="mapping-select" data-col="${sourceCol}">${opts}</select>`;
}

function buildPreviewTable(headers, rows) {
  const table = document.getElementById('previewTable');
  const thead = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(row=>`<tr>${headers.map(h=>`<td title="${row[h]}">${String(row[h]||'').slice(0,40)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  table.innerHTML = thead + tbody;
}

function autoDetectMapping(headers) {
  const mapping = {};
  headers.forEach(header => {
    const norm = normalizeStr(header);
    for (const [field, aliases] of Object.entries(IMPORT_FIELD_ALIASES)) {
      if (aliases.some(a => normalizeStr(a) === norm || norm.includes(normalizeStr(a)))) {
        mapping[header] = field;
        break;
      }
    }
  });
  return mapping;
}

function normalizeStr(s) {
  return removeAccents(String(s).toLowerCase().trim()).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ');
}

function doImport() {
  if (!importedRows.length) return;

  // Lire le mapping courant depuis les selects
  document.querySelectorAll('.mapping-select').forEach(sel => {
    columnMapping[sel.dataset.col] = sel.value;
  });

  // Vérifier qu'on a au moins l'EAN ou la Nature brute
  const hasEan     = Object.values(columnMapping).includes('ean');
  const hasNature  = Object.values(columnMapping).includes('natureBrute');
  if (!hasEan && !hasNature) {
    toast('Mappez au moins le champ EAN ou Nature brute avant d\'importer','error'); return;
  }

  let count = 0;
  importedRows.forEach(row => {
    const p = buildProductFromRow(row, columnMapping);
    if (p.ean || p.natureBrute) { products.push(p); count++; }
  });

  renderProductList(); updateButtons();
  toast(`${count} produit(s) importé(s) dans le lot !`,'success');
  resetImport();
  switchTab('manual');
}

function buildProductFromRow(row, mapping) {
  const get = field => {
    const sourceCol = Object.keys(mapping).find(k => mapping[k] === field);
    return sourceCol ? String(row[sourceCol] || '').trim() : '';
  };
  const getBool = field => parseBool(get(field));

  // Rayon : essayer de détecter depuis la valeur ou la colonne
  let rayon = get('rayon').toUpperCase();
  if (!['R20','R21','R22','R23','R24'].includes(rayon)) {
    // Essayer de déduire depuis d'autres colonnes
    rayon = currentRayon || 'R20';
  }

  // Allergènes
  const allergens = {};
  ['gluten','lait','soja','arachides','celeri','oeufs','crustaces','poisson',
   'fruitsACoque','moutarde','sesame','sulfites','lupin','mollusques'].forEach(k => {
    allergens[k] = getBool(`al.${k}`);
  });

  return {
    rayon,
    ean:                  get('ean'),
    natureBrute:          get('natureBrute'),
    attribut:             get('attribut'),
    marque:               get('marque'),
    conditionnement:      get('conditionnement'),
    infoBandeau:          get('infoBandeau'),
    palierCommande:       get('palierCommande'),
    flagBio:              getBool('flagBio'),
    flagFQC:              getBool('flagFQC'),
    allergens,
    valeursEnergetiques:  get('valeursEnergetiques'),
    graisses:             get('graisses'),
    grasSatures:          get('grasSatures'),
    glucides:             get('glucides'),
    sucres:               get('sucres'),
    proteines:            get('proteines'),
    sel:                  get('sel'),
    ingredients:          get('ingredients'),
    conservation:         get('conservation'),
    nomLatin:             get('nomLatin'),
    facettePecheElevage:  get('facettePecheElevage'),
    categorie:            get('categorie'),
    viandeBovine:         getBool('viandeBovine'),
    porcFrancais:         getBool('porcFrancais'),
  };
}

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number')  return v !== 0;
  return ['true','vrai','oui','yes','1','x','TRUE','OUI'].includes(String(v).trim());
}

function resetImport() {
  importedRows  = [];
  columnMapping = {};
  document.getElementById('uploadZone').style.display     = 'block';
  document.getElementById('mappingSection').style.display = 'none';
  document.getElementById('fileInput').value              = '';
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function setupToggle(toggleId, contentId, arrowId, startCollapsed) {
  const content = document.getElementById(contentId);
  const arrow   = document.getElementById(arrowId);
  if (startCollapsed) { content.style.display='none'; arrow.classList.add('collapsed'); }
  document.getElementById(toggleId).addEventListener('click', () => {
    const hidden = content.style.display === 'none';
    content.style.display = hidden ? 'block' : 'none';
    arrow.classList.toggle('collapsed', !hidden);
  });
}

function val(id) { const el=document.getElementById(id); return el ? el.value.trim() : ''; }
function checked(id) { const el=document.getElementById(id); return el ? el.checked : false; }

function buildLibelle(p) {
  const parts = [];
  if (p.natureBrute) parts.push(capitalizeLibelle(p.natureBrute));
  if (p.attribut)    parts.push(capitalizeLibelle(p.attribut));
  if (p.marque)      parts.push(removeAccents(String(p.marque).toUpperCase()));
  return parts.join(' ');
}

function capitalizeLibelle(str) {
  if (!str) return '';
  const liaisons = new Set(['de','du','des','le','la','les','et','en','au','aux','à','un','une','sur','sous','par','pour','avec','sans']);
  return str.trim().split(/\s+/).map((w,i)=>{
    const lw=w.toLowerCase();
    return (i===0||!liaisons.has(lw)) ? lw.charAt(0).toUpperCase()+lw.slice(1) : lw;
  }).join(' ');
}

function removeAccents(str) {
  return (str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function showFieldErr(id,msg){ const el=document.getElementById(id); if(!el)return; el.textContent=msg; el.classList.add('show'); }
function clearErr(id){ const el=document.getElementById(id); if(!el)return; el.textContent=''; el.classList.remove('show'); }

let toastTimer=null;
function toast(msg,type=''){
  const el=document.getElementById('toast');
  el.textContent=msg; el.className=`toast ${type}`;
  void el.offsetWidth; el.classList.add('show');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),3200);
}

// ═════════════════════════════════════════════════════════════════════════════
// IMPORT INTELLIGENT (CLAUDE VISION)
// ═════════════════════════════════════════════════════════════════════════════

let siExtracted = null;  // données extraites en attente de validation
let siFilename  = null;  // nom du fichier source (pour fallback EAN)

// Labels lisibles pour le panel résultats
const SI_FIELD_LABELS = {
  ean:               { label: 'EAN',                    group: 'identification' },
  natureBrute:       { label: 'Nature brute',           group: 'identification' },
  attribut:          { label: 'Attribut',               group: 'identification' },
  marque:            { label: 'Marque produit',         group: 'identification' },
  rayon:             { label: 'Rayon détecté',          group: 'identification' },
  conditionnement:   { label: 'Conditionnement',        group: 'commercial' },
  infoBandeau:       { label: 'Info bandeau',           group: 'commercial' },
  palierCommande:    { label: 'Palier de commande',     group: 'commercial' },
  flagBio:           { label: 'Flag Bio',               group: 'commercial' },
  flagFQC:           { label: 'Flag FQC',               group: 'commercial' },
  conservation:      { label: 'Conservation',           group: 'commercial' },
  ingredients:       { label: 'Ingrédients',            group: 'composition' },
  valeursEnergetiques:{ label: 'Valeur énergétique',   group: 'nutrition' },
  graisses:          { label: 'Matières grasses',       group: 'nutrition' },
  grasSatures:       { label: 'dont acides gras sat.',  group: 'nutrition' },
  glucides:          { label: 'Glucides',               group: 'nutrition' },
  sucres:            { label: 'dont sucres',            group: 'nutrition' },
  proteines:         { label: 'Protéines',              group: 'nutrition' },
  sel:               { label: 'Sel',                    group: 'nutrition' },
  nomLatin:          { label: 'Nom latin',              group: 'specifique' },
  facettePecheElevage:{ label: 'Pêche / Élevage',      group: 'specifique' },
  categorie:         { label: 'Catégorie',              group: 'specifique' },
  viandeBovine:      { label: 'Viande Bovine Française',group: 'specifique' },
  porcFrancais:      { label: 'Porc Français',          group: 'specifique' },
};

const SI_ALLERGEN_LABELS = {
  gluten:'Gluten', lait:'Lactose', soja:'Soja', arachides:'Arachides',
  celeri:'Céleri', oeufs:'Œufs', crustaces:'Crustacés', poisson:'Poisson',
  fruitsACoque:'Fruits à coque', moutarde:'Moutarde', sesame:'Sésame',
  sulfites:'Sulfites', lupin:'Lupin', mollusques:'Mollusques',
};

function initSmartImport() {
  fetch('/api/smart-import-status')
    .then(r => r.json())
    .then(s => {
      if (!s.available) {
        document.getElementById('siNoKey').style.display     = 'flex';
        document.getElementById('siUploadZone').style.display = 'none';
      }
    }).catch(() => {});

  const zone      = document.getElementById('siUploadZone');
  const fileInput = document.getElementById('siFileInput');

  document.getElementById('siBrowseBtn').addEventListener('click', () => fileInput.click());
  zone.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') fileInput.click(); });
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => SI_ALLOWED.includes(f.type));
    if (!files.length) { toast('Aucun fichier compatible (JPG, PNG, WEBP, PDF)', 'error'); return; }
    files.length === 1 ? handleSmartImportFile(files[0]) : handleBatchSmartImport(files);
  });
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    fileInput.value = '';
    if (!files.length) return;
    files.length === 1 ? handleSmartImportFile(files[0]) : handleBatchSmartImport(files);
  });

  // Résultats fichier unique
  document.getElementById('siRetryBtn').addEventListener('click',  resetSmartImport);
  document.getElementById('siRetryBtn2').addEventListener('click', resetSmartImport);
  document.getElementById('siFillBtn').addEventListener('click',          applySmartImport);
  document.getElementById('siDirectExportBtn').addEventListener('click',  exportSmartImportDirect);

  // Résultats batch
  document.getElementById('siBatchRetryBtn').addEventListener('click', resetSmartImport);
  document.getElementById('siBatchAddAllBtn').addEventListener('click', addAllBatchToLot);
  document.getElementById('siBatchExportBtn').addEventListener('click', exportBatchSelection);
  document.getElementById('siBatchSelectAll').addEventListener('change', e => {
    document.querySelectorAll('.si-batch-check').forEach(cb => {
      if (!cb.disabled) cb.checked = e.target.checked;
    });
  });
}

const SI_ALLOWED  = ['image/jpeg','image/png','image/webp','application/pdf'];
const SI_MAX_MB   = 20;
const SI_CONCURRENCY = 3; // fichiers traités en parallèle

// Résultats batch en mémoire : [{ file, status, data, error, product }]
let siBatchRows = [];

async function handleSmartImportFile(file) {
  if (file.size > SI_MAX_MB * 1024 * 1024) {
    toast(`Fichier trop volumineux (max ${SI_MAX_MB} MB)`, 'error'); return;
  }
  if (!SI_ALLOWED.includes(file.type)) {
    toast('Format non supporté — utilisez JPG, PNG, WEBP ou PDF', 'error'); return;
  }

  document.getElementById('siUploadZone').style.display   = 'none';
  document.getElementById('siProcessing').style.display   = 'flex';
  document.getElementById('siResults').style.display      = 'none';
  document.getElementById('siBatchResults').style.display = 'none';
  document.getElementById('siBatchProgWrap').style.display = 'none';
  document.getElementById('siProcessingTitle').textContent = 'Claude analyse le document…';
  document.getElementById('siProcessingSub').textContent =
    file.type === 'application/pdf' ? 'Lecture du PDF en cours…' : 'Analyse de l\'image…';

  try {
    // Redimensionner les images pour respecter la limite Claude (~5MB base64 max)
    const b64 = file.type === 'application/pdf'
      ? await fileToBase64(file)
      : await readFileAsBase64(file, 2048);

    const res  = await fetch('/api/smart-import', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fileBase64: b64, mimeType: file.type }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Erreur serveur');

    siExtracted = data.extracted;
    siFilename  = file.name;
    renderSmartImportResults(data);

  } catch (err) {
    toast('Erreur import intelligent : ' + err.message, 'error');
    resetSmartImport();
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => {
      // Retirer le préfixe data:...;base64,
      const result = e.target.result;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderSmartImportResults(data) {
  document.getElementById('siProcessing').style.display = 'none';
  document.getElementById('siResults').style.display    = 'block';

  const d   = data.extracted;
  const cfg = d.confidence || {};

  // Résumé
  document.getElementById('siResultSub').textContent =
    `${data.filledCount} champs extraits sur ${data.totalFields} · ${data.tokens || '?'} tokens utilisés`;

  // Barre de confiance globale
  const overall = cfg.overall || 'medium';
  const confMap = { high: { label: 'Confiance haute', cls: 'si-conf-high' },
                    medium: { label: 'Confiance moyenne', cls: 'si-conf-medium' },
                    low:  { label: 'Confiance faible — vérifiez les champs', cls: 'si-conf-low' } };
  const conf = confMap[overall] || confMap.medium;
  document.getElementById('siConfidenceBar').innerHTML =
    `<span class="si-conf-badge ${conf.cls}">${conf.label}</span>
     <span class="si-conf-hint">Champs modifiables directement · points verts = haute confiance</span>`;

  // Grille de champs
  const grid = document.getElementById('siFieldsGrid');
  grid.innerHTML = '';

  const BOOL_KEYS = new Set(['flagBio','flagFQC','viandeBovine','porcFrancais']);
  const LONG_KEYS = new Set(['ingredients','conservation']);

  const groups = [
    { id: 'identification', label: 'Identification' },
    { id: 'commercial',     label: 'Données commerciales' },
    { id: 'composition',    label: 'Composition' },
    { id: 'nutrition',      label: 'Valeurs nutritionnelles' },
    { id: 'specifique',     label: 'Champs spécifiques rayon' },
  ];

  groups.forEach(group => {
    const fields = Object.entries(SI_FIELD_LABELS).filter(([, v]) => v.group === group.id);
    const hasData = fields.some(([k]) => d[k] != null && d[k] !== false);
    if (!hasData) return;

    const section = document.createElement('div');
    section.className = 'si-group';
    section.innerHTML = `<div class="si-group-title">${group.label}</div>`;

    fields.forEach(([key, meta]) => {
      const value = d[key];
      if (value == null) return;

      const fieldConf = cfg[key] || overall;
      const isEmpty   = value === false || value === '' || value === null;
      if (isEmpty && !BOOL_KEYS.has(key)) return;

      const row = document.createElement('div');
      row.className = `si-field si-field-${fieldConf}`;

      let inputEl;
      if (BOOL_KEYS.has(key)) {
        // Checkbox éditable
        inputEl = document.createElement('select');
        inputEl.className = 'si-field-input si-field-select';
        inputEl.innerHTML = '<option value="true">✅ TRUE</option><option value="false">⬜ FALSE</option>';
        inputEl.value = value ? 'true' : 'false';
        inputEl.addEventListener('change', () => { siExtracted[key] = inputEl.value === 'true'; });
      } else if (LONG_KEYS.has(key)) {
        // Textarea pour les longs textes
        inputEl = document.createElement('textarea');
        inputEl.className = 'si-field-input si-field-textarea';
        inputEl.value = String(value);
        inputEl.rows  = 3;
        inputEl.addEventListener('input', () => { siExtracted[key] = inputEl.value; });
      } else {
        // Input texte simple
        inputEl = document.createElement('input');
        inputEl.type      = 'text';
        inputEl.className = 'si-field-input';
        inputEl.value     = String(value);
        inputEl.addEventListener('input', () => { siExtracted[key] = inputEl.value; });
      }

      const labelEl = document.createElement('div');
      labelEl.className   = 'si-field-label';
      labelEl.textContent = meta.label;

      const dotEl = document.createElement('div');
      dotEl.className = `si-field-conf si-conf-dot-${fieldConf}`;

      row.appendChild(labelEl);
      row.appendChild(inputEl);
      row.appendChild(dotEl);
      section.appendChild(row);
    });

    // Allergènes détectés (éditables)
    if (group.id === 'composition' && d.allergens) {
      const detected = Object.entries(d.allergens).filter(([,v]) => v).map(([k]) => SI_ALLERGEN_LABELS[k] || k);
      if (detected.length) {
        const row = document.createElement('div');
        row.className = `si-field si-field-${cfg.allergens || overall}`;
        row.innerHTML = `
          <div class="si-field-label">Allergènes détectés</div>
          <div class="si-field-value si-allergen-list">${detected.join(' · ')}</div>
          <div class="si-field-conf si-conf-dot-${cfg.allergens || overall}"></div>`;
        section.appendChild(row);
      }
    }

    if (section.children.length > 1) grid.appendChild(section);
  });

  // ── Recommandations intelligentes ──────────────────────────────────────────
  const recs = buildRecommendations(d);
  if (recs.length) {
    const recSection = document.createElement('div');
    recSection.className = 'si-recs-section';
    recSection.innerHTML = `<div class="si-group-title">💡 Recommandations</div>`;
    recs.forEach(rec => {
      const item = document.createElement('div');
      item.className = 'si-rec-item';
      item.innerHTML = `
        <div class="si-rec-text">
          <span class="si-rec-icon">${rec.icon}</span>
          <span>${rec.message}</span>
        </div>
        ${rec.action ? `<button class="btn btn-sm btn-outline si-rec-btn" data-key="${rec.key}" data-val="${String(rec.value).replace(/"/g,'&quot;')}">${rec.action}</button>` : ''}`;
      if (rec.action) {
        item.querySelector('.si-rec-btn').addEventListener('click', () => {
          siExtracted[rec.key] = rec.value;
          // Mettre à jour l'input correspondant s'il existe
          const inp = grid.querySelector(`[data-sikey="${rec.key}"]`);
          if (inp) inp.value = rec.value;
          item.classList.add('si-rec-applied');
          item.querySelector('.si-rec-btn').textContent = '✓ Appliqué';
          item.querySelector('.si-rec-btn').disabled = true;
          toast(`"${rec.key}" mis à jour`, 'info');
        });
      }
      recSection.appendChild(item);
    });
    grid.appendChild(recSection);
  }
}

function buildRecommendations(d) {
  const recs = [];

  if (!d.ean)
    recs.push({ icon: '⚠️', message: 'EAN manquant — scannez le code-barres du produit', key: 'ean', action: null, value: null });

  if (!d.natureBrute)
    recs.push({ icon: '⚠️', message: 'Nature brute manquante — champ obligatoire pour l\'export', key: 'natureBrute', action: null, value: null });

  if (!d.conditionnement && d.infoBandeau)
    recs.push({ icon: '💡', message: `Conditionnement non détecté — suggestion depuis Info bandeau`, key: 'conditionnement', action: '+ Appliquer', value: `la pièce de ${d.infoBandeau}` });

  if (!d.palierCommande && d.infoBandeau) {
    const kg = extractKgFromText(d.infoBandeau);
    if (kg) recs.push({ icon: '💡', message: `Palier de commande calculé depuis "${d.infoBandeau}"`, key: 'palierCommande', action: '+ Appliquer', value: kg.toFixed(3) });
  }

  if (d.marque && d.marque !== d.marque.toUpperCase())
    recs.push({ icon: '✏️', message: 'Marque doit être en MAJUSCULES sans accents', key: 'marque', action: '+ Corriger', value: d.marque.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'') });

  if (d.natureBrute && !d.attribut)
    recs.push({ icon: '💡', message: 'Attribut vide — précisez l\'origine ou la spécificité du produit', key: 'attribut', action: null, value: null });

  if (d.ingredients && d.allergens && !Object.values(d.allergens).some(Boolean))
    recs.push({ icon: '⚠️', message: 'Ingrédients présents mais aucun allergène détecté — vérifiez manuellement', key: null, action: null, value: null });

  if (!d.conservation && ['R20','R21','R24'].includes(d.rayon))
    recs.push({ icon: '💡', message: `Conservation manquante pour ${d.rayon} — obligatoire en frais`, key: 'conservation', action: '+ Ajouter', value: 'A conserver entre 0°C et +4°C' });

  return recs;
}

function resetSmartImport() {
  siExtracted = null;
  siFilename  = null;
  siBatchRows = [];
  document.getElementById('siUploadZone').style.display    = 'flex';
  document.getElementById('siProcessing').style.display    = 'none';
  document.getElementById('siResults').style.display       = 'none';
  document.getElementById('siBatchResults').style.display  = 'none';
  document.getElementById('siBatchProgWrap').style.display = 'none';
  const retryBtn = document.getElementById('siRetryBtn');
  if (retryBtn) retryBtn.textContent = '← Nouveau fichier';
}

function applySmartImport() {
  if (!siExtracted) return;
  const d = siExtracted;

  // Basculer sur la saisie manuelle
  switchTab('manual');

  // Sélectionner le rayon détecté
  const rayon = d.rayon && ['R20','R21','R22','R23','R24'].includes(d.rayon) ? d.rayon : null;
  if (rayon) selectRayon(rayon);

  setTimeout(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

    set('ean', (d.ean && String(d.ean).trim()) || (siFilename ? extractEanFromFilename(siFilename) : ''));
    set('natureBrute',         d.natureBrute);
    set('attribut',            d.attribut);
    set('marque',              d.marque);
    set('conditionnement',     d.conditionnement);
    set('infoBandeau',         d.infoBandeau);
    set('valeursEnergetiques', d.valeursEnergetiques);
    set('graisses',            d.graisses);
    set('grasSatures',         d.grasSatures);
    set('glucides',            d.glucides);
    set('sucres',              d.sucres);
    set('proteines',           d.proteines);
    set('sel',                 d.sel);
    chk('flagBio',             d.flagBio);
    chk('flagFQC',             d.flagFQC);

    // Palier de commande
    if (d.palierCommande) {
      chk('poidsVariable', true);
      document.getElementById('palierRow').style.display = 'grid';
      set('palierCommande', d.palierCommande);
    }

    // Allergènes
    if (d.allergens) {
      document.querySelectorAll('[data-al]').forEach(cb => {
        cb.checked = !!d.allergens[cb.dataset.al];
      });
    }

    // Champs spécifiques rayon
    const setIfExists = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    const chkIfExists = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    setIfExists('ingredients',         d.ingredients);
    setIfExists('conservation',        d.conservation);
    setIfExists('nomLatin',            d.nomLatin);
    setIfExists('facettePecheElevage', d.facettePecheElevage);
    setIfExists('categorie',           d.categorie);
    chkIfExists('viandeBovine',        d.viandeBovine);
    chkIfExists('porcFrancais',        d.porcFrancais);

    updateLibellePreview();
    autoDetectFlags();

    // Réinitialiser le panel pour la prochaine utilisation
    siExtracted = null;
    resetSmartImport();

    toast('Formulaire rempli depuis l\'import IA — vérifiez et ajoutez au lot', 'info');
    document.getElementById('ean').focus();
  }, rayon ? 80 : 0);
}

// ─── Export direct depuis le panel Smart Import ───────────────────────────────

async function exportSmartImportDirect() {
  if (!siExtracted) return;
  const d = siExtracted;

  if (!d.natureBrute) { toast('Nature brute obligatoire pour l\'export', 'error'); return; }
  if (!d.conditionnement) { toast('Conditionnement obligatoire pour l\'export', 'error'); return; }

  const btn = document.getElementById('siDirectExportBtn');
  btn.disabled    = true;
  btn.textContent = '⏳ Génération…';

  try {
    const resp = await fetch('/api/export', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ products: [d] }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const blob     = await resp.blob();
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const ean      = String(d.ean || 'fiche').replace(/\s/g,'');
    a.href         = url;
    a.download     = `${ean}_fiche-light.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Fiche exportée en Excel', 'success');
  } catch (err) {
    toast('Erreur export : ' + err.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '⬇ Exporter en Excel';
  }
}

// ─── Batch smart import ───────────────────────────────────────────────────────

async function handleBatchSmartImport(files) {
  const valid = files.filter(f => {
    if (!SI_ALLOWED.includes(f.type))  { toast(`"${f.name}" : format non supporté`, 'error'); return false; }
    if (f.size > SI_MAX_MB * 1024 * 1024) { toast(`"${f.name}" : trop volumineux (max ${SI_MAX_MB} MB)`, 'error'); return false; }
    return true;
  });
  if (!valid.length) return;

  siBatchRows = [];
  document.getElementById('siUploadZone').style.display    = 'none';
  document.getElementById('siResults').style.display       = 'none';
  document.getElementById('siBatchResults').style.display  = 'none';
  document.getElementById('siProcessing').style.display    = 'flex';
  document.getElementById('siProcessingTitle').textContent = `Traitement de ${valid.length} fichier(s) en cours…`;
  document.getElementById('siProcessingSub').textContent   = 'Claude analyse chaque document';

  const wrap  = document.getElementById('siBatchProgWrap');
  const fill  = document.getElementById('siBatchProgFill');
  const label = document.getElementById('siBatchProgLabel');
  wrap.style.display = 'block';
  fill.style.width   = '0%';
  label.textContent  = `0 / ${valid.length}`;

  let done = 0;

  // Traitement concurrent par tranches de SI_CONCURRENCY
  for (let i = 0; i < valid.length; i += SI_CONCURRENCY) {
    const chunk = valid.slice(i, i + SI_CONCURRENCY);
    const results = await Promise.all(chunk.map(f => processFileForBatch(f)));
    results.forEach(r => siBatchRows.push(r));
    done += chunk.length;
    const pct = Math.round((done / valid.length) * 100);
    fill.style.width  = pct + '%';
    label.textContent = `${done} / ${valid.length}`;
  }

  document.getElementById('siProcessing').style.display    = 'none';
  wrap.style.display = 'none';
  renderBatchResults(siBatchRows);
}

async function processFileForBatch(file) {
  try {
    // Redimensionner les images pour respecter la limite Claude (~5MB base64 max)
    const b64 = file.type === 'application/pdf'
      ? await fileToBase64(file)
      : await readFileAsBase64(file, 2048);
    const res  = await fetch('/api/smart-import', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fileBase64: b64, mimeType: file.type }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    return { file, status: 'ok', data, product: buildProductFromExtracted(data.extracted, file.name) };
  } catch (err) {
    return { file, status: 'error', error: err.message };
  }
}

function buildProductFromExtracted(d, filename) {
  if (!d) return {};
  // EAN : priorité à ce que Claude détecte, sinon on lit le nom du fichier
  const eanFromFile = filename ? extractEanFromFilename(filename) : '';
  const eanResolved = (d.ean && String(d.ean).trim()) || eanFromFile || '';
  const p = {
    ean:                 eanResolved,
    natureBrute:         d.natureBrute      || '',
    attribut:            d.attribut         || '',
    marque:              d.marque           || '',
    rayon:               d.rayon            || '',
    conditionnement:     d.conditionnement  || '',
    infoBandeau:         d.infoBandeau      || '',
    palierCommande:      d.palierCommande   || '',
    flagBio:             !!d.flagBio,
    flagFQC:             !!d.flagFQC,
    ingredients:         d.ingredients      || '',
    valeursEnergetiques: d.valeursEnergetiques || '',
    graisses:            d.graisses         || '',
    grasSatures:         d.grasSatures      || '',
    glucides:            d.glucides         || '',
    sucres:              d.sucres           || '',
    proteines:           d.proteines        || '',
    sel:                 d.sel              || '',
    conservation:        d.conservation     || '',
    nomLatin:            d.nomLatin         || '',
    facettePecheElevage: d.facettePecheElevage || '',
    categorie:           d.categorie        || '',
    viandeBovine:        !!d.viandeBovine,
    porcFrancais:        !!d.porcFrancais,
    allergens:           d.allergens        || {},
  };
  // Extraire palier/bandeau depuis le conditionnement si manquant
  if (p.conditionnement) {
    const ex = extractFromConditionnement(p.conditionnement);
    if (ex) {
      if (!p.palierCommande && ex.palier) p.palierCommande = ex.palier;
      if (!p.infoBandeau   && ex.band)   p.infoBandeau   = ex.band;
    }
  }
  return p;
}

function renderBatchResults(rows) {
  const ok    = rows.filter(r => r.status === 'ok').length;
  const err   = rows.filter(r => r.status === 'error').length;

  document.getElementById('siBatchSub').textContent =
    `${ok} extrait(s) avec succès · ${err} erreur(s)`;
  document.getElementById('siBatchStats').textContent =
    `${ok} sur ${rows.length} prêts à importer`;

  const tbody = document.getElementById('siBatchTableBody');
  tbody.innerHTML = '';

  rows.forEach((row, idx) => {
    const tr   = document.createElement('tr');
    const d    = row.data && row.data.extracted;
    const conf = d && d.confidence ? (d.confidence.overall || 'medium') : null;
    const confLabel = { high:'Haute', medium:'Moyenne', low:'Faible' };

    const isOk = row.status === 'ok';

    tr.innerHTML = `
      <td><input type="checkbox" class="si-batch-check" data-idx="${idx}" ${isOk ? '' : 'disabled'}></td>
      <td class="si-batch-filename" title="${row.file.name}">${row.file.name}</td>
      <td>${isOk ? (row.product.ean || '—') : '—'}</td>
      <td>${isOk ? (d.natureBrute || '—') : '—'}</td>
      <td>${isOk ? (d.conditionnement || '—') : '—'}</td>
      <td>${isOk ? (d.rayon || '—') : '—'}</td>
      <td>${isOk && conf ? `<span class="si-conf-badge si-conf-${conf}">${confLabel[conf]}</span>` : '—'}</td>
      <td>${isOk
        ? '<span class="si-batch-status si-batch-ok">✓ Extrait</span>'
        : `<span class="si-batch-status si-batch-err">✗ Erreur</span><div class="si-batch-errmsg">${(row.error || 'Erreur inconnue').replace(/</g,'&lt;').slice(0,120)}</div>`}</td>
      <td>${isOk ? `<button class="btn btn-ghost btn-xs si-batch-preview-btn" data-idx="${idx}">Voir</button>` : ''}</td>
    `;
    tbody.appendChild(tr);
  });

  // Bouton "Voir"
  tbody.querySelectorAll('.si-batch-preview-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = siBatchRows[+btn.dataset.idx];
      if (!row || !row.data) return;
      siExtracted = row.data.extracted;
      renderSmartImportResults(row.data);
      document.getElementById('siBatchResults').style.display = 'none';
      document.getElementById('siResults').style.display      = 'block';
      // Ajouter bouton retour batch
      const retryBtn = document.getElementById('siRetryBtn');
      if (retryBtn) retryBtn.textContent = '← Retour aux résultats batch';
      retryBtn && retryBtn.addEventListener('click', () => {
        document.getElementById('siResults').style.display      = 'none';
        document.getElementById('siBatchResults').style.display = 'block';
        retryBtn.textContent = '← Recommencer';
      }, { once: true });
    });
  });

  document.getElementById('siBatchResults').style.display = 'block';
}

function getCheckedBatchProducts() {
  const checked = Array.from(document.querySelectorAll('.si-batch-check:checked'));
  if (!checked.length) { toast('Aucune ligne sélectionnée', 'error'); return null; }
  const selected = [];
  checked.forEach(cb => {
    const row = siBatchRows[+cb.dataset.idx];
    if (row && row.status === 'ok') selected.push(row.product);
  });
  if (!selected.length) { toast('Aucune extraction valide sélectionnée', 'error'); return null; }
  return selected;
}

function addAllBatchToLot() {
  const selected = getCheckedBatchProducts();
  if (!selected) return;
  selected.forEach(p => products.push(p));
  renderProductList();
  toast(`${selected.length} produit(s) ajouté(s) au lot — vous pouvez continuer l'import ou exporter`, 'success');
}

async function exportBatchSelection() {
  const selected = getCheckedBatchProducts();
  if (!selected) return;

  const btn = document.getElementById('siBatchExportBtn');
  btn.textContent = '⏳ Génération…'; btn.disabled = true;

  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: selected }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erreur serveur'); }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `import-ia-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`${selected.length} fiche(s) exportée(s) en Excel !`, 'success');
  } catch (err) {
    toast('Erreur export : ' + err.message, 'error');
  } finally {
    btn.textContent = '⬇ Exporter sélection Excel'; btn.disabled = false;
  }
}

// Sous-onglets import
function initImportSubtabs() {
  document.querySelectorAll('.import-stab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.import-stab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.istab;
      document.getElementById('istab-excel').style.display = tab === 'excel' ? 'block' : 'none';
      document.getElementById('istab-ai').style.display    = tab === 'ai'    ? 'block' : 'none';
    });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// TRAITEMENT VISUELS PRODUIT
// ═════════════════════════════════════════════════════════════════════════════

let imgOriginalBase64 = null;
let imgResultBase64   = null;
let imgResultFilename = null;
let aiPollTimer       = null;

function initImageProcessing() {
  // ── Sous-onglets ────────────────────────────────────────────────────────
  document.querySelectorAll('.img-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.img-subtab-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('stab-single').style.display    = btn.dataset.stab === 'single'    ? 'block' : 'none';
      document.getElementById('stab-batch').style.display     = btn.dataset.stab === 'batch'     ? 'block' : 'none';
      document.getElementById('stab-templates').style.display = btn.dataset.stab === 'templates' ? 'block' : 'none';
    });
  });

  // ── Image unique ────────────────────────────────────────────────────────
  const zone    = document.getElementById('imgUploadZone');
  const fileInp = document.getElementById('imgFileInput');

  document.getElementById('imgBrowseBtn').addEventListener('click', () => fileInp.click());
  zone.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') fileInp.click(); });
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0]; if (f) handleImageFile(f);
  });
  fileInp.addEventListener('change', () => { if (fileInp.files[0]) handleImageFile(fileInp.files[0]); });

  document.getElementById('imgRemoveBg').addEventListener('change', function() {
    const g = document.getElementById('imgSensGroup');
    g.style.opacity = this.checked ? '1' : '0.4';
    g.style.pointerEvents = this.checked ? '' : 'none';
  });
  document.getElementById('imgSensitivity').addEventListener('input', function() {
    document.getElementById('imgSensVal').textContent = this.value;
  });
  document.getElementById('imgSceneScale').addEventListener('input', function() {
    document.getElementById('imgSceneScaleVal').textContent = this.value + '%';
  });
  document.getElementById('imgVertOffset').addEventListener('input', function() {
    const v = parseInt(this.value, 10);
    document.getElementById('imgVertOffsetVal').textContent =
      v === 0 ? 'Centre' : (v < 0 ? `↑ ${Math.abs(v)}` : `↓ ${v}`);
  });
  document.getElementById('imgHorizOffset').addEventListener('input', function() {
    const v = parseInt(this.value, 10);
    document.getElementById('imgHorizOffsetVal').textContent =
      v === 0 ? 'Centre' : (v < 0 ? `← ${Math.abs(v)}` : `→ ${v}`);
  });
  document.getElementById('imgProcessBtn').addEventListener('click', processImage);
  document.getElementById('imgChangeBtn').addEventListener('click', resetImageUI);
  document.getElementById('imgDownloadBtn').addEventListener('click', downloadProcessedImage);

  // ── Traitement en masse ─────────────────────────────────────────────────
  initBatchProcessing();

  // ── Fonds de scène ──────────────────────────────────────────────────────
  initTemplates();

  // ── Statut moteur IA ────────────────────────────────────────────────────
  checkAIStatus();
  aiPollTimer = setInterval(() => {
    const badge = document.getElementById('aiStatusBadge');
    if (badge && badge.classList.contains('ai-badge-ready')) {
      clearInterval(aiPollTimer); // IA confirmée, arrêter le polling
    } else {
      checkAIStatus();
    }
  }, 3000);
}

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    toast('Format non supporté — utilisez une image JPG, PNG ou WebP', 'error');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    toast('Image trop volumineuse (max 15 MB)', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1500;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const resizedDataURL = canvas.toDataURL('image/jpeg', 0.92);
      imgOriginalBase64 = resizedDataURL.split(',')[1];

      document.getElementById('imgOriginal').src = resizedDataURL;
      document.getElementById('imgOrigMeta').textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} Ko`;

      setResultState('empty');
      document.getElementById('imgResultEmpty').textContent = 'Cliquez sur "Traiter l\'image"';
      document.getElementById('imgResultFooter').style.display = 'none';
      imgResultBase64 = null; imgResultFilename = null;

      document.getElementById('imgUploadZone').style.display   = 'none';
      document.getElementById('imgProcessPanel').style.display = 'block';

      const eanFld = document.getElementById('imgEan');
      if (!eanFld.value) {
        const fromFilename = extractEanFromFilename(file.name);
        const mainEan = document.getElementById('ean');
        eanFld.value = fromFilename || (mainEan && mainEan.value) || '';
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function setResultState(state) {
  document.getElementById('imgResultEmpty').style.display = state === 'empty'   ? '' : 'none';
  document.getElementById('imgResultSpin').style.display  = state === 'loading' ? 'flex' : 'none';
  document.getElementById('imgResult').style.display      = state === 'done'    ? 'block' : 'none';
}

async function processImage() {
  if (!imgOriginalBase64) { toast('Aucune image chargée', 'error'); return; }

  const btn = document.getElementById('imgProcessBtn');
  btn.textContent = '⏳…'; btn.disabled = true;

  setResultState('loading');
  document.getElementById('imgResultFooter').style.display = 'none';
  document.getElementById('imgResultEmpty').textContent = 'Cliquez sur "Traiter l\'image"';

  const removeBg    = document.getElementById('imgRemoveBg').checked;
  const sensitivity = parseInt(document.getElementById('imgSensitivity').value, 10);
  const ean         = document.getElementById('imgEan').value.trim();

  try {
    const res  = await fetch('/api/process-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: imgOriginalBase64, ean, removeBg, sensitivity,
        rayon:       document.getElementById('imgRayon').value || currentRayon || '',
        sceneScale:  parseInt(document.getElementById('imgSceneScale').value,   10) / 100,
        vertOffset:  parseInt(document.getElementById('imgVertOffset').value,   10),
        horizOffset: parseInt(document.getElementById('imgHorizOffset').value,  10),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');

    const dataURL = `data:image/jpeg;base64,${data.imageBase64}`;
    document.getElementById('imgResult').src = dataURL;
    setResultState('done');

    document.getElementById('imgResultMeta').textContent =
      `${data.sizeKB} Ko · 1500×1500 px · JPG`;
    document.getElementById('imgDownloadBtn').textContent =
      `📥 Télécharger ${data.filename}`;
    document.getElementById('imgResultFooter').style.display = 'flex';

    imgResultBase64   = data.imageBase64;
    imgResultFilename = data.filename;

    toast('Image traitée avec succès !', 'success');
  } catch (err) {
    setResultState('empty');
    document.getElementById('imgResultEmpty').textContent = '✗ ' + err.message;
    toast('Erreur traitement : ' + err.message, 'error');
  } finally {
    btn.textContent = '⚡ Traiter l\'image'; btn.disabled = false;
  }
}

function downloadProcessedImage() {
  if (!imgResultBase64 || !imgResultFilename) return;
  const a = document.createElement('a');
  a.href     = `data:image/jpeg;base64,${imgResultBase64}`;
  a.download = imgResultFilename;
  a.click();
}

function resetImageUI() {
  imgOriginalBase64 = null;
  imgResultBase64   = null;
  imgResultFilename = null;
  document.getElementById('imgUploadZone').style.display   = 'block';
  document.getElementById('imgProcessPanel').style.display = 'none';
  document.getElementById('imgFileInput').value            = '';
  document.getElementById('imgEan').value                  = '';
}

// ═════════════════════════════════════════════════════════════════════════════
// TRAITEMENT EN MASSE
// ═════════════════════════════════════════════════════════════════════════════

let batchFiles      = []; // [{id, file, ean, status, resultBase64, resultFilename, resultSizeKB}]
let batchProcessing = false;

function initBatchProcessing() {
  const zone    = document.getElementById('batchUploadZone');
  const fileInp = document.getElementById('batchFileInput');

  document.getElementById('batchBrowseBtn').addEventListener('click', () => fileInp.click());
  zone.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') fileInp.click(); });
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    handleBatchFiles(e.dataTransfer.files);
  });
  fileInp.addEventListener('change', () => handleBatchFiles(fileInp.files));

  document.getElementById('batchRemoveBg').addEventListener('change', function() {
    const g = document.getElementById('batchSensGroup');
    g.style.opacity = this.checked ? '1' : '0.4';
    g.style.pointerEvents = this.checked ? '' : 'none';
  });
  document.getElementById('batchSensitivity').addEventListener('input', function() {
    document.getElementById('batchSensVal').textContent = this.value;
  });
  document.getElementById('batchSceneScale').addEventListener('input', function() {
    document.getElementById('batchSceneScaleVal').textContent = this.value + '%';
  });
  document.getElementById('batchVertOffset').addEventListener('input', function() {
    const v = parseInt(this.value, 10);
    document.getElementById('batchVertOffsetVal').textContent =
      v === 0 ? 'Centre' : (v < 0 ? `↑ ${Math.abs(v)}` : `↓ ${v}`);
  });
  document.getElementById('batchHorizOffset').addEventListener('input', function() {
    const v = parseInt(this.value, 10);
    document.getElementById('batchHorizOffsetVal').textContent =
      v === 0 ? 'Centre' : (v < 0 ? `← ${Math.abs(v)}` : `→ ${v}`);
  });
  document.getElementById('batchProcessBtn').addEventListener('click', processBatch);
  document.getElementById('batchClearBtn').addEventListener('click', resetBatch);
  document.getElementById('batchDownloadBtn').addEventListener('click', downloadBatchZip);
}

function handleBatchFiles(fileList) {
  const MAX   = 500;
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (!files.length) { toast('Aucune image dans la sélection', 'error'); return; }

  const remaining = MAX - batchFiles.length;
  if (remaining <= 0) { toast('Limite de 500 images déjà atteinte', 'error'); return; }
  if (files.length > remaining) toast(`Limite : ${MAX} images max — ${files.length - remaining} image(s) ignorée(s)`, '');

  files.slice(0, remaining).forEach((file, i) => {
    batchFiles.push({
      id:              batchFiles.length,
      file,
      ean:             extractEanFromFilename(file.name),
      status:          'pending',
      resultBase64:    null,
      resultFilename:  null,
      resultSizeKB:    null,
    });
  });

  document.getElementById('batchUploadZone').style.display = 'none';
  document.getElementById('batchPanel').style.display      = 'block';
  renderBatchTable();
}

function extractEanFromFilename(name) {
  const m = name.replace(/\.[^.]+$/, '').match(/^(\d{8,13})/);
  return m ? m[1] : name.replace(/\.[^.]+$/, '');
}

function renderBatchTable() {
  document.getElementById('batchCountLabel').textContent = `${batchFiles.length} image(s) sélectionnée(s)`;
  document.getElementById('batchTableBody').innerHTML = batchFiles.map((e, i) => `
    <tr id="batch-row-${e.id}">
      <td class="batch-n">${i + 1}</td>
      <td class="batch-fname" title="${e.file.name}">${e.file.name.length > 38 ? e.file.name.slice(0, 35) + '…' : e.file.name}</td>
      <td><input class="batch-ean-inp" data-id="${e.id}" value="${e.ean}" placeholder="EAN ou nom" maxlength="30"></td>
      <td id="batch-status-${e.id}">${batchStatusHTML('pending')}</td>
    </tr>`).join('');

  document.querySelectorAll('.batch-ean-inp').forEach(inp => {
    inp.addEventListener('input', function() {
      const entry = batchFiles.find(e => e.id === parseInt(this.dataset.id, 10));
      if (entry) entry.ean = this.value.trim();
    });
  });
}

function batchStatusHTML(status, info = '') {
  if (status === 'pending') return '<span class="bs-pending">⬜ En attente</span>';
  if (status === 'loading') return '<span class="bs-loading"><span class="spin-anim-sm"></span> Traitement…</span>';
  if (status === 'done')    return `<span class="bs-done">✅ ${info}</span>`;
  if (status === 'error')   return `<span class="bs-error">❌ ${info}</span>`;
  return '';
}

function setBatchStatus(id, status, info = '') {
  const el = document.getElementById(`batch-status-${id}`);
  if (el) el.innerHTML = batchStatusHTML(status, info);
}

function updateBatchProgress(done, total) {
  const pct = total ? Math.round(done / total * 100) : 0;
  document.getElementById('batchProgressFill').style.width = pct + '%';
  document.getElementById('batchProgressText').textContent = `${done} / ${total}  (${pct} %)`;
}

async function processBatch() {
  if (!batchFiles.length || batchProcessing) return;
  batchProcessing = true;

  const btn = document.getElementById('batchProcessBtn');
  btn.textContent = '⏳ Traitement en cours…'; btn.disabled = true;

  const removeBg    = document.getElementById('batchRemoveBg').checked;
  const sensitivity = parseInt(document.getElementById('batchSensitivity').value, 10);
  const CONCURRENCY = 2; // 2 images en parallèle (optimal sur 1 CPU)

  // Réinitialiser les statuts
  batchFiles.forEach(e => { e.status = 'pending'; e.resultBase64 = null; setBatchStatus(e.id, 'pending'); });

  document.getElementById('batchProgressWrap').style.display = '';
  document.getElementById('batchDownloadBtn').style.display  = 'none';
  updateBatchProgress(0, batchFiles.length);

  let done = 0;
  const total = batchFiles.length;

  for (let i = 0; i < batchFiles.length; i += CONCURRENCY) {
    const chunk = batchFiles.slice(i, i + CONCURRENCY);

    await Promise.all(chunk.map(async entry => {
      setBatchStatus(entry.id, 'loading');
      try {
        const b64 = await readFileAsBase64(entry.file);
        const res  = await fetch('/api/process-image', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: b64, ean: entry.ean, removeBg, sensitivity,
            rayon:       document.getElementById('batchRayon').value || currentRayon || '',
            sceneScale:  parseInt(document.getElementById('batchSceneScale').value,   10) / 100,
            vertOffset:  parseInt(document.getElementById('batchVertOffset').value,   10),
            horizOffset: parseInt(document.getElementById('batchHorizOffset').value,  10),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur serveur');

        entry.status         = 'done';
        entry.resultBase64   = data.imageBase64;
        entry.resultFilename = data.filename;
        entry.resultSizeKB   = data.sizeKB;
        setBatchStatus(entry.id, 'done', `${data.sizeKB} Ko → ${data.filename}`);
      } catch (err) {
        entry.status = 'error';
        setBatchStatus(entry.id, 'error', err.message.slice(0, 50));
      }
      done++;
      updateBatchProgress(done, total);
    }));
  }

  batchProcessing = false;
  btn.textContent = '⚡ Traiter toutes les images'; btn.disabled = false;

  const ok = batchFiles.filter(e => e.status === 'done').length;
  if (ok > 0) {
    document.getElementById('batchDownloadBtn').style.display  = '';
    document.getElementById('batchDownloadBtn').textContent    = `📥 Télécharger ${ok} image(s) (ZIP)`;
  }
  toast(`${ok} image(s) traitée(s) sur ${total}`, ok === total ? 'success' : '');
}

async function readFileAsBase64(file, maxPx = 1500) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
      };
      img.src = e.target.result;
    };
    r.readAsDataURL(file);
  });
}

async function downloadBatchZip() {
  const btn = document.getElementById('batchDownloadBtn');
  btn.textContent = '⏳ Création du ZIP…'; btn.disabled = true;
  try {
    const zip = new JSZip();
    batchFiles.forEach(e => {
      if (!e.resultBase64 || !e.resultFilename) return;
      const bin   = atob(e.resultBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      zip.file(e.resultFilename, bytes);
    });
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `visuels-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('ZIP téléchargé !', 'success');
  } catch (err) {
    toast('Erreur ZIP : ' + err.message, 'error');
  } finally {
    const ok = batchFiles.filter(e => e.status === 'done').length;
    btn.textContent = `📥 Télécharger ${ok} image(s) (ZIP)`;
    btn.disabled = false;
  }
}

function resetBatch() {
  batchFiles = []; batchProcessing = false;
  document.getElementById('batchUploadZone').style.display   = 'block';
  document.getElementById('batchPanel').style.display        = 'none';
  document.getElementById('batchFileInput').value            = '';
  document.getElementById('batchProgressWrap').style.display = 'none';
  document.getElementById('batchDownloadBtn').style.display  = 'none';
}

// ═════════════════════════════════════════════════════════════════════════════
// FONDS DE SCÈNE PAR CATÉGORIE
// ═════════════════════════════════════════════════════════════════════════════

function initTemplates() {
  // Brancher les inputs file cachés sur chaque carte rayon
  ['R20','R21','R22','R23','R24'].forEach(r => {
    const inp = document.getElementById(`tpl-file-${r}`);
    if (inp) inp.addEventListener('change', () => {
      if (inp.files[0]) uploadTpl(r, inp.files[0]);
    });
  });
  // Charger le statut actuel depuis le serveur
  loadTplStatus();
}

async function loadTplStatus() {
  try {
    const res  = await fetch('/api/templates');
    const data = await res.json();
    ['R20','R21','R22','R23','R24'].forEach(r => {
      const active = data[r];
      const card   = document.getElementById(`tpl-card-${r}`);
      const status = document.getElementById(`tpl-status-${r}`);
      const delBtn = document.getElementById(`tpl-del-${r}`);
      const img    = document.getElementById(`tpl-img-${r}`);
      const empty  = document.getElementById(`tpl-empty-${r}`);
      if (!card) return;
      card.classList.toggle('tpl-active', active);
      if (status) status.textContent = active ? '✅ Fond de scène actif' : '⬜ Fond blanc';
      if (delBtn) delBtn.style.display = active ? '' : 'none';
      if (img && empty) {
        if (active) {
          img.src = `/api/templates/${r}/image?t=${Date.now()}`;
          img.style.display = 'block';
          empty.style.display = 'none';
        } else {
          img.src = '';
          img.style.display = 'none';
          empty.style.display = '';
        }
      }
    });
  } catch (_) { /* serveur injoignable */ }
}

function triggerTplUpload(rayon) {
  const inp = document.getElementById(`tpl-file-${rayon}`);
  if (inp) { inp.value = ''; inp.click(); }
}

async function uploadTpl(rayon, file) {
  if (!file.type.startsWith('image/')) {
    toast('Format non supporté — utilisez JPG, PNG ou WebP', 'error');
    return;
  }
  const btn = document.querySelector(`#tpl-card-${rayon} .btn-outline`);
  if (btn) { btn.textContent = '⏳…'; btn.disabled = true; }
  try {
    const b64 = await readFileAsBase64(file);
    const res = await fetch(`/api/templates/${rayon}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: b64 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    toast(`Fond de scène ${rayon} enregistré !`, 'success');
    await loadTplStatus();
  } catch (err) {
    toast(`Erreur : ${err.message}`, 'error');
  } finally {
    if (btn) { btn.textContent = '📂 Importer'; btn.disabled = false; }
  }
}

async function deleteTpl(rayon) {
  if (!confirm(`Supprimer le fond de scène ${rayon} ? Le traitement reviendra au fond blanc.`)) return;
  try {
    await fetch(`/api/templates/${rayon}`, { method: 'DELETE' });
    toast(`Fond de scène ${rayon} supprimé`, '');
    await loadTplStatus();
  } catch (err) {
    toast('Erreur suppression : ' + err.message, 'error');
  }
}

// ─── Statut moteur IA ─────────────────────────────────────────────────────────

async function checkAIStatus() {
  const badge = document.getElementById('aiStatusBadge');
  if (!badge) return;
  try {
    const res  = await fetch('/api/ai-status');
    const data = await res.json();
    if (data.ready) {
      badge.textContent = '🤖 IA active';
      badge.className   = 'ai-badge ai-badge-ready';
    } else if (data.available) {
      badge.textContent = '⏳ IA en chargement…';
      badge.className   = 'ai-badge ai-badge-loading';
    } else {
      badge.textContent = '⚙️ Mode classique';
      badge.className   = 'ai-badge ai-badge-classic';
      clearInterval(aiPollTimer); // Plus la peine de re-tester
    }
  } catch (_) {
    // Serveur injoignable
  }
}
