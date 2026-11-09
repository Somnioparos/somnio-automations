/**
 * Candy Recipes 2027 — script του αρχείου «Candy Recipes 2027».
 *
 * Εδώ καταχωρούνται ΧΕΙΡΟΚΙΝΗΤΑ: έξοδα, κινήσεις χρημάτων (εισπράξεις/πληρωμές/μεταφορές),
 * concierge και προβλέψεις. Τα διαβάζει το Somnio Financials 2027 (P&L + Cash flow) και το Owner Ledger.
 *
 * Απαιτεί: βιβλιοθήκη SomnioCore (Identifier: SomnioCore, Version: HEAD). Κανένα κλειδί API.
 *
 * Μενού «Somnio Candy»:
 *   1. Στήσιμο / φρεσκάρισμα μορφής  — tabs, στήλες, λίστες επιλογών (μία φορά + όποτε θέλεις)
 *   2. Ανανέωση λιστών               — ακίνητα από Master Properties, κέντρα κόστους, προμηθευτές
 *   3. Έλεγχος                       — tab «Έλεγχος»: ελλείψεις, νέοι προμηθευτές, οφειλές σε συνεταίρους
 *   4. Συμπλήρωση όλων των γραμμών    — ξανατρέχει τα αυτόματα πεδία σε όλες τις γραμμές
 *
 * Καθώς γράφεις σε μια γραμμή, συμπληρώνονται αυτόματα (installable trigger onEditInstalled): ID, κατηγορία/υποκατηγορία από τον
 * προμηθευτή, Φύση, Πλήρωσε, ΦΠΑ/Καθαρό/Σύνολο, Χρεώνεται σε, Ημ/νία πληρωμής, Οφειλή σε.
 * Ό,τι έχεις ήδη γράψει ΔΕΝ αλλάζει — συμπληρώνονται μόνο τα κενά (εκτός από τα γκρι πεδία).
 */

var T = {
  EXP: 'Έξοδα', MOV: 'Κινήσεις', CON: 'Concierge', FC: 'Πρόβλεψη', CHECK: 'Έλεγχος',
  SUP: 'Προμηθευτές', CAT: 'Κατηγορίες', ACC: 'Λογαριασμοί', PPL: 'Άτομα', PROP: 'Ακίνητα', HELP: '_Λίστες'
};
var SUPPLIERS_PROPOSAL_ID = '17-5eO6PevKJ2HjsBqZb4WiZPmePPaHYEeYKE_VVldR4';   // εγκεκριμένη λίστα 7/11
var GENERAL = 'Γενικά';

// [όνομα, είδος] — man = γράφει ο χρήστης (κίτρινο), auto = συμπληρώνεται αν είναι κενό (ανοιχτό κίτρινο), sys = μόνο σύστημα (γκρι)
var EXP_COLS = [['ID', 'sys'], ['Ημ/νία', 'man'], ['Προμηθευτής', 'man'], ['Αρ. παραστατικού', 'man'], ['Περιγραφή', 'man'],
  ['Κατηγορία', 'auto'], ['Υποκατηγορία', 'auto'], ['Φύση', 'sys'], ['Κέντρο κόστους', 'man'], ['Χρεώνεται σε', 'auto'],
  ['Λογαριασμός', 'man'], ['Πλήρωσε', 'sys'], ['Ημ/νία πληρωμής', 'auto'], ['Declared', 'man'], ['ΦΠΑ %', 'man'],
  ['Καθαρό', 'auto'], ['ΦΠΑ', 'sys'], ['Σύνολο', 'auto'], ['Απόδειξη', 'man'], ['Σημείωση', 'man'], ['Οφειλή σε', 'sys'],
  ['Καταχωρήθηκε', 'sys']];
var MOV_COLS = [['ID', 'sys'], ['Ημ/νία', 'man'], ['Τι είναι', 'man'], ['Ποσό', 'man'], ['Από λογαριασμό', 'man'],
  ['Σε λογαριασμό ή σε ποιον', 'man'], ['Σημείωση', 'man'], ['Καταχωρήθηκε', 'sys']];
var CON_COLS = [['ID', 'sys'], ['Ημ/νία', 'man'], ['Ακίνητο', 'man'], ['Επισκέπτης / Κράτηση', 'man'], ['Υπηρεσία', 'man'],
  ['Προμηθευτής', 'man'], ['Ποσό', 'man'], ['Προμήθεια %', 'man'], ['Προμήθεια', 'sys'], ['Declared', 'man'],
  ['Εισπράχθηκε', 'man'], ['Λογαριασμός', 'man'], ['Σημείωση', 'man'], ['Καταχωρήθηκε', 'sys']];
var FC_COLS = [['Ημ/νία', 'man'], ['Περιγραφή', 'man'], ['Κατεύθυνση', 'man'], ['Ποσό', 'man'], ['Λογαριασμός', 'man'],
  ['Επανάληψη', 'man'], ['Μέχρι', 'man'], ['Κατηγορία', 'man'], ['Σημείωση', 'man']];

// Κινήσεις: μόνο ό,τι δεν είναι έξοδο ούτε είσπραξη κράτησης (νέα μορφή 9/11).
// Είσοδος = μπαίνουν χρήματα στο «Σε λογαριασμό» · Έξοδος = βγαίνουν από το «Από λογαριασμό» · Μεταφορά = και τα δύο.
var MOV_TYPES = [['Επιστροφή σε συνέταιρο', 'Έξοδος'], ['Μεταφορά μεταξύ λογαριασμών', 'Μεταφορά'],
  ['Εγγύηση (δόθηκε)', 'Έξοδος'], ['Εγγύηση (επιστράφηκε)', 'Είσοδος'], ['Κεφάλαιο (μπήκε)', 'Είσοδος'],
  ['Δάνειο (μπήκε)', 'Είσοδος'], ['Δόση δανείου', 'Έξοδος'], ['Άλλη είσπραξη', 'Είσοδος'], ['Άλλη πληρωμή', 'Έξοδος']];
