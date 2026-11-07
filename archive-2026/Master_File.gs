/**
 * SOMNIO — Master File v2.1 (clean)  (Somnio Automation Folder)
 * Auth: header `Authorization: <api_key>` (Script Property HOSTHUB_API_KEY).
 *
 * Ρόλος: Single source of truth. ΟΛΕΣ οι κρατήσεις από Hosthub (και μελλοντικές),
 * με check-in >= MIN_DATE (2026-01-01). Θα τροφοδοτεί Financials, Παραστατικά κ.λπ.
 *
 * Βάση: production Hosthub_Sync (per-rental offset paging — το navigation.next
 * του Hosthub είναι ΣΠΑΣΜΕΝΟ, γι' αυτό το global endpoint χάνει κρατήσεις).
 *
 * Master-specific:
 *   - ΧΩΡΙΣ στήλες Receipt, AADE, AADE_Uploaded, Paid (πάνε στα παιδιά-αρχεία)
 *   - Passport_AFM & Guest_Country: MANUAL — προσυμπληρώνονται από API όπου
 *     υπάρχουν, ό,τι γράψει ο χρήστης ΔΕΝ πατιέται από το sync
 *   - Comments: manual, διατηρείται
 *   - Master_Properties: ΕΞΩΤΕΡΙΚΟ αρχείο ("Somnio — Master Properties")
 *   - Direct_Cash tab: manual direct/cash, γίνεται merge στο Bookings
 *   - Ταξινόμηση κατά Check_in (ημερολογιακά) μετά από κάθε sync
 *   - ΔΕΝ φιλτράρει μελλοντικές κρατήσεις (το φίλτρο check-in <= σήμερα
 *     ανήκει στο αρχείο Παραστατικών, όχι εδώ)
 *
 * One-off εργαλεία (import passports, fix platform) -> Archive_OneOff_Tools.gs
 *
 * === LIVE SNAPSHOT 10/09/2026: αυτό είναι ΠΙΣΤΟ αντίγραφο του κώδικα που τρέχει
 * === στο Apps Script του Master (μαζί με προσθήκες από άλλες συνεδρίες:
 * === validation/orphan cleanup στο merge, recomputeCommissions, fixDcDates).
 */

var BASE            = 'https://app.hosthub.com/api/2019-03-01';
var TAB_BOOKINGS    = 'Bookings';
var TAB_DIRECT      = 'Direct_Cash';
var TAB_MASTER      = 'Master_Properties';   // onoma tab MESA sto external file (fallback: 1o tab)
var TAB_LOG         = 'Sync_Log';
var MASTER_PROPS_ID = '1N2OegNP2eEVKkZlTokhXFmL5W0OkZ3VZDuedz3wXRFs';  // "Somnio — Master Properties"
var COMMISSION_RATE = 0.20;
var COMMISSION_VAT  = 0.24;
var VAT_RATE        = 0.13;     // FPA katalymatos
var CITY_RATE       = 0.0075;   // dimotikos foros
var AUTO_HOUR       = 7;
var TIME_BUDGET_MS  = 270000;   // 4.5' — perithorio kato apo to 6' orio tis Google (me xoro gia backoffs)
var MIN_DATE        = '2026-01-01';   // agnoise kratiseis me check-in prin apo ayti
var SKIP_GUESTS     = ['tade'];       // owner-blocks / mi-kratiseis (guest name) pros eksairesi

var BOOK_COLS = [
  'no','Month','Reservation ID','Check_in','Check_out','Residence','Platform','Nights',
  'Guest name','ID_Type','Passport_AFM','Guest_Email','Guest_Country',
  'Booking value','Cleaning fee','Total payout','Total value','Guest paid','Payment charges','Service fee host','Currency',
  'Net_Price','VAT','City_Tax','Env_Fee','Price_AADE','Gross_Value',
  'Owner_Type','Comm_Base','Comm_20pct','Comm_VAT','Comm_Total','Company_Revenue',
  'is_visible','cancelled_at',
  'Comm_Rate%','Guests','Guest_Phone','Comments',
  'event_id','synced_at'
];
var TOTAL_COLS   = BOOK_COLS.length;  // 41
var PASSPORT_IDX = 10;                // 0-based Passport_AFM (MANUAL)
var COUNTRY_IDX  = 12;                // 0-based Guest_Country (MANUAL — prosympliromeno apo API)
var COMMRATE_IDX = 35;                // 0-based Comm_Rate% (MANUAL — keno = 20%, alliws p.x. 15)
var GUESTS_IDX   = 36;                // 0-based Guests (auto apo API: "2A/1C/1I")
var PHONE_IDX    = 37;                // 0-based Guest_Phone (MANUAL — prosympliromeno apo API)
var COMMENTS_IDX = 38;                // 0-based Comments (MANUAL)
var VIS_IDX      = 33;                // 0-based is_visible
var EVENT_IDX    = 39;                // 0-based event_id

var MASTER_COLS = ['Residence','Listing_ID','Owner_Type','Owner_Name','Owner_Email',
  'Accountant_Email','Greeting_Name','AFM','AMA','Env_Fee_Night','Issue_Invoice','Active','Notes'];

// -- KEY / HTTP ----------------------------------------------------------------

function apiKey_() {
  var raw = PropertiesService.getScriptProperties().getProperty('HOSTHUB_API_KEY');
  if (!raw) throw new Error('Leipei to HOSTHUB_API_KEY.');
  var k = String(raw).trim();
  if (!k) throw new Error('HOSTHUB_API_KEY keno.');
  return k;
}

function apiGet_(path) {
  var url = path.startsWith('http') ? path : BASE + path;
  for (var attempt = 0; attempt < 5; attempt++) {
    Utilities.sleep(attempt === 0 ? 1200 : Math.min(60000, 8000 * Math.pow(2, attempt - 1)));   // 1.2s spacing, backoff 8s/16s/32s/60s
    var res = UrlFetchApp.fetch(url, {
      method: 'get', headers: { 'Authorization': apiKey_(), 'Accept': 'application/json' }, muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code === 429) {   // Cloudflare rate limit -> perimene kai ksanadokimase
      logRow_('RATE_LIMIT', attempt + 1, url.slice(0, 120));
      continue;
    }
    if (code >= 400) {
      var body = res.getContentText() || '(empty)';
      logRow_('API_ERROR', code, url + ' -> ' + body.slice(0, 300));
      throw new Error('HTTP ' + code + ' @ ' + url + '\n' + body.slice(0, 300));
    }
    return JSON.parse(res.getContentText());
  }
  throw new Error('HTTP 429 (rate limit) meta apo 5 prospatheies @ ' + url);
}

function money_(m) { return (m && typeof m.cents === 'number') ? m.cents / 100 : ''; }

// Diaspasi foron: PASS-THROUGH apo to Hosthub gr-taxes.
// SIMEIOSI (epivevaiomeno me ton Taso): vasei nomou o dimotikos foros mpainei
// sti VASI tou FPA (forologitea aksia = aksia + foroi/teli plin FPA), ara o
// ypologismos tou Hosthub [vat = 13% x (net + city_tax)] einai SOSTOS.
// I Airbnb apla emfanizei diaforetiki diaspasi sto diko tis statement.
function taxSplit_(gr) {
  return { net: money_(gr.net_value), vat: money_(gr.vat), city: money_(gr.accommodation_tax),
           env: money_(gr.climate_tax), aade: money_(gr.aade_value), gross: money_(gr.gross_booking_value) };
}

function logRow_(action, count, detail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var lg = ss.getSheetByName(TAB_LOG) || ss.insertSheet(TAB_LOG);
    if (lg.getLastRow() === 0) lg.appendRow(['timestamp','action','count','detail']);
    lg.appendRow([new Date(), action, count, detail]);
  } catch (e) {}
}

// -- NIGHTS --------------------------------------------------------------------

