/**
 * SOMNIO — Reconcile + Import (STANDALONE) — για νέα διάταξη Bookings
 * (Check_in idx3, Check_out idx4, Residence idx5, ...). Match: Property + check-in.
 * Μενού "Reconcile": Run reconcile | Import missing from Manual.
 */

var BOOKINGS_SHEET_ID = '17KWBOK5-z45N6goBaBfGXVWc0CBmxjBR5jFJp83V1gc';
var MANUAL_SHEET_ID   = '1ZT7JKnpe9aMHUFRJr7Lf7paNqKRW2SZn_ulZ6v_OgJM';   // 2026_Movie Collection (live, tab Clients)
var BOOKINGS_TAB      = 'Bookings';
var BK_TOTAL_COLS     = 42;

// Bookings column indices (0-based, νέα διάταξη)
var B = { code:2, checkin:3, checkout:4, res:5, platform:6, nights:7, guest:8, passport:10,
          booking:13, cleaning:14, payout:15, totalValue:16, guestPaid:17, bank:18, hsf:19, currency:20,
          net:21, vat:22, city:23, env:24, priceAade:25, gross:26, owner:27, comm20:29, commVat:30, commTotal:31,
          isVisible:33, cancelled:34, receipt:35, aade:36, aadeUp:37, paid:38, comments:39, eventId:40, synced:41, checkoutOut:4 };

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Reconcile')
    .addItem('Run reconcile', 'reconcile')
    .addItem('Import missing from Manual', 'importMissingFromManual')
    .addItem('Import Clients checkboxes (AADE/Receipt)', 'importClientsCheckboxes')
    .addToUi();
}

function num_(v){ return typeof v==='number' ? v : (v===''||v==null ? 0 : (parseFloat(v)||0)); }
function round2_(x){ return Math.round(x*100)/100; }
function pad2_(x){ x=String(x||'').replace(/\D/g,''); return x.length<2 ? ('0'+x) : x; }
function alert_(msg){ try { SpreadsheetApp.getUi().alert(msg); } catch (e) {} }
function boolFrom_(v){
  if (v === true) return true;
  if (v === false) return false;
  var s = String(v).trim().toUpperCase();
  return (s === 'TRUE' || s === 'OK' || s === 'YES' || s === 'ΝΑΙ' || s === 'NAI' || s === 'PAID' || s === 'X' || s === '✓');
}

function parseMoney_(v){
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  var s = String(v).replace(/€/g,'').replace(/\s/g,'');
  if (s === '' || s === '-') return 0;
  if (s.indexOf(',') > -1 && s.indexOf('.') > -1) s = s.replace(/\./g,'').replace(',', '.');
  else if (s.indexOf(',') > -1) s = s.replace(',', '.');
  var n = parseFloat(s); return isNaN(n) ? 0 : n;
}

