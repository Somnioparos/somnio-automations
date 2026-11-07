/**
 * SOMNIO — Financials (STANDALONE bound script)
 * Zei MESA sto arxeio "Somnio — Financials" (Extensions > Apps Script).
 * Kanei PULL apo to Master File — to Master DEN xreiazetai kamia allagi.
 *
 * Egatastasi (mia fora):
 *   1. Nea Google Sheet "Somnio — Financials" sto Somnio Automation Folder.
 *   2. Extensions > Apps Script > epikollisi aytou tou arxeiou > Save.
 *   3. Refresh to spreadsheet -> menu "Somnio Financials" -> "1. Pull apo Master".
 *      (Sto proto run tha zitisei permissions.)
 *   4. Symplirose stoxous sto tab «Στόχοι» (stili B).
 *   5. Menu "3. Auto-pull ON" gia kathimerino pull ~08:00 (meta to sync tou Master ~07:00).
 *
 *
 * v3.3 (15/9/2026) — TAXYTITA. To pull ktypage to orio ton 6 lepton tou Apps Script.
 *   - OLA ta dashboards grafontai me ENA setValues ana block (prin: kelli-kelli).
 *     Kliseis sto Sheets API ana pull: 1162 -> 516.
 *   - Oles oi formules xrisimopoioun FRAGMENA euri ($W$2:$W$1000) anti gia
 *     olokliri stili ($W:$W) — vlepe finRng_. Sarosis olis stilis: 9326 -> 0.
 *   - finOrderTabs_: metakinei tabs MONO an i seira exei xalasei.
 *   Ta noumera den allaksan: epalithefthike me sygkrisi 46.184 kellion prin/meta.
 *
 * Tabs (v3.0 — anadomisi 3/8/2026 · v3.3 performance 15/9/2026):
 *   ΒΑΣΕΙΣ ΔΕΔΟΜΕΝΩΝ (pull, full rewrite, POTE manual):
 *     Κρατήσεις     — vasi 1: 1 grammi ana kratisi (apo to Master File).
 *     Έξοδα         — vasi 2: 1 grammi ana eksodo (apo ta Candy Recipes), me
 *                     stili K «Κατηγορία» = Opex / Πάγιο / Εγγύηση.
 *     Concierge     — vasi 3: concierge services (apo ta Candy Recipes).
 *   DASHBOARDS:
 *     Στόχος Εταιρείας — etisios stoxos tzirou tis etaireias (B4 MANUAL).
 *     P&L           — ENA tab: block OVERALL + block DECLARED (panomoiotypa),
 *                     block ΕΚΤΟΣ P&L, kai pinakes ΑΝΑ ΑΚΙΝΗΤΟ (esoda−eksoda=kerdos).
 *     Platform_Fees — service fees: property × minas KAI platforma × minas.
 *     Occupancy     — (v3.2) plirotita % ana akinito × mina, MONO sezon Απρ–Οκτ
 *                     (214 meres). Pente blocks: Πληρότητα % · Νύχτες ·
 *                     Νύχτες χωρίς έσοδο · ADR · RevPAR. ADR/RevPAR se TOTAL VALUE
 *                     (ti plirose o pelatis). O paronomastis tou ADR metraei MONO
 *                     tis nyxtes me esodo — apofasi Tasou 27/8.
 *                     Metriete ANA IMERA, opote kratisi pou piani dyo mines
 *                     moirazetai sosta· ta esoda katanemontai analogika.
 *     Διαθεσιμότητα — ypoloipo sezon: adiathetes meres kai ektimisi axias.
 *     Στόχοι        — stili B MANUAL: etisios stoxos GROSS REVENUE ana property.
 *     Overview      — ana property: Gross Revenue (ΕΤΟΣ), Company Revenue (ΕΤΟΣ),
 *                     % στόχου, kai Gross Revenue ana mina Απρ–Οκτ.
 *     Log           — istoriko ton pulls.
 *
 * Orismoi (apofaseis Tasou):
 *   - Gross_Revenue (to noumero tou stoxou):
 *       Εταιρεία: Net − Service fee − Payment charges  (= Comm_Base tou Master)
 *       Φυσικό  : Gross − Service fee − Payment charges (= Comm_Base tou Master)
 *       Δικό μας: Net − Service fee − Payment charges
 *   - Company_Revenue = to pragmatiko net revenue tis Somnio (stili tou Master:
 *       promitheia 20% sta diaxeirizomena, olo to kathara poso sta «Δικό μας»).
 *   - Kratiseis: OLES 2026+ (kai mellontikes, kai Direct Cash).
 *     Akyromenes MONO an Total_payout > 0, me Status «Ακυρωμένη (payout)».
 *   - Kostos etaireias = Candy Recipes «Data Entry for P&L» me Debit to = FIN_COMPANY
 *     KAI Κατηγορία = «Opex». Eggyiseis (epistrepteo) kai Pagia (kataskeyi Gky)
 *     EKSAIROUNTAI apo to P&L — fainontai se ksexoristo block. (Apofasi 2/8/2026.)
 *   - Ta genika eksoda DEN epimerizontai ana spiti — analyontai os DIKES tous
 *     grammes (kentra kostous) ston pinaka ΑΝΑ ΑΚΙΝΗΤΟ. (Apofasi 2/8/2026.)
 *
 * P&L (v3.0 — apofaseis Tasou 3/8/2026):
 *   ENA tab «P&L», katheto, me tin idia domi dyo fores:
 *     OVERALL  — ola ta esoda (mazi Direct Cash) kai ola ta Opex eksoda.
 *     DECLARED — esoda xoris Direct Cash, eksoda mono Declared = TRUE.
 *   Stiles: Γραμμή | Ιαν..Δεκ | ΣΥΝΟΛΟ | % εσόδων.
 *   Kato apo kathe katigoria eksodou: oi PRAGMATIKES grammes tou Candy,
 *   omadopoiimenes (diplonoun me to velaki tis Google).
 *   Meta: block ΕΚΤΟΣ P&L (Πάγιο / Εγγύηση) kai dyo pinakes ΑΝΑ ΑΚΙΝΗΤΟ.
 *   Ta tabs «Properties P&L» / «Company P&L» / «Untaxed» DEN yparxoun pia.
 */

var FIN_MASTER_ID = '1XIZMBmY8aXxPiKR8y4vZyGICZN6MeS5rtRo01LW92UE';   // Somnio — Master File
var FIN_PROPS_ID  = '1N2OegNP2eEVKkZlTokhXFmL5W0OkZ3VZDuedz3wXRFs';   // Somnio — Master Properties
var FIN_CANDY_ID  = '1xZFPV6EaXE0fuOeSpnkrA8W137M7YRpRIDAlZSMP3iI';   // 2026_Candy_Recipes (έξοδα + concierge)
var FIN_COMPANY   = 'Phoenix';   // "Debit to" = poios varynetai to eksodo -> ayto metraei os kostos etaireias
var FIN_AUTO_HOUR = 8;   // pull ~08:00 (to Master syncarei ~07:00)

// Stiles tou Bookings sto Master — FALLBACK indexes (0-based, layout v3 41 stilon, 7/8).
// 8/8: oi stiles vriskontai PLEON APO TA HEADERS (finBookCols_) — ta fixed indexes
// espasan otan to Master pige apo 38 se 41 stiles (Comm_Rate%/Guest_Phone/Comments,
// event_id 36->39). To MB xrisimopoieitai mono an leipei kapoio onoma apo ta headers.
var MB = { MONTH:1, CHECKIN:3, CHECKOUT:4, RESIDENCE:5, PLATFORM:6, NIGHTS:7, GUEST:8,
  PAYOUT:15, TOTAL_VALUE:16, BANK:18, SERVICE_FEE:19,
  NET:21, VAT:22, CITY:23, ENV:24, GROSS:26,
  OWNER_TYPE:27, COMM_BASE:28, COMM20:29, COMM_VAT:30, COMM_TOTAL:31, COMP_REV:32,
  VISIBLE:33, EVENT_ID:39 };

// Antistoixisi onomaton header tou Bookings -> index. Fallback sto MB an leipei onoma.
function finBookCols_(hdr) {
  var names = { MONTH:'Month', CHECKIN:'Check_in', CHECKOUT:'Check_out',
    RESIDENCE:'Residence', PLATFORM:'Platform', NIGHTS:'Nights', GUEST:'Guest name',
    PAYOUT:'Total payout', TOTAL_VALUE:'Total value', BANK:'Payment charges',
    SERVICE_FEE:'Service fee host', NET:'Net_Price', VAT:'VAT', CITY:'City_Tax',
    ENV:'Env_Fee', GROSS:'Gross_Value', OWNER_TYPE:'Owner_Type', COMM_BASE:'Comm_Base',
    COMM20:'Comm_20pct', COMM_VAT:'Comm_VAT', COMM_TOTAL:'Comm_Total',
    COMP_REV:'Company_Revenue', VISIBLE:'is_visible', EVENT_ID:'event_id' };
  var byName = {};
  for (var h = 0; h < hdr.length; h++) byName[String(hdr[h]).trim()] = h;
  var idx = {}, missing = [];
  for (var k in names) {
    if (byName.hasOwnProperty(names[k])) idx[k] = byName[names[k]];
    else { idx[k] = MB[k]; missing.push(names[k]); }
  }
  if (missing.length) { try { finLog_('HEADER_FALLBACK', missing.length, missing.join(', ')); } catch (e) {} }
  return idx;
}

// -- ONOMATA TAB (v3.0) --------------------------------------------------------
// Oi treis vaseis exoun pia ellinika, katanoita onomata. To finMigrate_ metonomazei
// ta palia tabs kai svinei osa katargithikan, oste na min xathoun ta dedomena.
var FIN_TAB_DATA  = 'Κρατήσεις';       // ex-"Data"            — vasi 1
var FIN_TAB_EXP   = 'Έξοδα';           // ex-"Expenses_Data"   — vasi 2
var FIN_TAB_CONC  = 'Concierge';       // ex-"Concierge_Data"  — vasi 3
var FIN_TAB_CO    = 'Στόχος Εταιρείας';
var FIN_TAB_PNL   = 'P&L';             // ENA eniaio tab (v3.0)
var FIN_TAB_FEES  = 'Platform_Fees';
var FIN_TAB_AVAIL = 'Διαθεσιμότητα';
var FIN_TAB_OCC   = 'Occupancy';       // v3.2 — plirotita ana akinito x mina
var FIN_TAB_STOX  = 'Στόχοι';
var FIN_TAB_OVER  = 'Overview';
var FIN_TAB_LOG   = 'Log';

// Palia onomata — mono gia migration/katharisma. MHN ta xrisimopoieis allou.
var FIN_OLD_NAMES = { 'Data': FIN_TAB_DATA, 'Expenses_Data': FIN_TAB_EXP,
                      'Concierge_Data': FIN_TAB_CONC };
var FIN_DEAD_TABS = ['Untaxed', 'Properties P&L', 'Company P&L'];

// Etoima prothemata gia formules (single source of truth me ta pano onomata).
var FIN_QD = finQ_(FIN_TAB_DATA);   // "'Κρατήσεις'!"
var FIN_QE = finQ_(FIN_TAB_EXP);    // "'Έξοδα'!"
var FIN_QC = finQ_(FIN_TAB_CONC);   // "'Concierge'!"

var FIN_COLS = ['Month','Check_in','Check_out','Nights','Residence','Platform','Direct',
  'Guest','Owner_Type','Total_value','Total_payout','Bank_Charges','Channel_Fee',
  'Net_Price','VAT','City_Tax','Env_Fee','Gross_Value',
  'Comm_Base','Comm_20pct','Comm_VAT','Comm_Total',
  'Gross_Revenue','Company_Revenue','Status','event_id','synced_at'];
// Grammata: A Month · E Residence · F Platform · G Direct · I Owner_Type
//           M Channel_Fee · W Gross_Revenue · X Company_Revenue · Y Status