// Synthesi guests: "2A/1C/1I" (adults/children/infants), alliws sketo to guest_number
// Pososto promitheias grammis: keno -> COMMISSION_RATE (20%), alliws p.x. "15" -> 0.15
function commRate_(v) {
  var n = Number(String(v || '').replace(',', '.').replace('%', ''));
  if (!n || isNaN(n) || n <= 0) return COMMISSION_RATE;
  return n > 1 ? n / 100 : n;
}

function guestsStr_(e) {
  var a = Number(e.guest_adults) || 0, c = Number(e.guest_children) || 0, inf = Number(e.guest_infants) || 0;
  if (a + c + inf > 0) {
    var parts = [];
    if (a) parts.push(a + 'A');
    if (c) parts.push(c + 'C');
    if (inf) parts.push(inf + 'I');
    return parts.join('/');
  }
  // 0 guests (p.x. akyromenes) = keno — alliws to "0" den "kathete" sto sheet
  // kai i sygkrisi to theorei allagmeno gia panta (infinite resync loop)
  return (e.guest_number && Number(e.guest_number) > 0) ? String(e.guest_number) : '';
}

function nights_(e) {
  if (e.date_from && e.date_to) {
    var a = new Date(e.date_from), b = new Date(e.date_to);
    var d = Math.round((b - a) / 86400000);
    if (d > 0) return d;
  }
  return e.nights || '';
}

// -- COUNTRY (ISO alpha-2 -> English) ------------------------------------------

var COUNTRIES = {
AF:'Afghanistan',AX:'Aland Islands',AL:'Albania',DZ:'Algeria',AS:'American Samoa',AD:'Andorra',AO:'Angola',AI:'Anguilla',AQ:'Antarctica',AG:'Antigua and Barbuda',AR:'Argentina',AM:'Armenia',AW:'Aruba',AU:'Australia',AT:'Austria',AZ:'Azerbaijan',BS:'Bahamas',BH:'Bahrain',BD:'Bangladesh',BB:'Barbados',BY:'Belarus',BE:'Belgium',BZ:'Belize',BJ:'Benin',BM:'Bermuda',BT:'Bhutan',BO:'Bolivia',BA:'Bosnia and Herzegovina',BW:'Botswana',BR:'Brazil',IO:'British Indian Ocean Territory',BN:'Brunei',BG:'Bulgaria',BF:'Burkina Faso',BI:'Burundi',KH:'Cambodia',CM:'Cameroon',CA:'Canada',CV:'Cape Verde',KY:'Cayman Islands',CF:'Central African Republic',TD:'Chad',CL:'Chile',CN:'China',CO:'Colombia',KM:'Comoros',CG:'Congo',CD:'Congo (DRC)',CR:'Costa Rica',CI:'Cote d Ivoire',HR:'Croatia',CU:'Cuba',CW:'Curacao',CY:'Cyprus',CZ:'Czechia',DK:'Denmark',DJ:'Djibouti',DM:'Dominica',DO:'Dominican Republic',EC:'Ecuador',EG:'Egypt',SV:'El Salvador',GQ:'Equatorial Guinea',ER:'Eritrea',EE:'Estonia',SZ:'Eswatini',ET:'Ethiopia',FO:'Faroe Islands',FJ:'Fiji',FI:'Finland',FR:'France',GF:'French Guiana',PF:'French Polynesia',GA:'Gabon',GM:'Gambia',GE:'Georgia',DE:'Germany',GH:'Ghana',GI:'Gibraltar',GR:'Greece',GL:'Greenland',GD:'Grenada',GP:'Guadeloupe',GU:'Guam',GT:'Guatemala',GG:'Guernsey',GN:'Guinea',GW:'Guinea-Bissau',GY:'Guyana',HT:'Haiti',HN:'Honduras',HK:'Hong Kong',HU:'Hungary',IS:'Iceland',IN:'India',ID:'Indonesia',IR:'Iran',IQ:'Iraq',IE:'Ireland',IM:'Isle of Man',IL:'Israel',IT:'Italy',JM:'Jamaica',JP:'Japan',JE:'Jersey',JO:'Jordan',KZ:'Kazakhstan',KE:'Kenya',KI:'Kiribati',KW:'Kuwait',KG:'Kyrgyzstan',LA:'Laos',LV:'Latvia',LB:'Lebanon',LS:'Lesotho',LR:'Liberia',LY:'Libya',LI:'Liechtenstein',LT:'Lithuania',LU:'Luxembourg',MO:'Macau',MG:'Madagascar',MW:'Malawi',MY:'Malaysia',MV:'Maldives',ML:'Mali',MT:'Malta',MH:'Marshall Islands',MQ:'Martinique',MR:'Mauritania',MU:'Mauritius',MX:'Mexico',FM:'Micronesia',MD:'Moldova',MC:'Monaco',MN:'Mongolia',ME:'Montenegro',MS:'Montserrat',MA:'Morocco',MZ:'Mozambique',MM:'Myanmar',NA:'Namibia',NR:'Nauru',NP:'Nepal',NL:'Netherlands',NC:'New Caledonia',NZ:'New Zealand',NI:'Nicaragua',NE:'Niger',NG:'Nigeria',MK:'North Macedonia',NO:'Norway',OM:'Oman',PK:'Pakistan',PW:'Palau',PS:'Palestine',PA:'Panama',PG:'Papua New Guinea',PY:'Paraguay',PE:'Peru',PH:'Philippines',PL:'Poland',PT:'Portugal',PR:'Puerto Rico',QA:'Qatar',RE:'Reunion',RO:'Romania',RU:'Russia',RW:'Rwanda',KN:'Saint Kitts and Nevis',LC:'Saint Lucia',VC:'Saint Vincent and the Grenadines',WS:'Samoa',SM:'San Marino',ST:'Sao Tome and Principe',SA:'Saudi Arabia',SN:'Senegal',RS:'Serbia',SC:'Seychelles',SL:'Sierra Leone',SG:'Singapore',SX:'Sint Maarten',SK:'Slovakia',SI:'Slovenia',SB:'Solomon Islands',SO:'Somalia',ZA:'South Africa',KR:'South Korea',SS:'South Sudan',ES:'Spain',LK:'Sri Lanka',SD:'Sudan',SR:'Suriname',SE:'Sweden',CH:'Switzerland',SY:'Syria',TW:'Taiwan',TJ:'Tajikistan',TZ:'Tanzania',TH:'Thailand',TL:'Timor-Leste',TG:'Togo',TO:'Tonga',TT:'Trinidad and Tobago',TN:'Tunisia',TR:'Turkey',TM:'Turkmenistan',TC:'Turks and Caicos Islands',TV:'Tuvalu',UG:'Uganda',UA:'Ukraine',AE:'United Arab Emirates',GB:'United Kingdom',US:'United States',UY:'Uruguay',UZ:'Uzbekistan',VU:'Vanuatu',VA:'Vatican City',VE:'Venezuela',VN:'Vietnam',VG:'British Virgin Islands',VI:'U.S. Virgin Islands',YE:'Yemen',ZM:'Zambia',ZW:'Zimbabwe'
};

function countryName_(code) {
  if (!code) return '';
  var c = String(code).trim().toUpperCase();
  return COUNTRIES[c] || code;
}

// -- DIAGNOSTICS ---------------------------------------------------------------

function diagnose403() {
  var ui = SpreadsheetApp.getUi();
  var raw = PropertiesService.getScriptProperties().getProperty('HOSTHUB_API_KEY');
  if (!raw) { ui.alert('No HOSTHUB_API_KEY.'); return; }
  var clean = apiKey_();
  var out = [
    'Key raw length   : ' + raw.length,
    'Key clean length : ' + clean.length,
    'Key preview      : ' + clean.slice(0,4) + '...' + clean.slice(-4),
    '',
    'GET /rentals',
    '- Authorization - ' + tryHeader_(BASE + '/rentals', { 'Authorization': clean, 'Accept': 'application/json' })
  ];
  ui.alert('Hosthub Diagnostics\n\n' + out.join('\n'));
}

