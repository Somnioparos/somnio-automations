/**
 * Somnio Financials 2027 — script του αρχείου «Somnio Financials 2027».
 *
 * PULL-only: διαβάζει Master File 2027 (κρατήσεις), Master Properties 2027 (ακίνητα) και
 * Candy Recipes 2027 (έξοδα, concierge, εισπράξεις, κινήσεις, προβλέψεις, λογαριασμοί).
 * Δεν γράφει ποτέ σε άλλο αρχείο. Απαιτεί βιβλιοθήκη SomnioCore. Κανένα κλειδί API.
 *
 * Βασισμένο στο Financials 2026 v3.4 (ίδιοι κανόνες, επιβεβαιωμένοι από τον Τάσο):
 *   - Έσοδα P&L = Company_Revenue (προμήθεια προ ΦΠΑ / καθαρό δικών μας). Στο Airbnb εταιρείας η
 *     επανατιμολόγηση της προμήθειας Airbnb αντιλογίζεται → δεν είναι έσοδο.
 *   - Έξοδα P&L = Candy «Έξοδα» με Χρεώνεται σε = Somnio ΚΑΙ Φύση = Opex, σε ΚΑΘΑΡΟ (όχι μικτό).
 *     Πάγια / Εγγυήσεις / Φόροι → block ΕΚΤΟΣ P&L (και στο Cash flow).
 *   - DECLARED = έσοδα χωρίς Direct Cash · έξοδα και concierge μόνο Declared.
 *   - Γενικά έξοδα δεν επιμερίζονται: φαίνονται ως κέντρα κόστους (Γενικά, Τάσος, Αλέξ…).
 *   - Occupancy: σεζόν Απρ–Οκτ, ανά ημέρα, ADR/RevPAR σε Total value, νύχτες χωρίς έσοδο εκτός ADR.
 *   - Στόχος Εταιρείας = στόχος ΠΡΟΜΗΘΕΙΑΣ (Company_Revenue). Στόχοι ανά ακίνητο = Gross_Revenue.
 *
 * Νέα 2027:
 *   - «Cash flow»: ανά μήνα & λογαριασμό, πραγματικά + πρόβλεψη.
 *   - «Forecast vs Πραγματικό»: σύγκριση ανά μήνα με το αρχείο Forecast (Config FILE_FORECAST,
 *     tab «Μηνιαίο 2027»: στήλη A = γραμμή P&L, μετά Ιαν..Δεκ).
 *
 * Μενού «Somnio Financials»: 1. Pull τώρα · 2. Auto-pull ON/OFF (~08:45, μετά Master 07:45 και Candy 08:15).
 */

var FIN = {
  DATA: 'Κρατήσεις', EXP: 'Έξοδα', CONC: 'Concierge',
  CO: 'Στόχος Εταιρείας', PNL: 'P&L', CASH: 'Cash flow', FCST: 'Forecast vs Πραγματικό',
  OVER: 'Overview', STOX: 'Στόχοι', FEES: 'Platform_Fees', OCC: 'Occupancy', AVAIL: 'Διαθεσιμότητα', LOG: 'Log'
};
var FIN_ORDER = [FIN.CO, FIN.PNL, FIN.CASH, FIN.FCST, FIN.OVER, FIN.STOX, FIN.FEES, FIN.OCC, FIN.AVAIL,
  FIN.DATA, FIN.EXP, FIN.CONC, FIN.LOG];
var FIN_COMPANY = 'Somnio';                 // «Χρεώνεται σε» = Somnio → κόστος εταιρείας
var FIN_DC = 'Direct Cash';
var FIN_MONTHS = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
var FIN_AUTO_HOUR = 8, FIN_AUTO_MIN = 45;
var FIN_MAX_LINES = 60, FIN_MAX_BUCKETS = 200, FIN_PLATFORM_ROWS = 12;
var FIN_OCC_M0 = 4, FIN_OCC_M1 = 10;        // σεζόν Απρ–Οκτ
var FIN_GREEN = '#1F7A4D', FIN_HEAD = '#D9EAD3';

// Βάσεις δεδομένων (γράφονται ολόκληρες σε κάθε pull — ποτέ χειροκίνητα)
var FIN_DATA_COLS = ['Month', 'Check_in', 'Check_out', 'Nights', 'Residence', 'Platform', 'Agency', 'Source',
  'Guest', 'Owner_Type', 'Total_value', 'Total_payout', 'Bank_Charges', 'Channel_Fee', 'Net_Price', 'VAT',
  'City_Tax', 'Env_Fee', 'Gross_Value', 'Comm_Base', 'Comm_Net', 'Comm_VAT', 'Comm_Total',
  'Airbnb_Fee_Recharge', 'Owner_Payable', 'Gross_Revenue', 'Company_Revenue', 'Status', 'event_id'];
var FIN_EXP_COLS = ['Month', 'Ημ/νία', 'Κατηγορία', 'Υποκατηγορία', 'Φύση', 'Προμηθευτής', 'Περιγραφή',
  'Κέντρο κόστους', 'Χρεώνεται σε', 'Λογαριασμός', 'Πλήρωσε', 'Declared', 'Καθαρό', 'ΦΠΑ', 'Σύνολο',
  'Ημ/νία πληρωμής', 'ID'];
var FIN_CONC_COLS = ['Month', 'Ημ/νία', 'Ακίνητο', 'Υπηρεσία', 'Προμηθευτής', 'Ποσό', 'Προμήθεια',
  'Declared', 'Εισπράχθηκε', 'Λογαριασμός', 'ID'];

// -- ΒΟΗΘΗΤΙΚΑ --------------------------------------------------------------------

var FIN_Y_ = null;
function finYear_() { if (!FIN_Y_) FIN_Y_ = Number(SomnioCore.cfg('YEAR')); return FIN_Y_; }
function finTz_() { return String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens'); }
function finLog_(action, count, detail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var lg = ss.getSheetByName(FIN.LOG) || ss.insertSheet(FIN.LOG);
    if (lg.getLastRow() === 0) lg.appendRow(['timestamp', 'action', 'count', 'detail']);
    lg.appendRow([new Date(), action, count, String(detail || '').slice(0, 500)]);
  } catch (e) {}
}
function finDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v) ? null : v;
  var s = String(v || ''), m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var g = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (g) return new Date(Number(g[3]), Number(g[2]) - 1, Number(g[1]));
  return null;
}
function finNum_(v) {
  if (typeof v === 'number') return v;
  var s = String(v === null || v === undefined ? '' : v).replace(/[€\s]/g, '');
  if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
  var n = Number(s); return isNaN(n) ? 0 : n;
}
function finR2_(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function finKey_(s) { return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
function finBool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function finColL_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function finQ_(tab) { return "'" + tab + "'!"; }
function finBlank_(n) { var a = []; for (var i = 0; i < n; i++) a.push(''); return a; }
function finAdd_(L, rows) { return rows.map(function (r) { return L + r; }).join('+'); }
function finDaysInMonth_(y, m) { return new Date(y, m, 0).getDate(); }

/** Διαβάζει ένα tab ως πίνακα αντικειμένων {header: τιμή}. */
function finTable_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var m = SomnioCore.headerMap(sh), v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return v.map(function (r) { var o = {}; for (var k in m) o[k] = r[m[k]]; return o; });
}

/**
 * Φραγμένα εύρη (όχι ολόκληρη στήλη — βλ. v3.3) ανά ΟΝΟΜΑ στήλης μιας βάσης:
 * R['Company_Revenue'] → 'Κρατήσεις'!$AA$2:$AA$1300
 */
function finRng_(ss, tab, cols) {
  var sh = ss.getSheetByName(tab), last = sh ? sh.getLastRow() : 0;
  var n = Math.max(last + 300, 1000), o = {};
  cols.forEach(function (c, i) { var L = finColL_(i + 1); o[c] = finQ_(tab) + '$' + L + '$2:$' + L + '$' + n; });
  return o;
}

function finTitle_(sh, row, text, cols) {
  sh.getRange(row, 1, 1, cols).setFontWeight('bold').setBackground(FIN_GREEN).setFontColor('#FFFFFF');
  if (text !== null && text !== undefined) sh.getRange(row, 1).setValue(text);
}
function finNote_(sh, row, text) {
  sh.getRange(row, 1).setValue(text).setFontStyle('italic').setFontSize(9).setFontColor('#777777');
}
function finFresh_(ss, name) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear(); sh.setConditionalFormatRules([]);
  try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart(); } catch (e) {}
  for (var g = 0; g < 4; g++) { try { sh.getRange(1, 1, sh.getMaxRows(), 1).shiftRowGroupDepth(-1); } catch (eg) { break; } }
  return sh;
}

