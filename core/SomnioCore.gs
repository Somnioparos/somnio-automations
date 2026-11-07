/**
 * SomnioCore — κοινή βιβλιοθήκη Apps Script για όλα τα αρχεία Somnio 2027.
 *
 * Τι κάνει:
 *   - Διαβάζει το «Somnio — Config 2027» (κωδικοί αρχείων, έτος, ρυθμίσεις).
 *   - Βρίσκει στήλες από τα ονόματα των headers (ποτέ σταθερές θέσεις).
 *   - Γράφει Log και Health για κάθε αυτόματη εργασία (τα διαβάζει το Control Center).
 *   - Στέλνει email ειδοποίησης όταν μια εργασία αποτύχει.
 *
 * Πώς χρησιμοποιείται από ένα Sheet:
 *   Extensions → Apps Script → Libraries (+) → Script ID της SomnioCore → Identifier: SomnioCore
 *   → Version: HEAD (development mode). Μετά, π.χ.:
 *     SomnioCore.cfg('YEAR')
 *     SomnioCore.runJob('Master sync', function () { ... });
 *
 * ΣΗΜΑΝΤΙΚΟ: τα κλειδιά API (Hosthub, Oxygen) ΔΕΝ διαβάζονται εδώ. Μια βιβλιοθήκη βλέπει μόνο
 * τα δικά της Script Properties, όχι του Sheet που την καλεί. Κάθε Sheet κρατά τα κλειδιά του
 * στα δικά του Script Properties και τα διαβάζει μόνο του.
 */

var CONFIG_ID = '1HXN0zCu9pBffeACgyu4oWjJkF3JhPEwY_sPcnlOVIsU';   // Somnio — Config 2027
var TAB_LOG = 'Log';
var TAB_HEALTH = 'Health';
var CACHE_SECONDS = 300;

// -- CONFIG -----------------------------------------------------------------

/** Όλες οι ρυθμίσεις ως αντικείμενο { KEY: value }. Κρατιούνται σε cache για 5 λεπτά. */
function getConfig() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('somnio_config');
  if (hit) return JSON.parse(hit);

  var sh = SpreadsheetApp.openById(CONFIG_ID).getSheets()[0];   // το πρώτο tab = οι ρυθμίσεις
  var rows = sh.getDataRange().getValues();
  var conf = {};
  for (var i = 1; i < rows.length; i++) {
    var k = String(rows[i][0] || '').trim();
    if (k) conf[k] = rows[i][1];
  }
  cache.put('somnio_config', JSON.stringify(conf), CACHE_SECONDS);
  return conf;
}

/**
 * Μία ρύθμιση. Αν λείπει ή είναι κενή και required !== false → σφάλμα με σαφές μήνυμα,
 * ώστε να φαίνεται αμέσως στο Log τι πρέπει να συμπληρωθεί στο Config.
 */
function cfg(key, required) {
  var v = getConfig()[key];
  if ((v === undefined || v === '' || v === null) && required !== false) {
    throw new Error('Λείπει η ρύθμιση «' + key + '» στο Somnio — Config 2027.');
  }
  return v;
}

/** Ανοίγει ένα αρχείο του συστήματος με το όνομα της ρύθμισης, π.χ. openFile('FILE_MASTER_FILE'). */
function openFile(key) {
  return SpreadsheetApp.openById(String(cfg(key)).trim());
}

/** Αδειάζει την cache — να τρέχει μετά από αλλαγή στο Config αν χρειάζεται άμεσα. */
function clearConfigCache() {
  CacheService.getScriptCache().remove('somnio_config');
}

// -- HEADERS ------------------------------------------------------------------

/** { 'όνομα στήλης': index από 0 } από τη γραμμή headers ενός tab. */
function headerMap(sheet, headerRow) {
  var r = headerRow || 1;
  var last = sheet.getLastColumn();
  if (last < 1) return {};
  var hdr = sheet.getRange(r, 1, 1, last).getValues()[0];
  var map = {};
  for (var i = 0; i < hdr.length; i++) {
    var h = String(hdr[i] || '').trim();
    if (h && map[h] === undefined) map[h] = i;
  }
  return map;
}

/** Index της στήλης· σφάλμα αν δεν υπάρχει (ώστε να μη διαβάζεται ποτέ λάθος στήλη). */
function col(map, name) {
  if (map[name] === undefined) {
    throw new Error('Δεν βρέθηκε η στήλη «' + name + '». Υπάρχουν: ' + Object.keys(map).join(', '));
  }
  return map[name];
}

// -- LOG & HEALTH ---------------------------------------------------------------

function sheetOrCreate_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Καταγράφει ένα τρέξιμο: μία γραμμή στο Log και ενημέρωση της γραμμής της εργασίας στο Health.
 * status: 'OK' | 'ERROR' | 'WARNING'
 */