function tryHeader_(url, headers) {
  try {
    var res = UrlFetchApp.fetch(url, { method:'get', headers: headers, muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code === 200) {
      var n = 0; try { n = (JSON.parse(res.getContentText()).data || []).length; } catch (e) {}
      return 'HTTP 200 OK (' + n + ' rentals)';
    }
    return 'HTTP ' + code + ' body: ' + ((res.getContentText() || '').slice(0,120) || '(empty)');
  } catch (e) { return 'EXCEPTION: ' + e.message; }
}

// -- 1c. PROBE gr-taxes: deixnei ta OMA noumera tou Hosthub API gia mia kratisi ---
// (apodeiksi pros Hosthub oti to gr-taxes ypologizei FPA kai sto city tax)

function probeGrTaxes() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('Probe gr-taxes', 'Dose event_id (teleftaia stili tou Bookings):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var id = String(resp.getResponseText() || '').trim();
  if (!id) return;
  var gr = apiGet_('/calendar-events/' + id + '/calendar-event-gr-taxes') || {};
  var f = function(m){ return (m && typeof m.cents === 'number') ? (m.cents/100).toFixed(2) : '-'; };
  var net = (gr.net_value && gr.net_value.cents || 0)/100, city = (gr.accommodation_tax && gr.accommodation_tax.cents || 0)/100;
  var vatOnNet = (net * VAT_RATE).toFixed(2), vatOnNetCity = ((net + city) * VAT_RATE).toFixed(2);
  ui.alert('Hosthub RAW gr-taxes @ ' + id + '\n\n' +
    'net_value          : ' + f(gr.net_value) + '\n' +
    'vat                : ' + f(gr.vat) + '\n' +
    'accommodation_tax  : ' + f(gr.accommodation_tax) + '\n' +
    'climate_tax        : ' + f(gr.climate_tax) + '\n' +
    'aade_value         : ' + f(gr.aade_value) + '\n' +
    'gross_booking_value: ' + f(gr.gross_booking_value) + '\n\n' +
    'Elegxos:\n' +
    '13% x net              = ' + vatOnNet + '\n' +
    '13% x (net + city_tax) = ' + vatOnNetCity + '  <- an ayto = vat, to Hosthub vazei FPA sto city tax');
}

// -- 1d. PROBE EVENT: ti epistrefei to API gia mia kratisi (list vs detail) -------

function probeEvent() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('Probe event', 'Dose event_id I Reservation ID:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var id = String(resp.getResponseText() || '').trim();
  if (!id) return;

  // An edose Reservation ID, vres to event_id apo to Bookings
  var bk = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_BOOKINGS);
  if (bk && bk.getLastRow() > 1) {
    var bv = bk.getRange(2, 1, bk.getLastRow() - 1, TOTAL_COLS).getValues();
    for (var bi = 0; bi < bv.length; bi++) {
      if (String(bv[bi][2] || '').trim().toUpperCase() === id.toUpperCase()) {
        id = String(bv[bi][EVENT_IDX] || '');
        break;
      }
    }
  }
  if (!id) { ui.alert('Den vrethike event_id gia ayto to Reservation ID.'); return; }

  var det = {};
  try { var d0 = apiGet_('/calendar-events/' + id); det = d0.data || d0 || {}; }
  catch (e) { ui.alert('DETAIL error: ' + e.message); return; }

  var lst = null;
  try {
    var rid = det.rental && det.rental.id;
    if (rid) {
      var evs = fetchRentalEvents_(rid);
      for (var i = 0; i < evs.length; i++) if (String(evs[i].id) === id) { lst = evs[i]; break; }
    }
  } catch (e2) {}

  function pick(o) {
    if (!o) return '(den vrethike)';
    return 'id_type=' + (o.guest_identification_type || o.identification_type || '-') +
           ' | id_number=' + (o.guest_identification_number || o.identification_number || '-') +
           ' | email=' + (o.guest_email || '-') +
           ' | country=' + (o.guest_country || '-') +
           ' | guest=' + (o.guest_name || '-');
  }
  ui.alert('PROBE ' + id + '\n\n' +
    'LIST (ayto vlepei to sync):\n' + pick(lst) + '\n\n' +
    'DETAIL (/calendar-events/{id}):\n' + pick(det) + '\n\n' +
    'JSON keys detail: ' + Object.keys(det).join(', ').slice(0, 350));
}

// -- 0a. SETUP TABS (PROSOXI: katharizei to Bookings) ---------------------------

function setupTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var bk = ss.getSheetByName(TAB_BOOKINGS) || ss.insertSheet(TAB_BOOKINGS);
  bk.clear();
  bk.getRange(1,1,1,BOOK_COLS.length).setValues([BOOK_COLS])
    .setFontWeight('bold').setBackground('#2E75B6').setFontColor('#FFFFFF');
  bk.setFrozenRows(1);

  // Direct_Cash: idies stiles me Bookings gia enopoiisi.
  // To header ksanagrafetai PANTA (xoris na peirazei ta data apo tin grammi 2+).
  var dc = ss.getSheetByName(TAB_DIRECT) || ss.insertSheet(TAB_DIRECT);
  dc.getRange(1,1,1,dc.getMaxColumns()).clearContent();
  dc.getRange(1,1,1,BOOK_COLS.length).setValues([BOOK_COLS])
    .setFontWeight('bold').setBackground('#548235').setFontColor('#FFFFFF');
  dc.setFrozenRows(1);

  var lg = ss.getSheetByName(TAB_LOG) || ss.insertSheet(TAB_LOG);
  if (lg.getLastRow() === 0) lg.appendRow(['timestamp','action','count','detail']);

  SpreadsheetApp.getUi().alert('Tabs OK. Next: Hosthub -> 0b. Load rentals');
}

// -- MASTER PROPERTIES (external file) -----------------------------------------

function masterSheet_() {
  var ext = SpreadsheetApp.openById(MASTER_PROPS_ID);
  var sh = ext.getSheetByName(TAB_MASTER) || ext.getSheets()[0];
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,MASTER_COLS.length).setValues([MASTER_COLS])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

// -- 0b. LOAD RENTALS (upsert sto external Master Properties) -------------------

function loadRentals() {
  var mp = masterSheet_();

  var rentals = (apiGet_('/rentals').data) || [];
  var last = mp.getLastRow();
  var existing = last > 1 ? mp.getRange(2,1,last-1,MASTER_COLS.length).getValues() : [];
  var byId = {};
  for (var i=0;i<existing.length;i++) { var id = existing[i][1]; if (id) byId[String(id)] = i; }

  var added = 0;
  rentals.forEach(function(r){
    var id = String(r.id||'');
    if (byId.hasOwnProperty(id)) {
      mp.getRange(2 + byId[id], 1).setValue(r.name||'');
    } else {
      mp.appendRow([r.name||'', r.id||'', '?','','','','','','',8,'?','TRUE','']);
      added++;
    }
  });

  applyMasterDropdowns_(mp);
  logRow_('LOAD_RENTALS', rentals.length, 'added=' + added);
  SpreadsheetApp.getUi().alert(rentals.length + ' rentals (new: ' + added + '). Fill Owner_Type + details in Master Properties.');
}

function applyMasterDropdowns_(mp) {
  var last = mp.getLastRow(); if (last < 2) return;
  var n = last - 1;
  var ownerRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Εταιρεία','Φυσικό','Δικό μας'], true).setAllowInvalid(false).build();
  mp.getRange(2, 3, n, 1).setDataValidation(ownerRule);
  var invRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Τιμολόγιο','Απόδειξη','Δεν εφαρμόζεται'], true).setAllowInvalid(true).build();
  mp.getRange(2, 11, n, 1).setDataValidation(invRule);
}

// -- 1. TEST -------------------------------------------------------------------

function testConnection() {
  var rentals = (apiGet_('/rentals').data) || [];
  SpreadsheetApp.getUi().alert('OK ' + rentals.length + ' rentals:\n' + rentals.slice(0,6).map(function(r){return r.name;}).join(', '));
}

