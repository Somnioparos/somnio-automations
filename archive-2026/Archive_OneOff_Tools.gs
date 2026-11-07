/**
 * ARCHIVE — One-off εργαλεία που αφαιρέθηκαν από το Master_File.gs (7/7/2026)
 * Χρησιμοποιήθηκαν μία φορά και ολοκλήρωσαν τον σκοπό τους:
 *   - fixEmptyPlatform: γέμισε "Direct (Hosthub)" στα κενά Platform
 *   - scanClients/importClients: εφάπαξ import Passport/Country από
 *     "2026_Movie Collection" (tab Clients) + "Schedule 2026" στο Master
 * Αν ποτέ ξαναχρειαστούν: επικόλλησε αυτό το αρχείο ΜΑΖΙ με το Master_File.gs
 * (χρησιμοποιεί τις σταθερές/συναρτήσεις του: TAB_BOOKINGS, TOTAL_COLS,
 * EVENT_IDX, PASSPORT_IDX, COUNTRY_IDX, logRow_) και πρόσθεσε menu items.
 */

var IMPORT_SHEET_IDS = [
  '1ZT7JKnpe9aMHUFRJr7Lf7paNqKRW2SZn_ulZ6v_OgJM',  // "2026_Movie Collection" (tab Clients)
  '1IixNXEpvgmW3VFRysGvUHMVFU8t_pJN1gnDpPDwma20'   // "Schedule 2026"
];

function normName2_(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9α-ω]/g,'');
}

function dKey_(v){
  if (Object.prototype.toString.call(v) === '[object Date]')
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var s = String(v||'').trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/);
  if (m) return m[3] + '-' + ('0'+m[2]).slice(-2) + '-' + ('0'+m[1]).slice(-2);
  return '';
}

var NATION_MAP = {
  'greek':'Greece','swiss':'Switzerland','usa':'United States','american':'United States','us':'United States',
  'australian':'Australia','ausralian':'Australia','french':'France','dutch':'Netherlands','nederlanden':'Netherlands',
  'new zeland':'New Zealand','new zealand':'New Zealand','german':'Germany','italian':'Italy','spanish':'Spain',
  'british':'United Kingdom','uk':'United Kingdom','english':'United Kingdom','irish':'Ireland','canadian':'Canada',
  'belgian':'Belgium','austrian':'Austria','portuguese':'Portugal','turkish':'Turkey','israeli':'Israel',
  'polish':'Poland','swedish':'Sweden','norwegian':'Norway','danish':'Denmark','finnish':'Finland',
  'czech':'Czechia','romanian':'Romania','serbian':'Serbia','albanian':'Albania','brazilian':'Brazil',
  'argentinian':'Argentina','mexican':'Mexico','chinese':'China','japanese':'Japan','korean':'South Korea','indian':'India'
};
function fixCountry_(v) {
  var s = String(v||'').trim();
  if (!s) return '';
  var m = NATION_MAP[s.toLowerCase()];
  return m || s;
}

function clientsSources_() {
  var out = [];
  function findCol(H, keys){
    for (var i=0;i<H.length;i++){
      var h = String(H[i]||'').trim().toLowerCase();
      if (!h) continue;
      for (var k=0;k<keys.length;k++) if (h.indexOf(keys[k]) > -1) return i;
    }
    return -1;
  }
  var KEYS = {
    passport: ['passport','διαβατ','αδτ','id number','document','ταυτοτ'],
    country:  ['nationality','country','χωρα','χώρα','εθνικ'],
    name:     ['guest name','name','όνομα','ονομα','guest','πελατ'],
    res:      ['reservation','confirmation','κωδικ','booking id'],
    checkin:  ['check-in','check in','check_in','checkin','άφιξη','αφιξη','arrival','date'],
    residence:['residence','property','κατάλυμα','καταλυμα','σπίτι','σπιτι','villa','house']
  };
  for (var f = 0; f < IMPORT_SHEET_IDS.length; f++) {
    var ext, name = IMPORT_SHEET_IDS[f];
    try { ext = SpreadsheetApp.openById(IMPORT_SHEET_IDS[f]); name = ext.getName(); } catch (e) { continue; }
    var sheets = ext.getSheets();
    for (var s = 0; s < sheets.length; s++) {
      var vals;
      try { vals = sheets[s].getDataRange().getValues(); } catch (e) { continue; }
      for (var r = 0; r < Math.min(vals.length, 10); r++) {
        var c = {
          passport: findCol(vals[r], KEYS.passport),
          country:  findCol(vals[r], KEYS.country),
          name:     findCol(vals[r], KEYS.name),
          res:      findCol(vals[r], KEYS.res),
          checkin:  findCol(vals[r], KEYS.checkin),
          residence:findCol(vals[r], KEYS.residence)
        };
        if (c.passport > -1 && c.name > -1) {
          c.headerRow = r; c.vals = vals; c.header = vals[r];
          c.file = name; c.tab = sheets[s].getName();
          out.push(c);
          r = 10;
        }
      }
    }
  }
  if (!out.length) throw new Error('Kamia pigi den exei header me Name + Passport.');
  return out;
}