function movFlow_(type) { for (var i = 0; i < MOV_TYPES.length; i++) if (MOV_TYPES[i][0] === type) return MOV_TYPES[i][1]; return ''; }
var CHARGE_TO = ['Somnio', 'Ιδιοκτήτης'];
var FC_DIR = ['Είσοδος', 'Έξοδος'];
var FC_REPEAT = ['Μία φορά', 'Μηνιαία', 'Τριμηνιαία', 'Ετήσια'];
var VAT_RATES = ['0%', '6%', '13%', '24%'];

// Κατηγορίες 2027: [Κατηγορία, Υποκατηγορία, Φύση, Στο P&L]
var CATEGORIES = [
  ['Καθαρισμός', 'Συνεργείο', 'Opex'], ['Καθαρισμός', 'Υλικά καθαρισμού', 'Opex'],
  ['Πλυντήριο', 'Πλυντήριο', 'Opex'], ['Πλυντήριο', 'Λινά & πετσέτες', 'Opex'],
  ['Αναλώσιμα & Welcome', 'Σούπερ μάρκετ', 'Opex'], ['Αναλώσιμα & Welcome', 'Είδη σπιτιού', 'Opex'],
  ['Αναλώσιμα & Welcome', 'Welcome basket', 'Opex'], ['Αναλώσιμα & Welcome', 'Φαρμακείο', 'Opex'],
  ['Συντήρηση & επισκευές', 'Υδραυλικά', 'Opex'], ['Συντήρηση & επισκευές', 'Ηλεκτρολογικά', 'Opex'],
  ['Συντήρηση & επισκευές', 'Πισίνα', 'Opex'], ['Συντήρηση & επισκευές', 'Κήπος', 'Opex'],
  ['Συντήρηση & επισκευές', 'Βόθρος', 'Opex'], ['Συντήρηση & επισκευές', 'Γενικές επισκευές', 'Opex'],
  ['Λογαριασμοί', 'Ρεύμα', 'Opex'], ['Λογαριασμοί', 'Νερό', 'Opex'], ['Λογαριασμοί', 'Internet/τηλεφωνία', 'Opex'],
  ['Ενοίκια', '—', 'Opex'],
  ['Μισθοδοσία', 'Μισθοί', 'Opex'], ['Μισθοδοσία', 'Εισφορές', 'Opex'], ['Μισθοδοσία', 'ΦΜΥ', 'Opex'],
  ['Μεταφορές', 'Leasing', 'Opex'], ['Μεταφορές', 'Καύσιμα', 'Opex'], ['Μεταφορές', 'Ακτοπλοϊκά/αεροπορικά', 'Opex'],
  ['Μεταφορές', 'Service οχημάτων', 'Opex'],
  ['Software & συνδρομές', '—', 'Opex'],
  ['Λογιστικά & νομικά', 'Λογιστής', 'Opex'], ['Λογιστικά & νομικά', 'Δικηγόρος', 'Opex'],
  ['Λογιστικά & νομικά', 'Τεχνικός ασφαλείας', 'Opex'], ['Λογιστικά & νομικά', 'ΓΕΜΗ', 'Opex'],
  ['Ασφάλειες', '—', 'Opex'],
  ['Marketing', 'Social', 'Opex'], ['Marketing', 'Φωτογράφιση & video', 'Opex'],
  ['Marketing', 'Δώρα πελατών & branding', 'Opex'], ['Marketing', 'Website', 'Opex'],
  ['Τραπεζικά', 'Προμήθειες τράπεζας', 'Opex'],
  ['Λοιπά', 'Γεύματα & φιλοξενία', 'Opex'], ['Λοιπά', 'Συνέδρια & μέλη', 'Opex'], ['Λοιπά', 'Άλλο', 'Opex'],
  ['Εξοπλισμός & κατασκευές', 'Κατασκευές', 'Πάγιο'], ['Εξοπλισμός & κατασκευές', 'Ηλεκτρικές συσκευές', 'Πάγιο'],
  ['Εξοπλισμός & κατασκευές', 'Έπιπλα & εξοπλισμός', 'Πάγιο'],
  ['Εγγυήσεις', 'Σεντονιών', 'Εγγύηση'], ['Εγγυήσεις', 'Ενοικίου', 'Εγγύηση'], ['Εγγυήσεις', 'Άλλη', 'Εγγύηση'],
  ['Φόροι & τέλη', 'ΦΠΑ', 'Φόροι'], ['Φόροι & τέλη', 'Φόρος εισοδήματος', 'Φόροι'],
  ['Φόροι & τέλη', 'Τέλος ανθεκτικότητας / παρεπιδημούντων', 'Φόροι'], ['Φόροι & τέλη', 'Παρακράτηση φόρου', 'Φόροι'],
  ['Φόροι & τέλη', 'Λοιπά τέλη', 'Φόροι']
];
// Στο P&L μπαίνει μόνο το Opex. Πάγια/Εγγυήσεις/Φόροι φαίνονται στο Cash flow (απόφαση 7/11).
function inPnl_(nature) { return nature === 'Opex'; }

