/**
 * SOMNIO — Pricing Plans 2027 (bound στο "File for Pricing Plans 2027")
 * Διαβάζει ΑΠΟ ΤΟ MASTER FILE (όχι Hosthub, όχι IMPORTRANGE).
 * Μενού: Pricing -> Refresh from Master File. Γράφει:
 *   - Summary        : ποσά σεζόν 01/04-31/10 ανά property (incl. μελλοντικές, ενεργές μόνο)
 *   - Occupancy_2026 : πληρότητα ακίνητο × μήνα (νύχτες σπασμένες ανά μήνα) + ΣΕΖΟΝ % + σύνολο
 * Δεν χρειάζεται API key. Δεν αγγίζει το Master File (read-only).
 */

var MASTER_ID    = '1XIZMBmY8aXxPiKR8y4vZyGICZN6MeS5rtRo01LW92UE';   // Somnio — Master File
var BOOKINGS_TAB = 'Bookings';
var SEASON_START = new Date(2026, 3, 1);    // 1 Apr 2026
var SEASON_END_X = new Date(2026, 10, 1);   // exclusive (1 Nov 2026)
var SEASON_DAYS  = 214;

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Pricing')
    .addItem('Refresh from Master File', 'refreshFromMaster')
    .addToUi();
}

function toDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' && v) {
    var m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    var m2 = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m2) return new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1]));
  }
  return null;
}
function num_(v) { var x = Number(v); return isNaN(x) ? 0 : x; }

// Κανονικοποίηση ονομάτων ακινήτων (Candia = Villa Candia, κενά, παραλλαγές)
function propKey_(name){
  var s = String(name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if (s.indexOf('yagha')>-1) return 'yagha';
  if (s.indexOf('thymari')>-1) return 'thymari';
  if (s.indexOf('windmill')>-1 || s.indexOf('orig')>-1) return 'origin';
  if (s.indexOf('jasper')>-1) return 'jasper';
  if (s.indexOf('piperi')>-1) return 'piperi';
  if (s.indexOf('islander')>-1) return 'islander';
  if (s.indexOf('caper')>-1) return 'caper';
  if (s.indexOf('pepperleaf')>-1) return 'pepperleaf';
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
  if (s.indexOf('beaufort')>-1) return 'beaufort';
  return s.replace(/[^a-z0-9]/g,'');
}
var CANON_NAME = {
  yagha:'Villa Yagha', thymari:'Thymari Villa', origin:'ōrigín_the Cycladic windmill experience',
  jasper:'Jasper Cycladic Town-House', piperi:'Piperi - 2 Bedroom', islander:'Islander House',
  caper:'Caper', peppermint:'Peppermint', peppermintii:'Peppermint II', solasta:'Solasta',
  citrine:'Citrine', whiteheaven:'White Heaven Apt4-Cycladic Home', mirabilia:'Mirabilia',
  vireya:'Villa Vireya', coralpearl:'Coral Pearl', bluecoral1:'Blue Coral 1', bluecoral2:'Blue Coral 2',
  fiora1:'Fiora I', fioraii:'Fiora II', hara:'Villa Hara Naousa', candia:'Villa Candia', olea:'Casa Olea Villa',
  pepperleaf:'Walk to Naousa | 1BR Sea View | Pepperleaf', beaufort:'Isterni | Sea View | Villa Beaufort'
};
function canonName_(name){ var k = propKey_(name); return CANON_NAME[k] || String(name||'').trim(); }
function parseMoney_(v) {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  var s = String(v).replace(/€/g, '').replace(/\s/g, '');
  if (s === '' || s === '-') return 0;
  if (s.indexOf(',') > -1 && s.indexOf('.') > -1) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.indexOf(',') > -1) s = s.replace(',', '.');
  var n = parseFloat(s); return isNaN(n) ? 0 : n;
}
function r2_(x) { return Math.round(x * 100) / 100; }

