/**
 * Owner Invoicing 2027 — τιμολόγια προμήθειας προς ιδιοκτήτες + email.
 *
 * Ροή (αρχιτεκτονική 7/11):
 *   Master File (κρατήσεις) + Master Properties (στοιχεία ιδιοκτήτη) → γραμμή ανά κράτηση στο tab «Τιμολόγηση»
 *   → έλεγχοι (διαβατήριο · voucher στον φάκελο · ΑΦΜ/email/στοιχεία) → «Έτοιμο»
 *   → [Oxygen: επαφή → παραστατικό → ΜΑΡΚ → PDF]   ← συνδέεται όταν έρθει το Sandbox API Key (Oxygen.gs)
 *   → email στον ιδιοκτήτη (κείμενο + PDF + voucher) → voucher στον φάκελο Sent.
 *
 * Κανόνες:
 *   - Μόνο ακίνητα ιδιοκτητών (Εταιρεία / Φυσικό), κρατήσεις Hosthub (Direct Cash εκτός — απόφαση 20/7/2026).
 *   - Εταιρεία → Τιμολόγιο Παροχής Υπηρεσιών (σειρά OXYGEN_SERIES_INVOICE, π.χ. ΠΡΟΜ)
 *     Φυσικό  → Απόδειξη Παροχής Υπηρεσιών (σειρά OXYGEN_SERIES_RECEIPT, π.χ. ΑΠΥ). Πηγή: Issue_Invoice του Master Properties.
 *   - Airbnb + Εταιρεία: ΔΥΟ γραμμές — (1) προμήθεια Somnio + ΦΠΑ 24% · (2) προμήθεια Airbnb + ΦΠΑ 24%.
 *     Ο ιδιοκτήτης πληρώνει: προμήθεια Somnio + ΦΠΑ και των δύο γραμμών (όχι την καθαρή προμήθεια Airbnb).
 *     Το email το γράφει ρητά (απόφαση 7/11).
 *   - Γίνεται «Έτοιμο» μετά το check-in. Χωρίς διαβατήριο ή voucher → περιμένει (λίστα στο «Έλεγχος»).
 *   - Ό,τι γράφει ο χρήστης ή το Oxygen (αρ. παραστατικού, ΜΑΡΚ, PDF, ημ/νίες, σημείωση, αναμονή) κρατιέται ανά κράτηση.
 *
 * Απαιτεί SomnioCore. Script Property (μόνο όταν συνδεθεί το Oxygen): OXYGEN_API_KEY — ποτέ στο GitHub/chat.
 */

var INV = { MAIN: 'Τιμολόγηση', CHECK: 'Έλεγχος', LOG: 'Log' };
var INV_HOLD = '✋ Αναμονή';
var INV_COLS = [
  // [όνομα, είδος] — sys: το γράφει το script · man: ο χρήστης · oxy: το Oxygen (όταν συνδεθεί)
  ['Κατάσταση', 'sys'], ['Check-in', 'sys'], ['Check-out', 'sys'], ['Ακίνητο', 'sys'], ['Ιδιοκτήτης', 'sys'],
  ['Παραστατικό', 'sys'], ['Πλατφόρμα', 'sys'], ['Επισκέπτης', 'sys'], ['Διαβατήριο', 'sys'],
  ['Προμήθεια Somnio', 'sys'], ['ΦΠΑ προμήθειας', 'sys'], ['Προμήθεια Airbnb', 'sys'], ['ΦΠΑ προμήθειας Airbnb', 'sys'],
  ['Σύνολο παραστατικού', 'sys'], ['Προς πληρωμή', 'sys'], ['Voucher', 'sys'], ['Τι λείπει', 'sys'],
  [INV_HOLD, 'man'], ['Σημείωση', 'man'],
  ['Αρ. παραστατικού', 'oxy'], ['ΜΑΡΚ', 'oxy'], ['PDF', 'oxy'], ['Εκδόθηκε', 'oxy'], ['Email στάλθηκε', 'oxy'], ['Oxygen_Invoice_ID', 'oxy'],
  ['Θέμα email', 'sys'], ['Κείμενο email', 'sys'], ['Περιγραφή γραμμής 1', 'sys'], ['Περιγραφή γραμμής 2', 'sys'],
  ['Αιτιολογία κατάθεσης', 'sys'], ['Email ιδιοκτήτη', 'sys'], ['Email λογιστή', 'sys'], ['ΑΦΜ', 'sys'],
  ['Επωνυμία', 'sys'], ['ΔΟΥ', 'sys'], ['Διεύθυνση', 'sys'], ['Oxygen_Contact_ID', 'sys'], ['Reservation ID', 'sys'], ['event_id', 'sys']
];
var INV_KEEP = INV_COLS.filter(function (c) { return c[1] === 'man' || c[1] === 'oxy'; }).map(function (c) { return c[0]; });

// -- ΒΟΗΘΗΤΙΚΑ -----------------------------------------------------------------------

function invDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v) ? null : v;
  var s = String(v || ''), m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var g = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return g ? new Date(+g[3], +g[2] - 1, +g[1]) : null;
}
function invNum_(v) {
  if (typeof v === 'number') return v;
  var s = String(v === null || v === undefined ? '' : v).replace(/[€\s]/g, '');
  if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
  var n = Number(s); return isNaN(n) ? 0 : n;
}
function invR2_(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function invKey_(s) { return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
function invDMY_(d) { d = invDate_(d); return d ? ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear() : ''; }
function invEuro_(n) {
  var x = invR2_(n), neg = x < 0; x = Math.abs(x);
  var p = x.toFixed(2).split('.'), i = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '−' : '') + i + ',' + p[1] + ' €';
}
function invTable_(ss, name) {
  var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return [];
  var m = SomnioCore.headerMap(sh), v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return v.map(function (r) { var o = {}; for (var k in m) o[k] = r[m[k]]; return o; });
}
function invVat_() { var v = Number(SomnioCore.cfg('COMMISSION_VAT', false)); return v > 1 ? v / 100 : (v || 0.24); }

// -- ΚΕΙΜΕΝΑ -----------------------------------------------------------------------

/** Αιτιολογία κατάθεσης: «Ακίνητο_dd.mm.yyyy_dd.mm.yyyy» — χωρίς «/» (οι τράπεζες δεν το δέχονται). */
function invBankRef_(res, ci, co) { return String(res || '').replace(/\//g, '-').trim() + '_' + invDMY_(ci) + '_' + invDMY_(co); }

function invLine1_(r) {
  return 'Προμήθεια διαχείρισης βραχυχρόνιας μίσθωσης — ' + r.res + ' — ' + invDMY_(r.ci) + ' έως ' + invDMY_(r.co) +
    ' — ' + r.platform + (r.resId ? ' ' + r.resId : '');
}
function invLine2_(r) {
  return r.airbnb > 0 ? 'Επανατιμολόγηση προμήθειας Airbnb — κράτηση ' + (r.resId || '') + ' — ' + r.res : '';
}

/**
 * Κείμενο email προς ιδιοκτήτη. Τιμολόγιο: με ανάλυση ποσών (και ρητά η αφαίρεση της προμήθειας Airbnb).
 * Απόδειξη (φυσικό πρόσωπο): όπως το 2026 — στοιχεία κράτησης + ποσό προς πληρωμή.
 */
function invEmail_(r, bankText) {
  var plat = r.platform === 'Airbnb' ? 'Airbnb.com' : r.platform;
  var receipt = r.doc === 'Απόδειξη';
  var hi = String(r.greet || '').trim();
  var L = [];
  L.push(hi ? 'Καλησπέρα ' + hi + ',' : 'Καλησπέρα,');
  L.push('');
  L.push('Επισυναπτόμενα θα βρείτε ' + (receipt ? 'την απόδειξη' : 'το τιμολόγιο') + ' της προμήθειάς μας και το voucher της ' + plat +
    ' για την κράτηση της περιόδου ' + invDMY_(r.ci) + ' – ' + invDMY_(r.co) + '.');
  L.push('');
  L.push('Ακίνητο: ' + r.res);
  L.push('Όνομα Επισκέπτη: ' + r.guest);
  L.push('Διαβατήριο Κράτησης: ' + (r.passport || '—'));
  L.push('Πλατφόρμα: ' + plat + (r.resId ? ' (' + r.resId + ')' : ''));
  L.push('Check in: ' + invDMY_(r.ci));
  L.push('Check out: ' + invDMY_(r.co));
  L.push('');
  if (!receipt && r.airbnb > 0) {
    L.push('Ανάλυση τιμολογίου:');
    L.push('  Προμήθεια Somnio: ' + invEuro_(r.comm));
    L.push('  ΦΠΑ 24% προμήθειας Somnio: ' + invEuro_(r.commVat));
    L.push('  Προμήθεια Airbnb (επανατιμολόγηση): ' + invEuro_(r.airbnb));
    L.push('  ΦΠΑ 24% προμήθειας Airbnb: ' + invEuro_(r.airbnbVat));
    L.push('  Σύνολο τιμολογίου: ' + invEuro_(r.total));
    L.push('');
    L.push('Η καθαρή προμήθεια της Airbnb (' + invEuro_(r.airbnb) + ') έχει ήδη παρακρατηθεί από την Airbnb κατά την πληρωμή σας, ' +
      'οπότε δεν την πληρώνετε ξανά:');
    L.push('  Σύνολο τιμολογίου: ' + invEuro_(r.total));
    L.push('  Μείον καθαρή προμήθεια Airbnb: ' + invEuro_(-r.airbnb));
    L.push('  ΠΟΣΟ ΠΡΟΣ ΠΛΗΡΩΜΗ: ' + invEuro_(r.payable));
    L.push('  (= προμήθεια Somnio ' + invEuro_(r.comm) + ' + ΦΠΑ προμήθειας Somnio ' + invEuro_(r.commVat) +
      ' + ΦΠΑ προμήθειας Airbnb ' + invEuro_(r.airbnbVat) + ')');
  } else if (!receipt) {
    L.push('Ανάλυση τιμολογίου:');
    L.push('  Προμήθεια Somnio: ' + invEuro_(r.comm));
    L.push('  ΦΠΑ 24%: ' + invEuro_(r.commVat));
    L.push('  ΠΟΣΟ ΠΡΟΣ ΠΛΗΡΩΜΗ: ' + invEuro_(r.payable));
  } else {
    L.push('Ποσό προς πληρωμή: ' + invEuro_(r.payable));
  }
  L.push('');
  L.push('Παρακαλούμε τα έξοδα συναλλαγής να επιβαρύνουν τον εντολέα και, αν μπορείτε, επισυνάψτε μας το αποδεικτικό της κατάθεσης.');
  L.push('Στην αιτιολογία της κατάθεσης παρακαλούμε κάντε copy paste το παρακάτω:');
  L.push(invBankRef_(r.res, r.ci, r.co));
  if (bankText) { L.push(''); L.push(String(bankText)); }
  L.push('');
  L.push('Ευχαριστούμε πολύ,');
  L.push('Somnio');
  return L.join('\n');
}

// -- ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ: κρατήσεις + ιδιοκτήτες → γραμμές ------------------------------

/**
 * bookings: Master File › Bookings · props: Master Properties › Properties · vouchers: {resId → url}
 * old: {event_id → {στήλη: τιμή}} · today: Date · vat: 0.24
 */
function invBuild_(bookings, props, vouchers, old, today, vat, bankText) {
  var t0 = new Date(today); t0.setHours(0, 0, 0, 0);
  var P = {};
  props.forEach(function (p) { var n = String(p['Residence'] || '').trim(); if (n) P[invKey_(n)] = p; });
  var rows = [], issues = [];
  bookings.forEach(function (b) {
    var id = String(b['event_id'] || ''); if (!id) return;
    var ot = String(b['Owner_Type'] || '').trim();
    if (ot !== 'Εταιρεία' && ot !== 'Φυσικό') return;
    if (String(b['Source'] || '') === 'Direct Cash' || b['Status'] === 'Ακυρωμένη') return;
    var p = P[invKey_(b['Residence'])] || {};
    var comm = invR2_(invNum_(b['Comm_Net'])), commVat = invR2_(invNum_(b['Comm_VAT']));
    if (!(comm > 0)) return;
    var airbnb = invR2_(invNum_(b['Airbnb_Fee_Recharge'])), airbnbVat = invR2_(invNum_(b['Airbnb_Fee_VAT']));
    var issue = String(p['Issue_Invoice'] || '').trim();
    var doc = /απόδ/i.test(issue) ? 'Απόδειξη' : /τιμολ/i.test(issue) ? 'Τιμολόγιο' : (ot === 'Εταιρεία' ? 'Τιμολόγιο' : 'Απόδειξη');
    if (doc === 'Απόδειξη') { airbnb = 0; airbnbVat = 0; }               // επανατιμολόγηση μόνο σε εταιρείες
    var r = {
      id: id, ci: invDate_(b['Check_in']), co: invDate_(b['Check_out']), res: String(b['Residence'] || ''),
      owner: String(p['Owner_Name'] || ''), legal: String(p['Owner_Legal_Name'] || ''), afm: invAfm_(p['AFM']),
      doy: String(p['DOY'] || ''), addr: String(p['Owner_Address'] || ''), email: invEmails_(p['Owner_Email']).ok,
      acc: invEmails_(p['Accountant_Email']).ok, greet: p['Greeting_Name'], contact: p['Oxygen_Contact_ID'] || '',
      platform: String(b['Platform'] || '').trim(), guest: String(b['Guest name'] || ''), passport: String(b['Passport_AFM'] || '').trim(),
      resId: String(b['Reservation ID'] || '').trim(), doc: doc, comm: comm, commVat: commVat, airbnb: airbnb, airbnbVat: airbnbVat
    };
    r.total = invR2_(comm + commVat + airbnb + airbnbVat);
    r.payable = invR2_(comm + commVat + airbnbVat);
    var miss = [];
    if (!r.passport) miss.push('διαβατήριο (Hosthub)');
    var vUrl = r.resId && vouchers[invKey_(r.resId)];
    if (!vUrl) miss.push('voucher στον φάκελο Vouchers');
    if (!r.email) miss.push('Owner_Email');
    [['Owner_Email', p['Owner_Email']], ['Accountant_Email', p['Accountant_Email']]].forEach(function (x) {
      var bad = invEmails_(x[1]).bad; if (bad.length) miss.push(x[0] + ' λάθος: ' + bad.join(', '));
    });
    // Επωνυμία / ΔΟΥ / διεύθυνση τα φέρνει το Oxygen από τη ΓΓΠΣ με το ΑΦΜ — αρκεί το ΑΦΜ.
    if (doc === 'Τιμολόγιο' && !/^\d{9}$/.test(r.afm)) miss.push('ΑΦΜ (9 ψηφία)');
    var ex = old[id] || {};
    var st;
    if (ex['Email στάλθηκε']) st = 'Στάλθηκε';
    else if (ex['Αρ. παραστατικού']) st = 'Εκδόθηκε';
    else if (ex[INV_HOLD] === true) st = 'Σε αναμονή';
    else if (r.ci && r.ci > t0) st = 'Μελλοντική';
    else if (miss.length) st = 'Λείπουν στοιχεία';
    else st = 'Έτοιμο για έκδοση';
    var o = {
      'Κατάσταση': st, 'Check-in': r.ci || '', 'Check-out': r.co || '', 'Ακίνητο': r.res, 'Ιδιοκτήτης': r.owner, 'Παραστατικό': doc,
      'Πλατφόρμα': r.platform, 'Επισκέπτης': r.guest, 'Διαβατήριο': r.passport,
      'Προμήθεια Somnio': comm, 'ΦΠΑ προμήθειας': commVat, 'Προμήθεια Airbnb': airbnb || '', 'ΦΠΑ προμήθειας Airbnb': airbnbVat || '',
      'Σύνολο παραστατικού': r.total, 'Προς πληρωμή': r.payable, 'Voucher': vUrl || '', 'Τι λείπει': miss.join(', '),
      'Θέμα email': (doc === 'Τιμολόγιο' ? 'Τιμολόγιο' : 'Απόδειξη') + ' προμήθειας — ' + r.res + ' — ' + invDMY_(r.ci) + ' – ' + invDMY_(r.co),
      'Κείμενο email': invEmail_(r, bankText), 'Περιγραφή γραμμής 1': invLine1_(r), 'Περιγραφή γραμμής 2': invLine2_(r),
      'Αιτιολογία κατάθεσης': invBankRef_(r.res, r.ci, r.co), 'Email ιδιοκτήτη': r.email, 'Email λογιστή': r.acc, 'ΑΦΜ': r.afm,
      'Επωνυμία': r.legal || r.owner, 'ΔΟΥ': r.doy, 'Διεύθυνση': r.addr, 'Oxygen_Contact_ID': r.contact, 'Reservation ID': r.resId, 'event_id': id
    };
    INV_KEEP.forEach(function (c) { o[c] = ex[c] !== undefined ? ex[c] : (c === INV_HOLD ? false : ''); });
    rows.push(o);
    if (st === 'Λείπουν στοιχεία') issues.push([r.res, invDMY_(r.ci), r.guest, miss.join(', ')]);
  });
  // κρατήσεις που χάθηκαν από το Master αλλά έχουν εκδοθεί → μένουν με σήμανση
  Object.keys(old).forEach(function (id) {
    if (rows.some(function (o) { return o.event_id === id; })) return;
    var ex = old[id];
    if (!ex['Αρ. παραστατικού'] && !ex['Email στάλθηκε']) return;
    var o = {}; for (var k in ex) o[k] = ex[k];
    o['Κατάσταση'] = 'ΕΛΕΓΧΟΣ: δεν υπάρχει στο Master'; o['event_id'] = id; rows.push(o);
    issues.push([ex['Ακίνητο'], invDMY_(ex['Check-in']), ex['Επισκέπτης'], 'Η κράτηση δεν υπάρχει πια στο Master αλλά έχει παραστατικό']);
  });
  rows.sort(function (a, b) { return (a['Check-in'] ? a['Check-in'].getTime() : 0) - (b['Check-in'] ? b['Check-in'].getTime() : 0); });
  return { rows: rows, issues: issues };
}

// -- VOUCHERS ------------------------------------------------------------------------

/** Αρχεία του φακέλου Vouchers: {reservationId (από το όνομα αρχείου) → url}. */
function invVouchers_() {
  var out = {}, id = String(SomnioCore.cfg('FOLDER_VOUCHERS', false) || '').trim();
  if (!id) return out;
  var it = DriveApp.getFolderById(id).getFiles();
  while (it.hasNext()) {
    var f = it.next(), name = f.getName();
    (name.match(/[A-Z0-9]{6,}/gi) || []).forEach(function (tok) { out[invKey_(tok)] = f.getUrl(); });
  }
  return out;
}

// -- ΕΝΗΜΕΡΩΣΗ ------------------------------------------------------------------------

function updateInvoicing(silent) {
  var res = null;
  var ok = SomnioCore.runJob('Owner Invoicing · Ενημέρωση', function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = invSheet_(ss);
    var old = {}, m = SomnioCore.headerMap(sh);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().forEach(function (r) {
      var id = String(r[m['event_id']] || ''); if (!id) return;
      var o = {}; for (var k in m) o[k] = r[m[k]]; old[id] = o;
    });
    var mf = SomnioCore.openFile('FILE_MASTER_FILE'), mp = SomnioCore.openFile('FILE_MASTER_PROPERTIES');
    var props = invTable_(mp, (mp.getSheetByName('Properties') || mp.getSheets()[0]).getName());
    res = invBuild_(invTable_(mf, 'Bookings'), props, invVouchers_(), old, new Date(), invVat_(), SomnioCore.cfg('BANK_DETAILS', false));
    var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h || '').trim(); });
    var out = res.rows.map(function (o) { return hdr.map(function (h) { return o[h] === undefined || o[h] === null ? '' : o[h]; }); });
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, hdr.length).clearContent();
    if (out.length) sh.getRange(2, 1, out.length, hdr.length).setValues(out);
    var hc = hdr.indexOf(INV_HOLD) + 1;
    if (sh.getMaxRows() > 1) sh.getRange(2, hc, sh.getMaxRows() - 1, 1).removeCheckboxes();
    if (out.length) sh.getRange(2, hc, out.length, 1).insertCheckboxes();
    invWriteChecks_(ss, res.issues);
    try { refreshMarks(true); } catch (e) {}
    var ready = res.rows.filter(function (o) { return o['Κατάσταση'] === 'Έτοιμο για έκδοση'; }).length;
    return { count: res.rows.length, detail: 'γραμμές ' + res.rows.length + ' · έτοιμα ' + ready + ' · λείπουν στοιχεία ' + res.issues.length };
  });
  if (!silent) SpreadsheetApp.getUi().alert(ok ? 'Ενημέρωση ΟΚ — ' + res.rows.length + ' κρατήσεις, ' + res.issues.length + ' με ελλείψεις.' : 'Σφάλμα — δες το Health στο Config.');
}
function updateInvoicingAuto() { updateInvoicing(true); }