// Λογαριασμοί 2027: [Λογαριασμός, Τύπος, Κάτοχος]. Προσωπικός → πληρωμή = οφειλή επιστροφής στον κάτοχο.
var ACCOUNTS = [
  ['Alpha', 'Εταιρικός', 'Somnio'], ['Revolut', 'Εταιρικός', 'Somnio'], ['Eurobank', 'Εταιρικός', 'Somnio'],
  ['Stripe', 'Πλατφόρμα', 'Somnio'], ['Μετρητά', 'Μετρητά', 'Somnio'],
  ['Wise Tasos', 'Προσωπικός', 'Τάσος'], ['Wise Alex', 'Προσωπικός', 'Αλέξ'], ['Alpha Alex', 'Προσωπικός', 'Αλέξ'],
  ['Wise Mina', 'Προσωπικός', 'Μίνα'], ['Eliza', 'Προσωπικός', 'Ελίζα'], ['Crypto', 'Προσωπικός', ''],
  ['Ιδιοκτήτης', 'Ιδιοκτήτης', 'Ιδιοκτήτης']
];
var PEOPLE = [['Τάσος', 'Συνέταιρος'], ['Αλέξ', 'Συνέταιρος'], ['Μίνα', 'Συνέταιρος'], ['Ελίζα', 'Συνέταιρος'], ['Ευγενία', 'Εργαζόμενος']];

// -- ΜΕΝΟΥ -------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Candy')
    .addItem('1. Στήσιμο / φρεσκάρισμα μορφής', 'setupCandy')
    .addItem('2. Ανανέωση λιστών', 'refreshListsMenu')
    .addItem('3. Έλεγχος', 'checkMenu')
    .addItem('4. Συμπλήρωση όλων των γραμμών', 'fillAllMenu')
    .addItem('5. Ανανέωση εισπράξεων κρατήσεων', 'syncReceiptsMenu')
    .addSeparator()
    .addItem('Καθημερινή ανανέωση ON', 'dailyOn')
    .addItem('Καθημερινή ανανέωση OFF', 'dailyOff')
    .addToUi();
}

// -- ΒΟΗΘΗΤΙΚΑ (χωρίς βιβλιοθήκη, ώστε να δουλεύουν και στο onEdit) --------------------

function hmap_(sh) {
  var last = sh.getLastColumn(); if (last < 1) return {};
  var h = sh.getRange(1, 1, 1, last).getValues()[0], m = {};
  for (var i = 0; i < h.length; i++) { var k = String(h[i] || '').trim(); if (k && m[k] === undefined) m[k] = i; }
  return m;
}
function key_(s) { return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
function num_(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  var s = String(v).replace(/[€\s]/g, ''); if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
  var n = Number(s); return isNaN(n) ? null : n;
}
function pct_(v) {
  var n = num_(String(v === undefined ? '' : v).replace('%', ''));
  if (n === null) return null;
  if (typeof v === 'number' && v <= 1) return v;           // ήδη κλάσμα (μορφή %)
  return n > 1 ? n / 100 : n;
}
function r2_(x) { return Math.round(x * 100) / 100; }
function blank_(v) { return v === '' || v === null || v === undefined; }
function sheet_(ss, name) {
  var sh = ss.getSheetByName(name); if (sh) return sh;
  var want = key_(name);
  return ss.getSheets().filter(function (s) { return key_(s.getName()) === want; })[0] || null;
}
function getOrCreate_(ss, name) { return sheet_(ss, name) || ss.insertSheet(name); }

function readTable_(ss, name) {
  var sh = sheet_(ss, name); if (!sh || sh.getLastRow() < 2) return [];
  var m = hmap_(sh), v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return v.map(function (r) { var o = {}; for (var k in m) o[k] = r[m[k]]; return o; });
}
function active_(v) { return !(v === false || String(v).toUpperCase() === 'FALSE'); }

/** Όλες οι λίστες ως lookup αντικείμενα. */
function lists_(ss) {
  var L = { sup: {}, cat: {}, acc: {}, prop: {}, ppl: {} };
  readTable_(ss, T.SUP).forEach(function (r) {
    var n = String(r['Προμηθευτής'] || '').trim(); if (n) L.sup[key_(n)] = { name: n, cat: r['Κατηγορία'], sub: r['Υποκατηγορία'], active: active_(r['Active']) };
  });
  readTable_(ss, T.CAT).forEach(function (r) {
    var c = String(r['Κατηγορία'] || '').trim(); if (c && !L.cat[key_(c)]) L.cat[key_(c)] = { name: c, nature: String(r['Φύση'] || '').trim() };
  });
  readTable_(ss, T.ACC).forEach(function (r) {
    var a = String(r['Λογαριασμός'] || '').trim(); if (a) L.acc[key_(a)] = { name: a, type: String(r['Τύπος'] || ''), holder: String(r['Κάτοχος'] || '') };
  });
  readTable_(ss, T.PROP).forEach(function (r) {
    var p = String(r['Residence'] || '').trim(); if (p) L.prop[key_(p)] = { name: p, ownerType: String(r['Owner_Type'] || ''), owner: String(r['Owner_Name'] || '') };
  });
  readTable_(ss, T.PPL).forEach(function (r) {
    var p = String(r['Όνομα'] || '').trim(); if (p) L.ppl[key_(p)] = { name: p, role: r['Ρόλος'], active: active_(r['Active']) };
  });
  return L;
}

// -- ΑΥΤΟΜΑΤΗ ΣΥΜΠΛΗΡΩΣΗ ΓΡΑΜΜΩΝ ---------------------------------------------------

/**
 * Installable trigger «Όταν γίνεται αλλαγή» (το στήνει το «1. Στήσιμο»). Δεν χρησιμοποιούμε το απλό onEdit,
 * γιατί σε αρχεία με βιβλιοθήκη/άδειες μπορεί να μην τρέχει χωρίς να φαίνεται κανένα σφάλμα.
 */
function onEditInstalled(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet(), name = sh.getName();
  if (e.range.getRow() < 2) return;
  if ([T.EXP, T.MOV, T.CON, REC_TAB].indexOf(name) === -1) return;
  try {
    if (name === REC_TAB) fillReceiptRows_(sh, e.range.getRow(), e.range.getNumRows());
    else fillRows_(sh, e.range.getRow(), e.range.getNumRows(), lists_(sh.getParent()));
  } catch (err) {
    try { SomnioCore.logRun('Candy · Αυτόματη συμπλήρωση', 'ERROR', '', name + ' γρ. ' + e.range.getRow() + ': ' + err.message); } catch (ignored) {}
  }
}

function installEditTrigger_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'onEditInstalled') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onEditInstalled').forSpreadsheet(ss).onEdit().create();
}