function logRun(job, status, count, detail) {
  var ss = SpreadsheetApp.openById(CONFIG_ID);
  var now = new Date();
  var log = sheetOrCreate_(ss, TAB_LOG, ['Χρόνος', 'Εργασία', 'Status', 'Πλήθος', 'Λεπτομέρειες']);
  log.appendRow([now, job, status, count === undefined ? '' : count, String(detail || '').slice(0, 1000)]);

  var health = sheetOrCreate_(ss, TAB_HEALTH,
    ['Εργασία', 'Τελευταίο τρέξιμο', 'Status', 'Λεπτομέρειες', 'Τελευταία επιτυχία']);
  var vals = health.getDataRange().getValues();
  var row = -1;
  for (var i = 1; i < vals.length; i++) if (vals[i][0] === job) { row = i + 1; break; }
  var lastOk = status === 'OK' ? now : (row > 0 ? vals[row - 1][4] : '');
  var line = [job, now, status, String(detail || '').slice(0, 300), lastOk];
  if (row > 0) health.getRange(row, 1, 1, line.length).setValues([line]);
  else health.appendRow(line);
}

/** Email ειδοποίησης στο ALERT_EMAIL του Config. */
function alert(subject, body) {
  var to = cfg('ALERT_EMAIL', false);
  if (!to) return;
  MailApp.sendEmail(String(to), '[Somnio] ' + subject, String(body || ''));
}

/**
 * Τρέχει μια εργασία με πλήρη καταγραφή. Η fn μπορεί να επιστρέψει έναν αριθμό (πλήθος)
 * ή { count, detail }. Σε σφάλμα: Log + Health = ERROR + email. Επιστρέφει true/false.
 */
function runJob(job, fn) {
  try {
    var res = fn();
    var count = (res && typeof res === 'object') ? res.count : res;
    var detail = (res && typeof res === 'object') ? res.detail : '';
    logRun(job, 'OK', count, detail);
    return true;
  } catch (e) {
    var msg = (e && e.message) ? e.message : String(e);
    try { logRun(job, 'ERROR', '', msg); } catch (ignored) {}
    try {
      alert('Αποτυχία: ' + job,
        'Η εργασία «' + job + '» απέτυχε.\n\nΣφάλμα: ' + msg +
        '\n\nΔες το Health και το Log στο Somnio — Config 2027 και τη σελίδα της στο Runbook.');
    } catch (ignored2) {}
    return false;
  }
}

// -- HOSTHUB API -----------------------------------------------------------------
// Το κλειδί το δίνει το Sheet που καλεί (από τα δικά του Script Properties).

var HOSTHUB_BASE = 'https://app.hosthub.com/api/2019-03-01';

/** GET στη Hosthub με αναμονή 1,2" ανά κλήση και επανάληψη σε rate limit (429). */
function hosthubGet(path, apiKey) {
  if (!apiKey) throw new Error('Λείπει το HOSTHUB_API_KEY στα Script Properties του αρχείου.');
  var url = String(path).indexOf('http') === 0 ? path : HOSTHUB_BASE + path;
  for (var attempt = 0; attempt < 5; attempt++) {
    Utilities.sleep(attempt === 0 ? 1200 : Math.min(60000, 8000 * Math.pow(2, attempt - 1)));
    var res = UrlFetchApp.fetch(url, {
      method: 'get', muteHttpExceptions: true,
      headers: { 'Authorization': String(apiKey).trim(), 'Accept': 'application/json' }
    });
    var code = res.getResponseCode();
    if (code === 429) continue;
    if (code >= 400) throw new Error('Hosthub HTTP ' + code + ' @ ' + url + ' — ' + (res.getContentText() || '').slice(0, 300));
    return JSON.parse(res.getContentText());
  }
  throw new Error('Hosthub: rate limit μετά από 5 προσπάθειες @ ' + url);
}

/** Όλα τα ακίνητα (rentals) της Hosthub: [{ id, name, ... }]. */
function hosthubRentals(apiKey) {
  var out = [], seen = {}, url = '/rentals', prev = '', guard = 0;
  while (url && url !== prev && guard++ < 20) {
    var page = hosthubGet(url, apiKey);
    var d = page.data || [];
    d.forEach(function (r) { if (!seen[r.id]) { seen[r.id] = 1; out.push(r); } });
    if (!d.length) break;
    prev = url;
    var nav = page.navigation || {};
    url = nav.next || nav.previous || null;   // η Hosthub σελιδοποιεί με next/previous
  }
  return out;
}

// -- ΗΜΕΡΟΜΗΝΙΕΣ ----------------------------------------------------------------

/** 'YYYY-MM-DD' στη ζώνη ώρας του Config. */
function ymd(d) {
  return Utilities.formatDate(d, String(cfg('TIMEZONE', false) || 'Europe/Athens'), 'yyyy-MM-dd');
}

// -- ΕΛΕΓΧΟΣ ΦΑΣΗΣ 0 -------------------------------------------------------------

/**
 * Τρέχει από τον editor της SomnioCore: διαβάζει το Config, γράφει Log/Health και στέλνει
 * δοκιμαστικό email. Αν όλα πάνε καλά, η Φάση 0 περνά τον έλεγχό της.
 */
function selfTest() {
  clearConfigCache();
  runJob('SomnioCore selfTest', function () {
    var year = cfg('YEAR');
    var drive = cfg('SHARED_DRIVE');
    alert('Δοκιμή SomnioCore', 'Η SomnioCore διάβασε το Config: έτος ' + year + ', Shared Drive ' + drive + '.');
    return { count: Object.keys(getConfig()).length, detail: 'Config OK, έτος ' + year };
  });
}