function invWriteChecks_(ss, issues) {
  var sh = ss.getSheetByName(INV.CHECK) || ss.insertSheet(INV.CHECK);
  sh.clear();
  var M = [['Ακίνητο', 'Check-in', 'Επισκέπτης', 'Τι λείπει για να εκδοθεί']].concat(issues.length ? issues : [['Καμία εκκρεμότητα ✓', '', '', '']]);
  sh.getRange(1, 1, M.length, 4).setValues(M);
  sh.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#9C4F24').setFontColor('#FFFFFF');
  sh.setFrozenRows(1); sh.setColumnWidth(4, 520);
  sh.getRange(M.length + 2, 1).setValue('Διαβατήριο → συμπλήρωσε στη Hosthub · Voucher → ανέβασε PDF στο Shared Drive › 03 Invoicing › Vouchers ' +
    'με τον κωδικό κράτησης στο όνομα (π.χ. HMRZX8NWY2.pdf) · Στοιχεία ιδιοκτήτη → Master Properties.')
    .setFontStyle('italic').setFontSize(9).setFontColor('#777777');
}

// -- GMAIL DRAFT (μέχρι να συνδεθεί το Oxygen: μόνο voucher ως συνημμένο) ----------------

/** Δημιουργεί Gmail draft για τη γραμμή που είναι επιλεγμένη. Δεν στέλνει τίποτα. */
function draftSelected() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getActiveSheet(), ui = SpreadsheetApp.getUi();
  if (sh.getName() !== INV.MAIN) { ui.alert('Πήγαινε στο tab «' + INV.MAIN + '» και διάλεξε μια γραμμή.'); return; }
  var row = sh.getActiveRange().getRow(); if (row < 2) { ui.alert('Διάλεξε μια γραμμή κράτησης.'); return; }
  var m = SomnioCore.headerMap(sh), v = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  var g = function (c) { return v[m[c]]; };
  if (!g('Email ιδιοκτήτη')) { ui.alert('Λείπει το email του ιδιοκτήτη (Master Properties › Owner_Email).'); return; }
  var att = [];
  var fileId = function (url) { var x = String(url || '').match(/[-\w]{25,}/); return x ? x[0] : null; };
  [g('PDF'), g('Voucher')].forEach(function (u) { var id = fileId(u); if (id) att.push(DriveApp.getFileById(id).getBlob()); });
  var opts = { attachments: att };
  if (g('Email λογιστή')) opts.cc = String(g('Email λογιστή'));
  GmailApp.createDraft(String(g('Email ιδιοκτήτη')), String(g('Θέμα email')), String(g('Κείμενο email')), opts);
  SomnioCore.logRun('Owner Invoicing · Draft', 'OK', 1, g('Ακίνητο') + ' ' + g('Επισκέπτης'));
  ui.alert('Δημιουργήθηκε draft στο Gmail (' + att.length + ' συνημμένα). Έλεγξέ το πριν το στείλεις.' +
    (g('PDF') ? '' : '\n\nΣημ.: το παραστατικό δεν έχει εκδοθεί ακόμα — το PDF θα μπαίνει αυτόματα όταν συνδεθεί το Oxygen.'));
}

