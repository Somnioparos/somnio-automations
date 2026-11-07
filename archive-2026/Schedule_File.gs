/**
 * SOMNIO — Schedule v3 (monthly tabs)  (τρέχει ΜΕΣΑ στο "Somnio — Schedule")
 *
 * Στήλες (v5):
 *   Property | Channel | Check-in | Check in Time | Check-out | Check out Time |
 *   Follow up | Nights | Guests | Comments | Guest Name | Phone Number |
 *   WhatsApp group | family status | age group | event_id | synced_at
 *   (Τα Passport/Nationality/Email ζουν πλέον ΜΟΝΟ στο Master.)
 *
 * - Μηνιαία tabs βάσει μήνα CHECK-IN (>= FROM_DATE). Κράτηση που συνεχίζει στον
 *   επόμενο μήνα (π.χ. 31.08-05.09) εμφανίζεται ΚΑΙ στο tab του επόμενου μήνα
 *   (γραμμή-συνέχεια, id: <event>|CONT). Αν το check-in είναι πριν το FROM_DATE
 *   αλλά το check-out μέσα (π.χ. 31.07-05.08), μπαίνει μόνο η συνέχεια.
 * - Manual στήλες: Check in Time, Follow up, Guests, Comments, Phone, WhatsApp,
 *   family status, age group — ΔΕΝ πατιούνται ποτέ.
 * - Γραμμές ΧΩΡΙΣ event_id (Owner arrivals, έκτακτα): μένουν ανέγγιχτες.
 * - AUTO Mid-Cleaning: <=4 καμία | 5-7 3η μέρα | 8 4η | 9+ κάθε 3 μέρες (3,6,9...).
 * - ΧΡΩΜΑΤΑ: Μπλε = νέες (αυτόματα στο sync) | Πράσινο = ολοκληρωμένες (manual) |
 *   Σομόν = Owner arrival (αυτόματα όταν Channel = Owner) | Ακυρωμένες = διαγράφονται.
 * - Tab "Ώρες Ομάδας" για καταγραφή ωρών (Πέτρος / Αντρέας / Ιωάννα).
 * - 0a. Setup: μετατρέπει αυτόματα υπάρχοντα tabs από την παλιά διάταξη (v2).
 */

var MASTER_FILE_ID  = '1XIZMBmY8aXxPiKR8y4vZyGICZN6MeS5rtRo01LW92UE';  // "Somnio — Master File"
var OLD_SCHEDULE_ID = '1IixNXEpvgmW3VFRysGvUHMVFU8t_pJN1gnDpPDwma20';  // "Schedule 2026" (one-off import)
var TAB_LOG         = 'Log';
var TAB_HOURS       = 'Ώρες Ομάδας';
var TEAM_NAMES      = ['Πέτρος', 'Αντρέας', 'Ιωάννα'];
var FROM_DATE       = '2026-08-01';
var AUTO_HOUR       = 8;

var COLOR_NEW   = '#c9daf8';   // mple: nea kratisi
var COLOR_OWNER = '#f4cccc';   // somon: owner arrival
var COLOR_DONE  = '#d9ead3';   // prasino: oloklirwmeni (automata: 1 mera meta to check-out)

var MONTHS_GR = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος',
                 'Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
var MONTH_TAB_RE = /^(Ιανουάριος|Φεβρουάριος|Μάρτιος|Απρίλιος|Μάιος|Ιούνιος|Ιούλιος|Αύγουστος|Σεπτέμβριος|Οκτώβριος|Νοέμβριος|Δεκέμβριος) \d{4}$/;

var SCHED_COLS = [
  'Property','Channel','Check-in','Check in Time','Check-out','Check out Time','Follow up','Nights',
  'Guests','Comments','Guest Name','Phone Number','WhatsApp group',
  'family status','age group','event_id','synced_at'
];
var S_TOTAL  = SCHED_COLS.length;  // 17
var S_EVENT  = 15;                 // 0-based event_id
var S_MANUAL = [3, 5, 6, 8, 9, 11, 12, 13, 14];
// 3 Check in Time, 5 Check out Time, 6 Follow up, 8 Guests, 9 Comments, 11 Phone, 12 WhatsApp, 13 family, 14 age

// Oi stiles tou Master vriskontai DYNAMIKA apo ta headers tou (mesa sto syncFromMaster).

// -- HELPERS -------------------------------------------------------------------

function logRow_(action, count, detail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var lg = ss.getSheetByName(TAB_LOG) || ss.insertSheet(TAB_LOG);
    if (lg.getLastRow() === 0) lg.appendRow(['timestamp','action','count','detail']);
    lg.appendRow([new Date(), action, count, detail]);
  } catch (e) {}
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

function normName_(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9α-ω]/g,'');
}

// "2A", "2A/1C", "2A/1C/1I", "4" = automati morfi guests (apo Master) — oxi keimeno omadas
function isAutoGuests_(v){
  return /^\d+(A(\/\d+C)?(\/\d+I)?)?$/.test(String(v || '').trim());
}

function timeStr_(v){
  if (Object.prototype.toString.call(v) === '[object Date]')
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  return String(v || '').trim();
}