function propKey_(name){
  var s = String(name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if (s.indexOf('yagha')>-1) return 'yagha';
  if (s.indexOf('thymari')>-1) return 'thymari';
  if (s.indexOf('windmill')>-1 || s.indexOf('orig')>-1) return 'origin';
  if (s.indexOf('jasper')>-1) return 'jasper';
  if (s.indexOf('piperi')>-1) return 'piperi';
  if (s.indexOf('islander')>-1) return 'islander';
  if (s.indexOf('caper')>-1) return 'caper';
  if (s.indexOf('peppermint')>-1) return (s.indexOf(' ii')>-1 || s.indexOf(' 2')>-1) ? 'peppermintii' : 'peppermint';
  if (s.indexOf('solasta')>-1) return 'solasta';
  if (s.indexOf('citrine')>-1) return 'citrine';
  if (s.indexOf('white')>-1) return 'whiteheaven';
  if (s.indexOf('mirabilia')>-1) return 'mirabilia';
  if (s.indexOf('vireya')>-1) return 'vireya';
  if (s.indexOf('pearl')>-1) return 'coralpearl';
  if (s.indexOf('blue coral')>-1) return (s.indexOf('2')>-1) ? 'bluecoral2' : 'bluecoral1';
  if (s.indexOf('fiora')>-1) return (s.indexOf(' ii')>-1 || /fiora\s*2/.test(s)) ? 'fioraii' : 'fiora1';
  if (s.indexOf('hara')>-1) return 'hara';
  if (s.indexOf('candia')>-1) return 'candia';
  if (s.indexOf('olea')>-1) return 'olea';
  return s.replace(/[^a-z0-9]/g,'');
}

var CANON_NAME = {
  yagha:'Villa Yagha', thymari:'Thymari Villa', origin:'ōrigín_the Cycladic windmill experience',
  jasper:'Jasper Cycladic Town-House', piperi:'Piperi - 2 Bedroom', islander:'Islander House',
  caper:'Caper', peppermint:'Peppermint', peppermintii:'Peppermint II', solasta:'Solasta',
  citrine:'Citrine', whiteheaven:'White Heaven Apt4-Cycladic Home', mirabilia:'Mirabilia',
  vireya:'Villa Vireya', coralpearl:'Coral Pearl', bluecoral1:'Blue Coral 1', bluecoral2:'Blue Coral 2',
  fiora1:'Fiora I', fioraii:'Fiora II', hara:'Villa Hara Naousa', candia:'Villa Candia', olea:'Casa Olea Villa'
};

function manCheckin_(dateStr){
  var parts = String(dateStr||'').trim().split('-');
  var first = (parts[0]||'').trim();
  if (first.indexOf('.') > -1) { var a = first.split('.'); return pad2_(a[1]) + '-' + pad2_(a[0]); }  // DD.MM-...
  // DD-DD.MM : start day = first· αν start > end -> check-in σε ΠΡΟΗΓΟΥΜΕΝΟ μήνα (σπάει μήνας)
  var startDay = first, endDay = '', month = '';
  for (var i=1;i<parts.length;i++){ if (parts[i].indexOf('.')>-1){ var b=parts[i].split('.'); endDay=b[0]; month=b[1]; break; } }
  var mNum = Number(month) || 0;
  if (mNum && Number(startDay) > Number(endDay)) { mNum -= 1; if (mNum < 1) mNum = 12; }
  return pad2_(mNum) + '-' + pad2_(startDay);
}
function hhCheckin_(v){
  if (Object.prototype.toString.call(v) === '[object Date]') return pad2_(v.getMonth()+1) + '-' + pad2_(v.getDate());
  var m = String(v||'').match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? (m[2] + '-' + m[3]) : '';
}

function findManual_(id) {
  var sheets = SpreadsheetApp.openById(id || MANUAL_SHEET_ID).getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var vals = sheets[s].getDataRange().getValues();
    for (var r = 0; r < Math.min(vals.length, 12); r++) {
      var j = vals[r].join('|');
      if (j.indexOf('Net Price') > -1 && j.indexOf('Total rental') > -1) {
        var H = vals[r];
        function mcol(name){ for (var i=0;i<H.length;i++){ if (String(H[i]).trim().toLowerCase().indexOf(name.toLowerCase())>-1) return i; } return -1; }
        return { vals: vals, head: r, C: {
          code:mcol('Confirmation'), date:mcol('Date'), res:mcol('Residence'), name:mcol('Name'),
          passport:mcol('Passport'), platform:mcol('Platform'), nights:mcol('Nights'),
          totalRental:mcol('Total rental'), cleaning:mcol('Cleaning fee'), hsf:mcol('Host Service Fee via Airbnb '),
          bank:mcol('Bank Charge'), clientPay:mcol('Client Payment'), payout:mcol('Host Payout'),
          net:mcol('Net Price'), priceAade:mcol('Price AADE'), vat:mcol('VAT'), city:mcol('City tax'),
          env:mcol('Enviromental'), c20:mcol('Commission *20'), cvat:mcol('Commission VAT'),
          aade:mcol('AADE'), aadeUp:mcol('AADE Uploaded'), receipt:mcol('Receipt'), paid:mcol('Paid'), comments:mcol('Comments')
        }};
      }
    }
  }
  return null;
}

// -- RECONCILE -----------------------------------------------------------------

