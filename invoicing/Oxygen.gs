/**
 * Owner Invoicing 2027 — σύνδεση με Oxygen (Pelatologio ERP API).
 *
 * Βάση: https://sandbox-api.oxygen.gr/v1 (δοκιμές) · https://api.oxygen.gr/v1 (παραγωγή, θέλει αναβάθμιση συνδρομής).
 * Πιστοποίηση: Authorization: Bearer <OXYGEN_API_KEY> (Script Property του αρχείου — ποτέ στο GitHub/chat).
 * Config: OXYGEN_ENV = sandbox | production (προεπιλογή sandbox) · OXYGEN_SERIES_INVOICE (ΠΡΟΜ) · OXYGEN_SERIES_RECEIPT (ΑΠΥ).
 *
 * Ροή Oxygen (από το email τους): POST /contacts → id επαφής → POST /invoices με το id της επαφής,
 * και με τα id σειράς παραστατικού, συντελεστή ΦΠΑ, μονάδας μέτρησης, τρόπου πληρωμής.
 *
 * ΚΑΤΑΣΤΑΣΗ 9/11: υπάρχει μόνο η δοκιμή σύνδεσης (διαβάζει τις λίστες για να βρούμε τα id).
 * Η έκδοση παραστατικού γράφεται μόλις έχουμε το sandbox key + το σχήμα του POST /invoices.
 */

function oxyBase_() {
  var env = String(SomnioCore.cfg('OXYGEN_ENV', false) || 'sandbox').toLowerCase();
  return env === 'production' ? 'https://api.oxygen.gr/v1' : 'https://sandbox-api.oxygen.gr/v1';
}

function oxyKey_() {
  var k = PropertiesService.getScriptProperties().getProperty('OXYGEN_API_KEY');
  if (!k) throw new Error('Λείπει το OXYGEN_API_KEY στα Script Properties του Owner Invoicing 2027.');
  return k.trim();
}

/** GET/POST στο Oxygen. Επιστρέφει { code, body (JSON ή κείμενο) }. */
function oxyCall_(method, path, payload) {
  var opt = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + oxyKey_(), Accept: 'application/json' } };
  if (payload) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(payload); }
  var res = UrlFetchApp.fetch(oxyBase_() + path, opt), txt = res.getContentText(), body = txt;
  try { body = JSON.parse(txt); } catch (e) {}
  return { code: res.getResponseCode(), body: body };
}

/**
 * Δοκιμή σύνδεσης: ζητά τις βασικές λίστες και γράφει στο tab «Oxygen» ό,τι επιστρέφει,
 * ώστε να δούμε τα πραγματικά πεδία/ids (σειρές, ΦΠΑ, μονάδες, τρόποι πληρωμής, επαφές).
 * Δεν δημιουργεί και δεν αλλάζει τίποτα στο Oxygen.
 */
function oxygenTest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var paths = ['/contacts?per_page=3', '/numbering-sequences', '/taxes', '/measurement-units', '/payment-methods', '/invoices?per_page=1'];
  var out = [['Endpoint', 'HTTP', 'Απάντηση (αρχή)']];
  paths.forEach(function (p) {
    try {
      var r = oxyCall_('get', p);
      out.push([p, r.code, (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)).slice(0, 45000)]);
    } catch (e) { out.push([p, 'σφάλμα', e.message]); }
  });
  var sh = ss.getSheetByName('Oxygen') || ss.insertSheet('Oxygen');
  sh.clear();
  sh.getRange(1, 1, out.length, 3).setValues(out);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold');
  sh.setColumnWidth(1, 220); sh.setColumnWidth(3, 900);
  sh.getRange(2, 3, out.length - 1, 1).setWrap(true);
  var okN = out.filter(function (r) { return r[1] === 200; }).length;
  SomnioCore.logRun('Owner Invoicing · Oxygen test', okN ? 'OK' : 'ERROR', okN, oxyBase_() + ' · ' + okN + '/' + paths.length + ' OK');
  SpreadsheetApp.getUi().alert('Oxygen (' + oxyBase_() + '): ' + okN + '/' + paths.length + ' απαντήσεις ΟΚ. Δες το tab «Oxygen».');
}
