/**
 * SOMNIO — Hosthub Sync (production, cursor-based)
 * Column order: Check_in, Check_out δίπλα-δίπλα (index 3 & 4).
 * Offset paging (το navigation.next του Hosthub είναι σπασμένο).
 * gr-taxes μόνο για νέες/αλλαγμένες. Daily auto-sync. Κόκκινο στις ακυρωμένες.
 */

var BASE            = 'https://app.hosthub.com/api/2019-03-01';
var TAB_BOOKINGS    = 'Bookings';
var TAB_MASTER      = 'Master_Properties';
var TAB_LOG         = 'Sync_Log';
var TAB_DIRECT      = 'Direct_Cash';
var COMMISSION_RATE = 0.20;
var COMMISSION_VAT  = 0.24;
var AUTO_HOUR       = 7;
var TIME_BUDGET_MS  = 240000;
var PAGE_LIMIT      = 300;
var MIN_DATE        = '2026-01-01';   // αγνόησε κρατήσεις με check-in πριν από αυτή
var SKIP_GUESTS     = ['tade'];       // owner-blocks / μη-κρατήσεις (guest name) προς εξαίρεση

var BOOK_COLS = [
  'no','Month','Reservation ID','Check_in','Check_out','Residence','Platform','Nights',
  'Guest name','ID_Type','Passport_AFM','Guest_Email','Guest_Country',
  'Booking value','Cleaning fee','Total payout','Total value','Guest paid','Payment charges','Service fee host','Currency',
  'Net_Price','VAT','City_Tax','Env_Fee','Price_AADE','Gross_Value',
  'Owner_Type','Comm_Base','Comm_20pct','Comm_VAT','Comm_Total','Company_Revenue',
  'is_visible','cancelled_at',
  'Receipt','AADE','AADE_Uploaded','Paid','Comments',
  'event_id','synced_at'
];
var TOTAL_COLS  = BOOK_COLS.length;   // 41
var MANUAL_FROM = 35;   // Receipt (0-based)
var MANUAL_TO   = 39;   // Comments (0-based)
var CHECK_FROM  = 36;   // 1-based col of Receipt
var CHECK_COUNT = 4;    // Receipt, AADE, AADE_Uploaded, Paid
var EVENT_IDX   = 40;   // 0-based event_id
var VIS_IDX     = 33;   // 0-based is_visible
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
  var headers = { 'Authorization': apiKey_(), 'Accept': 'application/json' };
  for (var attempt = 0; attempt < 6; attempt++) {
    var res = UrlFetchApp.fetch(url, { method: 'get', headers: headers, muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code === 429 || code === 503) { Utilities.sleep(2000 + attempt * 2000); continue; }   // rate-limit -> backoff & retry
    if (code >= 400) {
      var body = res.getContentText() || '(empty)';
      logRow_('API_ERROR', code, url + ' -> ' + body.slice(0, 300));
      throw new Error('HTTP ' + code + ' @ ' + url + '\n' + body.slice(0, 300));
    }
    return JSON.parse(res.getContentText());
  }
  throw new Error('HTTP 429 rate-limited (after retries) @ ' + url);
}

function money_(m) { return (m && typeof m.cents === 'number') ? m.cents / 100 : ''; }

function logRow_(action, count, detail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var lg = ss.getSheetByName(TAB_LOG) || ss.insertSheet(TAB_LOG);
    if (lg.getLastRow() === 0) lg.appendRow(['timestamp','action','count','detail']);
    lg.appendRow([new Date(), action, count, detail]);
  } catch (e) {}
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

function countryName_(code) { if (!code) return ''; return COUNTRIES[String(code).trim().toUpperCase()] || code; }

// -- DIAGNOSTICS ---------------------------------------------------------------