// Metatropi opoiasdipote timis se Date, me disambiguation dd/mm vs mm/dd:
// an ena meros >12 einai sigoura i mera· alliws xrisimopoieitai o minas tou tab (hint).
function toDate_(v, hintMonth) {
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/);
  if (!m) return null;
  var a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
  if (a > 12) return new Date(y, b - 1, a);        // a = mera (dd/mm)
  if (b > 12) return new Date(y, a - 1, b);        // b = mera (mm/dd)
  if (hintMonth) {
    if (b === hintMonth && a !== hintMonth) return new Date(y, b - 1, a);   // dd/mm
    if (a === hintMonth && b !== hintMonth) return new Date(y, a - 1, b);   // mm/dd
  }
  return new Date(y, b - 1, a);                    // default: eyropaiko dd/mm
}

function tabMonth_(tabName) {
  var i = MONTHS_GR.indexOf(String(tabName || '').split(' ')[0]);
  return i > -1 ? i + 1 : 0;
}

// Kanonikopoiei tis stiles Check-in (3) & Check-out (5) se pragmatika Dates
function normalizeDateCols_(sh) {
  var last = sh.getLastRow(); if (last < 2) return;
  var hint = tabMonth_(sh.getName());
  var n = last - 1;
  var cols = [3, 5];
  for (var c = 0; c < cols.length; c++) {
    var rng = sh.getRange(2, cols[c], n, 1);
    var vals = rng.getValues();
    var dirty = false;
    for (var i = 0; i < n; i++) {
      var v = vals[i][0];
      if (!v || Object.prototype.toString.call(v) === '[object Date]') continue;
      var d = toDate_(v, hint);
      if (d) { vals[i][0] = d; dirty = true; }
    }
    if (dirty) rng.setValues(vals);
  }
}

function monthTabName_(dateKey) {
  var m = String(dateKey || '').match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return MONTHS_GR[Number(m[2]) - 1] + ' ' + m[1];
}

function applyScheduleColors_(sh) {
  // AUTOMATA xromata (me seira proteraiotitas):
  //   1. Owner (Channel periexei "owner")            -> SOMON
  //   2. Check-out perase (E < simera)               -> PRASINO (oloklirwmeni)
  //   3. WhatsApp group sympliromeno (M oxi keno)    -> LEFKO
  //   4. alliws menei to xroma tis grammis (mple gia nees)
  var rng = sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), S_TOTAL);
  function rule(formula, bg) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula)
      .setBackground(bg).setRanges([rng]).build();
  }
  sh.setConditionalFormatRules([
    rule('=REGEXMATCH(LOWER($B2),"owner")', COLOR_OWNER),
    rule('=AND($E2<>"", ISDATE($E2), $E2<TODAY())', COLOR_DONE),
    rule('=$M2<>""', '#FFFFFF')
  ]);
}

function monthSheet_(ss, tabName) {
  var sh = ss.getSheetByName(tabName);
  if (!sh) {
    sh = ss.insertSheet(tabName);
    sh.getRange(1,1,1,S_TOTAL).setValues([SCHED_COLS])
      .setFontWeight('bold').setBackground('#7B4EA3').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setColumnWidth(S_EVENT + 1, 60);
    sh.setColumnWidth(S_EVENT + 2, 60);
    applyScheduleColors_(sh);
  }
  return sh;
}

// -- MID-CLEANING RULE -----------------------------------------------------------

function midCleanDays_(nights) {
  var n = Number(nights) || 0;
  if (n <= 4) return [];
  if (n <= 7) return [3];
  if (n === 8) return [4];
  var days = [];
  for (var d = 3; d <= n - 3; d += 3) days.push(d);
  return days;
}

