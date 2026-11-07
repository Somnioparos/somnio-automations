/**
 * Candy Recipes 2027 — tab «Εισπράξεις κρατήσεων».
 *
 * Όλες οι κρατήσεις του Master File 2027, μία ανά γραμμή, με το ποιος πρέπει να πληρώσει και πόσο.
 * Δίπλα σε κάθε κράτηση τσεκάρεις «Εισπράχθηκε» → μπαίνει σήμερα + το αναμενόμενο ποσό (αλλάζουν).
 * Υπόλοιπο και Κατάσταση υπολογίζονται μόνα τους.
 *
 * Η λίστα ανανεώνεται από το Master File (μενού 5 + καθημερινά). Ό,τι γράφεις στις κίτρινες στήλες
 * κρατιέται ανά κράτηση (event_id) — δεν χάνεται ποτέ από την ανανέωση.
 *
 * Ποιος πληρώνει (κανόνες 2027):
 *   - Ακίνητο ιδιοκτήτη (Εταιρεία/Φυσικό), κράτηση πλατφόρμας/site → Ιδιοκτήτης: Owner_Payable
 *     (προμήθεια + ΦΠΑ· για Airbnb εταιρείας και το ΦΠΑ της προμήθειας Airbnb).
 *   - Δικό μας ακίνητο μέσω πλατφόρμας → Πλατφόρμα: Total payout.
 *   - Δικό μας ακίνητο, απευθείας → Επισκέπτης: Total value.
 *   - Direct Cash → Επισκέπτης (μετρητά): όλο το ποσό. Σε ακίνητο ιδιοκτήτη η Somnio του αποδίδει
 *     ποσό − προμήθεια → στήλες «Απόδοση σε ιδιοκτήτη» / ☑ Αποδόθηκε στην ίδια γραμμή.
 */

var REC_TAB = 'Εισπράξεις κρατήσεων';
var REC_COLS = [
  ['Check_in', 'sys'], ['Ακίνητο', 'sys'], ['Επισκέπτης', 'sys'], ['Πλατφόρμα', 'sys'], ['Ποιος πληρώνει', 'sys'],
  ['Αναμενόμενο', 'sys'], ['Εισπράχθηκε', 'man'], ['Ημ/νία είσπραξης', 'auto'], ['Ποσό', 'auto'], ['Λογαριασμός', 'man'],
  ['Τραπεζικά', 'man'], ['Υπόλοιπο', 'sys'],
  ['Απόδοση σε ιδιοκτήτη', 'sys'], ['Αποδόθηκε', 'man'], ['Ημ/νία απόδοσης', 'auto'], ['Ποσό απόδοσης', 'auto'], ['Λογαριασμός απόδοσης', 'man'],
  ['Κατάσταση', 'sys'], ['Σημείωση', 'man'],
  ['Check_out', 'sys'], ['Reservation ID', 'sys'], ['Κατάσταση κράτησης', 'sys'], ['Owner_Type', 'sys'], ['event_id', 'sys']
];
var REC_MANUAL = ['Εισπράχθηκε', 'Ημ/νία είσπραξης', 'Ποσό', 'Λογαριασμός', 'Τραπεζικά', 'Σημείωση',
  'Αποδόθηκε', 'Ημ/νία απόδοσης', 'Ποσό απόδοσης', 'Λογαριασμός απόδοσης'];
var REC_CHECKS = ['Εισπράχθηκε', 'Αποδόθηκε'];
var PLATFORM_RX = /airbnb|booking|vrbo|expedia|homeaway|plum|marriott/i;

