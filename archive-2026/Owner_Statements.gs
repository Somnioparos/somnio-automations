/**
 * SOMNIO — Owner Statements (STANDALONE bound script) — v2.7
 *
 * Allages v2.7 (8/9): sto block Σύνοψης ta Direct Cash kai Somnio Website XORISTA.
 * Somnio Website = declared, pane ston logariasmo tou owner (mono i promitheia
 * parakrateitai). ΕΠΙΣΤΡΟΦΗ = MONO Direct Cash − promitheia DC − eksoda ek merous tous.
 * SUMIF me wildcards ("*Cash*" kai "*Somnio*") gia symfonia me osWeCollect_.
 *
 * Allages v2.6 (8/8): ta SYNOLA (Σύνοψη-Εκκαθάριση & Αναφορά Εξόδων + pivot) grafontai
 * pia os ZONTANOI TYPOI (SUM/SUMIF) pou deixnoun stis grammes tou pinaka — oxi etoimoi
 * arithmoi. Oi grammes menoun times (opos erxontai apo to Master). Sto «2026 Έξοδα»
 * prostethike krymmeni stili G «Κατ.» (co/refund/own…) gia na doulevoun ta SUMIF tis
 * Αναφοράς. To «2026 Έξοδα» grafetai PRIN to «2026 Κρατήσεις» (to block anaferetai se I4).
 * v2.5 (8/8): orio «Κρατήσεις με check-out έως» (Μητρώο stili I).
 *
 * Allages v2.0 (6/8/2026 — «Εισπράξεις ανά κράτηση», egkrisi Tasou):
 *   - Sta property files, sto «2026 Κρατήσεις»: 2 NEES MANUAL stiles ana kratisi:
 *     «Εισπράχθηκε» (o,ti eisepraxthei gia tin kratisi) kai «Τραπεζικά έξοδα»
 *     (paravasi trapezas stin katathesi tou owner — ton varynoun). Diasozontai
 *     ana event_id (krymmeni stili K) se kathe rebuild.
 *   - To kentriko «Υπόλοιπα» ta mazevei apo OLA ta property files:
 *     ΜΑΣ ΧΡΩΣΤΑΝΕ = promitheies platformas + trapezika eksoda − eisprattmena.
 *   - To tab «Τράπεζα» KATARGITHIKE (svinetai an einai adeio).
 *
 * Allages v1.3-1.5 (6/8/2026, feedback Tasou apo ton pilato):
 *   - «Direct» (Hosthub) DEN metraei os Direct Cash — "eisprattoume emeis" MONO
 *     Direct Cash (DC|) kai Somnio Website.
 *   - Kratiseis: xoris stiles Ατομα / Νύχτες / ΦΠΑ 13% / Τέλη.
 *   - Eksoda: OLA ta eksoda tou property (oxi mono ta xrewstika owner), me stili
 *     «Χρεώνεται» (Debit_to) kai ΑΝΑΦΟΡΑ: Synolika / plironei & analamvanei Somnio /
 *     plironei Somnio ek merous pelati (epistrefontai) / plironei & varynetai pelatis.
 *   - Eisprakseis apo pelates (tab Τράπεζα/Υπόλοιπα): menoun os exoun, se 2ο xrono.
 * Zei MESA se neo arxeio "Somnio — Owner Statements" (Extensions > Apps Script).
 * PULL-ONLY: den aggizei pote Master File / Candy Recipes / Owner Invoicing.
 *
 * Ti kanei:
 *   A. Ena Google Sheet ANA AKINITO (opos to xeirokinito "New Villa Hara_Expenses"):
 *        - Tab «2026 Κρατήσεις»: apo Master Bookings, me stiles opos to protypo
 *          (Ποσό = Comm_Base + ΦΠΑ + Τέλη, oste Ποσό − ΦΠΑ − Τέλη = vasi promitheias).
 *          Status «Πληρώθηκε» apo Owner Invoicing ana event_id (Paid→ok, Email_Sent→email sent).
 *          Direct/DC MPAINOUN (apofasi 4/8) — ksexorista sti synopsi.
 *        - Tab «2026 Έξοδα»: apo Candy Recipes «Data Entry for P&L»,
 *          MONO oses grammes xreonontai ston owner (Debit_to ≠ Phoenix),
 *          me «Πληρώθηκε» = Paid_by. Dipla: synopsi ana Typo kai ana Pliromi.
 *        - Block ekkatharisis kato apo tis kratiseis:
 *            Epistrofi ston owner = Σ direct eisprakseon − promitheies (me ΦΠΑ) ton
 *            SYGKEKRIMENON direct kratiseon − eksoda paid by Phoenix/Somnio.
 *            Oi promitheies platformas ofeilontai APO ton owner (mesw trapezas).
 *   B. Tabs sto control sheet:
 *        - «Μητρώο»: poio akinito exei arxeio, file ID, Ενεργό (pilotos: mono Villa Hara).
 *        - «Τράπεζα»: MANUAL — epikollas kiniseis apo e-banking (Ημερομηνία, Περιγραφή,
 *          Ποσό, Property apo dropdown). DEN ksanagrafetai pote apo to script.
 *        - «Υπόλοιπα»: ana property: promitheies platformas (eos simera) − eisprakseis
 *          trapezas = mas xrostane · direct eisprakseis − promitheies − eksoda Phoenix =
 *          tous xrostame · KATHARO ypoloipo.
 *
 * Egatastasi (mia fora):
 *   1. Neo Google Sheet "Somnio — Owner Statements" (ston idio fakelo me ta alla).
 *   2. Extensions > Apps Script > epikollisi > Save > refresh to spreadsheet.
 *   3. Menu "Owner Statements" > "1. Αρχικοποίηση Μητρώου" (gemizei ta properties).
 *   4. Sto «Μητρώο» vale Ενεργό = TRUE sto Villa Hara Naousa (pilotos).
 *   5. Menu > "2. Ενημέρωση ενεργών αρχείων". To arxeio ftiaxnetai ston idio fakelo.
 */

var OS_MASTER_ID = '1XIZMBmY8aXxPiKR8y4vZyGICZN6MeS5rtRo01LW92UE';   // Somnio — Master File
var OS_PROPS_ID  = '1N2OegNP2eEVKkZlTokhXFmL5W0OkZ3VZDuedz3wXRFs';   // Somnio — Master Properties
var OS_CANDY_ID  = '1xZFPV6EaXE0fuOeSpnkrA8W137M7YRpRIDAlZSMP3iI';   // 2026_Candy_Recipes
var OS_INV_ID    = '19qydlAK68jlcObVo7yxntuYkAFMEVzUadv5Z9vy4WfA';   // Somnio — Owner Invoicing
var OS_COMPANY   = 'Phoenix';   // etairia: Debit_to/Paid_by pou "metraei os emeis" (kai 'Somnio')
var OS_YEAR      = 2026;