function addDays_(cinKey, d) {
  var dt = new Date(cinKey + 'T12:00:00');
  dt.setDate(dt.getDate() + d);
  return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function parentId_(ev) {
  var s = String(ev || '');
  var p = s.indexOf('|');
  return p > -1 ? s.slice(0, p) : s;
}

// -- 0a. SETUP + MIGRATION ---------------------------------------------------------

function setupSchedule() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lg = ss.getSheetByName(TAB_LOG) || ss.insertSheet(TAB_LOG);
  if (lg.getLastRow() === 0) lg.appendRow(['timestamp','action','count','detail']);

  // Tab oron omadas
  var hs = ss.getSheetByName(TAB_HOURS);
  if (!hs) {
    hs = ss.insertSheet(TAB_HOURS);
    hs.getRange(1,1,1,6).setValues([['Ημερομηνία','Όνομα','Από','Έως','Ώρες','Σχόλια']])
      .setFontWeight('bold').setBackground('#38761D').setFontColor('#FFFFFF');
    hs.setFrozenRows(1);
    var nameRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(TEAM_NAMES, true).setAllowInvalid(true).build();
    hs.getRange(2, 2, 500, 1).setDataValidation(nameRule);
    hs.getRange(2, 1, 500, 1).setNumberFormat('dd/MM/yyyy');
  }

  // Tab "Ypomnima" me tin kodikopoiisi xromaton (ksanagrafetai PANTA sto setup)
  var LEGEND = 'Υπόμνημα';
  var lg2 = ss.getSheetByName(LEGEND) || ss.insertSheet(LEGEND);
  lg2.clear();
  var rows = [
    ['Χρώμα', 'Σημασία', 'Ποιος το βάζει'],
    ['', 'ΜΠΛΕ — Νέα κράτηση (δεν έχει γίνει τίποτα ακόμα)', 'Αυτόματα από το σύστημα'],
    ['', 'ΑΣΠΡΟ — Έγινε το WhatsApp group, σε αναμονή άφιξης', 'Αυτόματα, μόλις συμπληρωθεί η στήλη WhatsApp group'],
    ['', 'ΠΡΑΣΙΝΟ — Ολοκληρωμένη κράτηση', 'Αυτόματα, 1 μέρα μετά το check-out'],
    ['', 'ΣΟΜΟΝ — Owner arrival', 'Αυτόματα (όταν Channel = Owner)'],
    ['', 'Ακυρωμένες: δεν εμφανίζονται — σβήνονται αυτόματα (υπάρχουν στο Master File)', '—']
  ];
  lg2.getRange(1, 1, rows.length, 3).setValues(rows);
  lg2.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#434343').setFontColor('#FFFFFF');
  lg2.getRange(2, 1).setBackground(COLOR_NEW);       // mple
  lg2.getRange(3, 1).setBackground('#FFFFFF');       // aspro
  lg2.getRange(4, 1).setBackground(COLOR_DONE);      // prasino
  lg2.getRange(5, 1).setBackground(COLOR_OWNER);     // somon
  lg2.setColumnWidth(1, 80); lg2.setColumnWidth(2, 420); lg2.setColumnWidth(3, 260);

  // Metatropi yparxonton miniaion tabs apo v2 (21 stiles, me Passport) -> v3 (17 stiles)
  var migrated = 0;
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    if (!MONTH_TAB_RE.test(sh.getName())) continue;
    var lastCol = sh.getLastColumn();
    var hdr = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    if (hdr.join('|') === SCHED_COLS.join('|')) { applyScheduleColors_(sh); continue; }   // idi v5

    var hdrJ = hdr.join('|');
    var lastRow = sh.getLastRow();

    // v2 -> v5: anadiataksi olon ton stilon (eixe kai Check out Time, sto palio col 5)
    if (hdrJ.indexOf('Passport No') > -1) {
      var data = [];
      if (lastRow > 1) {
        var old = sh.getRange(2, 1, lastRow - 1, Math.max(lastCol, 21)).getValues();
        // v2: 0 Prop,1 Chan,2 Cin,3 CinTime,4 Cout,5 CoutTime,6 Follow,7 Nights,8 Name,
        //     9 Guests,10 Email,11 Phone,12 WA,13 Comments,14-16 Passport/Nat,17 fam,18 age,19 event,20 synced
        var MAP = [0, 1, 2, 3, 4, 5, 6, 7, 9, 13, 8, 11, 12, 17, 18, 19, 20];
        for (var r = 0; r < old.length; r++) {
          var nr = [];
          for (var c = 0; c < MAP.length; c++) nr.push(old[r][MAP[c]]);
          data.push(nr);
        }
      }
      sh.clearContents();
      sh.getRange(1,1,1,S_TOTAL).setValues([SCHED_COLS])
        .setFontWeight('bold').setBackground('#7B4EA3').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
      if (data.length) sh.getRange(2, 1, data.length, S_TOTAL).setValues(data);
      applyScheduleColors_(sh);
      migrated++;
      continue;
    }

    // v3 -> : svinoume ti stili Guest Email (11i sti v3 diataksi)
    if (hdrJ.indexOf('Guest Email') > -1) {
      sh.deleteColumn(11);
      hdrJ = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].join('|');
    }

    // v4 -> v5: prosthiki stilis Check out Time meta to Check-out (F)
    if (hdrJ.indexOf('Check out Time') === -1) {
      sh.insertColumnAfter(5);
    }
    sh.getRange(1,1,1,S_TOTAL).setValues([SCHED_COLS])
      .setFontWeight('bold').setBackground('#7B4EA3').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    applyScheduleColors_(sh);
    migrated++;
  }

  logRow_('SETUP', migrated, 'tabs migrated to v3');
  SpreadsheetApp.getUi().alert('Setup OK.\nTabs se nea diataksi: ' + migrated + '\nNext: 1. Sync from Master');
}

// Diavazei OLA ta miniaia tabs kai xtizei index event_id -> thesi
function indexAllMonths_(ss) {
  var byId = {};
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var name = sheets[s].getName();
    if (!MONTH_TAB_RE.test(name)) continue;
    var last = sheets[s].getLastRow();
    if (last < 2) continue;
    var vals = sheets[s].getRange(2, 1, last - 1, S_TOTAL).getValues();
    for (var i = 0; i < vals.length; i++) {
      var id = vals[i][S_EVENT];
      if (id) byId[id] = { sh: sheets[s], tab: name, i: i, vals: vals[i] };
    }
  }
  return byId;
}

// -- 1. SYNC FROM MASTER -----------------------------------------------------------