function recPayer_(b) {
  var n = function (v) { var x = Number(v); return (v === '' || v === null || isNaN(x)) ? 0 : x; };
  var ot = String(b['Owner_Type'] || ''), src = String(b['Source'] || ''), pf = String(b['Platform'] || '');
  // Direct Cash: εισπράττει η Somnio όλο το ποσό· σε ακίνητο ιδιοκτήτη αποδίδει ποσό − προμήθεια.
  if (src === 'Direct Cash') {
    var full = n(b['Total payout']);
    var toOwner = (ot === 'Εταιρεία' || ot === 'Φυσικό') ? r2_(full - n(b['Comm_Total'])) : '';
    return { who: 'Επισκέπτης (μετρητά)', amount: full, toOwner: toOwner };
  }
  if (ot === 'Δικό μας') {
    if (PLATFORM_RX.test(pf)) return { who: 'Πλατφόρμα', amount: n(b['Total payout']) };
    return { who: 'Επισκέπτης', amount: n(b['Total value']) || n(b['Guest paid']) };
  }
  if (ot === 'Εταιρεία' || ot === 'Φυσικό') return { who: 'Ιδιοκτήτης', amount: n(b['Owner_Payable']) || n(b['Comm_Total']) };
  return { who: '? (λείπει Owner_Type)', amount: '' };
}

/** Ξαναχτίζει τη λίστα από το Master File, κρατώντας τις χειροκίνητες στήλες ανά event_id. */
function syncReceipts_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = recSheet_(ss);
  var lock = LockService.getDocumentLock(); lock.waitLock(20000);
  try {
    var m = hmap_(sh);
    var old = {};
    if (sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().forEach(function (r) {
        var id = String(r[m['event_id']] || ''); if (!id) return;
        var o = {}; for (var k in m) o[k] = r[m[k]]; old[id] = o;
      });
    }
    var mf = SomnioCore.openFile('FILE_MASTER_FILE');
    var bk = mf.getSheetByName('Bookings');
    if (!bk) throw new Error('Δεν βρέθηκε το tab Bookings στο Master File 2027.');
    var bm = SomnioCore.headerMap(bk), bv = bk.getLastRow() > 1 ? bk.getRange(2, 1, bk.getLastRow() - 1, bk.getLastColumn()).getValues() : [];
    var rows = [], seen = {};
    bv.forEach(function (r) {
      var b = {}; for (var k in bm) b[k] = r[bm[k]];
      var id = String(b['event_id'] || ''); if (!id) return;
      var ex = old[id];
      var cancelled = b['Status'] === 'Ακυρωμένη';
      var pay = recPayer_(b);
      var hasManual = ex && REC_MANUAL.some(function (c) { return !blank_(ex[c]) && ex[c] !== false; });
      if (cancelled && !hasManual && !(Number(pay.amount) > 0)) return;   // ακυρωμένη χωρίς χρέωση → εκτός λίστας
      seen[id] = 1;
      var o = {
        'Check_in': b['Check_in'], 'Check_out': b['Check_out'], 'Ακίνητο': b['Residence'], 'Επισκέπτης': b['Guest name'],
        'Πλατφόρμα': b['Platform'], 'Ποιος πληρώνει': pay.who, 'Αναμενόμενο': pay.amount,
        'Απόδοση σε ιδιοκτήτη': pay.toOwner === undefined ? '' : pay.toOwner,
        'Reservation ID': b['Reservation ID'], 'Κατάσταση κράτησης': b['Status'], 'Owner_Type': b['Owner_Type'], 'event_id': id
      };
      REC_MANUAL.forEach(function (c) { o[c] = ex ? ex[c] : (REC_CHECKS.indexOf(c) > -1 ? false : ''); });
      recDerive_(o);
      rows.push(o);
    });
    // Κράτηση που χάθηκε από το Master αλλά έχει καταχωρημένη είσπραξη → μένει, με σήμανση
    Object.keys(old).forEach(function (id) {
      if (seen[id]) return;
      var ex = old[id];
      if (!REC_MANUAL.some(function (c) { return !blank_(ex[c]) && ex[c] !== false; })) return;
      ex['Κατάσταση κράτησης'] = 'ΔΕΝ ΥΠΑΡΧΕΙ ΣΤΟ MASTER';
      recDerive_(ex); rows.push(ex);
    });
    rows.sort(function (a, b) {
      var x = a['Check_in'] instanceof Date ? a['Check_in'].getTime() : String(a['Check_in']);
      var y = b['Check_in'] instanceof Date ? b['Check_in'].getTime() : String(b['Check_in']);
      return x < y ? -1 : x > y ? 1 : 0;
    });
    var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h || '').trim(); });
    var out = rows.map(function (o) { return hdr.map(function (h) { return (o[h] === undefined || o[h] === null) ? '' : o[h]; }); });
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, hdr.length).clearContent();
    if (out.length) sh.getRange(2, 1, out.length, hdr.length).setValues(out);
    var cm = hmap_(sh);
    if (sh.getMaxRows() > 1) REC_CHECKS.forEach(function (c) {
      sh.getRange(2, cm[c] + 1, sh.getMaxRows() - 1, 1).removeCheckboxes();
      if (out.length) sh.getRange(2, cm[c] + 1, out.length, 1).insertCheckboxes();
    });
    var open = rows.filter(function (o) { return /Ανοιχτή|Μερική|απόδοση/.test(o['Κατάσταση']); }).length;
    return { rows: rows.length, open: open };
  } finally { lock.releaseLock(); }
}

