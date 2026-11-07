/**
 * SOMNIO — Owner Invoicing  (fylo: "Somnio — Owner Invoicing")
 * Trofodoteitai apo to Bookings (Master File) kai kratal to tracking
 * timologisis pros idioktites (Εταιρεία / Φυσικό — oxi «Δικό μας»).
 *
 * Roi:
 *   1. pushInvoicing()      — kathimerina (kai meta apo kathe sync): rebuild + merge
 *                             ana event_id. Ta xeirokinita pedia (Email_Sent, Paid, Notes)
 *                             DIATIROUNTAI. Ftiaxnei kai etoimo Email_Draft ana grammi.
 *   2. migrateFromClients() — ONE-OFF: fernei to istoriko apo to "2026_Movie Collection"
 *                             (tab Clients): email sent + Paid. (Ta AADE/Receipt einai
 *                             flow parastatikon episkepti sta dika mas spitia — ektos.)
 *
 * Xreiazetai to Master_File.gs sto idio project (TAB_BOOKINGS, TOTAL_COLS,
 * EVENT_IDX, VIS_IDX, PASSPORT_IDX, logRow_, masterSheet_, normOwner_).
 */

var OWNER_INV_ID = '19qydlAK68jlcObVo7yxntuYkAFMEVzUadv5Z9vy4WfA';   // "Somnio — Owner Invoicing"
var MOVIE_ID     = '1ZT7JKnpe9aMHUFRJr7Lf7paNqKRW2SZn_ulZ6v_OgJM';   // "2026_Movie Collection"

var INV_TAB      = 'Invoicing';
var INV_SUMMARY  = 'Summary';
var INV_UNMATCH  = 'Αταίριαστα';

var INV_COLS = ['Month','Check_in','Check_out','Nights','Residence','Guest','Passport_AFM',
  'Platform','Owner_Type','Owner_Name','Owner_Email','Accountant_Email','Greeting_Name',
  'Net_Price','VAT','City_Tax','Env_Fee',
  'Comm_Base','Comm_20pct','Comm_VAT','Comm_Total','Status','Παραστατικό',
  'Email_Subject','Email_Draft','Elorus_Περιγραφή',
  'Email_Sent','Paid','Notes','event_id','synced_at'];

var INV_STATUS_IDX  = 21;   // 0-based (stili V)
var INV_DOC_IDX     = 22;   // Παραστατικό (Τιμολόγιο/Απόδειξη) — dipla sto Status
var INV_SUBJECT_IDX = 23;
var INV_DRAFT_IDX   = 24;
var INV_ELORUS_IDX  = 25;
var INV_MANUAL_FROM = 26;   // Email_Sent..Notes = 26..28
var INV_MANUAL_TO   = 28;
var INV_EVENT_IDX   = 29;

// -- SETUP ----------------------------------------------------------------------

function invFile_() { return SpreadsheetApp.openById(OWNER_INV_ID); }