function diagnose403() {
  var ui = SpreadsheetApp.getUi();
  var raw = PropertiesService.getScriptProperties().getProperty('HOSTHUB_API_KEY');
  if (!raw) { ui.alert('No HOSTHUB_API_KEY.'); return; }
  var clean = apiKey_();
  ui.alert('Hosthub Diagnostics\n\nKey length : ' + clean.length + '\nKey preview: ' + clean.slice(0,4) + '...' + clean.slice(-4) +
    '\n\nGET /rentals\n- Authorization - ' + tryHeader_(BASE + '/rentals', { 'Authorization': clean, 'Accept': 'application/json' }));
}
function tryHeader_(url, headers) {
  try {
    var res = UrlFetchApp.fetch(url, { method:'get', headers: headers, muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code === 200) { var n=0; try{ n=(JSON.parse(res.getContentText()).data||[]).length; }catch(e){} return 'HTTP 200 OK (' + n + ' rentals)'; }
    return 'HTTP ' + code + ' body: ' + ((res.getContentText()||'').slice(0,120) || '(empty)');
  } catch (e) { return 'EXCEPTION: ' + e.message; }
}

// -- 0a. SETUP TABS ------------------------------------------------------------

function setupTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().deleteProperty('SYNC_RENTAL_IDX');
  var bk = ss.getSheetByName(TAB_BOOKINGS) || ss.insertSheet(TAB_BOOKINGS);
  bk.clear();
  bk.getRange(1,1,1,BOOK_COLS.length).setValues([BOOK_COLS]).setFontWeight('bold').setBackground('#2E75B6').setFontColor('#FFFFFF');
  bk.setFrozenRows(1);
  var mp = ss.getSheetByName(TAB_MASTER) || ss.insertSheet(TAB_MASTER);
  if (mp.getLastRow() === 0) {
    mp.getRange(1,1,1,MASTER_COLS.length).setValues([MASTER_COLS]).setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
    mp.setFrozenRows(1);
  }
  var dc = ss.getSheetByName(TAB_DIRECT) || ss.insertSheet(TAB_DIRECT);
  if (dc.getLastRow() === 0) {
    dc.getRange(1,1,1,BOOK_COLS.length).setValues([BOOK_COLS]).setFontWeight('bold').setBackground('#548235').setFontColor('#FFFFFF');
    dc.setFrozenRows(1);
  }

  var lg = ss.getSheetByName(TAB_LOG) || ss.insertSheet(TAB_LOG);
  if (lg.getLastRow() === 0) lg.appendRow(['timestamp','action','count','detail']);
  SpreadsheetApp.getUi().alert('Tabs OK. Next: Hosthub -> 0b. Load rentals');
}

// -- MIGRATE: μεταφορά της Check_out δίπλα στο Check_in (χωρις rebuild) ----------

function migrateCheckoutColumn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_BOOKINGS);
  if (!sh) { SpreadsheetApp.getUi().alert('No Bookings tab.'); return; }
  var lastCol = sh.getLastColumn();
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var coIdx = header.indexOf('Check_out');   // 0-based, αν υπάρχει (από παλιά end-append)
  if (coIdx === -1) {
    sh.insertColumnBefore(5);                 // δεν υπάρχει -> βάλε κενή στη θέση 5
  } else if (coIdx + 1 !== 5) {
    sh.moveColumns(sh.getRange(1, coIdx + 1, sh.getMaxRows(), 1), 5);   // μετακίνησε στη θέση 5
  }
  sh.getRange(1, 1, 1, BOOK_COLS.length).setValues([BOOK_COLS]);        // header (rename + σειρά)
  var last = sh.getLastRow();
  if (last >= 2) {
    var n = last - 1;
    var ci = sh.getRange(2, 4, n, 1).getValues();   // Check_in
    var ni = sh.getRange(2, 8, n, 1).getValues();   // Nights (col 8 τώρα)
    var co = sh.getRange(2, 5, n, 1).getValues();   // Check_out
    var out = [];
    for (var i = 0; i < n; i++) {
      if (co[i][0]) { out.push([co[i][0]]); continue; }
      var d = ci[i][0], nn = Number(ni[i][0]) || 0, val = '';
      var dd = (d instanceof Date) ? new Date(d.getTime()) : (d ? new Date(d) : null);
      if (dd && !isNaN(dd.getTime()) && nn > 0) { dd.setDate(dd.getDate() + nn); val = dd; }
      out.push([val]);
    }
    sh.getRange(2, 5, n, 1).setValues(out);
  }
  SpreadsheetApp.getUi().alert('Check_out δίπλα στο Check_in ✓');
}

