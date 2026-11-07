/**
 * Candy Recipes 2027 — tab «Εισπράξεις κρατήσεων» (απλή μορφή, 7/11).
 *
 * Κάθε γραμμή διαβάζεται σαν πρόταση: «Για αυτή την κράτηση, μας χρωστάει Χ το ποσό Υ. Πληρώθηκε;»
 *
 *   Η κράτηση        | Τι περιμένουμε          | Τι έγινε                          | Για Direct Cash
 *   Check-in Ακίνητο | Μας χρωστάει · Ποσό    | ✅ Πληρώθηκε · Πότε · Λογαριασμός  | Δίνουμε στον ιδιοκτήτη · ✅ Δόθηκε
 *   Επισκέπτης       |                         |                                   |
 *
 * Χρώμα γραμμής: λευκό = μελλοντική · ροζ = απλήρωτη · πορτοκαλί = πληρώθηκε, χρωστάμε στον ιδιοκτήτη ·
 * πράσινο = τελείωσε · γκρι = λείπει ποσό (π.χ. Owner_Type).
 *
 * Μας χρωστάει (κανόνες 2027):
 *   - Ακίνητο ιδιοκτήτη, κράτηση πλατφόρμας/site → ο ιδιοκτήτης (όνομα): προμήθεια + ΦΠΑ (Owner_Payable).
 *   - Δικό μας μέσω πλατφόρμας → η πλατφόρμα (π.χ. Airbnb): payout.
 *   - Δικό μας απευθείας → Επισκέπτης: Total value.
 *   - Direct Cash → Επισκέπτης (μετρητά): όλο το ποσό· σε ακίνητο ιδιοκτήτη του δίνουμε ποσό − προμήθεια.
 *
 * Ποσό: όσο δεν έχει τσεκαριστεί, ακολουθεί το Master File. Μόλις τσεκάρεις «Πληρώθηκε», κρατιέται ό,τι γράφει
 * (άλλαξέ το αν πληρώθηκε διαφορετικό ποσό). Οι χειροκίνητες στήλες κρατιούνται ανά κράτηση (event_id).
 */

var REC_TAB = 'Εισπράξεις κρατήσεων';
var PAID = '✅ Πληρώθηκε', GIVEN = '✅ Δόθηκε';
// [όνομα, είδος, ομάδα]
var REC_COLS = [
  ['Check-in', 'sys', 'b'], ['Ακίνητο', 'sys', 'b'], ['Επισκέπτης', 'sys', 'b'],
  ['Μας χρωστάει', 'sys', 'e'], ['Ποσό', 'auto', 'e'],
  [PAID, 'man', 'd'], ['Πότε', 'auto', 'd'], ['Λογαριασμός', 'man', 'd'],
  ['Δίνουμε στον ιδιοκτήτη', 'sys', 'c'], [GIVEN, 'man', 'c'],
  ['Σημείωση', 'man', 'x'],
  // κρυφές / τεχνικές
  ['Κατάσταση', 'sys', 'h'], ['Αναμενόμενο', 'sys', 'h'], ['Προμήθεια', 'sys', 'h'], ['Πλατφόρμα', 'sys', 'h'],
  ['Check-out', 'sys', 'h'], ['Reservation ID', 'sys', 'h'], ['Κατάσταση κράτησης', 'sys', 'h'],
  ['Owner_Type', 'sys', 'h'], ['event_id', 'sys', 'h']
];
var GROUP_COLOR = { b: '#4A5268', e: '#305BAB', d: '#2F7A4A', c: '#9C4F24', x: '#4A5268', h: '#999999' };
var REC_MANUAL = [PAID, 'Πότε', 'Ποσό', 'Λογαριασμός', GIVEN, 'Σημείωση'];
var REC_CHECKS = [PAID, GIVEN];
// Παλιά ονόματα (πρώτη εκδοχή του tab) → νέα, για να μη χαθεί τίποτα στη μετάβαση
var REC_ALIASES = { 'Εισπράχθηκε': PAID, 'Ημ/νία είσπραξης': 'Πότε', 'Αποδόθηκε': GIVEN, 'Check_in': 'Check-in', 'Check_out': 'Check-out' };
var PLATFORM_RX = /airbnb|booking|vrbo|expedia|homeaway|plum|marriott/i;

function recN_(v) { var x = Number(v); return (v === '' || v === null || v === undefined || isNaN(x)) ? 0 : x; }

