/**
 * SOMNIO — Reconcile (ΞΕΧΩΡΙΣΤΟ αρχείο, one-off)
 * Συγκρίνει το χειροκίνητο αρχείο (Movie Collection) με το Hosthub Bookings.
 * Δεν τρέχει ποτέ αυτόματα. ΔΕΝ επηρεάζει το καθημερινό sync.
 *
 * ΠΩΣ ΤΡΕΧΕΙ: στον Apps Script editor, διάλεξε τη συνάρτηση "reconcile"
 * από το dropdown (πάνω) και πάτα Run. Γράφει tab "Reconciliation".
 * (Πρέπει να είναι στο ΙΔΙΟ project με το Hosthub_Sync — χρησιμοποιεί τα
 *  TAB_BOOKINGS / logRow_ από εκεί.)
 */

var MANUAL_SHEET_ID = '1L1GsgwXdGvP3gY3zIlyP_wop1KJOn5r6XrSch9vaKjA';  // "Copy of 2026_Movie Collection"

function num_(v){ return typeof v==='number' ? v : (v===''||v==null ? 0 : (parseFloat(v)||0)); }
function round2_(x){ return Math.round(x*100)/100; }
function pad2_(x){ x=String(x||'').replace(/\D/g,''); return x.length<2 ? ('0'+x) : x; }

function parseMoney_(v){
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  var s = String(v).replace(/€/g,'').replace(/\s/g,'');
  if (s === '' || s === '-') return 0;
  if (s.indexOf(',') > -1 && s.indexOf('.') > -1) s = s.replace(/\./g,'').replace(',', '.');
  else if (s.indexOf(',') > -1) s = s.replace(',', '.');
  var n = parseFloat(s); return isNaN(n) ? 0 : n;
}
function normName_(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
}
function manKey_(dateStr, month){
  var day = (String(dateStr||'').match(/\d+/) || [''])[0];
  var mo  = (String(month||'').match(/\d+/) || [''])[0];
  return pad2_(mo) + '-' + pad2_(day);
}
function hhKey_(dateStr){
  var m = String(dateStr||'').match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? (m[1] + '-' + m[2]) : '';
}
function alert_(msg){ try { SpreadsheetApp.getUi().alert(msg); } catch (e) {} }

function reconcile() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bk = ss.getSheetByName(TAB_BOOKINGS);
  if (!bk) { alert_('Den yparxei Bookings tab.'); return; }
  var hh = bk.getDataRange().getValues();   // row 0 = header

  // Find the manual ledger tab (header row containing "Net Price" + "Total rental")
  var man = SpreadsheetApp.openById(MANUAL_SHEET_ID);
  var mv = null, mhead = -1, sheets = man.getSheets();
  for (var s = 0; s < sheets.length && !mv; s++) {
    var vals = sheets[s].getDataRange().getValues();
    for (var r = 0; r < Math.min(vals.length, 12); r++) {
      var j = vals[r].join('|');
      if (j.indexOf('Net Price') > -1 && j.indexOf('Total rental') > -1) { mv = vals; mhead = r; break; }
    }
  }
  if (!mv) { alert_('Den vrethike o manual pinakas (Net Price).'); return; }

  var H = mv[mhead];
  function mcol(name){ for (var i=0;i<H.length;i++){ if (String(H[i]).trim().toLowerCase().indexOf(name.toLowerCase())>-1) return i; } return -1; }
  var mC = { code:mcol('Confirmation'), date:mcol('Date'), res:mcol('Residence'), name:mcol('Name'), month:mcol('Month'),
             net:mcol('Net Price'), vat:mcol('VAT'), city:mcol('City tax'), env:mcol('Enviromental'),
             payout:mcol('Host Payout'), c20:mcol('Commission *20'), cvat:mcol('Commission VAT') };

  var byCode = {}, byNameDate = {};
  for (var i = mhead+1; i < mv.length; i++) {
    var row = mv[i];
    if (!row[mC.name] && !row[mC.code]) continue;
    var code = String(row[mC.code]||'').trim().toUpperCase();
    if (code) byCode[code] = row;
    byNameDate[ normName_(row[mC.name]) + '|' + manKey_(row[mC.date], row[mC.month]) ] = row;
  }

  var out = [[ 'HH_no','Reservation ID','Residence','Date','Guest','Match',
    'Net M','Net H','ΔNet','VAT M','VAT H','ΔVAT','City M','City H','ΔCity',
    'Env M','Env H','ΔEnv','Payout M','Payout H','ΔPayout','Comm M','Comm H','ΔComm' ]];
  var usedCode = {}, usedKey = {};

  for (var k = 1; k < hh.length; k++) {
    var h = hh[k];
    if (!h[38]) continue;                       // skip empty rows (no event_id)
    var code2 = String(h[2]||'').trim().toUpperCase();
    var m = null, how = '';
    if (code2 && byCode[code2]) { m = byCode[code2]; how = 'code'; usedCode[code2] = 1; }
    else {
      var key = normName_(h[7]) + '|' + hhKey_(h[3]);
      if (key.charAt(0) !== '|' && byNameDate[key]) { m = byNameDate[key]; how = 'name+date'; usedKey[key] = 1; }
    }
    if (!m) { out.push([h[0],h[2],h[4],h[3],h[7],'HOSTHUB ONLY','','','','','','','','','','','','','','','','','','']); continue; }

    var netM=parseMoney_(m[mC.net]), vatM=parseMoney_(m[mC.vat]), cityM=parseMoney_(m[mC.city]),
        envM=parseMoney_(m[mC.env]), payM=parseMoney_(m[mC.payout]),
        commM=parseMoney_(m[mC.c20]) + parseMoney_(m[mC.cvat]);
    var netH=num_(h[20]), vatH=num_(h[21]), cityH=num_(h[22]), envH=num_(h[23]), payH=num_(h[14]), commH=num_(h[30]);
    out.push([h[0],h[2],h[4],h[3],h[7],how,
      netM,netH,round2_(netH-netM), vatM,vatH,round2_(vatH-vatM), cityM,cityH,round2_(cityH-cityM),
      envM,envH,round2_(envH-envM), payM,payH,round2_(payH-payM), commM,commH,round2_(commH-commM)]);
  }

  // manual rows not matched
  for (var i3 = mhead+1; i3 < mv.length; i3++) {
    var row3 = mv[i3];
    if (!row3[mC.name] && !row3[mC.code]) continue;
    var c3 = String(row3[mC.code]||'').trim().toUpperCase();
    var k3 = normName_(row3[mC.name]) + '|' + manKey_(row3[mC.date], row3[mC.month]);
    if ((c3 && usedCode[c3]) || usedKey[k3]) continue;
    out.push(['', row3[mC.code], row3[mC.res], row3[mC.date], row3[mC.name], 'MANUAL ONLY','','','','','','','','','','','','','','','','','','']);
  }

  var rec = ss.getSheetByName('Reconciliation') || ss.insertSheet('Reconciliation');
  rec.clear();
  rec.getRange(1,1,out.length,out[0].length).setValues(out);
  rec.getRange(1,1,1,out[0].length).setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
  rec.setFrozenRows(1);
  try { logRow_('RECONCILE', out.length-1, 'done'); } catch (e) {}
  alert_('Reconciliation OK: ' + (out.length-1) + ' grammes sto tab "Reconciliation".');
}