function ensureInvTabs_(ext) {
  var sh = ext.getSheetByName(INV_TAB) || ext.insertSheet(INV_TAB);
  var curHdr = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  var salvaged = null;
  if (curHdr.join('|') !== INV_COLS.join('|')) {
    // Prin to reset: sose ta manual pedia (Email_Sent/Paid/Notes) ana event_id me vasi ta PALIA headers
    var lr = sh.getLastRow();
    if (lr > 1 && curHdr.length) {
      var col = {};
      for (var c = 0; c < curHdr.length; c++) col[String(curHdr[c])] = c;
      if (col.hasOwnProperty('event_id')) {
        salvaged = {};
        var oldVals = sh.getRange(2, 1, lr - 1, curHdr.length).getValues();
        for (var r = 0; r < oldVals.length; r++) {
          var oid = String(oldVals[r][col['event_id']] || '');
          if (!oid) continue;
          salvaged[oid] = [
            col.hasOwnProperty('Email_Sent') ? oldVals[r][col['Email_Sent']] : '',
            col.hasOwnProperty('Paid') ? oldVals[r][col['Paid']] : '',
            col.hasOwnProperty('Notes') ? oldVals[r][col['Notes']] : '',
            col.hasOwnProperty('Status') ? oldVals[r][col['Status']] : ''
          ];
        }
      }
    }
    sh.clear();                                    // allakse to schema -> fresko ksekinima me diasosi
    sh.getRange(1, 1, 1, INV_COLS.length).setValues([INV_COLS])
      .setFontWeight('bold').setBackground('#7A3E9D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  applyInvStatusColors_(sh);
  var sm = ext.getSheetByName(INV_SUMMARY) || ext.insertSheet(INV_SUMMARY);
  var un = ext.getSheetByName(INV_UNMATCH) || ext.insertSheet(INV_UNMATCH);
  if (un.getLastRow() === 0) un.appendRow(['Clients_row','Residence','Date','Name','Λόγος','Comments']);
  return { sh: sh, salvaged: salvaged };
}

function applyInvStatusColors_(sh) {
  // Xromatizei OLI ti grammi analoga me to Status (stili U = 21i, 0-based 20):
  // Prasino = OK | Kitrino = Pros timologisi | Gkri = Mellontiki | Kokkino = ELEGXOS
  var rng = sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), INV_COLS.length);
  function rule(formula, bg) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula)
      .setBackground(bg).setRanges([rng]).build();
  }
  // Prasino AMESOS an Status=OK *I* Email_Sent=NAI (xoris na perimenei push).
  // V = Status (22i stili), AA = Email_Sent (27i stili). Elinika kai latinika grammata.
  sh.setConditionalFormatRules([
    rule('=OR($V2="ΟΚ",$V2="OK",$AA2="ΝΑΙ",$AA2="NAI",$AA2="YES")', '#D9EAD3'),
    rule('=$V2="Προς τιμολόγηση"', '#FFF2A8'),
    rule('=$V2="Μελλοντική"', '#EFEFEF'),
    rule('=$V2="ΕΛΕΓΧΟΣ"', '#EA9999')
  ]);
}

// "OK" me ellinika i latinika grammata
function isOk_(s) {
  var t = String(s || '').trim().toUpperCase();
  return t === 'ΟΚ' || t === 'OK';
}

// -- HELPERS --------------------------------------------------------------------

function invDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  var m = String(v || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var g = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);   // dd/mm/yyyy text
  if (g) return new Date(Number(g[3]), Number(g[2]) - 1, Number(g[1]));
  return null;
}

function invStatus_(checkout, man) {
  var email = String(man[0] || '').trim();   // Email_Sent (= timologio ekdothike + email estali)
  var co = invDate_(checkout);
  var today = new Date(); today.setHours(0, 0, 0, 0);
  if (email) return 'ΟΚ';
  if (co && co > today) return 'Μελλοντική';
  return 'Προς τιμολόγηση';
}

function invPad_(n) { return n < 10 ? '0' + n : String(n); }

// Periodos se morfi "06-10.07" (i "28.06-02.07" an allazei minas)
function invPeriod_(ci, co) {
  var a = invDate_(ci), b = invDate_(co);
  if (!a && !b) return '';
  if (a && b) {
    if (a.getMonth() === b.getMonth()) return invPad_(a.getDate()) + '-' + invPad_(b.getDate()) + '.' + invPad_(a.getMonth() + 1);
    return invPad_(a.getDate()) + '.' + invPad_(a.getMonth() + 1) + '-' + invPad_(b.getDate()) + '.' + invPad_(b.getMonth() + 1);
  }
  var d = a || b;
  return invPad_(d.getDate()) + '.' + invPad_(d.getMonth() + 1);
}

function invEuro_(v) {
  var n = Number(v);
  if (v === '' || v == null || isNaN(n)) return '€0,00';
  return '€' + n.toFixed(2).replace('.', ',');
}

function invDMY_(v) {
  var d = invDate_(v);
  return d ? (invPad_(d.getDate()) + '.' + invPad_(d.getMonth() + 1) + '.' + d.getFullYear()) : '';
}