/** Συμπληρώνει τα αυτόματα πεδία στις γραμμές [start, start+n). */
function fillRows_(sh, start, n, L) {
  var name = sh.getName(), m = hmap_(sh), lastCol = sh.getLastColumn();
  var rng = sh.getRange(start, 1, n, lastCol), vals = rng.getValues();
  var orig = vals.map(function (r) { return r.slice(); });
  var supCol = m['Προμηθευτής'], supBg = (name === T.EXP && supCol !== undefined) ? sh.getRange(start, supCol + 1, n, 1).getBackgrounds() : null;
  var supBgBefore = JSON.stringify(supBg);
  var lock = LockService.getDocumentLock();
  try { lock.waitLock(5000); } catch (le) { return; }
  var props = PropertiesService.getDocumentProperties();
  var prefix = name === T.EXP ? 'E' : name === T.MOV ? 'K' : 'C';
  var seq = Number(props.getProperty('SEQ_' + prefix) || 0), seqUsed = false;
  var g = function (r, c) { return m[c] === undefined ? '' : r[m[c]]; };
  var s = function (r, c, v) { if (m[c] !== undefined) r[m[c]] = v; };
  var sBlank = function (r, c, v) { if (m[c] !== undefined && blank_(r[m[c]]) && !blank_(v)) r[m[c]] = v; };

  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var filled = Object.keys(m).some(function (c) { return c !== 'ID' && c !== 'Καταχωρήθηκε' && !blank_(r[m[c]]) && r[m[c]] !== false; });
    if (!filled) continue;
    if (blank_(g(r, 'ID'))) { s(r, 'ID', prefix + '-' + ('0000' + (++seq)).slice(-4)); seqUsed = true; }
    if (blank_(g(r, 'Καταχωρήθηκε'))) s(r, 'Καταχωρήθηκε', new Date());

    if (name === T.EXP) {
      var sup = L.sup[key_(g(r, 'Προμηθευτής'))];
      if (sup) { sBlank(r, 'Κατηγορία', sup.cat); sBlank(r, 'Υποκατηγορία', sup.sub === '—' ? '' : sup.sub); }
      var cat = L.cat[key_(g(r, 'Κατηγορία'))];
      s(r, 'Φύση', cat ? cat.nature : '');
      var acc = L.acc[key_(g(r, 'Λογαριασμός'))];
      s(r, 'Πλήρωσε', acc ? (acc.holder || acc.name) : '');
      s(r, 'Οφειλή σε', acc && acc.type === 'Προσωπικός' ? (acc.holder || '(κάτοχος;)') : '');
      sBlank(r, 'Ημ/νία πληρωμής', g(r, 'Ημ/νία'));
      var cc = g(r, 'Κέντρο κόστους'), p = L.prop[key_(cc)];
      if (!blank_(cc)) sBlank(r, 'Χρεώνεται σε', (p && p.ownerType && p.ownerType !== 'Δικό μας') ? 'Ιδιοκτήτης' : 'Somnio');
      // ΦΠΑ: γράφεις Σύνολο (ή Καθαρό) + ΦΠΑ % → υπολογίζονται τα υπόλοιπα
      var v = pct_(g(r, 'ΦΠΑ %')); if (v === null) v = 0;
      var net = num_(g(r, 'Καθαρό')), tot = num_(g(r, 'Σύνολο'));
      if (tot !== null && net === null) net = r2_(tot / (1 + v));
      else if (net !== null && tot === null) tot = r2_(net * (1 + v));
      if (net !== null && tot !== null) { s(r, 'Καθαρό', net); s(r, 'Σύνολο', tot); s(r, 'ΦΠΑ', r2_(tot - net)); }
      // νέος προμηθευτής → κίτρινη σήμανση στο κελί
      if (supBg) supBg[i][0] = (!blank_(g(r, 'Προμηθευτής')) && !sup) ? '#FFE066' : '#FFF8DC';
    } else if (name === T.CON) {
      var amt = num_(g(r, 'Ποσό')), pc = pct_(g(r, 'Προμήθεια %'));
      s(r, 'Προμήθεια', (amt !== null && pc !== null) ? r2_(amt * pc) : '');
    }
  }
  // Γράφονται ΜΟΝΟ οι στήλες που άλλαξαν (ώστε να μην πειραχτούν links/τύποι σε στήλες χρήστη)
  for (var c = 0; c < lastCol; c++) {
    var changed = false;
    for (var j = 0; j < vals.length && !changed; j++) {
      var x = vals[j][c], y = orig[j][c];
      changed = (x instanceof Date && y instanceof Date) ? x.getTime() !== y.getTime() : x !== y;
    }
    if (changed) sh.getRange(start, c + 1, n, 1).setValues(vals.map(function (r) { return [r[c]]; }));
  }
  if (supBg && JSON.stringify(supBg) !== supBgBefore) sh.getRange(start, supCol + 1, n, 1).setBackgrounds(supBg);
  if (seqUsed) props.setProperty('SEQ_' + prefix, String(seq));
  lock.releaseLock();
}