// -- ΠΗΓΕΣ ------------------------------------------------------------------------

/** Ακίνητα από Master Properties (όχι όσα είναι Active_2027 = FALSE): [{name, ownerType}] */
function finProps_() {
  var ss = SomnioCore.openFile('FILE_MASTER_PROPERTIES');
  var sh = ss.getSheetByName('Properties') || ss.getSheets()[0];
  var out = [];
  finTable_(ss, sh.getName()).forEach(function (r) {
    var n = String(r['Residence'] || '').trim();
    if (!n || String(r['Active_2027']).toUpperCase() === 'FALSE') return;
    out.push({ name: n, ownerType: String(r['Owner_Type'] || '').trim() });
  });
  out.sort(function (a, b) { return a.name.localeCompare(b.name, 'el'); });
  return out;
}

function finStatus_(cancelled, ci, co) {
  if (cancelled) return 'Ακυρωμένη (payout)';
  var t = new Date(); t.setHours(0, 0, 0, 0);
  var a = finDate_(ci), b = finDate_(co);
  if (b && b <= t) return 'Ολοκληρωμένη';
  if (a && a <= t) return 'Τρέχουσα';
  return 'Μελλοντική';
}

/** Κρατήσεις από το Master File 2027 → γραμμές της βάσης «Κρατήσεις». */
function finPullBookings_(ss) {
  var mf = SomnioCore.openFile('FILE_MASTER_FILE');
  var rows = finTable_(mf, 'Bookings'), out = [];
  rows.forEach(function (b) {
    var id = String(b['event_id'] || ''); if (!id) return;
    var cancelled = b['Status'] === 'Ακυρωμένη';
    var payout = finNum_(b['Total payout']);
    if (cancelled && payout <= 0) return;                          // ακυρωμένη χωρίς είσπραξη → εκτός
    var ot = String(b['Owner_Type'] || '').trim();
    var bank = finNum_(b['Payment charges']), chan = Math.abs(finNum_(b['Service fee host']));
    // GROSS_REVENUE (βάση στόχων ανά ακίνητο): Εταιρεία/Δικό μας Net, Φυσικό Gross − πλατφόρμα − τραπεζικά
    var basis = ot === 'Φυσικό' ? finNum_(b['Gross_Value']) : finNum_(b['Net_Price']);
    if (!basis) basis = finNum_(b['Net_Price']) || finNum_(b['Gross_Value']) || payout;
    var o = {
      'Month': Number(b['Month']) || '', 'Check_in': finDate_(b['Check_in']) || '', 'Check_out': finDate_(b['Check_out']) || '',
      'Nights': b['Nights'], 'Residence': String(b['Residence'] || '').trim(), 'Platform': String(b['Platform'] || '').trim(),
      'Agency': b['Agency'] || '', 'Source': String(b['Source'] || '').trim(), 'Guest': b['Guest name'], 'Owner_Type': ot,
      'Total_value': b['Total value'], 'Total_payout': b['Total payout'], 'Bank_Charges': b['Payment charges'],
      'Channel_Fee': chan, 'Net_Price': b['Net_Price'], 'VAT': b['VAT'], 'City_Tax': b['City_Tax'], 'Env_Fee': b['Env_Fee'],
      'Gross_Value': b['Gross_Value'], 'Comm_Base': b['Comm_Base'], 'Comm_Net': b['Comm_Net'], 'Comm_VAT': b['Comm_VAT'],
      'Comm_Total': b['Comm_Total'], 'Airbnb_Fee_Recharge': b['Airbnb_Fee_Recharge'], 'Owner_Payable': b['Owner_Payable'],
      'Gross_Revenue': finR2_(basis - chan - bank), 'Company_Revenue': b['Company_Revenue'],
      'Status': finStatus_(cancelled, b['Check_in'], b['Check_out']), 'event_id': id
    };
    out.push(FIN_DATA_COLS.map(function (c) { return o[c] === undefined || o[c] === null ? '' : o[c]; }));
  });
  out.sort(function (a, b) { var x = a[1] ? a[1].getTime() : 0, y = b[1] ? b[1].getTime() : 0; return x - y; });
  finWriteBase_(ss, FIN.DATA, FIN_DATA_COLS, out, ['Check_in', 'Check_out'],
    ['Total_value', 'Total_payout', 'Bank_Charges', 'Channel_Fee', 'Net_Price', 'VAT', 'City_Tax', 'Env_Fee', 'Gross_Value',
     'Comm_Base', 'Comm_Net', 'Comm_VAT', 'Comm_Total', 'Airbnb_Fee_Recharge', 'Owner_Payable', 'Gross_Revenue', 'Company_Revenue']);
  var sh = ss.getSheetByName(FIN.DATA), st = finColL_(FIN_DATA_COLS.indexOf('Status') + 1);
  var rng = sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), FIN_DATA_COLS.length);
  var rule = function (val, bg) { return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + st + '2="' + val + '"').setBackground(bg).setRanges([rng]).build(); };
  sh.setConditionalFormatRules([rule('Ακυρωμένη (payout)', '#F4CCCC'), rule('Μελλοντική', '#EFEFEF'), rule('Τρέχουσα', '#D9EAD3')]);
  return out;
}

/** Candy «Έξοδα» του έτους → βάση «Έξοδα». */
function finPullExpenses_(ss, candy) {
  var Y = finYear_(), out = [], skipped = 0;
  finTable_(candy, 'Έξοδα').forEach(function (r) {
    if (!r['ID'] && !r['Σύνολο'] && !r['Καθαρό']) return;
    var d = finDate_(r['Ημ/νία']);
    if (!d || d.getFullYear() !== Y) { skipped++; return; }
    var o = {
      'Month': d.getMonth() + 1, 'Ημ/νία': d, 'Κατηγορία': String(r['Κατηγορία'] || '').trim(),
      'Υποκατηγορία': r['Υποκατηγορία'], 'Φύση': String(r['Φύση'] || '').trim() || 'Opex',
      'Προμηθευτής': String(r['Προμηθευτής'] || '').trim(), 'Περιγραφή': r['Περιγραφή'],
      'Κέντρο κόστους': String(r['Κέντρο κόστους'] || '').trim() || '(κενό)',
      'Χρεώνεται σε': String(r['Χρεώνεται σε'] || '').trim() || FIN_COMPANY,
      'Λογαριασμός': r['Λογαριασμός'], 'Πλήρωσε': r['Πλήρωσε'], 'Declared': finBool_(r['Declared']) ? 'TRUE' : 'FALSE',
      'Καθαρό': finNum_(r['Καθαρό'] !== '' ? r['Καθαρό'] : r['Σύνολο']), 'ΦΠΑ': finNum_(r['ΦΠΑ']), 'Σύνολο': finNum_(r['Σύνολο']),
      'Ημ/νία πληρωμής': finDate_(r['Ημ/νία πληρωμής']) || d, 'ID': r['ID']
    };
    out.push(FIN_EXP_COLS.map(function (c) { return o[c] === undefined || o[c] === null ? '' : o[c]; }));
  });
  finWriteBase_(ss, FIN.EXP, FIN_EXP_COLS, out, ['Ημ/νία', 'Ημ/νία πληρωμής'], ['Καθαρό', 'ΦΠΑ', 'Σύνολο'], '#B45F06');
  finLog_('PULL_EXPENSES', out.length, 'άλλα έτη/χωρίς ημ/νία: ' + skipped);
  return out;
}

/** Candy «Concierge» → βάση «Concierge» (γραμμή χωρίς ημερομηνία κρατιέται με κενό Month). */
function finPullConcierge_(ss, candy) {
  var Y = finYear_(), out = [];
  finTable_(candy, 'Concierge').forEach(function (r) {
    if (!r['ID'] && !r['Ποσό']) return;
    var d = finDate_(r['Ημ/νία']);
    if (d && d.getFullYear() !== Y) return;
    var o = {
      'Month': d ? d.getMonth() + 1 : '', 'Ημ/νία': d || '', 'Ακίνητο': r['Ακίνητο'], 'Υπηρεσία': r['Υπηρεσία'],
      'Προμηθευτής': r['Προμηθευτής'], 'Ποσό': finNum_(r['Ποσό']), 'Προμήθεια': finNum_(r['Προμήθεια']),
      'Declared': finBool_(r['Declared']) ? 'TRUE' : 'FALSE', 'Εισπράχθηκε': finBool_(r['Εισπράχθηκε']) ? 'TRUE' : 'FALSE',
      'Λογαριασμός': r['Λογαριασμός'], 'ID': r['ID']
    };
    out.push(FIN_CONC_COLS.map(function (c) { return o[c] === undefined || o[c] === null ? '' : o[c]; }));
  });
  finWriteBase_(ss, FIN.CONC, FIN_CONC_COLS, out, ['Ημ/νία'], ['Ποσό', 'Προμήθεια'], '#B45F06');
  return out;
}

