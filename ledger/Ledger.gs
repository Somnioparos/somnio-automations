/**
 * Owner Ledger 2027 — ποιος ιδιοκτήτης χρωστάει τι, και τι χρωστάμε εμείς.
 *
 * PULL-only, ΜΟΝΟ από το Candy Recipes 2027 (εκεί είναι ήδη όλα):
 *   Ακίνητα                 — ακίνητο → ιδιοκτήτης (Owner_Name), τύπος.
 *   Εισπράξεις κρατήσεων    — ανά κράτηση: «Μας χρωστάει» + ποσό + ✅ Πληρώθηκε · Direct Cash: «Δίνουμε στον
 *                             ιδιοκτήτη» + ✅ Δόθηκε.
 *   Έξοδα                   — Χρεώνεται σε = Ιδιοκτήτης → το ιδιοκτήτης μάς τα χρωστάει (Σύνολο), εκτός αν τα
 *                             πλήρωσε ο ίδιος (Λογαριασμός τύπου «Ιδιοκτήτης»).
 *   Κινήσεις                — «Πληρωμή από ιδιοκτήτη» / «Απόδοση σε ιδιοκτήτη»: ποσά που καλύπτουν πολλά μαζί.
 *
 * Κανόνες (αποφάσεις 21/10 · 7/11):
 *   - ΟΧΙ συμψηφισμός: «Μας χρωστάει» και «Τους χρωστάμε» μένουν χωριστά (το Καθαρό είναι πληροφοριακό).
 *   - FIFO: πρώτα κλείνει ό,τι τσεκαρίστηκε ανά κράτηση· οι συνολικές πληρωμές κλείνουν τα παλαιότερα ανοιχτά.
 *   - Προμήθεια κράτησης οφείλεται μετά το check-out· πριν φαίνεται ως «Μελλοντική» (όχι στο ληξιπρόθεσμο).
 *   - Airbnb εταιρείας: οφείλεται το Owner_Payable (προμήθεια + ΦΠΑ των δύο γραμμών).
 *
 * Tabs: Υπόλοιπα (ένας ιδιοκτήτης ανά γραμμή) · Κινήσεις ιδιοκτητών (αναλυτικά) · Log.
 * Απαιτεί SomnioCore. Μενού «Somnio Ledger»: 1. Ενημέρωση · 2. Αυτόματο ON/OFF (~08:50).
 */

var LG = { SUM: 'Υπόλοιπα', DET: 'Κινήσεις ιδιοκτητών', LOG: 'Log' };
var LG_PAID = '✅ Πληρώθηκε', LG_GIVEN = '✅ Δόθηκε';

function lgDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v) ? null : v;
  var s = String(v || ''), m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var g = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return g ? new Date(+g[3], +g[2] - 1, +g[1]) : null;
}
function lgNum_(v) {
  if (typeof v === 'number') return v;
  var s = String(v === null || v === undefined ? '' : v).replace(/[€\s]/g, '');
  if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
  var n = Number(s); return isNaN(n) ? 0 : n;
}
function lgR2_(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function lgKey_(s) { return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
function lgBool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function lgTable_(ss, name) {
  var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return [];
  var m = SomnioCore.headerMap(sh), v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return v.map(function (r) { var o = {}; for (var k in m) o[k] = r[m[k]]; return o; });
}

/**
 * Καθαρή συνάρτηση (δοκιμάζεται χωρίς Sheets): από τους πίνακες του Candy → { owners, lines }.
 * src = { props, receipts, expenses, movements, accounts }, today = Date
 */
function lgCompute_(src, today) {
  var t0 = new Date(today); t0.setHours(0, 0, 0, 0);
  var ownerOf = {}, owners = {}, accType = {};
  src.accounts.forEach(function (a) { accType[lgKey_(a['Λογαριασμός'])] = String(a['Τύπος'] || ''); });
  src.props.forEach(function (p) {
    var res = String(p['Residence'] || '').trim(), ot = String(p['Owner_Type'] || '');
    if (!res || ot === 'Δικό μας') return;
    var o = String(p['Owner_Name'] || '').trim() || ('(ιδιοκτήτης ' + res + ')');
    ownerOf[lgKey_(res)] = o;
    var k = lgKey_(o);
    if (!owners[k]) owners[k] = { name: o, props: [], due: [], owed: [], payIn: [], payOut: [] };
    owners[k].props.push(res);
  });
  var own = function (res) { var o = ownerOf[lgKey_(res)]; return o ? owners[lgKey_(o)] : null; };
  var byName = function (n) { return owners[lgKey_(n)] || null; };

  // 1. Κρατήσεις
  src.receipts.forEach(function (r) {
    var O = own(r['Ακίνητο']); if (!O || !r['event_id']) return;
    var co = lgDate_(r['Check-out']) || lgDate_(r['Check-in']);
    var label = (r['Επισκέπτης'] || '') + ' · ' + (r['Πλατφόρμα'] || '');
    var paid = lgBool_(r[LG_PAID]), amt = lgNum_(r['Ποσό']);
    if (/μετρητ/i.test(String(r['Μας χρωστάει']))) {                     // Direct Cash: εμείς τους χρωστάμε
      var owe = lgNum_(r['Δίνουμε στον ιδιοκτήτη']);
      if (paid && owe > 0) O.owed.push({ date: lgDate_(r['Πότε']) || co, prop: r['Ακίνητο'], kind: 'Direct Cash προς απόδοση',
        what: label, amount: owe, direct: lgBool_(r[LG_GIVEN]) ? owe : 0, ref: r['event_id'] });
      return;
    }
    var exp = lgNum_(r['Αναμενόμενο']) || amt;
    if (!(exp > 0)) return;
    O.due.push({ date: co, prop: r['Ακίνητο'], kind: 'Προμήθεια κράτησης', what: label, amount: exp,
      direct: paid ? amt : 0, future: co && co > t0, ref: r['event_id'] });
  });

  // 2. Έξοδα για λογαριασμό του ιδιοκτήτη
  src.expenses.forEach(function (e) {
    if (String(e['Χρεώνεται σε']).trim() !== 'Ιδιοκτήτης') return;
    var O = own(e['Κέντρο κόστους']); if (!O) return;
    if (accType[lgKey_(e['Λογαριασμός'])] === 'Ιδιοκτήτης') return;      // τα πλήρωσε ο ίδιος
    var tot = lgNum_(e['Σύνολο']); if (!tot) return;
    O.due.push({ date: lgDate_(e['Ημ/νία']), prop: e['Κέντρο κόστους'], kind: 'Έξοδο για λογαριασμό σας',
      what: [e['Προμηθευτής'], e['Περιγραφή']].filter(String).join(' · '), amount: tot, direct: 0, future: false, ref: e['ID'] });
  });

  // 3. Συνολικές πληρωμές / αποδόσεις (Κινήσεις)
  var unknown = [];
  src.movements.forEach(function (m) {
    var amt = lgNum_(m['Ποσό']); if (!amt) return;
    if (m['Τι είναι'] === 'Πληρωμή από ιδιοκτήτη') {
      var O = byName(m['Από λογαριασμό']); if (!O) { unknown.push(m['Από λογαριασμό']); return; }
      O.payIn.push({ date: lgDate_(m['Ημ/νία']), amount: amt, ref: m['ID'], note: m['Σημείωση'] });
    } else if (m['Τι είναι'] === 'Απόδοση σε ιδιοκτήτη') {
      var P = byName(m['Σε λογαριασμό ή σε ποιον']); if (!P) { unknown.push(m['Σε λογαριασμό ή σε ποιον']); return; }
      P.payOut.push({ date: lgDate_(m['Ημ/νία']), amount: amt, ref: m['ID'], note: m['Σημείωση'] });
    }
  });

  // 4. FIFO ανά ιδιοκτήτη
  var byDate = function (a, b) { return (a.date ? a.date.getTime() : 0) - (b.date ? b.date.getTime() : 0); };
  var fifo = function (items, pays) {
    items.forEach(function (it) { it.paid = Math.min(it.amount, it.direct); });
    var due = items.filter(function (i) { return !i.future; }).sort(byDate), fut = items.filter(function (i) { return i.future; }).sort(byDate);
    var credit = 0; pays.sort(byDate).forEach(function (p) { credit += p.amount; });
    due.concat(fut).forEach(function (it) { var x = Math.min(credit, it.amount - it.paid); if (x > 0) { it.paid += x; credit -= x; } });
    return lgR2_(credit);                                               // πλεόνασμα (προκαταβολή)
  };
  var out = [], lines = [];
  Object.keys(owners).forEach(function (k) {
    var O = owners[k];
    var extraIn = fifo(O.due, O.payIn), extraOut = fifo(O.owed, O.payOut);
    var sum = function (arr, f) { return lgR2_(arr.reduce(function (s, i) { return s + f(i); }, 0)); };
    var openDue = sum(O.due.filter(function (i) { return !i.future; }), function (i) { return i.amount - i.paid; });
    var openFut = sum(O.due.filter(function (i) { return i.future; }), function (i) { return i.amount - i.paid; });
    var overdue = sum(O.due.filter(function (i) { return !i.future && i.date && (t0 - i.date) / 86400000 > 30; }), function (i) { return i.amount - i.paid; });
    var weOwe = sum(O.owed, function (i) { return i.amount - i.paid; });
    var dates = O.payIn.concat(O.payOut).map(function (p) { return p.date; }).filter(Boolean)
      .concat(O.due.concat(O.owed).filter(function (i) { return i.direct > 0; }).map(function (i) { return i.date; }).filter(Boolean));
    var last = dates.length ? new Date(Math.max.apply(null, dates.map(function (d) { return d.getTime(); }))) : '';
    var openN = O.due.concat(O.owed).filter(function (i) { return i.amount - i.paid > 0.009; }).length;
    if (!O.due.length && !O.owed.length && !O.payIn.length && !O.payOut.length) return;
    out.push({ name: O.name, props: O.props.join(', '), openDue: openDue, overdue: overdue, openFut: openFut,
      weOwe: weOwe, credit: lgR2_(extraIn), creditOut: lgR2_(extraOut), net: lgR2_(openDue - weOwe), last: last, openN: openN });
    var st = function (i) { var r = i.amount - i.paid; return r <= 0.009 ? 'Εξοφλημένο' : i.paid > 0.009 ? 'Μερικό' : i.future ? 'Μελλοντικό' : 'Ανοιχτό'; };
    O.due.sort(byDate).forEach(function (i) { lines.push([O.name, i.prop, i.date || '', i.kind, i.what, lgR2_(i.amount), '', lgR2_(i.paid), lgR2_(i.amount - i.paid), st(i), i.ref]); });
    O.owed.sort(byDate).forEach(function (i) { lines.push([O.name, i.prop, i.date || '', i.kind, i.what, '', lgR2_(i.amount), lgR2_(i.paid), lgR2_(i.amount - i.paid), st(i), i.ref]); });
    O.payIn.forEach(function (p) { lines.push([O.name, '', p.date || '', 'Πληρωμή από ιδιοκτήτη', p.note || '', '', lgR2_(p.amount), '', '', 'Κατανεμήθηκε (FIFO)', p.ref]); });
    O.payOut.forEach(function (p) { lines.push([O.name, '', p.date || '', 'Απόδοση σε ιδιοκτήτη', p.note || '', lgR2_(p.amount), '', '', '', 'Κατανεμήθηκε (FIFO)', p.ref]); });
  });
  out.sort(function (a, b) { return b.openDue - a.openDue || a.name.localeCompare(b.name); });
  return { owners: out, lines: lines, unknown: unknown };
}

function updateLedger(silent) {
  var res = null;
  var ok = SomnioCore.runJob('Owner Ledger · Ενημέρωση', function () {
    var candy = SomnioCore.openFile('FILE_CANDY');
    var src = { props: lgTable_(candy, 'Ακίνητα'), receipts: lgTable_(candy, 'Εισπράξεις κρατήσεων'),
      expenses: lgTable_(candy, 'Έξοδα'), movements: lgTable_(candy, 'Κινήσεις'), accounts: lgTable_(candy, 'Λογαριασμοί') };
    res = lgCompute_(src, new Date());
    lgWrite_(SpreadsheetApp.getActiveSpreadsheet(), res);
    var tot = res.owners.reduce(function (s, o) { return s + o.openDue; }, 0);
    return { count: res.owners.length, detail: 'ιδιοκτήτες ' + res.owners.length + ' · μας χρωστάνε ' + lgR2_(tot) + ' €' +
      (res.unknown.length ? ' · άγνωστοι: ' + res.unknown.join(', ') : '') };
  });
  if (!silent) SpreadsheetApp.getUi().alert(ok ? 'Owner Ledger ΟΚ — ' + res.owners.length + ' ιδιοκτήτες.' : 'Σφάλμα — δες το Health στο Config.');
}
function updateLedgerAuto() { updateLedger(true); }

function lgWrite_(ss, res) {
  var tz = String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens');
  ss.setSpreadsheetTimeZone(tz);
  // --- Υπόλοιπα
  var sh = ss.getSheetByName(LG.SUM) || ss.insertSheet(LG.SUM, 0);
  sh.clear(); sh.setConditionalFormatRules([]);
  var H = ['Ιδιοκτήτης', 'Ακίνητα', 'Μας χρωστάει σήμερα', 'εκ των οποίων > 30 ημερών', 'Μελλοντικές προμήθειες',
    'Τους χρωστάμε (Direct Cash)', 'Καθαρό (πληροφοριακό)', 'Πλεόνασμα πληρωμών', 'Ανοιχτά στοιχεία', 'Τελευταία πληρωμή'];
  var M = [['OWNER LEDGER — υπόλοιπα ανά ιδιοκτήτη · ενημέρωση ' + Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm')].concat(['', '', '', '', '', '', '', '', '']), H];
  res.owners.forEach(function (o) {
    M.push([o.name, o.props, o.openDue, o.overdue, o.openFut, o.weOwe, o.net, o.credit || '', o.openN, o.last]);
  });
  var t = M.length + 1;
  M.push(['ΣΥΝΟΛΟ', '', '=SUM(C3:C' + (t - 1) + ')', '=SUM(D3:D' + (t - 1) + ')', '=SUM(E3:E' + (t - 1) + ')',
    '=SUM(F3:F' + (t - 1) + ')', '=SUM(G3:G' + (t - 1) + ')', '=SUM(H3:H' + (t - 1) + ')', '=SUM(I3:I' + (t - 1) + ')', '']);
  sh.getRange(1, 1, M.length, H.length).setValues(M);
  sh.getRange(1, 1, 1, H.length).setFontWeight('bold').setBackground('#202D5D').setFontColor('#FFFFFF');
  sh.getRange(2, 1, 1, H.length).setFontWeight('bold').setBackground('#DCE6F7').setWrap(true);
  sh.getRange(t, 1, 1, H.length).setFontWeight('bold').setBackground('#F3F3F3');
  sh.getRange(3, 3, M.length - 2, 6).setNumberFormat('#,##0.00;[Red]-#,##0.00');
  sh.getRange(3, 10, M.length - 2, 1).setNumberFormat('dd/MM/yyyy');
  if (res.owners.length) {
    var od = sh.getRange(3, 4, res.owners.length, 1);
    sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#F4CCCC').setRanges([od]).build()]);
  }
  sh.getRange(t + 2, 1).setValue('Χωρίς συμψηφισμό: «Μας χρωστάει» και «Τους χρωστάμε» εξοφλούνται χωριστά · Καθαρό = μόνο για εικόνα. ' +
    'Πληρωμές ανά κράτηση: Candy › Εισπράξεις κρατήσεων. Συνολικές πληρωμές: Candy › Κινήσεις «Πληρωμή από ιδιοκτήτη» / «Απόδοση σε ιδιοκτήτη» ' +
    '(κλείνουν τα παλαιότερα πρώτα — FIFO). Έξοδα με «Χρεώνεται σε: Ιδιοκτήτης» οφείλονται με το Σύνολο, εκτός αν πλήρωσε ο ίδιος.' +
    (res.unknown.length ? ' ⚠ Κινήσεις με άγνωστο ιδιοκτήτη: ' + res.unknown.join(', ') : ''))
    .setFontStyle('italic').setFontSize(9).setFontColor('#777777');
  sh.setFrozenRows(2); sh.setFrozenColumns(1); sh.setColumnWidth(1, 220); sh.setColumnWidth(2, 200); sh.setColumnWidths(3, 8, 120);
  sh.setRowHeight(2, 40);

  // --- Κινήσεις ιδιοκτητών
  var d = ss.getSheetByName(LG.DET) || ss.insertSheet(LG.DET, 1);
  d.clear(); d.setConditionalFormatRules([]);
  var DH = ['Ιδιοκτήτης', 'Ακίνητο', 'Ημ/νία', 'Τι είναι', 'Περιγραφή', 'Μας χρωστάει', 'Τους χρωστάμε', 'Εξοφλήθηκε', 'Υπόλοιπο', 'Κατάσταση', 'Ref'];
  d.getRange(1, 1, 1, DH.length).setValues([DH]).setFontWeight('bold').setBackground('#202D5D').setFontColor('#FFFFFF');
  d.setFrozenRows(1);
  if (res.lines.length) {
    d.getRange(2, 1, res.lines.length, DH.length).setValues(res.lines);
    d.getRange(2, 3, res.lines.length, 1).setNumberFormat('dd/MM/yyyy');
    d.getRange(2, 6, res.lines.length, 4).setNumberFormat('#,##0.00');
    var all = d.getRange(2, 1, res.lines.length, DH.length);
    var rule = function (v, c) { return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$J2="' + v + '"').setBackground(c).setRanges([all]).build(); };
    d.setConditionalFormatRules([rule('Εξοφλημένο', '#DDF1E4'), rule('Μερικό', '#FFF2CC'), rule('Ανοιχτό', '#FBEDED'), rule('Μελλοντικό', '#F7F7F7')]);
    try { d.getRange(1, 1, res.lines.length + 1, DH.length).createFilter(); } catch (e) {}
  }
  d.setColumnWidth(1, 200); d.setColumnWidth(5, 260);
  var s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Φύλλο1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
}

function lgTriggerOn() {
  lgTriggerOff_();
  ScriptApp.newTrigger('updateLedgerAuto').timeBased().everyDays(1).atHour(8).nearMinute(50)
    .inTimezone(String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens')).create();
  SomnioCore.logRun('Owner Ledger · Αυτόματο', 'OK', '', 'ON 08:50');
  SpreadsheetApp.getUi().alert('Αυτόματη ενημέρωση ON (~08:50, μετά το Candy).');
}
function lgTriggerOff_() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'updateLedgerAuto') ScriptApp.deleteTrigger(t); }); }
function lgTriggerOff() { lgTriggerOff_(); SpreadsheetApp.getUi().alert('Αυτόματη ενημέρωση OFF.'); }

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Ledger')
    .addItem('1. Ενημέρωση τώρα', 'updateLedger')
    .addSeparator()
    .addItem('2. Αυτόματο ON (~08:50)', 'lgTriggerOn')
    .addItem('2. Αυτόματο OFF', 'lgTriggerOff')
    .addToUi();
}
