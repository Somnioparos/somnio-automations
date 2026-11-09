/**
 * Control Center 2027 — μία σελίδα για το «τι χρειάζεται προσοχή σήμερα».
 *
 * ΜΟΝΟ ΔΙΑΒΑΖΕΙ από τα άλλα αρχεία (δεν γράφει ποτέ σε αυτά):
 *   Config › Health                    — υγεία αυτοματισμών
 *   Master Properties › Properties     — ενεργά ακίνητα (για πληρότητα) · › Έλεγχος
 *   Master File › Bookings / Έλεγχος   — αφίξεις/αναχωρήσεις, επιδόσεις, εκκρεμότητες κρατήσεων
 *   Candy › Εισπράξεις κρατήσεων / Έλεγχος
 *   Owner Ledger › Υπόλοιπα
 *   Owner Invoicing › Τιμολόγηση / Έλεγχος
 *
 * Tabs: «Σήμερα» (πίνακας ελέγχου) · «Εκκρεμότητες» (όλες μαζί, με link στο αρχείο).
 * Αυτόματα κάθε πρωί ~09:10 (μετά από όλα τα άλλα). Email στο ALERT_EMAIL όταν υπάρχει κάτι 🔴
 * (ή κάθε μέρα αν Config CC_DAILY_EMAIL = YES). Config CC_IGNORE: λέξεις που κρύβουν εκκρεμότητες (π.χ. AMA).
 */

var CC = { DASH: 'Σήμερα', LIST: 'Εκκρεμότητες' };
var CC_CONFIG_ID = '1HXN0zCu9pBffeACgyu4oWjJkF3JhPEwY_sPcnlOVIsU';
var CC_DAILY_JOBS = ['Master File · Sync', 'Candy · Καθημερινό', 'Financials · Pull', 'Owner Ledger · Ενημέρωση', 'Owner Invoicing · Ενημέρωση'];
var CC_STALE_HOURS = 26;
var CC_NAVY = '#202D5D', CC_SECTION = '#DCE6F7';
var CC_MONTHS = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
var CC_SOURCES = [
  // [κλειδί Config, όνομα, tab ελέγχου, πώς διαβάζονται οι στήλες του]
  ['FILE_MASTER_PROPERTIES', 'Master Properties', 'Έλεγχος', function (r) { return [r[0], '', r[1]]; }],
  ['FILE_MASTER_FILE', 'Master File', 'Έλεγχος', function (r) { return [r[0], r[1], r[2]]; }],
  ['FILE_CANDY', 'Candy', 'Έλεγχος', function (r) { return [[r[0], r[1]].filter(String).join(' · '), '', r[2]]; }],
  ['FILE_OWNER_INVOICING', 'Owner Invoicing', 'Έλεγχος', function (r) { return [[r[0], r[2]].filter(String).join(' · '), r[1], r[3]]; }]
];

// -- ΒΟΗΘΗΤΙΚΑ -----------------------------------------------------------------------

function ccDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v) ? null : v;
  var s = String(v || ''), m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var g = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  return g ? new Date(+g[3], +g[2] - 1, +g[1], +(g[4] || 0), +(g[5] || 0)) : null;
}
function ccNum_(v) {
  if (typeof v === 'number') return v;
  var s = String(v === null || v === undefined ? '' : v).replace(/[€\s]/g, '');
  if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
  var n = Number(s); return isNaN(n) ? 0 : n;
}
function ccR2_(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function ccDay_(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function ccSame_(a, b) { return a && b && ccDay_(a).getTime() === ccDay_(b).getTime(); }
function ccEuro_(n) {
  var x = ccR2_(n), neg = x < 0; x = Math.abs(x);
  var p = x.toFixed(2).split('.'); return (neg ? '−' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1] + ' €';
}
function ccUrl_(id) { return id ? 'https://docs.google.com/spreadsheets/d/' + id + '/edit' : ''; }
function ccLink_(id, label) { return id ? '=HYPERLINK("' + ccUrl_(id) + '","' + String(label || 'Άνοιγμα').replace(/"/g, '') + '")' : ''; }

/** Πίνακας με headers στη γραμμή 1 → αντικείμενα. */
function ccTable_(ss, name) {
  var sh = ss && ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return [];
  var m = SomnioCore.headerMap(sh), v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return v.map(function (r) { var o = {}; for (var k in m) o[k] = r[m[k]]; return o; });
}
/** Γραμμές ενός tab «Έλεγχος»: από τη 2η μέχρι την πρώτη κενή. */
function ccCheckRows_(ss, name) {
  var sh = ss && ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 4)).getValues(), out = [];
  for (var i = 0; i < v.length; i++) {
    if (!v[i].some(function (c) { return String(c).trim() !== ''; })) break;
    if (v[i].some(function (c) { return /Καμία εκκρεμότητα/.test(String(c)); })) continue;
    out.push(v[i]);
  }
  return out;
}
function ccOpen_(key) {
  var id = String(SomnioCore.cfg(key, false) || '').trim();
  if (!id) return { id: '', ss: null, err: 'δεν έχει οριστεί στο Config (' + key + ')' };
  try { return { id: id, ss: SpreadsheetApp.openById(id), err: '' }; } catch (e) { return { id: id, ss: null, err: e.message }; }
}

// -- ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ: δεδομένα → πίνακας ελέγχου ------------------------------------

/**
 * d = { now, year, health:[[job,last,status,detail,lastOk]], bookings:[{}], activeProps:n,
 *       checks:[{src, id, rows:[[about,date,text]]}], owners:[{}], receipts:[{}], invoices:[{}], ignore:[λέξεις], ids:{} }
 */
function ccBuild_(d) {
  var now = d.now, today = ccDay_(now), tomorrow = new Date(today.getTime() + 864e5);
  var alerts = [], issues = [];
  var ign = (d.ignore || []).map(function (w) { return String(w).trim().toLowerCase(); }).filter(String);
  var hidden = function (t) { t = String(t).toLowerCase(); return ign.some(function (w) { return t.indexOf(w) > -1; }); };
  var add = function (lvl, src, about, date, text, id) { if (!hidden(text)) issues.push([lvl, src, about, date || '', text, id || '']); };

  // 1. Υγεία
  var health = d.health.map(function (h) {
    var last = ccDate_(h[1]), st = String(h[2] || ''), daily = CC_DAILY_JOBS.indexOf(h[0]) > -1;
    var sig = '🟢', note = '';
    if (st === 'ERROR') { sig = '🔴'; note = 'Απέτυχε'; }
    else if (daily && (!last || (now - last) / 36e5 > CC_STALE_HOURS)) { sig = '🟠'; note = 'Δεν έτρεξε το τελευταίο 24ωρο'; }
    if (sig !== '🟢') add(sig, 'Αυτοματισμοί', h[0], last, note + (h[3] ? ' — ' + String(h[3]).slice(0, 200) : ''), d.ids.config);
    return [sig, h[0], last || '', st, String(h[3] || '').slice(0, 160), daily ? 'καθημερινό' : ''];
  });
  CC_DAILY_JOBS.forEach(function (j) {
    if (!d.health.some(function (h) { return h[0] === j; })) {
      add('🟠', 'Αυτοματισμοί', j, '', 'Δεν έχει τρέξει ποτέ (δεν υπάρχει στο Health)', d.ids.config);
      health.push(['🟠', j, '', '', 'Δεν έχει τρέξει ποτέ', 'καθημερινό']);
    }
  });
  health.sort(function (a, b) { var o = { '🔴': 0, '🟠': 1, '🟢': 2 }; return o[a[0]] - o[b[0]] || (b[5] ? 1 : 0) - (a[5] ? 1 : 0); });

  // 2. Αφίξεις / αναχωρήσεις σήμερα & αύριο
  var live = d.bookings.filter(function (b) { return b['Status'] !== 'Ακυρωμένη' && !b['cancelled_at']; });
  var moves = [];
  live.forEach(function (b) {
    var ci = ccDate_(b['Check_in']), co = ccDate_(b['Check_out']);
    var row = function (when, kind) {
      return [when, kind, b['Residence'], b['Guest name'], b['Guests'] || '', b['Platform'] || b['Source'] || '',
        kind === 'Άφιξη' ? (String(b['Passport_AFM'] || '').trim() ? '✓' : '✗ λείπει') : ''];
    };
    if (ccSame_(ci, today)) moves.push(row('Σήμερα', 'Άφιξη'));
    if (ccSame_(co, today)) moves.push(row('Σήμερα', 'Αναχώρηση'));
    if (ccSame_(ci, tomorrow)) moves.push(row('Αύριο', 'Άφιξη'));
    if (ccSame_(co, tomorrow)) moves.push(row('Αύριο', 'Αναχώρηση'));
  });
  moves.sort(function (a, b) { return (a[0] === b[0] ? 0 : a[0] === 'Σήμερα' ? -1 : 1) || (a[1] === b[1] ? 0 : a[1] === 'Αναχώρηση' ? -1 : 1); });
  moves.forEach(function (m) { if (m[1] === 'Άφιξη' && /λείπει/.test(m[6])) alerts.push('🟠 ' + m[0] + ' άφιξη χωρίς διαβατήριο: ' + m[2] + ' · ' + m[3]); });

  // 3. Εκκρεμότητες από τα tabs «Έλεγχος»
  d.checks.forEach(function (c) {
    if (c.err) { add('🔴', c.src, '', '', 'Δεν διαβάστηκε: ' + c.err, c.id); return; }
    c.rows.forEach(function (r) { add('🟡', c.src, r[0], ccDate_(r[1]) || r[1], r[2], c.id); });
  });

  // 4. Χρήματα
  var money = [];
  var own = { due: 0, over: 0, fut: 0, weOwe: 0, overN: [] };
  d.owners.forEach(function (o) {
    var name = String(o['Ιδιοκτήτης'] || ''); if (!name || name === 'ΣΥΝΟΛΟ') return;
    own.due += ccNum_(o['Μας χρωστάει σήμερα']); own.fut += ccNum_(o['Μελλοντικές προμήθειες']); own.weOwe += ccNum_(o['Τους χρωστάμε (Direct Cash)']);
    var ov = ccNum_(o['εκ των οποίων > 30 ημερών']); own.over += ov;
    if (ov > 0.009) { own.overN.push(name); add('🟠', 'Owner Ledger', name, '', 'Οφειλή > 30 ημερών: ' + ccEuro_(ov), d.ids.ledger); }
    if (ccNum_(o['Τους χρωστάμε (Direct Cash)']) > 0.009) add('🟡', 'Owner Ledger', name, '', 'Χρωστάμε στον ιδιοκτήτη (Direct Cash): ' + ccEuro_(o['Τους χρωστάμε (Direct Cash)']), d.ids.ledger);
  });
  var rc = { unpaidN: 0, unpaid: 0, overdueN: 0, giveN: 0, give: 0 };
  d.receipts.forEach(function (r) {
    var st = r['Κατάσταση'], co = ccDate_(r['Check-out']);
    if (st === 'Απλήρωτη') {
      rc.unpaidN++; rc.unpaid += ccNum_(r['Ποσό']) || ccNum_(r['Αναμενόμενο']);
      if (co && (today - co) / 864e5 > 14) { rc.overdueN++; add('🟠', 'Candy · Εισπράξεις', r['Ακίνητο'] + ' · ' + r['Επισκέπτης'], ccDate_(r['Check-in']), 'Απλήρωτη > 14 μέρες μετά το check-out · ' + (r['Μας χρωστάει'] || '') + ' ' + ccEuro_(ccNum_(r['Ποσό']) || ccNum_(r['Αναμενόμενο'])), d.ids.candy); }
    }
    if (st === 'Προς απόδοση') { rc.giveN++; rc.give += ccNum_(r['Δίνουμε στον ιδιοκτήτη']); add('🟡', 'Candy · Εισπράξεις', r['Ακίνητο'] + ' · ' + r['Επισκέπτης'], ccDate_(r['Check-in']), 'Να αποδοθούν στον ιδιοκτήτη ' + ccEuro_(r['Δίνουμε στον ιδιοκτήτη']), d.ids.candy); }
  });
  var iv = { ready: 0, unsent: 0, nomark: 0, mdErr: 0, waiting: 0 };
  d.invoices.forEach(function (r) {
    var st = r['Κατάσταση'], mk = String(r['ΜΑΡΚ'] || ''), about = r['Ακίνητο'] + ' · ' + r['Επισκέπτης'];
    if (st === 'Έτοιμο για έκδοση') { iv.ready++; add('🟡', 'Owner Invoicing', about, ccDate_(r['Check-in']), 'Έτοιμο για έκδοση', d.ids.invoicing); }
    if (st === 'Λείπουν στοιχεία') iv.waiting++;
    if (/⚠/.test(mk)) { iv.mdErr++; add('🔴', 'Owner Invoicing', about, ccDate_(r['Check-in']), 'Λάθος myDATA: ' + mk, d.ids.invoicing); }
    else if (r['Αρ. παραστατικού'] && !/^\d{10,}$/.test(mk)) { iv.nomark++; add('🟠', 'Owner Invoicing', about, ccDate_(r['Check-in']), r['Αρ. παραστατικού'] + ' χωρίς ΜΑΡΚ', d.ids.invoicing); }
    else if (r['Αρ. παραστατικού'] && !r['Email στάλθηκε']) { iv.unsent++; add('🟡', 'Owner Invoicing', about, ccDate_(r['Check-in']), r['Αρ. παραστατικού'] + ' εκδόθηκε — δεν έχει σταλεί email', d.ids.invoicing); }
  });
  money.push(['Ιδιοκτήτες μας χρωστάνε σήμερα', ccR2_(own.due), own.over > 0.009 ? 'εκ των οποίων ' + ccEuro_(own.over) + ' > 30 ημερών (' + own.overN.join(', ') + ')' : '', d.ids.ledger]);
  money.push(['Μελλοντικές προμήθειες (κρατήσεις που έρχονται)', ccR2_(own.fut), '', d.ids.ledger]);
  money.push(['Χρωστάμε σε ιδιοκτήτες (Direct Cash)', ccR2_(own.weOwe), '', d.ids.ledger]);
  money.push(['Απλήρωτες εισπράξεις κρατήσεων', ccR2_(rc.unpaid), rc.unpaidN + ' κρατήσεις' + (rc.overdueN ? ' · ' + rc.overdueN + ' > 14 μέρες μετά το check-out' : ''), d.ids.candy]);
  money.push(['Να αποδοθούν σε ιδιοκτήτες', ccR2_(rc.give), rc.giveN + ' κρατήσεις', d.ids.candy]);
  money.push(['Τιμολόγια ιδιοκτητών', iv.ready, 'έτοιμα για έκδοση · ' + iv.unsent + ' χωρίς email · ' + iv.nomark + ' χωρίς ΜΑΡΚ · ' + iv.waiting + ' περιμένουν στοιχεία', d.ids.invoicing]);

  // 5. Επιδόσεις έτους (ανά μήνα check-in)
  var perf = [], tot = { n: 0, nights: 0, gross: 0, rev: 0, days: 0 };
  for (var mo = 0; mo < 12; mo++) {
    var days = new Date(d.year, mo + 1, 0).getDate(), x = { n: 0, nights: 0, gross: 0, rev: 0 };
    live.forEach(function (b) {
      var ci = ccDate_(b['Check_in']); if (!ci || ci.getFullYear() !== d.year || ci.getMonth() !== mo) return;
      x.n++; x.nights += ccNum_(b['Nights']); x.gross += ccNum_(b['Total value']); x.rev += ccNum_(b['Company_Revenue']);
    });
    var occ = d.activeProps ? x.nights / (d.activeProps * days) : 0;
    perf.push([CC_MONTHS[mo], x.n, x.nights, occ, ccR2_(x.gross), ccR2_(x.rev)]);
    tot.n += x.n; tot.nights += x.nights; tot.gross += x.gross; tot.rev += x.rev; tot.days += days;
  }
  perf.push(['ΣΥΝΟΛΟ ' + d.year, tot.n, tot.nights, d.activeProps ? tot.nights / (d.activeProps * tot.days) : 0, ccR2_(tot.gross), ccR2_(tot.rev)]);

  // Τι χρειάζεται προσοχή (σύνοψη)
  var cnt = function (lvl) { return issues.filter(function (i) { return i[0] === lvl; }).length; };
  issues.filter(function (i) { return i[0] === '🔴'; }).forEach(function (i) { alerts.unshift('🔴 ' + [i[1], i[2]].filter(String).join(' · ') + ': ' + i[4]); });
  if (own.over > 0.009) alerts.push('🟠 Οφειλές ιδιοκτητών > 30 ημερών: ' + ccEuro_(own.over));
  if (rc.overdueN) alerts.push('🟠 ' + rc.overdueN + ' απλήρωτες κρατήσεις > 14 μέρες μετά το check-out');
  if (iv.ready) alerts.push('🟡 ' + iv.ready + ' τιμολόγια έτοιμα για έκδοση');
  if (iv.unsent) alerts.push('🟡 ' + iv.unsent + ' τιμολόγια εκδόθηκαν αλλά δεν στάλθηκαν');
  if (iv.nomark) alerts.push('🟠 ' + iv.nomark + ' τιμολόγια χωρίς ΜΑΡΚ');
  health.filter(function (h) { return h[0] === '🟠'; }).forEach(function (h) { alerts.push('🟠 ' + h[1] + ': ' + (h[4] || 'δεν έτρεξε το τελευταίο 24ωρο')); });
  var other = cnt('🟡');
  if (other) alerts.push('🟡 ' + other + ' μικρότερες εκκρεμότητες συνολικά (δες «' + CC.LIST + '»)');
  // μοναδικά, με τη σειρά 🔴 → 🟠 → 🟡
  var seen = {}; alerts = alerts.filter(function (a) { if (seen[a]) return false; seen[a] = 1; return true; });
  alerts.sort(function (a, b) { var o = { '🔴': 0, '🟠': 1, '🟡': 2 }; return o[a.slice(0, 2)] - o[b.slice(0, 2)]; });

  var ord = { '🔴': 0, '🟠': 1, '🟡': 2 };
  issues.sort(function (a, b) {
    return ord[a[0]] - ord[b[0]] || String(a[1]).localeCompare(String(b[1])) ||
      ((a[3] instanceof Date ? a[3].getTime() : 9e15) - (b[3] instanceof Date ? b[3].getTime() : 9e15));
  });
  return { alerts: alerts, moves: moves, money: money, perf: perf, health: health, issues: issues, red: cnt('🔴'), orange: cnt('🟠'), yellow: cnt('🟡') };
}

// -- ΔΙΑΒΑΣΜΑ ------------------------------------------------------------------------

function ccGather_() {
  var now = new Date(), ids = {}, checks = [];
  var cfgSs = SpreadsheetApp.openById(CC_CONFIG_ID); ids.config = CC_CONFIG_ID;
  var hs = cfgSs.getSheetByName('Health');
  var health = hs && hs.getLastRow() > 1 ? hs.getRange(2, 1, hs.getLastRow() - 1, 5).getValues().filter(function (r) { return r[0]; }) : [];

  var mp = ccOpen_('FILE_MASTER_PROPERTIES'), mf = ccOpen_('FILE_MASTER_FILE'), cd = ccOpen_('FILE_CANDY'),
    lg = ccOpen_('FILE_OWNER_LEDGER'), oi = ccOpen_('FILE_OWNER_INVOICING');
  ids.mp = mp.id; ids.mf = mf.id; ids.candy = cd.id; ids.ledger = lg.id; ids.invoicing = oi.id;
  var opened = { FILE_MASTER_PROPERTIES: mp, FILE_MASTER_FILE: mf, FILE_CANDY: cd, FILE_OWNER_INVOICING: oi };
  CC_SOURCES.forEach(function (s) {
    var f = opened[s[0]];
    checks.push({ src: s[1], id: f.id, err: f.ss ? '' : f.err, rows: f.ss ? ccCheckRows_(f.ss, s[2]).map(s[3]) : [] });
  });
  var props = mp.ss ? ccTable_(mp.ss, (mp.ss.getSheetByName('Properties') || mp.ss.getSheets()[0]).getName()) : [];
  var activeProps = props.filter(function (p) { return String(p['Active_2027']).toUpperCase() === 'TRUE'; }).length;

  // Owner Ledger › Υπόλοιπα: τίτλος στη γραμμή 1, headers στη 2
  var owners = [];
  var ls = lg.ss && lg.ss.getSheetByName('Υπόλοιπα');
  if (ls && ls.getLastRow() > 2) {
    var lm = SomnioCore.headerMap(ls, 2);
    ls.getRange(3, 1, ls.getLastRow() - 2, ls.getLastColumn()).getValues().forEach(function (r) {
      if (!String(r[0] || '').trim()) return; var o = {}; for (var k in lm) o[k] = r[lm[k]]; owners.push(o);
    });
  }
  return {
    now: now, year: Number(SomnioCore.cfg('YEAR', false)) || now.getFullYear(), ids: ids, health: health,
    bookings: mf.ss ? ccTable_(mf.ss, 'Bookings') : [], activeProps: activeProps, checks: checks, owners: owners,
    receipts: cd.ss ? ccTable_(cd.ss, 'Εισπράξεις κρατήσεων') : [], invoices: oi.ss ? ccTable_(oi.ss, 'Τιμολόγηση') : [],
    ignore: String(SomnioCore.cfg('CC_IGNORE', false) || '').split(',')
  };
}

// -- ΓΡΑΨΙΜΟ -------------------------------------------------------------------------

function ccWrite_(ss, d, res) {
  var tz = String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens'), W = 7;
  var sh = ss.getSheetByName(CC.DASH) || ss.insertSheet(CC.DASH, 0);
  sh.clear(); sh.setConditionalFormatRules([]);
  var rows = [], fmt = [];   // fmt: [γραμμή (1-based), είδος]
  var push = function (r, kind) { while (r.length < W) r.push(''); rows.push(r.slice(0, W)); if (kind) fmt.push([rows.length, kind]); };

  push(['SOMNIO — CONTROL CENTER ' + d.year, '', '', '', '', '', 'ενημέρωση ' + Utilities.formatDate(d.now, tz, 'dd/MM/yyyy HH:mm')], 'title');
  push(['🔴 ' + res.red + '   🟠 ' + res.orange + '   🟡 ' + res.yellow + '   — λεπτομέρειες στο tab «' + CC.LIST + '»'], 'sub');
  push([]);

  push(['1. ΧΡΕΙΑΖΕΤΑΙ ΠΡΟΣΟΧΗ'], 'sec');
  if (!res.alerts.length) push(['🟢 Όλα καλά — καμία εκκρεμότητα.']);
  res.alerts.slice(0, 25).forEach(function (a) { push([a]); });
  if (res.alerts.length > 25) push(['… και ' + (res.alerts.length - 25) + ' ακόμα (δες «' + CC.LIST + '»)']);
  push([]);

  push(['2. ΣΗΜΕΡΑ & ΑΥΡΙΟ — αφίξεις / αναχωρήσεις'], 'sec');
  push(['Πότε', 'Κίνηση', 'Ακίνητο', 'Επισκέπτης', 'Άτομα', 'Πλατφόρμα', 'Διαβατήριο'], 'head');
  if (!res.moves.length) push(['—', 'Καμία άφιξη ή αναχώρηση σήμερα / αύριο']);
  res.moves.forEach(function (m) { push(m); });
  push([]);

  push(['3. ΧΡΗΜΑΤΑ'], 'sec');
  push(['', 'Ποσό / πλήθος', 'Σημείωση', '', '', '', 'Αρχείο'], 'head');
  var moneyStart = rows.length + 1;
  res.money.forEach(function (m) { push([m[0], m[1], m[2], '', '', '', ccLink_(m[3])]); });
  var moneyEnd = rows.length;
  push([]);

  push(['4. ΕΠΙΔΟΣΕΙΣ ' + d.year + ' (ανά μήνα check-in · ακυρωμένες εκτός)'], 'sec');
  push(['Μήνας', 'Κρατήσεις', 'Νύχτες', 'Πληρότητα', 'Τζίρος (Total value)', 'Έσοδο Somnio', ''], 'head');
  var perfStart = rows.length + 1;
  res.perf.forEach(function (p, i) { push(p, i === 12 ? 'total' : (d.now.getFullYear() === d.year && d.now.getMonth() === i ? 'now' : null)); });
  var perfEnd = rows.length;
  push(['Πληρότητα = νύχτες ÷ (ενεργά ακίνητα ' + d.activeProps + ' × μέρες μήνα). Αναλυτικά: Financials.'], 'note');
  push([]);

  push(['5. ΥΓΕΙΑ ΑΥΤΟΜΑΤΙΣΜΩΝ (Config › Health)'], 'sec');
  push(['', 'Εργασία', 'Τελευταίο τρέξιμο', 'Status', 'Λεπτομέρειες', '', 'Είδος'], 'head');
  var hStart = rows.length + 1;
  res.health.forEach(function (h) { push([h[0], h[1], h[2], h[3], h[4], '', h[5]]); });
  var hEnd = rows.length;
  push([]);
  push(['Αρχεία: ', ccLink_(d.ids.mp, 'Master Properties'), ccLink_(d.ids.mf, 'Master File'), ccLink_(d.ids.candy, 'Candy'),
    ccLink_(d.ids.ledger, 'Owner Ledger'), ccLink_(d.ids.invoicing, 'Owner Invoicing'), ccLink_(d.ids.config, 'Config')], 'links');

  sh.getRange(1, 1, rows.length, W).setValues(rows);
  sh.getRange(1, 1, rows.length, W).setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
  fmt.forEach(function (f) {
    var r = sh.getRange(f[0], 1, 1, W);
    if (f[1] === 'title') r.setFontSize(14).setFontWeight('bold').setFontColor('#FFFFFF').setBackground(CC_NAVY);
    if (f[1] === 'sub') r.setFontColor('#555555');
    if (f[1] === 'sec') r.setFontWeight('bold').setBackground(CC_SECTION).setFontColor(CC_NAVY);
    if (f[1] === 'head') r.setFontWeight('bold').setFontColor('#555555').setBackground('#F3F3F3');
    if (f[1] === 'total') r.setFontWeight('bold').setBackground('#F3F3F3');
    if (f[1] === 'now') r.setBackground('#FFF2CC');
    if (f[1] === 'note') r.setFontStyle('italic').setFontSize(9).setFontColor('#777777');
  });
  if (moneyEnd >= moneyStart) sh.getRange(moneyStart, 2, moneyEnd - moneyStart, 1).setNumberFormat('#,##0.00 €');
  sh.getRange(perfStart, 4, perfEnd - perfStart + 1, 1).setNumberFormat('0.0%');
  sh.getRange(perfStart, 5, perfEnd - perfStart + 1, 2).setNumberFormat('#,##0 €');
  if (hEnd >= hStart) sh.getRange(hStart, 3, hEnd - hStart + 1, 1).setNumberFormat('dd/MM HH:mm');
  sh.setColumnWidth(1, 300); sh.setColumnWidth(2, 190); sh.setColumnWidth(3, 170); sh.setColumnWidth(4, 160);
  sh.setColumnWidth(5, 280); sh.setColumnWidth(6, 110); sh.setColumnWidth(7, 150);
  sh.setFrozenRows(2); sh.setHiddenGridlines(true);

  // --- Εκκρεμότητες
  var ls = ss.getSheetByName(CC.LIST) || ss.insertSheet(CC.LIST, 1);
  ls.clear();
  var H = ['', 'Πηγή', 'Αφορά', 'Ημ/νία', 'Εκκρεμότητα', 'Αρχείο'];
  var L = [H].concat(res.issues.map(function (i) { return [i[0], i[1], String(i[2] || ''), i[3], String(i[4] || ''), ccLink_(i[5])]; }));
  if (L.length === 1) L.push(['🟢', '', '', '', 'Καμία εκκρεμότητα ✓', '']);
  ls.getRange(1, 1, L.length, H.length).setValues(L);
  ls.getRange(1, 1, 1, H.length).setFontWeight('bold').setBackground(CC_NAVY).setFontColor('#FFFFFF');
  ls.getRange(2, 4, L.length - 1, 1).setNumberFormat('dd/MM/yyyy');
  ls.setFrozenRows(1); ls.setColumnWidth(1, 36); ls.setColumnWidth(2, 150); ls.setColumnWidth(3, 260); ls.setColumnWidth(4, 90);
  ls.setColumnWidth(5, 520); ls.setColumnWidth(6, 90);
  ls.getRange(2, 5, L.length - 1, 1).setWrap(true);
}

// -- ΕΝΤΟΛΕΣ -------------------------------------------------------------------------

function ccSs_() {
  var ss = null; try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  return ss || SomnioCore.openFile('FILE_CONTROL_CENTER');
}

/** Αποθηκεύει τα αποτελέσματα ως JSON σε κρυφό tab «_web», για τη σελίδα-εφαρμογή (WebApp.gs). */
function ccSaveWeb_(ss, d, res) {
  var tz = String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens');
  var f = function (v, p) { return v instanceof Date ? Utilities.formatDate(v, tz, p || 'dd/MM/yyyy') : v; };
  var out = {
    updated: Utilities.formatDate(d.now, tz, 'dd/MM/yyyy HH:mm'), year: d.year, activeProps: d.activeProps,
    red: res.red, orange: res.orange, yellow: res.yellow, alerts: res.alerts, moves: res.moves,
    money: res.money.map(function (m) { return [m[0], m[1], m[2], ccUrl_(m[3])]; }),
    perf: res.perf, nowMonth: d.now.getFullYear() === d.year ? d.now.getMonth() : -1,
    health: res.health.map(function (h) { return [h[0], h[1], f(h[2], 'dd/MM HH:mm'), h[3], h[4], h[5]]; }),
    issues: res.issues.map(function (i) { return [i[0], i[1], String(i[2] || ''), f(i[3]), String(i[4] || ''), ccUrl_(i[5])]; }),
    files: [['Master Properties', ccUrl_(d.ids.mp)], ['Master File', ccUrl_(d.ids.mf)], ['Candy', ccUrl_(d.ids.candy)],
      ['Owner Ledger', ccUrl_(d.ids.ledger)], ['Owner Invoicing', ccUrl_(d.ids.invoicing)], ['Config', ccUrl_(d.ids.config)]]
  };
  var sh = ss.getSheetByName('_web') || ss.insertSheet('_web');
  sh.clear(); sh.getRange(1, 1).setValue(JSON.stringify(out).slice(0, 49000)); sh.hideSheet();
  return out;
}

/** Ενημέρωση χωρίς παράθυρα (για τη σελίδα-εφαρμογή). Επιστρέφει τα νέα δεδομένα. */
function ccRefresh_() {
  var web = null;
  var ok = SomnioCore.runJob('Control Center · Ενημέρωση', function () {
    var ss = ccSs_(), d = ccGather_(), res = ccBuild_(d);
    ccWrite_(ss, d, res); web = ccSaveWeb_(ss, d, res);
    return { count: res.issues.length, detail: '(από την εφαρμογή) 🔴 ' + res.red + ' · 🟠 ' + res.orange + ' · 🟡 ' + res.yellow };
  });
  if (!ok) throw new Error('Η ενημέρωση απέτυχε — δες το Health στο Config.');
  return web;
}

function updateControlCenter(silent) {
  var res = null, d = null;
  var ok = SomnioCore.runJob('Control Center · Ενημέρωση', function () {
    d = ccGather_();
    res = ccBuild_(d);
    var ss = ccSs_();
    ccWrite_(ss, d, res);
    ccSaveWeb_(ss, d, res);
    var mail = String(SomnioCore.cfg('CC_DAILY_EMAIL', false) || '').toUpperCase() === 'YES';
    if (silent && (res.red || mail)) {
      SomnioCore.alert((res.red ? '🔴 ' + res.red + ' θέματα' : 'Ημερήσια εικόνα') + ' — Control Center',
        res.alerts.join('\n') + '\n\nΆνοιγμα: ' + (ccAppUrl_() || ccUrl_(String(SomnioCore.cfg('FILE_CONTROL_CENTER', false) || ''))));
    }
    return { count: res.issues.length, detail: '🔴 ' + res.red + ' · 🟠 ' + res.orange + ' · 🟡 ' + res.yellow + ' · κινήσεις σήμερα/αύριο ' + res.moves.length };
  });
  if (!silent && ok) SpreadsheetApp.getUi().alert('Control Center ενημερώθηκε — 🔴 ' + res.red + ' · 🟠 ' + res.orange + ' · 🟡 ' + res.yellow + '.');
}
function updateControlCenterAuto() { updateControlCenter(true); }

function ccTriggerOn() {
  ccTriggerOff_();
  ScriptApp.newTrigger('updateControlCenterAuto').timeBased().everyDays(1).atHour(9).nearMinute(10)
    .inTimezone(String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens')).create();
  SomnioCore.logRun('Control Center · Αυτόματο', 'OK', '', 'ON 09:10');
  SpreadsheetApp.getUi().alert('Αυτόματη ενημέρωση ON (~09:10 κάθε πρωί).');
}
function ccTriggerOff_() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'updateControlCenterAuto') ScriptApp.deleteTrigger(t); }); }
function ccTriggerOff() { ccTriggerOff_(); SpreadsheetApp.getUi().alert('Αυτόματη ενημέρωση OFF.'); }

function setupControlCenter() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens'));
  try { ss.setSpreadsheetLocale('el_GR'); } catch (e) {}
  var first = ss.getSheets()[0];
  if (!ss.getSheetByName(CC.DASH) && first.getLastRow() === 0) first.setName(CC.DASH);
  updateControlCenter(false);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Control')
    .addItem('1. Στήσιμο / φρεσκάρισμα', 'setupControlCenter')
    .addItem('2. Ενημέρωση τώρα', 'updateControlCenter')
    .addItem('3. Link εφαρμογής (για κινητό)', 'showAppLink')
    .addSeparator()
    .addItem('Αυτόματη ενημέρωση ON (~09:10)', 'ccTriggerOn')
    .addItem('Αυτόματη ενημέρωση OFF', 'ccTriggerOff')
    .addToUi();
}