// Stiles Bookings sto Master — FALLBACK indexes (0-based, layout v3 41 stilon, 7/8).
// v2.2: oi tiles vriskontai PLEON APO TA HEADERS (osBookCols_) — ta fixed indexes
// espasan otan to Master pige apo 38 se 41 stiles (event_id 36->39, Guests ->36).
var OSB = { MONTH:1, CHECKIN:3, CHECKOUT:4, RESIDENCE:5, PLATFORM:6, NIGHTS:7, GUEST:8,
  PAYOUT:15, TOTAL_VALUE:16, BANK:18, SERVICE_FEE:19,
  NET:21, VAT:22, CITY:23, ENV:24, GROSS:26,
  OWNER_TYPE:27, COMM_BASE:28, COMM20:29, COMM_VAT:30, COMM_TOTAL:31,
  VISIBLE:33, EVENT_ID:39, GUESTS:36 };

// Antistoixisi onomaton header -> index. An kapoio onoma leipei, fallback sto OSB.
function osBookCols_(hdr) {
  var names = { MONTH:'Month', CHECKIN:'Check_in', CHECKOUT:'Check_out',
    RESIDENCE:'Residence', PLATFORM:'Platform', NIGHTS:'Nights', GUEST:'Guest name',
    PAYOUT:'Total payout', NET:'Net_Price', VAT:'VAT', CITY:'City_Tax', ENV:'Env_Fee',
    OWNER_TYPE:'Owner_Type', COMM_BASE:'Comm_Base', COMM20:'Comm_20pct',
    COMM_VAT:'Comm_VAT', COMM_TOTAL:'Comm_Total', VISIBLE:'is_visible',
    GUESTS:'Guests', EVENT_ID:'event_id' };
  var byName = {};
  for (var h = 0; h < hdr.length; h++) byName[String(hdr[h]).trim()] = h;
  var idx = {}, missing = [];
  for (var k in names) {
    if (byName.hasOwnProperty(names[k])) idx[k] = byName[names[k]];
    else { idx[k] = OSB[k]; missing.push(names[k]); }
  }
  if (missing.length) osLog_('HEADER_FALLBACK', missing.length, missing.join(', '));
  return idx;
}


var OS_TAB_REG   = 'Μητρώο';
var OS_TAB_BANK  = 'Τράπεζα';
var OS_TAB_BAL   = 'Υπόλοιπα';
var OS_TAB_LOG   = 'Log';

// v1.3 (6/8): xoris Ατομα / Νύχτες / ΦΠΑ 13% / Τέλη — apofasi Tasou.
// v2.0 (6/8): +2 MANUAL stiles ana kratisi («Εισπράχθηκε», «Τραπεζικά έξοδα») —
// diasozontai ana event_id se kathe rebuild. To event_id grafetai se krymmeni stili.
// v2.4 (8/8): XORIS «Πληρώθηκε» — o Tasos den empisteyetai akoma to status apo to
// Owner Invoicing/Master· i stili afairethike teleiws (tha epanelthei an zitithei).
var OS_HDR_BOOK = ['Ημερομηνία','Όνομα Επισκέπτη','Πλατφόρμα',
  'Ποσό','Προμήθεια 20%','ΦΠΑ 24%','Τελικό ποσό προμήθειας',
  'Εισπράχθηκε','Τραπεζικά έξοδα','event_id'];
var OSB_COL_COLLECTED = 8, OSB_COL_FEES = 9, OSB_COL_ID = 10;   // 1-based
var OS_HDR_EXP  = ['Ημερομηνία','Τύπος Εξόδου','Πληροφορίες','Ποσό','Πληρώθηκε','Χρεώνεται'];
var OS_FMT_EUR  = '#,##0.00 "€"';

// -- MENU ----------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Owner Statements')
    .addItem('1. Αρχικοποίηση Μητρώου', 'osInitRegistry')
    .addItem('2. Ενημέρωση ενεργών αρχείων', 'osUpdateAll')
    .addItem('3. Ενημέρωση μόνο Υπολοίπων', 'osUpdateBalances')
    .addSeparator()
    .addItem('8. Auto-update ON (~08:30)', 'osAutoOn')
    .addItem('9. Auto-update OFF', 'osAutoOff')
    .addToUi();
}

function osAutoOn() {
  osAutoOff();
  ScriptApp.newTrigger('osUpdateAllSilent').timeBased().everyDays(1).atHour(8).nearMinute(30).create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Auto-update ενεργό (~08:30).');
}
function osAutoOff() {
  var tr = ScriptApp.getProjectTriggers();
  for (var i = 0; i < tr.length; i++)
    if (tr[i].getHandlerFunction() === 'osUpdateAllSilent') ScriptApp.deleteTrigger(tr[i]);
}
function osUpdateAllSilent() { osUpdateAll(true); }

// -- HELPERS (idia logiki me Financials, prothema os) ---------------------------

function osDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  var m = String(v || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var g = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (g) return new Date(Number(g[3]), Number(g[2]) - 1, Number(g[1]));
  return null;
}
function osNum_(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
function osR2_(v) { return Math.round(v * 100) / 100; }
function osP2_(n) { return (n < 10 ? '0' : '') + n; }

function osNormOwner_(v) {
  var s = String(v || '').trim();
  if (!s) return '';
  var low = s.toLowerCase().replace(/\s+/g, '');
  if (low.indexOf('εταιρ') === 0) return 'Εταιρεία';
  if (low.indexOf('φυσ') === 0) return 'Φυσικό';
  if (low.indexOf('δικ') === 0 || low.indexOf('δκ') === 0) return 'Δικό μας';
  return s;
}

function osPropKey_(name) {
  var s = String(name || '').toLowerCase();
  if (s.indexOf('yagha') > -1) return 'yagha';
  if (s.indexOf('thymari') > -1) return 'thymari';
  if (s.indexOf('windmill') > -1 || s.indexOf('orig') > -1) return 'origin';
  if (s.indexOf('jasper') > -1) return 'jasper';
  if (s.indexOf('piperi') > -1 || s.indexOf('pipperi') > -1) return 'piperi';
  if (s.indexOf('islander') > -1) return 'islander';
  if (s.indexOf('caper') > -1) return 'caper';
  if (s.indexOf('peppermint') > -1) return (s.indexOf(' ii') > -1 || s.indexOf('2') > -1) ? 'peppermintii' : 'peppermint';
  if (s.indexOf('solasta') > -1) return 'solasta';
  if (s.indexOf('citrine') > -1) return 'citrine';
  if (s.indexOf('white') > -1) return 'whiteheaven';
  if (s.indexOf('mirabilia') > -1) return 'mirabilia';
  if (s.indexOf('vireya') > -1) return 'vireya';
  if (s.indexOf('pearl') > -1) return 'coralpearl';
  if (s.indexOf('blue coral') > -1) return (s.indexOf('2') > -1) ? 'bluecoral2' : 'bluecoral1';
  if (s.indexOf('fiora') > -1) return (s.indexOf(' ii') > -1 || s.indexOf('2') > -1) ? 'fioraii' : 'fiora1';
  if (s.indexOf('hara') > -1) return 'hara';
  if (s.indexOf('candia') > -1) return 'candia';
  if (s.indexOf('olea') > -1) return 'olea';
  if (s.indexOf('pepperleaf') > -1 || (s.indexOf('walk') > -1 && s.indexOf('naousa') > -1)) return 'pepperleaf';
  return s.replace(/[^a-z0-9α-ω]/g, '');
}

// Diorthosi Tasou 6/8 (meta ton pilato): oi kratiseis me platforma «Direct»
// tou Hosthub DEN einai Direct Cash — to payout paei ston owner, opos oi
// platformes. "Eisprattoume emeis" MONO: Direct Cash (event_id 'DC|...')
// kai Somnio Website.
function osWeCollect_(platform, eventId) {
  if (String(eventId || '').indexOf('DC|') === 0) return true;
  var p = String(platform || '').toLowerCase();
  // 'Somnio Website' KAI 'Direct Cash' (os keimeno platformas sto Master — fix 6/8,
  // Villa Hara: oi DC kratiseis exoun platform 'Direct Cash' xoris DC| event_id).
  return p.indexOf('somnio') > -1 || p.indexOf('cash') > -1;
}

// Paid_by / Debit_to -> einai i etairia? ('Phoenix' i 'Somnio', case-insensitive)
function osIsCompany_(v) {
  var s = String(v || '').toLowerCase();
  return s.indexOf('phoenix') > -1 || s.indexOf('somnio') > -1;
}

// Periodos "09-16.05" i "29.05-02.06" opos sto xeirokinito protypo.
function osPeriod_(ci, co) {
  var a = osDate_(ci), b = osDate_(co);
  if (!a || !b) return '';
  if (a.getMonth() === b.getMonth())
    return osP2_(a.getDate()) + '-' + osP2_(b.getDate()) + '.' + osP2_(a.getMonth() + 1);
  return osP2_(a.getDate()) + '.' + osP2_(a.getMonth() + 1) + '-' +
         osP2_(b.getDate()) + '.' + osP2_(b.getMonth() + 1);
}

function osLog_(action, n, msg) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(OS_TAB_LOG) || ss.insertSheet(OS_TAB_LOG);
    if (sh.getLastRow() === 0) sh.appendRow(['Πότε','Ενέργεια','Γραμμές','Σχόλιο']);
    sh.appendRow([new Date(), action, n, msg || '']);
  } catch (e) {}
}

// Properties apo Master Properties (Active, OXI «Δικό μας»): [{name, ownerType, ownerName}]
function osProps_() {
  var out = [];
  var ext = SpreadsheetApp.openById(OS_PROPS_ID);
  var sh = ext.getSheetByName('Master_Properties') || ext.getSheets()[0];
  var vals = sh.getDataRange().getValues();
  if (!vals.length) return out;
  var hdr = vals[0], col = { res: 0, ot: 2, on: -1, act: -1 };
  for (var h = 0; h < hdr.length; h++) {
    var hh = String(hdr[h] || '').trim().toLowerCase();
    if (hh === 'residence') col.res = h;
    else if (hh === 'owner_type') col.ot = h;
    else if (hh === 'owner_name') col.on = h;
    else if (hh === 'active') col.act = h;
  }
  for (var r = 1; r < vals.length; r++) {
    var nm = String(vals[r][col.res] || '').trim();
    if (!nm) continue;
    if (col.act > -1 && String(vals[r][col.act]).toUpperCase() === 'FALSE') continue;
    var ot = osNormOwner_(vals[r][col.ot]);
    if (ot === 'Δικό μας') continue;                       // dika mas: xoris owner file
    out.push({ name: nm, ownerType: ot,
      ownerName: col.on > -1 ? String(vals[r][col.on] || '').trim() : '' });
  }
  out.sort(function(a, b) { return a.name.localeCompare(b.name, 'el'); });
  return out;
}

function osCanonMap_(props) {
  var map = {};
  for (var i = 0; i < props.length; i++) map[osPropKey_(props[i].name)] = props[i].name;
  return map;
}

// -- DATA LOADERS ---------------------------------------------------------------

// Oles oi kratiseis tou etous, kanonikopoiimenes, me ypologismena pedia.
function osBookings_(canon) {
  var bk = SpreadsheetApp.openById(OS_MASTER_ID).getSheetByName('Bookings');
  if (!bk) throw new Error('Δεν βρέθηκε tab Bookings στο Master.');
  var last = bk.getLastRow();
  var nCols = bk.getLastColumn();
  var C = osBookCols_(bk.getRange(1, 1, 1, nCols).getValues()[0]);   // v2.2: apo headers
  var bv = last > 1 ? bk.getRange(2, 1, last - 1, nCols).getValues() : [];
  var out = [];
  for (var r = 0; r < bv.length; r++) {
    var id = String(bv[r][C.EVENT_ID] || '');
    if (!id && !bv[r][C.RESIDENCE]) continue;
    var visible = String(bv[r][C.VISIBLE]).toUpperCase() !== 'FALSE';
    var payout = osNum_(bv[r][C.PAYOUT]);
    if (!visible && payout <= 0) continue;                 // akyromeni xoris payout: ektos
    var ci = osDate_(bv[r][C.CHECKIN]);
    if (!ci || ci.getFullYear() !== OS_YEAR) continue;     // mono trexon etos
    var guest = String(bv[r][C.GUEST] || '').trim();
    if (!id) id = 'X|' + ci.getTime() + '|' + guest;       // grammes xoris event_id: statheres psevdo-id
    var vat = osNum_(bv[r][C.VAT]), city = osNum_(bv[r][C.CITY]), env = osNum_(bv[r][C.ENV]);
    var base = osNum_(bv[r][C.COMM_BASE]);
    var c20 = osNum_(bv[r][C.COMM20]), cVat = osNum_(bv[r][C.COMM_VAT]);
    var cTot = osNum_(bv[r][C.COMM_TOTAL]);
    if (cTot <= 0) cTot = osR2_(c20 + cVat);               // DC: to Master afinei 0 sto Comm_Total
    out.push({
      res: canon[osPropKey_(bv[r][C.RESIDENCE])] || String(bv[r][C.RESIDENCE] || '').trim(),
      ci: ci, co: osDate_(bv[r][C.CHECKOUT]),
      guest: guest,
      guests: bv[r][C.GUESTS] !== undefined ? bv[r][C.GUESTS] : '',
      nights: bv[r][C.NIGHTS],
      platform: String(bv[r][C.PLATFORM] || '').trim(),
      poso: osR2_(base + vat + city + env),                // opos sto protypo: Ποσό − ΦΠΑ − τέλη = βάση
      vat: vat, city: city, env: env,
      c20: c20, cVat: cVat, cTot: cTot,
      dc: id.indexOf('DC|') === 0,
      weCollect: osWeCollect_(bv[r][C.PLATFORM], id),
      past: ci <= new Date(),
      id: id
    });
  }
  out.sort(function(a, b) { return a.ci.getTime() - b.ci.getTime(); });
  return out;
}