var FIN_MONTHS = ['Ιαν','Φεβ','Μαρ','Απρ','Μαϊ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];
var FIN_YEAR = 2026;
var FIN_PLATFORM_ROWS = 12;   // prokataxorimenes grammes platformon (me guard IF kena)

// Katigories eksodou tou Candy Recipes (idia grafi me tin pigi — Maintenence me 1 'a').
// I seira edo = i seira ton grammon sto P&L.
var FIN_EXP_TYPES = ['Rent','Maintenence','Salaries (Payroll-Efka-fmy)','Admin',
  'Cleaning Services','Marketing','Laundry','Transport (Fuel, Service etc..)',
  'Utilities','Supplies','Bank Fees','Other'];

// Kefalides tou tab «Στόχοι» (v3.0 — xoris «Πραγματοποιημένος»).
// An i grammi 1 diaferei, to tab ksanaxtizetai (i stili B diatireitai).
var FIN_STOX_HDR = ['Property', 'Στόχος_' + FIN_YEAR + ' (Gross Revenue)',
  'Προβλεπόμενος (με μελλοντικές)', '% Στόχου', 'Υπόλοιπο έως στόχο'];

// -- MENU ----------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Financials')
    .addItem('1. Pull από Master', 'pullFinancials')
    .addItem('2. Rebuild tabs (κρατά στόχους)', 'rebuildFinTabs')
    .addSeparator()
    .addItem('3. Auto-pull ON (~' + FIN_AUTO_HOUR + ':00)', 'finTriggerOn')
    .addItem('3. Auto-pull OFF', 'finTriggerOff')
    .addToUi();
}

// -- LOG -----------------------------------------------------------------------

function finLog_(action, count, detail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var lg = ss.getSheetByName(FIN_TAB_LOG) || ss.insertSheet(FIN_TAB_LOG);
    if (lg.getLastRow() === 0) lg.appendRow(['timestamp','action','count','detail']);
    lg.appendRow([new Date(), action, count, detail]);
  } catch (e) {}
}

// -- HELPERS -------------------------------------------------------------------

function finDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  var m = String(v || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var g = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (g) return new Date(Number(g[3]), Number(g[2]) - 1, Number(g[1]));
  return null;
}

function finNum_(v) { var n = Number(v); return isNaN(n) ? 0 : n; }

function finNormOwner_(v) {
  var s = String(v || '').trim();
  if (!s) return '';
  var low = s.toLowerCase().replace(/\s+/g, '');
  if (low.indexOf('εταιρ') === 0) return 'Εταιρεία';
  if (low.indexOf('φυσ') === 0) return 'Φυσικό';
  if (low.indexOf('δικ') === 0 || low.indexOf('δκ') === 0) return 'Δικό μας';
  return s;
}

function finStatus_(visible, checkin, checkout) {
  if (!visible) return 'Ακυρωμένη (payout)';
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var ci = finDate_(checkin), co = finDate_(checkout);
  if (co && co <= today) return 'Ολοκληρωμένη';
  if (ci && ci <= today) return 'Τρέχουσα';
  return 'Μελλοντική';
}

// Kleidi antistoixisis onomaton property: to Direct_Cash exei syntomeymena onomata
// (px. "Islander", "Thymari", "Yagha") eno to Hosthub ta episima ("Islander House",
// "Thymari Villa", "Villa Yagha"). Kanonikopoioume PANTA sto onoma tou Master Properties.
function finPropKey_(name) {
  var s = String(name || '').toLowerCase();
  if (s.indexOf('yagha') > -1) return 'yagha';
  if (s.indexOf('thymari') > -1) return 'thymari';
  if (s.indexOf('windmill') > -1 || s.indexOf('orig') > -1) return 'origin';
  if (s.indexOf('jasper') > -1) return 'jasper';
  if (s.indexOf('piperi') > -1 || s.indexOf('pipperi') > -1) return 'piperi';   // kai to typo tou expenses file
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
  if (s.indexOf('beaufort') > -1 || s.indexOf('isterni') > -1) return 'beaufort';
  return s.replace(/[^a-z0-9α-ω]/g, '');
}

// key -> episimo onoma apo Master Properties
function finCanonMap_(props) {
  var map = {};
  for (var i = 0; i < props.length; i++) map[finPropKey_(props[i].name)] = props[i].name;
  return map;
}

function finIsDirect_(platform, eventId) {
  var p = String(platform || '').toLowerCase();
  if (String(eventId || '').indexOf('DC|') === 0) return true;
  return p.indexOf('direct') > -1 || p.indexOf('somnio') > -1;
}

// Properties apo to Master Properties (mono Active): [{name, ownerType}]
// Oi stiles vriskontai APO TA HEADERS (oxi statheres theseis) — to fyllo exei
// alaksei sxima sto parelthon (afairethike i Env_Fee_Night) kai kapoies grammes
// itan metatopismenes, opote ta fixed indexes den einai aksiopista.
function finProps_() {
  var out = [];
  try {
    var ext = SpreadsheetApp.openById(FIN_PROPS_ID);
    var sh = ext.getSheetByName('Master_Properties') || ext.getSheets()[0];
    var vals = sh.getDataRange().getValues();
    if (!vals.length) return out;
    var hdr = vals[0], col = { res: 0, ot: 2, act: -1 };
    for (var h = 0; h < hdr.length; h++) {
      var hh = String(hdr[h] || '').trim().toLowerCase();
      if (hh === 'residence') col.res = h;
      else if (hh === 'owner_type') col.ot = h;
      else if (hh === 'active') col.act = h;
    }
    for (var r = 1; r < vals.length; r++) {
      var nm = String(vals[r][col.res] || '').trim();
      if (!nm) continue;
      if (col.act > -1 && String(vals[r][col.act]).toUpperCase() === 'FALSE') continue;
      out.push({ name: nm, ownerType: finNormOwner_(vals[r][col.ot]) });
    }
  } catch (e) { finLog_('PROPS_ERROR', 0, e.message); }
  out.sort(function(a, b) { return a.name.localeCompare(b.name, 'el'); });
  return out;
}

// XORIS merge: to merge + setFrozenColumns den synyparxoun sto Sheets
// ("can't freeze columns which contain only part of a merged cell").
// To keimeno sto A1 aplonei optika panw apo ta kena kelia dipla tou.
// Arithmos stilis -> gramma (douleuei kai meta to Z: 27 -> AA)
function finColL_(num) {
  var s = '';
  while (num > 0) { var m = (num - 1) % 26; s = String.fromCharCode(65 + m) + s; num = Math.floor((num - 1) / 26); }
  return s;
}

// Katigoriopoiisi eggrafis eksodou (apofasi Tasou 2/8/2026):
//   'Πάγιο'   — kataskeyi/anakainisi (ergolavikó Gky sto Peppermint II). Einai epenδysi,
//               DEN einai kostos xrisis -> ektos P&L.
//   'Εγγύηση' — epistrepteo poso (Yagha 1o meros, eggyiseis sentonion). Apaitisi -> ektos P&L.
//   'Opex'    — kanoniko leitourgiko kostos -> MONO ayto mpainei sto P&L.
// Miktes grammes typou «Εγγύηση + Ενοίκιο Απριλίου» menoun Opex (to megalytero meros
// einai pragmatiko misthoma).
function finExpCat_(typ, exp) {
  var s = String(exp || '').toLowerCase();
  if (s.indexOf('gky') > -1) return 'Πάγιο';
  if (/εγγ[υύ]ηση|εγγυησ|deposit/.test(s)) {
    if (/εν[οό][ιί]κ|μ[ιί]σθωμα|rent/.test(s)) return 'Opex';
    return 'Εγγύηση';
  }
  return 'Opex';
}

// v3.3: to keimeno grafetai mesa sto block tou kathe pinaka opou ginetai·
// edo menei mono i morfopoiisi. Otan dinetai text, to grafoume ki afto.
function finTitle_(sh, row, text, cols) {
  var r = sh.getRange(row, 1, 1, cols);
  r.setFontWeight('bold').setBackground('#1F7A4D').setFontColor('#FFFFFF');
  if (text !== null && text !== undefined) sh.getRange(row, 1).setValue(text);
}

// -- DATA ROW BUILD (kathari synartisi — testable) ------------------------------

function finBuildDataRows_(bv, canon, C) {
  canon = canon || {};
  C = C || MB;   // header-resolved indexes (finBookCols_)· fallback: MB
  var out = [];
  for (var r = 0; r < bv.length; r++) {
    var id = String(bv[r][C.EVENT_ID] || '');
    if (!id && !bv[r][C.RESIDENCE]) continue;                     // kenes grammes
    // Kanonikopoiisi onomatos property (Direct_Cash aliases -> episimo onoma)
    var resName = canon[finPropKey_(bv[r][C.RESIDENCE])] || bv[r][C.RESIDENCE];
    var visible = String(bv[r][C.VISIBLE]).toUpperCase() !== 'FALSE';
    var payout = finNum_(bv[r][C.PAYOUT]);
    if (!visible && payout <= 0) continue;                         // akyromeni xoris payout
    var ot = finNormOwner_(bv[r][C.OWNER_TYPE]);
    var bank = finNum_(bv[r][C.BANK]);
    var chan = Math.abs(finNum_(bv[r][C.SERVICE_FEE]));
    // GROSS REVENUE (to noumero tou stoxou):
    //   Εταιρεία / Δικό μας: Net − service fee − bank
    //   Φυσικό             : Gross − service fee − bank
    var basis = (ot === 'Φυσικό') ? finNum_(bv[r][C.GROSS]) : finNum_(bv[r][C.NET]);
    if (!basis) basis = finNum_(bv[r][C.NET]) || finNum_(bv[r][C.GROSS]) || finNum_(bv[r][C.PAYOUT]);
    var grossRev = Math.round((basis - chan - bank) * 100) / 100;
    out.push([
      bv[r][C.MONTH], bv[r][C.CHECKIN], bv[r][C.CHECKOUT], bv[r][C.NIGHTS],
      resName, bv[r][C.PLATFORM],
      finIsDirect_(bv[r][C.PLATFORM], id) ? 'Ναι' : 'Όχι',
      bv[r][C.GUEST], ot,
      bv[r][C.TOTAL_VALUE], bv[r][C.PAYOUT], bv[r][C.BANK], chan,
      bv[r][C.NET], bv[r][C.VAT], bv[r][C.CITY], bv[r][C.ENV], bv[r][C.GROSS],
      bv[r][C.COMM_BASE], bv[r][C.COMM20], bv[r][C.COMM_VAT], bv[r][C.COMM_TOTAL],
      grossRev, bv[r][C.COMP_REV],
      finStatus_(visible, bv[r][C.CHECKIN], bv[r][C.CHECKOUT]),
      id, new Date()
    ]);
  }
  out.sort(function(a, b) {
    var x = finDate_(a[1]), y = finDate_(b[1]);
    return (x ? x.getTime() : 0) - (y ? y.getTime() : 0);
  });
  return out;
}

// -- 1. PULL -------------------------------------------------------------------

function pullFinancials(silent) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // v2.x -> v3.0: metonomasia tab kai katharisma ton katargimenon (idempotent)
  try { finMigrate_(ss); } catch (eM) { finLog_('MIGRATE_ERROR', 0, eM.message); }
  var master, bk;
  try {
    master = SpreadsheetApp.openById(FIN_MASTER_ID);
    bk = master.getSheetByName('Bookings');
  } catch (e) {
    finLog_('MASTER_OPEN_ERROR', 0, e.message);
    if (!silent) SpreadsheetApp.getUi().alert('Δεν άνοιξε το Master File: ' + e.message);
    return;
  }
  if (!bk) { if (!silent) SpreadsheetApp.getUi().alert('Δεν βρέθηκε tab Bookings στο Master.'); return; }

  var bLast = bk.getLastRow();
  var bCols = bk.getLastColumn();
  var bHdr = finBookCols_(bk.getRange(1, 1, 1, bCols).getValues()[0]);   // 8/8: apo headers
  var bv = bLast > 1 ? bk.getRange(2, 1, bLast - 1, bCols).getValues() : [];
  var propsL = finProps_();
  var out = finBuildDataRows_(bv, finCanonMap_(propsL), bHdr);

  var sh = finDataSheet_(ss);
  var maxR = sh.getMaxRows();
  if (maxR > 1) sh.getRange(2, 1, maxR - 1, FIN_COLS.length).clearContent();
  if (out.length) {
    sh.getRange(2, 1, out.length, FIN_COLS.length).setValues(out);
    sh.getRange(2, 2, out.length, 2).setNumberFormat('dd/MM/yyyy');
    sh.getRange(2, 10, out.length, 15).setNumberFormat('#,##0.00');   // J..X
  }

  try { finBuildAvail_(ss, out); }
  catch (eA) { finLog_('AVAIL_ERROR', 0, eA.message); }
  try { finBuildOcc_(ss, propsL, out); }
  catch (eO) { finLog_('OCC_ERROR', 0, eO.message); }
  try { finPullExpenses_(ss); }
  catch (eE) { finLog_('EXPENSES_ERROR', 0, eE.message); }
  try { finPullConcierge_(ss); }
  catch (eC) { finLog_('CONCIERGE_ERROR', 0, eC.message); }
  finEnsureTabs_(ss, false);
  finLog_('PULL', out.length, 'apo Master');
  if (!silent) SpreadsheetApp.getUi().alert('Pull OK — ' + out.length + ' γραμμές στο «' + FIN_TAB_DATA + '».');
}