// Aitologia katathesis gia trapeza: "Property Name_Checkin_Checkout" XORIS "/"
// (oi trapezes den dexontai "/" stin aitiologia) — imerominies me teleies.
function invBankRef_(residence, ci, co) {
  var res = String(residence || '').replace(/\//g, '-').trim();
  return res + '_' + invDMY_(ci) + '_' + invDMY_(co);
}

// Etoimo keimeno email pros idioktiti (copy-paste).
// Τιμολόγιο (εταιρεία): me analysi poson. Απόδειξη (idiotis): XORIS posa —
// mono onoma, diavatirio, platforma, imerominies.
function invDraft_(platform, period, guest, passport, doc, net, vat, city, env, greet, ci, co, residence) {
  var plat = String(platform || '');
  if (plat === 'Airbnb') plat = 'Airbnb.com';
  var isReceipt = String(doc).toLowerCase().indexOf('απόδειξη') > -1;
  var docTxt = isReceipt ? 'την απόδειξη' : 'το τιμολόγιο';
  var viaPlatform = (plat.indexOf('Direct') > -1 || plat === 'Somnio Website')
    ? 'απευθείας (' + plat + ')'
    : 'μέσω της πλατφόρμας της ' + plat;
  var hi = String(greet || '').trim();
  var payInfo = '\n\nΠαρακαλώ πολύ τα έξοδα συναλλαγής να επιβαρύνουν τον εντολέα και αν μπορείτε να μας επισυνάψετε το αποδεικτικό της κατάθεσης.\n' +
    'Στην αιτιολογία της κατάθεσης παρακαλώ κάντε copy paste το παρακάτω:\n' +
    invBankRef_(residence, ci, co);
  var head = (hi ? 'Καλησπέρα ' + hi + ',\n\n' : 'Καλησπέρα,\n\n') +
    'Επισυναπτόμενα θα βρείτε τα στοιχεία για την κράτηση που έγινε ' + viaPlatform +
    ' για την περίοδο ' + period + ' καθώς και ' + docTxt + ' που αφορά την προμήθειά μας.\n\n' +
    'Όνομα Επισκέπτη: ' + guest + '\n' +
    'Διαβατήριο Κράτησης: ' + (passport || '—') + '\n' +
    'Πλατφόρμα: ' + plat + '\n' +
    'Check in: ' + invDMY_(ci) + '\n' +
    'Check out: ' + invDMY_(co);
  if (isReceipt) return head + payInfo;             // idiotis: xoris analysi poson
  return head + '\n\n' +
    'Date: ' + period + '\n' +
    'Guest: ' + guest + '\n' +
    'Net Price: ' + invEuro_(net) + '\n' +
    'VAT 13%: ' + invEuro_(vat) + '\n' +
    'City Tax 0,75%: ' + invEuro_(city) + '\n' +
    'Env Fee: ' + invEuro_(env) +
    payInfo;
}

// Perigrafi gia to parastatiko sto Elorus (copy-paste)
function invElorus_(ci, co, nights, residence) {
  return 'Check in : ' + invDMY_(ci) + '\n' +
    'Check out: ' + invDMY_(co) + '\n' +
    'Nights: ' + (nights || '') + '\n' +
    'Property: ' + residence;
}

// Owner_Type + Issue_Invoice ana Residence apo to Master Properties
function invMasterInfo_() {
  var map = {};
  try {
    var vals = masterSheet_().getDataRange().getValues();
    for (var r = 1; r < vals.length; r++) {
      var nm = String(vals[r][0] || '').trim().toLowerCase();
      if (nm) map[nm] = { ownerType: normOwner_(vals[r][2]), issueInvoice: String(vals[r][10] || ''),
        ownerName: String(vals[r][3] || ''), ownerEmail: String(vals[r][4] || ''),
        accEmail: String(vals[r][5] || ''), greet: String(vals[r][6] || '') };
    }
  } catch (e) {}
  return map;
}

// -- 1. PUSH --------------------------------------------------------------------

function pushInvoicing(silent) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bk = ss.getSheetByName(TAB_BOOKINGS);
  if (!bk) { if (!silent) SpreadsheetApp.getUi().alert('Den yparxei Bookings.'); return; }
  var ext = invFile_();
  var env0 = ensureInvTabs_(ext);
  var sh = env0.sh;

  // 1. Yparxonta manual pedia ana event_id (i diasosmena apo allagi schema)
  var manual = {};
  if (env0.salvaged) {
    for (var sk in env0.salvaged) manual[sk] = { man: env0.salvaged[sk].slice(0, 3), st: env0.salvaged[sk][3] || '', row: null, seen: false };
  } else {
    var last = sh.getLastRow();
    var old = last > 1 ? sh.getRange(2, 1, last - 1, INV_COLS.length).getValues() : [];
    for (var i = 0; i < old.length; i++) {
      var id = String(old[i][INV_EVENT_IDX] || '');
      if (id) manual[id] = { man: old[i].slice(INV_MANUAL_FROM, INV_MANUAL_TO + 1), st: old[i][INV_STATUS_IDX], row: old[i], seen: false };
    }
  }

  // 2. Fresko build apo Bookings
  var master = invMasterInfo_();
  var bLast = bk.getLastRow();
  var bv = bLast > 1 ? bk.getRange(2, 1, bLast - 1, TOTAL_COLS).getValues() : [];
  var out = [];
  for (var r = 0; r < bv.length; r++) {
    var ot = String(bv[r][27] || '');
    if (ot !== 'Εταιρεία' && ot !== 'Φυσικό') continue;             // mono diaxeirizomena
    if (String(bv[r][VIS_IDX]).toUpperCase() === 'FALSE') continue; // oxi akyromenes
    var id = String(bv[r][EVENT_IDX] || '');
    if (id.indexOf('DC|') === 0) continue;                          // OXI Direct Cash sto owner invoicing
    var mi = master[String(bv[r][5] || '').trim().toLowerCase()] || {};
    var man = ['', '', ''], stOld = '';
    if (manual[id]) { man = manual[id].man; stOld = manual[id].st; manual[id].seen = true; }
    var period = invPeriod_(bv[r][3], bv[r][4]);
    var doc = (ot === 'Εταιρεία') ? 'Τιμολόγιο' : 'Απόδειξη';
    out.push([
      bv[r][1], bv[r][3], bv[r][4], bv[r][7], bv[r][5], bv[r][8], bv[r][PASSPORT_IDX],
      bv[r][6], ot, mi.ownerName || '', mi.ownerEmail || '', mi.accEmail || '', mi.greet || '',
      bv[r][21], bv[r][22], bv[r][23], bv[r][24],
      bv[r][28], bv[r][29], bv[r][30], bv[r][31],
      (isOk_(stOld) ? 'ΟΚ' : invStatus_(bv[r][4], man)),   // xeirokinito OK diatireitai
      doc,
      'Πληροφορίες Κράτησης ' + period,
      invDraft_(bv[r][6], period, bv[r][8], bv[r][PASSPORT_IDX], doc, bv[r][21], bv[r][22], bv[r][23], bv[r][24], mi.greet, bv[r][3], bv[r][4], bv[r][5]),
      invElorus_(bv[r][3], bv[r][4], bv[r][7], bv[r][5]),
      man[0], man[1], man[2],
      id, new Date()
    ]);
  }

  // 3. Orfanes grammes me manual dedomena (px. akyrothike meta tin timologisi) -> ELEGXOS
  for (var k in manual) {
    if (manual[k].seen || !manual[k].row) continue;
    var m = manual[k];
    if (m.man.join('') !== '') { m.row[INV_STATUS_IDX] = 'ΕΛΕΓΧΟΣ'; out.push(m.row); }
  }

  // 4. Taksinomisi kata Check_out kai grapsimo
  out.sort(function(a, b) {
    var x = invDate_(a[2]), y = invDate_(b[2]);
    return (x ? x.getTime() : 0) - (y ? y.getTime() : 0);
  });
  var maxR = sh.getMaxRows();
  if (maxR > 1) sh.getRange(2, 1, maxR - 1, INV_COLS.length).clearContent();
  if (out.length) {
    sh.getRange(2, 1, out.length, INV_COLS.length).setValues(out);
    sh.getRange(2, 2, out.length, 2).setNumberFormat('dd/MM/yyyy');           // Check_in/out
    sh.getRange(2, 14, out.length, 8).setNumberFormat('#,##0.00');            // Net..Comm_Total (metatopismeno +1 logo Accountant_Email)
  }

  writeInvSummary_(ext, out);
  logRow_('PUSH_INVOICING', out.length, 'to Owner Invoicing');
  if (!silent) SpreadsheetApp.getUi().alert('Owner Invoicing OK — ' + out.length + ' grammes.');
}