// OLA ta eksoda tou property (apofasi Tasou 6/8 — oxi mono ta xrewstika owner),
// kanonikopoiimena, me Paid_by KAI Debit_to gia tin taksinomisi.
function osExpenses_(canon) {
  var src = SpreadsheetApp.openById(OS_CANDY_ID).getSheetByName('Data Entry for P&L');
  if (!src) throw new Error('Δεν βρέθηκε tab "Data Entry for P&L".');
  var vals = src.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var v = vals[r];
    if (!v[0] && !v[3]) continue;
    var d = osDate_(v[0]);
    if (!d || d.getFullYear() !== OS_YEAR) continue;
    var prop = String(v[4] || '').trim();
    out.push({
      res: canon[osPropKey_(prop)] || prop,
      date: d,
      typ: String(v[2] || '').trim(),
      info: String(v[3] || '').trim(),
      total: osNum_(v[10]),
      paidBy: String(v[5] || '').trim(),
      debitTo: String(v[7] || '').trim()
    });
  }
  out.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });
  return out;
}

// Taksinomisi eksodou (apofasi Tasou 6/8):
//   'co'     — plironei i Somnio KAI to analamvanei ekeini (Paid_by & Debit_to = Phoenix/Somnio)
//   'refund' — plironei i Somnio EK MEROUS tou pelati -> to epistrefei o pelatis
//   'own'    — plironei o pelatis kai ton varynei
//   'ownco'  — plirose o pelatis alla varynei ti Somnio (sympsifizetai)
//   'blank'  — xoris Debit_to stin pigi (ataksinomito — na sympliromei sto Candy)
function osExpCls_(e) {
  var paidCo = osIsCompany_(e.paidBy);
  if (!e.debitTo) return 'blank';
  var debitCo = osIsCompany_(e.debitTo);
  if (paidCo && debitCo) return 'co';
  if (paidCo && !debitCo) return 'refund';
  if (!paidCo && !debitCo) return 'own';
  return 'ownco';
}

// -- 1. ΜΗΤΡΩΟ ------------------------------------------------------------------

function osInitRegistry() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(OS_TAB_REG) || ss.insertSheet(OS_TAB_REG);
  // v2.1: stiles G/H «Έξοδα από μήνα» / «Έξοδα έως μήνα» (1-12, kena = xoris orio).
  // v2.5: stili I «Κρατήσεις με check-out έως» (imerominia, keno = xoris orio) —
  // sta property files kai sta Υπόλοιπα mpainoun MONO kratiseis me check-out <= orio.
  var hdr = ['Residence','Owner_Type','Owner_Name','File_ID','Ενεργό','Τελευταίο pull',
    'Έξοδα από μήνα (1-12)','Έξοδα έως μήνα (1-12)','Κρατήσεις με check-out έως (ημ/νία)'];
  // Diasosi yparxonton (File_ID / Ενεργό / oria) ana residence
  var old = {};
  if (sh.getLastRow() > 1) {
    var ov = sh.getRange(2, 1, sh.getLastRow() - 1, hdr.length).getValues();
    for (var i = 0; i < ov.length; i++) {
      var k = String(ov[i][0] || '').trim();
      if (k) old[k] = { id: ov[i][3], act: ov[i][4], ts: ov[i][5], m1: ov[i][6], m2: ov[i][7], bt: ov[i][8] };
    }
  }
  var props = osProps_();
  var out = [];
  for (var p = 0; p < props.length; p++) {
    var o = old[props[p].name] || { id: '', act: false, ts: '', m1: '', m2: '', bt: '' };
    out.push([props[p].name, props[p].ownerType, props[p].ownerName, o.id,
      String(o.act).toUpperCase() === 'TRUE' || o.act === true, o.ts, o.m1 || '', o.m2 || '', o.bt || '']);
  }
  sh.clear();
  sh.getRange(1, 1, 1, hdr.length).setValues([hdr])
    .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
  if (out.length) {
    sh.getRange(2, 1, out.length, hdr.length).setValues(out);
    sh.getRange(2, 5, out.length, 1).insertCheckboxes();
  }
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 220); sh.setColumnWidth(4, 340);
  osLog_('INIT_REGISTRY', out.length, 'Ενεργοποίησε (checkbox) όποια θες — πιλότος: Villa Hara Naousa.');
  ss.toast('Μητρώο έτοιμο (' + out.length + ' ακίνητα). Τσέκαρε Ενεργό στο Villa Hara.');
}

// v2.0: to tab «Τράπεζα» KATARGITHIKE (apofasi Tasou 6/8) — oi eisprakseis
// kataxorountai ana kratisi MESA sta property files. To palio tab svinetai
// mono an einai adeio· an exei dedomena, menei os exei alla AGNOEITAI.
function osDropBankTab_(ss) {
  var sh = ss.getSheetByName(OS_TAB_BANK);
  if (!sh) return;
  if (sh.getLastRow() <= 1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sh);
    osLog_('BANK_TAB_REMOVED', 0, 'Οι εισπράξεις πλέον ανά κράτηση στα property files.');
  }
}