function syncFromMaster(silent) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var mext = SpreadsheetApp.openById(MASTER_FILE_ID);
  var mb = mext.getSheetByName('Bookings');
  if (!mb) { if (!silent) SpreadsheetApp.getUi().alert('Den vrethike Bookings sto Master.'); return; }

  // Dynamiko mapping stilon apo ta headers tou Master — anextiko se allages diataksis
  var mh = mb.getRange(1, 1, 1, mb.getLastColumn()).getValues()[0];
  function mcol(n){ for (var ci = 0; ci < mh.length; ci++) if (String(mh[ci]).trim() === n) return ci; return -1; }
  var M = { RES: mcol('Residence'), PLAT: mcol('Platform'), CIN: mcol('Check_in'), COUT: mcol('Check_out'),
            NIGHTS: mcol('Nights'), NAME: mcol('Guest name'), GUESTS: mcol('Guests'),
            PHONE: mcol('Guest_Phone'), VIS: mcol('is_visible'), EVENT: mcol('event_id'), TOTAL: mh.length };
  if (M.EVENT === -1 || M.CIN === -1 || M.RES === -1) {
    if (!silent) SpreadsheetApp.getUi().alert('Ta headers tou Master den anagnoristikan — elegxe to Bookings.');
    return;
  }

  var mlast = mb.getLastRow();
  var mv = mlast > 1 ? mb.getRange(2, 1, mlast - 1, M.TOTAL).getValues() : [];

  var byId = indexAllMonths_(ss);
  var appendsByTab = {}, updated = 0, moved = 0, syncedIds = {};
  var toDelete = [];

  function upsert_(id, row, dateKey) {
    var tabName = monthTabName_(dateKey);
    if (!tabName) return;
    syncedIds[id] = 1;
    var ex = byId[id];
    if (ex) {
      if (ex.tab === tabName) {
        if (autoChanged_(ex.vals, row)) { ex.sh.getRange(2 + ex.i, 1, 1, S_TOTAL).setValues([row]); updated++; }
      } else {
        toDelete.push({ sh: ex.sh, row: 2 + ex.i });
        if (!appendsByTab[tabName]) appendsByTab[tabName] = [];
        appendsByTab[tabName].push(row);
        moved++;
      }
    } else {
      if (!appendsByTab[tabName]) appendsByTab[tabName] = [];
      appendsByTab[tabName].push(row);
    }
  }

  for (var k = 0; k < mv.length; k++) {
    var b = mv[k];
    var ev = b[M.EVENT];
    if (!ev) continue;
    if (b[M.VIS] === false || b[M.VIS] === 'FALSE') continue;   // akyromenes: katholou
    // "Owner" sto Guest name (p.x. DC owner stays): mpainei sto Schedule, alla XORIS Mid-Cleanings
    var isOwnerStay = /^owner\b/i.test(String(b[M.NAME] || '').trim());
    var cin = dKey_(b[M.CIN]);
    var cout = dKey_(b[M.COUT]) || cin;
    if (!cin || cout < FROM_DATE) continue;   // teleiose prin to FROM_DATE -> ektos

    function mkRow(id) {
      var ex = byId[id];
      var man = {};
      for (var mm = 0; mm < S_MANUAL.length; mm++) man[S_MANUAL[mm]] = ex ? ex.vals[S_MANUAL[mm]] : '';
      // Guests: akolouthei to Master otan i timi einai automatis morfis ("2A", "2A/1C"...),
      // prostatevetai mono otan i omada exei grapsei diko tis keimeno.
      var mg = M.GUESTS > -1 ? (b[M.GUESTS] || '') : '';
      var guests = man[8];
      if (String(guests || '') === '') guests = mg;
      else if (isAutoGuests_(guests) && mg && String(guests) !== String(mg)) guests = mg;
      // Phone: auto apo Master mono ota einai keno
      var phone  = String(man[11] || '') !== '' ? man[11] : (M.PHONE > -1 ? (b[M.PHONE] || '') : '');
      return [
        b[M.RES], b[M.PLAT], b[M.CIN], man[3], b[M.COUT], man[5], man[6], b[M.NIGHTS],
        guests, man[9], b[M.NAME], phone, man[12], man[13], man[14],
        id, new Date()
      ];
    }

    // Kyria grammi sto mina tou CHECK-IN (mono an cin >= FROM_DATE)
    if (cin >= FROM_DATE) upsert_(ev, mkRow(ev), cin);

    // Synexeia ston epomeno mina an i kratisi ton "pernaei" (i an to cin < FROM_DATE)
    if (cout >= FROM_DATE && monthTabName_(cout) !== monthTabName_(cin)) {
      upsert_(ev + '|CONT', mkRow(ev + '|CONT'), cout);
    }

    // Auto Mid-Cleaning (oxi gia owner stays)
    if (cin && !isOwnerStay) {
      var mcDays = midCleanDays_(b[M.NIGHTS]);
      for (var md = 0; md < mcDays.length; md++) {
        var mcDate = addDays_(cin, mcDays[md]);
        if (mcDate < FROM_DATE) continue;
        var mcId = ev + '|MC' + mcDays[md];
        var mex = byId[mcId];
        var mman = {};
        for (var m2 = 0; m2 < S_MANUAL.length; m2++) mman[S_MANUAL[m2]] = mex ? mex.vals[S_MANUAL[m2]] : '';
        var mcRow = [
          b[M.RES], 'Mid-Cleaning', mcDate, mman[3], mcDate, mman[5], mman[6], '',
          mman[8], mman[9], b[M.NAME], mman[11], mman[12], mman[13], mman[14],
          mcId, new Date()
        ];
        upsert_(mcId, mcRow, mcDate);
      }
    }
  }

  // Diagrafi grammon pou metakinithikan (kato pros ta pano)
  toDelete.sort(function(a, b){ return b.row - a.row; });
  for (var d2 = 0; d2 < toDelete.length; d2++) toDelete[d2].sh.deleteRow(toDelete[d2].row);

  // Prosthikes ana tab — nees grammes MPLE
  var addedTotal = 0;
  for (var tn in appendsByTab) {
    var sh2 = monthSheet_(ss, tn);
    var rows2 = appendsByTab[tn];
    sh2.getRange(sh2.getLastRow() + 1, 1, rows2.length, S_TOTAL).setValues(rows2).setBackground(COLOR_NEW);
    addedTotal += rows2.length;
  }

  // Katharismos: grammes me event_id pou den antistoixoun pia (akyromenes klp.)
  var delRows = [], sheetsC = ss.getSheets();
  for (var sc = 0; sc < sheetsC.length; sc++) {
    var shc = sheetsC[sc];
    if (!MONTH_TAB_RE.test(shc.getName())) continue;
    var lc = shc.getLastRow(); if (lc < 2) continue;
    var vc = shc.getRange(2, 1, lc - 1, S_TOTAL).getValues();
    for (var ic = 0; ic < vc.length; ic++) {
      var evc = vc[ic][S_EVENT];
      if (!evc) continue;
      if (!syncedIds[evc]) delRows.push({ sh: shc, row: 2 + ic });
    }
  }
  delRows.sort(function(a, b){ return b.row - a.row; });
  for (var dd = 0; dd < delRows.length; dd++) delRows[dd].sh.deleteRow(delRows[dd].row);

  // Diagrafi adeion miniaion tabs
  sheetsC = ss.getSheets();
  for (var se = sheetsC.length - 1; se >= 0; se--) {
    if (MONTH_TAB_RE.test(sheetsC[se].getName()) && sheetsC[se].getLastRow() < 2 && ss.getSheets().length > 1) {
      ss.deleteSheet(sheetsC[se]);
    }
  }

  // Taksinomisi + morfi imerominion + auto-prasinisma oloklirwmenon
  sortMonthTabs_(ss);
  var sheets2 = ss.getSheets();
  for (var s2 = 0; s2 < sheets2.length; s2++) {
    if (!MONTH_TAB_RE.test(sheets2[s2].getName())) continue;
    var lr = sheets2[s2].getLastRow();
    if (lr > 2) sheets2[s2].getRange(2, 1, lr - 1, S_TOTAL).sort({ column: 3, ascending: true });
    normalizeDateCols_(sheets2[s2]);   // strings dd/mm i mm/dd -> pragmatika Dates
    if (lr > 1) {
      sheets2[s2].getRange(2, 3, lr - 1, 1).setNumberFormat('dd/MM/yyyy');   // Check-in
      sheets2[s2].getRange(2, 5, lr - 1, 1).setNumberFormat('dd/MM/yyyy');   // Check-out
    }
    // To prasinisma/asprisma ginetai pia LIVE apo ta conditional formats (applyScheduleColors_)
  }

  logRow_('SYNC', updated + addedTotal, 'updated=' + updated + ' added=' + addedTotal + ' moved=' + moved + ' removed=' + delRows.length);
  if (!silent) SpreadsheetApp.getUi().alert('Sync OK\nNew: ' + addedTotal + '\nUpdated: ' + updated + '\nMoved: ' + moved + '\nRemoved: ' + delRows.length);
}