/** Υπόλοιπο + Κατάσταση μιας γραμμής (είσπραξη και, για Direct Cash ιδιοκτήτη, απόδοση). */
function recDerive_(o) {
  var exp = num_(o['Αναμενόμενο']), paid = o['Εισπράχθηκε'] === true ? (num_(o['Ποσό']) || 0) : 0;
  var ci = o['Check_in'] instanceof Date ? o['Check_in'] : (o['Check_in'] ? new Date(String(o['Check_in'])) : null);
  if (exp === null) { o['Υπόλοιπο'] = ''; o['Κατάσταση'] = 'Χωρίς ποσό'; return o; }
  var rest = r2_(exp - paid);
  o['Υπόλοιπο'] = rest;
  var st;
  if (o['Εισπράχθηκε'] === true && rest <= 0.01) st = rest < -0.01 ? 'Εξοφλημένη (+' + r2_(-rest) + ')' : 'Εξοφλημένη';
  else if (paid > 0) st = 'Μερική';
  else if (ci && !isNaN(ci) && ci > new Date()) st = 'Μελλοντική';
  else st = 'Ανοιχτή';
  var owe = num_(o['Απόδοση σε ιδιοκτήτη']);
  if (owe !== null && owe > 0) {
    var given = o['Αποδόθηκε'] === true ? (num_(o['Ποσό απόδοσης']) || 0) : 0;
    if (given >= owe - 0.01) { if (/^Εξοφλημένη/.test(st)) st = 'Ολοκληρώθηκε'; else st += ' · αποδόθηκε'; }
    else if (paid > 0) st = (st === 'Μερική' ? 'Μερική' : 'Εισπράχθηκε') + ' · προς απόδοση ' + r2_(owe - given) + ' €';
  }
  o['Κατάσταση'] = st;
  return o;
}

/** onEdit: τσεκάρισμα → σημερινή ημ/νία + αναμενόμενο ποσό (μόνο αν είναι κενά) → Υπόλοιπο/Κατάσταση. */
function fillReceiptRows_(sh, start, n) {
  var m = hmap_(sh), lastCol = sh.getLastColumn();
  var rng = sh.getRange(start, 1, n, lastCol), vals = rng.getValues();
  var cols = ['Ημ/νία είσπραξης', 'Ποσό', 'Ημ/νία απόδοσης', 'Ποσό απόδοσης', 'Υπόλοιπο', 'Κατάσταση'];
  var outCols = cols.map(function () { return []; });
  vals.forEach(function (r) {
    var o = {}; for (var k in m) o[k] = r[m[k]];
    if (!o['event_id']) { cols.forEach(function (c, i) { outCols[i].push([o[c]]); }); return; }
    if (o['Εισπράχθηκε'] === true) {
      if (blank_(o['Ημ/νία είσπραξης'])) o['Ημ/νία είσπραξης'] = new Date(new Date().setHours(0, 0, 0, 0));
      if (blank_(o['Ποσό'])) o['Ποσό'] = o['Αναμενόμενο'];
    }
    if (o['Αποδόθηκε'] === true) {
      if (blank_(o['Ημ/νία απόδοσης'])) o['Ημ/νία απόδοσης'] = new Date(new Date().setHours(0, 0, 0, 0));
      if (blank_(o['Ποσό απόδοσης'])) o['Ποσό απόδοσης'] = o['Απόδοση σε ιδιοκτήτη'];
    }
    recDerive_(o);
    cols.forEach(function (c, i) { outCols[i].push([o[c]]); });
  });
  cols.forEach(function (c, i) { if (m[c] !== undefined) sh.getRange(start, m[c] + 1, n, 1).setValues(outCols[i]); });
}