// Mazevei ta MANUAL posa (Εισπράχθηκε / Τραπεζικά έξοδα) apo OLA ta property files
// tou Μητρώου (osa exoun File_ID). Taksinomisi platformas apo ti stili «Πλατφόρμα»
// tou idiou tou arxeiou (osWeCollect_ me to keimeno tis).
// Epistrefei: { res: { collOwner, collUs, fees } }
//   collOwner = eisprakseis apo kratiseis pou plironei o owner (platformes/direct)
//   collUs    = eisprakseis se kratiseis DC/Somnio Website (ta eixame eisprattei emeis)
function osCollectManual_(ss) {
  var out = {};
  var reg = ss.getSheetByName(OS_TAB_REG);
  if (!reg || reg.getLastRow() < 2) return out;
  var rv = reg.getRange(2, 1, reg.getLastRow() - 1, 6).getValues();
  for (var r = 0; r < rv.length; r++) {
    var res = String(rv[r][0] || '').trim();
    var fid = String(rv[r][3] || '').trim();
    if (!res || !fid) continue;
    try {
      var sh = SpreadsheetApp.openById(fid).getSheetByName(OS_YEAR + ' Κρατήσεις');
      if (!sh || sh.getLastRow() < 2) continue;
      var vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
      var col = {};
      for (var h = 0; h < vals[0].length; h++) col[String(vals[0][h]).trim()] = h;
      if (!col.hasOwnProperty('Εισπράχθηκε')) continue;
      var a = out[res] = out[res] || { collOwner: 0, collUs: 0, fees: 0 };
      for (var i = 1; i < vals.length; i++) {
        if (!String(vals[i][col['event_id']] || '') && !String(vals[i][0] || '')) continue;
        if (col.hasOwnProperty('event_id') && !String(vals[i][col['event_id']] || '')) continue;
        var coll = osNum_(vals[i][col['Εισπράχθηκε']]);
        var fee = col.hasOwnProperty('Τραπεζικά έξοδα') ? osNum_(vals[i][col['Τραπεζικά έξοδα']]) : 0;
        var plat = col.hasOwnProperty('Πλατφόρμα') ? String(vals[i][col['Πλατφόρμα']] || '') : '';
        if (osWeCollect_(plat, '')) a.collUs += coll;
        else a.collOwner += coll;
        a.fees += fee;
      }
    } catch (e) { osLog_('COLLECT_MANUAL_ERROR', 0, res + ': ' + e.message); }
  }
  return out;
}

// -- 2. ΕΝΗΜΕΡΩΣΗ ΑΡΧΕΙΩΝ -------------------------------------------------------

function osUpdateAll(silent) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reg = ss.getSheetByName(OS_TAB_REG);
  if (!reg || reg.getLastRow() < 2) {
    if (!silent) SpreadsheetApp.getUi().alert('Τρέξε πρώτα "1. Αρχικοποίηση Μητρώου".');
    return;
  }
  var props = osProps_();
  var canon = osCanonMap_(props);
  var bookings = osBookings_(canon);
  var expenses = osExpenses_(canon);

  var rv = reg.getRange(2, 1, reg.getLastRow() - 1, 9).getValues();
  var done = 0, limits = {};
  for (var r = 0; r < rv.length; r++) {
    var res = String(rv[r][0] || '').trim();
    if (res) limits[res] = { m1: osMonth_(rv[r][6]), m2: osMonth_(rv[r][7]), bt: osDate_(rv[r][8]) };
    var act = rv[r][4] === true || String(rv[r][4]).toUpperCase() === 'TRUE';
    if (!act) continue;
    try {
      var fileId = osBuildOwnerFile_(res, String(rv[r][3] || '').trim(), bookings, expenses, limits[res]);
      reg.getRange(r + 2, 4).setValue(fileId);
      reg.getRange(r + 2, 6).setValue(new Date());
      done++;
    } catch (e) { osLog_('BUILD_ERROR', 0, res + ': ' + e.message); }
  }
  osDropBankTab_(ss);
  osBuildBalances_(ss, props, bookings, expenses, osCollectManual_(ss), limits);
  osLog_('UPDATE_ALL', done, 'κρατήσεις=' + bookings.length + ' · έξοδα=' + expenses.length);
  if (!silent) ss.toast('Ενημερώθηκαν ' + done + ' αρχεία + Υπόλοιπα.');
}

function osUpdateBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = osProps_();
  var canon = osCanonMap_(props);
  osDropBankTab_(ss);
  osBuildBalances_(ss, props, osBookings_(canon), osExpenses_(canon),
    osCollectManual_(ss), osRegLimits_(ss));
  ss.toast('Υπόλοιπα ενημερώθηκαν.');
}

// Oria minon eksodon ana property apo to Μητρώο (stiles G/H).
function osRegLimits_(ss) {
  var limits = {};
  var reg = ss.getSheetByName(OS_TAB_REG);
  if (!reg || reg.getLastRow() < 2) return limits;
  var rv = reg.getRange(2, 1, reg.getLastRow() - 1, 9).getValues();
  for (var r = 0; r < rv.length; r++) {
    var res = String(rv[r][0] || '').trim();
    if (res) limits[res] = { m1: osMonth_(rv[r][6]), m2: osMonth_(rv[r][7]), bt: osDate_(rv[r][8]) };
  }
  return limits;
}

// 1-12 i 0 (=xoris orio)
function osMonth_(v) {
  var n = Math.round(osNum_(v));
  return (n >= 1 && n <= 12) ? n : 0;
}

// Pernaei to eksodo to filtro minon? lim = {m1, m2} (0 = xoris orio)
function osExpInRange_(e, lim) {
  if (!lim) return true;
  var m = e.date.getMonth() + 1;
  if (lim.m1 && m < lim.m1) return false;
  if (lim.m2 && m > lim.m2) return false;
  return true;
}

// v2.5: metraei i kratisi? An yparxei orio check-out (Μητρώο στήλη I): co <= orio.
// Xoris orio: check-in <= simera (opos prin).
function osBookCounted_(b, lim) {
  if (lim && lim.bt) return !!(b.co && b.co.getTime() <= lim.bt.getTime());
  return b.past;
}

// Anoigei i dimiourgei to arxeio tou akinitou kai to ksanagrafei (times).
function osBuildOwnerFile_(res, fileId, allBookings, allExpenses, lim) {
  var file;
  if (fileId) {
    file = SpreadsheetApp.openById(fileId);
  } else {
    file = SpreadsheetApp.create(res + '_Expenses');
    try {   // metakinisi ston fakelo tou control sheet
      var me = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
      var parents = me.getParents();
      if (parents.hasNext()) DriveApp.getFileById(file.getId()).moveTo(parents.next());
    } catch (e) { osLog_('MOVE_WARN', 0, res + ': ' + e.message); }
  }

  var bk = [], ex = [];
  for (var i = 0; i < allBookings.length; i++)
    if (allBookings[i].res === res && (!lim || !lim.bt || (allBookings[i].co && allBookings[i].co.getTime() <= lim.bt.getTime())))
      bk.push(allBookings[i]);
  for (var j = 0; j < allExpenses.length; j++)
    if (allExpenses[j].res === res && osExpInRange_(allExpenses[j], lim)) ex.push(allExpenses[j]);

  // Prota ta Έξοδα: to block Σύνοψης tou Κρατήσεις anaferetai sto kelí I4 tou Έξοδα,
  // opote to fyllo prepei na yparxei prin grafteí i formula.
  osWriteExpensesTab_(file, ex, lim);
  osWriteBookingsTab_(file, bk, ex, lim);

  // To default "Sheet1"/«Φύλλο1» fevgei an yparxei kai einai adeio
  var sheets = file.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var nm = sheets[s].getName();
    if ((nm === 'Sheet1' || nm === 'Φύλλο1') && sheets[s].getLastRow() === 0 && sheets.length > 1)
      file.deleteSheet(sheets[s]);
  }
  return file.getId();
}