function finWriteBase_(ss, tab, cols, rows, dateCols, moneyCols, color) {
  var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
  sh.clear();
  sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground(color || FIN_GREEN).setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  if (!rows.length) return sh;
  sh.getRange(2, 1, rows.length, cols.length).setValues(rows);
  (dateCols || []).forEach(function (c) { sh.getRange(2, cols.indexOf(c) + 1, rows.length, 1).setNumberFormat('dd/MM/yyyy'); });
  (moneyCols || []).forEach(function (c) { sh.getRange(2, cols.indexOf(c) + 1, rows.length, 1).setNumberFormat('#,##0.00'); });
  return sh;
}

// -- PULL -------------------------------------------------------------------------

function pullFinancials(silent) {
  var res = null;
  var ok = SomnioCore.runJob('Financials · Pull', function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.setSpreadsheetTimeZone(finTz_());
    var candy = SomnioCore.openFile('FILE_CANDY');
    var props = finProps_();
    var data = finPullBookings_(ss);
    var exps = finPullExpenses_(ss, candy);
    finPullConcierge_(ss, candy);
    var cats = finCategories_(candy);
    var errs = [];
    var step = function (name, fn) { try { fn(); } catch (e) { errs.push(name + ': ' + e.message); finLog_(name + '_ERROR', 0, e.message); } };
    step('PNL', function () { finBuildPnL_(ss, props, cats); });
    step('CO', function () { finBuildCompanyGoal_(ss); });
    step('STOX', function () { finBuildStoxoi_(ss, props); });
    step('OVER', function () { finBuildOverview_(ss, props); });
    step('FEES', function () { finBuildFees_(ss, props); });
    step('OCC', function () { finBuildOcc_(ss, props, data); });
    step('AVAIL', function () { finBuildAvail_(ss, data); });
    step('CASH', function () { finBuildCash_(ss, candy); });
    step('FCST', function () { finBuildForecast_(ss, cats); });
    finOrderTabs_(ss);
    if (errs.length) throw new Error(errs.join(' · '));
    res = { count: data.length, detail: 'κρατήσεις ' + data.length + ' · έξοδα ' + exps.length };
    return res;
  });
  if (!silent) SpreadsheetApp.getUi().alert(ok ? 'Pull OK — ' + res.detail : 'Το pull είχε σφάλμα. Δες το Log του αρχείου και το Health στο Config.');
}
function pullFinancialsAuto() { pullFinancials(true); }

function finOrderTabs_(ss) {
  var cur = ss.getSheets(), pos = {}, want = [], i;
  for (i = 0; i < cur.length; i++) pos[cur[i].getName()] = i + 1;
  FIN_ORDER.forEach(function (n) { if (pos[n]) want.push(n); });
  for (i = 0; i < want.length; i++) if (pos[want[i]] !== i + 1) break;
  if (i === want.length) return;
  want.forEach(function (n, k) { ss.setActiveSheet(ss.getSheetByName(n)); ss.moveActiveSheet(k + 1); });
  var s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Φύλλο1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
}

/** Κατηγορίες Opex με τη σειρά του tab «Κατηγορίες» του Candy. */
function finCategories_(candy) {
  var opex = [], seen = {};
  finTable_(candy, 'Κατηγορίες').forEach(function (r) {
    var c = String(r['Κατηγορία'] || '').trim(), f = String(r['Φύση'] || '').trim();
    if (!c || seen[c]) return; seen[c] = 1;
    if (f === 'Opex') opex.push(c);
  });
  return opex;
}

// -- P&L -----------------------------------------------------------------------------

var FIN_PNL_NC = 15;   // A + 12 μήνες + ΣΥΝΟΛΟ + % εσόδων

function finR_(ss) {
  return { D: finRng_(ss, FIN.DATA, FIN_DATA_COLS), E: finRng_(ss, FIN.EXP, FIN_EXP_COLS), C: finRng_(ss, FIN.CONC, FIN_CONC_COLS) };
}

/** Ανάλυση εξόδων ανά (κατηγορία, προμηθευτή): σύνολο & δηλωμένο, ανά μήνα. */
function finExpLines_(ss) {
  var out = {}, map = {};
  finTable_(ss, FIN.EXP).forEach(function (r) {
    if (r['Χρεώνεται σε'] !== FIN_COMPANY || r['Φύση'] !== 'Opex') return;
    var typ = r['Κατηγορία'] || '(χωρίς κατηγορία)', name = r['Προμηθευτής'] || r['Περιγραφή'] || '(χωρίς προμηθευτή)';
    var k = typ + '\u0001' + name, rec = map[k];
    if (!rec) {
      rec = map[k] = { typ: typ, exp: name, tot: 0, dtot: 0, m: finBlank_(12).map(Number), dm: finBlank_(12).map(Number) };
      (out[typ] = out[typ] || []).push(rec);
    }
    var mn = Number(r['Month']) || 0, amt = finNum_(r['Καθαρό']), dec = r['Declared'] === 'TRUE' || r['Declared'] === true;
    rec.tot += amt; if (mn) rec.m[mn - 1] += amt;
    if (dec) { rec.dtot += amt; if (mn) rec.dm[mn - 1] += amt; }
  });
  for (var t in out) out[t].sort(function (a, b) { return b.tot - a.tot; });
  return out;
}