function syncFromMasterAuto() { syncFromMaster(true); }

// Prasinizei grammes me check-out prin apo simera (= 1+ mera meta tin anaxorisi).
// MONO me pragmatika Dates (meta to normalizeDateCols_) — kamia amfivoli metatropi.
function paintCompleted_(sh) {
  var last = sh.getLastRow(); if (last < 2) return;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var hint = tabMonth_(sh.getName());
  var n = last - 1;
  var rng = sh.getRange(2, 1, n, S_TOTAL);
  var vals = rng.getValues();
  var bgs = rng.getBackgrounds();
  var dirty = false;
  for (var i = 0; i < n; i++) {
    var d = toDate_(vals[i][4], hint);
    if (!d) continue;
    d = new Date(d); d.setHours(0, 0, 0, 0);
    if (d.getTime() >= today.getTime()) continue;                 // oxi akoma teleiwmeni
    if (String(bgs[i][0]).toLowerCase() === COLOR_DONE) continue; // idi prasini
    for (var j = 0; j < S_TOTAL; j++) bgs[i][j] = COLOR_DONE;
    dirty = true;
  }
  if (dirty) rng.setBackgrounds(bgs);
}

function sortMonthTabs_(ss) {
  var sheets = ss.getSheets();
  var monthTabs = [];
  for (var s = 0; s < sheets.length; s++) {
    var name = sheets[s].getName();
    if (!MONTH_TAB_RE.test(name)) continue;
    var parts = name.split(' ');
    var mi = MONTHS_GR.indexOf(parts[0]);
    monthTabs.push({ sh: sheets[s], key: Number(parts[1]) * 100 + mi });
  }
  monthTabs.sort(function(a, b){ return a.key - b.key; });
  for (var i = 0; i < monthTabs.length; i++) {
    ss.setActiveSheet(monthTabs[i].sh);
    ss.moveActiveSheet(i + 1);
  }
}