function reconcile() {
  var bk = SpreadsheetApp.openById(BOOKINGS_SHEET_ID).getSheetByName(BOOKINGS_TAB);
  if (!bk) { alert_('Den vrethike to Bookings tab.'); return; }
  var hh = bk.getDataRange().getValues();
  var M = findManual_(); if (!M) { alert_('Den vrethike o manual pinakas.'); return; }
  var mv = M.vals, mhead = M.head, mC = M.C;

  var byKey = {};
  for (var i = mhead+1; i < mv.length; i++) {
    var row = mv[i];
    if (!row[mC.name] && !row[mC.res]) continue;
    var key = propKey_(row[mC.res]) + '|' + manCheckin_(row[mC.date]);
    if (key.charAt(0) !== '|') byKey[key] = row;
  }

  var out = [[ 'HH_no','Reservation ID','Residence','Check_in','Guest','Platform','Match',
    'Net M','Net H','ΔNet','VAT M','VAT H','ΔVAT','City M','City H','ΔCity',
    'Env M','Env H','ΔEnv','Payout M','Payout H','ΔPayout','Comm M','Comm H','ΔComm' ]];
  var used = {};
  for (var k = 1; k < hh.length; k++) {
    var h = hh[k];
    if (!h[B.eventId]) continue;
    if (h[B.isVisible] === false || String(h[B.isVisible]).toUpperCase() === 'FALSE') continue;   // skip cancelled
    var key2 = propKey_(h[B.res]) + '|' + hhCheckin_(h[B.checkin]);
    var m = byKey[key2];
    if (!m) { out.push([h[0],h[B.code],h[B.res],h[B.checkin],h[B.guest],h[B.platform],'HOSTHUB ONLY','','','','','','','','','','','','','','','','','','']); continue; }
    used[key2] = 1;
    var netM=parseMoney_(m[mC.net]), vatM=parseMoney_(m[mC.vat]), cityM=parseMoney_(m[mC.city]),
        envM=parseMoney_(m[mC.env]), payM=parseMoney_(m[mC.payout]), commM=parseMoney_(m[mC.c20]);   // net 20% (χωρις ΦΠΑ)
    var netH=num_(h[B.net]), vatH=num_(h[B.vat]), cityH=num_(h[B.city]), envH=num_(h[B.env]), payH=num_(h[B.payout]), commH=num_(h[B.comm20]);   // Comm_20pct
    out.push([h[0],h[B.code],h[B.res],h[B.checkin],h[B.guest],h[B.platform],'matched',
      netM,netH,round2_(netH-netM), vatM,vatH,round2_(vatH-vatM), cityM,cityH,round2_(cityH-cityM),
      envM,envH,round2_(envH-envM), payM,payH,round2_(payH-payM), commM,commH,round2_(commH-commM)]);
  }
  for (var i3 = mhead+1; i3 < mv.length; i3++) {
    var r3 = mv[i3];
    if (!r3[mC.name] && !r3[mC.res]) continue;
    var k3 = propKey_(r3[mC.res]) + '|' + manCheckin_(r3[mC.date]);
    if (k3.charAt(0) === '|' || used[k3]) continue;
    out.push(['', r3[mC.code], r3[mC.res], r3[mC.date], r3[mC.name], (r3[mC.platform]||''), 'MANUAL ONLY','','','','','','','','','','','','','','','','','','']);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rec = ss.getSheetByName('Reconciliation') || ss.insertSheet('Reconciliation');
  rec.clear();
  rec.getRange(1,1,out.length,out[0].length).setValues(out);
  rec.getRange(1,1,1,out[0].length).setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
  rec.setFrozenRows(1);
  alert_('Reconciliation OK: ' + (out.length-1) + ' grammes.');
}

// -- IMPORT CLIENTS CHECKBOXES (AADE / AADE Uploaded / Receipt) -----------------

function importClientsCheckboxes() {
  var bk = SpreadsheetApp.openById(BOOKINGS_SHEET_ID).getSheetByName(BOOKINGS_TAB);
  if (!bk) { alert_('Den vrethike to Bookings tab.'); return; }
  var hh = bk.getDataRange().getValues();

  var rowByKey = {}, rowByCode = {};
  for (var k = 1; k < hh.length; k++) {
    var h = hh[k];
    var key = propKey_(h[B.res]) + '|' + hhCheckin_(h[B.checkin]);
    if (key.charAt(0) !== '|') rowByKey[key] = k + 1;                 // sheet row number
    if (h[B.code]) rowByCode[String(h[B.code]).trim().toUpperCase()] = k + 1;
  }

  var M = findManual_();
  if (!M) { alert_('Den vrethike o Clients pinakas sto linked file.'); return; }
  var mv = M.vals, mhead = M.head, c = M.C;

  var updated = 0;
  for (var i = mhead + 1; i < mv.length; i++) {
    var m = mv[i];
    if (!m[c.res]) continue;
    var code = String(m[c.code] || '').trim().toUpperCase();
    var key = propKey_(m[c.res]) + '|' + manCheckin_(m[c.date]);
    var row = (code && rowByCode[code]) || rowByKey[key];
    if (!row) continue;
    // Bookings: Receipt=col36, AADE=col37, AADE_Uploaded=col38, Paid=col39
    bk.getRange(row, 36, 1, 4).setValues([[ boolFrom_(m[c.receipt]), boolFrom_(m[c.aade]), boolFrom_(m[c.aadeUp]), boolFrom_(m[c.paid]) ]]);
    updated++;
  }
  alert_('Checkboxes updated: ' + updated + ' kratiseis (Receipt/AADE/AADE_Uploaded).');
}

// -- IMPORT MISSING ------------------------------------------------------------

function importMissingFromManual() {
  var bkSS = SpreadsheetApp.openById(BOOKINGS_SHEET_ID);
  var bk = bkSS.getSheetByName(BOOKINGS_TAB);
  if (!bk) { alert_('Den vrethike to Bookings tab.'); return; }
  var hh = bk.getDataRange().getValues();

  var have = {}, haveCode = {};
  for (var k = 1; k < hh.length; k++) {
    var h = hh[k];
    have[propKey_(h[B.res]) + '|' + hhCheckin_(h[B.checkin])] = 1;
    if (h[B.code]) haveCode[String(h[B.code]).trim().toUpperCase()] = 1;
  }

  var ownerByProp = {};
  var mp = bkSS.getSheetByName('Master_Properties');
  if (mp) { var mvv = mp.getDataRange().getValues(); for (var r = 1; r < mvv.length; r++) if (mvv[r][0]) ownerByProp[propKey_(mvv[r][0])] = mvv[r][2] || ''; }

  var M = findManual_(); if (!M) { alert_('Den vrethike o manual pinakas.'); return; }
  var mv = M.vals, mhead = M.head, c = M.C;

  var rows = [];
  for (var i = mhead+1; i < mv.length; i++) {
    var m = mv[i];
    if (!m[c.res] || !m[c.name]) continue;
    var pk = propKey_(m[c.res]);
    var mmdd = manCheckin_(m[c.date]);
    if (mmdd.charAt(0) === '|') continue;
    var code = String(m[c.code]||'').trim().toUpperCase();
    if (have[pk + '|' + mmdd]) continue;
    if (code && haveCode[code]) continue;

    var iso = '2026-' + mmdd;
    var monthNum = Number(mmdd.split('-')[0]) || '';
    var nn = num_(m[c.nights]);
    var coDate = ''; var _co = new Date(iso); if (!isNaN(_co.getTime()) && nn > 0) { _co.setDate(_co.getDate() + nn); coDate = _co; }

    var row = [];
    for (var z = 0; z < BK_TOTAL_COLS; z++) row.push('');
    row[1]  = monthNum;
    row[2]  = m[c.code] || '';
    row[3]  = iso;                                // Check_in
    row[4]  = coDate;                             // Check_out
    row[5]  = CANON_NAME[pk] || m[c.res];         // Residence
    row[6]  = m[c.platform] || '';
    row[7]  = nn;
    row[8]  = m[c.name] || '';
    row[10] = m[c.passport] || '';
    row[13] = parseMoney_(m[c.totalRental]);
    row[14] = parseMoney_(m[c.cleaning]);
    row[15] = parseMoney_(m[c.payout]);
    row[17] = parseMoney_(m[c.clientPay]);
    row[18] = parseMoney_(m[c.bank]);
    row[19] = parseMoney_(m[c.hsf]);
    row[20] = 'EUR';
    row[21] = parseMoney_(m[c.net]);
    row[22] = parseMoney_(m[c.vat]);
    row[23] = parseMoney_(m[c.city]);
    row[24] = parseMoney_(m[c.env]);
    row[25] = parseMoney_(m[c.priceAade]);
    row[27] = ownerByProp[pk] || '';
    row[29] = parseMoney_(m[c.c20]);
    row[30] = parseMoney_(m[c.cvat]);
    row[31] = round2_(parseMoney_(m[c.c20]) + parseMoney_(m[c.cvat]));
    row[33] = true;
    row[35] = boolFrom_(m[c.receipt]);
    row[36] = boolFrom_(m[c.aade]);
    row[37] = boolFrom_(m[c.aadeUp]);
    row[38] = boolFrom_(m[c.paid]);
    row[39] = 'Imported from Manual' + (m[c.comments] ? ' | ' + m[c.comments] : '');
    row[40] = 'MAN-' + (m[0] || i);
    row[41] = new Date();
    rows.push(row);
  }

  if (!rows.length) { alert_('Den yparxoun missing kratiseis pros import.'); return; }
  var startRow = bk.getLastRow() + 1;
  bk.getRange(startRow, 1, rows.length, BK_TOTAL_COLS).setValues(rows);
  bk.getRange(startRow, 36, rows.length, 4).insertCheckboxes();   // Receipt/AADE/AADE_Uploaded/Paid (cols 36-39)
  var lr = bk.getLastRow();
  if (lr > 2) bk.getRange(2, 1, lr - 1, BK_TOTAL_COLS).sort({ column: 4, ascending: true });   // Check_in
  alert_('Import OK: ' + rows.length + ' kratiseis prostethikan.');
}
