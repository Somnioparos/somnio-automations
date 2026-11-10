/**
 * Proposals 2027 — προτάσεις διαμονής σε πελάτες και agencies.
 *
 * Ροή:  tab «Αίτημα» → 1. Διαθεσιμότητα & τιμές → tab «Ακίνητα» (✅ επιλογή, ✏️ δική μου τιμή)
 *       → 2. Δημιουργία πρότασης (δικό της link + γραμμή στο «Ιστορικό» + κάρτα Trello)
 *       → 3. Αποστολή email (προαιρετικά).
 *
 * Πηγές:
 *   Master Properties › Properties  — χαρακτηριστικά (Listing_ID = Hosthub rental id, Max_Guests, Bedrooms, Bathrooms, Pool, Sea_View, Area, Property_URL)
 *   Master Properties › Agencies    — λίστα agencies
 *   Hosthub (μόνο ανάγνωση)         — /rentals (φωτογραφία) · /rentals/{id}/calendar-events (διαθεσιμότητα) ·
 *                                     /rentals/{id}/rate-plans → /rate-plans/{id}/rates (τιμή ανά νύχτα — τη γράφει η Beyond)
 *
 * Τιμή προσφοράς:  Πελάτης = σύνολο νυχτών Hosthub · Agency = σύνολο × (1 + PROPOSAL_AGENCY_MARKUP, προεπιλογή 10%).
 *                  Η στήλη «✏️ Δική μου τιμή» υπερισχύει.
 * Script Properties: HOSTHUB_API_KEY · (προαιρετικά) TRELLO_KEY, TRELLO_TOKEN.
 * Config: PROPOSAL_AGENCY_MARKUP · TRELLO_LIST_ID · PROPOSAL_WEBAPP_URL (το link /exec της σελίδας πρότασης).
 */

var PR = { REQ: 'Αίτημα', PROPS: 'Ακίνητα', HIST: 'Ιστορικό', TRELLO: 'Trello' };
var PR_NAVY = '#202D5D';
var PR_REQ_FIELDS = [
  ['Τύπος', 'Πελάτης', 'Πελάτης ή Agency'],
  ['Όνομα πελάτη / επαφής', '', 'Όπως θα εμφανίζεται στην πρόταση'],
  ['Agency', '', 'Μόνο αν Τύπος = Agency (λίστα από Master Properties › Agencies)'],
  ['Email', '', 'Για την αποστολή της πρότασης'],
  ['Check-in', '', 'Ημερομηνία'],
  ['Check-out', '', 'Ημερομηνία'],
  ['Άτομα', '', 'Σύνολο ατόμων'],
  ['Ενήλικες', '', ''],
  ['Παιδιά', '', ''],
  ['Budget (σύνολο €)', '', 'Προαιρετικό — σημαδεύει όσα το ξεπερνούν, δεν τα κρύβει'],
  ['Πισίνα', 'ANY', 'ANY · PRIVATE · PRIVATE OR SHARED · NO'],
  ['Θέα θάλασσα', 'ANY', 'ANY · YES · NO'],
  ['Υπνοδωμάτια (ελάχ.)', '', ''],
  ['Μπάνια (ελάχ.)', '', ''],
  ['Μήνυμα στην πρόταση', '', 'Προαιρετικό κείμενο που εμφανίζεται στην αρχή της σελίδας']
];
var PR_COLS = ['Ακίνητο', 'Περιοχή', 'Max άτομα', 'Υπν.', 'Μπάνια', 'Πισίνα', 'Θέα', 'Διαθέσιμο', 'Νύχτες', 'Τιμή Hosthub',
  'Ανά νύχτα', 'Budget', '✅ Επιλογή', 'Τιμή προσφοράς', '✏️ Δική μου τιμή', 'Link', 'Φωτογραφία', 'Rental ID'];
var PR_HIST = ['ID', 'Δημιουργήθηκε', 'Τύπος', 'Πελάτης / Agency', 'Email', 'Check-in', 'Check-out', 'Άτομα', 'Ακίνητα & τιμές',
  'Link πρότασης', 'Email στάλθηκε', 'Trello', 'Κατάσταση', 'Σημείωση', 'Από', '_data'];
var PR_STATUS = ['Ανοιχτή', 'Στάλθηκε', 'Κλείστηκε ✅', 'Χάθηκε ✗'];