// -- 2. SYNC (incremental me updated_gte, kata Hosthub tech team) -----------------

function syncBookings(silent) {
  var start = Date.now();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_BOOKINGS);
  if (!sh) { if(!silent) SpreadsheetApp.getUi().alert('Run Setup first!'); return; }

  var master = loadMaster_();
  var last = sh.getLastRow();
  var existing = last > 1 ? sh.getRange(2,1,last-1,TOTAL_COLS).getValues() : [];
  var byId = {}, maxNo = 0;
  for (var i=0;i<existing.length;i++) {
    var id = existing[i][EVENT_IDX];
    if (id) byId[id] = { i: i, vals: existing[i] };
    var no = Number(existing[i][0]); if (!isNaN(no) && no > maxNo) maxNo = no;
  }

  // INCREMENTAL kata tis odigies tou Hosthub tech team: katevazoume MONO ta events
  // pou allaksan (updated_gte) me overlap asfaleias 24h. Xoris LAST_SYNC_TS
  // (proti fora / Full resync): pliris peripatos me previous cursors.
  var props = PropertiesService.getScriptProperties();
  var lastTs = Number(props.getProperty('LAST_SYNC_TS') || 0);
  var runStart = Math.floor(Date.now() / 1000);
  var since = lastTs > 0 ? (lastTs - 24 * 3600) : 0;
  var events = fetchGlobalEvents_(since);

  var toAppend = [], updated = 0, added = 0, stopped = false, FLUSH = 50, seen = {}, diag = 0;
  function flush(){ if (!toAppend.length) return; sh.getRange(sh.getLastRow()+1, 1, toAppend.length, TOTAL_COLS).setValues(toAppend); added += toAppend.length; toAppend = []; }

  for (var k = 0; k < events.length; k++) {
    if (Date.now() - start > TIME_BUDGET_MS) { stopped = true; break; }
    var e = events[k];
    if (e.type !== 'CalendarEventBooking' && e.type !== 'Booking') continue;
    if (e.date_from && e.date_from < MIN_DATE) continue;   // mono check-in >= MIN_DATE (2026+)
    if (SKIP_GUESTS.indexOf(String(e.guest_name || '').trim().toLowerCase()) > -1) continue;   // owner-blocks
    if (seen[e.id]) continue; seen[e.id] = 1;
    var ex = byId[e.id];
    var fin  = ex ? finChanged_(ex.vals, e) : true;    // allaksan POSA/status -> theloun fresko gr-taxes
    var info = ex ? infoChanged_(ex.vals, e) : false;  // allaksan mono stoixeia episkepti
    if (ex && !fin && !info) continue;
    // DIAGNOSTIKO: ti akrivos pyrodotise to ksanagrapsimo (prwtes 3 grammes ana treksimo)
    if (ex && diag < 3) {
      diag++;
      logRow_('DIRTY', k, 'id=' + e.id + ' fin=' + fin + ' info=' + info +
        ' | bv:' + ex.vals[13] + '/' + money_(e.booking_value) +
        ' po:' + ex.vals[15] + '/' + money_(e.total_payout) +
        ' sf:' + ex.vals[19] + '/' + money_(e.service_fee_host) +
        ' vis:' + ex.vals[VIS_IDX] + '/' + e.is_visible +
        ' g:' + ex.vals[GUESTS_IDX] + '/' + guestsStr_(e) +
        ' ph:[' + ex.vals[PHONE_IDX] + ']/[' + (e.guest_phone || '') + ']' +
        ' pass:[' + ex.vals[PASSPORT_IDX] + ']/[' + (e.guest_identification_number || '') + ']' +
        ' em:[' + ex.vals[11] + '] co:[' + ex.vals[COUNTRY_IDX] + ']/' + (e.guest_country || ''));
    }
    var gr = {};
    if (ex && !fin) {
      gr = grFromRow_(ex.vals);   // mono guest info: ksanaxrisimopoioume tous forous tou sheet — 0 kliseis API
    } else {
      try { gr = apiGet_('/calendar-events/' + e.id + '/calendar-event-gr-taxes') || {}; } catch(err) {}
    }
    // MANUAL: Passport_AFM & Guest_Country (kratiountai an exoun timi), Comments
    var man = {
      passport: ex && String(ex.vals[PASSPORT_IDX] || '') !== '' ? ex.vals[PASSPORT_IDX] : (e.guest_identification_number || e.identification_number || ''),
      country:  ex && String(ex.vals[COUNTRY_IDX] || '') !== ''  ? ex.vals[COUNTRY_IDX]  : countryName_(e.guest_country),
      commRate: ex ? ex.vals[COMMRATE_IDX] : '',
      phone:    ex && String(ex.vals[PHONE_IDX] || '') !== '' ? ex.vals[PHONE_IDX] : (e.guest_phone || ''),
      comments: ex ? ex.vals[COMMENTS_IDX] : ''
    };
    var no  = ex ? ex.vals[0] : (++maxNo);
    var row = buildRow_(e, gr, master, no, man);
    if (ex) { sh.getRange(2 + ex.i, 1, 1, TOTAL_COLS).setValues([row]); updated++; }
    else { toAppend.push(row); if (toAppend.length >= FLUSH) flush(); }
  }

  flush();
  if (stopped) {
    props.setProperty('SYNC_PARTIAL', '1');   // to parathyro tha ksanatreksei olokliro (idempotent)
  } else {
    props.deleteProperty('SYNC_PARTIAL');
    props.setProperty('LAST_SYNC_TS', String(runStart));
  }
  var reDerived = reDeriveAll_(sh);   // piaenei allages sto Comm_Rate% xoris allo trigger
  var dcAdded = mergeDirectCash_(ss, sh);
  var lr = sh.getLastRow();
  if (lr > 2) sh.getRange(2, 1, lr - 1, TOTAL_COLS).sort({ column: 4, ascending: true });   // Check_in (imerologiaka)
  highlightCancelled_(sh);
  if (lr > 2) sh.getRange(2, VIS_IDX + 1, lr - 1, 1).clearDataValidations();
  logRow_('SYNC', updated + added, 'mode=' + (since > 0 ? 'incremental(updated_gte)' : 'FULL') + ' events=' + events.length + ' updated=' + updated + ' added=' + added + (stopped ? ' PARTIAL' : ' DONE'));
  if (!silent) SpreadsheetApp.getUi().alert('Sync ' + (stopped ? 'PARTIAL — run again' : 'OK — done') +
    '\nMode: ' + (since > 0 ? 'incremental' : 'FULL') + '\nEvents checked: ' + events.length +
    '\nUpdated: ' + updated + '\nNew: ' + added + '\nDirect Cash: ' + dcAdded);
}

// Pliris epanasygxronismos olis tis istorias (spania — kata Hosthub oxi syxna)
function fullResync() {
  PropertiesService.getScriptProperties().deleteProperty('LAST_SYNC_TS');
  syncBookings();
}

// Auto-sync me AYTO-SYNEXEIA: an kopei sto time budget (PARTIAL), programmatizei
// monos tou synexeia se 1 lepto kai DEN kanei push. To push pros Owner Invoicing
// trexei MONO otan to sync oloklirothei (DONE) — pote pano se misa dedomena.
function syncBookingsAuto() {
  try {
    syncBookings(true);
  } catch (e) {
    // p.x. epimono 429: min pethaneis — ksanadokimase se 10 lepta
    logRow_('AUTO_SYNC_ERROR', 0, e.message + ' -> retry se 10 lepta');
    ScriptApp.newTrigger('syncBookingsResume').timeBased().after(10 * 60 * 1000).create();
    return;
  }
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SYNC_PARTIAL')) {
    ScriptApp.newTrigger('syncBookingsResume').timeBased().after(60 * 1000).create();
    logRow_('AUTO_CHAIN', 0, 'partial -> resume se 1 lepto');
  } else {
    try { if (typeof pushInvoicing === 'function') { pushInvoicing(true); logRow_('AUTO_PUSH', 0, 'push meta apo pliri sync'); } }
    catch (e) { logRow_('PUSH_INVOICING_ERROR', 0, e.message); }
  }
}