function finPnLBlock_(sh, top, taxed, title, lines, R, types) {
  var NC = FIN_PNL_NC, M = [], a, m, i, k, L, D = R.D, E = R.E, C = R.C;
  var dE = taxed ? ',' + E['Declared'] + ',"TRUE"' : '';
  var dC = taxed ? ',' + C['Declared'] + ',"TRUE"' : '';
  var dR = taxed ? ',' + D['Source'] + ',"<>' + FIN_DC + '"' : '';
  var EXP = E['Καθαρό'] + ',' + E['Χρεώνεται σε'] + ',"' + FIN_COMPANY + '",' + E['Φύση'] + ',"Opex"';
  var rowNo = function () { return top + M.length; };
  var pct = function (r, rev) { return '=IF($N$' + rev + '=0,"",$N' + r + '/$N$' + rev + ')'; };

  a = finBlank_(NC); a[0] = title; M.push(a);
  a = finBlank_(NC); a[0] = 'Γραμμή'; for (i = 0; i < 12; i++) a[1 + i] = FIN_MONTHS[i]; a[13] = 'ΣΥΝΟΛΟ'; a[14] = '% εσόδων';
  var rHdr = rowNo(); M.push(a);
  a = finBlank_(NC); a[0] = 'ΕΣΟΔΑ'; var rSecR = rowNo(); M.push(a);

  var rRev = rowNo(); a = finBlank_(NC); a[0] = 'Έσοδα κρατήσεων';
  for (m = 1; m <= 12; m++) a[m] = '=SUMIFS(' + D['Company_Revenue'] + ',' + D['Month'] + ',' + m + dR + ')';
  a[13] = '=SUM(B' + rRev + ':M' + rRev + ')'; M.push(a);

  var rCon = rowNo(); a = finBlank_(NC); a[0] = 'Concierge';
  for (m = 1; m <= 12; m++) a[m] = '=SUMIFS(' + C['Προμήθεια'] + ',' + C['Month'] + ',' + m + dC + ')';
  a[13] = '=SUM(B' + rCon + ':M' + rCon + ')'; M.push(a);

  // v3.4: concierge χωρίς ημερομηνία — ποσό μόνο στο ΣΥΝΟΛΟ, ώστε να μην κρύβεται ποτέ τίποτα
  var rConN = rowNo(); a = finBlank_(NC); a[0] = 'Concierge (χωρίς ημερομηνία)';
  a[13] = '=SUMIFS(' + C['Προμήθεια'] + ',' + C['Month'] + ',""' + dC + ')'; M.push(a);

  var rTotR = rowNo(); a = finBlank_(NC); a[0] = 'ΣΥΝΟΛΟ ΕΣΟΔΩΝ';
  for (m = 1; m <= 12; m++) { L = finColL_(m + 1); a[m] = '=' + L + rRev + '+' + L + rCon; }
  a[13] = '=N' + rRev + '+N' + rCon + '+N' + rConN; M.push(a);
  [rRev, rCon, rConN, rTotR].forEach(function (r) { M[r - top][14] = pct(r, rTotR); });

  a = finBlank_(NC); a[0] = 'ΕΞΟΔΑ'; var rSecE = rowNo(); M.push(a);
  var typeRows = [], groups = [];
  types.forEach(function (typ) {
    var rT = rowNo(); typeRows.push(rT);
    a = finBlank_(NC); a[0] = typ;
    for (m = 1; m <= 12; m++) a[m] = '=SUMIFS(' + EXP + ',' + E['Κατηγορία'] + ',$A' + rT + ',' + E['Month'] + ',' + m + dE + ')';
    a[13] = '=SUM(B' + rT + ':M' + rT + ')'; a[14] = pct(rT, rTotR); M.push(a);
    var det = lines[typ] || [], g0 = rowNo(), gn = 0;
    for (k = 0; k < det.length && gn < FIN_MAX_LINES; k++) {
      var rec = det[k], tot = taxed ? rec.dtot : rec.tot;
      if (Math.abs(tot) < 0.005) continue;
      var rD = rowNo(); a = finBlank_(NC); a[0] = '      • ' + rec.exp;
      for (m = 1; m <= 12; m++) { var vv = taxed ? rec.dm[m - 1] : rec.m[m - 1]; a[m] = vv ? finR2_(vv) : ''; }
      a[13] = finR2_(tot); a[14] = pct(rD, rTotR); M.push(a); gn++;
    }
    if (gn) groups.push([g0, gn]);
  });
  var rOth = rowNo(); a = finBlank_(NC); a[0] = 'Λοιπά (χωρίς κατηγορία)';
  for (m = 1; m <= 12; m++) { L = finColL_(m + 1); a[m] = '=SUMIFS(' + EXP + ',' + E['Month'] + ',' + m + dE + ')-(' + (typeRows.length ? finAdd_(L, typeRows) : '0') + ')'; }
  a[13] = '=SUM(B' + rOth + ':M' + rOth + ')'; a[14] = pct(rOth, rTotR); M.push(a);

  var rTotE = rowNo(); a = finBlank_(NC); a[0] = 'ΣΥΝΟΛΟ ΕΞΟΔΩΝ';
  for (m = 1; m <= 13; m++) { L = finColL_(m + 1); a[m] = '=' + (typeRows.length ? finAdd_(L, typeRows) + '+' : '') + L + rOth; }
  a[14] = pct(rTotE, rTotR); M.push(a);
  var rPro = rowNo(); a = finBlank_(NC); a[0] = 'ΚΕΡΔΟΣ';
  for (m = 1; m <= 13; m++) { L = finColL_(m + 1); a[m] = '=' + L + rTotR + '-' + L + rTotE; }
  a[14] = pct(rPro, rTotR); M.push(a);
  var rMar = rowNo(); a = finBlank_(NC); a[0] = 'ΠΕΡΙΘΩΡΙΟ %';
  for (m = 1; m <= 13; m++) { L = finColL_(m + 1); a[m] = '=IF(' + L + rTotR + '=0,"",' + L + rPro + '/' + L + rTotR + ')'; }
  M.push(a);

  sh.getRange(top, 1, M.length, NC).setValues(M);
  finTitle_(sh, top, null, NC);
  sh.getRange(rHdr, 1, 1, NC).setFontWeight('bold').setBackground(FIN_HEAD);
  [rSecR, rSecE].forEach(function (r) { sh.getRange(r, 1, 1, NC).setFontWeight('bold').setBackground('#EFEFEF'); });
  sh.getRange(top + 2, 2, M.length - 2, 13).setNumberFormat('#,##0.00');
  sh.getRange(top, NC, M.length, 1).setNumberFormat('0.0%');
  sh.getRange(rMar, 2, 1, 13).setNumberFormat('0.0%');
  [rTotR, rTotE, rPro, rMar, rOth].concat(typeRows).forEach(function (r) { sh.getRange(r, 1, 1, NC).setFontWeight('bold'); });
  sh.getRange(rTotR, 1, 1, NC).setBackground('#E2F0D9');
  sh.getRange(rTotE, 1, 1, NC).setBackground('#FCE4D6');
  sh.getRange(rPro, 1, 1, NC).setBackground('#FFF2CC');
  sh.getRange(rConN, 1, 1, NC).setFontColor('#999999');
  groups.forEach(function (g) { try { sh.getRange(g[0], 1, g[1], 1).shiftRowGroupDepth(1); sh.getRowGroup(g[0], 1).collapse(); } catch (e) {} });
  return { next: top + M.length };
}

function finOutBlock_(sh, top, R) {
  var E = R.E;
  var f = function (amtCol, nature, taxed) {
    return '=SUMIFS(' + E[amtCol] + ',' + E['Χρεώνεται σε'] + ',"' + FIN_COMPANY + '"' +
      (nature ? ',' + E['Φύση'] + ',"' + nature + '"' : '') + (taxed ? ',' + E['Declared'] + ',"TRUE"' : '') + ')';
  };
  var M = [
    ['ΕΚΤΟΣ P&L — δεν βαρύνουν το αποτέλεσμα (φαίνονται στο Cash flow)', '', ''],
    ['Κατηγορία', 'OVERALL', 'DECLARED'],
    ['Πάγιο (κατασκευή / εξοπλισμός)', f('Καθαρό', 'Πάγιο', false), f('Καθαρό', 'Πάγιο', true)],
    ['Εγγύηση (επιστρεπτέο)', f('Καθαρό', 'Εγγύηση', false), f('Καθαρό', 'Εγγύηση', true)],
    ['Φόροι & τέλη', f('Καθαρό', 'Φόροι', false), f('Καθαρό', 'Φόροι', true)],
    ['ΦΠΑ εξόδων — εκπίπτει (πληροφοριακό)', f('ΦΠΑ', '', false), f('ΦΠΑ', '', true)]
  ];
  sh.getRange(top, 1, M.length, 3).setValues(M);
  finTitle_(sh, top, null, 3);
  sh.getRange(top + 1, 1, 1, 3).setFontWeight('bold').setBackground(FIN_HEAD);
  sh.getRange(top + 2, 2, M.length - 2, 2).setNumberFormat('#,##0.00');
  sh.getRange(top + M.length - 1, 1, 1, 3).setFontColor('#777777');
  return top + M.length;
}

/** Κέντρα κόστους που δεν είναι ακίνητα του χαρτοφυλακίου (Γενικά, Τάσος, Αλέξ …), φθίνουσα. */
function finBuckets_(ss, props) {
  var known = {}; props.forEach(function (p) { known[finKey_(p.name)] = 1; });
  var agg = {}, order = [];
  finTable_(ss, FIN.EXP).forEach(function (r) {
    if (r['Χρεώνεται σε'] !== FIN_COMPANY || r['Φύση'] !== 'Opex') return;
    var p = String(r['Κέντρο κόστους'] || '(κενό)');
    if (known[finKey_(p)]) return;
    if (!(p in agg)) { agg[p] = 0; order.push(p); }
    agg[p] += finNum_(r['Καθαρό']);
  });
  order.sort(function (a, b) { return agg[b] - agg[a]; });
  return order.slice(0, FIN_MAX_BUCKETS);
}