// -- 0b. LOAD RENTALS ----------------------------------------------------------

function loadRentals() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mp = ss.getSheetByName(TAB_MASTER);
  if (!mp) { SpreadsheetApp.getUi().alert('Run 0a first!'); return; }
  var rentals = (apiGet_('/rentals').data) || [];
  var last = mp.getLastRow();
  var existing = last > 1 ? mp.getRange(2,1,last-1,MASTER_COLS.length).getValues() : [];
  var byId = {};
  for (var i=0;i<existing.length;i++) { var id = existing[i][1]; if (id) byId[String(id)] = i; }
  var added = 0;
  rentals.forEach(function(r){
    var id = String(r.id||'');
    if (byId.hasOwnProperty(id)) { mp.getRange(2 + byId[id], 1).setValue(r.name||''); }
    else { mp.appendRow([r.name||'', r.id||'', '?','','','','','','',8,'?','TRUE','']); added++; }
  });
  applyMasterDropdowns_(mp);
  logRow_('LOAD_RENTALS', rentals.length, 'added=' + added);
  SpreadsheetApp.getUi().alert(rentals.length + ' rentals (new: ' + added + '). Fill Owner_Type + details in Master.');
}

function applyMasterDropdowns_(mp) {
  var last = mp.getLastRow(); if (last < 2) return;
  var n = last - 1;
  mp.getRange(2, 3, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Εταιρεία','Φυσικό','Δικό μας'], true).setAllowInvalid(false).build());
  mp.getRange(2, 11, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Τιμολόγιο','Απόδειξη','Δεν εφαρμόζεται'], true).setAllowInvalid(true).build());
}

// -- 1. TEST -------------------------------------------------------------------

function testConnection() {
  var rentals = (apiGet_('/rentals').data) || [];
  SpreadsheetApp.getUi().alert('OK ' + rentals.length + ' rentals:\n' + rentals.slice(0,6).map(function(r){return r.name;}).join(', '));
}

// -- 2. SYNC (cursor/offset, incremental) --------------------------------------

function syncBookings(silent) {
  var start = Date.now();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_BOOKINGS);
  if (!sh) { if(!silent) SpreadsheetApp.getUi().alert('Run Setup first!'); return; }

  var master = loadMaster_(ss);
  var last = sh.getLastRow();
  var existing = last > 1 ? sh.getRange(2,1,last-1,TOTAL_COLS).getValues() : [];
  var byId = {}, maxNo = 0;
  for (var i=0;i<existing.length;i++) {
    var id = existing[i][EVENT_IDX];
    if (id) byId[id] = { i: i, vals: existing[i] };
    var no = Number(existing[i][0]); if (!isNaN(no) && no > maxNo) maxNo = no;
  }

  var props = PropertiesService.getScriptProperties();
  var rentals = (apiGet_('/rentals').data) || [];
  var ri = parseInt(props.getProperty('SYNC_RENTAL_IDX') || '0', 10) || 0;
  var toAppend = [], updated = 0, added = 0, stopped = false, FLUSH = 50, seen = {};
  function flush(){ if (!toAppend.length) return; sh.getRange(sh.getLastRow()+1, 1, toAppend.length, TOTAL_COLS).setValues(toAppend); added += toAppend.length; toAppend = []; }

  for (; ri < rentals.length; ri++) {
    if (Date.now() - start > TIME_BUDGET_MS) { stopped = true; break; }
    var rid = rentals[ri].id; if (!rid) continue;
    var d = fetchRentalEvents_(rid);
    for (var k = 0; k < d.length; k++) {
      if (Date.now() - start > TIME_BUDGET_MS) { stopped = true; break; }
      var e = d[k];
      if (e.type !== 'CalendarEventBooking' && e.type !== 'Booking') continue;
      if (e.date_from && e.date_from < MIN_DATE) continue;   // μόνο check-in >= MIN_DATE (2026+)
      if (e.date_from && e.date_from > today) continue;      // μόνο check-in <= σήμερα (όχι μελλοντικές)
      if (SKIP_GUESTS.indexOf(String(e.guest_name || '').trim().toLowerCase()) > -1) continue;   // owner-blocks
      if (seen[e.id]) continue; seen[e.id] = 1;
      var ex = byId[e.id];
      if (ex && !baseChanged_(ex.vals, e)) continue;
      var gr = {};
      try { gr = apiGet_('/calendar-events/' + e.id + '/calendar-event-gr-taxes') || {}; } catch(err) {}
      var man = ex ? ex.vals.slice(MANUAL_FROM, MANUAL_TO + 1) : [false,false,false,false,''];
      var no  = ex ? ex.vals[0] : (++maxNo);
      var row = buildRow_(e, gr, master, no, man);
      if (ex) { sh.getRange(2 + ex.i, 1, 1, TOTAL_COLS).setValues([row]); updated++; }
      else { toAppend.push(row); if (toAppend.length >= FLUSH) flush(); }
    }
    if (stopped) break;
  }

  flush();
  if (stopped) props.setProperty('SYNC_RENTAL_IDX', String(ri));
  else props.deleteProperty('SYNC_RENTAL_IDX');
  var dcAdded = mergeDirectCash_(ss, sh);
  var lr = sh.getLastRow();
  if (lr > 2) sh.getRange(2, 1, lr - 1, TOTAL_COLS).sort({ column: 4, ascending: true });   // Check_in
  applyBookingCheckboxes_(sh);
  highlightCancelled_(sh);
  if (lr > 2) sh.getRange(2, VIS_IDX + 1, lr - 1, 1).clearDataValidations();   // is_visible: καθαρό TRUE/FALSE (όχι checkbox)
  logRow_('SYNC', updated + added, 'rentals=' + ri + '/' + rentals.length + ' updated=' + updated + ' added=' + added + (stopped ? ' PARTIAL' : ' DONE'));
  if (!silent) SpreadsheetApp.getUi().alert('Sync ' + (stopped ? 'PARTIAL — run again' : 'OK — full pass done') + '\nRentals: ' + ri + '/' + rentals.length + '\nUpdated: ' + updated + '\nNew: ' + added + '\nDirect Cash: ' + dcAdded);
}

function syncBookingsAuto() { syncBookings(true); }

function baseChanged_(o, e) {
  if (String(o[13]) !== String(money_(e.booking_value)))    return true;
  if (String(o[15]) !== String(money_(e.total_payout)))     return true;
  if (String(o[19]) !== String(money_(e.service_fee_host))) return true;
  if (String(o[33]) !== String(e.is_visible))               return true;
  return false;
}

function buildRow_(e, gr, master, no, man) {
  var m = master[String((e.rental && e.rental.id) || '')] || {};
  var ownerType = m.ownerType || '';
  var net   = money_(gr.net_value);
  var gross = money_(gr.gross_booking_value);
  var env   = money_(gr.climate_tax);
  var bank  = money_(e.payment_charges);
  var n_    = function(v){ return v === '' ? 0 : v; };
  var bankNum = n_(bank);
  var sfh = money_(e.service_fee_host); var chan = (sfh === '') ? 0 : Math.abs(sfh);   // channel commission
  var base='', comm='', commVat='', commTotal='';
  if (ownerType === 'Εταιρεία') { var nv = net !== '' ? net : money_(e.booking_value); if (nv !== '') base = nv - bankNum - chan; }
  else if (ownerType === 'Φυσικό') { var gv = gross !== '' ? gross : (net !== '' ? net : money_(e.booking_value)); if (gv !== '') base = gv - n_(env) - bankNum - chan; }
  if (base !== '') { comm = base * COMMISSION_RATE; commVat = comm * COMMISSION_VAT; commTotal = comm + commVat; }

  var compRev = '';
  if (ownerType === 'Δικό μας') {
    var tv = money_(e.total_value);
    if (tv !== '') compRev = Math.round((n_(tv) - chan - n_(money_(gr.vat)) - n_(money_(gr.accommodation_tax)) - n_(money_(gr.climate_tax)) - bankNum) * 100) / 100;
  } else if (comm !== '') {
    compRev = comm;   // Comm_20pct (διαχειριζόμενα)
  }

  return [
    no,
    e.date_from ? Number(e.date_from.split('-')[1]) : '',
    e.reservation_id || '', e.date_from || '', e.date_to || '',
    (e.rental && e.rental.name) || '', (e.source && e.source.name) || '', nights_(e),
    e.guest_name || '', e.identification_type || '', e.identification_number || '',
    e.guest_email || '', countryName_(e.guest_country),
    money_(e.booking_value), money_(e.cleaning_fee),
    money_(e.total_payout), money_(e.total_value), money_(e.guest_paid),
    bank, money_(e.service_fee_host), (e.rental && e.rental.currency) || '',
    net, money_(gr.vat), money_(gr.accommodation_tax),
    money_(gr.climate_tax), money_(gr.aade_value), money_(gr.gross_booking_value),
    ownerType, base, comm, commVat, commTotal, compRev,
    e.is_visible, (e.cancelled_at ? new Date(e.cancelled_at * 1000) : ''),
    man[0], man[1], man[2], man[3], man[4],
    e.id, new Date()
  ];
}

function applyBookingCheckboxes_(sh) {
  var last = sh.getLastRow(); if (last < 2) return;
  sh.getRange(2, CHECK_FROM, last - 1, CHECK_COUNT).insertCheckboxes();
}

function highlightCancelled_(sh) {
  var last = sh.getLastRow(); if (last < 2) return;
  var n = last - 1;
  var vis = sh.getRange(2, VIS_IDX + 1, n, 1).getValues();   // is_visible column
  var bg = [];
  for (var i = 0; i < n; i++) {
    var cancelled = (vis[i][0] === false || vis[i][0] === 'FALSE');
    var row = [];
    for (var j = 0; j < TOTAL_COLS; j++) row.push(cancelled ? '#F4CCCC' : '#FFFFFF');
    bg.push(row);
  }
  sh.getRange(2, 1, n, TOTAL_COLS).setBackgrounds(bg);
}

function fetchRentalEvents_(rid) {
  var all = [], url = '/rentals/' + rid + '/calendar-events?is_visible=all&limit=400', guard = 0;
  while (url && guard < 15) {
    var page = apiGet_(url);
    if (page.data) all = all.concat(page.data);
    url = (page.navigation && page.navigation.previous) ? page.navigation.previous : null;   // older
    guard++;
  }
  return all;
}

// -- DIRECT CASH (manual tab -> merge into Bookings) ---------------------------

function dcKey_(res, checkin) {
  var s = (Object.prototype.toString.call(checkin) === '[object Date]')
    ? Utilities.formatDate(checkin, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(checkin || '');
  return 'DC|' + String(res || '').toLowerCase().replace(/\s/g, '') + '|' + s;
}

// Υπολογίζει Comm_Base/20pct/VAT/Total + Company_Revenue από τα raw πεδία της γραμμής.
function deriveRow_(r) {
  var num = function(v){ var x = Number(v); return isNaN(x) ? 0 : x; };
  var ownerType = r[27] || '';
  var net = num(r[21]), gross = num(r[26]), env = num(r[24]), bank = num(r[18]),
      chan = Math.abs(num(r[19])), tv = num(r[16]), vat = num(r[22]), city = num(r[23]);
  var base='', comm='', commVat='', commTotal='', compRev='';
  if (ownerType === 'Εταιρεία') { base = net - bank - chan; }
  else if (ownerType === 'Φυσικό') { base = (gross || net) - env - bank - chan; }
  if (base !== '') {
    comm = Math.round(base * COMMISSION_RATE * 100) / 100;
    commVat = Math.round(comm * COMMISSION_VAT * 100) / 100;
    commTotal = Math.round((comm + commVat) * 100) / 100;
  }
  if (ownerType === 'Δικό μας') { compRev = Math.round((tv - chan - vat - city - env - bank) * 100) / 100; }
  else if (comm !== '') { compRev = comm; }
  r[28] = base; r[29] = comm; r[30] = commVat; r[31] = commTotal; r[32] = compRev;
  return r;
}

function mergeDirectCash_(ss, sh) {
  var dc = ss.getSheetByName(TAB_DIRECT);
  if (!dc) return 0;
  var last = dc.getLastRow(); if (last < 2) return 0;
  var rows = dc.getRange(2, 1, last - 1, TOTAL_COLS).getValues();
  var bkLast = sh.getLastRow();
  var bkVals = bkLast > 1 ? sh.getRange(2, 1, bkLast - 1, TOTAL_COLS).getValues() : [];
  var byId = {};
  for (var i = 0; i < bkVals.length; i++) { var id = bkVals[i][EVENT_IDX]; if (id) byId[id] = i; }
  var added = 0;
  rows.forEach(function(r){
    if (!r[5]) return;                                  // χωρίς Residence -> skip
    var id = r[EVENT_IDX] || dcKey_(r[5], r[3]);
    r[EVENT_IDX] = id;
    r[EVENT_IDX + 1] = new Date();                      // synced_at
    r = deriveRow_(r);
    if (byId.hasOwnProperty(id)) { sh.getRange(2 + byId[id], 1, 1, TOTAL_COLS).setValues([r]); }
    else { sh.appendRow(r); added++; }
  });
  return added;
}

function loadMaster_(ss) {
  var sh = ss.getSheetByName(TAB_MASTER);
  var map = {};
  if (!sh) return map;
  var vals = sh.getDataRange().getValues();
  for (var r=1; r<vals.length; r++) { var id = vals[r][1]; if (id) map[String(id)] = { ownerType: vals[r][2]||'', issueInvoice: vals[r][10]||'' }; }
  return map;
}

// -- 5. REMOVE DUPLICATES (same event_id, keep last) ---------------------------

function removeDuplicates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_BOOKINGS);
  if (!sh) { SpreadsheetApp.getUi().alert('No Bookings tab.'); return; }
  var last = sh.getLastRow();
  if (last < 3) { SpreadsheetApp.getUi().alert('No data.'); return; }
  var vals = sh.getRange(2, 1, last - 1, TOTAL_COLS).getValues();
  var lastRowById = {};
  for (var i = 0; i < vals.length; i++) {
    var id = vals[i][EVENT_IDX];
    if (id) lastRowById[id] = i;            // κρατάμε την ΤΕΛΕΥΤΑΙΑ εμφάνιση
  }
  var toDelete = [];
  for (var j = 0; j < vals.length; j++) {
    var id2 = vals[j][EVENT_IDX];
    if (id2 && lastRowById[id2] !== j) toDelete.push(j + 2);   // sheet row
  }
  for (var d = toDelete.length - 1; d >= 0; d--) sh.deleteRow(toDelete[d]);   // από κάτω προς τα πάνω
  logRow_('DEDUP', toDelete.length, 'removed=' + toDelete.length);
  SpreadsheetApp.getUi().alert('Removed ' + toDelete.length + ' duplicate row(s).');
}