// Resume: katharizei ta one-shot triggers tou kai synexizei
function syncBookingsResume() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'syncBookingsResume') ScriptApp.deleteTrigger(t);
  });
  syncBookingsAuto();
}

// Allaksan OIKONOMIKA stoixeia / status -> xreiazetai fresko gr-taxes
function finChanged_(o, e) {
  if (String(o[13]) !== String(money_(e.booking_value)))    return true;
  if (String(o[15]) !== String(money_(e.total_payout)))     return true;
  if (String(o[19]) !== String(money_(e.service_fee_host))) return true;
  if (String(o[VIS_IDX]) !== String(e.is_visible))          return true;
  return false;
}

// Allaksan MONO stoixeia episkepti -> ksanagrafoume ti grammi XORIS klisi gr-taxes
function infoChanged_(o, e) {
  if (String(o[PASSPORT_IDX] || '') === '' && String(e.guest_identification_number || e.identification_number || '') !== '') return true;
  if (String(o[11] || '') === '' && String(e.guest_email || '') !== '') return true;
  if (String(o[COUNTRY_IDX] || '') === '' && String(e.guest_country || '') !== '') return true;
  if (String(o[GUESTS_IDX] || '') !== guestsStr_(e)) return true;   // allagi ston arithmo guests
  if (String(o[PHONE_IDX] || '') === '' && String(e.guest_phone || '') !== '') return true;
  return false;
}

// Ftiaxnei "gr" object apo tous forous pou exei IDI i grammi (gia na min ksanakaloume to API)
function grFromRow_(v) {
  function c(x) { var n = Number(x); return (x === '' || x == null || isNaN(n)) ? null : { cents: Math.round(n * 100) }; }
  return { net_value: c(v[21]), vat: c(v[22]), accommodation_tax: c(v[23]),
           climate_tax: c(v[24]), aade_value: c(v[25]), gross_booking_value: c(v[26]) };
}

function buildRow_(e, gr, master, no, man) {
  var m = master[String((e.rental && e.rental.id) || '')] || {};
  var ownerType = normOwner_(m.ownerType);
  var t     = taxSplit_(gr);
  var net   = t.net;
  var gross = t.gross;
  var env   = t.env;
  var bank  = money_(e.payment_charges);
  var n_    = function(v){ return v === '' ? 0 : v; };
  var bankNum = n_(bank);
  var sfh = money_(e.service_fee_host); var chan = (sfh === '') ? 0 : Math.abs(sfh);   // channel commission
  var base='', comm='', commVat='', commTotal='';
  if (ownerType === 'Εταιρεία') { var nv = net !== '' ? net : money_(e.booking_value); if (nv !== '') base = nv - bankNum - chan; }
  // Φυσικό: to gross_booking_value tou Hosthub EINAI IDI kathara apo Env fee (= total_value - env),
  // ara DEN afairoume ksana to env (prin ypirxe diplo-afairesi).
  else if (ownerType === 'Φυσικό') { var gv = gross !== '' ? gross : (net !== '' ? net : money_(e.booking_value)); if (gv !== '') base = gv - bankNum - chan; }
  if (base !== '') {
    base = Math.round(base * 100) / 100;
    comm = Math.round(base * commRate_(man.commRate) * 100) / 100;   // seveta to Comm_Rate% tis grammis
    commVat = Math.round(comm * COMMISSION_VAT * 100) / 100;
    commTotal = Math.round((comm + commVat) * 100) / 100;
  }

  var compRev = '';
  if (ownerType === 'Δικό μας') {
    var tv = money_(e.total_value);
    if (tv !== '') compRev = Math.round((n_(tv) - chan - n_(t.vat) - n_(t.city) - n_(t.env) - bankNum) * 100) / 100;
  } else if (comm !== '') {
    compRev = comm;   // Comm_20pct (diaxeirizomena)
  }

  return [
    no,
    e.date_from ? Number(e.date_from.split('-')[1]) : '',
    e.reservation_id || '', e.date_from || '', e.date_to || '',
    (e.rental && e.rental.name) || '', (e.source && e.source.name) || 'Direct (Hosthub)', nights_(e),
    e.guest_name || '', (e.guest_identification_type || e.identification_type || ''), man.passport,
    e.guest_email || '', man.country,
    money_(e.booking_value), money_(e.cleaning_fee),
    money_(e.total_payout), money_(e.total_value), money_(e.guest_paid),
    bank, money_(e.service_fee_host), (e.rental && e.rental.currency) || '',
    net, t.vat, t.city,
    t.env, t.aade, t.gross,
    ownerType, base, comm, commVat, commTotal, compRev,
    e.is_visible, (e.cancelled_at ? new Date(e.cancelled_at * 1000) : ''),
    man.commRate, guestsStr_(e), man.phone, man.comments,
    e.id, new Date()
  ];
}

function highlightCancelled_(sh) {
  var last = sh.getLastRow(); if (last < 2) return;
  var n = last - 1;
  var vis = sh.getRange(2, VIS_IDX + 1, n, 1).getValues();
  var bg = [];
  for (var i = 0; i < n; i++) {
    var cancelled = (vis[i][0] === false || vis[i][0] === 'FALSE');
    var row = [];
    for (var j = 0; j < TOTAL_COLS; j++) row.push(cancelled ? '#F4CCCC' : '#FFFFFF');
    bg.push(row);
  }
  sh.getRange(2, 1, n, TOTAL_COLS).setBackgrounds(bg);
}

// GLOBAL fetch (kata Hosthub tech team):
//  - proti selida = ta 400 pio prosfata created, "previous" = palaiotera
//  - me updated_gte pairnoume MONO oti allakse (elaxistes kliseis)
//  - FIX: stamatame an i epomeni selida einai IDIA me tin proigoumeni i adeia
//    (ayto prokalese tis 28 idies kliseis pou entopise to Hosthub)
function fetchGlobalEvents_(sinceUnix) {
  var url = '/calendar-events?is_visible=all&limit=400' + (sinceUnix > 0 ? '&updated_gte=' + sinceUnix : '');
  var all = [], prevUrl = '', guard = 0;
  while (url && url !== prevUrl && guard < 40) {
    var page = apiGet_(url);
    var d = page.data || [];
    all = all.concat(d);
    if (!d.length) break;                     // adeia selida -> telos
    prevUrl = url;
    url = (page.navigation && page.navigation.previous) ? page.navigation.previous : null;   // palaiotera
    guard++;
  }
  return all;
}

// Per-rental fetch (xrisimopoieitai mono apo to probe) — me to idio cursor-fix
function fetchRentalEvents_(rid) {
  var all = [], url = '/rentals/' + rid + '/calendar-events?is_visible=all&limit=400', prevUrl = '', guard = 0;
  while (url && url !== prevUrl && guard < 15) {
    var page = apiGet_(url);
    var d = page.data || [];
    all = all.concat(d);
    if (!d.length) break;
    prevUrl = url;
    url = (page.navigation && page.navigation.previous) ? page.navigation.previous : null;   // older
    guard++;
  }
  return all;
}

// -- DIRECT CASH (manual tab -> merge sto Bookings) ------------------------------