function fillAllMenu() {
  var n = 0;
  SomnioCore.runJob('Candy · Συμπλήρωση', function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), L = lists_(ss);
    [T.EXP, T.MOV, T.CON].forEach(function (t) {
      var sh = sheet_(ss, t);
      if (sh && sh.getLastRow() > 1) { fillRows_(sh, 2, sh.getLastRow() - 1, L); n += sh.getLastRow() - 1; }
    });
    return { count: n, detail: 'γραμμές ' + n };
  });
  SpreadsheetApp.getUi().alert('Συμπληρώθηκαν ' + n + ' γραμμές.');
}

// -- ΛΙΣΤΕΣ ------------------------------------------------------------------------

/** Ακίνητα από Master Properties + βοηθητικό tab _Λίστες (πηγή των dropdowns). */
function refreshLists_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Ακίνητα (αντίγραφο, μόνο για ανάγνωση)
  var mp = SomnioCore.openFile('FILE_MASTER_PROPERTIES');
  var src = mp.getSheetByName('Properties') || mp.getSheets()[0];
  var sm = SomnioCore.headerMap(src), sv = src.getDataRange().getValues();
  var pcols = ['Residence', 'Owner_Type', 'Owner_Name', 'Active_2027'];
  var prows = [pcols];
  for (var i = 1; i < sv.length; i++) {
    if (!String(sv[i][SomnioCore.col(sm, 'Residence')] || '').trim()) continue;
    prows.push(pcols.map(function (c) { return sv[i][SomnioCore.col(sm, c)]; }));
  }
  var ps = getOrCreate_(ss, T.PROP);
  ps.clearContents();
  ps.getRange(1, 1, prows.length, pcols.length).setValues(prows);
  ps.getRange(1, 1, 1, pcols.length).setFontWeight('bold').setBackground('#EEEEEE');
  ps.setFrozenRows(1);
  ps.getRange(1, 6).setValue('Αντίγραφο από Master Properties 2027 — μην το αλλάζεις εδώ. Ανανέωση: μενού 2.').setFontColor('#888888');

  var L = lists_(ss);
  var activeProps = Object.keys(L.prop).map(function (k) { return L.prop[k].name; });   // και τα «προς επιβεβαίωση»
  var people = Object.keys(L.ppl).map(function (k) { return L.ppl[k]; }).filter(function (p) { return p.active; }).map(function (p) { return p.name; });
  var centres = [GENERAL].concat(people).concat(activeProps);
  var sups = Object.keys(L.sup).map(function (k) { return L.sup[k]; }).filter(function (s) { return s.active; }).map(function (s) { return s.name; }).sort();
  var accs = readTable_(ss, T.ACC).filter(function (r) { return String(r['Λογαριασμός'] || '').trim() && active_(r['Active']); })
    .map(function (r) { return String(r['Λογαριασμός']).trim(); });
  var cats = [], subs = [];
  readTable_(ss, T.CAT).forEach(function (r) {
    var c = String(r['Κατηγορία'] || '').trim(), sb = String(r['Υποκατηγορία'] || '').trim();
    if (c && cats.indexOf(c) === -1) cats.push(c);
    if (sb && sb !== '—' && subs.indexOf(sb) === -1) subs.push(sb);
  });
  var cols = [['Κέντρα κόστους', centres], ['Προμηθευτές', sups], ['Λογαριασμοί', accs], ['Κατηγορίες', cats],
              ['Υποκατηγορίες', subs], ['Άτομα', people], ['Ακίνητα', activeProps]];
  var h = getOrCreate_(ss, T.HELP);
  h.clearContents();
  var maxLen = Math.max.apply(null, cols.map(function (c) { return c[1].length; }));
  var grid = [];
  for (var r = 0; r <= maxLen; r++) grid.push(cols.map(function (c) { return r === 0 ? c[0] : (c[1][r - 1] || ''); }));
  h.getRange(1, 1, grid.length, cols.length).setValues(grid);
  h.hideSheet();
  return { centres: centres.length, suppliers: sups.length, props: activeProps.length };
}

function refreshListsMenu() {
  var res = null;
  SomnioCore.runJob('Candy · Λίστες', function () {
    res = refreshLists_();
    return { count: res.centres, detail: 'ακίνητα ' + res.props + ' · κέντρα κόστους ' + res.centres + ' · προμηθευτές ' + res.suppliers };
  });
  if (res) SpreadsheetApp.getUi().alert('Λίστες ΟΚ: ' + res.props + ' ακίνητα, ' + res.centres + ' κέντρα κόστους, ' + res.suppliers + ' προμηθευτές.');
}

// -- ΣΤΗΣΙΜΟ ---------------------------------------------------------------------

