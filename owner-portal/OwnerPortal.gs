/**
 * Owner Portal 2027 — μηνιαία κατάσταση (PDF) ανά ιδιοκτήτη, με email, μετά από έγκριση μήνα.
 *
 * ΜΟΝΟ ΔΙΑΒΑΖΕΙ:
 *   Master Properties › Properties   — ακίνητα, ιδιοκτήτης, Owner_Type, Owner_Email, Greeting_Name, Active_2027
 *   Master File › Bookings           — κρατήσεις (μαζί με Direct Cash)
 *   Candy › Έξοδα / Λογαριασμοί      — έξοδα «Χρεώνεται σε: Ιδιοκτήτης»
 *   Owner Ledger › Κινήσεις ιδιοκτητών — εκκαθάριση / υπόλοιπο
 *
 * Tabs: «Μήνες» (✅ έγκριση ανά μήνα) · «Ιδιοκτήτες» (γλώσσα EN/ΕΛ, αποστολή, κοινοποίηση) · «Αποστολές» (ιστορικό) · «Προεπισκόπηση».
 * Κανόνες:
 *   - Ο μήνας της κατάστασης = κρατήσεις με CHECK-OUT μέσα στον μήνα (ολοκληρωμένες διαμονές).
 *   - Εταιρεία → ποσά χωρίς ΦΠΑ (προμήθεια = Comm_Net, έξοδα = Καθαρό). Φυσικό → τελικά ποσά, χωρίς αναφορά σε ΦΠΑ (απόφαση 13/10/2026).
 *   - Αποστολή μόνο για μήνα με ✅. Config PORTAL_MODE = live → στους ιδιοκτήτες· αλλιώς ΔΟΚΙΜΗ (μόνο σε σένα / TEST_EMAIL).
 */

var OP = { MONTHS: 'Μήνες', OWNERS: 'Ιδιοκτήτες', SENT: 'Αποστολές', PREV: 'Προεπισκόπηση' };
var OP_APPROVED = '✅ Εγκρίθηκε';
var OP_NAVY = '#202D5D', OP_CREAM = '#EAE8E3', OP_ACCENT = '#828B8D';
var OP_MONTHS_EL = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
var OP_MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

var OP_T = {
  en: {
    title: 'Monthly Statement', period: 'Period', property: 'Property', properties: 'Properties',
    summary: 'Summary', bookings: 'Bookings', nights: 'Nights', occupancy: 'Occupancy', adr: 'Average nightly rate',
    value: 'Booking value', fees: 'Platform fees', comm: 'Somnio commission', net: 'Net to owner', ytd: 'Year to date',
    month: 'This month', checkin: 'Check-in', checkout: 'Check-out', channel: 'Channel', guest: 'Guest',
    noBookings: 'No completed stays this month.', expenses: 'Expenses on your behalf', date: 'Date', supplier: 'Supplier',
    desc: 'Description', category: 'Category', amount: 'Amount', noExpenses: 'No expenses on your behalf this month.',
    expTotal: 'Total expenses', paidByYou: 'paid by you', settlement: 'Settlement',
    youOwe: 'Amount due to Somnio', weOwe: 'Amount due to you', openItems: 'Open items', item: 'Item', remaining: 'Outstanding',
    paymentsMonth: 'Payments this month', noOpen: 'Nothing outstanding — thank you!', cancelled: 'cancelled (charged)',
    netNote: 'Amounts exclude VAT.', grossNote: '', resultMonth: 'Result after expenses',
    asOf: 'Settlement as of', footer: 'Somnio · Property management · Paros',
    kinds: { 'Προμήθεια κράτησης': 'Booking commission', 'Έξοδο για λογαριασμό σας': 'Expense on your behalf',
      'Direct Cash προς απόδοση': 'Cash collected by Somnio, payable to you', 'Πληρωμή από ιδιοκτήτη': 'Your payment',
      'Απόδοση σε ιδιοκτήτη': 'Payment to you' },
    subject: 'Somnio — monthly statement', hi: 'Dear', bodyIntro: 'Please find attached your statement for',
    bodyDue: 'Amount due to Somnio:', bodyOwe: 'Amount due to you:', bodyEnd: 'For any question just reply to this email.\n\nKind regards,\nSomnio'
  },
  el: {
    title: 'Μηνιαία κατάσταση', period: 'Περίοδος', property: 'Ακίνητο', properties: 'Ακίνητα',
    summary: 'Σύνοψη', bookings: 'Κρατήσεις', nights: 'Νύχτες', occupancy: 'Πληρότητα', adr: 'Μέση τιμή ανά νύχτα',
    value: 'Αξία κρατήσεων', fees: 'Προμήθειες πλατφορμών', comm: 'Προμήθεια Somnio', net: 'Καθαρό για εσάς', ytd: 'Από αρχή έτους',
    month: 'Αυτός ο μήνας', checkin: 'Άφιξη', checkout: 'Αναχώρηση', channel: 'Κανάλι', guest: 'Επισκέπτης',
    noBookings: 'Δεν ολοκληρώθηκαν διαμονές αυτόν τον μήνα.', expenses: 'Έξοδα για λογαριασμό σας', date: 'Ημ/νία', supplier: 'Προμηθευτής',
    desc: 'Περιγραφή', category: 'Κατηγορία', amount: 'Ποσό', noExpenses: 'Δεν υπάρχουν έξοδα για λογαριασμό σας αυτόν τον μήνα.',
    expTotal: 'Σύνολο εξόδων', paidByYou: 'το πληρώσατε εσείς', settlement: 'Εκκαθάριση',
    youOwe: 'Οφειλή προς Somnio', weOwe: 'Οφειλή της Somnio προς εσάς', openItems: 'Ανοιχτά στοιχεία', item: 'Στοιχείο', remaining: 'Υπόλοιπο',
    paymentsMonth: 'Πληρωμές του μήνα', noOpen: 'Δεν υπάρχει εκκρεμότητα — ευχαριστούμε!', cancelled: 'ακύρωση (με χρέωση)',
    netNote: 'Τα ποσά είναι χωρίς ΦΠΑ.', grossNote: '', resultMonth: 'Αποτέλεσμα μετά τα έξοδα',
    asOf: 'Εκκαθάριση στις', footer: 'Somnio · Διαχείριση ακινήτων · Πάρος',
    kinds: { 'Προμήθεια κράτησης': 'Προμήθεια κράτησης', 'Έξοδο για λογαριασμό σας': 'Έξοδο για λογαριασμό σας',
      'Direct Cash προς απόδοση': 'Μετρητά που εισέπραξε η Somnio, προς απόδοση', 'Πληρωμή από ιδιοκτήτη': 'Πληρωμή σας',
      'Απόδοση σε ιδιοκτήτη': 'Απόδοση σε εσάς' },
    subject: 'Somnio — μηνιαία κατάσταση', hi: 'Καλησπέρα', bodyIntro: 'Επισυνάπτουμε τη μηνιαία κατάσταση για',
    bodyDue: 'Οφειλή προς Somnio:', bodyOwe: 'Οφειλή της Somnio προς εσάς:', bodyEnd: 'Για οποιαδήποτε απορία απαντήστε σε αυτό το email.\n\nΜε εκτίμηση,\nSomnio'
  }
};

