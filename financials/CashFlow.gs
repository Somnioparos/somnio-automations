/**
 * Financials 2027 — tab «Cash flow»: ανά μήνα & λογαριασμό, πραγματικά + πρόβλεψη.
 *
 * Πηγές (όλες από το Candy Recipes 2027):
 *   Λογαριασμοί            — ποιοι είναι εταιρικοί (Εταιρικός / Μετρητά / Πλατφόρμα) + «Υπόλοιπο 1/1/ΕΤΟΣ».
 *   Εισπράξεις κρατήσεων   — ✅ Πληρώθηκε → είσοδος (Πότε, Λογαριασμός) · ✅ Δόθηκε → απόδοση σε ιδιοκτήτη.
 *                            Απλήρωτες → αναμενόμενη είσπραξη στον μήνα του check-out (ή στον τρέχοντα αν πέρασε).
 *   Concierge              — Εισπράχθηκε → είσοδος της προμήθειας · αλλιώς αναμενόμενη.
 *   Έξοδα                  — πληρωμή από εταιρικό λογαριασμό → έξοδος του ΣΥΝΟΛΟΥ (μαζί ΦΠΑ — είναι μετρητά)
 *                            στην Ημ/νία πληρωμής. Από προσωπικό λογαριασμό → δεν αγγίζει τα ταμεία
 *                            (φαίνεται πληροφοριακά· η επιστροφή στον συνέταιρο είναι Κίνηση).
 *   Κινήσεις               — Είσοδος / Έξοδος / Μεταφορά ανά «Τι είναι».
 *   Πρόβλεψη               — μελλοντικές εισροές/εκροές με επανάληψη.
 *
 * Οι πληρωμές εξόδων μετρούν ΟΛΕΣ (και όσες χρεώνονται στον ιδιοκτήτη): τα χρήματα βγήκαν από τον λογαριασμό μας.
 */

var CF_COMPANY_TYPES = ['Εταιρικός', 'Μετρητά', 'Πλατφόρμα'];
var CF_NOACC = '(χωρίς λογαριασμό)';
var CF_MOV_FLOW = {
  'Επιστροφή σε συνέταιρο': 'out', 'Μεταφορά μεταξύ λογαριασμών': 'xfer', 'Εγγύηση (δόθηκε)': 'out',
  'Εγγύηση (επιστράφηκε)': 'in', 'Κεφάλαιο (μπήκε)': 'in', 'Δάνειο (μπήκε)': 'in', 'Δόση δανείου': 'out',
  'Άλλη είσπραξη': 'in', 'Άλλη πληρωμή': 'out'
};