function pullFinancialsAuto() { pullFinancials(true); }

function finDataSheet_(ss) {
  var sh = ss.getSheetByName(FIN_TAB_DATA) || ss.insertSheet(FIN_TAB_DATA);
  var curHdr = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  if (curHdr.join('|') !== FIN_COLS.join('|')) {
    sh.clear();
    sh.getRange(1, 1, 1, FIN_COLS.length).setValues([FIN_COLS])
      .setFontWeight('bold').setBackground('#1F7A4D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  var rng = sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), FIN_COLS.length);
  function rule(f, bg) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(f)
      .setBackground(bg).setRanges([rng]).build();
  }
  sh.setConditionalFormatRules([
    rule('=$Y2="Ακυρωμένη (payout)"', '#F4CCCC'),
    rule('=$Y2="Μελλοντική"', '#EFEFEF'),
    rule('=$Y2="Τρέχουσα"', '#D9EAD3')
  ]);
  return sh;
}

// -- 2. TABS -------------------------------------------------------------------

// rebuild=false: xtizei mono tabs pou LEIPOUN (+ nea properties sto Στόχοι).
// rebuild=true : ksanaxtizei ola (to Στόχοι krataei ti stili B).
function finEnsureTabs_(ss, rebuild) {
  var props = finProps_();
  if (!props.length) { finLog_('TABS_SKIP', 0, 'Keni lista properties (des PROPS_ERROR sto Log)'); return; }
  // Kathe tab xtizetai ANEKSARTITA (ena error den blokarei ta ypoloipa)
  // kai AYTO-THERAPEVETAI: an exei ligoteres grammes apo ta properties
  // (misoxtismeno apo palio error), ksanaxtizetai.
  try { finBuildStoxoi_(ss, props, rebuild); }
  catch (e1) { finLog_('STOXOI_ERROR', 0, e1.message); }
  var ov = ss.getSheetByName(FIN_TAB_OVER);
  if (!ov || rebuild || ov.getLastRow() < 3 + props.length) {
    try { finBuildOverview_(ss, props); }
    catch (e2) { finLog_('OVERVIEW_ERROR', 0, e2.message); }
  }
  var fees = ss.getSheetByName(FIN_TAB_FEES);
  if (!fees || rebuild || fees.getLastRow() < 3 + props.length) {
    try { finBuildFees_(ss, props); }
    catch (e3) { finLog_('FEES_ERROR', 0, e3.message); }
  }
  if (!ss.getSheetByName(FIN_TAB_CO) || rebuild) {
    try { finBuildCompanyGoal_(ss); }
    catch (e4) { finLog_('COMPANY_GOAL_ERROR', 0, e4.message); }
  }
  // P&L: XTIZETAI PANTA. Oi grammes analysis ana eksodo einai TIMES (oxi typoi),
  // opote prepei na ksanagrafontai se kathe pull gia na einai enimeromenes.
  try {
    finBuildPnL_(ss, props, finOtherBuckets_(ss, props));
  } catch (e5) { finLog_('PNL_ERROR', 0, e5.message); }
  var s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Φύλλο1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  finOrderTabs_(ss);
}

// Seira tab: prota ta dashboards, meta oi vaseis dedomenon, teleftaio to Log.
var FIN_TAB_ORDER = ['Στόχος Εταιρείας', 'P&L', 'Overview', 'Στόχοι',
  'Platform_Fees', 'Occupancy', 'Διαθεσιμότητα', 'Κρατήσεις', 'Έξοδα', 'Concierge', 'Log'];

// v3.3: diavazoume tin trexousa seira MIA fora kai metakinoume MONO osa tabs
// einai se lathos thesi. Se ena arxeio pou einai idi taksinomimeno: 1 klisi anti gia 33.
function finOrderTabs_(ss) {
  try {
    var cur = ss.getSheets(), i, name, pos = {}, want = [];
    for (i = 0; i < cur.length; i++) pos[cur[i].getName()] = i + 1;
    for (i = 0; i < FIN_TAB_ORDER.length; i++) {
      name = FIN_TAB_ORDER[i];
      if (pos.hasOwnProperty(name)) want.push(name);
    }
    var ok = true;
    for (i = 0; i < want.length; i++) if (pos[want[i]] !== i + 1) { ok = false; break; }
    if (ok) return;                                   // idi sosta — kamia allagi
    for (i = 0; i < want.length; i++) {
      var sh = ss.getSheetByName(want[i]);
      if (!sh) continue;
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(i + 1);
    }
  } catch (e) { finLog_('ORDER_TABS_ERROR', 0, e.message); }
}

// -- MIGRATION v2.x -> v3.0 ----------------------------------------------------
// Metonomazei ta palia tabs (ta dedomena menoun) kai svinei osa katargithikan.
// Trexei sto pull PRIN apo otidipote allo, opote to anavathmismeno script
// doulevei se yparxon arxeio xoris na xathei tipota.

function finMigrate_(ss) {
  var i, sh, moved = [];
  for (var oldName in FIN_OLD_NAMES) {
    if (!FIN_OLD_NAMES.hasOwnProperty(oldName)) continue;
    var neo = FIN_OLD_NAMES[oldName];
    var oldSh = ss.getSheetByName(oldName);
    if (!oldSh) continue;
    if (ss.getSheetByName(neo)) {
      // Yparxei idi to neo -> to palio einai perisso
      try { ss.deleteSheet(oldSh); moved.push(oldName + ' (διπλό, διαγράφηκε)'); } catch (e) {}
    } else {
      try { oldSh.setName(neo); moved.push(oldName + ' -> ' + neo); } catch (e) {}
    }
  }
  for (i = 0; i < FIN_DEAD_TABS.length; i++) {
    sh = ss.getSheetByName(FIN_DEAD_TABS[i]);
    if (!sh) continue;
    try { ss.deleteSheet(sh); moved.push(FIN_DEAD_TABS[i] + ' (καταργήθηκε)'); } catch (e) {}
  }
  if (moved.length) finLog_('MIGRATE_V3', moved.length, moved.join(' · '));
}

function rebuildFinTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try { finMigrate_(ss); } catch (eM) { finLog_('MIGRATE_ERROR', 0, eM.message); }
  finEnsureTabs_(ss, true);
  finLog_('REBUILD_TABS', 0, '');
  SpreadsheetApp.getUi().alert('Tabs OK (P&L, Overview, Στόχοι, Platform_Fees, Διαθεσιμότητα).\n' +
    'Οι στόχοι στη στήλη B του «Στόχοι» και ο στόχος B4 του «Στόχος Εταιρείας» διατηρήθηκαν.');
}

// -- OVERVIEW ------------------------------------------------------------------
// Property | Gross Revenue (ΕΤΟΣ) | Company Revenue (ΕΤΟΣ) | % Στόχου | Απρ..Οκτ (Gross Revenue/μήνα)

function finBuildOverview_(ss, props) {
  var sh = ss.getSheetByName(FIN_TAB_OVER) || ss.insertSheet(FIN_TAB_OVER);
  sh.clear();
  var monthsIdx = [4, 5, 6, 7, 8, 9, 10];                    // Απρ..Οκτ
  var NC = 4 + monthsIdx.length;                             // 11 stiles
  var n = props.length, i, c, a;
  var QD = FIN_QD, RD = finRng_(ss, FIN_TAB_DATA);

  // v3.3: OLO to block me ENA setValues (prin: ~165 kliseis API).
  var M = [];
  a = ['Property', 'Gross Revenue', 'Company Revenue', '% Στόχου'];
  for (i = 0; i < monthsIdx.length; i++) a.push(FIN_MONTHS[monthsIdx[i] - 1]);
  M.push(a);

  var SB = "'" + FIN_TAB_STOX + "'!$A$2:$B$" + (n + 2);
  for (i = 0; i < n; i++) {
    var row = 3 + i;
    a = [props[i].name,
      '=SUMIFS(' + QD + RD.W + ',' + QD + RD.E + ',$A' + row + ')',
      '=SUMIFS(' + QD + RD.X + ',' + QD + RD.E + ',$A' + row + ')',
      '=IFERROR(IF(VLOOKUP($A' + row + ',' + SB + ',2,FALSE)=0,"",' +
        '$B' + row + '/VLOOKUP($A' + row + ',' + SB + ',2,FALSE)),"")'];
    for (c = 0; c < monthsIdx.length; c++) {
      a.push('=SUMIFS(' + QD + RD.W + ',' + QD + RD.E + ',$A' + row + ',' + QD + RD.A + ',' + monthsIdx[c] + ')');
    }
    M.push(a);
  }

  var tRow = 3 + n;
  // To tab «Στόχοι» exei diko tou ΣΥΝΟΛΟ sti stili B — to eksairoume gia na min metrithei 2 fores.
  var SX = 'SUMIF(\'' + FIN_TAB_STOX + '\'!$A$2:$A$' + (n + 2) + ',"<>ΣΥΝΟΛΟ",\'' + FIN_TAB_STOX + '\'!$B$2:$B$' + (n + 2) + ')';
  a = ['ΣΥΝΟΛΟ'];
  for (c = 2; c <= NC; c++) {
    if (c === 4) { a.push('=IFERROR(IF(' + SX + '=0,"",$B' + tRow + '/' + SX + '),"")'); continue; }
    var L = finColL_(c);
    a.push('=SUM(' + L + '3:' + L + (tRow - 1) + ')');
  }
  M.push(a);

  sh.getRange(2, 1, M.length, NC).setValues(M);

  finTitle_(sh, 1, 'OVERVIEW ' + FIN_YEAR + ' — Gross Revenue vs Στόχος & Company Revenue (net)', NC);
  sh.getRange(2, 1, 1, NC).setFontWeight('bold').setBackground('#D9EAD3');
  sh.getRange(tRow, 1, 1, NC).setFontWeight('bold');
  sh.getRange(3, 2, n + 1, 2).setNumberFormat('#,##0.00');
  sh.getRange(3, 4, n + 1, 1).setNumberFormat('0.0%');
  sh.getRange(3, 5, n + 1, monthsIdx.length).setNumberFormat('#,##0');
  sh.setFrozenRows(2);
  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 170);
  var pRng = sh.getRange(3, 4, n, 1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(0.85).setBackground('#D9EAD3').setRanges([pRng]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(0.5, 0.8499).setBackground('#FFF2A8').setRanges([pRng]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0.5).setBackground('#F4CCCC').setRanges([pRng]).build()
  ]);
}

// -- ΣΤΟΧΟΙ --------------------------------------------------------------------
// A Property | B Στόχος (MANUAL — Gross Revenue έτους) | C Πραγματοποιημένος |
// D Προβλεπόμενος (με μελλοντικές) | E % | F Υπόλοιπο

function finBuildStoxoi_(ss, props, rebuild) {
  var sh = ss.getSheetByName(FIN_TAB_STOX);
  var isNew = !sh;
  if (!sh) sh = ss.insertSheet(FIN_TAB_STOX);

  // An to yparxon tab exei palies kefalides (p.x. me ti stili «Πραγματοποιημένος»
  // tis v2.x), epivalletai rebuild — alliws oi typoi tha edeixnan lathos stiles.
  var hdrOk = false;
  if (!isNew && sh.getLastColumn() > 0) {
    var cur = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    hdrOk = (cur.join('|') === FIN_STOX_HDR.join('|'));
  }
  if (!isNew && !hdrOk) rebuild = true;

  var saved = {};
  if (!isNew && sh.getLastRow() > 1) {
    var old = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < old.length; i++) {
      var nm = String(old[i][0] || '').trim();
      if (nm && nm !== 'ΣΥΝΟΛΟ') saved[nm] = old[i][1];
    }
  }
  if (!isNew && !rebuild) {
    var toAdd = props.filter(function(p) { return !saved.hasOwnProperty(p.name); });
    if (!toAdd.length) return;
    // vale tis nees grammes PANO apo ti grammi ΣΥΝΟΛΟ (an yparxei)
    var lastR = sh.getLastRow();
    var aCol = sh.getRange(1, 1, lastR, 1).getValues();
    var insertAt = lastR + 1;
    for (var q = 0; q < aCol.length; q++) if (String(aCol[q][0]) === 'ΣΥΝΟΛΟ') { insertAt = q + 1; break; }
    sh.insertRowsBefore(insertAt, toAdd.length);
    var RDa = finRng_(ss, FIN_TAB_DATA), Ma = [];
    for (var a = 0; a < toAdd.length; a++) Ma.push(finStoxoiRowVals_(insertAt + a, toAdd[a].name, '', RDa));
    sh.getRange(insertAt, 1, Ma.length, 5).setValues(Ma);
    return;
  }

  sh.clear();
  // v3.3: kefalida + grammes + synolo me ENA setValues (prin: ~143 kliseis API).
  var RD = finRng_(ss, FIN_TAB_DATA);
  var tRow = 2 + props.length;
  var M = [FIN_STOX_HDR.slice()];
  for (var j = 0; j < props.length; j++) {
    M.push(finStoxoiRowVals_(2 + j, props[j].name,
      saved.hasOwnProperty(props[j].name) ? saved[props[j].name] : '', RD));
  }
  M.push(['ΣΥΝΟΛΟ',
    '=SUM(B2:B' + (tRow - 1) + ')',
    '=SUM(C2:C' + (tRow - 1) + ')',
    '=IF(OR(B' + tRow + '="",B' + tRow + '=0),"",C' + tRow + '/B' + tRow + ')',
    '=IF(OR(B' + tRow + '="",B' + tRow + '=0),"",B' + tRow + '-C' + tRow + ')']);
  sh.getRange(1, 1, M.length, 5).setValues(M);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1F7A4D').setFontColor('#FFFFFF');
  sh.getRange(tRow, 1, 1, 5).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange(2, 2, props.length + 1, 2).setNumberFormat('#,##0.00');   // B, C
  sh.getRange(2, 4, props.length + 1, 1).setNumberFormat('0.0%');       // D
  sh.getRange(2, 5, props.length + 1, 1).setNumberFormat('#,##0.00');   // E
  sh.setColumnWidth(1, 170);
  sh.getRange(2, 2, props.length, 1).setBackground('#FFF2CC');   // MANUAL stili
}