/** Ποιος χρωστάει και πόσο, για μία γραμμή του Bookings. */
function recPayer_(b, L) {
  var ot = String(b['Owner_Type'] || ''), src = String(b['Source'] || ''), pf = String(b['Platform'] || '');
  var managed = (ot === 'Εταιρεία' || ot === 'Φυσικό');
  var p = L && L.prop ? L.prop[key_(b['Residence'])] : null;
  var owner = p && p.owner ? p.owner + ' (ιδιοκτήτης)' : 'Ιδιοκτήτης';
  if (src === 'Direct Cash') return { who: 'Επισκέπτης (μετρητά)', amount: recN_(b['Total payout']), comm: managed ? recN_(b['Comm_Total']) : '' };
  if (ot === 'Δικό μας') {
    if (PLATFORM_RX.test(pf)) return { who: pf, amount: recN_(b['Total payout']), comm: '' };
    return { who: 'Επισκέπτης', amount: recN_(b['Total value']) || recN_(b['Guest paid']), comm: '' };
  }
  if (managed) return { who: owner, amount: recN_(b['Owner_Payable']) || recN_(b['Comm_Total']), comm: '' };
  return { who: '? (λείπει Owner_Type στο Master Properties)', amount: '', comm: '' };
}

/** Χρωστάμε στον ιδιοκτήτη + κατάσταση γραμμής. */
function recDerive_(o) {
  var expected = num_(o['Αναμενόμενο']);
  if (expected !== null && (o[PAID] !== true || blank_(o['Ποσό']))) o['Ποσό'] = expected;   // ακολουθεί το Master όσο δεν πληρώθηκε
  var comm = num_(o['Προμήθεια']);
  o['Δίνουμε στον ιδιοκτήτη'] = comm === null ? '' : r2_((num_(o['Ποσό']) || 0) - comm);
  var ci = o['Check-in'] instanceof Date ? o['Check-in'] : (o['Check-in'] ? new Date(String(o['Check-in'])) : null);
  var st;
  if (expected === null && o[PAID] !== true) st = 'Χωρίς ποσό';
  else if (o[PAID] === true) st = (comm !== null && o[GIVEN] !== true && o['Δίνουμε στον ιδιοκτήτη'] > 0) ? 'Προς απόδοση' : 'Ολοκληρώθηκε';
  else if (ci && !isNaN(ci) && ci > new Date()) st = 'Μελλοντική';
  else st = 'Απλήρωτη';
  o['Κατάσταση'] = st;
  return o;
}

/** Χειροκίνητα πεδία κάθε υπάρχουσας γραμμής (δέχεται και τα παλιά ονόματα στηλών). */
function recReadManual_(sh) {
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var m = hmap_(sh), v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  v.forEach(function (r) {
    var id = m['event_id'] !== undefined ? String(r[m['event_id']] || '') : ''; if (!id) return;
    var o = { _old: {} };
    for (var k in m) {
      var nk = REC_ALIASES[k] || k;
      if (REC_MANUAL.indexOf(nk) > -1 && o[nk] === undefined) o[nk] = r[m[k]];
      o._old[nk] = r[m[k]];
    }
    out[id] = o;
  });
  return out;
}

function recHasManual_(ex) {
  return !!ex && (ex[PAID] === true || ex[GIVEN] === true || ['Πότε', 'Λογαριασμός', 'Σημείωση'].some(function (c) { return !blank_(ex[c]); }));
}