// -- ΒΟΗΘΗΤΙΚΑ -----------------------------------------------------------------------

function opDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v) ? null : v;
  var s = String(v || ''), m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var g = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return g ? new Date(+g[3], +g[2] - 1, +g[1]) : null;
}
function opNum_(v) {
  if (typeof v === 'number') return v;
  var s = String(v === null || v === undefined ? '' : v).replace(/[€\s]/g, '');
  if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
  var n = Number(s); return isNaN(n) ? 0 : n;
}
function opR2_(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function opKey_(s) { return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
function opEuro_(n) {
  var x = opR2_(n), neg = x < 0; x = Math.abs(x);
  var p = x.toFixed(2).split('.'); return (neg ? '−' : '') + '€' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1];
}
function opDMY_(d) { d = opDate_(d); return d ? ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear() : ''; }
function opEsc_(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function opLang_(v) { return /ελ|el|gr/i.test(String(v || '')) ? 'el' : 'en'; }
function opTable_(ss, name, hdrRow) {
  var sh = ss && ss.getSheetByName(name), h = hdrRow || 1; if (!sh || sh.getLastRow() <= h) return [];
  var m = SomnioCore.headerMap(sh, h), v = sh.getRange(h + 1, 1, sh.getLastRow() - h, sh.getLastColumn()).getValues();
  return v.map(function (r) { var o = {}; for (var k in m) o[k] = r[m[k]]; return o; });
}

// -- ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ: δεδομένα → καταστάσεις ιδιοκτητών -----------------------------

/**
 * d = { year, month (0–11), now, props:[], bookings:[], expenses:[], accounts:[], ledger:[], settings:{ownerKey:{lang, send, cc}} }
 * Επιστρέφει [{ owner, key, type, lang, email, greet, cc, send, props, kpi:{month, ytd}, rows, exp, expTotal, settle }]
 */
function opBuild_(d) {
  var y = d.year, mo = d.month, mStart = new Date(y, mo, 1), mEnd = new Date(y, mo + 1, 0), yStart = new Date(y, 0, 1);
  var days = mEnd.getDate();
  var owners = {}, propOwner = {};
  d.props.forEach(function (p) {
    var res = String(p['Residence'] || '').trim(), ot = String(p['Owner_Type'] || '').trim();
    if (!res || ot === 'Δικό μας' || !ot) return;
    if (String(p['Active_2027']).toUpperCase() === 'FALSE') return;
    var name = String(p['Owner_Name'] || '').trim(); if (!name) return;
    var k = opKey_(name);
    if (!owners[k]) {
      var s = d.settings[k] || {};
      owners[k] = { owner: name, key: k, type: ot, props: [], email: '', greet: '', lang: s.lang || 'en', send: s.send !== false, cc: s.cc || '',
        rows: [], exp: [], kpi: { month: { n: 0, nights: 0, occN: 0, value: 0, fees: 0, comm: 0, net: 0 }, ytd: { n: 0, nights: 0, occN: 0, value: 0, fees: 0, comm: 0, net: 0 } } };
    }
    var O = owners[k];
    O.props.push(res); propOwner[opKey_(res)] = k;
    if (!O.email && p['Owner_Email']) O.email = String(p['Owner_Email']).trim();
    if (!O.greet && p['Greeting_Name']) O.greet = String(p['Greeting_Name']).trim();
    if (ot === 'Εταιρεία') O.type = 'Εταιρεία';
  });
  var ownerOfRes = function (res) { var k = propOwner[opKey_(res)]; return k ? owners[k] : null; };
  var overlap = function (ci, co, a, b) {   // νύχτες της διαμονής μέσα στο [a, b]
    if (!ci || !co) return 0; var s = Math.max(ci.getTime(), a.getTime()), e = Math.min(co.getTime(), b.getTime() + 864e5);
    return Math.max(0, Math.round((e - s) / 864e5));
  };

  d.bookings.forEach(function (b) {
    var O = ownerOfRes(b['Residence']); if (!O) return;
    var ci = opDate_(b['Check_in']), co = opDate_(b['Check_out']); if (!co) return;
    var cancelled = b['Status'] === 'Ακυρωμένη' || !!b['cancelled_at'];
    var value = opNum_(b['Total value']); if (cancelled && !(value > 0)) return;
    var company = O.type === 'Εταιρεία';
    var fees = opNum_(b['Service fee host']) + opNum_(b['Payment charges']);
    var comm = company ? opNum_(b['Comm_Net']) : opNum_(b['Comm_Total']);
    var nights = cancelled ? 0 : opNum_(b['Nights']);
    var net = value - fees - comm;
    var add = function (K, occN) { K.n++; K.nights += nights; K.occN += cancelled ? 0 : occN; K.value += value; K.fees += fees; K.comm += comm; K.net += net; };
    if (co >= mStart && co <= new Date(mEnd.getTime() + 864e5 - 1)) {
      add(O.kpi.month, overlap(ci, co, mStart, mEnd));
      O.rows.push({ ci: ci, co: co, res: b['Residence'], ch: b['Platform'] || b['Source'] || '', guest: String(b['Guest name'] || '').trim(),
        nights: nights, value: value, fees: fees, comm: comm, net: net, cancelled: cancelled });
    }
    if (co >= yStart && co <= new Date(mEnd.getTime() + 864e5 - 1)) add(O.kpi.ytd, overlap(ci, co, yStart, mEnd));
  });

  var accType = {}; d.accounts.forEach(function (a) { accType[opKey_(a['Λογαριασμός'])] = String(a['Τύπος'] || ''); });
  d.expenses.forEach(function (e) {
    if (String(e['Χρεώνεται σε'] || '').trim() !== 'Ιδιοκτήτης') return;
    var O = ownerOfRes(e['Κέντρο κόστους']); if (!O) return;
    var dt = opDate_(e['Ημ/νία']); if (!dt || dt < mStart || dt > mEnd) return;
    var amt = O.type === 'Εταιρεία' ? (opNum_(e['Καθαρό']) || opNum_(e['Σύνολο'])) : opNum_(e['Σύνολο']); if (!amt) return;
    O.exp.push({ date: dt, res: e['Κέντρο κόστους'], sup: e['Προμηθευτής'] || '', desc: e['Περιγραφή'] || '',
      cat: e['Κατηγορία'] || '', amount: amt, own: accType[opKey_(e['Λογαριασμός'])] === 'Ιδιοκτήτης' });
  });

  // Εκκαθάριση από το Owner Ledger (κατάσταση τη στιγμή της δημιουργίας)
  d.ledger.forEach(function (l) {
    var O = owners[opKey_(l['Ιδιοκτήτης'])]; if (!O) return;
    O.settle = O.settle || { open: [], pays: [], due: 0, owe: 0 };
    var kind = String(l['Τι είναι'] || ''), st = String(l['Κατάσταση'] || ''), dt = opDate_(l['Ημ/νία']), rem = opNum_(l['Υπόλοιπο']);
    if (/Πληρωμή από ιδιοκτήτη|Απόδοση σε ιδιοκτήτη/.test(kind)) {
      if (dt && dt >= mStart && dt <= mEnd) O.settle.pays.push({ date: dt, kind: kind, desc: l['Περιγραφή'] || '', amount: opNum_(l['Μας χρωστάει']) || opNum_(l['Τους χρωστάμε']) });
      return;
    }
    if (st === 'Μελλοντικό' || rem <= 0.009) return;
    var toUs = opNum_(l['Μας χρωστάει']) > 0;
    O.settle.open.push({ date: dt, kind: kind, res: l['Ακίνητο'] || '', desc: l['Περιγραφή'] || '', remaining: rem, toUs: toUs });
    if (toUs) O.settle.due += rem; else O.settle.owe += rem;
  });

  return Object.keys(owners).map(function (k) {
    var O = owners[k];
    O.settle = O.settle || { open: [], pays: [], due: 0, owe: 0 };
    O.settle.due = opR2_(O.settle.due); O.settle.owe = opR2_(O.settle.owe);
    ['month', 'ytd'].forEach(function (p) {
      var K = O.kpi[p], span = p === 'month' ? days : Math.round((mEnd - yStart) / 864e5) + 1;
      K.occ = O.props.length ? K.occN / (O.props.length * span) : 0;
      K.adr = K.nights ? K.value / K.nights : 0;
      ['value', 'fees', 'comm', 'net'].forEach(function (f) { K[f] = opR2_(K[f]); });
    });
    O.rows.sort(function (a, b) { return a.co - b.co; });
    O.exp.sort(function (a, b) { return a.date - b.date; });
    O.expTotal = opR2_(O.exp.reduce(function (s, e) { return s + e.amount; }, 0));
    O.settle.open.sort(function (a, b) { return (a.date ? a.date.getTime() : 0) - (b.date ? b.date.getTime() : 0); });
    return O;
  }).sort(function (a, b) { return a.owner.localeCompare(b.owner); });
}

// -- PDF -----------------------------------------------------------------------------

function opHtml_(O, y, mo, now) {
  var T = OP_T[O.lang] || OP_T.en, M = O.lang === 'el' ? OP_MONTHS_EL : OP_MONTHS_EN, K = O.kpi.month, Y = O.kpi.ytd;
  var company = O.type === 'Εταιρεία', e = opEsc_, eur = opEuro_;
  var pct = function (x) { return (x * 100).toFixed(1).replace('.', O.lang === 'el' ? ',' : '.') + '%'; };
  var h = [];
  h.push('<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Helvetica,Arial,sans-serif;color:#1E2230;font-size:10.5pt;margin:0}' +
    '.cover{background:' + OP_NAVY + ';color:#fff;padding:22px 28px}' +
    '.cover .b{font-size:20pt;letter-spacing:3px;font-weight:bold}.cover .t{font-size:13pt;margin-top:6px}.cover .s{font-size:9.5pt;opacity:.8;margin-top:4px}' +
    '.wrap{padding:6px 28px 20px}h2{color:' + OP_NAVY + ';font-size:12pt;border-bottom:2px solid ' + OP_CREAM + ';padding-bottom:4px;margin:18px 0 8px}' +
    'table{width:100%;border-collapse:collapse}th{background:' + OP_CREAM + ';color:' + OP_NAVY + ';font-size:8.5pt;text-align:left;padding:5px}' +
    'td{padding:5px;border-bottom:1px solid #E6E3DC;font-size:9.5pt}td.n,th.n{text-align:right}tr.tot td{font-weight:bold;border-top:2px solid ' + OP_NAVY + '}' +
    '.kpi td{border:0;padding:3px 5px}.kpi .l{color:' + OP_ACCENT + '}.kpi .v{font-weight:bold;text-align:right}' +
    '.box{background:' + OP_CREAM + ';padding:10px 12px;margin-top:6px}.big{font-size:13pt;font-weight:bold;color:' + OP_NAVY + '}' +
    '.note{color:' + OP_ACCENT + ';font-size:8.5pt;margin-top:4px}.foot{color:' + OP_ACCENT + ';font-size:8pt;text-align:center;margin-top:24px}' +
    '</style></head><body>');
  h.push('<div class="cover"><div class="b">SOMNIO</div><div class="t">' + e(T.title) + ' — ' + e(M[mo]) + ' ' + y + '</div>' +
    '<div class="s">' + e(O.owner) + ' · ' + e(O.props.length > 1 ? T.properties : T.property) + ': ' + e(O.props.join(', ')) + '</div></div><div class="wrap">');

  // Σύνοψη
  h.push('<h2>' + e(T.summary) + '</h2><table class="kpi"><tr><td></td><td class="v" style="color:' + OP_ACCENT + '">' + e(T.month) + '</td><td class="v" style="color:' + OP_ACCENT + '">' + e(T.ytd) + '</td></tr>');
  [[T.bookings, K.n, Y.n], [T.nights, K.nights, Y.nights], [T.occupancy, pct(K.occ), pct(Y.occ)], [T.adr, eur(K.adr), eur(Y.adr)],
    [T.value, eur(K.value), eur(Y.value)], [T.fees, eur(-K.fees), eur(-Y.fees)], [T.comm, eur(-K.comm), eur(-Y.comm)], [T.net, eur(K.net), eur(Y.net)]]
    .forEach(function (r, i) { h.push('<tr' + (i === 7 ? ' style="font-weight:bold"' : '') + '><td class="l">' + e(r[0]) + '</td><td class="v">' + r[1] + '</td><td class="v">' + r[2] + '</td></tr>'); });
  h.push('</table>');

  // Κρατήσεις
  h.push('<h2>' + e(T.bookings) + '</h2>');
  if (!O.rows.length) h.push('<div class="note">' + e(T.noBookings) + '</div>');
  else {
    var multi = O.props.length > 1;
    h.push('<table><tr><th>' + e(T.checkin) + '</th><th>' + e(T.checkout) + '</th>' + (multi ? '<th>' + e(T.property) + '</th>' : '') + '<th>' + e(T.channel) + '</th><th>' + e(T.guest) +
      '</th><th class="n">' + e(T.nights) + '</th><th class="n">' + e(T.value) + '</th><th class="n">' + e(T.fees) + '</th><th class="n">' + e(T.comm) + '</th><th class="n">' + e(T.net) + '</th></tr>');
    O.rows.forEach(function (r) {
      h.push('<tr><td>' + opDMY_(r.ci) + '</td><td>' + opDMY_(r.co) + '</td>' + (multi ? '<td>' + e(r.res) + '</td>' : '') + '<td>' + e(r.ch) + '</td><td>' + e(r.guest) +
        (r.cancelled ? ' <i>(' + e(T.cancelled) + ')</i>' : '') + '</td><td class="n">' + r.nights + '</td><td class="n">' + eur(r.value) + '</td><td class="n">' + eur(r.fees) +
        '</td><td class="n">' + eur(r.comm) + '</td><td class="n">' + eur(r.net) + '</td></tr>');
    });
    h.push('<tr class="tot"><td colspan="' + (multi ? 5 : 4) + '"></td><td class="n">' + K.nights + '</td><td class="n">' + eur(K.value) + '</td><td class="n">' + eur(K.fees) +
      '</td><td class="n">' + eur(K.comm) + '</td><td class="n">' + eur(K.net) + '</td></tr></table>');
  }

  // Έξοδα
  h.push('<h2>' + e(T.expenses) + '</h2>');
  if (!O.exp.length) h.push('<div class="note">' + e(T.noExpenses) + '</div>');
  else {
    h.push('<table><tr><th>' + e(T.date) + '</th><th>' + e(T.supplier) + '</th><th>' + e(T.desc) + '</th><th>' + e(T.category) + '</th><th class="n">' + e(T.amount) + '</th></tr>');
    O.exp.forEach(function (x) {
      h.push('<tr><td>' + opDMY_(x.date) + '</td><td>' + e(x.sup) + '</td><td>' + e(x.desc) + (x.own ? ' <i>(' + e(T.paidByYou) + ')</i>' : '') + '</td><td>' + e(x.cat) + '</td><td class="n">' + eur(x.amount) + '</td></tr>');
    });
    h.push('<tr class="tot"><td colspan="4">' + e(T.expTotal) + '</td><td class="n">' + eur(O.expTotal) + '</td></tr></table>');
  }
  h.push('<div class="box">' + e(T.resultMonth) + ': <span class="big">' + eur(K.net - O.expTotal) + '</span></div>');

  // Εκκαθάριση
  var S = O.settle;
  h.push('<h2>' + e(T.settlement) + '</h2><div class="note">' + e(T.asOf) + ' ' + opDMY_(now) + '</div>');
  if (!S.open.length) h.push('<div class="box">' + e(T.noOpen) + '</div>');
  else {
    h.push('<table><tr><th>' + e(T.date) + '</th><th>' + e(T.item) + '</th><th>' + e(T.desc) + '</th><th class="n">' + e(T.youOwe) + '</th><th class="n">' + e(T.weOwe) + '</th></tr>');
    S.open.forEach(function (x) {
      h.push('<tr><td>' + opDMY_(x.date) + '</td><td>' + e(T.kinds[x.kind] || x.kind) + '</td><td>' + e([x.res, x.desc].filter(String).join(' · ')) + '</td><td class="n">' +
        (x.toUs ? eur(x.remaining) : '') + '</td><td class="n">' + (x.toUs ? '' : eur(x.remaining)) + '</td></tr>');
    });
    h.push('<tr class="tot"><td colspan="3"></td><td class="n">' + eur(S.due) + '</td><td class="n">' + eur(S.owe) + '</td></tr></table>');
  }
  if (S.pays.length) {
    h.push('<div class="note" style="margin-top:8px"><b>' + e(T.paymentsMonth) + ':</b> ' + S.pays.map(function (p) {
      return opDMY_(p.date) + ' ' + e(T.kinds[p.kind] || p.kind) + ' ' + eur(p.amount);
    }).join(' · ') + '</div>');
  }
  if (company) h.push('<div class="note">' + e(T.netNote) + '</div>');
  h.push('<div class="foot">' + e(T.footer) + '</div></div></body></html>');
  return h.join('');
}

function opPdf_(html, name) {
  return HtmlService.createHtmlOutput(html).getBlob().getAs('application/pdf').setName(name + '.pdf');
}

function opEmail_(O, y, mo) {
  var T = OP_T[O.lang] || OP_T.en, M = O.lang === 'el' ? OP_MONTHS_EL : OP_MONTHS_EN, S = O.settle;
  var L = [(T.hi + ' ' + (O.greet || O.owner)).trim() + ',', '', T.bodyIntro + ' ' + M[mo] + ' ' + y + ' (' + O.props.join(', ') + ').', ''];
  if (S.due > 0.009) L.push(T.bodyDue + ' ' + opEuro_(S.due));
  if (S.owe > 0.009) L.push(T.bodyOwe + ' ' + opEuro_(S.owe));
  if (S.due > 0.009 || S.owe > 0.009) L.push('');
  L.push(T.bodyEnd);
  return { subject: T.subject + ' · ' + M[mo] + ' ' + y + ' · ' + O.props.join(', '), body: L.join('\n') };
}

// -- ΔΙΑΒΑΣΜΑ & ΡΥΘΜΙΣΕΙΣ ------------------------------------------------------------

function opSettings_(ss) {
  var out = {};
  opTable_(ss, OP.OWNERS).forEach(function (r) {
    var k = opKey_(r['Ιδιοκτήτης']); if (!k) return;
    out[k] = { lang: opLang_(r['Γλώσσα']), send: String(r['Αποστολή'] || 'ΝΑΙ').toUpperCase() !== 'ΟΧΙ', cc: String(r['Κοινοποίηση (cc)'] || '').trim() };
  });
  return out;
}

function opGather_(ss, mo) {
  var year = Number(SomnioCore.cfg('YEAR', false)) || new Date().getFullYear();
  var mp = SomnioCore.openFile('FILE_MASTER_PROPERTIES'), mf = SomnioCore.openFile('FILE_MASTER_FILE'),
    cd = SomnioCore.openFile('FILE_CANDY'), lg = SomnioCore.openFile('FILE_OWNER_LEDGER');
  return {
    year: year, month: mo, now: new Date(),
    props: opTable_(mp, (mp.getSheetByName('Properties') || mp.getSheets()[0]).getName()),
    bookings: opTable_(mf, 'Bookings'), expenses: opTable_(cd, 'Έξοδα'), accounts: opTable_(cd, 'Λογαριασμοί'),
    ledger: opTable_(lg, 'Κινήσεις ιδιοκτητών'), settings: opSettings_(ss)
  };
}

function opMonthFolder_(y, mo, sub) {
  var root = DriveApp.getFolderById(String(SomnioCore.cfg('FOLDER_OWNER_PORTAL')).trim());
  var get = function (parent, name) { var it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); };
  var f = get(root, y + '-' + ('0' + (mo + 1)).slice(-2));
  return sub ? get(f, sub) : f;
}

function opLive_() { return String(SomnioCore.cfg('PORTAL_MODE', false) || '').toLowerCase() === 'live'; }

// -- TABS ----------------------------------------------------------------------------

function opSetupTabs_(ss) {
  var year = Number(SomnioCore.cfg('YEAR', false)) || new Date().getFullYear();
  var m = ss.getSheetByName(OP.MONTHS);
  if (!m) {
    var first = ss.getSheets()[0];
    m = first.getLastRow() === 0 ? first.setName(OP.MONTHS) : ss.insertSheet(OP.MONTHS, 0);
    var rows = [['Μήνας', 'Κατάσταση', OP_APPROVED, 'Εγκρίθηκε από', 'Στάλθηκε', 'Σημείωση']];
    OP_MONTHS_EL.forEach(function (n, i) { rows.push([n + ' ' + year, 'Ανοιχτός', false, '', '', '']); });
    m.getRange(1, 1, rows.length, 6).setValues(rows);
    m.getRange(2, 3, 12, 1).insertCheckboxes();
    m.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground(OP_NAVY).setFontColor('#FFFFFF');
    m.getRange(2, 3, 12, 1).setBackground('#FFF8DC'); m.getRange(2, 6, 12, 1).setBackground('#FFF8DC');
    m.setFrozenRows(1); m.setColumnWidth(1, 150); m.setColumnWidth(2, 130); m.setColumnWidth(4, 200); m.setColumnWidth(5, 140); m.setColumnWidth(6, 300);
    m.getRange(1, 3).setNote('Τσέκαρε ΜΟΝΟ αφού ελέγξεις την Προεπισκόπηση. Χωρίς ✅ δεν γίνεται αποστολή.');
  }
  // Ιδιοκτήτες: λίστα από Master Properties, κρατάμε ό,τι έχει γραφτεί
  var o = ss.getSheetByName(OP.OWNERS) || ss.insertSheet(OP.OWNERS, 1);
  var keep = opSettings_(ss), extra = {};
  opTable_(ss, OP.OWNERS).forEach(function (r) { extra[opKey_(r['Ιδιοκτήτης'])] = r['Σημείωση'] || ''; });
  var mp = SomnioCore.openFile('FILE_MASTER_PROPERTIES');
  var props = opTable_(mp, (mp.getSheetByName('Properties') || mp.getSheets()[0]).getName()), list = {};
  props.forEach(function (p) {
    var ot = String(p['Owner_Type'] || ''), n = String(p['Owner_Name'] || '').trim();
    if (!n || ot === 'Δικό μας' || String(p['Active_2027']).toUpperCase() === 'FALSE') return;
    var k = opKey_(n); list[k] = list[k] || { n: n, props: [], email: '' };
    list[k].props.push(p['Residence']); if (!list[k].email && p['Owner_Email']) list[k].email = String(p['Owner_Email']).trim();
  });
  var H = ['Ιδιοκτήτης', 'Ακίνητα', 'Email (από Master Properties)', 'Γλώσσα', 'Αποστολή', 'Κοινοποίηση (cc)', 'Σημείωση'];
  var R = [H].concat(Object.keys(list).sort().map(function (k) {
    var s = keep[k] || {};
    return [list[k].n, list[k].props.join(', '), list[k].email || '⚠ λείπει', s.lang === 'el' ? 'ΕΛ' : 'EN', s.send === false ? 'ΟΧΙ' : 'ΝΑΙ', s.cc || '', extra[k] || ''];
  }));
  o.clear(); o.getRange(1, 1, R.length, H.length).setValues(R);
  o.getRange(1, 1, 1, H.length).setFontWeight('bold').setBackground(OP_NAVY).setFontColor('#FFFFFF');
  if (R.length > 1) {
    o.getRange(2, 4, R.length - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['EN', 'ΕΛ'], true).build()).setBackground('#FFF8DC');
    o.getRange(2, 5, R.length - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['ΝΑΙ', 'ΟΧΙ'], true).build()).setBackground('#FFF8DC');
    o.getRange(2, 6, R.length - 1, 2).setBackground('#FFF8DC');
  }
  o.setFrozenRows(1); o.setColumnWidth(1, 200); o.setColumnWidth(2, 220); o.setColumnWidth(3, 230); o.setColumnWidth(6, 220); o.setColumnWidth(7, 260);
  var s = ss.getSheetByName(OP.SENT) || ss.insertSheet(OP.SENT);
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, 7).setValues([['Πότε', 'Μήνας', 'Ιδιοκτήτης', 'Προς', 'Τρόπος', 'PDF', 'Οφειλή προς Somnio / προς ιδιοκτήτη']])
      .setFontWeight('bold').setBackground(OP_NAVY).setFontColor('#FFFFFF');
    s.setFrozenRows(1);
  }
  return Object.keys(list).length;
}