// v3.0: xoris tin stili «Πραγματοποιημένος» (apofasi Tasou 3/8/2026).
// A Property · B Stoxos (MANUAL) · C Provlepomenos · D % Stoxou · E Ypoloipo
// v3.3: epistrefei tin grammi os pinaka anti na grafei kelli-kelli (5 kliseis -> 0).
function finStoxoiRowVals_(row, name, target, RD) {
  return [name, target,
    '=SUMIFS(' + FIN_QD + RD.W + ',' + FIN_QD + RD.E + ',$A' + row + ')',
    '=IF(OR($B' + row + '="",$B' + row + '=0),"",$C' + row + '/$B' + row + ')',
    '=IF(OR($B' + row + '="",$B' + row + '=0),"",$B' + row + '-$C' + row + ')'];
}

// -- ΔΙΑΘΕΣΙΜΟΤΗΤΑ (ypologizetai se KATHE pull — times, oxi formules) ----------
// Periodos: Aprilios–Oktovrios (apofasi Tasou 2/8). Metrame apo max(simera, 1/4)
// eos 31/10: kleismenes/adiathetes nyxtes, adiathetes se kena >=3 synexomenon
// imeron (poulisima), kai ektimisi aksias me meso Gross_Revenue KAI meso
// Company_Revenue ana nyxta (apo tis kratiseis Apr–Okt tou kathe spitiou).
// Akyromenes (payout) DEN metrane os kleismenes meres (oi imerominies einai eleutheres).

function finBuildAvail_(ss, dataRows) {
  var sh = ss.getSheetByName(FIN_TAB_AVAIL) || ss.insertSheet(FIN_TAB_AVAIL);
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();

  var seasonStart = new Date(FIN_YEAR, 3, 1);    // 1 Apr
  var seasonEnd   = new Date(FIN_YEAR, 10, 1);   // 1 Nov (exclusive) -> nyxtes eos 31/10
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var winStart = today > seasonStart ? today : seasonStart;
  var DAY = 86400000;
  var totalDays = Math.max(0, Math.round((seasonEnd - winStart) / DAY));

  // Omadopoiisi ana property
  var byProp = {};
  for (var i = 0; i < dataRows.length; i++) {
    var res = String(dataRows[i][4] || '');
    if (!res) continue;
    (byProp[res] = byProp[res] || []).push(dataRows[i]);
  }
  var names = Object.keys(byProp).sort(function(a, b) { return a.localeCompare(b, 'el'); });

  var NC = 9;
  finTitle_(sh, 1, 'ΔΙΑΘΕΣΙΜΟΤΗΤΑ ' + FIN_YEAR + ' — υπόλοιπο σεζόν (σήμερα → 31/10)', NC);
  var hdr = ['Property', 'Μέρες περιόδου', 'Κλεισμένες', 'Αδιάθετες', 'Αδιάθετες σε κενά ≥3ημ',
    'Μέσο GR/νύχτα', 'Εκτίμηση αξίας (GR)', 'Μέσο CR/νύχτα', 'Εκτίμηση αξίας (CR)'];
  sh.getRange(2, 1, 1, NC).setValues([hdr]).setFontWeight('bold').setBackground('#D9EAD3');

  var out = [], tot = [0, 0, 0, 0, 0, 0];
  for (var p = 0; p < names.length; p++) {
    var rows = byProp[names[p]];
    // 1. Kleismenes nyxtes sto parathyro (mono MI akyromenes)
    var occupied = {};
    var sumGR = 0, sumCR = 0, sumN = 0;
    for (var r = 0; r < rows.length; r++) {
      var st = String(rows[r][24] || '');
      var ci = finDate_(rows[r][1]), co = finDate_(rows[r][2]);
      // Meso GR/CR ana nyxta: kratiseis me check-in Apr–Okt (xoris akyromenes)
      var m = Number(rows[r][0]);
      var n = Number(rows[r][3]) || (ci && co ? Math.round((co - ci) / DAY) : 0);
      if (st.indexOf('Ακυρ') === -1 && m >= 4 && m <= 10 && n > 0) {
        sumGR += Number(rows[r][22]) || 0;
        sumCR += Number(rows[r][23]) || 0;
        sumN += n;
      }
      if (st.indexOf('Ακυρ') > -1 || !ci || !co) continue;
      for (var d = Math.max(ci.getTime(), winStart.getTime()); d < Math.min(co.getTime(), seasonEnd.getTime()); d += DAY) {
        occupied[Math.round((d - winStart.getTime()) / DAY)] = 1;
      }
    }
    var booked = Object.keys(occupied).length;
    var free = totalDays - booked;
    // 2. Kena >=3 synexomenon imeron
    var free3 = 0, run = 0;
    for (var dd = 0; dd < totalDays; dd++) {
      if (!occupied[dd]) { run++; }
      else { if (run >= 3) free3 += run; run = 0; }
    }
    if (run >= 3) free3 += run;
    var avgGR = sumN > 0 ? sumGR / sumN : 0;
    var avgCR = sumN > 0 ? sumCR / sumN : 0;
    out.push([names[p], totalDays, booked, free, free3,
      Math.round(avgGR * 100) / 100, Math.round(free3 * avgGR),
      Math.round(avgCR * 100) / 100, Math.round(free3 * avgCR)]);
    tot[0] += booked; tot[1] += free; tot[2] += free3;
    tot[3] += Math.round(free3 * avgGR); tot[4] += Math.round(free3 * avgCR);
  }
  if (out.length) {
    sh.getRange(3, 1, out.length, NC).setValues(out);
    var tRow = 3 + out.length;
    sh.getRange(tRow, 1, 1, NC).setValues([['ΣΥΝΟΛΟ', totalDays * out.length, tot[0], tot[1], tot[2],
      '', tot[3], '', tot[4]]]).setFontWeight('bold');
    sh.getRange(3, 6, out.length, 1).setNumberFormat('#,##0.00');
    sh.getRange(3, 8, out.length, 1).setNumberFormat('#,##0.00');
    sh.getRange(3, 7, out.length + 1, 1).setNumberFormat('#,##0');
    sh.getRange(3, 9, out.length + 1, 1).setNumberFormat('#,##0');
    sh.getRange(tRow + 2, 1).setValue('Υπολογίστηκε: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') +
      ' · Περίοδος: ' + Utilities.formatDate(winStart, Session.getScriptTimeZone(), 'dd/MM') + '–31/10 · ' +
      'Μέσες τιμές/νύχτα από κρατήσεις Απρ–Οκτ του κάθε σπιτιού · Ακυρωμένες δεν μετράνε ως κλεισμένες.')
      .setFontStyle('italic').setFontSize(9).setFontColor('#777777');
  }
  sh.setFrozenRows(2);
  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 170);
}

// ---------------------------------------------------------------------------
// OCCUPANCY (v3.2 — apofasi Tasou)
// Plirotita ana AKINITO x MINA, MONO gia ti sezon Apr–Okt (apofasi Tasou).
// Tessera blocks: Plirotita % · Kleismenes nyxtes · ADR · RevPAR.
//
// Ypologizetai ANA IMERA (oxi me tin stili Month), opote mia kratisi
// 28/7–3/8 moirazetai sosta: 4 nyxtes ston Iouli, 3 ston Avgousto.
// Ta esoda katanemontai analogika (Total_value / synolikes nyxtes).
// Akyromenes DEN metrane. To Direct Cash METRAEI (einai pragmatiki plirotita).
//
// PROSOXI (apofasi Tasou 27/8): oi nyxtes me MIDENIKI aksia — diamones idioktiti
// (platform "Owner"), "Noma", kai Direct Cash xoris poso — METRANE sti plirotita
// (to spiti itan piasmeno) alla DEN mpainoun ston paronomasti tou ADR, giati tha
// to erixnan texnita. Fainontai se diko tous block gia diafaneia.
//
// Grafetai me TIMES (oxi typous): ta dedomena einai imerologiaka kai den
// ekfrazontai me SUMIFS — ksanagrafetai se kathe pull.
// ---------------------------------------------------------------------------

var FIN_OCC_M0 = 4;    // Aprilios
var FIN_OCC_M1 = 10;   // Oktovrios

function finDaysInMonth_(y, m) { return new Date(y, m, 0).getDate(); }   // m: 1-based

// Athroisma imeron tis sezon (Apr–Okt tou FIN_YEAR)
function finSeasonDays_() {
  var t = 0;
  for (var m = FIN_OCC_M0; m <= FIN_OCC_M1; m++) t += finDaysInMonth_(FIN_YEAR, m);
  return t;
}