function writeInvSummary_(ext, rows) {
  var sm = ext.getSheetByName(INV_SUMMARY); if (!sm) return;
  var agg = {};
  for (var i = 0; i < rows.length; i++) {
    var res = String(rows[i][4] || ''); if (!res) continue;
    var a = agg[res] = agg[res] || { ot: rows[i][8], toInv: 0, toInvSum: 0, ok: 0, fut: 0, unpaidSum: 0 };
    var st = rows[i][INV_STATUS_IDX], tot = Number(rows[i][19]) || 0;
    if (st === 'Προς τιμολόγηση') { a.toInv++; a.toInvSum += tot; }
    else if (st === 'ΟΚ') a.ok++;
    else if (st === 'Μελλοντική') a.fut++;
    var paid = String(rows[i][INV_MANUAL_FROM + 1] || '').trim();
    if (st === 'ΟΚ' && !paid) a.unpaidSum += tot;
  }
  var hdr = ['Residence','Owner_Type','Προς τιμολόγηση','Ποσό προς τιμολόγηση','ΟΚ','Μελλοντικές','Ανείσπρακτο (Comm_Total)'];
  var out = [hdr];
  var keys = Object.keys(agg).sort();
  var t = { toInv: 0, toInvSum: 0, ok: 0, fut: 0, unpaidSum: 0 };
  for (var j = 0; j < keys.length; j++) {
    var g = agg[keys[j]];
    out.push([keys[j], g.ot, g.toInv, Math.round(g.toInvSum * 100) / 100, g.ok, g.fut, Math.round(g.unpaidSum * 100) / 100]);
    t.toInv += g.toInv; t.toInvSum += g.toInvSum; t.ok += g.ok; t.fut += g.fut; t.unpaidSum += g.unpaidSum;
  }
  out.push(['ΣΥΝΟΛΟ', '', t.toInv, Math.round(t.toInvSum * 100) / 100, t.ok, t.fut, Math.round(t.unpaidSum * 100) / 100]);
  sm.clearContents();
  sm.getRange(1, 1, out.length, hdr.length).setValues(out);
  sm.getRange(1, 1, 1, hdr.length).setFontWeight('bold').setBackground('#7A3E9D').setFontColor('#FFFFFF');
  sm.getRange(out.length, 1, 1, hdr.length).setFontWeight('bold');
  sm.setFrozenRows(1);
}

