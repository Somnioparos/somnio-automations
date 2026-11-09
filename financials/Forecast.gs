/**
 * Financials 2027 — tab «Forecast vs Πραγματικό».
 *
 * Διαβάζει από το αρχείο Forecast (Config: FILE_FORECAST) το tab «Μηνιαίο ΕΤΟΣ» (ή όποιο λέει το
 * Config FORECAST_TAB) με μορφή:
 *     στήλη A = γραμμή (ίδιο όνομα με το P&L: «Έσοδα κρατήσεων», «Concierge», κατηγορίες εξόδων …)
 *     μία γραμμή headers με Ιαν, Φεβ, … Δεκ (σε οποιεσδήποτε στήλες)
 * Αριθμήσεις τύπου «1. » στην αρχή αγνοούνται. Τα σύνολα υπολογίζονται εδώ αν λείπουν.
 *
 * Το ΠΡΑΓΜΑΤΙΚΟ βγαίνει από τις ίδιες βάσεις με το P&L OVERALL (Company_Revenue, concierge, Opex καθαρά).
 * Τέσσερα blocks: ΠΡΟΒΛΕΨΗ · ΠΡΑΓΜΑΤΙΚΟ · ΔΙΑΦΟΡΑ € (πραγματικό − πρόβλεψη) · ΔΙΑΦΟΡΑ %.
 */

function finForecastLines_(cats) {
  return ['Έσοδα κρατήσεων', 'Concierge', 'ΣΥΝΟΛΟ ΕΣΟΔΩΝ'].concat(cats).concat(['Λοιπά (χωρίς κατηγορία)', 'ΣΥΝΟΛΟ ΕΞΟΔΩΝ', 'ΚΕΡΔΟΣ']);
}

function finActualByLine_(ss, cats) {
  var Z = function () { return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; };
  var A = {}; finForecastLines_(cats).forEach(function (l) { A[l] = Z(); });
  finTable_(ss, FIN.DATA).forEach(function (r) { var m = Number(r['Month']); if (m >= 1 && m <= 12) A['Έσοδα κρατήσεων'][m - 1] += finNum_(r['Company_Revenue']); });
  finTable_(ss, FIN.CONC).forEach(function (r) { var m = Number(r['Month']); if (m >= 1 && m <= 12) A['Concierge'][m - 1] += finNum_(r['Προμήθεια']); });
  finTable_(ss, FIN.EXP).forEach(function (r) {
    if (r['Χρεώνεται σε'] !== FIN_COMPANY || r['Φύση'] !== 'Opex') return;
    var m = Number(r['Month']); if (!(m >= 1 && m <= 12)) return;
    var line = cats.indexOf(r['Κατηγορία']) > -1 ? r['Κατηγορία'] : 'Λοιπά (χωρίς κατηγορία)';
    A[line][m - 1] += finNum_(r['Καθαρό']);
  });
  finTotals_(A, cats, true);
  return A;
}

/** Συμπληρώνει ΣΥΝΟΛΟ ΕΣΟΔΩΝ / ΣΥΝΟΛΟ ΕΞΟΔΩΝ / ΚΕΡΔΟΣ (force=true: πάντα· αλλιώς μόνο αν λείπουν). */
function finTotals_(A, cats, force) {
  for (var m = 0; m < 12; m++) {
    if (force || A._missing['ΣΥΝΟΛΟ ΕΣΟΔΩΝ']) A['ΣΥΝΟΛΟ ΕΣΟΔΩΝ'][m] = A['Έσοδα κρατήσεων'][m] + A['Concierge'][m];
    if (force || A._missing['ΣΥΝΟΛΟ ΕΞΟΔΩΝ']) {
      var e = A['Λοιπά (χωρίς κατηγορία)'][m]; cats.forEach(function (c) { e += A[c][m]; }); A['ΣΥΝΟΛΟ ΕΞΟΔΩΝ'][m] = e;
    }
    if (force || A._missing['ΚΕΡΔΟΣ']) A['ΚΕΡΔΟΣ'][m] = A['ΣΥΝΟΛΟ ΕΣΟΔΩΝ'][m] - A['ΣΥΝΟΛΟ ΕΞΟΔΩΝ'][m];
  }
}