function setupCandy() {
  SomnioCore.runJob('Candy · Στήσιμο', function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.setSpreadsheetTimeZone(String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens'));
    try { ss.setSpreadsheetLocale('el_GR'); } catch (ignored) {}

    // Λίστες με αρχικά δεδομένα — γεμίζουν ΜΟΝΟ αν είναι άδειες (δεν πατάνε αλλαγές χρηστών)
    seedTable_(ss, T.CAT, ['Κατηγορία', 'Υποκατηγορία', 'Φύση', 'Στο P&L'],
      CATEGORIES.map(function (c) { return [c[0], c[1], c[2], inPnl_(c[2])]; }));
    seedTable_(ss, T.ACC, ['Λογαριασμός', 'Τύπος', 'Κάτοχος', 'Active', 'Υπόλοιπο 1/1/2027'],
      ACCOUNTS.map(function (a) { return [a[0], a[1], a[2], true, '']; }));
    seedTable_(ss, T.PPL, ['Όνομα', 'Ρόλος', 'Active', 'Σημείωση'], PEOPLE.map(function (p) { return [p[0], p[1], true, '']; }));
    seedTable_(ss, T.SUP, ['Προμηθευτής', 'Κατηγορία', 'Υποκατηγορία', 'Active', 'Σημείωση'], suppliersSeed_());

    // Tabs καταχώρησης (πρώτο κενό tab → Έξοδα)
    var first = ss.getSheets()[0];
    if (!sheet_(ss, T.EXP) && first.getLastRow() === 0) first.setName(T.EXP);
    var exp = getOrCreate_(ss, T.EXP), mov = getOrCreate_(ss, T.MOV), con = getOrCreate_(ss, T.CON), fc = getOrCreate_(ss, T.FC);
    styleEntry_(exp, EXP_COLS, '#202D5D');
    migrateMovements_(mov);
    styleEntry_(mov, MOV_COLS, '#305BAB');
    styleEntry_(con, CON_COLS, '#2F7A4A');
    styleEntry_(fc, FC_COLS, '#9C4F24');
    getOrCreate_(ss, T.CHECK);

    var res = refreshLists_();
    applyValidations_(ss);
    setupReceipts_(ss);
    try { syncReceipts_(); } catch (re) { /* αν το Master File δεν είναι έτοιμο, γεμίζει με το μενού 5 */ }
    installEditTrigger_();

    // σειρά tabs
    [REC_TAB, T.EXP, T.MOV, T.CON, T.FC, T.CHECK, T.SUP, T.CAT, T.ACC, T.PPL, T.PROP].forEach(function (t, i) {
      var sh = sheet_(ss, t); if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
    });
    [T.SUP, T.CAT, T.ACC, T.PPL, T.PROP].forEach(function (t) { var sh = sheet_(ss, t); if (sh) sh.setTabColor('#999999'); });
    ss.setActiveSheet(sheet_(ss, REC_TAB));
    return { count: res.suppliers, detail: 'tabs + λίστες · προμηθευτές ' + res.suppliers + ' · κέντρα κόστους ' + res.centres };
  });
  SpreadsheetApp.getUi().alert('Στήσιμο ΟΚ.\n\nΣυμπλήρωσε στο tab «Λογαριασμοί» τη στήλη «Υπόλοιπο 1/1/2027» (για το Cash flow) όταν είναι γνωστά.');
}

function suppliersSeed_() {
  var out = [];
  try {
    var sh = SpreadsheetApp.openById(SUPPLIERS_PROPOSAL_ID).getSheets()[0];
    var m = hmap_(sh), v = sh.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      var n = String(v[i][m['Προμηθευτής 2027']] || '').trim(), c = String(v[i][m['Κατηγορία 2027']] || '').trim();
      if (!n || n === '—' || c.indexOf('Κίνηση') > -1) continue;
      var undecided = c.indexOf('να οριστεί') > -1;
      out.push([n, undecided ? '' : c, undecided ? '' : String(v[i][m['Υποκατηγορία']] || '').replace('—', ''), true,
                String(v[i][m['Σημείωση / ερώτηση']] || '')]);
    }
  } catch (e) { /* αν δεν βρεθεί η πρόταση, η λίστα μένει άδεια και γεμίζει με το χέρι */ }
  return out;
}

function seedTable_(ss, name, headers, rows) {
  var sh = getOrCreate_(ss, name);
  if (sh.getLastRow() > 1) return;                        // υπάρχουν ήδη δεδομένα → δεν αγγίζω
  sh.clearContents();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#4A5268').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  var m = hmap_(sh);
  var maxR = Math.max(sh.getMaxRows() - 1, 1);
  if (m['Active'] !== undefined) sh.getRange(2, m['Active'] + 1, maxR, 1).insertCheckboxes();
  if (m['Στο P&L'] !== undefined) sh.getRange(2, m['Στο P&L'] + 1, maxR, 1).insertCheckboxes();
}

function ensureHeaders_(sh, names) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var hasAny = hdr.some(String);
  var missing = names.filter(function (n) { return hdr.indexOf(n) === -1; });
  if (!missing.length) return;
  var startCol = hasAny ? sh.getLastColumn() + 1 : 1;
  var need = startCol + missing.length - 1 - sh.getMaxColumns();
  if (need > 0) sh.insertColumnsAfter(sh.getMaxColumns(), need);
  sh.getRange(1, startCol, 1, missing.length).setValues([missing]);
}

function styleEntry_(sh, cols, color) {
  ensureHeaders_(sh, cols.map(function (c) { return c[0]; }));
  var m = hmap_(sh), rows = Math.max(sh.getMaxRows() - 1, 1);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground(color).setFontColor('#FFFFFF').setWrap(true);
  cols.forEach(function (c) {
    var i = m[c[0]]; if (i === undefined) return;
    var r = sh.getRange(2, i + 1, rows, 1);
    r.setBackground(c[1] === 'man' ? '#FFF8DC' : c[1] === 'auto' ? '#FFFBEA' : '#EEEEEE');
    if (/Ημ\/νία|Μέχρι/.test(c[0])) r.setNumberFormat('dd/mm/yyyy');
    if (c[0] === 'Καταχωρήθηκε') r.setNumberFormat('dd/mm/yyyy hh:mm');
    if (/^(Καθαρό|ΦΠΑ|Σύνολο|Ποσό|Τραπεζικά|Προμήθεια)$/.test(c[0])) r.setNumberFormat('#,##0.00');
    if (/%$/.test(c[0])) r.setNumberFormat('0%');
    if (c[0] === 'Declared' || c[0] === 'Εισπράχθηκε') r.insertCheckboxes();
  });
}