function scanClients() {
  try {
    var srcs = clientsSources_();
    var msg = [];
    for (var i = 0; i < srcs.length; i++) {
      var c = srcs[i];
      var nm = function(j){ return j > -1 ? '"' + c.header[j] + '"' : '-'; };
      msg.push((i+1) + ') ' + c.file + ' / tab "' + c.tab + '" (' + (c.vals.length - c.headerRow - 1) + ' rows)\n' +
        '   Name=' + nm(c.name) + ' Passport=' + nm(c.passport) + ' Country=' + nm(c.country) +
        ' ResID=' + nm(c.res) + ' Check_in=' + nm(c.checkin));
    }
    SpreadsheetApp.getUi().alert('Piges import:\n\n' + msg.join('\n\n') + '\n\nAn einai OK, trekse "5. Import Passport/Country".');
  } catch (e) {
    SpreadsheetApp.getUi().alert('SCAN ERROR: ' + e.message);
  }
}

function importClients() {
  var srcs = clientsSources_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_BOOKINGS);
  if (!sh) { SpreadsheetApp.getUi().alert('Den yparxei Bookings.'); return; }
  var last = sh.getLastRow(); if (last < 2) return;
  var bk = sh.getRange(2, 1, last - 1, TOTAL_COLS).getValues();

  var byRes = {}, byNameDate = {}, byName = {};
  for (var s = 0; s < srcs.length; s++) {
    var c = srcs[s];
    for (var i = c.headerRow + 1; i < c.vals.length; i++) {
      var row = c.vals[i];
      var pass = c.passport > -1 ? String(row[c.passport]||'').trim() : '';
      var ctry = fixCountry_(c.country > -1 ? row[c.country] : '');
      if (!pass && !ctry) continue;
      var rec = { pass: pass, ctry: ctry };
      if (c.res > -1) { var rid = String(row[c.res]||'').trim().toUpperCase(); if (rid && !byRes[rid]) byRes[rid] = rec; }
      var n = normName2_(c.name > -1 ? row[c.name] : '');
      if (n) {
        if (c.checkin > -1) { var dk = dKey_(row[c.checkin]); if (dk && !byNameDate[n + '|' + dk]) byNameDate[n + '|' + dk] = rec; }
        if (byName[n] === undefined) byName[n] = rec;
        else if (byName[n] && (byName[n].pass !== rec.pass)) byName[n] = null;
      }
    }
  }

  var filledP = 0, filledC = 0, matched = 0;
  for (var k = 0; k < bk.length; k++) {
    var b = bk[k];
    if (!b[EVENT_IDX]) continue;
    var rec2 = null;
    var code = String(b[2]||'').trim().toUpperCase();
    if (code && byRes[code]) rec2 = byRes[code];
    if (!rec2) {
      var key = normName2_(b[8]) + '|' + dKey_(b[3]);
      if (key.charAt(0) !== '|' && byNameDate[key]) rec2 = byNameDate[key];
    }
    if (!rec2) { var n2 = normName2_(b[8]); if (n2 && byName[n2]) rec2 = byName[n2]; }
    if (!rec2) continue;
    matched++;
    var dirty = false;
    if (rec2.pass && String(b[PASSPORT_IDX]||'') === '') { b[PASSPORT_IDX] = rec2.pass; filledP++; dirty = true; }
    if (rec2.ctry && String(b[COUNTRY_IDX]||'')  === '') { b[COUNTRY_IDX]  = rec2.ctry; filledC++; dirty = true; }
    if (dirty) sh.getRange(2 + k, 1, 1, TOTAL_COLS).setValues([b]);
  }
  logRow_('IMPORT_CLIENTS', filledP + filledC, 'matched=' + matched + ' passports=' + filledP + ' countries=' + filledC);
  SpreadsheetApp.getUi().alert('Import OK\nMatched: ' + matched + '\nPassports: ' + filledP + '\nCountries: ' + filledC);
}

function fixEmptyPlatform() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_BOOKINGS);
  if (!sh) return;
  var last = sh.getLastRow(); if (last < 2) return;
  var rng = sh.getRange(2, 7, last - 1, 1);   // Platform (col 7)
  var vals = rng.getValues(), evs = sh.getRange(2, EVENT_IDX + 1, last - 1, 1).getValues(), n = 0;
  for (var i = 0; i < vals.length; i++) {
    var isDC = String(evs[i][0] || '').indexOf('DC|') === 0;
    if (!isDC && String(vals[i][0] || '').trim() === '') { vals[i][0] = 'Direct (Hosthub)'; n++; }
  }
  rng.setValues(vals);
  SpreadsheetApp.getUi().alert('Platform "Direct (Hosthub)" se ' + n + ' grammes.');
}