// -- ΕΚΔΟΣΗ & ΑΠΟΣΤΟΛΗ (Oxygen) ------------------------------------------------------

/** Η επιλεγμένη γραμμή του tab: { row, g(στήλη), set(στήλη, τιμή) }. */
function invPick_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getActiveSheet(), ui = SpreadsheetApp.getUi();
  if (sh.getName() !== INV.MAIN) { ui.alert('Πήγαινε στο tab «' + INV.MAIN + '» και κάνε κλικ σε μια γραμμή κράτησης.'); return null; }
  var row = sh.getActiveRange().getRow();
  if (row < 2 || sh.getActiveRange().getNumRows() > 1) { ui.alert('Κάνε κλικ σε ΜΙΑ γραμμή κράτησης.'); return null; }
  invSheet_(ss);
  var m = SomnioCore.headerMap(sh), v = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  return {
    sh: sh, row: row,
    g: function (c) { return m[c] === undefined ? '' : v[m[c]]; },
    set: function (c, val) { if (m[c] !== undefined) { sh.getRange(row, m[c] + 1).setValue(val); v[m[c]] = val; } }
  };
}

/** «a@x.gr / b@y.gr» ή με κόμμα, ; ή αλλαγή γραμμής → { ok: 'a@x.gr, b@y.gr', bad: [λάθος γραμμένα] }. */
function invEmails_(s) {
  var ok = [], bad = [];
  String(s || '').split(/[\s,;\/]+/).forEach(function (e) {
    e = e.trim(); if (!e) return;
    (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e) ? ok : bad).push(e);
  });
  return { ok: ok.join(', '), bad: bad };
}