function recSheet_(ss, restyle) {
  var sh = sheet_(ss, REC_TAB);
  var isNew = !sh;
  if (isNew) sh = ss.insertSheet(REC_TAB, 0);
  if (isNew || restyle) styleEntry_(sh, REC_COLS, '#6631D7');
  else ensureHeaders_(sh, REC_COLS.map(function (c) { return c[0]; }));
  return sh;
}

function setupReceipts_(ss) {
  var sh = recSheet_(ss, true);
  var m = hmap_(sh), rows = Math.max(sh.getMaxRows() - 1, 1);
  sh.setFrozenColumns(3);
  ['Check_in', 'Check_out'].forEach(function (c) { sh.getRange(2, m[c] + 1, rows, 1).setNumberFormat('dd/mm/yyyy'); });
  ['Αναμενόμενο', 'Υπόλοιπο', 'Απόδοση σε ιδιοκτήτη'].forEach(function (c) { sh.getRange(2, m[c] + 1, rows, 1).setNumberFormat('#,##0.00'); });
  var help = sheet_(ss, T.HELP), hm = hmap_(help);
  var accRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(help.getRange(2, hm['Λογαριασμοί'] + 1, Math.max(help.getMaxRows() - 1, 1), 1), true).setAllowInvalid(false).build();
  sh.getRange(2, m['Λογαριασμός'] + 1, rows, 1).setDataValidation(accRule);
  sh.getRange(2, m['Λογαριασμός απόδοσης'] + 1, rows, 1).setDataValidation(accRule);
  sh.getRange(1, m['Απόδοση σε ιδιοκτήτη'] + 1).setNote('Μόνο για Direct Cash σε ακίνητο ιδιοκτήτη: ό,τι εισπράξαμε μείον την προμήθειά μας. Τσέκαρε «Αποδόθηκε» όταν τα δώσεις.');
  // χρώματα κατάστασης
  var all = sh.getRange(2, 1, rows, sh.getLastColumn()), L = columnLetter_(m['Κατάσταση'] + 1);
  var rules = sh.getConditionalFormatRules().filter(function (r) { return r.getRanges()[0].getA1Notation() !== all.getA1Notation(); });
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=ISNUMBER(SEARCH("προς απόδοση",$' + L + '2))').setBackground('#FCE5CD').setRanges([all]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L + '2="Ολοκληρώθηκε"').setBackground('#DDF1E4').setRanges([all]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=LEFT($' + L + '2,10)="Εξοφλημένη"').setBackground('#DDF1E4').setRanges([all]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L + '2="Μερική"').setBackground('#FFF2CC').setRanges([all]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L + '2="Ανοιχτή"').setBackground('#FBEDED').setRanges([all]).build());
  sh.setConditionalFormatRules(rules);
  sh.getRange(1, m['Εισπράχθηκε'] + 1).setNote('Τσέκαρε όταν μπουν τα χρήματα. Μπαίνει σήμερα + το αναμενόμενο ποσό — άλλαξέ τα αν διαφέρουν.');
  sh.getRange(1, m['Αναμενόμενο'] + 1).setNote('Από το Master File: ιδιοκτήτης → προμήθεια + ΦΠΑ · δικό μας → payout πλατφόρμας / ποσό επισκέπτη · Direct Cash → ποσό.');
}

function columnLetter_(n) { var s = ''; while (n > 0) { var x = (n - 1) % 26; s = String.fromCharCode(65 + x) + s; n = Math.floor((n - 1) / 26); } return s; }

function syncReceiptsMenu() {
  var res = null;
  SomnioCore.runJob('Candy · Εισπράξεις κρατήσεων', function () {
    res = syncReceipts_();
    return { count: res.rows, detail: 'κρατήσεις ' + res.rows + ' · ανοιχτές ' + res.open };
  });
  if (res) SpreadsheetApp.getUi().alert('Εισπράξεις κρατήσεων: ' + res.rows + ' κρατήσεις, ' + res.open + ' ανοιχτές/μερικές.');
}