/** Ξαναχτίζει τη λίστα από το Master File. */
function syncReceipts_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getDocumentLock(); lock.waitLock(20000);
  try {
    var sh = recSheet_(ss, false);
    var old = recReadManual_(sh);
    var L = lists_(ss);
    var mf = SomnioCore.openFile('FILE_MASTER_FILE');
    var bk = mf.getSheetByName('Bookings');
    if (!bk) throw new Error('Δεν βρέθηκε το tab Bookings στο Master File 2027.');
    var bm = SomnioCore.headerMap(bk);
    var bv = bk.getLastRow() > 1 ? bk.getRange(2, 1, bk.getLastRow() - 1, bk.getLastColumn()).getValues() : [];
    var rows = [], seen = {};
    bv.forEach(function (r) {
      var b = {}; for (var k in bm) b[k] = r[bm[k]];
      var id = String(b['event_id'] || ''); if (!id) return;
      var ex = old[id], pay = recPayer_(b, L);
      if (b['Status'] === 'Ακυρωμένη' && !recHasManual_(ex) && !(Number(pay.amount) > 0)) return;
      seen[id] = 1;
      var o = {
        'Check-in': b['Check_in'], 'Check-out': b['Check_out'], 'Ακίνητο': b['Residence'], 'Επισκέπτης': b['Guest name'],
        'Μας χρωστάει': pay.who, 'Αναμενόμενο': pay.amount, 'Προμήθεια': pay.comm, 'Πλατφόρμα': b['Platform'],
        'Reservation ID': b['Reservation ID'], 'Κατάσταση κράτησης': b['Status'], 'Owner_Type': b['Owner_Type'], 'event_id': id
      };
      REC_MANUAL.forEach(function (c) { o[c] = ex && ex[c] !== undefined ? ex[c] : (REC_CHECKS.indexOf(c) > -1 ? false : ''); });
      rows.push(recDerive_(o));
    });
    // κράτηση που χάθηκε από το Master αλλά έχει καταχωρήσεις → μένει με σήμανση
    Object.keys(old).forEach(function (id) {
      if (seen[id] || !recHasManual_(old[id])) return;
      var o = old[id]._old; REC_MANUAL.forEach(function (c) { o[c] = old[id][c]; });
      o['event_id'] = id; o['Κατάσταση κράτησης'] = 'ΔΕΝ ΥΠΑΡΧΕΙ ΣΤΟ MASTER';
      rows.push(recDerive_(o));
    });
    rows.sort(function (a, b) {
      var x = a['Check-in'] instanceof Date ? a['Check-in'].getTime() : 0, y = b['Check-in'] instanceof Date ? b['Check-in'].getTime() : 0;
      return x - y;
    });
    var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h || '').trim(); });
    var out = rows.map(function (o) { return hdr.map(function (h) { return (o[h] === undefined || o[h] === null) ? '' : o[h]; }); });
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, hdr.length).clearContent();
    if (out.length) sh.getRange(2, 1, out.length, hdr.length).setValues(out);
    var cm = hmap_(sh);
    REC_CHECKS.forEach(function (c) {
      if (sh.getMaxRows() > 1) sh.getRange(2, cm[c] + 1, sh.getMaxRows() - 1, 1).removeCheckboxes();
      if (out.length) sh.getRange(2, cm[c] + 1, out.length, 1).insertCheckboxes();
    });
    var unpaid = rows.filter(function (o) { return o['Κατάσταση'] === 'Απλήρωτη' || o['Κατάσταση'] === 'Προς απόδοση'; }).length;
    return { rows: rows.length, open: unpaid };
  } finally { lock.releaseLock(); }
}

/** onEdit: «Πληρώθηκε» → Πότε = σήμερα (αν κενό) · ξαναϋπολογίζει απόδοση + κατάσταση. */
function fillReceiptRows_(sh, start, n) {
  var m = hmap_(sh), vals = sh.getRange(start, 1, n, sh.getLastColumn()).getValues();
  var cols = ['Ποσό', 'Πότε', 'Δίνουμε στον ιδιοκτήτη', 'Κατάσταση'], outCols = cols.map(function () { return []; });
  vals.forEach(function (r) {
    var o = {}; for (var k in m) o[k] = r[m[k]];
    if (o['event_id']) {
      if (o[PAID] === true && blank_(o['Πότε'])) o['Πότε'] = new Date(new Date().setHours(0, 0, 0, 0));
      recDerive_(o);
    }
    cols.forEach(function (c, i) { outCols[i].push([o[c] === undefined ? '' : o[c]]); });
  });
  cols.forEach(function (c, i) { if (m[c] !== undefined) sh.getRange(start, m[c] + 1, n, 1).setValues(outCols[i]); });
}

/** Το tab με τις σωστές στήλες. Αν βρει την πρώτη (παλιά) μορφή, τη μετατρέπει κρατώντας τις καταχωρήσεις. */
function recSheet_(ss, restyle) {
  var sh = sheet_(ss, REC_TAB);
  var want = REC_COLS.map(function (c) { return c[0]; });
  if (sh) {
    var hdr = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h || '').trim(); });
    if (hdr.indexOf('Ποιος πληρώνει') > -1 || hdr.indexOf('Εισπράχθηκε') > -1) {
      var keep = recReadManual_(sh);
      sh.clear(); sh.clearConditionalFormatRules();
      var all = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns());
      all.clearDataValidations(); all.removeCheckboxes();
      sh.showColumns(1, sh.getMaxColumns());
      sh.getRange(1, 1, 1, want.length).setValues([want]);
      var ids = Object.keys(keep);
      if (ids.length) {                                   // οι παλιές καταχωρήσεις ξαναγράφονται → τις βρίσκει το sync
        var m = hmap_(sh);
        var grid = ids.map(function (id) {
          var row = want.map(function () { return ''; });
          REC_MANUAL.forEach(function (c) { if (keep[id][c] !== undefined) row[m[c]] = keep[id][c]; });
          row[m['event_id']] = id; return row;
        });
        sh.getRange(2, 1, grid.length, want.length).setValues(grid);
      }
      restyle = true;
    }
  } else {
    sh = ss.insertSheet(REC_TAB, 0);
    restyle = true;
  }
  ensureHeaders_(sh, want);
  if (restyle) recStyle_(ss, sh);
  return sh;
}