function finPropTable_(sh, top, taxed, title, props, buckets, R, types) {
  var T = types.length, NC = 6 + T, i, c, L, a, D = R.D, E = R.E, C = R.C;
  var dE = taxed ? ',' + E['Declared'] + ',"TRUE"' : '';
  var dC = taxed ? ',' + C['Declared'] + ',"TRUE"' : '';
  var dR = taxed ? ',' + D['Source'] + ',"<>' + FIN_DC + '"' : '';
  var EXP = E['Καθαρό'] + ',' + E['Χρεώνεται σε'] + ',"' + FIN_COMPANY + '",' + E['Φύση'] + ',"Opex"';
  var C_INC = 2, C_T0 = 3, C_TN = 2 + T, C_OTH = 3 + T, C_EXP = 4 + T, C_PRO = 5 + T, C_MAR = 6 + T;
  var LT0 = finColL_(C_T0), LTN = finColL_(C_TN), LOTH = finColL_(C_OTH), LINC = finColL_(C_INC), LEXP = finColL_(C_EXP), LPRO = finColL_(C_PRO);
  var names = props.map(function (p) { return p.name; }).concat(buckets);
  var rHdr = top + 1, r0 = top + 2, rConc = r0 + names.length, rAtx = rConc + 1, rTot = rAtx + 1;
  var tail = function (row, r) {
    row[C_EXP - 1] = '=SUM(' + LT0 + r + ':' + LOTH + r + ')';
    row[C_PRO - 1] = '=' + LINC + r + '-' + LEXP + r;
    row[C_MAR - 1] = '=IF(' + LINC + r + '=0,"",' + LPRO + r + '/' + LINC + r + ')';
  };
  var M = [];
  a = finBlank_(NC); a[0] = title; M.push(a);
  M.push(['Ακίνητο / Κέντρο κόστους', 'Έσοδα'].concat(types).concat(['Λοιπά', 'ΣΥΝΟΛΟ ΕΞΟΔΩΝ', 'ΚΕΡΔΟΣ', 'ΠΕΡΙΘΩΡΙΟ %']));
  names.forEach(function (nm, idx) {
    var r = r0 + idx; a = finBlank_(NC); a[0] = nm;
    a[C_INC - 1] = '=SUMIFS(' + D['Company_Revenue'] + ',' + D['Residence'] + ',$A' + r + dR + ')';
    for (c = C_T0; c <= C_TN; c++) { L = finColL_(c); a[c - 1] = '=SUMIFS(' + EXP + ',' + E['Κέντρο κόστους'] + ',$A' + r + ',' + E['Κατηγορία'] + ',' + L + '$' + rHdr + dE + ')'; }
    a[C_OTH - 1] = '=SUMIFS(' + EXP + ',' + E['Κέντρο κόστους'] + ',$A' + r + dE + ')' + (T ? '-SUM(' + LT0 + r + ':' + LTN + r + ')' : '');
    tail(a, r); M.push(a);
  });
  a = finBlank_(NC); a[0] = 'Concierge (έσοδο χωρίς ακίνητο)';
  a[C_INC - 1] = '=IFERROR(SUMIFS(' + C['Προμήθεια'] + ',' + C['Ποσό'] + ',"<>"' + dC + '),0)'; tail(a, rConc); M.push(a);
  a = finBlank_(NC); a[0] = 'ΑΤΑΞΙΝΟΜΗΤΑ (υπόλοιπο)';
  for (c = C_INC; c <= C_OTH; c++) { L = finColL_(c); a[c - 1] = '=' + L + rTot + '-SUM(' + L + r0 + ':' + L + (rAtx - 1) + ')'; }
  tail(a, rAtx); M.push(a);
  a = finBlank_(NC); a[0] = 'ΣΥΝΟΛΟ';
  a[C_INC - 1] = '=' + (taxed ? 'SUMIFS(' + D['Company_Revenue'] + dR + ')' : 'SUM(' + D['Company_Revenue'] + ')') +
    '+IFERROR(SUMIFS(' + C['Προμήθεια'] + ',' + C['Ποσό'] + ',"<>"' + dC + '),0)';
  for (c = C_T0; c <= C_TN; c++) { L = finColL_(c); a[c - 1] = '=SUMIFS(' + EXP + ',' + E['Κατηγορία'] + ',' + L + '$' + rHdr + dE + ')'; }
  a[C_OTH - 1] = '=SUMIFS(' + EXP + dE + ')' + (T ? '-SUM(' + LT0 + rTot + ':' + LTN + rTot + ')' : '');
  tail(a, rTot); M.push(a);
  sh.getRange(top, 1, M.length, NC).setValues(M);
  finTitle_(sh, top, null, NC);
  sh.getRange(rHdr, 1, 1, NC).setFontWeight('bold').setBackground(FIN_HEAD).setWrap(true);
  sh.getRange(r0, 2, names.length + 3, C_PRO - 1).setNumberFormat('#,##0.00');
  sh.getRange(r0, C_MAR, names.length + 3, 1).setNumberFormat('0.0%');
  sh.getRange(rAtx, 1, 1, NC).setFontColor('#999999');
  sh.getRange(rTot, 1, 1, NC).setFontWeight('bold').setBackground('#E2F0D9');
  return top + M.length;
}

function finBuildPnL_(ss, props, types) {
  var sh = finFresh_(ss, FIN.PNL), Y = finYear_(), R = finR_(ss), lines = finExpLines_(ss), buckets = finBuckets_(ss, props);
  var r = 1;
  r = finPnLBlock_(sh, r, false, 'P&L ' + Y + ' — OVERALL (όλα τα έσοδα & έξοδα)', lines, R, types).next + 2;
  r = finPnLBlock_(sh, r, true, 'P&L ' + Y + ' — DECLARED (χωρίς Direct Cash · μόνο δηλωμένα)', lines, R, types).next + 2;
  r = finOutBlock_(sh, r, R) + 2;
  r = finPropTable_(sh, r, false, 'ΑΝΑ ΑΚΙΝΗΤΟ — OVERALL', props, buckets, R, types) + 2;
  r = finPropTable_(sh, r, true, 'ΑΝΑ ΑΚΙΝΗΤΟ — DECLARED', props, buckets, R, types) + 2;
  finNote_(sh, r, 'Έσοδα = Company_Revenue (προμήθεια προ ΦΠΑ · καθαρό των δικών μας). Η επανατιμολόγηση της προμήθειας Airbnb ' +
    'σε εταιρείες αντιλογίζεται και δεν είναι έσοδο. Έξοδα = Candy «Έξοδα» με Χρεώνεται σε «' + FIN_COMPANY + '» και Φύση «Opex», ' +
    'σε ΚΑΘΑΡΟ (ο ΦΠΑ εκπίπτει — βλ. ΕΚΤΟΣ P&L). DECLARED = χωρίς Direct Cash · έξοδα/concierge μόνο Declared. Οι γραμμές «•» = ' +
    'ανάλυση ανά προμηθευτή (τιμές, ξαναγράφονται σε κάθε pull). ΑΝΑ ΑΚΙΝΗΤΟ: τα γενικά έξοδα δεν επιμερίζονται· ' +
    'το ΣΥΝΟΛΟ υπολογίζεται ανεξάρτητα και τα ΑΤΑΞΙΝΟΜΗΤΑ είναι υπόλοιπο.');
  sh.setFrozenColumns(1); sh.setColumnWidth(1, 280); sh.setColumnWidths(2, Math.max(FIN_PNL_NC, 6 + types.length) - 1, 105);
}

// -- ΣΤΟΧΟΣ ΕΤΑΙΡΕΙΑΣ (στόχος ΠΡΟΜΗΘΕΙΑΣ — απόφαση 9/11/2026) ------------------------

