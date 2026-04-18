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
    btn.addEventListener('click', () => { document.getElementById(targetId).value = item; });
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
      data.allergenes   = checked('allergenes');
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
      data.allergenes          = checked('allergenes');
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
        <button class="prod-del" onclick="removeProduct(${i})" title="Supprimer">×</button>
      </div>
    </div>`;
  }).join('');
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

// ─── Export Excel ─────────────────────────────────────────────────────────────
async function exportExcel() {
  if (!products.length) return;
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
    const dataURL = e.target.result;
    imgOriginalBase64 = dataURL.split(',')[1];

    // Afficher l'original
    document.getElementById('imgOriginal').src = dataURL;
    document.getElementById('imgOrigMeta').textContent =
      `${file.name} · ${(file.size / 1024).toFixed(0)} Ko`;

    // Réinitialiser le résultat
    setResultState('empty');
    document.getElementById('imgResultEmpty').textContent = 'Cliquez sur "Traiter l\'image"';
    document.getElementById('imgResultFooter').style.display = 'none';
    imgResultBase64 = null; imgResultFilename = null;

    // Montrer le panneau de traitement
    document.getElementById('imgUploadZone').style.display   = 'none';
    document.getElementById('imgProcessPanel').style.display = 'block';

    // Auto-remplir l'EAN depuis le formulaire principal si disponible
    const eanFld = document.getElementById('imgEan');
    if (!eanFld.value) {
      const mainEan = document.getElementById('ean');
      if (mainEan && mainEan.value) eanFld.value = mainEan.value;
    }
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
        sceneScale:  parseInt(document.getElementById('imgSceneScale').value,  10) / 100,
        vertOffset:  parseInt(document.getElementById('imgVertOffset').value,   10),
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
  const CONCURRENCY = 4; // 4 images en parallèle

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
            sceneScale:  parseInt(document.getElementById('batchSceneScale').value,  10) / 100,
            vertOffset:  parseInt(document.getElementById('batchVertOffset').value,   10),
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

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = e => resolve(e.target.result.split(',')[1]);
    r.onerror = reject;
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