function recStyle_(ss, sh) {
  var m = hmap_(sh), rows = Math.max(sh.getMaxRows() - 1, 1);
  sh.setFrozenRows(1); sh.setFrozenColumns(3);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setFontColor('#FFFFFF').setWrap(true).setVerticalAlignment('middle');
  sh.setRowHeight(1, 42);
  REC_COLS.forEach(function (c) {
    var i = m[c[0]]; if (i === undefined) return;
    sh.getRange(1, i + 1).setBackground(GROUP_COLOR[c[2]]);
    var r = sh.getRange(2, i + 1, rows, 1);
    r.setBackground(null);
    if (c[0] === 'Check-in' || c[0] === 'Check-out' || c[0] === 'Πότε') r.setNumberFormat('dd/mm/yyyy');
    if (['Ποσό', 'Αναμενόμενο', 'Προμήθεια', 'Δίνουμε στον ιδιοκτήτη'].indexOf(c[0]) > -1) r.setNumberFormat('#,##0.00');
    if (c[1] === 'man' || c[1] === 'auto') r.setFontWeight('bold');
  });
  sh.setColumnWidth(m['Μας χρωστάει'] + 1, 230);
  sh.setColumnWidth(m['Επισκέπτης'] + 1, 160);
  [PAID, GIVEN].forEach(function (c) { sh.setColumnWidth(m[c] + 1, 95); });

  var help = sheet_(ss, T.HELP), hm = hmap_(help);
  sh.getRange(2, m['Λογαριασμός'] + 1, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(help.getRange(2, hm['Λογαριασμοί'] + 1, Math.max(help.getMaxRows() - 1, 1), 1), true)
    .setAllowInvalid(false).build());

  // ένα χρώμα ανά γραμμή, από την κρυφή στήλη Κατάσταση
  var all = sh.getRange(2, 1, rows, sh.getLastColumn()), L = recColLetter_(m['Κατάσταση'] + 1);
  var rule = function (val, color) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L + '2="' + val + '"').setBackground(color).setRanges([all]).build();
  };
  sh.setConditionalFormatRules([
    rule('Ολοκληρώθηκε', '#DDF1E4'), rule('Προς απόδοση', '#FCE5CD'), rule('Απλήρωτη', '#FBEDED'), rule('Χωρίς ποσό', '#EEEEEE')
  ]);

  sh.getRange(1, m['Μας χρωστάει'] + 1).setNote('Από ποιον περιμένουμε τα χρήματα: ο ιδιοκτήτης (προμήθεια + ΦΠΑ), η πλατφόρμα (payout) ή ο επισκέπτης.');
  sh.getRange(1, m['Ποσό'] + 1).setNote('Όσο δεν έχει τσεκαριστεί, ακολουθεί το Master File. Αν πληρώθηκε άλλο ποσό, γράψ\' το εδώ μετά το τσεκάρισμα.');
  sh.getRange(1, m[PAID] + 1).setNote('Τσέκαρε όταν μπουν τα χρήματα. Μπαίνει σήμερα στο «Πότε» — άλλαξέ το αν χρειάζεται.');
  sh.getRange(1, m['Δίνουμε στον ιδιοκτήτη'] + 1).setNote('Μόνο για Direct Cash σε ακίνητο ιδιοκτήτη: ποσό − προμήθεια. Τσέκαρε «Δόθηκε» όταν τα δώσεις.');

  REC_COLS.forEach(function (c) { if (c[2] === 'h' && m[c[0]] !== undefined) sh.hideColumns(m[c[0]] + 1); });
}

function recColLetter_(n) { var s = ''; while (n > 0) { var x = (n - 1) % 26; s = String.fromCharCode(65 + x) + s; n = Math.floor((n - 1) / 26); } return s; }

function setupReceipts_(ss) { recSheet_(ss, true); }

function syncReceiptsMenu() {
  var res = null;
  SomnioCore.runJob('Candy · Εισπράξεις κρατήσεων', function () {
    res = syncReceipts_();
    return { count: res.rows, detail: 'κρατήσεις ' + res.rows + ' · απλήρωτες/προς απόδοση ' + res.open };
  });
  if (res) SpreadsheetApp.getUi().alert('Εισπράξεις κρατήσεων: ' + res.rows + ' κρατήσεις · ' + res.open + ' απλήρωτες ή προς απόδοση.');
}