// -- ΒΟΗΘΗΤΙΚΑ -----------------------------------------------------------------------

function prKey_() {
  var k = PropertiesService.getScriptProperties().getProperty('HOSTHUB_API_KEY');
  if (!k) throw new Error('Λείπει το HOSTHUB_API_KEY στα Script Properties του Proposals 2027.');
  return k.trim();
}
function prDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  var s = String(v || ''), m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var g = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return g ? new Date(+g[3], +g[2] - 1, +g[1]) : null;
}
function prISO_(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function prDMY_(d) { d = prDate_(d); return d ? ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear() : ''; }
function prNum_(v) { if (typeof v === 'number') return v; var n = Number(String(v || '').replace(/[€\s.]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
function prR2_(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function prEuro_(n) { var p = prR2_(n).toFixed(2).split('.'); return '€' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] === '00' ? '' : ',' + p[1]); }
function prUp_(v) { return String(v || '').trim().toUpperCase(); }
function prTable_(ss, name) {
  var sh = ss && ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return [];
  var m = SomnioCore.headerMap(sh), v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return v.map(function (r) { var o = {}; for (var k in m) o[k] = r[m[k]]; return o; });
}
function prMarkup_() { var m = prNum_(SomnioCore.cfg('PROPOSAL_AGENCY_MARKUP', false)); if (m > 1) m = m / 100; return m || 0.10; }

/** Διαβάζει το tab «Αίτημα» (ετικέτα στη στήλη A, τιμή στη B). */
function prRequest_(ss) {
  var sh = ss.getSheetByName(PR.REQ), v = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 2).getValues(), o = {};
  v.forEach(function (r) { if (r[0]) o[String(r[0]).trim()] = r[1]; });
  var q = {
    type: /agency/i.test(String(o['Τύπος'])) ? 'Agency' : 'Πελάτης', name: String(o['Όνομα πελάτη / επαφής'] || '').trim(),
    agency: String(o['Agency'] || '').trim(), email: String(o['Email'] || '').trim(),
    ci: prDate_(o['Check-in']), co: prDate_(o['Check-out']), guests: prNum_(o['Άτομα']), adults: prNum_(o['Ενήλικες']), children: prNum_(o['Παιδιά']),
    budget: prNum_(o['Budget (σύνολο €)']), pool: prUp_(o['Πισίνα']) || 'ANY', sea: prUp_(o['Θέα θάλασσα']) || 'ANY',
    bedMin: prNum_(o['Υπνοδωμάτια (ελάχ.)']), bathMin: prNum_(o['Μπάνια (ελάχ.)']), message: String(o['Μήνυμα στην πρόταση'] || '').trim()
  };
  if (!q.ci || !q.co) throw new Error('Συμπλήρωσε Check-in και Check-out στο tab «' + PR.REQ + '».');
  if (q.co <= q.ci) throw new Error('Το Check-out πρέπει να είναι μετά το Check-in.');
  if (!(q.guests > 0)) throw new Error('Συμπλήρωσε τα Άτομα στο tab «' + PR.REQ + '».');
  if (q.type === 'Agency' && !q.agency) throw new Error('Τύπος = Agency: διάλεξε Agency στο tab «' + PR.REQ + '».');
  q.nights = Math.round((q.co - q.ci) / 864e5);
  return q;
}

// -- ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ: φίλτρα χαρακτηριστικών ----------------------------------------

/** Επιστρέφει '' αν περνάει, αλλιώς τον λόγο απόρριψης. p = ακίνητο από Master Properties. */
function prFilter_(p, q) {
  var maxG = prNum_(p['Max_Guests']), bed = prNum_(p['Bedrooms']), bath = prNum_(p['Bathrooms']);
  var pool = prUp_(p['Pool']), sea = prUp_(p['Sea_View']);
  if (maxG && q.guests > maxG) return 'ΟΧΙ — χωρητικότητα';
  if (q.bedMin > 0) { if (!bed) return 'ΟΧΙ — λείπει στοιχείο (υπν.)'; if (bed < q.bedMin) return 'ΟΧΙ — υπνοδωμάτια'; }
  if (q.bathMin > 0) { if (!bath) return 'ΟΧΙ — λείπει στοιχείο (μπάνια)'; if (bath < q.bathMin) return 'ΟΧΙ — μπάνια'; }
  if (q.pool && q.pool !== 'ANY') {
    if (!pool) return 'ΟΧΙ — λείπει στοιχείο (πισίνα)';
    if (q.pool === 'PRIVATE' && pool !== 'PRIVATE') return 'ΟΧΙ — πισίνα';
    if ((q.pool === 'PRIVATE OR SHARED' || q.pool === 'YES') && pool === 'NO') return 'ΟΧΙ — πισίνα';
    if (q.pool === 'NO' && pool !== 'NO') return 'ΟΧΙ — πισίνα';
  }
  if (q.sea && q.sea !== 'ANY') {
    if (!sea) return 'ΟΧΙ — λείπει στοιχείο (θέα)';
    if (q.sea === 'YES' && sea !== 'YES') return 'ΟΧΙ — θέα';
    if (q.sea === 'NO' && sea !== 'NO') return 'ΟΧΙ — θέα';
  }
  return '';
}

/** Επικάλυψη με ενεργό event (ακυρωμένα / κρυφά αγνοούνται). */
function prConflict_(events, ci, co) {
  return events.some(function (e) {
    if (!e.date_from || !e.date_to || e.cancelled_at || e.is_visible === false) return false;
    var a = prDate_(e.date_from), b = prDate_(e.date_to);
    return a < co && b > ci;
  });
}

/** Άθροισμα τιμών ανά νύχτα [ci, co). Επιστρέφει { total, found }. */
function prSumRates_(rates, ci, co) {
  var seen = {}, total = 0, found = 0;
  rates.forEach(function (r) {
    var d = prDate_(r.date); if (!d || d < ci || d >= co) return;
    var k = prISO_(d); if (seen[k]) return;
    var c = r.amount && typeof r.amount.cents === 'number' ? r.amount.cents : null;
    if (c === null) return;
    seen[k] = 1; total += c; found++;
  });
  return { total: total / 100, found: found };
}

// -- HOSTHUB -------------------------------------------------------------------------

function prEvents_(rid, ci, key) {
  var url = '/rentals/' + rid + '/calendar-events?limit=100', out = [], prev = '', guard = 0;
  while (url && url !== prev && guard++ < 10) {
    var page = SomnioCore.hosthubGet(url, key), d = page.data || [];
    out = out.concat(d);
    if (!d.length) break;
    // σταματάμε όταν ολόκληρη η σελίδα είναι παλιότερη από το check-in
    if (d.every(function (e) { var b = prDate_(e.date_to); return b && b <= ci; })) break;
    prev = url; url = (page.navigation && page.navigation.previous) || null;
  }
  return out;
}

function prPrice_(rid, ci, co, nights, key) {
  var plans = (SomnioCore.hosthubGet('/rentals/' + rid + '/rate-plans', key).data) || [];
  var plan = plans.filter(function (p) { return p.default === true && p.status === 'active'; })[0];
  if (!plan) return { err: 'Χωρίς βασικό πρόγραμμα τιμών' };
  var url = '/rate-plans/' + plan.id + '/rates?date_from=' + prISO_(ci) + '&date_to=' + prISO_(new Date(co.getTime() - 864e5)), all = [], prev = '', guard = 0, s;
  while (url && url !== prev && guard++ < 12) {
    var page = SomnioCore.hosthubGet(url, key), d = page.data || [];
    all = all.concat(d); s = prSumRates_(all, ci, co);
    if (s.found >= nights || !d.length) break;
    prev = url; url = (page.navigation && (page.navigation.next || page.navigation.previous)) || null;
  }
  s = prSumRates_(all, ci, co);
  if (s.found < nights) return { err: 'Λείπουν τιμές (' + s.found + '/' + nights + ' νύχτες)' };
  return { total: prR2_(s.total) };
}

// -- 1. ΔΙΑΘΕΣΙΜΟΤΗΤΑ & ΤΙΜΕΣ --------------------------------------------------------

function checkAvailability() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi(), n = 0, yes = 0;
  var ok = SomnioCore.runJob('Proposals · Διαθεσιμότητα', function () {
    var q = prRequest_(ss), key = prKey_(), mk = prMarkup_();
    var mp = SomnioCore.openFile('FILE_MASTER_PROPERTIES');
    var props = prTable_(mp, (mp.getSheetByName('Properties') || mp.getSheets()[0]).getName())
      .filter(function (p) { return p['Listing_ID'] && String(p['Active_2027']).toUpperCase() === 'TRUE'; });
    var img = {};
    try { SomnioCore.hosthubRentals(key).forEach(function (r) { img[r.id] = r.image_path || ''; }); } catch (e) {}
    ss.toast('Έλεγχος ' + props.length + ' ακινήτων στη Hosthub… (~1–2 λεπτά)', 'Proposals', 10);
    var rows = props.map(function (p) {
      var rid = String(p['Listing_ID']).trim(), why = prFilter_(p, q), price = '', per = '', avail = why, bud = '';
      if (!why) {
        try { avail = prConflict_(prEvents_(rid, q.ci, key), q.ci, q.co) ? 'ΟΧΙ — κλεισμένο' : 'ΝΑΙ'; }
        catch (e) { avail = 'Σφάλμα Hosthub'; }
        if (avail === 'ΝΑΙ') {
          try { var pr = prPrice_(rid, q.ci, q.co, q.nights, key); if (pr.err) price = pr.err; else { price = pr.total; per = prR2_(pr.total / q.nights); } }
          catch (e2) { price = 'Σφάλμα τιμών'; }
          if (typeof price === 'number' && q.budget > 0) bud = (q.type === 'Agency' ? price * (1 + mk) : price) > q.budget ? '⚠ πάνω από budget' : '✓';
          yes++;
        }
      }
      var offer = typeof price === 'number' ? prR2_(q.type === 'Agency' ? price * (1 + mk) : price) : '';
      n++;
      return [p['Residence'], p['Area'] || '', prNum_(p['Max_Guests']) || '', p['Bedrooms'] || '', p['Bathrooms'] || '', p['Pool'] || '', p['Sea_View'] || '',
        avail, avail === 'ΝΑΙ' ? q.nights : '', price, per, bud, false, offer, '', p['Property_URL'] || '', img[rid] || '', rid];
    });
    rows.sort(function (a, b) { var r = function (x) { return x[7] === 'ΝΑΙ' ? 0 : 1; }; return r(a) - r(b) || String(a[0]).localeCompare(String(b[0])); });
    prWriteProps_(ss, rows, q, mk);
    return { count: yes, detail: prDMY_(q.ci) + '–' + prDMY_(q.co) + ' · ' + q.guests + ' άτ. · διαθέσιμα ' + yes + '/' + n };
  });
  if (ok) { ss.setActiveSheet(ss.getSheetByName(PR.PROPS)); ui.alert('Διαθέσιμα: ' + yes + ' από ' + n + '.\nΤσέκαρε ✅ όσα θέλεις να προτείνεις και μετά «2. Δημιουργία πρότασης».'); }
}

function prWriteProps_(ss, rows, q, mk) {
  var sh = ss.getSheetByName(PR.PROPS) || ss.insertSheet(PR.PROPS, 1);
  sh.clear(); sh.setConditionalFormatRules([]);
  sh.getRange(1, 1).setValue(q.type + (q.agency ? ' · ' + q.agency : '') + ' · ' + (q.name || '—') + ' · ' + prDMY_(q.ci) + ' – ' + prDMY_(q.co) +
    ' · ' + q.nights + ' νύχτες · ' + q.guests + ' άτομα' + (q.type === 'Agency' ? ' · τιμή προσφοράς = Hosthub + ' + Math.round(mk * 100) + '%' : '')).setFontWeight('bold');
  sh.getRange(2, 1, 1, PR_COLS.length).setValues([PR_COLS]).setFontWeight('bold').setBackground(PR_NAVY).setFontColor('#FFFFFF').setWrap(true);
  if (rows.length) {
    sh.getRange(3, 1, rows.length, PR_COLS.length).setValues(rows);
    var c = function (name) { return PR_COLS.indexOf(name) + 1; };
    sh.getRange(3, c('✅ Επιλογή'), rows.length, 1).insertCheckboxes();
    sh.getRange(3, c('Τιμή Hosthub'), rows.length, 2).setNumberFormat('#,##0.00 €');
    sh.getRange(3, c('Τιμή προσφοράς'), rows.length, 2).setNumberFormat('#,##0.00 €');
    sh.getRange(3, c('✅ Επιλογή'), rows.length, 1).setBackground('#FFF8DC');
    sh.getRange(3, c('✏️ Δική μου τιμή'), rows.length, 1).setBackground('#FFF8DC');
    var all = sh.getRange(3, 1, rows.length, PR_COLS.length), L = String.fromCharCode(64 + c('Διαθέσιμο'));
    sh.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + L + '3="ΝΑΙ"').setBackground('#E5F3EA').setRanges([all]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=LEFT($' + L + '3,3)="ΟΧΙ"').setFontColor('#999999').setRanges([all]).build()
    ]);
  }
  sh.setFrozenRows(2); sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 230); sh.setColumnWidth(8, 190); sh.setColumnWidth(12, 130); sh.setColumnWidth(16, 160); sh.setColumnWidth(17, 120);
  sh.hideColumns(PR_COLS.indexOf('Rental ID') + 1);
}