function invPdfName_(g) { return String(g('Αρ. παραστατικού')).replace(/\s+/g, '_') + '_' + String(g('Αιτιολογία κατάθεσης')); }

/** Γράφει το Oxygen_Contact_ID στο Master Properties (σε όλα τα ακίνητα του ίδιου ιδιοκτήτη χωρίς id). */
function invSaveContact_(owner, res, cid) {
  var mp = SomnioCore.openFile('FILE_MASTER_PROPERTIES'), sh = mp.getSheetByName('Properties') || mp.getSheets()[0];
  var m = SomnioCore.headerMap(sh); if (m['Oxygen_Contact_ID'] === undefined || sh.getLastRow() < 2) return 0;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues(), n = 0;
  v.forEach(function (r, i) {
    var same = (owner && invKey_(r[m['Owner_Name']]) === invKey_(owner)) || invKey_(r[m['Residence']]) === invKey_(res);
    if (same && !String(r[m['Oxygen_Contact_ID']] || '').trim()) { sh.getRange(i + 2, m['Oxygen_Contact_ID'] + 1).setValue(cid); n++; }
  });
  return n;
}

/**
 * Εκδίδει στο Oxygen το παραστατικό της επιλεγμένης γραμμής (ρωτάει πρώτα).
 * Παραγωγή: μόνο «Έτοιμο για έκδοση». Sandbox: και Μελλοντική / Λείπουν στοιχεία (για δοκιμή), αρκεί να υπάρχουν τα στοιχεία ιδιοκτήτη.
 */