function applyValidations_(ss) {
  var help = sheet_(ss, T.HELP);
  var hm = hmap_(help);
  var listRange = function (title) {
    var c = hm[title] + 1;
    return help.getRange(2, c, Math.max(help.getMaxRows() - 1, 1), 1);
  };
  var fromRange = function (title, strict) {
    return SpreadsheetApp.newDataValidation().requireValueInRange(listRange(title), true).setAllowInvalid(!strict).build();
  };
  var fromList = function (arr) { return SpreadsheetApp.newDataValidation().requireValueInList(arr, true).setAllowInvalid(false).build(); };
  var apply = function (sh, col, rule) {
    var m = hmap_(sh); if (m[col] === undefined) return;
    sh.getRange(2, m[col] + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  };
  var exp = sheet_(ss, T.EXP), mov = sheet_(ss, T.MOV), con = sheet_(ss, T.CON), fc = sheet_(ss, T.FC);
  apply(exp, 'Προμηθευτής', fromRange('Προμηθευτές', false));     // νέο όνομα επιτρέπεται (κίτρινο + Έλεγχος)
  apply(exp, 'Κατηγορία', fromRange('Κατηγορίες', true));
  apply(exp, 'Υποκατηγορία', fromRange('Υποκατηγορίες', false));
  apply(exp, 'Κέντρο κόστους', fromRange('Κέντρα κόστους', true));
  apply(exp, 'Λογαριασμός', fromRange('Λογαριασμοί', true));
  apply(exp, 'Χρεώνεται σε', fromList(CHARGE_TO));
  apply(exp, 'ΦΠΑ %', SpreadsheetApp.newDataValidation().requireValueInList(VAT_RATES, true).setAllowInvalid(true).build());
  apply(mov, 'Τι είναι', fromList(MOV_TYPES.map(function (t) { return t[0]; })));
  apply(mov, 'Από λογαριασμό', fromRange('Λογαριασμοί', true));
  apply(mov, 'Σε λογαριασμό ή σε ποιον', fromRange('Λογαριασμοί', false));   // λογαριασμός ή ελεύθερο όνομα
  apply(con, 'Ακίνητο', fromRange('Ακίνητα', true));
  apply(con, 'Λογαριασμός', fromRange('Λογαριασμοί', true));
  apply(fc, 'Κατεύθυνση', fromList(FC_DIR));
  apply(fc, 'Επανάληψη', fromList(FC_REPEAT));
  apply(fc, 'Λογαριασμός', fromRange('Λογαριασμοί', true));
  apply(fc, 'Κατηγορία', fromRange('Κατηγορίες', false));
}

// -- ΕΛΕΓΧΟΣ ---------------------------------------------------------------------

function check_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), L = lists_(ss);
  var issues = [], newSup = {}, owed = {};
  readTable_(ss, T.EXP).forEach(function (r) {
    if (blank_(r['ID'])) return;
    var id = r['ID'], miss = [];
    ['Ημ/νία', 'Προμηθευτής', 'Κατηγορία', 'Κέντρο κόστους', 'Λογαριασμός', 'Σύνολο'].forEach(function (c) { if (blank_(r[c])) miss.push(c); });
    if (miss.length) issues.push([T.EXP, id, 'Λείπει: ' + miss.join(', ')]);
    var sp = String(r['Προμηθευτής'] || '').trim();
    if (sp && !L.sup[key_(sp)]) newSup[sp] = (newSup[sp] || 0) + 1;
    if (r['Κατηγορία'] && !L.cat[key_(r['Κατηγορία'])]) issues.push([T.EXP, id, 'Άγνωστη κατηγορία «' + r['Κατηγορία'] + '»']);
    if (r['Declared'] === true && blank_(r['Αρ. παραστατικού'])) issues.push([T.EXP, id, 'Declared χωρίς αριθμό παραστατικού']);
    if (r['Οφειλή σε']) owed[r['Οφειλή σε']] = (owed[r['Οφειλή σε']] || 0) + (num_(r['Σύνολο']) || 0);
  });
  readTable_(ss, T.MOV).forEach(function (r) {
    if (blank_(r['ID'])) return;
    var miss = [], flow = movFlow_(r['Τι είναι']);
    ['Ημ/νία', 'Τι είναι', 'Ποσό'].forEach(function (c) { if (blank_(r[c])) miss.push(c); });
    if ((flow === 'Έξοδος' || flow === 'Μεταφορά') && blank_(r['Από λογαριασμό'])) miss.push('Από λογαριασμό');
    if ((flow === 'Είσοδος' || flow === 'Μεταφορά' || r['Τι είναι'] === 'Επιστροφή σε συνέταιρο') && blank_(r['Σε λογαριασμό ή σε ποιον'])) miss.push('Σε λογαριασμό ή σε ποιον');
    if (flow === 'Μεταφορά' && !blank_(r['Σε λογαριασμό ή σε ποιον']) && !L.acc[key_(r['Σε λογαριασμό ή σε ποιον'])]) {
      issues.push([T.MOV, r['ID'], 'Μεταφορά: το «Σε» πρέπει να είναι λογαριασμός από τη λίστα']);
    }
    if (miss.length) issues.push([T.MOV, r['ID'], 'Λείπει: ' + miss.join(', ')]);
    // Επιστροφή σε συνέταιρο μειώνει την οφειλή. «Σε» = όνομα ατόμου ή προσωπικός λογαριασμός του.
    if (r['Τι είναι'] === 'Επιστροφή σε συνέταιρο' && !blank_(r['Σε λογαριασμό ή σε ποιον'])) {
      var to = String(r['Σε λογαριασμό ή σε ποιον']).trim(), acc = L.acc[key_(to)];
      var who = acc && acc.holder ? acc.holder : to;
      var p = L.ppl[key_(who)], nm = p ? p.name : who;
      owed[nm] = (owed[nm] || 0) - (num_(r['Ποσό']) || 0);
      if (!p) issues.push([T.MOV, r['ID'], 'Άγνωστο άτομο «' + who + '» — πρόσθεσέ το στο tab Άτομα']);
    }
  });
  readTable_(ss, T.ACC).forEach(function (r) {
    if (r['Τύπος'] === 'Προσωπικός' && !String(r['Κάτοχος'] || '').trim()) issues.push([T.ACC, r['Λογαριασμός'], 'Προσωπικός λογαριασμός χωρίς κάτοχο']);
  });

  var sh = getOrCreate_(ss, T.CHECK);
  sh.clearContents();
  var out = [['Tab', 'ID', 'Εκκρεμότητα · έλεγχος ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm')]];
  issues.forEach(function (x) { out.push(x); });
  Object.keys(newSup).forEach(function (s) { out.push([T.SUP, s, 'Νέος προμηθευτής (' + newSup[s] + ' γραμμές) — πρόσθεσέ τον στο tab Προμηθευτές ή διόρθωσε το όνομα']); });
  if (out.length === 1) out.push(['', '', 'Καμία εκκρεμότητα ✓']);
  out.push(['', '', '']);
  out.push(['Οφειλές σε συνεταίρους', 'Ποσό €', 'Πληρωμές από προσωπικούς λογαριασμούς μείον επιστροφές (tab Κινήσεις: «Επιστροφή σε συνέταιρο»)']);
  var owedKeys = Object.keys(owed).filter(function (k) { return Math.abs(owed[k]) >= 0.01; });
  if (!owedKeys.length) out.push(['—', 0, '']);
  owedKeys.forEach(function (k) { out.push([k, r2_(owed[k]), owed[k] > 0 ? 'Η Somnio χρωστά' : 'Επιστράφηκαν περισσότερα']); });
  sh.getRange(1, 1, out.length, 3).setValues(out);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#202D5D').setFontColor('#FFFFFF');
  var hdrRow = out.length - Math.max(owedKeys.length, 1);
  sh.getRange(hdrRow, 1, 1, 3).setFontWeight('bold').setBackground('#E7E5E0');
  sh.setFrozenRows(1);
  return { issues: issues.length + Object.keys(newSup).length, owed: owedKeys.length };
}