// Sygkrinei mono tis AUTO sthles (2 & 4 = imerominies)
function autoChanged_(oldVals, newRow) {
  // 8 (Guests) & 11 (Phone) sygkrinontai kanonika: to mkRow exei idi apofasisei
  // an tha kratisei to keimeno tis omadas i tha akolouthisei to Master.
  var AUTO = [0, 1, 2, 4, 7, 8, 10, 11];
  for (var j = 0; j < AUTO.length; j++) {
    var k = AUTO[j];
    var a = (k === 2 || k === 4) ? dKey_(oldVals[k]) : String(oldVals[k]);
    var b = (k === 2 || k === 4) ? dKey_(newRow[k]) : String(newRow[k]);
    if (a !== b) return true;
  }
  return false;
}

// -- 0b. ONE-OFF IMPORT apo to PALIO Schedule 2026 ---------------------------------

function importOldSchedule() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var old = SpreadsheetApp.openById(OLD_SCHEDULE_ID);
  var sheets = old.getSheets();
  var byNameDate = {}, byPropDate = {}, byTokenDate = {}, tabsRead = [], tabsSkipped = [], ownerRows = [];

  var HDR_KEYS = ['property','villa','residence','channel','check','guest','name','nights','passport','phone','whatsapp','comment','nationality'];
  function headerScore_(rowArr) {
    var j = rowArr.join('|').toLowerCase(), sc = 0;
    for (var k = 0; k < HDR_KEYS.length; k++) if (j.indexOf(HDR_KEYS[k]) > -1) sc++;
    return sc;
  }
  function nameCol_(H) {
    var i, h;
    for (i = 0; i < H.length; i++) { h = String(H[i]).trim().toLowerCase(); if (h.indexOf('guest name') > -1) return i; }
    for (i = 0; i < H.length; i++) { h = String(H[i]).trim().toLowerCase(); if (h && h.indexOf('name') > -1 && h.indexOf('passport') === -1) return i; }
    for (i = 0; i < H.length; i++) { h = String(H[i]).trim().toLowerCase(); if (h && h.indexOf('guest') > -1 && h.indexOf('email') === -1) return i; }
    return -1;
  }

  for (var s = 0; s < sheets.length; s++) {
    var vals, bgs, hr = -1, H = null;
    try {
      var rngX = sheets[s].getDataRange();
      vals = rngX.getValues();
      bgs  = rngX.getBackgrounds();
    } catch (e) { tabsSkipped.push(sheets[s].getName()); continue; }
    for (var r = 0; r < Math.min(vals.length, 12); r++) {
      if (headerScore_(vals[r]) >= 3) { hr = r; H = vals[r]; break; }
    }
    if (hr === -1 || nameCol_(H) === -1) { tabsSkipped.push(sheets[s].getName()); continue; }
    tabsRead.push(sheets[s].getName());

    var col = function(name){ for (var i=0;i<H.length;i++){ if (String(H[i]).trim().toLowerCase().indexOf(name) > -1) return i; } return -1; };
    var propCol = col('property'); if (propCol === -1) propCol = col('villa'); if (propCol === -1) propCol = col('residence');
    var coutCol = -1;
    for (var i5 = 0; i5 < H.length; i5++) {
      var h5 = String(H[i5]).trim().toLowerCase();
      if ((h5 === 'checkout' || h5 === 'check-out' || h5 === 'check out') && h5.indexOf('time') === -1) { coutCol = i5; break; }
    }
    var O = {
      prop: propCol, cin: col('check-in') > -1 ? col('check-in') : col('check in'),
      cinTime: col('check in time'), coutTime: col('check out time'),
      cout: coutCol, chan: col('channel'),
      follow: col('follow'), name: nameCol_(H), guests: col('guests'),
      phone: col('phone'), wa: col('whatsapp'), com: col('comment'),
      fam: col('family'), age: col('age')
    };
    if (O.cin === O.cinTime) { for (var i2=0;i2<H.length;i2++){ var h2=String(H[i2]).trim().toLowerCase(); if ((h2==='check-in'||h2==='check in'||h2==='checkin') && i2!==O.cinTime) { O.cin=i2; break; } } }
    if (O.cin === -1) { for (var i4=0;i4<H.length;i4++){ var h4=String(H[i4]).trim().toLowerCase(); if (h4.indexOf('check') > -1 && h4.indexOf('out') === -1 && h4.indexOf('time') === -1) { O.cin = i4; break; } } }

    for (var r2 = hr + 1; r2 < vals.length; r2++) {
      var row = vals[r2];
      if (!row[O.name]) continue;
      var dk = dKey_(row[O.cin]);
      if (!dk) continue;
      var rec = {
        cinTime: O.cinTime > -1 ? timeStr_(row[O.cinTime]) : '',
        coutTime: O.coutTime > -1 ? timeStr_(row[O.coutTime]) : '',
        follow: O.follow > -1 ? row[O.follow] : '', guests: O.guests > -1 ? row[O.guests] : '',
        phone: O.phone > -1 ? row[O.phone] : '', wa: O.wa > -1 ? row[O.wa] : '',
        com: O.com > -1 ? row[O.com] : '',
        fam: O.fam > -1 ? row[O.fam] : '', age: O.age > -1 ? row[O.age] : '',
        bg: String(bgs[r2][O.name] || '').toLowerCase()
      };

      // Owner arrivals apo to palio arxeio -> tha prostethoun os manual grammes
      var chanV = O.chan > -1 ? String(row[O.chan] || '') : '';
      if (/owner/i.test(chanV) && dk >= FROM_DATE) {
        ownerRows.push({
          prop: row[O.prop] || '', cin: dk,
          cout: O.cout > -1 ? dKey_(row[O.cout]) : '',
          cinTime: rec.cinTime, coutTime: rec.coutTime, follow: rec.follow, guests: rec.guests,
          com: rec.com, name: row[O.name] || '', phone: rec.phone,
          wa: rec.wa, fam: rec.fam, age: rec.age
        });
        continue;   // den einai kratisi pros tairiasma
      }
      var kName = normName_(row[O.name]) + '|' + dk;
      if (!byNameDate[kName]) byNameDate[kName] = rec;
      // Tokens onomatos (>=4 xaraktires) gia xalara antistoixisi ("VASILIS" ~ "Vassilis" oxi, alla "BONIOS" nai)
      var toks = String(row[O.name] || '').split(/[^A-Za-zΑ-Ωα-ωάέήίόύώϊϋΐΰ]+/);
      for (var tk = 0; tk < toks.length; tk++) {
        var t = normName_(toks[tk]);
        if (t.length < 4) continue;
        var kT = t + '|' + dk;
        if (byTokenDate[kT] === undefined) byTokenDate[kT] = rec;
        else if (byTokenDate[kT] && byTokenDate[kT] !== rec) byTokenDate[kT] = null;   // diplotypo -> mi asfales
      }
      if (O.prop > -1) {
        var kProp = normName_(row[O.prop]) + '|' + dk;
        if (!byPropDate[kProp]) byPropDate[kProp] = rec;
      }
    }
  }
  if (!tabsRead.length) { SpreadsheetApp.getUi().alert('Den vrethike kanena tab sto palio Schedule.'); return; }

  // v5 indices: 3 cinTime, 5 coutTime, 6 follow, 8 guests, 9 comments, 11 phone, 12 wa, 13 fam, 14 age
  var PAIRS = [[3,'cinTime'],[5,'coutTime'],[6,'follow'],[8,'guests'],[9,'com'],[11,'phone'],[12,'wa'],[13,'fam'],[14,'age']];
  var filled = 0, matchedRows = 0;
  var sheets2 = ss.getSheets();
  for (var s2 = 0; s2 < sheets2.length; s2++) {
    var sh = sheets2[s2];
    if (!MONTH_TAB_RE.test(sh.getName())) continue;
    var last = sh.getLastRow();
    if (last < 2) continue;
    var vals2 = sh.getRange(2, 1, last - 1, S_TOTAL).getValues();
    for (var i3 = 0; i3 < vals2.length; i3++) {
      var b = vals2[i3];
      if (!b[S_EVENT]) continue;
      var dk2 = dKey_(b[2]);
      // 1) akrivos onoma+date  2) token onomatos+date  3) property+date (kai me merikO tairiasma)
      var rec2 = byNameDate[normName_(b[10]) + '|' + dk2] || null;
      if (!rec2) {
        var toks2 = String(b[10] || '').split(/[^A-Za-zΑ-Ωα-ωάέήίόύώϊϋΐΰ]+/);
        for (var t2 = 0; t2 < toks2.length && !rec2; t2++) {
          var tt = normName_(toks2[t2]);
          if (tt.length < 4) continue;
          var cand = byTokenDate[tt + '|' + dk2];
          if (cand) rec2 = cand;
        }
      }
      if (!rec2) rec2 = byPropDate[normName_(b[0]) + '|' + dk2] || null;
      if (!rec2) {
        var pn = normName_(b[0]);
        for (var kk in byPropDate) {
          var sep = kk.lastIndexOf('|');
          if (kk.slice(sep + 1) !== dk2) continue;
          var kp = kk.slice(0, sep);
          if (kp && pn && (pn.indexOf(kp) === 0 || kp.indexOf(pn) === 0)) { rec2 = byPropDate[kk]; break; }
        }
      }
      if (!rec2) continue;
      matchedRows++;
      var dirty = false;
      for (var p = 0; p < PAIRS.length; p++) {
        var si = PAIRS[p][0], f = PAIRS[p][1];
        if (String(b[si] || '') === '' && String(rec2[f] || '') !== '') { b[si] = rec2[f]; filled++; dirty = true; }
      }
      if (dirty) sh.getRange(2 + i3, 1, 1, S_TOTAL).setValues([b]);
      if (rec2.bg && rec2.bg !== '#ffffff' && rec2.bg !== 'white') {
        sh.getRange(2 + i3, 1, 1, S_TOTAL).setBackground(rec2.bg);
      }
    }
  }
  // Prosthiki Owner arrivals os manual grammes (xoris event_id) — mono oses den yparxoun idi
  var ownersAdded = 0;
  if (ownerRows.length) {
    // Yparxouses owner grammes ana (property|cin)
    var existingOwn = {};
    var shAll = ss.getSheets();
    for (var so = 0; so < shAll.length; so++) {
      if (!MONTH_TAB_RE.test(shAll[so].getName())) continue;
      var lo = shAll[so].getLastRow(); if (lo < 2) continue;
      var vo = shAll[so].getRange(2, 1, lo - 1, S_TOTAL).getValues();
      for (var io = 0; io < vo.length; io++) {
        if (!/owner/i.test(String(vo[io][1] || ''))) continue;
        existingOwn[normName_(vo[io][0]) + '|' + dKey_(vo[io][2])] = 1;
      }
    }
    for (var ow = 0; ow < ownerRows.length; ow++) {
      var o2 = ownerRows[ow];
      if (existingOwn[normName_(o2.prop) + '|' + o2.cin]) continue;
      var tabN = monthTabName_(o2.cin);
      if (!tabN) continue;
      var shO = monthSheet_(ss, tabN);
      var oNights = '';
      if (o2.cout) {
        var nd = Math.round((new Date(o2.cout + 'T12:00:00') - new Date(o2.cin + 'T12:00:00')) / 86400000);
        if (nd > 0) oNights = nd;
      }
      shO.appendRow([
        o2.prop, 'Owner', new Date(o2.cin + 'T12:00:00'), o2.cinTime,
        o2.cout ? new Date(o2.cout + 'T12:00:00') : '', o2.coutTime || '', o2.follow, oNights,
        o2.guests, o2.com, o2.name, o2.phone, o2.wa || '', o2.fam || '', o2.age || '', '', ''
      ]);
      ownersAdded++;
    }
  }

  logRow_('IMPORT_OLD', filled, 'tabs=' + tabsRead.join(',') + ' skipped=' + tabsSkipped.join(',') + ' matchedRows=' + matchedRows + ' owners=' + ownersAdded);
  SpreadsheetApp.getUi().alert('Import OK\nTabs read (old): ' + tabsRead.join(', ') + '\nTabs SKIPPED: ' + (tabsSkipped.join(', ') || '-') + '\nMatched rows: ' + matchedRows + '\nCells filled: ' + filled + '\nOwner arrivals added: ' + ownersAdded);
}