function dcKey_(res, checkin) {
  var s = (Object.prototype.toString.call(checkin) === '[object Date]')
    ? Utilities.formatDate(checkin, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(checkin || '');
  return 'DC|' + String(res || '').toLowerCase().replace(/\s/g, '') + '|' + s;
}

// Kanonikopoiei to Owner_Type (anextiko se typos/kena/keffalaia): "Δκό μας" -> "Δικό μας" klp.
function normOwner_(v) {
  var s = String(v || '').trim();
  if (!s) return '';
  var low = s.toLowerCase().replace(/\s+/g, '');
  if (low.indexOf('εταιρ') === 0) return 'Εταιρεία';
  if (low.indexOf('φυσ') === 0) return 'Φυσικό';
  if (low.indexOf('δικ') === 0 || low.indexOf('δκ') === 0) return 'Δικό μας';
  return s;
}

// Env_Fee_Night ana property apo to external Master Properties (cache ana ektelesi)
var DC_ENV_CACHE = null;
function dcEnvNight_(residence) {
  if (DC_ENV_CACHE === null) {
    DC_ENV_CACHE = {};
    try {
      var vals = masterSheet_().getDataRange().getValues();
      for (var i = 1; i < vals.length; i++) {
        var nm = String(vals[i][0] || '').toLowerCase().replace(/[^a-z0-9α-ω]/g, '');
        if (nm) DC_ENV_CACHE[nm] = Number(vals[i][9]) || 0;   // Env_Fee_Night (10i stili)
      }
    } catch (e) {}
  }
  var key = String(residence || '').toLowerCase().replace(/[^a-z0-9α-ω]/g, '');
  if (DC_ENV_CACHE[key] !== undefined) return DC_ENV_CACHE[key];
  for (var k in DC_ENV_CACHE) { if (k && key && (key.indexOf(k) === 0 || k.indexOf(key) === 0)) return DC_ENV_CACHE[k]; }
  return 0;
}

// Owner_Type ana property apo to external Master Properties (cache, prefix match)
var OWNER_CACHE = null;
function ownerByName_(residence) {
  if (OWNER_CACHE === null) {
    OWNER_CACHE = {};
    try {
      var vals = masterSheet_().getDataRange().getValues();
      for (var i = 1; i < vals.length; i++) {
        var nm = String(vals[i][0] || '').toLowerCase().replace(/[^a-z0-9α-ω]/g, '');
        if (nm) OWNER_CACHE[nm] = normOwner_(vals[i][2]);
      }
    } catch (e) {}
  }
  var key = String(residence || '').toLowerCase().replace(/[^a-z0-9α-ω]/g, '');
  if (OWNER_CACHE[key] !== undefined) return OWNER_CACHE[key];
  for (var k in OWNER_CACHE) { if (k && key && (key.indexOf(k) === 0 || k.indexOf(key) === 0)) return OWNER_CACHE[k]; }
  return '';
}

// Ksana-ypologizei promitheies se OLES tis grammes: pianei allages sto Comm_Rate%
// KAI allages Owner_Type sto Master Properties (p.x. Candia: Etaireia -> Fysiko).
// Grafei mono tis stiles Owner_Type..Company_Revenue kai mono opou allaksan.
function reDeriveAll_(sh) {
  var last = sh.getLastRow(); if (last < 2) return 0;
  var vals = sh.getRange(2, 1, last - 1, TOTAL_COLS).getValues();
  var n = 0;
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!r[EVENT_IDX]) continue;
    if (String(r[21]) === '' && String(r[16]) === '') continue;   // xoris oikonomika stoixeia
    var before = [r[27], r[28], r[29], r[30], r[31], r[32]].join('|');
    var ot = ownerByName_(r[5]);
    if (ot) r[27] = ot;                       // Master Properties = pigi alitheias
    deriveRow_(r);
    if ([r[27], r[28], r[29], r[30], r[31], r[32]].join('|') !== before) {
      sh.getRange(2 + i, 28, 1, 6).setValues([[r[27], r[28], r[29], r[30], r[31], r[32]]]);
      n++;
    }
  }
  return n;
}

// Ypologizei Comm_Base/20pct/VAT/Total + Company_Revenue apo ta raw pedia tis grammis.
function deriveRow_(r) {
  var num = function(v){ var x = Number(v); return isNaN(x) ? 0 : x; };
  var ownerType = normOwner_(r[27]);
  r[27] = ownerType;   // grafei tin kanoniki timi sto Bookings (diorthonei typos)
  var net = num(r[21]), gross = num(r[26]), env = num(r[24]), bank = num(r[18]),
      chan = Math.abs(num(r[19])), tv = num(r[16]), vat = num(r[22]), city = num(r[23]);
  // Direct_Cash: grafeis MONO to Total payout (i to Guest paid) kai ola ta ypoloipa
  // gemizoun automata: Total value = Guest paid = Payout, vasi = idio poso.
  var isDC = String(r[EVENT_IDX] || '').indexOf('DC|') === 0;
  if (isDC) {
    var pay = num(r[15]) || num(r[17]) || num(r[16]);
    if (!num(r[15])) r[15] = pay;   // Total payout
    if (!num(r[16])) r[16] = pay;   // Total value
    if (!num(r[17])) r[17] = pay;   // Guest paid
    // SIMEIOSI: oi Direct Cash DEN pairnoun forologiki diaspasi (Net/FPA/City/Env menoun kena)
    if (!net) net = pay; if (!gross) gross = pay; if (!tv) tv = pay;
  }
  var base='', comm='', commVat='', commTotal='', compRev='';
  if (ownerType === 'Εταιρεία') { base = net - bank - chan; }
  // Φυσικό: to Gross_Value einai idi kathara apo Env (= Total value - Env) -> min afaireseis env ksana.
  else if (ownerType === 'Φυσικό') { base = (gross || net) - bank - chan; }
  if (base !== '') {
    // DC me xeirokinito poso promitheias (xoris Comm_Rate%): sevomaste to poso pou egrapses
    var manualComm = (isDC && String(r[COMMRATE_IDX] || '') === '' && num(r[29]) > 0) ? num(r[29]) : 0;
    comm = manualComm ? manualComm
                      : Math.round(base * commRate_(r[COMMRATE_IDX]) * 100) / 100;   // alliws Comm_Rate% (keno = 20%)
    if (isDC) {
      commVat = 0; commTotal = comm;   // cash: xoris FPA (Comm_Total = Comm_20pct)
    } else {
      commVat = Math.round(comm * COMMISSION_VAT * 100) / 100;
      commTotal = Math.round((comm + commVat) * 100) / 100;
    }
  }
  if (ownerType === 'Δικό μας') { compRev = Math.round((tv - chan - vat - city - env - bank) * 100) / 100; }
  else if (comm !== '') { compRev = comm; }
  r[28] = base; r[29] = comm; r[30] = commVat; r[31] = commTotal; r[32] = compRev;
  return r;
}

function mergeDirectCash_(ss, sh) {
  var dc = ss.getSheetByName(TAB_DIRECT);
  if (!dc) return 0;
  // Dropdown validation sto Owner_Type tou Direct_Cash (idio me Master Properties)
  // gia na min ksanaperasei typo opos "Δκό μας". Efarmozetai se kathe sync.
  var dcOwnerRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Εταιρεία','Φυσικό','Δικό μας'], true).setAllowInvalid(false).build();
  if (dc.getMaxRows() > 1) dc.getRange(2, 28, dc.getMaxRows() - 1, 1).setDataValidation(dcOwnerRule);
  var last = dc.getLastRow(); if (last < 2) return 0;
  var rows = dc.getRange(2, 1, last - 1, TOTAL_COLS).getValues();
  var bkLast = sh.getLastRow();
  var bkVals = bkLast > 1 ? sh.getRange(2, 1, bkLast - 1, TOTAL_COLS).getValues() : [];
  var byId = {};
  for (var i = 0; i < bkVals.length; i++) { var id = bkVals[i][EVENT_IDX]; if (id) byId[id] = i; }
  var added = 0, liveKeys = {};
  rows.forEach(function(r){
    if (!r[5]) return;                                  // xoris Residence -> skip
    var id = r[EVENT_IDX] || dcKey_(r[5], r[3]);
    r[EVENT_IDX] = id;
    liveKeys[id] = 1;
    r[EVENT_IDX + 1] = new Date();                      // synced_at
    r = deriveRow_(r);
    if (byId.hasOwnProperty(id)) { sh.getRange(2 + byId[id], 1, 1, TOTAL_COLS).setValues([r]); }
    else { sh.appendRow(r); added++; }
  });
  // Katharismos orfanon DC grammon sto Bookings: an allaksei imerominia/residence sto DC tab,
  // allazei to kleidi kai i palia grammi tha emene gia panta (px. Porikis 07/04 -> 2026-07-04).
  var bkL = sh.getLastRow();
  if (bkL > 1) {
    var ids = sh.getRange(2, EVENT_IDX + 1, bkL - 1, 1).getValues();
    for (var j = ids.length - 1; j >= 0; j--) {
      var v = String(ids[j][0] || '');
      if (v.indexOf('DC|') === 0 && !liveKeys[v]) sh.deleteRow(2 + j);
    }
  }
  return added;
}