function finBuildOcc_(ss, props, dataRows) {
  var sh = ss.getSheetByName(FIN_TAB_OCC) || ss.insertSheet(FIN_TAB_OCC);
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();

  var DAY = 86400000;
  var NM = FIN_OCC_M1 - FIN_OCC_M0 + 1;          // 7 mines
  var NC = 2 + NM;                                // A + 7 mines + SEZON
  var i, j, m, p, r;

  // --- 1. Onomata grammon: prota ta episima akinita, meta oti perisseyei sti vasi
  var names = [], seen = {};
  for (i = 0; i < props.length; i++) {
    if (seen[props[i].name]) continue;
    seen[props[i].name] = 1; names.push(props[i].name);
  }
  var extra = {};
  for (r = 0; r < dataRows.length; r++) {
    var nm0 = String(dataRows[r][4] || '').trim();
    if (nm0 && !seen[nm0]) extra[nm0] = 1;
  }
  var extras = Object.keys(extra).sort(function(a, b) { return a.localeCompare(b, 'el'); });
  for (i = 0; i < extras.length; i++) { names.push(extras[i]); seen[extras[i]] = 1; }
  if (extras.length) finLog_('OCC_EXTRA_PROPS', extras.length, extras.join(' · '));

  var rowOf = {};
  for (i = 0; i < names.length; i++) rowOf[names[i]] = i;

  // --- 2. Sygkentrosi ana akinito x mina
  // occ[i][j] = SET imeron (dedup: diplokratiseis den dinoun >100%)
  // nig[i][j] = poulimenes nyxtes (athroisma kratiseon)
  // rev[i][j] = Gross_Revenue katanemimeno ana nyxta
  // pn[i][j] = nyxtes ME esodo (paronomastis tou ADR)
  // zn[i][j] = nyxtes XORIS esodo (idioktitis / Noma) — mono gia provoli
  var occ = [], nig = [], rev = [], pn = [], zn = [];
  for (i = 0; i < names.length; i++) {
    occ.push([]); nig.push([]); rev.push([]); pn.push([]); zn.push([]);
    for (j = 0; j < NM; j++) { occ[i].push({}); nig[i].push(0); rev[i].push(0); pn[i].push(0); zn[i].push(0); }
  }

  var skipped = 0;
  for (r = 0; r < dataRows.length; r++) {
    var row = dataRows[r];
    var nm = String(row[4] || '').trim();
    if (!nm || !(nm in rowOf)) continue;
    if (String(row[24] || '').indexOf('Ακυρ') > -1) continue;      // akyromenes ektos
    var ci = finDate_(row[1]), co = finDate_(row[2]);
    if (!ci || !co || co <= ci) { skipped++; continue; }
    var tot = Math.round((co.getTime() - ci.getTime()) / DAY);
    if (tot <= 0) { skipped++; continue; }
    // ADR/RevPAR se TOTAL VALUE = oti plirose o pelatis (apofasi Tasou 27/8).
    var amount = finNum_(row[9]);
    var perNight = amount / tot;
    var paid = amount > 0;
    var idx = rowOf[nm];
    for (var t = ci.getTime(); t < co.getTime(); t += DAY) {
      var d = new Date(t);
      if (d.getFullYear() !== FIN_YEAR) continue;
      var mo = d.getMonth() + 1;
      if (mo < FIN_OCC_M0 || mo > FIN_OCC_M1) continue;
      var jj = mo - FIN_OCC_M0;
      occ[idx][jj][d.getMonth() * 100 + d.getDate()] = 1;
      nig[idx][jj] += 1;
      if (paid) { pn[idx][jj] += 1; rev[idx][jj] += perNight; } else { zn[idx][jj] += 1; }
    }
  }
  if (skipped) finLog_('OCC_SKIPPED_ROWS', skipped, 'kratiseis me akyres imerominies');

  // --- 3. Voithitika
  var dim = [], seasonDays = 0;
  for (j = 0; j < NM; j++) { dim.push(finDaysInMonth_(FIN_YEAR, FIN_OCC_M0 + j)); seasonDays += dim[j]; }
  var hdrM = [];
  for (j = 0; j < NM; j++) hdrM.push(FIN_MONTHS[FIN_OCC_M0 - 1 + j] + ' (' + dim[j] + ')');

  function occDays(i, j) { return Object.keys(occ[i][j]).length; }
  function sumRow(arr, i) { var s = 0, k; for (k = 0; k < NM; k++) s += arr[i][k]; return s; }
  function occDaysRow(i) { var s = 0, k; for (k = 0; k < NM; k++) s += occDays(i, k); return s; }
  function colOccDays(j) { var s = 0, k; for (k = 0; k < names.length; k++) s += occDays(k, j); return s; }
  function colSum(arr, j) { var s = 0, k; for (k = 0; k < names.length; k++) s += arr[k][j]; return s; }

  // --- 4. Grafi ton tessaron block
  // kind: 'occ' | 'nights' | 'adr' | 'revpar'
  function block(top, title, kind, totLabel) {
    var M = [], a, k;
    a = []; a.push(title); for (k = 1; k < NC; k++) a.push(''); M.push(a);
    a = ['Ακίνητο'].concat(hdrM); a.push(kind === 'occ' ? 'ΣΕΖΟΝ %' : 'ΣΕΖΟΝ'); M.push(a);

    for (i = 0; i < names.length; i++) {
      a = [names[i]];
      for (j = 0; j < NM; j++) {
        if (kind === 'occ')          a.push(occDays(i, j) / dim[j]);
        else if (kind === 'nights')  a.push(nig[i][j]);
        else if (kind === 'free')    a.push(zn[i][j]);
        else if (kind === 'adr')     a.push(pn[i][j] > 0 ? finR2_(rev[i][j] / pn[i][j]) : '');
        else                         a.push(finR2_(rev[i][j] / dim[j]));
      }
      if (kind === 'occ')          a.push(occDaysRow(i) / seasonDays);
      else if (kind === 'nights')  a.push(sumRow(nig, i));
      else if (kind === 'free')    a.push(sumRow(zn, i));
      else if (kind === 'adr')     a.push(sumRow(pn, i) > 0 ? finR2_(sumRow(rev, i) / sumRow(pn, i)) : '');
      else                         a.push(finR2_(sumRow(rev, i) / seasonDays));
      M.push(a);
    }

    a = [totLabel];
    for (j = 0; j < NM; j++) {
      if (kind === 'occ')          a.push(colOccDays(j) / (dim[j] * names.length));
      else if (kind === 'nights')  a.push(colSum(nig, j));
      else if (kind === 'free')    a.push(colSum(zn, j));
      else if (kind === 'adr')     a.push(colSum(pn, j) > 0 ? finR2_(colSum(rev, j) / colSum(pn, j)) : '');
      else                         a.push(finR2_(colSum(rev, j) / (dim[j] * names.length)));
    }
    var allOcc = 0, allNig = 0, allRev = 0, allPn = 0, allZn = 0;
    for (i = 0; i < names.length; i++) {
      allOcc += occDaysRow(i); allNig += sumRow(nig, i); allRev += sumRow(rev, i);
      allPn += sumRow(pn, i); allZn += sumRow(zn, i);
    }
    if (kind === 'occ')          a.push(allOcc / (seasonDays * names.length));
    else if (kind === 'nights')  a.push(allNig);
    else if (kind === 'free')    a.push(allZn);
    else if (kind === 'adr')     a.push(allPn > 0 ? finR2_(allRev / allPn) : '');
    else                         a.push(finR2_(allRev / (seasonDays * names.length)));
    M.push(a);

    sh.getRange(top, 1, M.length, NC).setValues(M);
    finTitle_(sh, top, title, NC);
    sh.getRange(top + 1, 1, 1, NC).setFontWeight('bold').setBackground('#D9EAD3');
    sh.getRange(top + M.length - 1, 1, 1, NC).setFontWeight('bold').setBackground('#F3F3F3');
    var fmt = (kind === 'occ') ? '0.0%' : ((kind === 'nights' || kind === 'free') ? '#,##0' : '#,##0.00');
    sh.getRange(top + 2, 2, names.length + 1, NC - 1).setNumberFormat(fmt);
    return top + M.length + 2;
  }

  var next = 1;
  next = block(next, 'ΠΛΗΡΟΤΗΤΑ ' + FIN_YEAR + ' — % ανά ακίνητο × μήνα (σεζόν Απρ–Οκτ)', 'occ', 'ΣΥΝΟΛΟ ΧΑΡΤΟΦΥΛΑΚΙΟΥ');
  next = block(next, 'ΚΛΕΙΣΜΕΝΕΣ ΝΥΧΤΕΣ ' + FIN_YEAR + ' (μαζί με τις νύχτες χωρίς έσοδο)', 'nights', 'ΣΥΝΟΛΟ');
  next = block(next, 'ΝΥΧΤΕΣ ΧΩΡΙΣ ΕΣΟΔΟ ' + FIN_YEAR + ' — ιδιοκτήτης / Noma / μηδενική αξία', 'free', 'ΣΥΝΟΛΟ');
  next = block(next, 'ADR ' + FIN_YEAR + ' — μέση τιμή ανά ΠΛΗΡΩΜΕΝΗ νύχτα (Total value)', 'adr', 'ΜΕΣΟΣ ΟΡΟΣ');
  next = block(next, 'RevPAR ' + FIN_YEAR + ' — έσοδο ανά διαθέσιμη νύχτα (Total value)', 'revpar', 'ΜΕΣΟΣ ΟΡΟΣ');

  sh.getRange(next, 1).setValue(
    'Πληρότητα = κλεισμένες νύχτες / ημερολογιακές μέρες του μήνα. Σεζόν Απρ–Οκτ = ' + seasonDays + ' μέρες. ' +
    'Οι νύχτες μετριούνται ανά ημέρα, οπότε κράτηση που πιάνει δύο μήνες μοιράζεται σωστά· τα έσοδα κατανέμονται αναλογικά. ' +
    'Ακυρωμένες δεν μετράνε · το Direct Cash μετράει. ADR και RevPAR υπολογίζονται σε Total value ' +
    '(ό,τι πλήρωσε ο πελάτης). ADR = Total value / ΠΛΗΡΩΜΕΝΕΣ νύχτες — οι νύχτες χωρίς έσοδο (διαμονές ' +
    'ιδιοκτήτη, Noma) μετράνε στην πληρότητα γιατί το σπίτι ήταν πιασμένο, αλλά ΔΕΝ μπαίνουν στον ' +
    'παρονομαστή του ADR· φαίνονται στο τρίτο block. RevPAR = Total value / ημερολογιακές μέρες. ' +
    'Μήνες που δεν έχουν έρθει ακόμα δείχνουν ό,τι είναι ήδη κλεισμένο. ' +
    'Υπολογίστηκε: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'))
    .setFontStyle('italic').setFontSize(9).setFontColor('#777777');

  sh.setFrozenRows(2);
  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 220);
  sh.setColumnWidths(2, NC - 1, 88);                // v3.3: 1 klisi anti gia 8
  finLog_('BUILD_OCC', names.length, 'akinita · sezon ' + seasonDays + ' meres');
}


// -- EXPENSES & CONCIERGE PULL (apo 2026_Candy_Recipes) ------------------------
// Ta dyo tabs ksanagrafontai se kathe pull (times). Onomata property
// kanonikopoiountai (Yagha->Villa Yagha, Pipperi->Piperi klp.)· mi-property
// entries (General, Eliza's House klp.) menoun os exoun.

function finPullExpenses_(ss) {
  var src = SpreadsheetApp.openById(FIN_CANDY_ID).getSheetByName('Data Entry for P&L');
  if (!src) throw new Error('Den vrethike tab "Data Entry for P&L".');
  var vals = src.getDataRange().getValues();
  var canon = finCanonMap_(finProps_());
  var out = [], skipped = 0;
  for (var r = 1; r < vals.length; r++) {
    var v = vals[r];
    if (!v[0] && !v[3]) continue;                       // kenes grammes
    var d = finDate_(v[0]);
    if (!d || d.getFullYear() !== FIN_YEAR) { skipped++; continue; }   // mono 2026
    var prop = String(v[4] || '').trim();
    var mapped = canon[finPropKey_(prop)];
    var typ = String(v[2] || '').trim();
    var exp = String(v[3] || '').trim();
    out.push([
      d.getMonth() + 1,                                 // A Month (arithmos)
      typ,                                              // B Type
      exp,                                              // C Expense
      mapped || prop,                                   // D Property (kanonikopoiimeno)
      String(v[5] || '').trim(),                        // E Paid_by
      String(v[6]).toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE',   // F Declared
      String(v[7] || '').trim(),                        // G Debit_to
      Number(v[8]) || 0, Number(v[9]) || 0, Number(v[10]) || 0,   // H Net, I VAT, J Total
      finExpCat_(typ, exp)                              // K Κατηγορία: Opex / Πάγιο / Εγγύηση
    ]);
  }
  var sh = ss.getSheetByName(FIN_TAB_EXP) || ss.insertSheet(FIN_TAB_EXP);
  sh.clear();
  var hdr = ['Month','Type','Expense','Property','Paid_by','Declared','Debit_to','Net','VAT','Total','Κατηγορία'];
  sh.getRange(1, 1, 1, hdr.length).setValues([hdr])
    .setFontWeight('bold').setBackground('#B45F06').setFontColor('#FFFFFF');
  if (out.length) {
    sh.getRange(2, 1, out.length, hdr.length).setValues(out);
    sh.getRange(2, 8, out.length, 3).setNumberFormat('#,##0.00');
  }
  sh.setFrozenRows(1);
  var nonOpex = 0;
  for (var q = 0; q < out.length; q++) if (out[q][10] !== 'Opex') nonOpex++;
  finLog_('PULL_EXPENSES', out.length, 'skipped(non-' + FIN_YEAR + ')=' + skipped + ' · εκτός P&L=' + nonOpex);
}

function finPullConcierge_(ss) {
  var src = SpreadsheetApp.openById(FIN_CANDY_ID).getSheetByName('Consierge Services');
  if (!src) throw new Error('Den vrethike tab "Consierge Services".');
  var vals = src.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var v = vals[r];
    if (!v[0] && !v[3]) continue;
    // Imerominia: 'd.mm' keimeno I Date
    var mn = '';
    var d = finDate_(v[0]);
    if (d) mn = d.getMonth() + 1;
    else {
      var m = String(v[0] || '').match(/^\s*\d{1,2}\.(\d{1,2})\s*$/);
      if (m) mn = Number(m[1]);
    }
    out.push([mn, String(v[1] || '').trim(), String(v[2] || '').trim(),
      Number(v[3]) || 0, Number(v[4]) || 0, Number(v[5]) || 0, String(v[8] || '').trim()]);
  }
  var sh = ss.getSheetByName(FIN_TAB_CONC) || ss.insertSheet(FIN_TAB_CONC);
  sh.clear();
  var hdr = ['Month','Type','Details','Amount','Pct','Commission','Company'];
  sh.getRange(1, 1, 1, hdr.length).setValues([hdr])
    .setFontWeight('bold').setBackground('#B45F06').setFontColor('#FFFFFF');
  if (out.length) {
    sh.getRange(2, 1, out.length, hdr.length).setValues(out);
    sh.getRange(2, 4, out.length, 1).setNumberFormat('#,##0.00');
    sh.getRange(2, 6, out.length, 1).setNumberFormat('#,##0.00');
  }
  sh.setFrozenRows(1);
  finLog_('PULL_CONCIERGE', out.length, '');
}