function checkMenu() {
  var res = null;
  SomnioCore.runJob('Candy · Έλεγχος', function () {
    res = check_();
    return { count: res.issues, detail: 'εκκρεμότητες ' + res.issues + ' · οφειλές σε ' + res.owed + ' άτομα' };
  });
  if (res) SpreadsheetApp.getUi().alert('Έλεγχος: ' + res.issues + ' εκκρεμότητες. Δες το tab «' + T.CHECK + '».');
}

// -- ΚΑΘΗΜΕΡΙΝΗ ΑΝΑΝΕΩΣΗ (λίστες + εισπράξεις + έλεγχος, 08:15) ----------------------------------

function dailyJob() {
  SomnioCore.runJob('Candy · Καθημερινό', function () {
    var a = refreshLists_(), c = syncReceipts_(), b = check_();
    return { count: b.issues, detail: 'ακίνητα ' + a.props + ' · κρατήσεις ' + c.rows + ' (ανοιχτές ' + c.open + ') · εκκρεμότητες ' + b.issues };
  });
}
function dailyOn() {
  dailyOff_();
  ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(8).nearMinute(15)
    .inTimezone(String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens')).create();
  SomnioCore.logRun('Candy · Καθημερινό', 'OK', '', 'ON 08:15');
  SpreadsheetApp.getUi().alert('Καθημερινή ανανέωση ON (~08:15, μετά το sync του Master File): λίστες, εισπράξεις κρατήσεων, Έλεγχος.');
}
function dailyOff() { dailyOff_(); SpreadsheetApp.getUi().alert('Καθημερινή ανανέωση OFF.'); }
function dailyOff_() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dailyJob') ScriptApp.deleteTrigger(t); }); }

/** Κινήσεις: από την πρώτη μορφή (Κατεύθυνση / Από/Προς / Όνομα …) στη νέα (Τι είναι / Από / Σε). */
function migrateMovements_(sh) {
  var m = hmap_(sh);
  if (m['Κατεύθυνση'] === undefined && m['Από/Προς'] === undefined) return;          // ήδη νέα μορφή
  var old = readTable_(sh.getParent(), T.MOV).filter(function (r) { return !blank_(r['ID']); });
  sh.clear();
  var all = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns());
  all.clearDataValidations(); all.removeCheckboxes();
  var heads = MOV_COLS.map(function (c) { return c[0]; });
  sh.getRange(1, 1, 1, heads.length).setValues([heads]);
  if (!old.length) return;
  var rows = old.map(function (r) {
    var dir = r['Κατεύθυνση'], cp = r['Από/Προς'];
    var type = dir === 'Μεταφορά μεταξύ λογαριασμών' ? 'Μεταφορά μεταξύ λογαριασμών'
      : (cp === 'Συνέταιρος' && dir === 'Πληρώσαμε') ? 'Επιστροφή σε συνέταιρο'
      : dir === 'Εισπράξαμε' ? 'Άλλη είσπραξη' : 'Άλλη πληρωμή';
    var from = dir === 'Εισπράξαμε' ? (r['Όνομα'] || cp || '') : r['Λογαριασμός'];
    var to = dir === 'Εισπράξαμε' ? r['Λογαριασμός'] : (dir === 'Μεταφορά μεταξύ λογαριασμών' ? r['Προς λογαριασμό'] : (r['Όνομα'] || cp || ''));
    var note = [r['Σημείωση'], r['Ακίνητο'], r['Κράτηση(εις)']].filter(function (x) { return !blank_(x); }).join(' · ');
    return [r['ID'], r['Ημ/νία'], type, r['Ποσό'], from, to, note, r['Καταχωρήθηκε']];
  });
  sh.getRange(2, 1, rows.length, heads.length).setValues(rows);
}