function loadMaster_() {
  var map = {};
  var sh;
  try { sh = masterSheet_(); } catch (e) { logRow_('MASTER_PROPS_ERROR', 0, e.message); return map; }
  var vals = sh.getDataRange().getValues();
  for (var r=1; r<vals.length; r++) { var id = vals[r][1]; if (id) map[String(id)] = { ownerType: vals[r][2]||'', issueInvoice: vals[r][10]||'' }; }
  return map;
}

// -- 0d. ADD COMM_RATE% COLUMN (one-off migration tou Bookings sheet) --------------

function addCommRateColumn() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_BOOKINGS);
  if (!sh) { SpreadsheetApp.getUi().alert('Den yparxei Bookings.'); return; }
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (String(hdr[COMMRATE_IDX] || '') === 'Comm_Rate%') { SpreadsheetApp.getUi().alert('I stili Comm_Rate% yparxei idi.'); return; }
  sh.insertColumnBefore(COMMRATE_IDX + 1);   // prin to Guests
  sh.getRange(1, COMMRATE_IDX + 1).setValue('Comm_Rate%')
    .setFontWeight('bold').setBackground('#B45F06').setFontColor('#FFFFFF');
  SpreadsheetApp.getUi().alert('Stili Comm_Rate% OK.\nKeno = 20% (kanoniko). Gia agency grapse p.x. 15.\nH allagi pianei sto epomeno "2. Sync bookings".');
}

// -- 0h. CLEAR DC TAXES (one-off): katharizei Net/FPA/City/Env/AADE/Gross apo DC grammes

function clearDcTaxes() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_BOOKINGS);
  if (!sh) return;
  var last = sh.getLastRow(); if (last < 2) return;
  var vals = sh.getRange(2, 1, last - 1, TOTAL_COLS).getValues();
  var n = 0;
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (String(r[EVENT_IDX] || '').indexOf('DC|') !== 0) continue;
    if (String(r[21]) === '' && String(r[22]) === '') continue;   // idi kena
    sh.getRange(2 + i, 22, 1, 6).setValues([['', '', '', '', '', '']]);   // Net..Gross (stiles 22-27)
    n++;
  }
  SpreadsheetApp.getUi().alert('Katharistikan oi foroi apo ' + n + ' Direct Cash grammes.');
}

// -- 0f. FIX DIRECT_CASH COLUMNS: eythygrammizei to tab me ti nea diataksi ----------

function fixDirectCashColumns() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_DIRECT);
  if (!sh) { SpreadsheetApp.getUi().alert('Den yparxei Direct_Cash.'); return; }
  var need = [[COMMRATE_IDX, 'Comm_Rate%'], [GUESTS_IDX, 'Guests'], [PHONE_IDX, 'Guest_Phone']];
  var added = 0;
  for (var i = 0; i < need.length; i++) {
    var idx = need[i][0], name = need[i][1];
    var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (String(hdr[idx] || '') === name) continue;
    sh.insertColumnBefore(idx + 1);
    sh.getRange(1, idx + 1).setValue(name)
      .setFontWeight('bold').setBackground('#548235').setFontColor('#FFFFFF');
    added++;
  }
  if (added) sh.getRange(2, PHONE_IDX + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  SpreadsheetApp.getUi().alert('Direct_Cash OK — prostethikan ' + added + ' stiles. I diataksi tairiazei pia me to Bookings.');
}

// -- 0e. ADD GUEST_PHONE COLUMN (one-off migration tou Bookings sheet) --------------

function addPhoneColumn() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_BOOKINGS);
  if (!sh) { SpreadsheetApp.getUi().alert('Den yparxei Bookings.'); return; }
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (String(hdr[PHONE_IDX] || '') === 'Guest_Phone') { SpreadsheetApp.getUi().alert('I stili Guest_Phone yparxei idi.'); return; }
  sh.insertColumnBefore(PHONE_IDX + 1);   // prin to Comments
  sh.getRange(1, PHONE_IDX + 1).setValue('Guest_Phone')
    .setFontWeight('bold').setBackground('#2E75B6').setFontColor('#FFFFFF');
  sh.getRange(2, PHONE_IDX + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');   // text (kratali to +)
  SpreadsheetApp.getUi().alert('Stili Guest_Phone OK. Trekse "2. Sync bookings" gia na gemisei apo to Hosthub.');
}

// -- 0c. ADD GUESTS COLUMN (one-off migration tou Bookings sheet) ------------------

function addGuestsColumn() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_BOOKINGS);
  if (!sh) { SpreadsheetApp.getUi().alert('Den yparxei Bookings.'); return; }
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (String(hdr[GUESTS_IDX] || '') === 'Guests') { SpreadsheetApp.getUi().alert('I stili Guests yparxei idi.'); return; }
  sh.insertColumnBefore(GUESTS_IDX + 1);   // prin to Comments
  sh.getRange(1, GUESTS_IDX + 1).setValue('Guests')
    .setFontWeight('bold').setBackground('#2E75B6').setFontColor('#FFFFFF');
  SpreadsheetApp.getUi().alert('Stili Guests OK. Trekse tora "2. Sync bookings" gia na gemisei.');
}

// -- 2b. REFRESH TAXES (ksanakatevazei gr-taxes gia OLES tis grammes) --------------

function refreshTaxes() {
  var start = Date.now();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_BOOKINGS);
  if (!sh) { SpreadsheetApp.getUi().alert('Den yparxei Bookings.'); return; }
  var last = sh.getLastRow(); if (last < 2) return;
  var vals = sh.getRange(2, 1, last - 1, TOTAL_COLS).getValues();

  var props = PropertiesService.getScriptProperties();
  var i = parseInt(props.getProperty('TAXFIX_IDX') || '0', 10) || 0;
  var updated = 0, stopped = false;

  for (; i < vals.length; i++) {
    if (Date.now() - start > TIME_BUDGET_MS) { stopped = true; break; }
    var r = vals[i];
    var id = String(r[EVENT_IDX] || '');
    if (!id || id.indexOf('DC|') === 0) continue;   // skip kena & Direct_Cash
    var gr;
    try { gr = apiGet_('/calendar-events/' + id + '/calendar-event-gr-taxes') || {}; } catch (e) { continue; }
    var t = taxSplit_(gr);
    var newVals = [t.net, t.vat, t.city, t.env, t.aade, t.gross];
    var changed = false;
    for (var c = 0; c < 6; c++) {
      if (String(r[21 + c]) !== String(newVals[c])) { r[21 + c] = newVals[c]; changed = true; }
    }
    if (changed) {
      r = deriveRow_(r);                       // ksana-ypologise Comm/Company_Revenue
      r[TOTAL_COLS - 1] = new Date();          // synced_at
      sh.getRange(2 + i, 1, 1, TOTAL_COLS).setValues([r]);
      updated++;
    }
  }

  if (stopped) props.setProperty('TAXFIX_IDX', String(i));
  else props.deleteProperty('TAXFIX_IDX');
  logRow_('REFRESH_TAXES', updated, 'row=' + i + '/' + vals.length + (stopped ? ' PARTIAL' : ' DONE'));
  SpreadsheetApp.getUi().alert('Refresh taxes ' + (stopped ? 'PARTIAL — trekse ksana (synexizei apo ekei pou emeine)' : 'DONE') +
    '\nRows checked: ' + i + '/' + vals.length + '\nUpdated: ' + updated);
}