function refreshFromMaster() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var master = SpreadsheetApp.openById(MASTER_ID);
  var tabs = [BOOKINGS_TAB, 'Direct_Cash'];   // και τα δύο, με dedup ανά ακίνητο+check-in
  var months = [4,5,6,7,8,9,10];
  var daysIn = {4:30,5:31,6:30,7:31,8:31,9:30,10:31};
  var occ = {}, tot = {}, seen = {};

  for (var tI = 0; tI < tabs.length; tI++) {
    var bk = master.getSheetByName(tabs[tI]);
    if (!bk) continue;
    var vals = bk.getDataRange().getValues();
    if (vals.length < 2) continue;

    // Εύρεση στηλών με βάση το όνομα (ανά tab, ανθεκτικό σε αλλαγές διάταξης)
    var H = vals[0];
    var col = function(name) {
      for (var i = 0; i < H.length; i++) if (String(H[i]).trim().toLowerCase() === name.toLowerCase()) return i;
      for (var j = 0; j < H.length; j++) if (String(H[j]).trim().toLowerCase().indexOf(name.toLowerCase()) > -1) return j;
      return -1;
    };
    var C = {
      ci: col('Check_in'), co: col('Check_out'), res: col('Residence'), nights: col('Nights'),
      bv: col('Booking value'), tv: col('Total value'), payout: col('Total payout'),
      pc: col('Payment charges'), sfh: col('Service fee host'),
      net: col('Net_Price'), vat: col('VAT'), city: col('City_Tax'), env: col('Env_Fee'),
      gross: col('Gross_Value'), comm20: col('Comm_20pct'), vis: col('is_visible'), eid: col('event_id')
    };
    if (C.ci < 0 || C.res < 0) continue;

    for (var r = 1; r < vals.length; r++) {
      var row = vals[r];
      var res = canonName_(row[C.res]);
      if (!res) continue;
      var vis = C.vis > -1 ? row[C.vis] : true;
      if (vis === false || String(vis).toUpperCase() === 'FALSE') continue;   // skip cancelled
      var ci = toDate_(row[C.ci]), co = toDate_(row[C.co]);
      if (!ci) continue;

      // dedup μεταξύ tabs: ΠΑΝΤΑ κλειδί ακίνητο + ημερομηνία check-in
      var key = propKey_(res) + '|' + ci.getFullYear() + '-' + (ci.getMonth()+1) + '-' + ci.getDate();
      if (seen[key]) continue;
      seen[key] = 1;

      if (!occ[res]) { occ[res] = {4:0,5:0,6:0,7:0,8:0,9:0,10:0}; }
      if (!tot[res]) { tot[res] = { nights:0, bv:0, tv:0, payout:0, sfh:0, pc:0, net:0, vat:0, city:0, env:0, gross:0, comm20:0 }; }

      // ---- Occupancy: νύχτες σπασμένες ανά μήνα, μέσα στη σεζόν ----
      if (co && co > ci) {
        for (var d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
          if (d < SEASON_START || d >= SEASON_END_X) continue;
          occ[res][d.getMonth() + 1]++;
        }
      }

      // ---- Ποσά: κρατήσεις με check-in μέσα στη σεζόν ----
      if (ci >= SEASON_START && ci < SEASON_END_X) {
        var t = tot[res];
        t.nights += num_(row[C.nights]);
        t.bv += parseMoney_(row[C.bv]); t.tv += parseMoney_(row[C.tv]); t.payout += parseMoney_(row[C.payout]);
        t.sfh += Math.abs(parseMoney_(row[C.sfh])); t.pc += parseMoney_(row[C.pc]);
        t.net += parseMoney_(row[C.net]); t.vat += parseMoney_(row[C.vat]); t.city += parseMoney_(row[C.city]);
        t.env += parseMoney_(row[C.env]); t.gross += parseMoney_(row[C.gross]); t.comm20 += parseMoney_(row[C.comm20]);
      }
    }
  }

  var names = Object.keys(occ).sort();

  // ---- Summary sheet ----
  var out = [['Property','Nights','Booking value','Total Value (Guest Pays)','Total Payout','Gross Value (AADE)',
              'Platform Commission','Payment Charges','City Tax','VAT','Environmental Fee','Somnio Commission (20%)',
              'Net to Owner','ADR (TV/Night)']];
  names.forEach(function(nm){
    var t = tot[nm] || { nights:0,bv:0,tv:0,payout:0,sfh:0,pc:0,net:0,vat:0,city:0,env:0,gross:0,comm20:0 };
    var netOwner = t.tv - t.sfh - t.pc - t.city - t.vat - t.env - t.comm20;
    out.push([nm, t.nights, r2_(t.bv), r2_(t.tv), r2_(t.payout), r2_(t.gross), r2_(t.sfh), r2_(t.pc),
              r2_(t.city), r2_(t.vat), r2_(t.env), r2_(t.comm20), r2_(netOwner),
              t.nights ? r2_(t.tv / t.nights) : '']);
  });
  var sh1 = ss.getSheetByName('Summary') || ss.insertSheet('Summary');
  sh1.clear();
  sh1.getRange(1,1,out.length,out[0].length).setValues(out);
  sh1.getRange(1,1,1,out[0].length).setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
  sh1.setFrozenRows(1);

  // ---- Occupancy sheet ----
  var out2 = [['Ακίνητο','Απρ (30)','Μαϊ (31)','Ιουν (30)','Ιουλ (31)','Αυγ (31)','Σεπ (30)','Οκτ (31)','ΣΕΖΟΝ %']];
  var colT = {4:0,5:0,6:0,7:0,8:0,9:0,10:0}, grand = 0;
  names.forEach(function(nm){
    var row2 = [nm], sum = 0;
    months.forEach(function(m){ var v = occ[nm][m]; sum += v; colT[m] += v;
      row2.push(Math.round(v / daysIn[m] * 1000) / 10 + '%'); });
    grand += sum;
    row2.push(Math.round(sum / SEASON_DAYS * 1000) / 10 + '%');
    out2.push(row2);
  });
  var trow = ['ΣΥΝΟΛΟ ΧΑΡΤΟΦΥΛΑΚΙΟΥ'];
  months.forEach(function(m){ trow.push(Math.round(colT[m] / (daysIn[m] * names.length) * 1000) / 10 + '%'); });
  trow.push(Math.round(grand / (SEASON_DAYS * names.length) * 1000) / 10 + '%');
  out2.push(trow);

  var sh2 = ss.getSheetByName('Occupancy_2026') || ss.insertSheet('Occupancy_2026');
  sh2.clear();
  sh2.getRange(1,1,out2.length,out2[0].length).setValues(out2);
  sh2.getRange(1,1,1,out2[0].length).setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
  sh2.getRange(out2.length,1,1,out2[0].length).setFontWeight('bold');
  sh2.setFrozenRows(1);

  SpreadsheetApp.getUi().alert('OK: Summary + Occupancy_2026 (' + names.length + ' properties) apo to Master File.');
}