function finBuildCompanyGoal_(ss) {
  var sh = ss.getSheetByName(FIN.CO), saved = '';
  if (sh) { var o = sh.getRange(4, 2).getValue(); if (o !== '' && o !== null) saved = o; } else sh = ss.insertSheet(FIN.CO, 0);
  sh.clear(); sh.setConditionalFormatRules([]);
  var R = finR_(ss), D = R.D, E = R.E, C = R.C, Y = finYear_(), M = [];
  for (var i = 0; i < 18; i++) M.push(['', '', '', '']);
  var set = function (row, label, val) { M[row - 1][0] = label; M[row - 1][1] = val; };
  set(1, 'ΣΤΟΧΟΣ ΕΤΑΙΡΕΙΑΣ ' + Y + ' — ΠΡΟΜΗΘΕΙΑ', '');
  set(4, 'Στόχος προμήθειας (γράψε εδώ το νούμερο):', saved);
  set(6, 'Πραγματοποιημένη προμήθεια (χωρίς μελλοντικές):', '=SUMIFS(' + D['Company_Revenue'] + ',' + D['Status'] + ',"<>Μελλοντική")');
  set(7, 'Προβλεπόμενη προμήθεια (με μελλοντικές):', '=SUM(' + D['Company_Revenue'] + ')');
  set(9, '% ΕΠΙΤΕΥΞΗΣ (πραγματοποιημένη):', '=IF(OR($B$4="",$B$4=0),"",B6/$B$4)');
  set(10, '% ΕΠΙΤΕΥΞΗΣ (προβλεπόμενη):', '=IF(OR($B$4="",$B$4=0),"",B7/$B$4)');
  set(12, 'Υπόλοιπο έως τον στόχο (από προβλεπόμενη):', '=IF(OR($B$4="",$B$4=0),"",$B$4-B7)');
  set(14, 'Concierge έσοδα (προμήθεια):', '=IFERROR(SUM(' + C['Προμήθεια'] + '),0)');
  set(15, 'Λειτουργικά έξοδα εταιρείας (καθαρά, Opex):',
    '=IFERROR(SUMIFS(' + E['Καθαρό'] + ',' + E['Χρεώνεται σε'] + ',"' + FIN_COMPANY + '",' + E['Φύση'] + ',"Opex"),0)');
  set(16, 'COMPANY PROFIT (προμήθεια + concierge − έξοδα):', '=B7+B14-B15');
  M[17][0] = 'Ο στόχος μετριέται σε ΠΡΟΜΗΘΕΙΑ (Company_Revenue) — ίδιο μέγεθος με το P&L. Το tab «Στόχοι» ανά ακίνητο μετρά ' +
    'ΑΛΛΟ μέγεθος (Gross_Revenue = καθαρό ιδιοκτήτη), οπότε τα δύο ποσοστά δεν συγκρίνονται. Το κίτρινο B4 διατηρείται.';
  sh.getRange(1, 1, 18, 4).setValues(M);
  sh.getRange(1, 1, 18, 2).setFontFamily('Arial');
  sh.getRange(1, 1, 1, 4).setBackground(FIN_GREEN);
  sh.getRange(1, 1).setFontSize(20).setFontWeight('bold').setFontColor('#FFFFFF');
  sh.getRange(4, 1, 13, 1).setFontWeight('bold').setFontColor('#444444').setFontSize(11);
  sh.getRange(4, 2).setFontSize(24).setFontWeight('bold').setBackground('#FFF2CC');
  sh.getRange(6, 2, 2, 1).setFontSize(20);
  sh.getRange(9, 2, 2, 1).setFontSize(32).setFontWeight('bold');
  sh.getRange(12, 2).setFontSize(18).setFontWeight('bold');
  sh.getRange(16, 2).setFontSize(24).setFontWeight('bold');
  sh.getRange(18, 1).setFontStyle('italic').setFontSize(9).setFontColor('#777777');
  sh.getRange(4, 2, 4, 1).setNumberFormat('#,##0 "€"');
  sh.getRange(9, 2, 2, 1).setNumberFormat('0.0%');
  sh.getRange(12, 2, 5, 1).setNumberFormat('#,##0 "€"');
  [[1, 44], [4, 40], [9, 52], [10, 52], [16, 44]].forEach(function (x) { sh.setRowHeight(x[0], x[1]); });
  var p = sh.getRange(9, 2, 2, 1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(0.85).setBackground('#D9EAD3').setRanges([p]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(0.5, 0.8499).setBackground('#FFF2A8').setRanges([p]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0.5).setBackground('#F4CCCC').setRanges([p]).build()]);
  sh.setColumnWidth(1, 400); sh.setColumnWidth(2, 260);
  try { sh.setHiddenGridlines(true); } catch (e) {}
}

// -- ΣΤΟΧΟΙ ανά ακίνητο (Gross_Revenue · στήλη B χειροκίνητη, διατηρείται) -------------

function finBuildStoxoi_(ss, props) {
  var sh = ss.getSheetByName(FIN.STOX), saved = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    var n = String(r[0] || '').trim(); if (n && n !== 'ΣΥΝΟΛΟ') saved[n] = r[1];
  });
  sh = finFresh_(ss, FIN.STOX);
  var D = finR_(ss).D, Y = finYear_(), n = props.length, tRow = 2 + n;
  var M = [['Ακίνητο', 'Στόχος ' + Y + ' (Gross Revenue)', 'Προβλεπόμενος (με μελλοντικές)', '% Στόχου', 'Υπόλοιπο έως στόχο']];
  props.forEach(function (p, i) {
    var r = 2 + i;
    M.push([p.name, saved.hasOwnProperty(p.name) ? saved[p.name] : '',
      '=SUMIFS(' + D['Gross_Revenue'] + ',' + D['Residence'] + ',$A' + r + ')',
      '=IF(OR($B' + r + '="",$B' + r + '=0),"",$C' + r + '/$B' + r + ')',
      '=IF(OR($B' + r + '="",$B' + r + '=0),"",$B' + r + '-$C' + r + ')']);
  });
  M.push(['ΣΥΝΟΛΟ', '=SUM(B2:B' + (tRow - 1) + ')', '=SUM(C2:C' + (tRow - 1) + ')',
    '=IF(OR(B' + tRow + '="",B' + tRow + '=0),"",C' + tRow + '/B' + tRow + ')',
    '=IF(OR(B' + tRow + '="",B' + tRow + '=0),"",B' + tRow + '-C' + tRow + ')']);
  sh.getRange(1, 1, M.length, 5).setValues(M);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground(FIN_GREEN).setFontColor('#FFFFFF').setWrap(true);
  sh.getRange(tRow, 1, 1, 5).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange(2, 2, n + 1, 2).setNumberFormat('#,##0.00');
  sh.getRange(2, 4, n + 1, 1).setNumberFormat('0.0%');
  sh.getRange(2, 5, n + 1, 1).setNumberFormat('#,##0.00');
  sh.getRange(2, 2, n, 1).setBackground('#FFF2CC');
  sh.setColumnWidth(1, 180);
}

// -- OVERVIEW -------------------------------------------------------------------------

function finBuildOverview_(ss, props) {
  var sh = finFresh_(ss, FIN.OVER), D = finR_(ss).D, Y = finYear_(), months = [4, 5, 6, 7, 8, 9, 10];
  var NC = 4 + months.length, n = props.length, M = [], a, c;
  M.push(['Ακίνητο', 'Gross Revenue', 'Company Revenue', '% Στόχου'].concat(months.map(function (m) { return FIN_MONTHS[m - 1]; })));
  var SB = "'" + FIN.STOX + "'!$A$2:$B$" + (n + 2);
  props.forEach(function (p, i) {
    var r = 3 + i;
    a = [p.name, '=SUMIFS(' + D['Gross_Revenue'] + ',' + D['Residence'] + ',$A' + r + ')',
      '=SUMIFS(' + D['Company_Revenue'] + ',' + D['Residence'] + ',$A' + r + ')',
      '=IFERROR(IF(VLOOKUP($A' + r + ',' + SB + ',2,FALSE)=0,"",$B' + r + '/VLOOKUP($A' + r + ',' + SB + ',2,FALSE)),"")'];
    months.forEach(function (m) { a.push('=SUMIFS(' + D['Gross_Revenue'] + ',' + D['Residence'] + ',$A' + r + ',' + D['Month'] + ',' + m + ')'); });
    M.push(a);
  });
  var tRow = 3 + n, SX = 'SUMIF(\'' + FIN.STOX + '\'!$A$2:$A$' + (n + 2) + ',"<>ΣΥΝΟΛΟ",\'' + FIN.STOX + '\'!$B$2:$B$' + (n + 2) + ')';
  a = ['ΣΥΝΟΛΟ'];
  for (c = 2; c <= NC; c++) a.push(c === 4 ? '=IFERROR(IF(' + SX + '=0,"",$B' + tRow + '/' + SX + '),"")' : '=SUM(' + finColL_(c) + '3:' + finColL_(c) + (tRow - 1) + ')');
  M.push(a);
  sh.getRange(2, 1, M.length, NC).setValues(M);
  finTitle_(sh, 1, 'OVERVIEW ' + Y + ' — Gross Revenue vs Στόχος & Company Revenue', NC);
  sh.getRange(2, 1, 1, NC).setFontWeight('bold').setBackground(FIN_HEAD);
  sh.getRange(tRow, 1, 1, NC).setFontWeight('bold');
  sh.getRange(3, 2, n + 1, 2).setNumberFormat('#,##0.00');
  sh.getRange(3, 4, n + 1, 1).setNumberFormat('0.0%');
  sh.getRange(3, 5, n + 1, months.length).setNumberFormat('#,##0');
  sh.setFrozenRows(2); sh.setFrozenColumns(1); sh.setColumnWidth(1, 180);
  var p = sh.getRange(3, 4, n, 1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(0.85).setBackground('#D9EAD3').setRanges([p]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(0.5, 0.8499).setBackground('#FFF2A8').setRanges([p]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0.5).setBackground('#F4CCCC').setRanges([p]).build()]);
}