// -- 0c. FIX TIME COLUMNS (one-off) ------------------------------------------------

function fixTimeColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var fixed = 0;
  var TIME_COLS = [4, 6];   // 1-based: Check in Time, Check out Time
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    if (!MONTH_TAB_RE.test(sh.getName())) continue;
    var last = sh.getLastRow(); if (last < 2) continue;
    for (var c = 0; c < TIME_COLS.length; c++) {
      var rng = sh.getRange(2, TIME_COLS[c], last - 1, 1);
      var vals = rng.getValues();
      var dirty = false;
      for (var i = 0; i < vals.length; i++) {
        if (Object.prototype.toString.call(vals[i][0]) === '[object Date]') {
          vals[i][0] = timeStr_(vals[i][0]); fixed++; dirty = true;
        }
      }
      if (dirty) { rng.setNumberFormat('@'); rng.setValues(vals); }
    }
  }
  SpreadsheetApp.getUi().alert('Fixed ' + fixed + ' time cells se "HH:mm".');
}

// -- 0e. FIX FUTURE GREENS (one-off): prasines grammes me check-in sto mellon -> lefkes

function fixFutureGreens() {
  var GREENS = ['#d9ead3','#b6d7a8','#93c47d','#6aa84f','#38761d','#274e13','#00ff00','#b7e1cd','#a8d08d'];
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var fixed = 0;
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    if (!MONTH_TAB_RE.test(sh.getName())) continue;
    var last = sh.getLastRow(); if (last < 2) continue;
    var hint = tabMonth_(sh.getName());
    var rng = sh.getRange(2, 1, last - 1, S_TOTAL);
    var vals = rng.getValues();
    var bgs = rng.getBackgrounds();
    for (var i = 0; i < vals.length; i++) {
      var d = toDate_(vals[i][4], hint);                        // check-out
      if (!d) continue;
      d = new Date(d); d.setHours(0, 0, 0, 0);
      if (d.getTime() < today.getTime()) continue;              // pragmatika teleiwmeni -> asto prasino
      var bg = String(bgs[i][0] || '').toLowerCase();           // xroma 1is stilis (row-uniform)
      if (GREENS.indexOf(bg) > -1) {
        sh.getRange(2 + i, 1, 1, S_TOTAL).setBackground('#FFFFFF');
        fixed++;
      }
    }
  }
  SpreadsheetApp.getUi().alert('Katharistikan ' + fixed + ' lathos prasines grammes.');
}