// -- 2c. RECOMPUTE COMMISSIONS (topika, xoris API) --------------------------------
// Ksana-trexei to deriveRow_ se OLES tis grammes tou Bookings me ta yparxonta dedomena.
// Xrisimo meta apo diorthosi formulas (px. to diplo env sto Φυσικό) gia na diorthothoun
// kai oi palies grammes pou to sync den tha ksanagrapsei.

function masterByName_() {
  var map = {};
  try {
    var sh = masterSheet_();
    var vals = sh.getDataRange().getValues();
    for (var r = 1; r < vals.length; r++) {
      var nm = String(vals[r][0] || '').trim().toLowerCase();
      if (nm) map[nm] = normOwner_(vals[r][2]);
    }
  } catch (e) {}
  return map;
}

function recomputeCommissions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_BOOKINGS);
  if (!sh) { SpreadsheetApp.getUi().alert('Den yparxei Bookings.'); return; }
  var last = sh.getLastRow(); if (last < 2) return;
  var vals = sh.getRange(2, 1, last - 1, TOTAL_COLS).getValues();
  var byName = masterByName_();   // fresko Owner_Type apo Master Properties (kata Residence)
  var changed = 0;
  for (var i = 0; i < vals.length; i++) {
    var before = vals[i].slice(27, 33).join('|');
    var mo = byName[String(vals[i][5] || '').trim().toLowerCase()];
    if (mo === 'Εταιρεία' || mo === 'Φυσικό' || mo === 'Δικό μας') vals[i][27] = mo;
    vals[i] = deriveRow_(vals[i]);
    if (vals[i].slice(27, 33).join('|') !== before) changed++;
  }
  sh.getRange(2, 1, vals.length, TOTAL_COLS).setValues(vals);
  logRow_('RECOMPUTE_COMM', changed, 'rows=' + vals.length);
  SpreadsheetApp.getUi().alert('Recompute DONE\nRows: ' + vals.length + '\nChanged: ' + changed);
}

// -- 3. DAILY AUTO-SYNC ----------------------------------------------------------

function createDailyTrigger() {
  removeDailyTrigger_();
  ScriptApp.newTrigger('syncBookingsAuto').timeBased().everyDays(1).atHour(AUTO_HOUR).create();
  SpreadsheetApp.getUi().alert('Auto-sync ON, daily ~' + AUTO_HOUR + ':00');
}
function removeDailyTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === 'syncBookingsAuto') ScriptApp.deleteTrigger(t); });
}
function disableDailyTrigger() { removeDailyTrigger_(); SpreadsheetApp.getUi().alert('Auto-sync OFF.'); }

// -- MENU ------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Master')
    .addItem('0a. Setup tabs (RESET Bookings)', 'setupTabs')
    .addItem('0b. Load rentals', 'loadRentals')
    .addItem('1. Test connection', 'testConnection')
    .addItem('1b. Diagnostics', 'diagnose403')
    .addItem('1c. Probe gr-taxes (raw API)', 'probeGrTaxes')
    .addItem('1d. Probe event (list vs detail)', 'probeEvent')
    .addItem('2. Sync bookings', 'syncBookings')
    .addItem('2b. Refresh taxes (all rows)', 'refreshTaxes')
    .addItem('2c. Full resync (oli i istoria — spania)', 'fullResync')
    .addItem('0c. Add Guests column (once)', 'addGuestsColumn')
    .addItem('0d. Add Comm_Rate% column (once)', 'addCommRateColumn')
    .addItem('0e. Add Guest_Phone column (once)', 'addPhoneColumn')
    .addItem('0f. Fix Direct_Cash columns (once)', 'fixDirectCashColumns')
    .addItem('0h. Clear DC taxes (once)', 'clearDcTaxes')
    .addItem('2c. Recompute commissions (local)', 'recomputeCommissions')
    .addSeparator()
    .addItem('3. Auto-sync ON', 'createDailyTrigger')
    .addItem('3. Auto-sync OFF', 'disableDailyTrigger')
    .addSeparator()
    .addItem('4. Push Owner Invoicing', 'pushInvoicing')
    .addItem('4b. Migrate από Clients (one-off)', 'migrateFromClients')
    .addSeparator()
    .addItem('9. Fix DC dates (one-off)', 'fixDcDates')
    .addToUi();
}

// ---------------------------------------------------------------------------
// fixDcDates (one-off, 2026-07): Diorthosi imerominion sto Direct_Cash.
// Oi imerominies eixan plirotheÍ os dd/mm/yyyy alla to sheet eixe US locale:
//   - an i "imera" itan <=12, to Sheets tin diavase os MINA (px 07/04 -> 4 Iouliou)
//   - an itan >12, emeine TEXT (oxi pragmatiki imerominia)
// I synartisi: (a) gyrizei ta swapped Dates (epalitheuontas me ti stili Month
// gia to check-in, kai me to "check_out < check_in" gia to check-out),
// (b) metatrepei ta TEXT dd/mm/yyyy se pragmatika Dates. Einai idempotent —
// an ksanatreksei, den peirazei tipota. META trekse "2. Sync" gia na
// ksanagraftoun ta kleidia sto Bookings (o katharismos orfanon kanei ta ypoloipa).
// SYMVOULI: allakse kai to locale tou arxeiou se Greece (File > Settings).

function fixDcDates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dc = ss.getSheetByName('Direct_Cash');
  if (!dc) { SpreadsheetApp.getUi().alert('Den yparxei Direct_Cash.'); return; }
  var last = dc.getLastRow(); if (last < 2) return;
  var rng = dc.getRange(2, 1, last - 1, 9);
  var vals = rng.getValues();
  var fixed = 0, log = [];

  function parseText(v) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v || '').trim());
    if (!m) return null;
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));   // dd/mm/yyyy
  }
  function fmt(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

  for (var i = 0; i < vals.length; i++) {
    if (!vals[i][5]) continue;                       // xoris Residence -> skip
    var month = Number(vals[i][1]) || 0;             // stili B: Month (o pragmatikos minas)
    var ci = vals[i][3], co = vals[i][4];

    // Check_in: Date me lathos mina (swap otan i "imera" tou == Month kai o "minas" tou != Month)
    if (ci instanceof Date) {
      var d = ci.getDate(), mo = ci.getMonth() + 1;
      if (month && d === month && mo !== month) {
        vals[i][3] = new Date(ci.getFullYear(), d - 1, mo);
        log.push('r' + (i + 2) + ' in: ' + fmt(ci) + ' -> ' + fmt(vals[i][3])); fixed++;
      }
    } else {
      var p = parseText(ci);
      if (p) { vals[i][3] = p; log.push('r' + (i + 2) + ' in: text -> ' + fmt(p)); fixed++; }
    }

    // Check_out: prota to text, meta elegxos "prin to check-in" (=> swapped)
    if (!(co instanceof Date)) {
      var p2 = parseText(co);
      if (p2) { vals[i][4] = p2; log.push('r' + (i + 2) + ' out: text -> ' + fmt(p2)); fixed++; co = p2; }
    }
    if (co instanceof Date && vals[i][3] instanceof Date && co < vals[i][3]) {
      var nd = new Date(co.getFullYear(), co.getDate() - 1, co.getMonth() + 1);
      vals[i][4] = nd;
      log.push('r' + (i + 2) + ' out: ' + fmt(co) + ' -> ' + fmt(nd)); fixed++;
    }
  }

  rng.setValues(vals);
  dc.getRange(2, 4, last - 1, 2).setNumberFormat('dd/MM/yyyy');
  logRow_('FIX_DC_DATES', fixed, log.join(' | '));
  SpreadsheetApp.getUi().alert('Fix DC dates DONE\nDiorthoseis: ' + fixed + (fixed ? '\n\n' + log.join('\n') : '') +
    '\n\nTora trekse "2. Sync" gia na ananeothoun ta kleidia sto Bookings.');
}