function finBuildCash_(ss, candy) {
  var Y = finYear_(), today = new Date(); today.setHours(0, 0, 0, 0);
  var curM = today.getFullYear() < Y ? 0 : today.getFullYear() > Y ? 13 : today.getMonth() + 1;   // 0 = όλο μέλλον, 13 = όλο παρελθόν

  // Λογαριασμοί
  var accs = [], isCo = {}, typeOf = {}, opening = {}, missingOpen = [];
  finTable_(candy, 'Λογαριασμοί').forEach(function (r) {
    var n = String(r['Λογαριασμός'] || '').trim(); if (!n) return;
    var t = String(r['Τύπος'] || '').trim(); typeOf[finKey_(n)] = t;
    if (String(r['Active']).toUpperCase() === 'FALSE' || CF_COMPANY_TYPES.indexOf(t) === -1) return;
    if (isCo[finKey_(n)]) return;
    isCo[finKey_(n)] = n; accs.push(n);
    var ob = null; for (var k in r) if (/^Υπόλοιπο/.test(k)) ob = r[k];
    if (ob === '' || ob === null) missingOpen.push(n);
    opening[n] = finNum_(ob);
  });
  var co = function (a) { return isCo[finKey_(a)] || null; };

  var Z = function () { return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; };
  var S = { rec: Z(), conc: Z(), inMov: Z(), exp: Z(), own: Z(), outMov: Z(), xfer: Z(),
            fRec: Z(), fConc: Z(), fIn: Z(), fOwn: Z(), fOut: Z(), pers: Z() };
  var acc = {}; accs.concat([CF_NOACC]).forEach(function (a) { acc[a] = Z(); });
  var noAccCount = 0;
  var monthOf = function (d) { d = finDate_(d); return d && d.getFullYear() === Y ? d.getMonth() + 1 : 0; };
  var fMonth = function (d) {           // μήνας πρόβλεψης: ό,τι έχει περάσει πάει στον τρέχοντα μήνα
    d = finDate_(d); if (!d) d = today;
    if (d < today) d = today;
    return d.getFullYear() === Y ? d.getMonth() + 1 : 0;
  };
  var actual = function (kind, a, d, amount) {   // amount: + είσοδος, − έξοδος
    var m = monthOf(d); if (!m || !amount) return;
    S[kind][m - 1] += amount;
    var k = a === null ? CF_NOACC : a;
    if (k === CF_NOACC) noAccCount++;
    acc[k][m - 1] += amount;
  };

  // Εισπράξεις κρατήσεων (+ αποδόσεις Direct Cash)
  finTable_(candy, 'Εισπράξεις κρατήσεων').forEach(function (r) {
    if (!r['event_id']) return;
    var paid = finBool_(r['✅ Πληρώθηκε']), given = finBool_(r['✅ Δόθηκε']);
    var amt = finNum_(r['Ποσό']), owe = finNum_(r['Δίνουμε στον ιδιοκτήτη']), a = r['Λογαριασμός'];
    if (paid) {
      var aa = a ? co(a) : null;
      if (a && !aa) return;                        // πληρώθηκε σε μη εταιρικό λογαριασμό (π.χ. ιδιοκτήτη)
      actual('rec', aa, r['Πότε'] || today, amt);
      if (owe > 0) {
        if (given) actual('own', aa, r['Πότε'] || today, -owe);
        else { var mo = fMonth(r['Πότε']); if (mo) S.fOwn[mo - 1] -= owe; }
      }
    } else if (amt > 0 && r['Κατάσταση κράτησης'] !== 'Ακυρωμένη') {
      var mf = fMonth(r['Check-out'] || r['Check-in']);
      if (mf) { S.fRec[mf - 1] += amt; if (owe > 0) S.fOwn[mf - 1] -= owe; }
    }
  });

  // Concierge
  finTable_(candy, 'Concierge').forEach(function (r) {
    var c = finNum_(r['Προμήθεια']); if (!c) return;
    if (finBool_(r['Εισπράχθηκε'])) { var a = r['Λογαριασμός']; if (a && !co(a)) return; actual('conc', a ? co(a) : null, r['Ημ/νία'], c); }
    else { var m = fMonth(r['Ημ/νία']); if (m) S.fConc[m - 1] += c; }
  });

  // Έξοδα
  finTable_(candy, 'Έξοδα').forEach(function (r) {
    var tot = finNum_(r['Σύνολο']); if (!tot) return;
    var a = String(r['Λογαριασμός'] || '').trim(), d = r['Ημ/νία πληρωμής'] || r['Ημ/νία'];
    if (!a) { actual('exp', null, d, -tot); return; }
    if (co(a)) { actual('exp', co(a), d, -tot); return; }
    if (typeOf[finKey_(a)] === 'Προσωπικός') { var m = monthOf(d); if (m) S.pers[m - 1] += tot; }
  });

  // Κινήσεις
  finTable_(candy, 'Κινήσεις').forEach(function (r) {
    var amt = finNum_(r['Ποσό']), flow = CF_MOV_FLOW[r['Τι είναι']]; if (!amt || !flow) return;
    var from = co(r['Από λογαριασμό']), to = co(r['Σε λογαριασμό ή σε ποιον']), d = r['Ημ/νία'];
    if (flow === 'in') actual('inMov', to, d, amt);
    else if (flow === 'out') actual('outMov', from, d, -amt);
    else {                                          // μεταφορά: επηρεάζει το σύνολο μόνο αν η μία πλευρά δεν είναι εταιρική
      if (from) actual('xfer', from, d, -amt);
      if (to) actual('xfer', to, d, amt);
    }
  });

  // Πρόβλεψη (με επανάληψη)
  var step = { 'Μία φορά': 0, 'Μηνιαία': 1, 'Τριμηνιαία': 3, 'Ετήσια': 12 };
  finTable_(candy, 'Πρόβλεψη').forEach(function (r) {
    var amt = finNum_(r['Ποσό']), d = finDate_(r['Ημ/νία']); if (!amt || !d) return;
    var sgn = r['Κατεύθυνση'] === 'Έξοδος' ? -1 : 1, st = step[r['Επανάληψη']] || 0;
    var until = finDate_(r['Μέχρι']) || new Date(Y, 11, 31);
    for (var x = new Date(d), guard = 0; x <= until && guard++ < 60; x = new Date(x.getFullYear(), x.getMonth() + st, x.getDate())) {
      if (x >= today && x.getFullYear() === Y) { if (sgn > 0) S.fIn[x.getMonth()] += amt; else S.fOut[x.getMonth()] -= amt; }
      if (!st) break;
    }
  });

  // -- Γράψιμο ---------------------------------------------------------------------
  var sh = finFresh_(ss, FIN.CASH), NC = 14, M = [], i, m;
  var row = function (label, arr) { var a = [label]; var t = 0; for (var k = 0; k < 12; k++) { a.push(arr ? finR2_(arr[k]) : ''); t += arr ? arr[k] : 0; } a.push(arr ? finR2_(t) : ''); return a; };
  var openTot = accs.reduce(function (s, a) { return s + opening[a]; }, 0);
  var netA = Z(), netF = Z(), start = Z(), end = Z();
  for (m = 0; m < 12; m++) {
    netA[m] = S.rec[m] + S.conc[m] + S.inMov[m] + S.exp[m] + S.own[m] + S.outMov[m] + S.xfer[m];
    netF[m] = S.fRec[m] + S.fConc[m] + S.fIn[m] + S.fOwn[m] + S.fOut[m];
    start[m] = m === 0 ? openTot : end[m - 1];
    end[m] = start[m] + netA[m] + netF[m];
  }
  M.push(['CASH FLOW ' + Y + ' — ΣΥΝΟΛΟ ΕΤΑΙΡΙΚΩΝ ΛΟΓΑΡΙΑΣΜΩΝ'].concat(finBlank_(NC - 1)));
  M.push(['Γραμμή'].concat(FIN_MONTHS).concat(['ΣΥΝΟΛΟ']));
  M.push([''].concat(FIN_MONTHS.map(function (x, k) { return k + 1 < curM ? 'πραγματικό' : k + 1 === curM ? 'τρέχων' : 'πρόβλεψη'; })).concat(['']));
  var rStart = M.length + 1; var a0 = row('Υπόλοιπο αρχής μήνα', start); a0[13] = finR2_(openTot); M.push(a0);
  var rA0 = M.length + 1;
  M.push(row('  + Εισπράξεις κρατήσεων', S.rec));
  M.push(row('  + Concierge', S.conc));
  M.push(row('  + Λοιπές εισροές (Κινήσεις)', S.inMov));
  M.push(row('  − Πληρωμές εξόδων', S.exp));
  M.push(row('  − Αποδόσεις σε ιδιοκτήτες (Direct Cash)', S.own));
  M.push(row('  − Λοιπές εκροές (Κινήσεις)', S.outMov));
  M.push(row('  ± Μεταφορές προς/από μη εταιρικούς λογαριασμούς', S.xfer));
  var rNetA = M.length + 1; M.push(row('= Καθαρή ροή — πραγματική', netA));
  M.push(row('  + Αναμενόμενες εισπράξεις κρατήσεων', S.fRec));
  M.push(row('  + Αναμενόμενο concierge', S.fConc));
  M.push(row('  + Προβλέψεις εισροών (tab Πρόβλεψη)', S.fIn));
  M.push(row('  − Αναμενόμενες αποδόσεις σε ιδιοκτήτες', S.fOwn));
  M.push(row('  − Προβλέψεις εκροών (tab Πρόβλεψη)', S.fOut));
  var rNetF = M.length + 1; M.push(row('= Καθαρή ροή — πρόβλεψη', netF));
  var rEnd = M.length + 1; var ae = row('ΥΠΟΛΟΙΠΟ ΤΕΛΟΥΣ ΜΗΝΑ', end); ae[13] = finR2_(end[11]); M.push(ae);
  M.push(finBlank_(NC));
  var rPers = M.length + 1; M.push(row('Πληροφοριακά: πληρωμές από προσωπικούς λογαριασμούς (οφειλή σε συνεταίρους)', S.pers));
  M.push(finBlank_(NC));

  // ανά λογαριασμό: υπόλοιπο τέλους μήνα (μόνο πραγματικά)
  var rAccT = M.length + 1;
  M.push(['ΥΠΟΛΟΙΠΟ ΤΕΛΟΥΣ ΜΗΝΑ ΑΝΑ ΛΟΓΑΡΙΑΣΜΟ — μόνο πραγματικές κινήσεις'].concat(finBlank_(NC - 1)));
  M.push(['Λογαριασμός'].concat(FIN_MONTHS).concat(['Υπόλοιπο 1/1']));
  var list = accs.slice(); if (acc[CF_NOACC].some(function (v) { return v; })) list.push(CF_NOACC);
  var tots = Z(), tOpen = 0;
  list.forEach(function (a) {
    var b = a === CF_NOACC ? 0 : opening[a], r = [a]; tOpen += b;
    for (m = 0; m < 12; m++) { b += acc[a][m]; tots[m] += b; r.push(m + 1 <= Math.max(curM, 0) || curM === 13 ? finR2_(b) : ''); }
    r.push(a === CF_NOACC ? '' : finR2_(opening[a])); M.push(r);
  });
  var tr = ['ΣΥΝΟΛΟ']; for (m = 0; m < 12; m++) tr.push(m + 1 <= Math.max(curM, 0) || curM === 13 ? finR2_(tots[m]) : ''); tr.push(finR2_(tOpen));
  var rAccTot = M.length + 1; M.push(tr);

  for (i = 0; i < M.length; i++) while (M[i].length < NC) M[i].push('');
  sh.getRange(1, 1, M.length, NC).setValues(M);
  finTitle_(sh, 1, null, NC);
  sh.getRange(2, 1, 1, NC).setFontWeight('bold').setBackground(FIN_HEAD);
  sh.getRange(3, 1, 1, NC).setFontStyle('italic').setFontColor('#777777').setHorizontalAlignment('center');
  sh.getRange(rStart, 2, rAccTot - rStart + 1, 13).setNumberFormat('#,##0.00;[Red]-#,##0.00');
  [rStart, rNetA, rNetF, rEnd].forEach(function (r) { sh.getRange(r, 1, 1, NC).setFontWeight('bold'); });
  sh.getRange(rNetA, 1, 1, NC).setBackground('#E2F0D9');
  sh.getRange(rNetF, 1, 1, NC).setBackground('#FFF2CC');
  sh.getRange(rEnd, 1, 1, NC).setBackground('#DCE6F7');
  sh.getRange(rPers, 1, 1, NC).setFontColor('#777777');
  finTitle_(sh, rAccT, null, NC);
  sh.getRange(rAccT + 1, 1, 1, NC).setFontWeight('bold').setBackground(FIN_HEAD);
  sh.getRange(rAccTot, 1, 1, NC).setFontWeight('bold').setBackground('#F3F3F3');
  // μελλοντικοί μήνες με απαλό γκρι
  for (m = 0; m < 12; m++) if (m + 1 > curM && curM !== 13) sh.getRange(rStart, m + 2, rEnd - rStart + 1, 1).setBackground('#F7F7F7');
  var warn = [];
  if (missingOpen.length) warn.push('Λείπει «Υπόλοιπο 1/1/' + Y + '» στο Candy › Λογαριασμοί για: ' + missingOpen.join(', ') + ' (μετράει ως 0).');
  if (noAccCount) warn.push(noAccCount + ' κινήσεις χωρίς λογαριασμό → γραμμή «' + CF_NOACC + '». Συμπλήρωσε τον λογαριασμό στο Candy.');
  finNote_(sh, rAccTot + 2, (warn.length ? '⚠ ' + warn.join(' ') + ' · ' : '') +
    'Εταιρικοί λογαριασμοί = Τύπος Εταιρικός / Μετρητά / Πλατφόρμα. Τα έξοδα μετρούν με το ΣΥΝΟΛΟ (μαζί ΦΠΑ) στην ημ/νία πληρωμής. ' +
    'Αναμενόμενες εισπράξεις: απλήρωτες κρατήσεις στον μήνα του check-out (ό,τι έχει καθυστερήσει πάει στον τρέχοντα μήνα). ' +
    'Οι μεταφορές μεταξύ εταιρικών λογαριασμών μηδενίζονται στο σύνολο. Υπολογίστηκε: ' + Utilities.formatDate(new Date(), finTz_(), 'dd/MM/yyyy HH:mm'));
  sh.setFrozenRows(3); sh.setFrozenColumns(1); sh.setColumnWidth(1, 380); sh.setColumnWidths(2, 13, 100);
}