// -- TAB «2026 Κρατήσεις» + block ekkatharisis ----------------------------------

function osWriteBookingsTab_(file, bk, ex, lim) {
  var name = OS_YEAR + ' Κρατήσεις';
  var sh = file.getSheetByName(name) || file.insertSheet(name, 0);

  // 1. DIASOSI manual stilon (Εισπράχθηκε / Τραπεζικά έξοδα) ana event_id,
  //    PRIN to clear — vriskontai APO TA HEADERS (antexei se allages layout).
  var manual = {}, manualKey = {};
  if (sh.getLastRow() > 1) {
    var oldVals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var col = {};
    for (var h = 0; h < oldVals[0].length; h++) col[String(oldVals[0][h]).trim()] = h;
    if (col.hasOwnProperty('Εισπράχθηκε')) {
      for (var r = 1; r < oldVals.length; r++) {
        var m0 = {
          coll: oldVals[r][col['Εισπράχθηκε']],
          fees: col.hasOwnProperty('Τραπεζικά έξοδα') ? oldVals[r][col['Τραπεζικά έξοδα']] : ''
        };
        if (String(m0.coll) === '' && String(m0.fees) === '') continue;
        var oid = col.hasOwnProperty('event_id') ? String(oldVals[r][col['event_id']] || '') : '';
        if (oid) manual[oid] = m0;
        // Efedriko kleidi Ημερομηνία+Όνομα — diasozei kai otan allaksoun ta event_id
        // (px. migration 7/8 pou eixe grapsei Guests sti thesi tou event_id).
        manualKey[String(oldVals[r][0] || '') + '|' + String(oldVals[r][1] || '').trim()] = m0;
      }
    }
  }

  sh.clear();
  var NC = OS_HDR_BOOK.length;
  sh.getRange(1, 1, 1, NC).setValues([OS_HDR_BOOK])
    .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF').setWrap(true);
  if (lim && lim.bt) {
    var bt = lim.bt;
    sh.getRange(1, 1).setNote('Εμφανίζονται κρατήσεις με check-out έως ' +
      bt.getDate() + '/' + (bt.getMonth() + 1) + '/' + bt.getFullYear() +
      ' (όριο από το Μητρώο, στήλη «Κρατήσεις με check-out έως»).');
  }
  sh.getRange(1, OSB_COL_COLLECTED, 1, 2).setBackground('#7F6000')
    .setNote('ΧΕΙΡΟΚΙΝΗΤΗ στήλη — συμπληρώνεται εδώ και ΔΙΑΤΗΡΕΙΤΑΙ στις ενημερώσεις.');

  var rows = [], sums = { posoP: 0, posoD: 0, commP: 0, commD: 0 };
  for (var i = 0; i < bk.length; i++) {
    var b = bk[i];
    var m = manual[b.id] || manualKey[osPeriod_(b.ci, b.co) + '|' + b.guest] || { coll: '', fees: '' };
    rows.push([osPeriod_(b.ci, b.co), b.guest,
      b.dc ? 'Direct Cash' : (b.platform || 'Direct'),
      b.poso, b.c20, b.cVat, b.cTot,
      m.coll, m.fees, b.id]);
    if (b.weCollect) { sums.posoD += b.poso; sums.commD += b.cTot; }
    else { sums.posoP += b.poso; sums.commP += b.cTot; }
  }
  if (rows.length) {
    sh.getRange(2, 1, rows.length, NC).setValues(rows);
    sh.getRange(2, 4, rows.length, 4).setNumberFormat(OS_FMT_EUR);
    sh.getRange(2, OSB_COL_COLLECTED, rows.length, 2)
      .setNumberFormat(OS_FMT_EUR).setBackground('#FFF2CC');   // manual: kitrino
  }
  sh.hideColumns(OSB_COL_ID);
  sh.setFrozenRows(1);
  sh.setColumnWidth(2, 220);

  // Synola os ZONTANOI TYPOI (apofasi Tasou 8/8) — deixnoun stis grammes tou pinaka
  // kai sto tab «2026 Έξοδα», oste na fainetai o ypologismos kai na ananeonontai zontana.
  var lastR = rows.length >= 1 ? rows.length + 1 : 2;
  var rC = 'C2:C' + lastR, rD = 'D2:D' + lastR, rG = 'G2:G' + lastR;
  // «εισπράξαμε εμείς» = Direct Cash + Somnio Website (pano sti stili {X}: D=Ποσό, G=Τελικό)
  // Kritiria me wildcard ("*Cash*", "*Somnio*") oste na symfonoun me to osWeCollect_
  // (substring 'cash' / 'somnio') pou xrisimopoiei to kentriko «Υπόλοιπα».
  var CR_DC = '"*Cash*"', CR_SW = '"*Somnio*"';
  function osWe_(X) { return 'SUMIF(' + rC + ',' + CR_DC + ',' + X + ')+SUMIF(' + rC + ',' + CR_SW + ',' + X + ')'; }
  var refundRef = "'" + OS_YEAR + " Έξοδα'!I4";   // grammi «εκ μέρους σας» tis Αναφοράς

  // v2.7 (8/9): Direct Cash kai Somnio Website XORISTA (apofasi Tasou).
  //   Somnio Website = declared -> ta xrimata pane ston logariasmo tou owner, emeis
  //   parakratoume mono tin promitheia. Direct Cash = metrita pou kratame emeis ->
  //   ΕΠΙΣΤΡΟΦΗ = DC − promitheia DC − eksoda ek merous tous. (Villa Hara: 1.716,57)
  var swD = 'SUMIF(' + rC + ',' + CR_SW + ',' + rD + ')', dcD = 'SUMIF(' + rC + ',' + CR_DC + ',' + rD + ')';
  var swG = 'SUMIF(' + rC + ',' + CR_SW + ',' + rG + ')', dcG = 'SUMIF(' + rC + ',' + CR_DC + ',' + rG + ')';

  var row = rows.length + 4;
  var rDC = row + 4, rDCcomm = row + 8, rRef = row + 9;   // grammes gia tin ΕΠΙΣΤΡΟΦΗ (mono DC)
  var block = [
    ['Σύνοψη — Εκκαθάριση ' + OS_YEAR, ''],
    ['Σύνολο κρατήσεων', '=SUM(' + rD + ')'],
    ['Κρατήσεις που έχουμε εισπράξει εμείς (Somnio Website / Direct Cash)', '=' + osWe_(rD)],
    ['   εκ των οποίων Somnio Website (declared — μεταφέρονται στον λογαριασμό σας)', '=' + swD],
    ['   εκ των οποίων Direct Cash (μετρητά — προς εκκαθάριση)', '=' + dcD],
    ['', ''],
    ['Προμήθειες με ΦΠΑ που οφείλονται στη Somnio', '=SUM(' + rG + ')-(' + osWe_(rG) + ')'],
    ['Προμήθειες με ΦΠΑ από κρατήσεις Somnio Website — παρακρατούνται από τις πληρωμές', '=' + swG],
    ['Προμήθειες με ΦΠΑ από κρατήσεις Direct Cash — παρακρατούνται από τις πληρωμές', '=' + dcG],
    ['Έξοδα που πλήρωσε η Somnio εκ μέρους σας (επιστρέφονται)', '=' + refundRef],
    ['', ''],
    ['ΕΠΙΣΤΡΟΦΗ ΣΕ ΕΣΑΣ από εισπράξεις Direct Cash (− προμήθειες DC − έξοδα)',
      '=B' + rDC + '-B' + rDCcomm + '-B' + rRef]
  ];
  sh.getRange(row, 1, block.length, 2).setValues(block);
  sh.getRange(row, 1).setFontWeight('bold').setBackground('#1F7A4D').setFontColor('#FFFFFF');
  sh.getRange(row + 1, 2, block.length - 1, 1).setNumberFormat(OS_FMT_EUR);
  sh.getRange(row + block.length - 1, 1, 1, 2).setFontWeight('bold').setBackground('#FFF2CC');
  sh.getRange(row, 1, block.length, 1).setWrap(false);
  sh.getRange(row + block.length + 1, 1)
    .setValue('Ενημερώθηκε αυτόματα: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') +
      ' · Πηγή: Somnio Master / Candy Recipes · Μην επεξεργάζεστε — ξαναγράφεται σε κάθε ενημέρωση.')
    .setFontStyle('italic').setFontSize(9).setFontColor('#777777');
}