// -- 2. ΔΗΜΙΟΥΡΓΙΑ ΠΡΟΤΑΣΗΣ ----------------------------------------------------------

function createProposal() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi(), link = '', trello = '';
  var ok = SomnioCore.runJob('Proposals · Δημιουργία', function () {
    var q = prRequest_(ss), sh = ss.getSheetByName(PR.PROPS);
    if (!sh || sh.getLastRow() < 3) throw new Error('Τρέξε πρώτα «1. Διαθεσιμότητα & τιμές».');
    var m = SomnioCore.headerMap(sh, 2), v = sh.getRange(3, 1, sh.getLastRow() - 2, sh.getLastColumn()).getValues();
    var sel = v.filter(function (r) { return r[m['✅ Επιλογή']] === true; });
    if (!sel.length) throw new Error('Δεν τσεκάρισες κανένα ακίνητο (στήλη ✅ Επιλογή).');
    var bad = sel.filter(function (r) { return r[m['Διαθέσιμο']] !== 'ΝΑΙ'; }).map(function (r) { return r[m['Ακίνητο']]; });
    if (bad.length) throw new Error('Μη διαθέσιμα αλλά επιλεγμένα: ' + bad.join(', '));
    var items = sel.map(function (r) {
      var own = prNum_(r[m['✏️ Δική μου τιμή']]), auto = prNum_(r[m['Τιμή προσφοράς']]);
      return { name: r[m['Ακίνητο']], area: r[m['Περιοχή']], maxGuests: r[m['Max άτομα']], bedrooms: r[m['Υπν.']], bathrooms: r[m['Μπάνια']],
        pool: r[m['Πισίνα']], seaView: r[m['Θέα']], url: r[m['Link']], image: r[m['Φωτογραφία']], hosthub: prNum_(r[m['Τιμή Hosthub']]),
        price: own > 0 ? prR2_(own) : (auto > 0 ? prR2_(auto) : 0) };
    });
    var id = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    var data = { id: id, type: q.type, name: q.name, agency: q.agency, ci: prISO_(q.ci), co: prISO_(q.co), nights: q.nights, guests: q.guests,
      adults: q.adults, children: q.children, message: q.message, items: items, created: new Date().toISOString() };
    var base = String(SomnioCore.cfg('PROPOSAL_WEBAPP_URL', false) || '').trim() || prAppUrl_();
    link = base ? base + (base.indexOf('?') > -1 ? '&' : '?') + 'p=' + id : '';
    var summary = items.map(function (i) { return i.name + ' ' + (i.price ? prEuro_(i.price) : 'on request'); }).join(' · ');
    trello = prTrello_(q, items, link);
    var h = prHistSheet_(ss);
    h.appendRow([id, new Date(), q.type, q.type === 'Agency' ? q.agency + (q.name ? ' · ' + q.name : '') : q.name, q.email, q.ci, q.co, q.guests, summary,
      link ? '=HYPERLINK("' + link + '","Άνοιγμα")' : '⚠ λείπει PROPOSAL_WEBAPP_URL', '', trello, 'Ανοιχτή', '', Session.getActiveUser().getEmail(), JSON.stringify(data)]);
    PropertiesService.getDocumentProperties().setProperty('PR_LAST', id);
    return { count: items.length, detail: id + ' · ' + (q.type === 'Agency' ? q.agency : q.name) + ' · ' + summary.slice(0, 150) };
  });
  if (ok) ui.alert('Η πρόταση δημιουργήθηκε' + (link ? ':\n\n' + link : ' — αλλά λείπει το PROPOSAL_WEBAPP_URL (δες οδηγίες).') +
    (trello ? '\n\nTrello: ' + (/^http/.test(trello) ? 'κάρτα ✓' : trello) : '') + '\n\nΓια email: «3. Αποστολή email».');
}