// -- 2. MIGRATION apo Clients (Movie Collection) — ONE-OFF ------------------------

function invPropKey_(name) {
  var s = String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (s.indexOf('yagha') > -1) return 'yagha';
  if (s.indexOf('thymari') > -1) return 'thymari';
  if (s.indexOf('windmill') > -1 || s.indexOf('orig') > -1) return 'origin';
  if (s.indexOf('jasper') > -1) return 'jasper';
  if (s.indexOf('piperi') > -1) return 'piperi';
  if (s.indexOf('islander') > -1) return 'islander';
  if (s.indexOf('caper') > -1) return 'caper';
  if (s.indexOf('peppermint') > -1) return (s.indexOf(' ii') > -1 || s.indexOf(' 2') > -1) ? 'peppermintii' : 'peppermint';
  if (s.indexOf('solasta') > -1) return 'solasta';
  if (s.indexOf('citrine') > -1) return 'citrine';
  if (s.indexOf('white') > -1) return 'whiteheaven';
  if (s.indexOf('mirabilia') > -1) return 'mirabilia';
  if (s.indexOf('vireya') > -1) return 'vireya';
  if (s.indexOf('pearl') > -1) return 'coralpearl';
  if (s.indexOf('blue coral') > -1) return (s.indexOf('2') > -1) ? 'bluecoral2' : 'bluecoral1';
  if (s.indexOf('fiora') > -1) return (s.indexOf(' ii') > -1 || /fiora\s*2/.test(s)) ? 'fioraii' : 'fiora1';
  if (s.indexOf('hara') > -1) return 'hara';
  if (s.indexOf('candia') > -1) return 'candia';
  if (s.indexOf('olea') > -1) return 'olea';
  if (s.indexOf('pepperleaf') > -1 || (s.indexOf('walk') > -1 && s.indexOf('naousa') > -1)) return 'pepperleaf';
  return s.replace(/[^a-z0-9]/g, '');
}

function invPad2_(x) { x = String(x || '').replace(/\D/g, ''); return x.length < 2 ? ('0' + x) : x; }