// -- PLATFORM FEES ----------------------------------------------------------------------

function finBuildFees_(ss, props) {
  var sh = finFresh_(ss, FIN.FEES), D = finR_(ss).D, Y = finYear_(), n = props.length, m, a;
  var hdr = function (first) { return [first].concat(FIN_MONTHS).concat(['ΕΤΟΣ']); };
  var tot = function (f, l) { var t = ['ΣΥΝΟΛΟ']; for (var k = 2; k <= 14; k++) t.push('=SUM(' + finColL_(k) + f + ':' + finColL_(k) + l + ')'); return t; };
  var M1 = [hdr('Ακίνητο')];
  props.forEach(function (p, i) {
    var r = 3 + i; a = [p.name];
    for (m = 1; m <= 12; m++) a.push('=SUMIFS(' + D['Channel_Fee'] + ',' + D['Residence'] + ',$A' + r + ',' + D['Month'] + ',' + m + ')');
    a.push('=SUM(B' + r + ':M' + r + ')'); M1.push(a);
  });
  var t1 = 3 + n; M1.push(tot(3, t1 - 1));
  sh.getRange(2, 1, M1.length, 14).setValues(M1);
  finTitle_(sh, 1, 'SERVICE FEES ανά ΑΚΙΝΗΤΟ × μήνα (' + Y + ')', 14);
  sh.getRange(2, 1, 1, 14).setFontWeight('bold').setBackground(FIN_HEAD); sh.getRange(t1, 1, 1, 14).setFontWeight('bold');

  // Πλατφόρμες: η λίστα υπολογίζεται εδώ (όχι UNIQUE/SORT με spill — βλ. v3.3)
  var plats = {}; finTable_(ss, FIN.DATA).forEach(function (r) { if (r['Platform']) plats[r['Platform']] = 1; });
  var pl = Object.keys(plats).sort(); while (pl.length < FIN_PLATFORM_ROWS) pl.push('');
  var r2 = t1 + 2, p0 = r2 + 2, M2 = [hdr('Πλατφόρμα')];
  pl.forEach(function (p, i) {
    var r = p0 + i; a = [p];
    for (m = 1; m <= 12; m++) a.push('=IF($A' + r + '="","",SUMIFS(' + D['Channel_Fee'] + ',' + D['Platform'] + ',$A' + r + ',' + D['Month'] + ',' + m + '))');
    a.push('=IF($A' + r + '="","",SUM(B' + r + ':M' + r + '))'); M2.push(a);
  });
  var t2 = p0 + pl.length; M2.push(tot(p0, t2 - 1));
  sh.getRange(r2 + 1, 1, M2.length, 14).setValues(M2);
  finTitle_(sh, r2, 'SERVICE FEES ανά ΠΛΑΤΦΟΡΜΑ × μήνα (' + Y + ')', 14);
  sh.getRange(r2 + 1, 1, 1, 14).setFontWeight('bold').setBackground(FIN_HEAD); sh.getRange(t2, 1, 1, 14).setFontWeight('bold');

  var r3 = t2 + 2, a0 = r3 + 2, M3 = [hdr('Ακίνητο')];
  props.forEach(function (p, i) {
    var r = a0 + i; a = [p.name];
    for (m = 1; m <= 12; m++) a.push('=SUMIFS(' + D['Channel_Fee'] + ',' + D['Residence'] + ',$A' + r + ',' + D['Platform'] + ',"Airbnb",' + D['Month'] + ',' + m + ')');
    a.push('=SUM(B' + r + ':M' + r + ')'); M3.push(a);
  });
  var t3 = a0 + n; M3.push(tot(a0, t3 - 1));
  sh.getRange(r3 + 1, 1, M3.length, 14).setValues(M3);
  finTitle_(sh, r3, 'AIRBNB FEES ανά ΑΚΙΝΗΤΟ × μήνα (' + Y + ')', 14);
  sh.getRange(r3 + 1, 1, 1, 14).setFontWeight('bold').setBackground(FIN_HEAD); sh.getRange(t3, 1, 1, 14).setFontWeight('bold');
  sh.getRange(1, 2, t3, 13).setNumberFormat('#,##0.00');
  sh.setFrozenColumns(1); sh.setColumnWidth(1, 180);
}

// -- OCCUPANCY (σεζόν Απρ–Οκτ, ανά ημέρα) --------------------------------------------

function finBuildOcc_(ss, props, dataRows) {
  var sh = finFresh_(ss, FIN.OCC), Y = finYear_(), DAY = 86400000, NM = FIN_OCC_M1 - FIN_OCC_M0 + 1, NC = 2 + NM;
  var I = {}; FIN_DATA_COLS.forEach(function (c, i) { I[c] = i; });
  var names = [], rowOf = {}, i, j;
  props.forEach(function (p) { if (!(p.name in rowOf)) { rowOf[p.name] = names.length; names.push(p.name); } });
  dataRows.forEach(function (r) { var n = String(r[I.Residence] || ''); if (n && !(n in rowOf)) { rowOf[n] = names.length; names.push(n); } });
  var mk = function (v) { return names.map(function () { var a = []; for (var k = 0; k < NM; k++) a.push(v === 'set' ? {} : 0); return a; }); };
  var occ = mk('set'), nig = mk(0), rev = mk(0), pn = mk(0), zn = mk(0);
  dataRows.forEach(function (row) {
    if (String(row[I.Status]).indexOf('Ακυρ') > -1) return;
    var ci = finDate_(row[I.Check_in]), co = finDate_(row[I.Check_out]); if (!ci || !co || co <= ci) return;
    var tot = Math.round((co - ci) / DAY), amount = finNum_(row[I.Total_value]), per = amount / tot, idx = rowOf[row[I.Residence]];
    for (var t = ci.getTime(); t < co.getTime(); t += DAY) {
      var d = new Date(t); if (d.getFullYear() !== Y) continue;
      var mo = d.getMonth() + 1; if (mo < FIN_OCC_M0 || mo > FIN_OCC_M1) continue;
      var jj = mo - FIN_OCC_M0;
      occ[idx][jj][d.getMonth() * 100 + d.getDate()] = 1; nig[idx][jj]++;
      if (amount > 0) { pn[idx][jj]++; rev[idx][jj] += per; } else zn[idx][jj]++;
    }
  });
  var dim = [], season = 0;
  for (j = 0; j < NM; j++) { dim.push(finDaysInMonth_(Y, FIN_OCC_M0 + j)); season += dim[j]; }
  var od = function (i, j) { return Object.keys(occ[i][j]).length; };
  var rs = function (arr, i) { var s = 0; for (var k = 0; k < NM; k++) s += (arr === occ ? od(i, k) : arr[i][k]); return s; };
  var cs = function (arr, j) { var s = 0; for (var k = 0; k < names.length; k++) s += (arr === occ ? od(k, j) : arr[k][j]); return s; };
  var all = function (arr) { var s = 0; for (var k = 0; k < names.length; k++) s += rs(arr, k); return s; };
  var val = function (kind, num, den) { return kind === 'occ' ? (den ? num / den : '') : num; };
  var block = function (top, title, kind, totLabel) {
    var M = [finBlank_(NC)]; M[0][0] = title;
    M.push(['Ακίνητο'].concat(dim.map(function (d, k) { return FIN_MONTHS[FIN_OCC_M0 - 1 + k] + ' (' + d + ')'; })).concat([kind === 'occ' ? 'ΣΕΖΟΝ %' : 'ΣΕΖΟΝ']));
    var cell = function (i, j) {   // j === -1 → σεζόν · i === -1 → σύνολο
      var o = i < 0 ? (j < 0 ? all(occ) : cs(occ, j)) : (j < 0 ? rs(occ, i) : od(i, j));
      var g = function (arr) { return i < 0 ? (j < 0 ? all(arr) : cs(arr, j)) : (j < 0 ? rs(arr, i) : arr[i][j]); };
      var days = (j < 0 ? season : dim[j]) * (i < 0 ? names.length : 1);
      if (kind === 'occ') return days ? o / days : '';
      if (kind === 'nights') return g(nig);
      if (kind === 'free') return g(zn);
      if (kind === 'adr') { var p = g(pn); return p ? finR2_(g(rev) / p) : ''; }
      return days ? finR2_(g(rev) / days) : '';
    };
    for (var i = 0; i < names.length; i++) { var a = [names[i]]; for (var j = 0; j < NM; j++) a.push(cell(i, j)); a.push(cell(i, -1)); M.push(a); }
    var t = [totLabel]; for (var jj = 0; jj < NM; jj++) t.push(cell(-1, jj)); t.push(cell(-1, -1)); M.push(t);
    sh.getRange(top, 1, M.length, NC).setValues(M);
    finTitle_(sh, top, null, NC);
    sh.getRange(top + 1, 1, 1, NC).setFontWeight('bold').setBackground(FIN_HEAD);
    sh.getRange(top + M.length - 1, 1, 1, NC).setFontWeight('bold').setBackground('#F3F3F3');
    sh.getRange(top + 2, 2, names.length + 1, NC - 1).setNumberFormat(kind === 'occ' ? '0.0%' : (kind === 'nights' || kind === 'free') ? '#,##0' : '#,##0.00');
    return top + M.length + 2;
  };
  var r = 1;
  r = block(r, 'ΠΛΗΡΟΤΗΤΑ ' + Y + ' — % ανά ακίνητο × μήνα (σεζόν Απρ–Οκτ)', 'occ', 'ΣΥΝΟΛΟ ΧΑΡΤΟΦΥΛΑΚΙΟΥ');
  r = block(r, 'ΚΛΕΙΣΜΕΝΕΣ ΝΥΧΤΕΣ ' + Y + ' (μαζί με τις νύχτες χωρίς έσοδο)', 'nights', 'ΣΥΝΟΛΟ');
  r = block(r, 'ΝΥΧΤΕΣ ΧΩΡΙΣ ΕΣΟΔΟ ' + Y + ' — μηδενική αξία', 'free', 'ΣΥΝΟΛΟ');
  r = block(r, 'ADR ' + Y + ' — μέση τιμή ανά ΠΛΗΡΩΜΕΝΗ νύχτα (Total value)', 'adr', 'ΜΕΣΟΣ ΟΡΟΣ');
  r = block(r, 'RevPAR ' + Y + ' — έσοδο ανά διαθέσιμη νύχτα (Total value)', 'revpar', 'ΜΕΣΟΣ ΟΡΟΣ');
  finNote_(sh, r, 'Πληρότητα = κλεισμένες νύχτες / μέρες μήνα · σεζόν Απρ–Οκτ = ' + season + ' μέρες · μέτρηση ανά ημέρα · ' +
    'ακυρωμένες εκτός, Direct Cash μέσα · ADR = Total value / πληρωμένες νύχτες · RevPAR = Total value / μέρες. ' +
    'Υπολογίστηκε: ' + Utilities.formatDate(new Date(), finTz_(), 'dd/MM/yyyy HH:mm'));
  sh.setFrozenRows(2); sh.setFrozenColumns(1); sh.setColumnWidth(1, 220); sh.setColumnWidths(2, NC - 1, 88);
}