// -- DAILY AUTO-SYNC -----------------------------------------------------------

function createDailyTrigger() {
  removeDailyTrigger_();
  ScriptApp.newTrigger('syncBookingsAuto').timeBased().everyDays(1).atHour(AUTO_HOUR).create();
  SpreadsheetApp.getUi().alert('Auto-sync ON, daily ~' + AUTO_HOUR + ':00');
}
function removeDailyTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === 'syncBookingsAuto') ScriptApp.deleteTrigger(t); });
}
function disableDailyTrigger() { removeDailyTrigger_(); SpreadsheetApp.getUi().alert('Auto-sync OFF.'); }

// -- MENU ----------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Hosthub')
    .addItem('0a. Setup tabs', 'setupTabs')
    .addItem('0b. Load rentals', 'loadRentals')
    .addItem('1. Test connection', 'testConnection')
    .addItem('1b. Diagnostics', 'diagnose403')
    .addItem('2. Sync bookings', 'syncBookings')
    .addItem('4. Move Check_out next to Check_in (once)', 'migrateCheckoutColumn')
    .addItem('5. Remove duplicates', 'removeDuplicates')
    .addSeparator()
    .addItem('3. Auto-sync ON', 'createDailyTrigger')
    .addItem('3. Auto-sync OFF', 'disableDailyTrigger')
    .addToUi();
}