// -- P&L (ENA tab, katheto) ----------------------------------------------------
// Apofaseis Tasou 3/8/2026:
//   * ENA tab «P&L». Dyo PANOMOIOTYPA blocks: OVERALL kai DECLARED.
//       OVERALL  = ola ta esoda (mazi me Direct Cash) kai ola ta Opex eksoda.
//       DECLARED = esoda xoris Direct Cash, eksoda mono Declared = TRUE.
//   * Stiles: Γραμμή | Ιαν..Δεκ | ΣΥΝΟΛΟ | % εσόδων   (katheti / common-size analysi)
//   * Kato apo kathe katigoria eksodou mpainoun oi PRAGMATIKES grammes tou Candy
//     (omadopoiimenes -> diplonoun me to velaki tis Google). Grafontai os TIMES,
//     ypologismenes sto script — ananeonontai se kathe pull.
//   * Kato-kato: pinakas ANA ΑΚΙΝΗΤΟ (Έσοδα − Έξοδα = Κέρδος), OVERALL kai DECLARED.
//     To Concierge einai ksexoristi grammi (esodo xoris akinito) oste to ΣΥΝΟΛΟ
//     tou pinaka na symfonei akrivos me to ΚΕΡΔΟΣ tou antistoixou block.
//   * Ksexorista tabs «Properties P&L» / «Company P&L» / «Untaxed» DEN yparxoun pia.

var FIN_PNL_NC    = 15;    // A + 12 mines + ΣΥΝΟΛΟ + % esodon
var FIN_PROP_NC   = 18;    // A + Έσοδα + 12 typoi + Λοιπά + Σύνολο + Κέρδος + Περιθώριο
var FIN_MAX_LINES = 60;    // max grammes analysis ana katigoria eksodou
var FIN_MAX_BUCKETS = 200; // max kentra kostous ektos xartofylakiou (grammes, oxi stiles)

function finQ_(name) { return "'" + name + "'!"; }

// v3.3 — FRAGMENA EURI anti gia olokliri stili.
// To '$W:$W' saronei olo to grid tou fyllou. Edo to periorizoume sto pragmatiko
// plithos grammon tis vasis syn perithorio, opote den kovei pote dedomena.
// Ypologizetai se kathe xtisimo (ta tabs ksanagrafontai se kathe pull).
var FIN_RNG_PAD = 300;
var FIN_RNG_MIN = 1000;
function finRng_(ss, tab) {
  var last = 0;
  try { var sh = ss.getSheetByName(tab); if (sh) last = sh.getLastRow(); } catch (e) {}
  var n = Math.max(last + FIN_RNG_PAD, FIN_RNG_MIN);
  var o = { N: n }, letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', i, L;
  for (i = 0; i < letters.length; i++) {
    L = letters.charAt(i);
    o[L] = '$' + L + '$2:$' + L + '$' + n;
  }
  return o;
}

function finBlankRow_(n) { var a = [], i; for (i = 0; i < n; i++) a.push(''); return a; }

function finAddCells_(L, rows) {
  var o = [], i;
  for (i = 0; i < rows.length; i++) o.push(L + rows[i]);
  return o.join('+');
}

function finR2_(v) { return Math.round((Number(v) || 0) * 100) / 100; }

// -- ANALYSI ANA GRAMMI EKSODOU ------------------------------------------------
// Diavazei to tab «Έξοδα» kai athroizei ta Opex tis etaireias ana (Τύπος, Γραμμή).
// Gia kathe grammi kratame kai to SYNOLO kai to DILOMENO meros, ana mina.

function finExpLines_(ss) {
  var out = { byType: {} };
  var sh = ss.getSheetByName(FIN_TAB_EXP);
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues();
  var map = {}, i, z;
  for (i = 0; i < v.length; i++) {
    if (String(v[i][6]).trim() !== FIN_COMPANY) continue;      // G Debit_to
    if (String(v[i][10]).trim() !== 'Opex') continue;          // K Κατηγορία
    var typ = String(v[i][1] || '').trim() || '(χωρίς κατηγορία)';
    var exp = String(v[i][2] || '').trim() || '(χωρίς περιγραφή)';
    var mn  = Number(v[i][0]) || 0;
    var amt = Number(v[i][9]) || 0;                            // J Total
    var dec = String(v[i][5]).toUpperCase() === 'TRUE';
    var key = typ + '' + exp;
    var rec = map[key];
    if (!rec) {
      rec = { typ: typ, exp: exp, tot: 0, dtot: 0, m: [], dm: [] };
      for (z = 0; z < 12; z++) { rec.m.push(0); rec.dm.push(0); }
      map[key] = rec;
      if (!out.byType[typ]) out.byType[typ] = [];
      out.byType[typ].push(rec);
    }
    rec.tot += amt;
    if (mn >= 1 && mn <= 12) rec.m[mn - 1] += amt;
    if (dec) { rec.dtot += amt; if (mn >= 1 && mn <= 12) rec.dm[mn - 1] += amt; }
  }
  for (var t in out.byType) {
    if (!out.byType.hasOwnProperty(t)) continue;
    out.byType[t].sort(function (a, b) { return b.tot - a.tot; });
  }
  return out;
}

// -- KENTRA KOSTOUS EKTOS XARTOFYLAKIOU ----------------------------------------
// Otidipote varynei ti Somnio alla den einai akinito tou xartofylakiou:
// «General» overheads kai ta ektos-xartofylakiou spitia. Taksinomisi fthinousa.

function finOtherBuckets_(ss, props) {
  var sh = ss.getSheetByName(FIN_TAB_EXP);
  if (!sh || sh.getLastRow() < 2) return [];
  var known = {}, i;
  for (i = 0; i < props.length; i++) known[String(props[i].name).trim().toLowerCase()] = true;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues();
  var agg = {}, order = [];
  for (i = 0; i < v.length; i++) {
    if (String(v[i][6]).trim() !== FIN_COMPANY) continue;
    if (String(v[i][10]).trim() !== 'Opex') continue;
    var p = String(v[i][3] || '').trim();
    if (!p) p = '(κενό)';
    if (known[p.toLowerCase()]) continue;
    if (!(p in agg)) { agg[p] = 0; order.push(p); }
    agg[p] += Number(v[i][9]) || 0;
  }
  order.sort(function (a, b) { return agg[b] - agg[a]; });
  return order.slice(0, FIN_MAX_BUCKETS);
}

// -- ENA BLOCK P&L -------------------------------------------------------------
// Epistrefei { next: proti eleftheri grammi, rTotR, rTotE, rPro, groups: [[start, n]] }

function finPnLBlock_(sh, top, taxed, title, lines, R) {
  var NC = FIN_PNL_NC, i, k, m, L, a;
  var QE = finQ_(FIN_TAB_EXP), QD = finQ_(FIN_TAB_DATA), QC = finQ_(FIN_TAB_CONC);
  var RD = R.D, RE = R.E, RC = R.C;   // v3.3: fragmena euri
  var dE = taxed ? ',' + QE + RE.F + ',"TRUE"' : '';
  var dR = taxed ? ',' + QD + RD.F + ',"<>Direct Cash"' : '';
  var EXP = QE + RE.J + ',' + QE + RE.G + ',"' + FIN_COMPANY + '",' + QE + RE.K + ',"Opex"';

  var M = [];
  function rowNo() { return top + M.length; }          // grammi pou tha parei to epomeno push
  function pct(r, rev) { return '=IF($N$' + rev + '=0,"",$N' + r + '/$N$' + rev + ')'; }

  // --- titlos + header
  a = finBlankRow_(NC); a[0] = title; M.push(a);
  a = finBlankRow_(NC); a[0] = 'Γραμμή';
  for (i = 0; i < 12; i++) a[1 + i] = FIN_MONTHS[i];
  a[13] = 'ΣΥΝΟΛΟ'; a[14] = '% εσόδων';
  var rHdr = rowNo(); M.push(a);

  // --- ΕΣΟΔΑ
  a = finBlankRow_(NC); a[0] = 'ΕΣΟΔΑ'; var rSecR = rowNo(); M.push(a);

  var rRev = rowNo();
  a = finBlankRow_(NC); a[0] = 'Έσοδα κρατήσεων';
  for (m = 1; m <= 12; m++) a[m] = '=SUMIFS(' + QD + RD.X + ',' + QD + RD.A + ',' + m + dR + ')';
  a[13] = '=SUM(B' + rRev + ':M' + rRev + ')';
  M.push(a);

  var rCon = rowNo();
  a = finBlankRow_(NC); a[0] = 'Concierge';
  for (m = 1; m <= 12; m++) a[m] = '=SUMIFS(' + QC + RC.F + ',' + QC + RC.A + ',' + m + ')';
  a[13] = '=SUM(B' + rCon + ':M' + rCon + ')';
  M.push(a);

  var rTotR = rowNo();
  a = finBlankRow_(NC); a[0] = 'ΣΥΝΟΛΟ ΕΣΟΔΩΝ';
  for (m = 1; m <= 13; m++) { L = finColL_(m + 1); a[m] = '=' + L + rRev + '+' + L + rCon; }
  M.push(a);
  // ta % ton grammon esodou (tora pou kseroume to rTotR)
  M[rRev - top][14] = pct(rRev, rTotR);
  M[rCon - top][14] = pct(rCon, rTotR);
  M[rTotR - top][14] = pct(rTotR, rTotR);

  // --- ΕΞΟΔΑ
  a = finBlankRow_(NC); a[0] = 'ΕΞΟΔΑ'; var rSecE = rowNo(); M.push(a);

  var typeRows = [], groups = [];
  for (i = 0; i < FIN_EXP_TYPES.length; i++) {
    var typ = FIN_EXP_TYPES[i];
    var rT = rowNo();
    typeRows.push(rT);
    a = finBlankRow_(NC); a[0] = typ;
    for (m = 1; m <= 12; m++) {
      a[m] = '=SUMIFS(' + EXP + ',' + QE + RE.B + ',$A' + rT + ',' + QE + RE.A + ',' + m + dE + ')';
    }
    a[13] = '=SUM(B' + rT + ':M' + rT + ')';
    a[14] = pct(rT, rTotR);
    M.push(a);

    // grammes analysis (times)
    var det = lines && lines.byType[typ] ? lines.byType[typ] : [];
    var g0 = rowNo(), gn = 0;
    for (k = 0; k < det.length && gn < FIN_MAX_LINES; k++) {
      var rec = det[k];
      var tot = taxed ? rec.dtot : rec.tot;
      if (Math.abs(tot) < 0.005) continue;
      var rD = rowNo();
      a = finBlankRow_(NC); a[0] = '      • ' + rec.exp;
      for (m = 1; m <= 12; m++) {
        var vv = taxed ? rec.dm[m - 1] : rec.m[m - 1];
        a[m] = vv ? finR2_(vv) : '';
      }
      a[13] = finR2_(tot);
      a[14] = pct(rD, rTotR);
      M.push(a); gn++;
    }
    if (gn) groups.push([g0, gn]);
  }

  // Λοιπά = ypoloipo (oti den epese se kamia apo tis 12 katigories)
  var rOth = rowNo();
  a = finBlankRow_(NC); a[0] = 'Λοιπά (εκτός κατηγοριών)';
  for (m = 1; m <= 12; m++) {
    L = finColL_(m + 1);
    a[m] = '=SUMIFS(' + EXP + ',' + QE + RE.A + ',' + m + dE + ')-(' + finAddCells_(L, typeRows) + ')';
  }
  a[13] = '=SUM(B' + rOth + ':M' + rOth + ')';
  a[14] = pct(rOth, rTotR);
  M.push(a);

  var rTotE = rowNo();
  a = finBlankRow_(NC); a[0] = 'ΣΥΝΟΛΟ ΕΞΟΔΩΝ';
  for (m = 1; m <= 13; m++) { L = finColL_(m + 1); a[m] = '=' + finAddCells_(L, typeRows) + '+' + L + rOth; }
  a[14] = pct(rTotE, rTotR);
  M.push(a);

  var rPro = rowNo();
  a = finBlankRow_(NC); a[0] = 'ΚΕΡΔΟΣ';
  for (m = 1; m <= 13; m++) { L = finColL_(m + 1); a[m] = '=' + L + rTotR + '-' + L + rTotE; }
  a[14] = pct(rPro, rTotR);
  M.push(a);

  var rMar = rowNo();
  a = finBlankRow_(NC); a[0] = 'ΠΕΡΙΘΩΡΙΟ %';
  for (m = 1; m <= 13; m++) {
    L = finColL_(m + 1);
    a[m] = '=IF(' + L + rTotR + '=0,"",' + L + rPro + '/' + L + rTotR + ')';
  }
  M.push(a);

  // --- grapsimo se ENA setValues
  sh.getRange(top, 1, M.length, NC).setValues(M);

  // --- morfopoiisi
  finTitle_(sh, top, title, NC);
  sh.getRange(rHdr, 1, 1, NC).setFontWeight('bold').setBackground('#D9EAD3');
  sh.getRange(rSecR, 1, 1, NC).setFontWeight('bold').setBackground('#EFEFEF');
  sh.getRange(rSecE, 1, 1, NC).setFontWeight('bold').setBackground('#EFEFEF');
  sh.getRange(top + 2, 2, M.length - 2, 13).setNumberFormat('#,##0.00');
  sh.getRange(top, NC, M.length, 1).setNumberFormat('0.0%');
  sh.getRange(rMar, 2, 1, 13).setNumberFormat('0.0%');
  [rTotR, rTotE, rPro, rMar].forEach(function (r) {
    sh.getRange(r, 1, 1, NC).setFontWeight('bold');
  });
  sh.getRange(rTotR, 1, 1, NC).setBackground('#E2F0D9');
  sh.getRange(rTotE, 1, 1, NC).setBackground('#FCE4D6');
  sh.getRange(rPro, 1, 1, NC).setBackground('#FFF2CC');
  for (i = 0; i < typeRows.length; i++) sh.getRange(typeRows[i], 1, 1, NC).setFontWeight('bold');
  sh.getRange(rOth, 1, 1, NC).setFontWeight('bold');

  // --- omadopoiisi ton grammon analysis (na diplonoun)
  for (i = 0; i < groups.length; i++) {
    try {
      sh.getRange(groups[i][0], 1, groups[i][1], 1).shiftRowGroupDepth(1);
      sh.getRowGroup(groups[i][0], 1).collapse();
    } catch (e) {}
  }

  return { next: top + M.length, rTotR: rTotR, rTotE: rTotE, rPro: rPro };
}