/** Διαβάζει το μηνιαίο forecast → { lines: {γραμμή: [12]}, found, unmatched[] } ή null αν δεν υπάρχει. */
function finReadForecast_(cats) {
  var id = String(SomnioCore.cfg('FILE_FORECAST', false) || '').trim();
  var Y = finYear_(), tab = String(SomnioCore.cfg('FORECAST_TAB', false) || ('Μηνιαίο ' + Y));
  if (!id) return { error: 'Δεν έχει οριστεί FILE_FORECAST στο Config.' };
  var fs; try { fs = SpreadsheetApp.openById(id); } catch (e) { return { error: 'Δεν άνοιξε το αρχείο Forecast: ' + e.message }; }
  var sh = fs.getSheetByName(tab);
  if (!sh) return { error: 'Στο αρχείο Forecast δεν υπάρχει tab «' + tab + '».' };
  var v = sh.getDataRange().getValues(), hdrRow = -1, mcol = [];
  for (var r = 0; r < v.length && hdrRow < 0; r++) {
    var cols = FIN_MONTHS.map(function (mn) { for (var c = 0; c < v[r].length; c++) if (finKey_(v[r][c]) === finKey_(mn)) return c; return -1; });
    if (cols.filter(function (c) { return c >= 0; }).length >= 10) { hdrRow = r; mcol = cols; }
  }
  if (hdrRow < 0) return { error: 'Στο tab «' + tab + '» δεν βρέθηκε γραμμή με τους μήνες Ιαν…Δεκ.' };
  var want = finForecastLines_(cats), byKey = {}; want.forEach(function (l) { byKey[finKey_(l)] = l; });
  var F = { _missing: {} }, found = {}, unmatched = [];
  want.forEach(function (l) { F[l] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; });
  for (r = hdrRow + 1; r < v.length; r++) {
    var raw = String(v[r][0] || '').trim(); if (!raw) continue;
    var k = finKey_(raw.replace(/^\d+\s*[.)]\s*/, '')), line = byKey[k];
    if (!line) { unmatched.push(raw); continue; }
    found[line] = 1;
    for (var m = 0; m < 12; m++) if (mcol[m] >= 0) F[line][m] += finNum_(v[r][mcol[m]]);
  }
  ['ΣΥΝΟΛΟ ΕΣΟΔΩΝ', 'ΣΥΝΟΛΟ ΕΞΟΔΩΝ', 'ΚΕΡΔΟΣ'].forEach(function (t) { if (!found[t]) F._missing[t] = 1; });
  finTotals_(F, cats, false);
  return { lines: F, found: Object.keys(found).length, unmatched: unmatched, tab: tab };
}