function issueSelected() {
  var ui = SpreadsheetApp.getUi(), P = invPick_(); if (!P) return;
  var g = P.g, prod = oxyIsProd_(), st = String(g('Κατάσταση'));
  if (g('Oxygen_Invoice_ID') || g('Αρ. παραστατικού')) { ui.alert('Έχει ήδη εκδοθεί: ' + g('Αρ. παραστατικού') + '. Δεν εκδίδω δεύτερο.'); return; }
  if (g(INV_HOLD) === true) { ui.alert('Η γραμμή είναι σε ✋ Αναμονή.'); return; }
  var allowed = prod ? ['Έτοιμο για έκδοση'] : ['Έτοιμο για έκδοση', 'Μελλοντική', 'Λείπουν στοιχεία'];
  if (allowed.indexOf(st) === -1) { ui.alert('Κατάσταση «' + st + '» — δεν εκδίδεται.' + (g('Τι λείπει') ? '\nΛείπουν: ' + g('Τι λείπει') : '')); return; }
  var q = (prod ? '⚠ ΠΑΡΑΓΩΓΗ — θα σταλεί ΚΑΝΟΝΙΚΑ στο myDATA.\n\n' : 'ΔΟΚΙΜΗ (sandbox) — δεν μετράει στην εφορία.\n\n') +
    g('Παραστατικό') + ' προς ' + (g('Επωνυμία') || g('Ιδιοκτήτης')) + (g('ΑΦΜ') ? ' (ΑΦΜ ' + g('ΑΦΜ') + ')' : '') + '\n' +
    g('Ακίνητο') + ' · ' + invDMY_(g('Check-in')) + ' – ' + invDMY_(g('Check-out')) + ' · ' + g('Επισκέπτης') + '\n\n' +
    'Προμήθεια Somnio ' + invEuro_(invNum_(g('Προμήθεια Somnio'))) + ' + ΦΠΑ ' + invEuro_(invNum_(g('ΦΠΑ προμήθειας'))) +
    (invNum_(g('Προμήθεια Airbnb')) > 0 && g('Παραστατικό') === 'Τιμολόγιο' ? '\nΠρομήθεια Airbnb ' + invEuro_(invNum_(g('Προμήθεια Airbnb'))) + ' + ΦΠΑ ' + invEuro_(invNum_(g('ΦΠΑ προμήθειας Airbnb'))) : '') +
    '\nΣύνολο ' + invEuro_(invNum_(g('Σύνολο παραστατικού'))) + ' · Προς πληρωμή ' + invEuro_(invNum_(g('Προς πληρωμή'))) +
    (st !== 'Έτοιμο για έκδοση' ? '\n\n(Κατάσταση: ' + st + ' — επιτρέπεται μόνο επειδή είμαστε σε sandbox.)' : '') + '\n\nΝα εκδοθεί;';
  if (ui.alert('Έκδοση παραστατικού', q, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var lock = LockService.getDocumentLock(); if (!lock.tryLock(20000)) { ui.alert('Τρέχει ήδη άλλη έκδοση — δοκίμασε σε λίγο.'); return; }
  var msg = '', ok = false;
  try {
    ok = SomnioCore.runJob('Owner Invoicing · Έκδοση', function () {
      var ids = oxySetup_(g('Παραστατικό'));
      var c = oxyContact_(g);
      if (c.created || !g('Oxygen_Contact_ID')) { P.set('Oxygen_Contact_ID', c.id); invSaveContact_(g('Ιδιοκτήτης'), g('Ακίνητο'), c.id); }
      var body = oxyInvoiceBody_(g, ids, c.id, new Date());
      var r = oxyCall_('post', '/invoices', body);
      if (r.code !== 200 && r.code !== 201) throw new Error('Έκδοση: ' + oxyErr_(r));
      var inv = r.body.data || r.body, md = inv.mydata || {};
      P.set('Oxygen_Invoice_ID', inv.id);
      P.set('Αρ. παραστατικού', (inv.numbering_sequence || ids.seq.name) + ' ' + inv.number);
      P.set('Εκδόθηκε', new Date());
      P.sh.getRange(P.row, SomnioCore.headerMap(P.sh)['ΜΑΡΚ'] + 1).setNumberFormat('@');
      P.set('ΜΑΡΚ', md.mark ? String(md.mark) : (md.errors ? '⚠ myDATA: ' + String(md.errors.response || '').slice(0, 300) : '(αναμένεται)'));
      P.set('Κατάσταση', 'Εκδόθηκε');
      // Το PDF κατεβαίνει μόνο όταν υπάρχει ΜΑΡΚ (αλλιώς τυπώνεται χωρίς ΜΑΡΚ/QR) — αλλιώς το φέρνει το «Φέρε ΜΑΡΚ».
      var pdf = '';
      if (md.mark) {
        try { pdf = oxySavePdf_(inv.id, invPdfName_(g)); P.set('PDF', pdf); }
        catch (e) { P.set('PDF', '⚠ ' + e.message.slice(0, 200)); }
      }
      msg = 'Εκδόθηκε ' + g('Αρ. παραστατικού') + '\nΜΑΡΚ: ' + g('ΜΑΡΚ') +
        '\nPDF: ' + (pdf ? 'αποθηκεύτηκε' : md.mark ? 'ΔΕΝ αποθηκεύτηκε — δες τη στήλη PDF' : 'θα κατέβει μόλις έρθει ο ΜΑΡΚ («6. Φέρε ΜΑΡΚ»)') +
        '\nΣύνολο Oxygen: ' + invEuro_(inv.total_amount) + (Math.abs(invNum_(inv.total_amount) - invNum_(g('Σύνολο παραστατικού'))) > 0.009 ? '  ⚠ ΔΙΑΦΟΡΑ με το φύλλο!' : ' ✓');
      return { count: 1, detail: (prod ? 'PROD ' : 'SANDBOX ') + g('Αρ. παραστατικού') + ' · ' + g('Ακίνητο') + ' · ' + g('Επισκέπτης') };
    });
  } finally { lock.releaseLock(); }
  if (ok) ui.alert(msg);   // σε σφάλμα το runJob έχει ήδη δείξει μήνυμα
}

/**
 * Στέλνει το email της επιλεγμένης γραμμής με συνημμένα PDF + voucher (κοινοποίηση στον λογιστή).
 * Sandbox: πάει ΜΟΝΟ σε σένα, με [ΔΟΚΙΜΗ] στο θέμα, και το voucher δεν μετακινείται.
 */
function sendSelected() {
  var ui = SpreadsheetApp.getUi(), P = invPick_(); if (!P) return;
  var g = P.g, prod = oxyIsProd_();
  if (g('Email στάλθηκε')) { ui.alert('Έχει ήδη σταλεί (' + invDMY_(g('Email στάλθηκε')) + ').'); return; }
  var fileId = function (url) { var x = String(url || '').match(/[-\w]{25,}/); return x ? x[0] : null; };
  if (!/^\d{10,}$/.test(String(g('ΜΑΡΚ')))) { ui.alert('Δεν υπάρχει ακόμα ΜΑΡΚ — πάτα «6. Φέρε ΜΑΡΚ από Oxygen» (ή στείλε το στο myDATA από το Oxygen).'); return; }
  if (!fileId(g('PDF'))) { ui.alert('Δεν υπάρχει PDF παραστατικού — πάτα «6. Φέρε ΜΑΡΚ από Oxygen».'); return; }
  var me = String(SomnioCore.cfg('TEST_EMAIL', false) || '').trim() || Session.getActiveUser().getEmail();   // sandbox: πού πάει η δοκιμή
  var to = prod ? String(g('Email ιδιοκτήτη') || '').trim() : me;
  if (!to) { ui.alert('Λείπει το email του ιδιοκτήτη (Master Properties › Owner_Email).'); return; }
  var cc = prod ? String(g('Email λογιστή') || '').trim() : '';
  var vId = fileId(g('Voucher'));
  if (prod && !vId) { ui.alert('Λείπει το voucher.'); return; }
  var subj = (prod ? '' : '[ΔΟΚΙΜΗ] ') + g('Θέμα email');
  var q = 'Προς: ' + to + (cc ? '\nΚοιν.: ' + cc : '') + '\nΘέμα: ' + subj + '\nΣυνημμένα: PDF παραστατικού' + (vId ? ' + voucher' : '') +
    (prod ? '' : '\n\n(Sandbox: πάει μόνο σε σένα — ο ιδιοκτήτης θα ήταν ' + (g('Email ιδιοκτήτη') || '—') + ')') + '\n\nΝα σταλεί;';
  if (ui.alert('Αποστολή email', q, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var ok = SomnioCore.runJob('Owner Invoicing · Email', function () {
    var att = [DriveApp.getFileById(fileId(g('PDF'))).getBlob()];
    if (vId) att.push(DriveApp.getFileById(vId).getBlob());
    var opt = { attachments: att, name: 'Somnio' }; if (cc) opt.cc = cc;
    GmailApp.sendEmail(to, subj, String(g('Κείμενο email')), opt);
    P.set('Email στάλθηκε', new Date());
    if (prod) P.set('Κατάσταση', 'Στάλθηκε');
    var sent = String(SomnioCore.cfg('FOLDER_VOUCHERS_SENT', false) || '').trim();
    if (prod && vId && sent) DriveApp.getFileById(vId).moveTo(DriveApp.getFolderById(sent));
    return { count: 1, detail: (prod ? '' : 'SANDBOX ') + g('Ακίνητο') + ' → ' + to };
  });
  ui.alert(ok ? 'Στάλθηκε στο ' + to + '.' : 'Σφάλμα — δες το Health/Log στο Config.');
}

// -- ΣΤΗΣΙΜΟ -------------------------------------------------------------------------

function invSheet_(ss) {
  var sh = ss.getSheetByName(INV.MAIN);
  if (!sh) { var f = ss.getSheets()[0]; sh = f.getLastRow() === 0 ? f.setName(INV.MAIN) : ss.insertSheet(INV.MAIN, 0); }
  var last = Math.max(sh.getLastColumn(), 1), hdr = sh.getRange(1, 1, 1, last).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var missing = INV_COLS.map(function (c) { return c[0]; }).filter(function (n) { return hdr.indexOf(n) === -1; });
  if (missing.length) {
    var start = hdr.some(String) ? sh.getLastColumn() + 1 : 1;
    var need = start + missing.length - 1 - sh.getMaxColumns(); if (need > 0) sh.insertColumnsAfter(sh.getMaxColumns(), need);
    sh.getRange(1, start, 1, missing.length).setValues([missing]);
  }
  return sh;
}

function setupInvoicing() {
  SomnioCore.runJob('Owner Invoicing · Στήσιμο', function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.setSpreadsheetTimeZone(String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens'));
    try { ss.setSpreadsheetLocale('el_GR'); } catch (e) {}
    var sh = invSheet_(ss), m = SomnioCore.headerMap(sh), rows = Math.max(sh.getMaxRows() - 1, 1);
    sh.setFrozenRows(1); sh.setFrozenColumns(4);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#9C4F24').setFontColor('#FFFFFF').setWrap(true);
    sh.setRowHeight(1, 40);
    INV_COLS.forEach(function (c) {
      var i = m[c[0]]; if (i === undefined) return;
      var r = sh.getRange(2, i + 1, rows, 1);
      r.setBackground(c[1] === 'man' ? '#FFF8DC' : c[1] === 'oxy' ? '#EAF2FB' : null);
      if (/^Check|Εκδόθηκε|Email στάλθηκε/.test(c[0])) r.setNumberFormat('dd/mm/yyyy');
      if (/Προμήθεια|ΦΠΑ|Σύνολο|Προς πληρωμή/.test(c[0])) r.setNumberFormat('#,##0.00');
      if (/^Κείμενο email|^Περιγραφή/.test(c[0])) r.setWrap(false);
      if (c[0] === 'ΑΦΜ') r.setNumberFormat('@');   // να μη χάνεται το 0 μπροστά
    });
    var L = function (n) { var x = m[n] + 1, s = ''; while (x > 0) { var k = (x - 1) % 26; s = String.fromCharCode(65 + k) + s; x = Math.floor((x - 1) / 26); } return s; };
    var all = sh.getRange(2, 1, rows, sh.getLastColumn()), st = L('Κατάσταση');
    var rule = function (v, c) { return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + st + '2="' + v + '"').setBackground(c).setRanges([all]).build(); };
    sh.setConditionalFormatRules([rule('Έτοιμο για έκδοση', '#FFF2CC'), rule('Λείπουν στοιχεία', '#FBEDED'), rule('Εκδόθηκε', '#DCE6F7'),
      rule('Στάλθηκε', '#DDF1E4'), rule('Σε αναμονή', '#EEEEEE')]);
    ['Κείμενο email', 'Περιγραφή γραμμής 1', 'Περιγραφή γραμμής 2', 'Email λογιστή', 'ΑΦΜ', 'Επωνυμία', 'ΔΟΥ', 'Διεύθυνση', 'Oxygen_Contact_ID', 'event_id']
      .forEach(function (c) { if (m[c] !== undefined) sh.setColumnWidth(m[c] + 1, 120); });
    sh.getRange(1, m[INV_HOLD] + 1).setNote('Τσέκαρε για να ΜΗΝ εκδοθεί/σταλεί (π.χ. διαφορά στο ποσό).');
    sh.getRange(1, m['Προς πληρωμή'] + 1).setNote('Airbnb εταιρείας: προμήθεια Somnio + ΦΠΑ των δύο γραμμών (χωρίς την καθαρή προμήθεια Airbnb).');
    return { count: INV_COLS.length, detail: 'tab Τιμολόγηση' };
  });
  updateInvoicing(true);
  SpreadsheetApp.getUi().alert('Στήσιμο ΟΚ. Δες τα tabs «' + INV.MAIN + '» και «' + INV.CHECK + '».');
}

function invTriggerOn() {
  invTriggerOff_();
  ScriptApp.newTrigger('updateInvoicingAuto').timeBased().everyDays(1).atHour(8).nearMinute(55)
    .inTimezone(String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens')).create();
  SomnioCore.logRun('Owner Invoicing · Αυτόματο', 'OK', '', 'ON 08:55');
  SpreadsheetApp.getUi().alert('Αυτόματη ενημέρωση ON (~08:55).');
}
function invTriggerOff_() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'updateInvoicingAuto') ScriptApp.deleteTrigger(t); }); }
function invTriggerOff() { invTriggerOff_(); SpreadsheetApp.getUi().alert('Αυτόματη ενημέρωση OFF.'); }

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Invoicing')
    .addItem('1. Στήσιμο / φρεσκάρισμα', 'setupInvoicing')
    .addItem('2. Ενημέρωση τώρα', 'updateInvoicing')
    .addItem('3. Gmail draft για την επιλεγμένη γραμμή', 'draftSelected')
    .addSeparator()
    .addItem('4. Έκδοση παραστατικού (Oxygen) — επιλεγμένη γραμμή', 'issueSelected')
    .addItem('5. Αποστολή email — επιλεγμένη γραμμή', 'sendSelected')
    .addItem('6. Φέρε ΜΑΡΚ από Oxygen', 'refreshMarks')
    .addSeparator()
    .addItem('Oxygen: δοκιμή σύνδεσης', 'oxygenTest')
    .addSeparator()
    .addItem('Αυτόματη ενημέρωση ON (~08:55)', 'invTriggerOn')
    .addItem('Αυτόματη ενημέρωση OFF', 'invTriggerOff')
    .addToUi();
}

/** ΑΦΜ ως κείμενο 9 ψηφίων: το Sheets κόβει το 0 μπροστά (046922988 → 46922988), το ξαναβάζουμε. */
function invAfm_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  return /^\d{7,8}$/.test(s) ? ('000000000' + s).slice(-9) : s;
}