// -- BLOCK ΕΚΤΟΣ P&L (pagia + eggyiseis) ---------------------------------------

function finOutBlock_(sh, top, R) {
  var QE = finQ_(FIN_TAB_EXP), NC = 3, RE = R.E;
  function f(cat, taxed) {
    return '=SUMIFS(' + QE + RE.J + ',' + QE + RE.G + ',"' + FIN_COMPANY + '",' + QE + RE.K + ',"' + cat + '"' +
      (taxed ? ',' + QE + RE.F + ',"TRUE"' : '') + ')';
  }
  var M = [
    ['ΕΚΤΟΣ P&L — δεν βαρύνουν το αποτέλεσμα', '', ''],
    ['Κατηγορία', 'OVERALL', 'DECLARED'],
    ['Πάγιο (κατασκευή / εξοπλισμός)', f('Πάγιο', false), f('Πάγιο', true)],
    ['Εγγύηση (επιστρεπτέο)', f('Εγγύηση', false), f('Εγγύηση', true)]
  ];
  sh.getRange(top, 1, M.length, NC).setValues(M);
  finTitle_(sh, top, M[0][0], FIN_PROP_NC);
  sh.getRange(top + 1, 1, 1, NC).setFontWeight('bold').setBackground('#D9EAD3');
  sh.getRange(top + 2, 2, 2, 2).setNumberFormat('#,##0.00');
  return top + M.length;
}

// -- PINAKAS ANA ΑΚΙΝΗΤΟ (Έσοδα − Έξοδα = Κέρδος) ------------------------------
// Grammes = ta akinita tou xartofylakiou + ta kentra kostous ektos xartofylakiou
//           (General, Alex's House, ...) + Concierge + ΑΤΑΞΙΝΟΜΗΤΑ + ΣΥΝΟΛΟ.
// To ΣΥΝΟΛΟ ypologizetai ANEKSARTITA (SUMIFS se olo to arxeio), kai to
// ΑΤΑΞΙΝΟΜΗΤΑ einai ypoloipo — etsi o pinakas symfonei PANTA me ta Candy Recipes.

function finPropTable_(sh, top, taxed, title, props, buckets, R) {
  var NC = FIN_PROP_NC, T = FIN_EXP_TYPES.length, i, c, L, a;
  var QE = finQ_(FIN_TAB_EXP), QD = finQ_(FIN_TAB_DATA), QC = finQ_(FIN_TAB_CONC);
  var RD = R.D, RE = R.E, RC = R.C;   // v3.3: fragmena euri
  var dE = taxed ? ',' + QE + RE.F + ',"TRUE"' : '';
  var dR = taxed ? ',' + QD + RD.F + ',"<>Direct Cash"' : '';
  var EXP = QE + RE.J + ',' + QE + RE.G + ',"' + FIN_COMPANY + '",' + QE + RE.K + ',"Opex"';
  var C_INC = 2, C_T0 = 3, C_TN = 2 + T, C_OTH = 3 + T, C_EXP = 4 + T, C_PRO = 5 + T, C_MAR = 6 + T;
  var LT0 = finColL_(C_T0), LTN = finColL_(C_TN), LOTH = finColL_(C_OTH),
      LINC = finColL_(C_INC), LEXP = finColL_(C_EXP), LPRO = finColL_(C_PRO);

  var names = [];
  for (i = 0; i < props.length; i++) names.push(props[i].name);
  for (i = 0; i < buckets.length; i++) names.push(buckets[i]);

  var rHdr = top + 1, r0 = top + 2;
  var rConc = r0 + names.length, rAtx = rConc + 1, rTot = rAtx + 1;

  function tail(r) {
    var o = {};
    o[C_EXP] = '=SUM(' + LT0 + r + ':' + LOTH + r + ')';
    o[C_PRO] = '=' + LINC + r + '-' + LEXP + r;
    o[C_MAR] = '=IF(' + LINC + r + '=0,"",' + LPRO + r + '/' + LINC + r + ')';
    return o;
  }
  function applyTail(row, r) { var o = tail(r); for (var kk in o) if (o.hasOwnProperty(kk)) row[kk - 1] = o[kk]; }

  var M = [];
  a = finBlankRow_(NC); a[0] = title; M.push(a);
  a = ['Ακίνητο / Κέντρο κόστους', 'Έσοδα'].concat(FIN_EXP_TYPES)
      .concat(['Λοιπά', 'ΣΥΝΟΛΟ ΕΞΟΔΩΝ', 'ΚΕΡΔΟΣ', 'ΠΕΡΙΘΩΡΙΟ %']);
  M.push(a);

  for (i = 0; i < names.length; i++) {
    var r = r0 + i;
    a = finBlankRow_(NC); a[0] = names[i];
    a[C_INC - 1] = '=SUMIFS(' + QD + RD.X + ',' + QD + RD.E + ',$A' + r + dR + ')';
    for (c = C_T0; c <= C_TN; c++) {
      L = finColL_(c);
      a[c - 1] = '=SUMIFS(' + EXP + ',' + QE + RE.D + ',$A' + r + ',' + QE + RE.B + ',' + L + '$' + rHdr + dE + ')';
    }
    a[C_OTH - 1] = '=SUMIFS(' + EXP + ',' + QE + RE.D + ',$A' + r + dE + ')-SUM(' + LT0 + r + ':' + LTN + r + ')';
    applyTail(a, r);
    M.push(a);
  }

  // Concierge — esodo xoris akinito
  a = finBlankRow_(NC); a[0] = 'Concierge (έσοδο χωρίς ακίνητο)';
  a[C_INC - 1] = '=IFERROR(SUM(' + QC + RC.F + '),0)';
  applyTail(a, rConc);
  M.push(a);

  // ΑΤΑΞΙΝΟΜΗΤΑ = ΣΥΝΟΛΟ − oles oi grammes apo pano
  a = finBlankRow_(NC); a[0] = 'ΑΤΑΞΙΝΟΜΗΤΑ (υπόλοιπο)';
  for (c = C_INC; c <= C_OTH; c++) {
    L = finColL_(c);
    a[c - 1] = '=' + L + rTot + '-SUM(' + L + r0 + ':' + L + (rAtx - 1) + ')';
  }
  applyTail(a, rAtx);
  M.push(a);

  // ΣΥΝΟΛΟ — aneksartitos ypologismos
  a = finBlankRow_(NC); a[0] = 'ΣΥΝΟΛΟ';
  a[C_INC - 1] = (taxed
      ? '=SUMIFS(' + QD + RD.X + ',' + QD + RD.F + ',"<>Direct Cash")'
      : '=SUM(' + QD + RD.X + ')') + '+IFERROR(SUM(' + QC + RC.F + '),0)';
  for (c = C_T0; c <= C_TN; c++) {
    L = finColL_(c);
    a[c - 1] = '=SUMIFS(' + EXP + ',' + QE + RE.B + ',' + L + '$' + rHdr + dE + ')';
  }
  a[C_OTH - 1] = '=SUMIFS(' + EXP + dE + ')-SUM(' + LT0 + rTot + ':' + LTN + rTot + ')';
  applyTail(a, rTot);
  M.push(a);

  sh.getRange(top, 1, M.length, NC).setValues(M);

  finTitle_(sh, top, title, NC);
  sh.getRange(rHdr, 1, 1, NC).setFontWeight('bold').setBackground('#D9EAD3').setWrap(true);
  sh.getRange(r0, 2, names.length + 3, C_PRO - 1).setNumberFormat('#,##0.00');
  sh.getRange(r0, C_MAR, names.length + 3, 1).setNumberFormat('0.0%');
  sh.getRange(rAtx, 1, 1, NC).setFontColor('#999999');
  sh.getRange(rTot, 1, 1, NC).setFontWeight('bold').setBackground('#E2F0D9');
  return top + M.length;
}

// -- XTISIMO TOU TAB P&L -------------------------------------------------------

function finBuildPnL_(ss, props, buckets) {
  var sh = ss.getSheetByName(FIN_TAB_PNL) || ss.insertSheet(FIN_TAB_PNL);
  sh.clear();
  try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart(); } catch (e0) {}
  // katharisma palion omadopoiiseon (to clear() den tis svinei)
  for (var g = 0; g < 4; g++) {
    try { sh.getRange(1, 1, sh.getMaxRows(), 1).shiftRowGroupDepth(-1); } catch (eg) { break; }
  }

  var lines = finExpLines_(ss);
  // v3.3: ta fragmena euri ypologizontai MIA fora kai pernane se ola ta block.
  var R = { D: finRng_(ss, FIN_TAB_DATA), E: finRng_(ss, FIN_TAB_EXP), C: finRng_(ss, FIN_TAB_CONC) };
  var r = 1;
  var b1 = finPnLBlock_(sh, r, false, 'P&L ' + FIN_YEAR + ' — OVERALL (όλα τα έσοδα & έξοδα)', lines, R);
  r = b1.next + 2;
  var b2 = finPnLBlock_(sh, r, true, 'P&L ' + FIN_YEAR + ' — DECLARED (χωρίς Direct Cash · μόνο δηλωμένα έξοδα)', lines, R);
  r = b2.next + 2;
  r = finOutBlock_(sh, r, R) + 2;
  r = finPropTable_(sh, r, false, 'ΑΝΑ ΑΚΙΝΗΤΟ — OVERALL', props, buckets, R) + 2;
  r = finPropTable_(sh, r, true, 'ΑΝΑ ΑΚΙΝΗΤΟ — DECLARED', props, buckets, R) + 2;

  sh.getRange(r, 1).setValue(
    'Έσοδα = Company_Revenue από το tab «' + FIN_TAB_DATA + '». Έξοδα = tab «' + FIN_TAB_EXP +
    '» με Debit to «' + FIN_COMPANY + '» και Κατηγορία «Opex»· πάγια και εγγυήσεις εξαιρούνται ' +
    '(βλέπε block ΕΚΤΟΣ P&L). DECLARED = έσοδα χωρίς Direct Cash και έξοδα μόνο με Declared=TRUE· ' +
    'η διαφορά OVERALL − DECLARED είναι τα αδήλωτα. Οι γραμμές με «•» κάτω από κάθε κατηγορία ' +
    'είναι η ανάλυση ανά πραγματική εγγραφή του Candy Recipes (τιμές — ξαναγράφονται σε κάθε pull· ' +
    'διπλώνουν με το βελάκι αριστερά). Στους πίνακες ΑΝΑ ΑΚΙΝΗΤΟ η γραμμή ΣΥΝΟΛΟ υπολογίζεται ' +
    'ανεξάρτητα και το ΑΤΑΞΙΝΟΜΗΤΑ είναι υπόλοιπο, ώστε να συμφωνούν πάντα με το P&L. ' +
    'Το Concierge δεν έχει διαχωρισμό δηλωμένων — μπαίνει ίδιο και στα δύο blocks.')
    .setFontStyle('italic').setFontSize(9).setFontColor('#777777');

  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 280);
  sh.setColumnWidths(2, FIN_PROP_NC - 1, 105);      // v3.3: 1 klisi anti gia 17
  finLog_('BUILD_PNL', buckets.length, 'κέντρα κόστους εκτός χαρτοφυλακίου: ' + buckets.join(' · '));
}