function finBuildForecast_(ss, cats) {
  var sh = finFresh_(ss, FIN.FCST), Y = finYear_(), lines = finForecastLines_(cats), NC = 15;
  var A = finActualByLine_(ss, cats);
  A._missing = {};
  var today = new Date(), curM = today.getFullYear() < Y ? 0 : today.getFullYear() > Y ? 12 : today.getMonth() + 1;
  var F = finReadForecast_(cats);
  var isTotal = function (l) { return /^ΣΥΝΟΛΟ|^ΚΕΡΔΟΣ/.test(l); };
  var hdr = ['Γραμμή'].concat(FIN_MONTHS).concat(['ΕΤΟΣ', 'ΜΕΧΡΙ ' + (curM ? FIN_MONTHS[Math.min(curM, 12) - 1].toUpperCase() : '—')]);
  var ytd = function (arr) { var s = 0; for (var m = 0; m < Math.min(curM, 12); m++) s += arr[m]; return s; };
  var sum = function (arr) { return arr.reduce(function (s, x) { return s + x; }, 0); };
  var r = 1, fmt = [];
  var block = function (title, getter, kind) {
    var M = [[title].concat(finBlank_(NC - 1))];
    M.push(hdr);
    lines.forEach(function (l) {
      var vals = getter(l), y = vals.year, t = vals.ytd;
      M.push([l].concat(vals.m.map(function (x) { return x === '' ? '' : (kind === 'pct' ? x : finR2_(x)); })).concat([kind === 'pct' ? y : finR2_(y), kind === 'pct' ? t : finR2_(t)]));
    });
    sh.getRange(r, 1, M.length, NC).setValues(M);
    finTitle_(sh, r, null, NC);
    sh.getRange(r + 1, 1, 1, NC).setFontWeight('bold').setBackground(FIN_HEAD);
    sh.getRange(r + 2, 2, lines.length, NC - 1).setNumberFormat(kind === 'pct' ? '0.0%;[Red]-0.0%' : '#,##0.00;[Red]-#,##0.00');
    lines.forEach(function (l, i) { if (isTotal(l)) sh.getRange(r + 2 + i, 1, 1, NC).setFontWeight('bold').setBackground('#F3F3F3'); });
    r += M.length + 2;
  };
  var pack = function (arr) { return { m: arr, year: sum(arr), ytd: ytd(arr) }; };

  if (F.error) {
    block('ΠΡΑΓΜΑΤΙΚΟ ' + Y + ' (ίδιο με P&L OVERALL)', function (l) { return pack(A[l]); }, 'eur');
    finNote_(sh, r, '⚠ ' + F.error + ' Όταν είναι έτοιμο: στο Config βάλε FILE_FORECAST = ID του αρχείου Forecast, ' +
      'και φτιάξε εκεί tab «Μηνιαίο ' + Y + '» με στήλη A τις γραμμές: ' + lines.join(' · ') + ' — και μία γραμμή με Ιαν…Δεκ. ' +
      'Τα σύνολα (ΣΥΝΟΛΟ ΕΣΟΔΩΝ/ΕΞΟΔΩΝ, ΚΕΡΔΟΣ) υπολογίζονται μόνα τους αν λείπουν.');
  } else {
    var FL = F.lines;
    block('ΠΡΟΒΛΕΨΗ ' + Y + ' (από «' + F.tab + '» του Forecast)', function (l) { return pack(FL[l]); }, 'eur');
    block('ΠΡΑΓΜΑΤΙΚΟ ' + Y + ' (ίδιο με P&L OVERALL)', function (l) { return pack(A[l]); }, 'eur');
    block('ΔΙΑΦΟΡΑ € (πραγματικό − πρόβλεψη)', function (l) {
      return pack(A[l].map(function (x, m) { return x - FL[l][m]; }));
    }, 'eur');
    block('ΔΙΑΦΟΡΑ % (πραγματικό / πρόβλεψη − 1)', function (l) {
      var p = function (a, f) { return f ? a / f - 1 : ''; };
      return { m: A[l].map(function (x, m) { return p(x, FL[l][m]); }), year: p(sum(A[l]), sum(FL[l])), ytd: p(ytd(A[l]), ytd(FL[l])) };
    }, 'pct');
    finNote_(sh, r, 'Θετική διαφορά στα ΕΣΟΔΑ = καλύτερα από την πρόβλεψη · θετική στα ΕΞΟΔΑ = ξοδέψαμε περισσότερα. ' +
      '«ΜΕΧΡΙ» = άθροισμα από Ιανουάριο έως τον τρέχοντα μήνα. Γραμμές του Forecast που βρέθηκαν: ' + F.found + '/' + lines.length +
      (F.unmatched.length ? ' · χωρίς αντιστοιχία (δεν μετράνε): ' + F.unmatched.slice(0, 15).join(' · ') : ''));
  }
  sh.setFrozenColumns(1); sh.setColumnWidth(1, 260); sh.setColumnWidths(2, NC - 1, 95);
}