function prHistSheet_(ss) {
  var h = ss.getSheetByName(PR.HIST);
  if (!h) {
    h = ss.insertSheet(PR.HIST, 2);
    h.getRange(1, 1, 1, PR_HIST.length).setValues([PR_HIST]).setFontWeight('bold').setBackground(PR_NAVY).setFontColor('#FFFFFF');
    h.setFrozenRows(1); h.setColumnWidth(4, 220); h.setColumnWidth(9, 360); h.setColumnWidth(14, 220);
    h.hideColumns(PR_HIST.indexOf('_data') + 1);
    h.getRange(2, PR_HIST.indexOf('Κατάσταση') + 1, 999, 1)
      .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(PR_STATUS, true).build()).setBackground('#FFF8DC');
    h.getRange(2, PR_HIST.indexOf('Σημείωση') + 1, 999, 1).setBackground('#FFF8DC');
  }
  return h;
}

// -- 3. EMAIL ------------------------------------------------------------------------

function sendProposalEmail() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi(), h = ss.getSheetByName(PR.HIST);
  if (!h || h.getLastRow() < 2) { ui.alert('Δεν υπάρχει πρόταση. Κάνε πρώτα «2. Δημιουργία πρότασης».'); return; }
  var m = SomnioCore.headerMap(h), row = h.getLastRow();
  if (ss.getActiveSheet().getName() === PR.HIST && ss.getActiveRange().getRow() >= 2) row = ss.getActiveRange().getRow();
  var g = function (c) { return h.getRange(row, m[c] + 1).getValue(); };
  var data = JSON.parse(g('_data') || '{}'), to = String(g('Email') || '').trim();
  var link = (String(h.getRange(row, m['Link πρότασης'] + 1).getFormula()).match(/"(http[^"]+)"/) || [])[1] || '';
  if (!to) { ui.alert('Η πρόταση ' + g('ID') + ' δεν έχει email. Γράψε το στη στήλη «Email» του Ιστορικού.'); return; }
  if (!link) { ui.alert('Η πρόταση δεν έχει link (λείπει το PROPOSAL_WEBAPP_URL).'); return; }
  if (g('Email στάλθηκε') && ui.alert('Έχει ήδη σταλεί (' + prDMY_(g('Email στάλθηκε')) + '). Ξανά;', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  if (ui.alert('Αποστολή πρότασης', 'Προς: ' + to + '\nΠρόταση: ' + g('ID') + ' · ' + g('Πελάτης / Agency') + '\n' + g('Ακίνητα & τιμές') + '\n\nΝα σταλεί;', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var ok = SomnioCore.runJob('Proposals · Email', function () {
    var hello = data.type === 'Agency' ? 'Dear ' + (data.name || 'partner') : 'Dear ' + (data.name || 'guest');
    var body = hello + ',\n\nThank you for your interest in Somnio. Please find our selection for ' + prDMY_(data.ci) + ' – ' + prDMY_(data.co) +
      ' (' + data.nights + ' nights, ' + data.guests + ' guests):\n\n' + link + '\n\n' +
      data.items.map(function (i) { return '• ' + i.name + ' — ' + (i.price ? prEuro_(i.price) : 'on request'); }).join('\n') +
      '\n\nRates and availability are subject to confirmation at the time of booking.\n\nKind regards,\nSomnio Estate\n+30 6989 273 346 · info@somnioestate.com';
    var html = '<div style="font-family:Arial,sans-serif;color:#202020;font-size:14px;line-height:1.6">' + body.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(link, '<a href="' + link + '" style="display:inline-block;background:' + PR_NAVY + ';color:#fff;padding:12px 22px;text-decoration:none">View your proposal</a>')
      .replace(/\n/g, '<br>') + '</div>';
    GmailApp.sendEmail(to, 'Your Somnio stay proposal · ' + prDMY_(data.ci) + ' – ' + prDMY_(data.co), body, { htmlBody: html, name: 'Somnio Estate' });
    h.getRange(row, m['Email στάλθηκε'] + 1).setValue(new Date());
    if (g('Κατάσταση') === 'Ανοιχτή') h.getRange(row, m['Κατάσταση'] + 1).setValue('Στάλθηκε');
    return { count: 1, detail: g('ID') + ' → ' + to };
  });
  if (ok) ui.alert('Στάλθηκε στο ' + to + '.');
}

// -- TRELLO (προαιρετικό) ------------------------------------------------------------

function prTrelloAuth_() {
  var p = PropertiesService.getScriptProperties();
  var k = p.getProperty('TRELLO_KEY'), t = p.getProperty('TRELLO_TOKEN');
  return k && t ? 'key=' + encodeURIComponent(k.trim()) + '&token=' + encodeURIComponent(t.trim()) : '';
}

/** Φτιάχνει κάρτα στη λίστα TRELLO_LIST_ID. Επιστρέφει το link της κάρτας ή μήνυμα. */
function prTrello_(q, items, link) {
  var auth = prTrelloAuth_(), list = String(SomnioCore.cfg('TRELLO_LIST_ID', false) || '').trim();
  if (!auth || !list) return '';
  var name = (q.type === 'Agency' ? q.agency + (q.name ? ' · ' + q.name : '') : q.name || 'Πελάτης') + ' · ' + prDMY_(q.ci) + '–' + prDMY_(q.co) + ' · ' + q.guests + ' άτ.';
  var desc = (q.type === 'Agency' ? '**Agency:** ' + q.agency + '\n' : '') + (q.email ? '**Email:** ' + q.email + '\n' : '') +
    '**Νύχτες:** ' + q.nights + ' · **Άτομα:** ' + q.guests + (q.budget ? ' · **Budget:** ' + prEuro_(q.budget) : '') + '\n\n' +
    items.map(function (i) { return '- ' + i.name + ': ' + (i.price ? prEuro_(i.price) : 'on request') + (i.hosthub && i.hosthub !== i.price ? ' (Hosthub ' + prEuro_(i.hosthub) + ')' : ''); }).join('\n') +
    (link ? '\n\n[Πρόταση](' + link + ')' : '');
  try {
    var res = UrlFetchApp.fetch('https://api.trello.com/1/cards?' + auth, { method: 'post', muteHttpExceptions: true,
      payload: { idList: list, name: name, desc: desc, pos: 'top', due: prISO_(q.ci) + 'T12:00:00.000Z' } });
    if (res.getResponseCode() !== 200) return '⚠ Trello ' + res.getResponseCode();
    return JSON.parse(res.getContentText()).shortUrl || '✓';
  } catch (e) { return '⚠ Trello: ' + e.message.slice(0, 80); }
}

/** Γράφει στο tab «Trello» τα boards και τις λίστες σου, για να βρεις το TRELLO_LIST_ID. */
function trelloLists() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), auth = prTrelloAuth_();
  if (!auth) { SpreadsheetApp.getUi().alert('Λείπουν TRELLO_KEY / TRELLO_TOKEN στα Script Properties.'); return; }
  var get = function (u) { var r = UrlFetchApp.fetch('https://api.trello.com/1/' + u + (u.indexOf('?') > -1 ? '&' : '?') + auth, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('Trello ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200)); return JSON.parse(r.getContentText()); };
  var out = [['Board', 'Λίστα (στήλη)', 'TRELLO_LIST_ID']];
  get('members/me/boards?filter=open&fields=name').forEach(function (b) {
    get('boards/' + b.id + '/lists?filter=open&fields=name').forEach(function (l) { out.push([b.name, l.name, l.id]); });
  });
  var sh = ss.getSheetByName(PR.TRELLO) || ss.insertSheet(PR.TRELLO);
  sh.clear(); sh.getRange(1, 1, out.length, 3).setValues(out); sh.getRange(1, 1, 1, 3).setFontWeight('bold');
  sh.setColumnWidth(1, 220); sh.setColumnWidth(2, 220); sh.setColumnWidth(3, 260);
  ss.setActiveSheet(sh);
  SpreadsheetApp.getUi().alert('Βρέθηκαν ' + (out.length - 1) + ' λίστες. Αντέγραψε το TRELLO_LIST_ID της λίστας που θες στο Config.');
}

// -- ΣΕΛΙΔΑ ΠΡΟΤΑΣΗΣ (Web App) -------------------------------------------------------

function prAppUrl_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }

function doGet(e) {
  var id = e && e.parameter && String(e.parameter.p || '').trim(), data = null;
  if (id && /^[a-f0-9]{6,20}$/.test(id)) {
    var ss = SpreadsheetApp.getActiveSpreadsheet() || SomnioCore.openFile('FILE_PROPOSALS'), h = ss.getSheetByName(PR.HIST);
    if (h && h.getLastRow() > 1) {
      var m = SomnioCore.headerMap(h), ids = h.getRange(2, m['ID'] + 1, h.getLastRow() - 1, 1).getValues();
      for (var i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === id) { data = JSON.parse(h.getRange(i + 2, m['_data'] + 1).getValue()); break; }
    }
  }
  var t = HtmlService.createTemplateFromFile('ProposalPage');
  t.d = data;
  t.fmt = function (iso) { var x = prDate_(iso); return x ? x.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; };
  t.eur = function (n) { n = Number(n) || 0; var f = n % 1 ? 2 : 0; return n ? '€' + n.toLocaleString('en-US', { minimumFractionDigits: f, maximumFractionDigits: f }) : ''; };
  return t.evaluate().setTitle('Somnio · Your stay proposal').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// -- ΣΤΗΣΙΜΟ -------------------------------------------------------------------------

function setupProposals() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ok = SomnioCore.runJob('Proposals · Στήσιμο', function () {
    ss.setSpreadsheetTimeZone(String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens'));
    var r = ss.getSheetByName(PR.REQ);
    if (!r) { var f = ss.getSheets()[0]; r = f.getLastRow() === 0 ? f.setName(PR.REQ) : ss.insertSheet(PR.REQ, 0); }
    var keep = {}; if (r.getLastRow()) r.getRange(1, 1, r.getLastRow(), 2).getValues().forEach(function (x) { if (x[0]) keep[x[0]] = x[1]; });
    r.clear(); r.clearDataValidations();
    var rows = PR_REQ_FIELDS.map(function (f) { return [f[0], keep[f[0]] !== undefined && keep[f[0]] !== '' ? keep[f[0]] : f[1], f[2]]; });
    r.getRange(1, 1, rows.length, 3).setValues(rows);
    r.getRange(1, 1, rows.length, 1).setFontWeight('bold').setFontColor(PR_NAVY);
    r.getRange(1, 2, rows.length, 1).setBackground('#FFF8DC');
    r.getRange(1, 3, rows.length, 1).setFontColor('#888888').setFontStyle('italic');
    var at = function (label) { for (var i = 0; i < PR_REQ_FIELDS.length; i++) if (PR_REQ_FIELDS[i][0] === label) return r.getRange(i + 1, 2); };
    var dv = function (list) { return SpreadsheetApp.newDataValidation().requireValueInList(list, true).build(); };
    at('Τύπος').setDataValidation(dv(['Πελάτης', 'Agency']));
    at('Πισίνα').setDataValidation(dv(['ANY', 'PRIVATE', 'PRIVATE OR SHARED', 'NO']));
    at('Θέα θάλασσα').setDataValidation(dv(['ANY', 'YES', 'NO']));
    at('Check-in').setNumberFormat('dd/MM/yyyy'); at('Check-out').setNumberFormat('dd/MM/yyyy');
    var ag = prTable_(SomnioCore.openFile('FILE_MASTER_PROPERTIES'), 'Agencies')
      .filter(function (a) { return a['Agency'] && String(a['Active']).toUpperCase() !== 'FALSE'; }).map(function (a) { return String(a['Agency']); });
    if (ag.length) at('Agency').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ag, true).setAllowInvalid(true).build());
    r.setColumnWidth(1, 200); r.setColumnWidth(2, 260); r.setColumnWidth(3, 420);
    prHistSheet_(ss);
    return { count: ag.length, detail: 'agencies ' + ag.length };
  });
  if (ok) SpreadsheetApp.getUi().alert('Στήσιμο ΟΚ. Συμπλήρωσε το tab «' + PR.REQ + '» και πάτα «1. Διαθεσιμότητα & τιμές».');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Proposals')
    .addItem('1. Διαθεσιμότητα & τιμές', 'checkAvailability')
    .addItem('2. Δημιουργία πρότασης', 'createProposal')
    .addItem('3. Αποστολή email (τελευταία ή επιλεγμένη στο Ιστορικό)', 'sendProposalEmail')
    .addSeparator()
    .addItem('Στήσιμο / φρεσκάρισμα', 'setupProposals')
    .addItem('Trello: δείξε τις λίστες μου', 'trelloLists')
    .addToUi();
}