/** Ρωτάει για μήνα (1–12). Επιστρέφει 0–11 ή null. */
function opAskMonth_(title) {
  var ui = SpreadsheetApp.getUi(), def = new Date().getMonth();   // προεπιλογή: ο προηγούμενος μήνας
  var r = ui.prompt(title, 'Γράψε τον αριθμό του μήνα (1–12). Π.χ. ' + (def || 12) + ' για ' + OP_MONTHS_EL[(def + 11) % 12] + '.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  var n = parseInt(r.getResponseText(), 10);
  if (!(n >= 1 && n <= 12)) { ui.alert('Μη έγκυρος μήνας.'); return null; }
  return n - 1;
}

function opMonthRow_(ss, mo) {
  var m = ss.getSheetByName(OP.MONTHS), hm = SomnioCore.headerMap(m), row = mo + 2;
  return { sh: m, row: row, hm: hm, get: function (c) { return m.getRange(row, hm[c] + 1).getValue(); }, set: function (c, v) { m.getRange(row, hm[c] + 1).setValue(v); } };
}

// -- ΕΝΤΟΛΕΣ -------------------------------------------------------------------------

function setupPortal() {
  var n = 0;
  var ok = SomnioCore.runJob('Owner Portal · Στήσιμο', function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.setSpreadsheetTimeZone(String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens'));
    try { ss.setSpreadsheetLocale('el_GR'); } catch (e) {}
    n = opSetupTabs_(ss);
    return { count: n, detail: 'ιδιοκτήτες ' + n };
  });
  if (ok) SpreadsheetApp.getUi().alert('Στήσιμο ΟΚ — ' + n + ' ιδιοκτήτες στο tab «' + OP.OWNERS + '».\nΔιάλεξε γλώσσα (EN/ΕΛ) για τον καθένα.');
}

/** Φτιάχνει τα PDF του μήνα στον φάκελο «Πρόχειρα» — δεν στέλνει τίποτα. */
function previewMonth() {
  var mo = opAskMonth_('Προεπισκόπηση μήνα'); if (mo === null) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet(), out = [];
  var ok = SomnioCore.runJob('Owner Portal · Προεπισκόπηση', function () {
    opSetupTabs_(ss);
    var d = opGather_(ss, mo), list = opBuild_(d), folder = opMonthFolder_(d.year, mo, 'Πρόχειρα');
    list.forEach(function (O) {
      var name = d.year + '-' + ('0' + (mo + 1)).slice(-2) + ' ' + O.owner + ' (ΠΡΟΧΕΙΡΟ ' + Utilities.formatDate(d.now, 'Europe/Athens', 'dd-MM HH.mm') + ')';
      var url = folder.createFile(opPdf_(opHtml_(O, d.year, mo, d.now), name)).getUrl();
      out.push([O.owner, O.props.join(', '), O.lang === 'el' ? 'ΕΛ' : 'EN', O.email || '⚠ λείπει email', O.rows.length, O.kpi.month.net, O.expTotal,
        O.settle.due, O.settle.owe, O.send ? 'ΝΑΙ' : 'ΟΧΙ', '=HYPERLINK("' + url + '","PDF")']);
    });
    var p = ss.getSheetByName(OP.PREV) || ss.insertSheet(OP.PREV);
    p.clear();
    var H = ['Ιδιοκτήτης', 'Ακίνητα', 'Γλώσσα', 'Email', 'Κρατήσεις μήνα', 'Καθαρό μήνα', 'Έξοδα μήνα', 'Οφειλή προς Somnio', 'Οφειλή προς ιδιοκτήτη', 'Αποστολή', 'PDF'];
    p.getRange(1, 1).setValue('ΠΡΟΕΠΙΣΚΟΠΗΣΗ — ' + OP_MONTHS_EL[mo] + ' ' + d.year + ' · ' + Utilities.formatDate(d.now, ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm') +
      ' · Έλεγξε τα PDF και μετά τσέκαρε ' + OP_APPROVED + ' στο tab «' + OP.MONTHS + '».').setFontWeight('bold');
    p.getRange(2, 1, 1, H.length).setValues([H]).setFontWeight('bold').setBackground(OP_NAVY).setFontColor('#FFFFFF');
    if (out.length) { p.getRange(3, 1, out.length, H.length).setValues(out); p.getRange(3, 6, out.length, 4).setNumberFormat('#,##0.00'); }
    p.setFrozenRows(2); p.setColumnWidth(1, 200); p.setColumnWidth(2, 200); p.setColumnWidth(4, 220);
    var R = opMonthRow_(ss, mo); if (!R.get(OP_APPROVED)) R.set('Κατάσταση', 'Προεπισκόπηση');
    return { count: out.length, detail: OP_MONTHS_EL[mo] + ' ' + d.year + ' · PDF ' + out.length };
  });
  if (ok) { ss.setActiveSheet(ss.getSheetByName(OP.PREV)); SpreadsheetApp.getUi().alert('Έτοιμα ' + out.length + ' PDF (πρόχειρα) — δες το tab «' + OP.PREV + '».\nΔεν στάλθηκε τίποτα.'); }
}

/** Στέλνει τις καταστάσεις ενός εγκεκριμένου μήνα. Δοκιμή: μόνο σε σένα. */
function sendMonth() {
  var ui = SpreadsheetApp.getUi(), mo = opAskMonth_('Αποστολή μήνα'); if (mo === null) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet(), R = opMonthRow_(ss, mo), live = opLive_();
  if (R.get(OP_APPROVED) !== true) { ui.alert('Ο μήνας ' + OP_MONTHS_EL[mo] + ' δεν έχει ' + OP_APPROVED + ' στο tab «' + OP.MONTHS + '».\nΚάνε πρώτα Προεπισκόπηση, έλεγξε τα PDF και τσέκαρε.'); return; }
  if (live && R.get('Στάλθηκε')) { ui.alert('Ο μήνας έχει ήδη σταλεί (' + R.get('Στάλθηκε') + '). Για νέα αποστολή σβήσε την ημερομηνία στη στήλη «Στάλθηκε».'); return; }
  var me = String(SomnioCore.cfg('TEST_EMAIL', false) || '').trim() || Session.getActiveUser().getEmail();
  var d = opGather_(ss, mo), list = opBuild_(d).filter(function (O) { return O.send; });
  var noMail = list.filter(function (O) { return !O.email; }).map(function (O) { return O.owner; });
  var q = (live ? '⚠ ΚΑΝΟΝΙΚΗ ΑΠΟΣΤΟΛΗ στους ιδιοκτήτες.\n\n' : 'ΔΟΚΙΜΗ — όλα τα email πάνε ΜΟΝΟ στο ' + me + '.\n\n') +
    OP_MONTHS_EL[mo] + ' ' + d.year + ' · ' + list.length + ' ιδιοκτήτες' + (noMail.length ? '\nΧωρίς email (δεν θα σταλούν): ' + noMail.join(', ') : '') + '\n\nΝα σταλούν;';
  if (ui.alert('Αποστολή καταστάσεων', q, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var sent = 0;
  var ok = SomnioCore.runJob('Owner Portal · Αποστολή', function () {
    var folder = opMonthFolder_(d.year, mo), log = ss.getSheetByName(OP.SENT), mname = OP_MONTHS_EL[mo] + ' ' + d.year;
    list.forEach(function (O) {
      if (!O.email && live) return;
      var name = d.year + '-' + ('0' + (mo + 1)).slice(-2) + ' ' + O.owner;
      var blob = opPdf_(opHtml_(O, d.year, mo, d.now), name), em = opEmail_(O, d.year, mo);
      var file = live ? folder.createFile(blob) : null;
      var opt = { attachments: [blob], name: 'Somnio' }; if (live && O.cc) opt.cc = O.cc;
      GmailApp.sendEmail(live ? O.email : me, (live ? '' : '[ΔΟΚΙΜΗ → ' + (O.email || 'χωρίς email') + '] ') + em.subject, em.body, opt);
      log.appendRow([new Date(), mname, O.owner, live ? O.email : me, live ? 'κανονικά' : 'δοκιμή', file ? file.getUrl() : '', opR2_(O.settle.due) + ' / ' + opR2_(O.settle.owe)]);
      sent++;
    });
    if (live) { R.set('Στάλθηκε', new Date()); R.set('Κατάσταση', 'Στάλθηκε'); }
    return { count: sent, detail: (live ? '' : 'ΔΟΚΙΜΗ · ') + mname + ' · email ' + sent };
  });
  if (ok) ui.alert((live ? 'Στάλθηκαν ' : 'Δοκιμή: στάλθηκαν στο ' + me + ' ') + sent + ' email.');
}

/** Όταν τσεκάρεται/ξετσεκάρεται το ✅ στο tab Μήνες → ποιος/πότε. (installable onEdit: opInstallEdit) */
function opOnEdit(e) {
  var sh = e && e.range && e.range.getSheet(); if (!sh || sh.getName() !== OP.MONTHS || e.range.getRow() < 2) return;
  var hm = SomnioCore.headerMap(sh); if (e.range.getColumn() !== hm[OP_APPROVED] + 1) return;
  var row = e.range.getRow(), on = e.range.getValue() === true;
  sh.getRange(row, hm['Εγκρίθηκε από'] + 1).setValue(on ? (Session.getActiveUser().getEmail() || 'χρήστης') + ' · ' + Utilities.formatDate(new Date(), 'Europe/Athens', 'dd/MM/yyyy HH:mm') : '');
  if (!sh.getRange(row, hm['Στάλθηκε'] + 1).getValue()) sh.getRange(row, hm['Κατάσταση'] + 1).setValue(on ? 'Εγκρίθηκε' : 'Ανοιχτός');
}
function opInstallEdit() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'opOnEdit') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('opOnEdit').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Portal')
    .addItem('1. Στήσιμο / ενημέρωση λίστας ιδιοκτητών', 'setupPortal')
    .addItem('2. Προεπισκόπηση μήνα (PDF, χωρίς αποστολή)', 'previewMonth')
    .addItem('3. Αποστολή εγκεκριμένου μήνα', 'sendMonth')
    .addSeparator()
    .addItem('Ενεργοποίηση καταγραφής έγκρισης (μία φορά)', 'opInstallEdit')
    .addToUi();
}