// -- 2. DAILY AUTO-SYNC -------------------------------------------------------------

function createDailyTrigger() {
  removeDailyTrigger_();
  ScriptApp.newTrigger('syncFromMasterAuto').timeBased().everyDays(1).atHour(AUTO_HOUR).create();
  SpreadsheetApp.getUi().alert('Auto-sync ON, daily ~' + AUTO_HOUR + ':00 (meta to Master sync ton 7:00)');
}
function removeDailyTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === 'syncFromMasterAuto') ScriptApp.deleteTrigger(t); });
}
function disableDailyTrigger() { removeDailyTrigger_(); SpreadsheetApp.getUi().alert('Auto-sync OFF.'); }

// -- MENU ----------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Schedule')
    .addItem('0a. Setup / Migrate columns', 'setupSchedule')
    .addItem('1. Sync from Master', 'syncFromMaster')
    .addItem('0b. Import from OLD Schedule (once)', 'importOldSchedule')
    .addItem('0c. Fix time columns (once)', 'fixTimeColumns')
    .addItem('0e. Fix future greens (once)', 'fixFutureGreens')
    .addSeparator()
    .addItem('2. Auto-sync ON', 'createDailyTrigger')
    .addItem('2. Auto-sync OFF', 'disableDailyTrigger')
    .addToUi();
}