// "08-13.07" / "20-22.03" / "30.06-05.07" -> "MM-DD" tou check-in
function invManCheckin_(ds) {
  ds = String(ds || '').trim(); if (!ds) return '';
  var m = ds.match(/^(\d{1,2})\.(\d{1,2})\s*-/);                    // DD.MM-...
  if (m) return invPad2_(m[2]) + '-' + invPad2_(m[1]);
  m = ds.match(/^(\d{1,2})\s*-\s*(\d{1,2})\.(\d{1,2})/);            // DD-DD.MM
  if (m) {
    var sd = Number(m[1]), ed = Number(m[2]), mo = Number(m[3]);
    if (sd > ed) { mo -= 1; if (mo < 1) mo = 12; }
    return invPad2_(mo) + '-' + invPad2_(sd);
  }
  return '';
}

function invBkCheckin_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return invPad2_(v.getMonth() + 1) + '-' + invPad2_(v.getDate());
  var m = String(v || '').match(/\d{4}-(\d{2})-(\d{2})/);
  return m ? (m[1] + '-' + m[2]) : '';
}

function invNameTokens_(s) {
  return String(s || '').toLowerCase().match(/[a-zα-ωάέήίόύώϊϋ]{3,}/g) || [];
}

function migrateFromClients() {
  var ext = invFile_();
  var sh = ensureInvTabs_(ext).sh;
  var last = sh.getLastRow();
  if (last < 2) { SpreadsheetApp.getUi().alert('Trekse prota to Push (menu 4).'); return; }
  var inv = sh.getRange(2, 1, last - 1, INV_COLS.length).getValues();

  // Index tou Invoicing
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bk = ss.getSheetByName(TAB_BOOKINGS);
  var bv = bk.getRange(2, 1, bk.getLastRow() - 1, TOTAL_COLS).getValues();
  var codeToEvent = {}, cancByKey = {};
  for (var i = 0; i < bv.length; i++) {
    var code = String(bv[i][2] || '').trim();
    if (code) codeToEvent[code] = String(bv[i][EVENT_IDX] || '');
    if (String(bv[i][VIS_IDX]).toUpperCase() === 'FALSE') {
      cancByKey[invPropKey_(bv[i][5]) + '|' + invBkCheckin_(bv[i][3])] = 1;
    }
  }
  var byEvent = {}, byResDate = {}, byResName = {};
  for (var j = 0; j < inv.length; j++) {
    var id = String(inv[j][INV_EVENT_IDX] || '');
    if (id) byEvent[id] = j;
    var pk = invPropKey_(inv[j][4]);
    var kd = pk + '|' + invBkCheckin_(inv[j][1]);
    (byResDate[kd] = byResDate[kd] || []).push(j);
    (byResName[pk] = byResName[pk] || []).push(j);
  }

  // Diavase Clients
  var mv = SpreadsheetApp.openById(MOVIE_ID);
  var clSh = mv.getSheetByName('Clients');
  if (!clSh) { SpreadsheetApp.getUi().alert('Den vrethike tab Clients sto Movie Collection.'); return; }
  var cv = clSh.getDataRange().getValues();
  var H = -1, C = {};
  for (var r = 0; r < Math.min(cv.length, 6); r++) {
    if (cv[r].join('|').indexOf('Confirmation_Code') > -1) {
      H = r;
      for (var c = 0; c < cv[r].length; c++) {
        var h = String(cv[r][c] || '').trim();
        if (h === 'Confirmation_Code') C.code = c;
        else if (h === 'Date') C.date = c;
        else if (h === 'Residence') C.res = c;
        else if (h === 'Name') C.name = c;
        else if (h === 'Platform') C.plat = c;
        else if (h === 'Paid') C.paid = c;
        else if (h === 'Comments') C.comments = c;
      }
      break;
    }
  }
  if (H < 0) { SpreadsheetApp.getUi().alert('Den vrethike header sto Clients.'); return; }

  // Dika mas spitia: den aforoun to owner invoicing
  var ownKeys = {};
  try {
    var mvals = masterSheet_().getDataRange().getValues();
    for (var om = 1; om < mvals.length; om++) {
      if (normOwner_(mvals[om][2]) === 'Δικό μας') ownKeys[invPropKey_(mvals[om][0])] = 1;
    }
  } catch (e) {}

  function setIfEmpty(rowIdx, col0, val) {
    if (val && String(inv[rowIdx][col0] || '').trim() === '') { inv[rowIdx][col0] = val; return 1; }
    return 0;
  }

  var applied = 0, unmatched = [];
  for (var r2 = H + 1; r2 < cv.length; r2++) {
    var row = cv[r2];
    if (!row[C.res]) continue;
    if (ownKeys[invPropKey_(row[C.res])]) continue;                    // diko mas -> ektos
    if (/direct/i.test(String(row[C.plat] || ''))) continue;           // Direct/Direct Cash -> ektos owner invoicing
    var comments = String(row[C.comments] || '');
    var emailSent = comments.toLowerCase().indexOf('email sent') > -1;
    var paidV = String(row[C.paid] || '').trim();
    if (!emailSent && !paidV && !comments.trim()) continue;            // xoris sima gia owners

    // 1. me Confirmation_Code -> event_id
    var hit = -1, code2 = String(row[C.code] || '').trim();
    if (code2 && codeToEvent[code2] && byEvent.hasOwnProperty(codeToEvent[code2])) hit = byEvent[codeToEvent[code2]];
    // 2. me residence + check-in
    if (hit < 0) {
      var kd2 = invPropKey_(row[C.res]) + '|' + invManCheckin_(row[C.date]);
      var cands = byResDate[kd2] || [];
      if (cands.length === 1) hit = cands[0];
      else if (cands.length > 1) {
        var nt0 = invNameTokens_(row[C.name]);
        var f = cands.filter(function(ix) {
          var gt = invNameTokens_(inv[ix][5]);
          return nt0.some(function(t) { return gt.indexOf(t) > -1; });
        });
        if (f.length === 1) hit = f[0];
      }
    }
    // 3. me residence + monadiko onoma
    if (hit < 0) {
      var nt = invNameTokens_(row[C.name]);
      var pool = byResName[invPropKey_(row[C.res])] || [];
      var f2 = pool.filter(function(ix) {
        var gt = invNameTokens_(inv[ix][5]);
        return nt.some(function(t) { return gt.indexOf(t) > -1; });
      });
      if (f2.length === 1) hit = f2[0];
    }

    if (hit < 0) {
      var wasCanc = cancByKey[invPropKey_(row[C.res]) + '|' + invManCheckin_(row[C.date])];
      unmatched.push([r2 + 1, row[C.res], String(row[C.date] || ''), row[C.name],
        wasCanc ? 'Ακυρωμένη στο Hosthub' : 'Δεν βρέθηκε στο Bookings', comments]);
      continue;
    }

    var n = 0;
    n += setIfEmpty(hit, INV_MANUAL_FROM, emailSent ? 'ΝΑΙ' : '');
    n += setIfEmpty(hit, INV_MANUAL_FROM + 1, paidV ? (paidV.toLowerCase() === 'ok' ? 'ΝΑΙ' : paidV) : '');
    n += setIfEmpty(hit, INV_MANUAL_FROM + 2, comments.trim());
    if (n) applied++;
  }

  // Ksana-ypologise Status kai grapse
  for (var q = 0; q < inv.length; q++) {
    if (inv[q][INV_STATUS_IDX] !== 'ΕΛΕΓΧΟΣ') {
      inv[q][INV_STATUS_IDX] = invStatus_(inv[q][2], inv[q].slice(INV_MANUAL_FROM, INV_MANUAL_TO + 1));
    }
  }
  sh.getRange(2, 1, inv.length, INV_COLS.length).setValues(inv);

  var un = ext.getSheetByName(INV_UNMATCH);
  if (un.getLastRow() > 1) un.getRange(2, 1, un.getLastRow() - 1, 6).clearContent();
  if (unmatched.length) un.getRange(2, 1, unmatched.length, 6).setValues(unmatched);

  writeInvSummary_(ext, inv);
  logRow_('MIGRATE_CLIENTS', applied, 'unmatched=' + unmatched.length);
  SpreadsheetApp.getUi().alert('Migration DONE\nΕνημερώθηκαν: ' + applied + ' κρατήσεις\nΑταίριαστα: ' + unmatched.length + ' (δες tab «Αταίριαστα»)');
}