// -- ΣΤΟΧΟΣ ΕΤΑΙΡΕΙΑΣ (dashboard, 1o tab) --------------------------------------
// O Tasos KARFONEI ena noumero sto B4 (synolikos etisios stoxos tzirou tis
// etaireias — lamvanei ypopsin kai alla, den vgainei apo athroisma stoxon).
// Ta ypoloipa ypologizontai live apo to Data. To B4 DIATIREITAI sto rebuild.

function finBuildCompanyGoal_(ss) {
  var sh = ss.getSheetByName(FIN_TAB_CO);
  // Diasosi tou karfotou stoxou prin to rebuild
  var savedTarget = '';
  if (sh) {
    var old = sh.getRange(4, 2).getValue();
    if (old !== '' && old != null) savedTarget = old;
  } else {
    sh = ss.insertSheet(FIN_TAB_CO, 0);
  }
  sh.clear();
  sh.setConditionalFormatRules([]);

  var RD = finRng_(ss, FIN_TAB_DATA), RE = finRng_(ss, FIN_TAB_EXP), RC = finRng_(ss, FIN_TAB_CONC);

  // v3.3: olo to fyllo me ENA setValues (prin: ~116 kliseis API, mia-mia gia
  // grammatoseira/megethos/xroma se kathe kelli).
  var M = [], i;
  for (i = 0; i < 18; i++) M.push(['', '', '', '']);
  function set(row, label, val) { M[row - 1][0] = label; M[row - 1][1] = val; }

  set(1, 'ΣΤΟΧΟΣ ΕΤΑΙΡΕΙΑΣ ' + FIN_YEAR, '');
  set(4, 'Στόχος τζίρου (γράψε εδώ το νούμερο):', savedTarget);
  set(6, 'Πραγματοποιημένος τζίρος (χωρίς μελλοντικές):',
    '=SUMIFS(' + FIN_QD + RD.W + ',' + FIN_QD + RD.Y + ',"<>Μελλοντική")');
  set(7, 'Προβλεπόμενος τζίρος (με μελλοντικές):', '=SUM(' + FIN_QD + RD.W + ')');
  set(9, '% ΕΠΙΤΕΥΞΗΣ (πραγματοποιημένος):', '=IF(OR($B$4="",$B$4=0),"",B6/$B$4)');
  set(10, '% ΕΠΙΤΕΥΞΗΣ (προβλεπόμενος):', '=IF(OR($B$4="",$B$4=0),"",B7/$B$4)');
  set(12, 'Υπόλοιπο έως τον στόχο (από προβλεπόμενο):', '=IF(OR($B$4="",$B$4=0),"",$B$4-B7)');
  set(14, 'Concierge έσοδα (commission):', '=IFERROR(SUM(' + FIN_QC + RC.F + '),0)');
  set(15, 'Λειτουργικά έξοδα εταιρείας (χωρίς εγγυήσεις/πάγια):',
    '=IFERROR(SUMIFS(' + FIN_QE + RE.J + ',' + FIN_QE + RE.G + ',"' + FIN_COMPANY +
    '",' + FIN_QE + RE.K + ',"Opex"),0)');
  set(16, 'COMPANY PROFIT (Company Revenue + Concierge − Έξοδα):',
    '=SUM(' + FIN_QD + RD.X + ')+B14-B15');
  M[17][0] = 'Ο τζίρος μετριέται σε βάση Gross_Revenue (όπως οι στόχοι ανά σπίτι). ' +
    'Το COMPANY PROFIT βασίζεται σε Company_Revenue + Concierge − έξοδα (tab P&L). ' +
    'Το κίτρινο κελί B4 είναι το μόνο που συμπληρώνεις — διατηρείται στα rebuilds.';
  sh.getRange(1, 1, 18, 4).setValues(M);

  // --- morfopoiisi: omadopoiimeni, oxi kelli-kelli
  sh.getRange(1, 1, 18, 2).setFontFamily('Arial');
  sh.getRange(1, 1, 1, 4).setBackground('#1F7A4D');
  sh.getRange(1, 1).setFontSize(22).setFontWeight('bold').setFontColor('#FFFFFF');
  sh.getRange(4, 1, 13, 1).setFontWeight('bold').setFontColor('#444444').setFontSize(11);
  sh.getRange(9, 1, 2, 1).setFontSize(18);
  sh.getRange(16, 1).setFontSize(13);
  // stili B: megethi ana grammi
  sh.getRange(4, 2).setFontSize(24).setFontWeight('bold').setBackground('#FFF2CC');
  sh.getRange(6, 2, 2, 1).setFontSize(20);
  sh.getRange(9, 2, 2, 1).setFontSize(36).setFontWeight('bold');
  sh.getRange(12, 2).setFontSize(20).setFontWeight('bold');
  sh.getRange(14, 2, 2, 1).setFontSize(16);
  sh.getRange(16, 2).setFontSize(26).setFontWeight('bold');
  sh.getRange(18, 1).setFontStyle('italic').setFontSize(9).setFontColor('#777777');
  // arithmitika formats (ta kena kellia den peirazoun)
  sh.getRange(4, 2, 4, 1).setNumberFormat('#,##0 "€"');      // B4..B7
  sh.getRange(9, 2, 2, 1).setNumberFormat('0.0%');           // B9..B10
  sh.getRange(12, 2, 5, 1).setNumberFormat('#,##0 "€"');     // B12..B16
  sh.setRowHeight(1, 44);
  sh.setRowHeight(4, 40);
  sh.setRowHeight(9, 56);
  sh.setRowHeight(10, 56);
  sh.setRowHeight(16, 44);

  var pRng = sh.getRange(9, 2, 2, 1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(0.85).setBackground('#D9EAD3').setRanges([pRng]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(0.5, 0.8499).setBackground('#FFF2A8').setRanges([pRng]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0.5).setBackground('#F4CCCC').setRanges([pRng]).build()
  ]);
  sh.setColumnWidth(1, 380);
  sh.setColumnWidth(2, 260);
  try { sh.setHiddenGridlines(true); } catch (e) {}
}

// -- PLATFORM FEES -------------------------------------------------------------
// Block 1: property × minas (Channel_Fee) · Block 2: platforma × minas

function finBuildFees_(ss, props) {
  var sh = ss.getSheetByName(FIN_TAB_FEES) || ss.insertSheet(FIN_TAB_FEES);
  sh.clear();
  var n = props.length, i, m, c, a, L;
  var QD = FIN_QD, RD = finRng_(ss, FIN_TAB_DATA);

  // v3.3: kathe block me ENA setValues (prin: ~308 kliseis API).
  // Voithitiko: grammi synolou gia stiles 2..14 pano se euros grammon.
  function totRow(first, lastR) {
    var t = ['ΣΥΝΟΛΟ'];
    for (var k = 2; k <= 14; k++) {
      var LL = finColL_(k);
      t.push('=SUM(' + LL + first + ':' + LL + lastR + ')');
    }
    return t;
  }
  function hdrRow() { return ['Property'].concat(FIN_MONTHS).concat(['ΕΤΟΣ']); }

  // ---- Block 1: SERVICE FEES ana property × mina
  var M1 = [hdrRow()];
  for (i = 0; i < n; i++) {
    var row1 = 3 + i;
    a = [props[i].name];
    for (m = 0; m < 12; m++) {
      a.push('=SUMIFS(' + QD + RD.M + ',' + QD + RD.E + ',$A' + row1 + ',' + QD + RD.A + ',' + (m + 1) + ')');
    }
    a.push('=SUM(B' + row1 + ':M' + row1 + ')');
    M1.push(a);
  }
  var t1 = 3 + n;
  M1.push(totRow(3, t1 - 1));
  sh.getRange(2, 1, M1.length, 14).setValues(M1);
  finTitle_(sh, 1, 'SERVICE FEES ανά PROPERTY × μήνα (' + FIN_YEAR + ')', 14);
  sh.getRange(2, 1, 1, 14).setFontWeight('bold').setBackground('#D9EAD3');
  sh.getRange(t1, 1, 1, 14).setFontWeight('bold');

  // ---- Block 2: platforma × mina (dynamika me UNIQUE — guard IF gia kena)
  var r2 = t1 + 2, pStart = r2 + 2;
  // I stili A gemizei apo tin UNIQUE pou aploneta pros ta kato (spill).
  // An grapsoume kena apo kato tis, to spill spaei me #REF! — gi' afto i stili A
  // grafetai XORISTA kai to block ton arithmon piani mono tis stiles B..N.
  var hdr2 = hdrRow(); hdr2[0] = 'Platform';
  var M2 = [];
  for (var pp = 0; pp < FIN_PLATFORM_ROWS; pp++) {
    var prow = pStart + pp;
    a = [];
    for (m = 0; m < 12; m++) {
      a.push('=IF($A' + prow + '="","",SUMIFS(' + QD + RD.M + ',' + QD + RD.F + ',$A' + prow + ',' + QD + RD.A + ',' + (m + 1) + '))');
    }
    a.push('=IF($A' + prow + '="","",SUM(B' + prow + ':M' + prow + '))');
    M2.push(a);
  }
  var t2 = pStart + FIN_PLATFORM_ROWS;
  sh.getRange(r2 + 1, 1, 1, 14).setValues([hdr2]);
  sh.getRange(pStart, 1).setFormula(
    '=IFERROR(SORT(UNIQUE(FILTER(' + QD + RD.F + ',' + QD + RD.F + '<>""))),"")');
  sh.getRange(pStart, 2, FIN_PLATFORM_ROWS, 13).setValues(M2);
  sh.getRange(t2, 1, 1, 14).setValues([totRow(pStart, t2 - 1)]);
  finTitle_(sh, r2, 'SERVICE FEES ανά ΠΛΑΤΦΟΡΜΑ × μήνα (' + FIN_YEAR + ')', 14);
  sh.getRange(r2 + 1, 1, 1, 14).setFontWeight('bold').setBackground('#D9EAD3');
  sh.getRange(t2, 1, 1, 14).setFontWeight('bold');

  // ---- Block 3: AIRBNB fees ana property × mina
  var r3 = t2 + 2, aStart = r3 + 2;
  var M3 = [hdrRow()];
  for (i = 0; i < n; i++) {
    var arow = aStart + i;
    a = [props[i].name];
    for (m = 0; m < 12; m++) {
      a.push('=SUMIFS(' + QD + RD.M + ',' + QD + RD.E + ',$A' + arow + ',' + QD + RD.F + ',"Airbnb",' + QD + RD.A + ',' + (m + 1) + ')');
    }
    a.push('=SUM(B' + arow + ':M' + arow + ')');
    M3.push(a);
  }
  var t3 = aStart + n;
  M3.push(totRow(aStart, t3 - 1));
  sh.getRange(r3 + 1, 1, M3.length, 14).setValues(M3);
  finTitle_(sh, r3, 'AIRBNB FEES ανά PROPERTY × μήνα (' + FIN_YEAR + ')', 14);
  sh.getRange(r3 + 1, 1, 1, 14).setFontWeight('bold').setBackground('#D9EAD3');
  sh.getRange(t3, 1, 1, 14).setFontWeight('bold');

  sh.getRange(1, 2, t3, 13).setNumberFormat('#,##0.00');
  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 170);
}

// -- 3. TRIGGER ----------------------------------------------------------------

function finTriggerOn() {
  finTriggerOff_();
  ScriptApp.newTrigger('pullFinancialsAuto').timeBased().everyDays(1).atHour(FIN_AUTO_HOUR).create();
  SpreadsheetApp.getUi().alert('Auto-pull ON, καθημερινά ~' + FIN_AUTO_HOUR + ':00');
}
function finTriggerOff_() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'pullFinancialsAuto') ScriptApp.deleteTrigger(t);
  });
}
function finTriggerOff() { finTriggerOff_(); SpreadsheetApp.getUi().alert('Auto-pull OFF.'); }