// -- TAB «2026 Έξοδα» + synopsi -------------------------------------------------

function osWriteExpensesTab_(file, ex, lim) {
  var name = OS_YEAR + ' Έξοδα';
  var sh = file.getSheetByName(name) || file.insertSheet(name, 1);
  sh.clear();
  var NC = OS_HDR_EXP.length;
  sh.getRange(1, 1, 1, NC).setValues([OS_HDR_EXP])
    .setFontWeight('bold').setBackground('#B45F06').setFontColor('#FFFFFF');
  if (lim && (lim.m1 || lim.m2)) {
    var MN = ['','Ιαν','Φεβ','Μάρ','Απρ','Μάι','Ιούν','Ιούλ','Αύγ','Σεπ','Οκτ','Νοέ','Δεκ'];
    sh.getRange(1, 1).setNote('Φίλτρο μηνών από το Μητρώο: ' +
      (lim.m1 ? 'από ' + MN[lim.m1] + ' ' : '') + (lim.m2 ? 'έως ' + MN[lim.m2] : '') +
      ' — αλλάζει στις στήλες «Έξοδα από/έως μήνα» του control sheet.');
  }

  function osEsc_(s) { return String(s).replace(/"/g, '""'); }
  var rows = [], clsArr = [], byType = {}, typeOrder = [];
  var cls = { co: 0, refund: 0, own: 0, ownco: 0, blank: 0 };
  for (var i = 0; i < ex.length; i++) {
    var e = ex[i];
    rows.push([e.date, e.typ, e.info, e.total, e.paidBy, e.debitTo]);
    clsArr.push([osExpCls_(e)]);                 // krymmeni stili G — orata i taksinomisi
    if (!(e.typ in byType)) { byType[e.typ] = 0; typeOrder.push(e.typ); }
    byType[e.typ] += e.total;
    cls[osExpCls_(e)] += e.total;
  }
  if (rows.length) {
    sh.getRange(2, 1, rows.length, NC).setValues(rows);
    sh.getRange(2, 1, rows.length, 1).setNumberFormat('d/M');
    sh.getRange(2, 4, rows.length, 1).setNumberFormat(OS_FMT_EUR);
    sh.getRange(2, 7, rows.length, 1).setValues(clsArr);      // G = Κατηγορία (co/refund/own…)
  }
  sh.getRange(1, 7).setValue('Κατ.');
  sh.hideColumns(7);
  sh.setFrozenRows(1);
  sh.setColumnWidth(3, 240);

  // Synola os ZONTANOI TYPOI: SUM/SUMIF pano stis grammes (stili D=Ποσό, B=Τύπος, G=Κατ.)
  var lastRe = rows.length >= 1 ? rows.length + 1 : 2;
  var eB = 'B2:B' + lastRe, eD = 'D2:D' + lastRe, eG = 'G2:G' + lastRe;

  // ΑΝΑΦΟΡΑ (apofasi Tasou 6/8): synolika + 3 kyries katigories (+2 grammes elegxou).
  var H = 8;   // stili H kai meta (F=Χρεώνεται, G=krymmeni Κατ.)
  var rep = [
    ['Αναφορά Εξόδων ' + OS_YEAR, ''],
    ['Συνολικά έξοδα property', '=SUM(' + eD + ')'],
    ['Πληρώνει η Somnio και τα αναλαμβάνει εκείνη', '=SUMIF(' + eG + ',"co",' + eD + ')'],
    ['Πληρώνει η Somnio εκ μέρους σας — τα επιστρέφετε', '=SUMIF(' + eG + ',"refund",' + eD + ')'],
    ['Πληρώνετε εσείς και σας βαρύνουν', '=SUMIF(' + eG + ',"own",' + eD + ')']
  ];
  if (cls.ownco) rep.push(['Πληρώσατε εσείς, βαρύνουν τη Somnio (συμψηφίζονται)', '=SUMIF(' + eG + ',"ownco",' + eD + ')']);
  if (cls.blank) rep.push(['Χωρίς «Χρεώνεται» στην πηγή (αταξινόμητα)', '=SUMIF(' + eG + ',"blank",' + eD + ')']);
  sh.getRange(1, H, rep.length, 2).setValues(rep);
  sh.getRange(1, H).setFontWeight('bold').setBackground('#1F7A4D').setFontColor('#FFFFFF');
  sh.getRange(2, H, 1, 2).setFontWeight('bold');
  sh.getRange(2, H + 1, rep.length - 1, 1).setNumberFormat(OS_FMT_EUR);
  sh.setColumnWidth(H, 46 * 8);

  // Pivot ana Typo eksodou (opos sto xeirokinito protypo), kato apo tin anafora.
  typeOrder.sort(function(a, b) { return a.localeCompare(b); });
  var tStart = rep.length + 2;
  var t = [['Τύπος Εξόδου', 'Σύνολο']];
  for (var k = 0; k < typeOrder.length; k++)
    t.push([typeOrder[k], '=SUMIF(' + eB + ',"' + osEsc_(typeOrder[k]) + '",' + eD + ')']);
  t.push(['Γενικό σύνολο', '=SUM(' + eD + ')']);
  sh.getRange(tStart, H, t.length, 2).setValues(t);
  sh.getRange(tStart, H, 1, 2).setFontWeight('bold').setBackground('#EFEFEF');
  sh.getRange(tStart + t.length - 1, H, 1, 2).setFontWeight('bold');
  sh.getRange(tStart + 1, H + 1, t.length - 1, 1).setNumberFormat(OS_FMT_EUR);
}

// -- 3. ΥΠΟΛΟΙΠΑ (control sheet) ------------------------------------------------
// Ana property: ti mas xrostane (promitheies platformas eos simera − eisprakseis
// trapezas) kai ti tous xrostame (direct eisprakseis − promitheies − eksoda Phoenix).

function osBuildBalances_(ss, props, bookings, expenses, manual, limits) {
  manual = manual || {};   // { res: { collOwner, collUs, fees } } apo ta property files
  limits = limits || {};   // { res: { m1, m2 } } — filtro minon eksodon apo to Μητρώο
  var agg = {};
  function A(res) {
    if (!agg[res]) agg[res] = { commP: 0, commPf: 0, dIn: 0, dComm: 0, phx: 0 };
    return agg[res];
  }
  for (var b = 0; b < bookings.length; b++) {
    var k = bookings[b];
    var a = A(k.res);
    var counted = osBookCounted_(k, limits[k.res]);
    if (k.weCollect) {
      if (counted) { a.dIn += k.poso; a.dComm += k.cTot; }
    } else {
      if (counted) a.commP += k.cTot; else a.commPf += k.cTot;
    }
  }
  for (var e = 0; e < expenses.length; e++)
    if (osExpCls_(expenses[e]) === 'refund' && osExpInRange_(expenses[e], limits[expenses[e].res]))
      A(expenses[e].res).phx += expenses[e].total;

  var hdr = ['Property','Προμήθειες πλατφόρμας (έως σήμερα)','Τραπεζικά έξοδα (χρεωστικά owner)',
    'Εισπράχθηκαν προμήθειες','ΜΑΣ ΧΡΩΣΤΑΝΕ',
    'Εισπράξεις DC/Somnio Website (Master)','εκ των οποίων ΚΑΤΑΧΩΡΗΜΕΝΕΣ εισπράξεις',
    'Προμήθειες DC/Somnio','Έξοδα εκ μέρους owner','ΤΟΥΣ ΧΡΩΣΤΑΜΕ',
    'ΚΑΘΑΡΟ ΥΠΟΛΟΙΠΟ (+ μας χρωστάνε)','Μελλοντικές προμήθειες (ενημ.)'];
  var out = [], tot = [0,0,0,0,0,0,0,0,0,0,0];
  for (var p = 0; p < props.length; p++) {
    var res = props[p].name;
    var a2 = agg[res] || { commP: 0, commPf: 0, dIn: 0, dComm: 0, phx: 0 };
    var m = manual[res] || { collOwner: 0, collUs: 0, fees: 0 };
    // ΜΑΣ ΧΡΩΣΤΑΝΕ = promitheies platformas + trapezika eksoda − osa exoun eisprattei
    // (MONO oi eisprakseis se kratiseis pou plironei o owner — oi kataxoriseis
    //  se DC/Somnio Website einai eisprakseis apo EPISKEPTES, stili G, den afairountai edo).
    var owedToUs = osR2_(a2.commP + m.fees - m.collOwner);
    var owedToThem = osR2_(a2.dIn - a2.dComm - a2.phx);
    // An owedToThem < 0 (promitheies direct + eksoda > direct eisprakseis),
    // to arnitiko simainei oti o owner mas xrostaei ki ayto — to net to apotyponei.
    var net = osR2_(owedToUs - owedToThem);
    out.push([res, osR2_(a2.commP), osR2_(m.fees), osR2_(m.collOwner), owedToUs,
      osR2_(a2.dIn), osR2_(m.collUs), osR2_(a2.dComm), osR2_(a2.phx), owedToThem, net, osR2_(a2.commPf)]);
    var vals = [a2.commP, m.fees, m.collOwner, owedToUs, a2.dIn, m.collUs, a2.dComm, a2.phx, owedToThem, net, a2.commPf];
    for (var tI = 0; tI < 11; tI++) tot[tI] += vals[tI];
  }
  var sh = ss.getSheetByName(OS_TAB_BAL) || ss.insertSheet(OS_TAB_BAL);
  sh.clear();
  sh.getRange(1, 1, 1, hdr.length).setValues([hdr])
    .setFontWeight('bold').setBackground('#1F7A4D').setFontColor('#FFFFFF').setWrap(true);
  if (out.length) {
    sh.getRange(2, 1, out.length, hdr.length).setValues(out);
    var totRow = ['ΣΥΝΟΛΟ'];
    for (var tJ = 0; tJ < 11; tJ++) totRow.push(osR2_(tot[tJ]));
    sh.getRange(out.length + 2, 1, 1, hdr.length).setValues([totRow])
      .setFontWeight('bold').setBackground('#EFEFEF');
    sh.getRange(2, 2, out.length + 1, hdr.length - 1).setNumberFormat(OS_FMT_EUR);
    sh.getRange(2, 5, out.length + 1, 1).setFontWeight('bold');    // ΜΑΣ ΧΡΩΣΤΑΝΕ
    sh.getRange(2, 11, out.length + 1, 1).setFontWeight('bold');   // ΚΑΘΑΡΟ
  }
  sh.setFrozenRows(1); sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 220);
  sh.getRange(out.length + 4, 1)
    .setValue('Προμήθειες: κρατήσεις έως το όριο check-out του Μητρώου (χωρίς όριο: check-in έως σήμερα)· οι υπόλοιπες στην τελευταία στήλη. ' +
      'Εισπράχθηκαν/Τραπεζικά έξοδα: από τις χειροκίνητες στήλες των property files (ανά κράτηση). ' +
      'Ενημερώθηκε: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'))
    .setFontStyle('italic').setFontSize(9).setFontColor('#777777');
}