// -- ΔΙΑΘΕΣΙΜΟΤΗΤΑ (υπόλοιπο σεζόν) --------------------------------------------------

function finBuildAvail_(ss, dataRows) {
  var sh = finFresh_(ss, FIN.AVAIL), Y = finYear_(), DAY = 86400000;
  var I = {}; FIN_DATA_COLS.forEach(function (c, i) { I[c] = i; });
  var s0 = new Date(Y, 3, 1), s1 = new Date(Y, 10, 1), today = new Date(); today.setHours(0, 0, 0, 0);
  var w0 = today > s0 ? today : s0, total = Math.max(0, Math.round((s1 - w0) / DAY)), NC = 9;
  var by = {}; dataRows.forEach(function (r) { var n = r[I.Residence]; if (n) (by[n] = by[n] || []).push(r); });
  var names = Object.keys(by).sort(function (a, b) { return a.localeCompare(b, 'el'); });
  finTitle_(sh, 1, 'ΔΙΑΘΕΣΙΜΟΤΗΤΑ ' + Y + ' — υπόλοιπο σεζόν (σήμερα → 31/10)', NC);
  sh.getRange(2, 1, 1, NC).setValues([['Ακίνητο', 'Μέρες περιόδου', 'Κλεισμένες', 'Αδιάθετες', 'Αδιάθετες σε κενά ≥3ημ',
    'Μέσο GR/νύχτα', 'Εκτίμηση αξίας (GR)', 'Μέσο CR/νύχτα', 'Εκτίμηση αξίας (CR)']]).setFontWeight('bold').setBackground(FIN_HEAD);
  var out = [], tot = [0, 0, 0, 0, 0];
  names.forEach(function (nm) {
    var occ = {}, gr = 0, cr = 0, nn = 0;
    by[nm].forEach(function (r) {
      var st = String(r[I.Status]), ci = finDate_(r[I.Check_in]), co = finDate_(r[I.Check_out]), m = Number(r[I.Month]);
      var n = Number(r[I.Nights]) || (ci && co ? Math.round((co - ci) / DAY) : 0);
      if (st.indexOf('Ακυρ') === -1 && m >= 4 && m <= 10 && n > 0) { gr += finNum_(r[I.Gross_Revenue]); cr += finNum_(r[I.Company_Revenue]); nn += n; }
      if (st.indexOf('Ακυρ') > -1 || !ci || !co) return;
      for (var d = Math.max(ci.getTime(), w0.getTime()); d < Math.min(co.getTime(), s1.getTime()); d += DAY) occ[Math.round((d - w0) / DAY)] = 1;
    });
    var booked = Object.keys(occ).length, free = total - booked, f3 = 0, run = 0;
    for (var k = 0; k < total; k++) { if (!occ[k]) run++; else { if (run >= 3) f3 += run; run = 0; } }
    if (run >= 3) f3 += run;
    var ag = nn ? gr / nn : 0, ac = nn ? cr / nn : 0;
    out.push([nm, total, booked, free, f3, finR2_(ag), Math.round(f3 * ag), finR2_(ac), Math.round(f3 * ac)]);
    tot[0] += booked; tot[1] += free; tot[2] += f3; tot[3] += Math.round(f3 * ag); tot[4] += Math.round(f3 * ac);
  });
  if (!out.length) { finNote_(sh, 3, 'Δεν υπάρχουν κρατήσεις ακόμα.'); return; }
  sh.getRange(3, 1, out.length, NC).setValues(out);
  var t = 3 + out.length;
  sh.getRange(t, 1, 1, NC).setValues([['ΣΥΝΟΛΟ', total * out.length, tot[0], tot[1], tot[2], '', tot[3], '', tot[4]]]).setFontWeight('bold');
  sh.getRange(3, 6, out.length + 1, 4).setNumberFormat('#,##0.00');
  finNote_(sh, t + 2, 'Μέσες τιμές/νύχτα από κρατήσεις Απρ–Οκτ του κάθε σπιτιού · ακυρωμένες δεν μετράνε ως κλεισμένες. ' +
    'Υπολογίστηκε: ' + Utilities.formatDate(new Date(), finTz_(), 'dd/MM/yyyy HH:mm'));
  sh.setFrozenRows(2); sh.setFrozenColumns(1); sh.setColumnWidth(1, 180);
}

// -- ΑΥΤΟΜΑΤΟ PULL ------------------------------------------------------------------

function finTriggerOn() {
  finTriggerOff_();
  ScriptApp.newTrigger('pullFinancialsAuto').timeBased().everyDays(1).atHour(FIN_AUTO_HOUR).nearMinute(FIN_AUTO_MIN).inTimezone(finTz_()).create();
  SomnioCore.logRun('Financials · Auto-pull', 'OK', '', 'ON ' + FIN_AUTO_HOUR + ':' + FIN_AUTO_MIN);
  SpreadsheetApp.getUi().alert('Auto-pull ON — καθημερινά ~' + FIN_AUTO_HOUR + ':' + FIN_AUTO_MIN + ' (μετά το Master και το Candy).');
}
function finTriggerOff_() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pullFinancialsAuto') ScriptApp.deleteTrigger(t); }); }
function finTriggerOff() { finTriggerOff_(); SpreadsheetApp.getUi().alert('Auto-pull OFF.'); }

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Financials')
    .addItem('1. Pull τώρα', 'pullFinancials')
    .addSeparator()
    .addItem('2. Auto-pull ON (~08:45)', 'finTriggerOn')
    .addItem('2. Auto-pull OFF', 'finTriggerOff')
    .addToUi();
}
