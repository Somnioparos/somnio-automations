/**
 * Master File 2027 — script του αρχείου «Master File 2027».
 *
 * Ρόλος: η μοναδική λίστα κρατήσεων του 2027. Τη γράφει μόνο αυτό το script (Hosthub API + tab Direct_Cash).
 * Όλα τα άλλα αρχεία (Financials, Scheduling, Invoicing, Ledger, Control Center) μόνο τη ΔΙΑΒΑΖΟΥΝ.
 *
 * Απαιτεί: βιβλιοθήκη SomnioCore (Identifier: SomnioCore, Version: HEAD)
 *          Script Property HOSTHUB_API_KEY (στα Script Properties ΑΥΤΟΥ του αρχείου).
 *
 * Μενού «Somnio Master»:
 *   1. Στήσιμο / φρεσκάρισμα μορφής   — tabs Bookings, Direct_Cash, Έλεγχος, μορφές, λίστες
 *   2. Sync τώρα                       — νέες/αλλαγμένες κρατήσεις από Hosthub + Direct_Cash
 *   3. Επανυπολογισμός (χωρίς Hosthub) — ξαναϋπολογίζει προμήθειες αν άλλαξε κάτι στο Master Properties
 *   4. Πλήρες resync (σπάνια)          — ξανακατεβάζει όλο το 2027
 *   5. Αυτόματο sync ON / OFF          — καθημερινά στην ώρα SYNC_TIME του Config (07:45)
 *
 * Κανόνες:
 *   - Μόνο κρατήσεις με check-in >= MIN_CHECKIN (Config). Και οι μελλοντικές.
 *   - Στήλες πάντα από τα ονόματα των headers. Στήλες που προσθέτει χρήστης διατηρούνται.
 *   - Στο Bookings ΔΕΝ γράφει κανείς. Διαβατήριο, email, τηλέφωνο, χώρα, σημειώσεις → στη Hosthub.
 *     Ειδικό ποσοστό προμήθειας: γραμμή «COMMISSION: 15» στα Notes της κράτησης στη Hosthub.
 *   - Agency: γραμμή «AGENCY: <όνομα>» στα Notes της κράτησης στη Hosthub → στήλη Agency.
 *   - Airbnb + ιδιοκτήτης Εταιρεία: η προμήθεια Airbnb επανατιμολογείται (στήλες Airbnb_Fee_*).
 *   - Noma δεν υπάρχει πια.
 */

var TAB_BOOKINGS = 'Bookings';
var TAB_DC = 'Direct_Cash';
var TAB_CHECK = 'Έλεγχος';
var TIME_BUDGET_MS = 270000;          // 4,5' — κάτω από το όριο 6' της Google
var PAGE_LIMIT = 400;
var DEFAULT_SKIP_GUESTS = ['tade'];   // owner blocks που δεν είναι κρατήσεις
var PASSPORT_DAYS_AHEAD = 3;          // υπενθύμιση διαβατηρίου για check-in μέχρι σε 3 μέρες

var OWNER_TYPES = ['Εταιρεία', 'Φυσικό', 'Δικό μας'];

// Οι στήλες του Bookings, με τη σειρά που στήνονται. kind: sys = γράφει το script,
// pre = προσυμπληρώνει το script μόνο αν είναι κενό, man = μόνο ο χρήστης.
var COLS = [
  ['no', 'sys'], ['Month', 'sys'], ['Check_in', 'sys'], ['Check_out', 'sys'], ['Nights', 'sys'],
  ['Residence', 'sys'], ['Platform', 'sys'], ['Agency', 'sys'], ['Status', 'sys'],
  ['Reservation ID', 'sys'], ['Guest name', 'sys'], ['Guests', 'sys'], ['ID_Type', 'sys'],
  ['Passport_AFM', 'sys'], ['Guest_Email', 'sys'], ['Guest_Phone', 'sys'], ['Guest_Country', 'sys'],
  ['Booking value', 'sys'], ['Cleaning fee', 'sys'], ['Total value', 'sys'], ['Guest paid', 'sys'],
  ['Total payout', 'sys'], ['Payment charges', 'sys'], ['Service fee host', 'sys'], ['Currency', 'sys'],
  ['Net_Price', 'sys'], ['VAT', 'sys'], ['City_Tax', 'sys'], ['Env_Fee', 'sys'], ['Price_AADE', 'sys'], ['Gross_Value', 'sys'],
  ['Owner_Type', 'sys'], ['Comm_Rate', 'sys'], ['Comm_Base', 'sys'], ['Comm_Net', 'sys'], ['Comm_VAT', 'sys'], ['Comm_Total', 'sys'],
  ['Airbnb_Fee_Recharge', 'sys'], ['Airbnb_Fee_VAT', 'sys'], ['Invoice_Total', 'sys'], ['Owner_Payable', 'sys'],
  ['Company_Revenue', 'sys'],
  ['Comm_Rate_Override', 'sys'],
  ['Hosthub_Notes', 'sys'], ['Hosthub_Name', 'sys'], ['Listing_ID', 'sys'], ['Source', 'sys'],
  ['is_visible', 'sys'], ['cancelled_at', 'sys'], ['event_id', 'sys'], ['hh_updated', 'sys'], ['synced_at', 'sys']
];
var MONEY_COLS = ['Booking value', 'Cleaning fee', 'Total value', 'Guest paid', 'Total payout', 'Payment charges',
  'Service fee host', 'Net_Price', 'VAT', 'City_Tax', 'Env_Fee', 'Price_AADE', 'Gross_Value', 'Comm_Base', 'Comm_Net',
  'Comm_VAT', 'Comm_Total', 'Airbnb_Fee_Recharge', 'Airbnb_Fee_VAT', 'Invoice_Total', 'Owner_Payable', 'Company_Revenue'];
var DATE_COLS = ['Check_in', 'Check_out'];
var TEXT_COLS = ['Reservation ID', 'Passport_AFM', 'Guest_Phone', 'Listing_ID', 'event_id', 'hh_updated'];
var TAX_COLS = ['Net_Price', 'VAT', 'City_Tax', 'Env_Fee', 'Price_AADE', 'Gross_Value'];

// Direct_Cash: ό,τι γράφει ο χρήστης για κρατήσεις εκτός Hosthub (μετρητά / απευθείας).
var DC_COLS = ['DC_ID', 'Residence', 'Check_in', 'Check_out', 'Guest name', 'Guests', 'Passport_AFM',
  'Guest_Email', 'Guest_Phone', 'Guest_Country', 'Ποσό', 'Comm_Rate_Override', 'Προμήθεια (ποσό)', 'Comments'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Master')
    .addItem('1. Στήσιμο / φρεσκάρισμα μορφής', 'setupMasterFile')
    .addItem('2. Sync τώρα', 'syncNow')
    .addItem('3. Επανυπολογισμός (χωρίς Hosthub)', 'recomputeAll')
    .addSeparator()
    .addItem('4. Πλήρες resync (σπάνια)', 'fullResync')
    .addItem('5. Αυτόματο sync ON', 'autoSyncOn')
    .addItem('5. Αυτόματο sync OFF', 'autoSyncOff')
    .addSeparator()
    .addItem('Δοκιμή σύνδεσης Hosthub', 'testConnection')
    .addToUi();
}

// -- ΒΟΗΘΗΤΙΚΑ ----------------------------------------------------------------------

function apiKey_() {
  return PropertiesService.getScriptProperties().getProperty('HOSTHUB_API_KEY');
}
function money_(m) { return (m && typeof m.cents === 'number') ? m.cents / 100 : ''; }
function num_(v) { var x = Number(v); return (v === '' || v === null || isNaN(x)) ? 0 : x; }
function r2_(x) { return Math.round(x * 100) / 100; }
function sameMoney_(a, b) { return Math.round(num_(a) * 100) === Math.round(num_(b) * 100) && (a === '') === (b === ''); }
function key_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ]/g, ''); }

var TZ_ = null;
function tz_() { if (!TZ_) TZ_ = String(SomnioCore.cfg('TIMEZONE', false) || 'Europe/Athens'); return TZ_; }
function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  var s = String(v || '').trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);             // dd/mm/yyyy
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s;
}
function toDate_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd_(s));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : '';
}
function nights_(a, b) {
  var x = toDate_(a), y = toDate_(b);
  return (x && y) ? Math.round((y - x) / 86400000) : '';
}
function rate_(v) {                       // "20", 20, "20%", 0.2 → 0.20 · κενό → null
  var s = String(v === null || v === undefined ? '' : v).replace('%', '').replace(',', '.').trim();
  if (s === '') return null;
  var n = Number(s); if (isNaN(n) || n < 0) return null;
  return n > 1 ? n / 100 : n;
}
function normOwner_(v) {
  var low = String(v || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!low) return '';
  if (low.indexOf('εταιρ') === 0) return 'Εταιρεία';
  if (low.indexOf('φυσ') === 0) return 'Φυσικό';
  if (low.indexOf('δικ') === 0 || low.indexOf('δκ') === 0) return 'Δικό μας';
  return String(v).trim();
}
function guestsStr_(e) {
  var a = Number(e.guest_adults) || 0, c = Number(e.guest_children) || 0, i = Number(e.guest_infants) || 0;
  if (a + c + i > 0) return [a ? a + 'A' : '', c ? c + 'C' : '', i ? i + 'I' : ''].filter(String).join('/');
  return (Number(e.guest_number) > 0) ? String(e.guest_number) : '';
}
/** «COMMISSION: 15» ή «ΠΡΟΜΗΘΕΙΑ: 15» στα Notes → 15 (ειδικό ποσοστό για αυτή την κράτηση). */
function rateFromNotes_(notes) {
  var plain = String(notes || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();   // χωρίς τόνους
  var m = /(?:COMMISSION|ΠΡΟΜΗΘΕΙΑ)\s*:\s*([0-9]+(?:[.,][0-9]+)?)\s*%?/.exec(plain);
  return m ? m[1].replace(',', '.') : '';
}

function agencyFromNotes_(notes) {
  var m = /AGENCY\s*:\s*([^\r\n]+)/i.exec(String(notes || ''));
  return m ? m[1].trim() : '';
}

// -- ΠΗΓΕΣ: Master Properties (ακίνητα + agencies) -----------------------------------

function loadProperties_() {
  var ss = SomnioCore.openFile('FILE_MASTER_PROPERTIES');
  var sh = ss.getSheetByName('Properties') || ss.getSheets()[0];
  var map = SomnioCore.headerMap(sh);
  var vals = sh.getDataRange().getValues();
  var byListing = {}, byName = {}, names = [];
  var c = function (n) { return SomnioCore.col(map, n); };
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r];
    var res = String(row[c('Residence')] || '').trim();
    if (!res) continue;
    var p = {
      residence: res,
      hosthubName: String(row[c('Hosthub_Name')] || '').trim(),
      listing: String(row[c('Listing_ID')] || '').trim(),
      ownerType: normOwner_(row[c('Owner_Type')]),
      commission: rate_(row[c('Commission_%')]),
      issueInvoice: String(row[c('Issue_Invoice')] || '').trim()
    };
    names.push(res);
    if (p.listing) byListing[p.listing] = p;
    byName[key_(res)] = p;
    if (p.hosthubName) byName[key_(p.hosthubName)] = p;
  }
  var agencies = {};
  var ag = ss.getSheetByName('Agencies');
  if (ag && ag.getLastRow() > 1) {
    var am = SomnioCore.headerMap(ag);
    var av = ag.getDataRange().getValues();
    for (var j = 1; j < av.length; j++) {
      var nm = String(av[j][SomnioCore.col(am, 'Agency')] || '').trim();
      if (!nm) continue;
      agencies[key_(nm)] = { name: nm, somnioRate: rate_(av[j][SomnioCore.col(am, 'Προμήθεια Somnio %')]) };
    }
  }
  return { byListing: byListing, byName: byName, names: names, agencies: agencies };
}

function propFor_(row, P) {
  return (row['Listing_ID'] && P.byListing[String(row['Listing_ID'])]) ||
         P.byName[key_(row['Residence'])] || P.byName[key_(row['Hosthub_Name'])] || null;
}

// -- ΥΠΟΛΟΓΙΣΜΟΙ ------------------------------------------------------------------
// Ίδιοι κανόνες με το 2026 (επιβεβαιωμένοι), + Comm_Rate από agency/ακίνητο + επανατιμολόγηση Airbnb.

function derive_(row, P, defaults) {
  var p = propFor_(row, P);
  if (p) { row['Residence'] = p.residence; if (!row['Listing_ID'] && p.listing) row['Listing_ID'] = p.listing; }
  var ownerType = p ? p.ownerType : normOwner_(row['Owner_Type']);
  row['Owner_Type'] = ownerType;

  var isDC = row['Source'] === 'Direct Cash';
  var cancelled = row['Status'] === 'Ακυρωμένη';
  var ag = row['Agency'] ? P.agencies[key_(row['Agency'])] : null;
  var rate = rate_(row['Comm_Rate_Override']);
  if (rate === null && ag && ag.somnioRate !== null) rate = ag.somnioRate;
  if (rate === null && p && p.commission !== null) rate = p.commission;
  if (rate === null) rate = defaults.commission;

  var net = num_(row['Net_Price']), gross = num_(row['Gross_Value']), bank = num_(row['Payment charges']),
      chan = Math.abs(num_(row['Service fee host'])), tv = num_(row['Total value']),
      vat = num_(row['VAT']), city = num_(row['City_Tax']), env = num_(row['Env_Fee']);

  var out = { Comm_Rate: '', Comm_Base: '', Comm_Net: '', Comm_VAT: '', Comm_Total: '', Airbnb_Fee_Recharge: '',
              Airbnb_Fee_VAT: '', Invoice_Total: '', Owner_Payable: '', Company_Revenue: '' };

  if (isDC) {
    var pay = num_(row['Total payout']);
    if (ownerType === 'Δικό μας') out.Company_Revenue = r2_(pay);
    else if (ownerType) {
      var manual = num_(row['_dc_comm_amount']);
      out.Comm_Rate = manual ? '' : rate;
      out.Comm_Base = r2_(pay);
      out.Comm_Net = manual ? r2_(manual) : r2_(pay * rate);
      out.Comm_VAT = 0;                               // μετρητά: όπως 2026, χωρίς ΦΠΑ
      out.Comm_Total = out.Comm_Net;
      out.Company_Revenue = out.Comm_Net;
    }
  } else if (!cancelled && (net || tv)) {
    if (ownerType === 'Δικό μας') {
      out.Company_Revenue = r2_(tv - chan - vat - city - env - bank);
    } else if (ownerType === 'Εταιρεία' || ownerType === 'Φυσικό') {
      var base = ownerType === 'Εταιρεία' ? (net || num_(row['Booking value'])) - bank - chan
                                          : (gross || net || num_(row['Booking value'])) - bank - chan;
      base = r2_(base);
      out.Comm_Rate = rate;
      out.Comm_Base = base;
      out.Comm_Net = r2_(base * rate);
      out.Comm_VAT = r2_(out.Comm_Net * defaults.vat);
      out.Comm_Total = r2_(out.Comm_Net + out.Comm_VAT);
      out.Invoice_Total = out.Comm_Total;
      out.Owner_Payable = out.Comm_Total;
      out.Company_Revenue = out.Comm_Net;
      // Airbnb + Εταιρεία: 2η γραμμή τιμολογίου = προμήθεια Airbnb + ΦΠΑ 24%.
      // Ο ιδιοκτήτης πληρώνει μόνο το ΦΠΑ της (η καθαρή έχει ήδη κρατηθεί από την Airbnb).
      if (ownerType === 'Εταιρεία' && /airbnb/i.test(String(row['Platform'])) && chan > 0) {
        out.Airbnb_Fee_Recharge = r2_(chan);
        out.Airbnb_Fee_VAT = r2_(chan * defaults.vat);
        out.Invoice_Total = r2_(out.Comm_Total + out.Airbnb_Fee_Recharge + out.Airbnb_Fee_VAT);
        out.Owner_Payable = r2_(out.Comm_Total + out.Airbnb_Fee_VAT);
      }
    }
  }
  for (var k in out) row[k] = out[k];
  return row;
}

function defaults_() {
  return {
    commission: rate_(SomnioCore.cfg('DEFAULT_COMMISSION', false)) || 0.20,
    vat: rate_(SomnioCore.cfg('COMMISSION_VAT', false)) || 0.24,
    minCheckin: ymd_(SomnioCore.cfg('MIN_CHECKIN')),
    skip: String(SomnioCore.cfg('SKIP_GUESTS', false) || DEFAULT_SKIP_GUESTS.join(','))
      .split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(String)
  };
}

// -- ΑΝΑΓΝΩΣΗ / ΕΓΓΡΑΦΗ BOOKINGS ----------------------------------------------------

function bookingsSheet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_BOOKINGS);
  if (!sh) throw new Error('Δεν υπάρχει το tab Bookings — τρέξε πρώτα «1. Στήσιμο».');
  return sh;
}

/** Διαβάζει όλες τις γραμμές ως αντικείμενα { header: τιμή }. */
function readRows_(sh) {
  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  var hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var rows = [];
  if (last > 1) {
    var vals = sh.getRange(2, 1, last - 1, lastCol).getValues();
    vals.forEach(function (v) {
      var o = {};
      for (var i = 0; i < hdr.length; i++) if (hdr[i]) o[hdr[i]] = v[i];
      if (String(o['event_id'] || '') !== '') rows.push(o);
    });
  }
  return { hdr: hdr, rows: rows };
}

/** Ξαναγράφει όλο το Bookings με μία κλήση, ταξινομημένο κατά Check_in. */
function writeRows_(sh, hdr, rows) {
  rows.sort(function (a, b) {
    var x = ymd_(a['Check_in']), y = ymd_(b['Check_in']);
    return x < y ? -1 : x > y ? 1 : String(a['Residence']).localeCompare(String(b['Residence']));
  });
  var out = rows.map(function (o) {
    return hdr.map(function (h) {
      if (!h) return '';
      var v = o[h];
      if (DATE_COLS.indexOf(h) > -1) return toDate_(v) || '';
      return (v === undefined || v === null) ? '' : v;
    });
  });
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, hdr.length).clearContent();
  if (out.length) sh.getRange(2, 1, out.length, hdr.length).setValues(out);
}

// -- HOSTHUB ---------------------------------------------------------------------

/**
 * Events από Hosthub.
 *  - sinceUnix > 0 (αυξητικό): global λίστα με updated_gte → μόνο όσα άλλαξαν (οδηγία Hosthub).
 *  - sinceUnix = 0 (πλήρες): ΑΝΑ ΑΚΙΝΗΤΟ, γιατί η global λίστα χωρίς φίλτρο δεν φέρνει όλο το ιστορικό.
 */
function fetchEvents_(sinceUnix) {
  var key = apiKey_();
  if (sinceUnix > 0) return pages_('/calendar-events?is_visible=all&limit=' + PAGE_LIMIT + '&updated_gte=' + sinceUnix, key, 40);
  var all = [];
  SomnioCore.hosthubRentals(key).forEach(function (r) {
    all = all.concat(pages_('/rentals/' + r.id + '/calendar-events?is_visible=all&limit=' + PAGE_LIMIT, key, 15));
  });
  return all;
}

function pages_(url, key, max) {
  var all = [], prev = '', guard = 0;
  while (url && url !== prev && guard++ < max) {
    var page = SomnioCore.hosthubGet(url, key);
    var d = page.data || [];
    all = all.concat(d);
    if (!d.length) break;
    prev = url;
    url = (page.navigation && page.navigation.previous) || null;   // παλαιότερα
  }
  return all;
}

function rowFromEvent_(e, gr, detail, ex) {
  var dFrom = e.date_from || '', dTo = e.date_to || '';
  var notes = (detail && detail.notes !== undefined) ? detail.notes : (e.notes !== undefined ? e.notes : (ex ? ex['Hosthub_Notes'] : ''));
  var cancelled = e.is_visible === false || !!e.cancelled_at;
  // Η Hosthub είναι η πηγή: ό,τι γράφεται εκεί περνά εδώ. Αν η Hosthub είναι κενή, κρατιέται η παλιά τιμή.
  var src = {};
  for (var k1 in e) src[k1] = e[k1];
  if (detail) for (var k2 in detail) if (detail[k2] !== undefined && detail[k2] !== null && detail[k2] !== '') src[k2] = detail[k2];
  var hh = function (col, apiVal) {
    return (apiVal !== undefined && apiVal !== null && String(apiVal) !== '') ? apiVal : (ex ? ex[col] || '' : '');
  };
  var o = {};
  if (ex) for (var kk in ex) o[kk] = ex[kk];          // κρατά και στήλες που πρόσθεσε χρήστης
  o['Month'] = dFrom ? Number(dFrom.split('-')[1]) : '';
  o['Check_in'] = dFrom; o['Check_out'] = dTo; o['Nights'] = nights_(dFrom, dTo) || e.nights || '';
  o['Hosthub_Name'] = (e.rental && e.rental.name) || '';
  o['Listing_ID'] = String((e.rental && e.rental.id) || '');
  o['Residence'] = o['Residence'] || o['Hosthub_Name'];
  o['Platform'] = (e.source && e.source.name) || 'Direct (Hosthub)';
  o['Hosthub_Notes'] = notes || '';
  o['Agency'] = agencyFromNotes_(notes);
  o['Status'] = cancelled ? 'Ακυρωμένη' : 'Ενεργή';
  o['Reservation ID'] = e.reservation_id || '';
  o['Guest name'] = e.guest_name || '';
  o['Guests'] = guestsStr_(e);
  o['ID_Type'] = hh('ID_Type', src.guest_identification_type || src.identification_type);
  o['Passport_AFM'] = hh('Passport_AFM', src.guest_identification_number || src.identification_number);
  o['Guest_Email'] = hh('Guest_Email', src.guest_email);
  o['Guest_Phone'] = hh('Guest_Phone', src.guest_phone);
  o['Guest_Country'] = hh('Guest_Country', SomnioCountries.name(src.guest_country));
  o['Booking value'] = money_(e.booking_value); o['Cleaning fee'] = money_(e.cleaning_fee);
  o['Total value'] = money_(e.total_value); o['Guest paid'] = money_(e.guest_paid);
  o['Total payout'] = money_(e.total_payout); o['Payment charges'] = money_(e.payment_charges);
  o['Service fee host'] = money_(e.service_fee_host);
  o['Currency'] = (e.rental && e.rental.currency) || 'EUR';
  if (gr) {
    o['Net_Price'] = money_(gr.net_value); o['VAT'] = money_(gr.vat); o['City_Tax'] = money_(gr.accommodation_tax);
    o['Env_Fee'] = money_(gr.climate_tax); o['Price_AADE'] = money_(gr.aade_value); o['Gross_Value'] = money_(gr.gross_booking_value);
  }
  o['Comm_Rate_Override'] = rateFromNotes_(notes);   // γραμμή «COMMISSION: 15» στα Notes της Hosthub
  o['Source'] = 'Hosthub';
  o['is_visible'] = e.is_visible;
  o['cancelled_at'] = e.cancelled_at ? new Date(e.cancelled_at * 1000) : '';
  o['event_id'] = String(e.id);
  o['hh_updated'] = String(e.updated || e.updated_at || '');
  o['synced_at'] = new Date();
  return o;
}

function finChanged_(ex, e) {
  return !sameMoney_(ex['Booking value'], money_(e.booking_value)) ||
         !sameMoney_(ex['Total payout'], money_(e.total_payout)) ||
         !sameMoney_(ex['Service fee host'], money_(e.service_fee_host)) ||
         String(ex['is_visible']) !== String(e.is_visible) ||
         ymd_(ex['Check_in']) !== e.date_from || ymd_(ex['Check_out']) !== e.date_to;
}

// -- SYNC ------------------------------------------------------------------------

function syncNow() { runSync_(false); }

function fullResync() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Πλήρες resync', 'Θα ξανακατέβουν όλες οι κρατήσεις 2027 από τη Hosthub (μπορεί να χρειαστούν 2–3 τρεξίματα). ' +
      'Οι χειροκίνητες στήλες ΔΕΝ σβήνονται. Συνέχεια;', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().deleteProperty('LAST_SYNC_TS');
  runSync_(false);
}

function runSync_(silent) {
  var result = null;
  var ok = SomnioCore.runJob('Master File · Sync', function () {
    result = sync_();
    return { count: result.updated + result.added, detail: result.detail };
  });
  if (!silent) {
    SpreadsheetApp.getUi().alert(ok
      ? 'Sync ' + (result.partial ? 'ΜΕΡΙΚΟ — τρέξε ξανά «2. Sync τώρα» για να ολοκληρωθεί' : 'ΟΚ') + '\n\n' + result.detail.split(' · ').join('\n')
      : 'Το sync απέτυχε. Δες το Health στο Somnio — Config 2027 (στάλθηκε και email).');
  }
  return result;
}

function sync_() {
  var start = Date.now();
  var props = PropertiesService.getScriptProperties();
  if (!apiKey_()) throw new Error('Λείπει το HOSTHUB_API_KEY στα Script Properties του Master File 2027.');
  var D = defaults_();
  var P = loadProperties_();
  var sh = bookingsSheet_();
  var data = readRows_(sh);
  var byId = {}, maxNo = 0;
  data.rows.forEach(function (o) {
    byId[String(o['event_id'])] = o;
    var n = Number(o['no']); if (n > maxNo) maxNo = n;
  });

  var lastTs = Number(props.getProperty('LAST_SYNC_TS') || 0);
  var runStart = Math.floor(Date.now() / 1000);
  var since = lastTs > 0 ? lastTs - 24 * 3600 : 0;          // 24h επικάλυψη ασφαλείας
  var events = fetchEvents_(since);
  var key = apiKey_();

  var added = 0, updated = 0, skipped = 0, partial = false, seen = {};
  for (var k = 0; k < events.length; k++) {
    if (Date.now() - start > TIME_BUDGET_MS) { partial = true; break; }
    var e = events[k];
    if (e.type !== 'CalendarEventBooking' && e.type !== 'Booking') continue;
    if (!e.date_from || e.date_from < D.minCheckin) continue;
    if (D.skip.indexOf(String(e.guest_name || '').trim().toLowerCase()) > -1) continue;
    var id = String(e.id);
    if (seen[id]) continue; seen[id] = 1;
    var ex = byId[id];
    var stamp = String(e.updated || e.updated_at || '');
    if (ex && stamp && String(ex['hh_updated']) === stamp) { skipped++; continue; }   // καμία αλλαγή στη Hosthub

    var fin = !ex || finChanged_(ex, e);
    var gr = null, detail = null;
    if (fin) { try { gr = SomnioCore.hosthubGet('/calendar-events/' + id + '/calendar-event-gr-taxes', key) || {}; } catch (err) { gr = null; } }
    if (e.notes === undefined) {                             // τα Notes δεν έρχονται στη λίστα → λεπτομέρεια
      try { var dd = SomnioCore.hosthubGet('/calendar-events/' + id, key); detail = dd.data || dd; } catch (err2) { detail = null; }
    }
    var row = rowFromEvent_(e, gr, detail, ex);
    row['no'] = ex ? ex['no'] : ++maxNo;
    byId[id] = row;
    if (ex) updated++; else added++;
  }

  var rows = Object.keys(byId).map(function (i) { return byId[i]; }).filter(function (o) { return o['Source'] !== 'Direct Cash'; });
  var dc = directCashRows_(P, maxNo);
  rows = rows.concat(dc.rows);
  rows.forEach(function (o) { derive_(o, P, D); });
  writeRows_(sh, data.hdr, rows);
  var issues = writeChecks_(rows, P, D, dc.issues);

  if (partial) props.setProperty('SYNC_PARTIAL', '1');
  else { props.deleteProperty('SYNC_PARTIAL'); props.setProperty('LAST_SYNC_TS', String(runStart)); }
  return {
    added: added, updated: updated, partial: partial,
    detail: (since > 0 ? 'αυξητικό' : 'ΠΛΗΡΕΣ') + ' · events ' + events.length + ' · νέες ' + added + ' · αλλαγμένες ' + updated +
            ' · Direct Cash ' + dc.rows.length + ' · εκκρεμότητες ' + issues + (partial ? ' · ΜΕΡΙΚΟ' : '')
  };
}

/** Μόνο τοπικά: ξαναϋπολογίζει προμήθειες/τύπους από το Master Properties, χωρίς Hosthub. */
function recomputeAll() {
  var n = 0;
  SomnioCore.runJob('Master File · Επανυπολογισμός', function () {
    var D = defaults_(), P = loadProperties_(), sh = bookingsSheet_();
    var data = readRows_(sh);
    var maxNo = 0;
    data.rows.forEach(function (o) { var x = Number(o['no']); if (x > maxNo) maxNo = x; });
    var rows = data.rows.filter(function (o) { return o['Source'] !== 'Direct Cash'; });
    var dc = directCashRows_(P, maxNo);
    rows = rows.concat(dc.rows);
    rows.forEach(function (o) { derive_(o, P, D); });
    writeRows_(sh, data.hdr, rows);
    n = rows.length;
    var issues = writeChecks_(rows, P, D, dc.issues);
    return { count: n, detail: 'γραμμές ' + n + ' · εκκρεμότητες ' + issues };
  });
  SpreadsheetApp.getUi().alert('Επανυπολογισμός: ' + n + ' γραμμές. Δες το tab «' + TAB_CHECK + '».');
}

// -- DIRECT CASH -------------------------------------------------------------------
// Κάθε γραμμή παίρνει μόνιμο DC_ID την πρώτη φορά, ώστε αλλαγή ημερομηνίας να μη φτιάχνει διπλή κράτηση.

function directCashRows_(P, maxNo) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_DC);
  var out = { rows: [], issues: [] };
  if (!sh || sh.getLastRow() < 2) return out;
  var map = SomnioCore.headerMap(sh);
  var c = function (n) { return SomnioCore.col(map, n); };
  var rng = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn());
  var vals = rng.getValues();
  var idCol = c('DC_ID'), newIds = false;
  var props = PropertiesService.getScriptProperties();
  var seq = Number(props.getProperty('DC_SEQ') || 0);
  var bkNo = {};   // σταθερό «no» για DC γραμμές
  try {
    readRows_(bookingsSheet_()).rows.forEach(function (o) { if (o['Source'] === 'Direct Cash') bkNo[o['event_id']] = o['no']; });
  } catch (ignored) {}

  for (var i = 0; i < vals.length; i++) {
    var v = vals[i];
    var res = String(v[c('Residence')] || '').trim();
    if (!res) continue;
    if (!v[idCol]) { v[idCol] = 'DC-' + ('000' + (++seq)).slice(-4); newIds = true; }
    var ci = ymd_(v[c('Check_in')]), co = ymd_(v[c('Check_out')]);
    var amount = num_(v[c('Ποσό')]);
    var o = {
      'no': bkNo[v[idCol]] || ++maxNo,
      'Month': ci ? Number(ci.split('-')[1]) : '', 'Check_in': ci, 'Check_out': co, 'Nights': nights_(ci, co),
      'Residence': res, 'Platform': 'Direct Cash', 'Agency': '', 'Status': 'Ενεργή', 'Reservation ID': '',
      'Guest name': v[c('Guest name')], 'Guests': v[c('Guests')], 'ID_Type': '',
      'Passport_AFM': v[c('Passport_AFM')], 'Guest_Email': v[c('Guest_Email')], 'Guest_Phone': v[c('Guest_Phone')],
      'Guest_Country': v[c('Guest_Country')],
      'Total value': amount, 'Guest paid': amount, 'Total payout': amount, 'Currency': 'EUR',
      'Comm_Rate_Override': v[c('Comm_Rate_Override')], 'Comments': v[c('Comments')],
      '_dc_comm_amount': v[c('Προμήθεια (ποσό)')],
      'Source': 'Direct Cash', 'event_id': v[idCol], 'synced_at': new Date()
    };
    if (!P.byName[key_(res)]) out.issues.push([res, ci, 'Direct_Cash: άγνωστο ακίνητο «' + res + '»']);
    if (!ci || !co) out.issues.push([res, ci, 'Direct_Cash ' + v[idCol] + ': λείπει ημερομηνία']);
    if (!amount) out.issues.push([res, ci, 'Direct_Cash ' + v[idCol] + ': λείπει ποσό']);
    out.rows.push(o);
  }
  if (newIds) {
    sh.getRange(2, idCol + 1, vals.length, 1).setValues(vals.map(function (r) { return [r[idCol]]; }));
    props.setProperty('DC_SEQ', String(seq));
  }
  return out;
}

// -- ΕΛΕΓΧΟΣ ---------------------------------------------------------------------

function writeChecks_(rows, P, D, extra) {
  var today = ymd_(new Date());
  var horizon = ymd_(new Date(Date.now() + PASSPORT_DAYS_AHEAD * 86400000));
  var list = (extra || []).slice();
  rows.forEach(function (o) {
    if (o['Status'] === 'Ακυρωμένη') return;
    var res = o['Residence'], ci = ymd_(o['Check_in']);
    if (o['Source'] === 'Hosthub' && !propFor_(o, P)) list.push([res, ci, 'Ακίνητο της Hosthub που δεν υπάρχει στο Master Properties (Listing ' + o['Listing_ID'] + ')']);
    if (!o['Owner_Type']) list.push([res, ci, 'Λείπει Owner_Type στο Master Properties → δεν υπολογίζεται προμήθεια']);
    if (o['Agency'] && !P.agencies[key_(o['Agency'])]) list.push([res, ci, 'Άγνωστη agency «' + o['Agency'] + '» — πρόσθεσέ τη στο tab Agencies']);
    if (ci && ci <= horizon && !String(o['Passport_AFM'] || '').trim()) {
      list.push([res, ci, (ci < today ? 'Έγινε check-in χωρίς' : 'Λείπει') + ' διαβατήριο/ΑΦΜ (συμπλήρωσε στη Hosthub) · ' + o['Guest name'] + ' (' + o['Platform'] + ')']);
    }
  });
  list.sort(function (a, b) { return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; });
  var sh = sheetByName_(TAB_CHECK);
  sh.clearContents();
  sh.getRange(1, 1, 1, 3).setValues([['Ακίνητο', 'Check-in', 'Εκκρεμότητα · τελευταίος έλεγχος ' + today]])
    .setFontWeight('bold').setBackground('#202D5D').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  if (list.length) sh.getRange(2, 1, list.length, 3).setValues(list);
  else sh.getRange(2, 1).setValue('Καμία εκκρεμότητα ✓');
  return list.length;
}

// -- ΣΤΗΣΙΜΟ ---------------------------------------------------------------------

function setupMasterFile() {
  SomnioCore.runJob('Master File · Στήσιμο', function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.setSpreadsheetTimeZone(tz_());
    try { ss.setSpreadsheetLocale('el_GR'); } catch (ignored) {}

    // Bookings: το πρώτο κενό tab γίνεται Bookings· προσθέτει όσες στήλες λείπουν, δεν σβήνει τίποτα.
    var bk = ss.getSheetByName(TAB_BOOKINGS);
    if (!bk) {
      var first = ss.getSheets()[0];
      bk = (first.getLastRow() === 0 && first.getName() !== TAB_DC) ? first.setName(TAB_BOOKINGS) : ss.insertSheet(TAB_BOOKINGS, 0);
    }
    ensureHeaders_(bk, COLS.map(function (c) { return c[0]; }));
    var map = SomnioCore.headerMap(bk);
    var rows = Math.max(bk.getMaxRows() - 1, 1);
    bk.setFrozenRows(1); bk.setFrozenColumns(6);
    bk.getRange(1, 1, 1, bk.getLastColumn()).setFontWeight('bold').setBackground('#202D5D').setFontColor('#FFFFFF').setWrap(true);
    COLS.forEach(function (c) {
      var i = map[c[0]]; if (i === undefined) return;
      var r = bk.getRange(2, i + 1, rows, 1);
      r.setBackground(c[1] === 'man' ? '#FFF8DC' : c[1] === 'pre' ? '#FFFBEA' : null);
      if (MONEY_COLS.indexOf(c[0]) > -1) r.setNumberFormat('#,##0.00');
      if (DATE_COLS.indexOf(c[0]) > -1) r.setNumberFormat('yyyy-mm-dd');
      if (TEXT_COLS.indexOf(c[0]) > -1) r.setNumberFormat('@');
      if (c[0] === 'Comm_Rate') r.setNumberFormat('0%');
      if (c[0] === 'cancelled_at' || c[0] === 'synced_at') r.setNumberFormat('yyyy-mm-dd hh:mm');
    });
    // Ακυρωμένες σε κόκκινο (conditional formatting — όχι χρώματα ανά γραμμή)
    var st = columnLetter_(map['Status'] + 1);
    var all = bk.getRange(2, 1, rows, bk.getLastColumn());
    var rules = bk.getConditionalFormatRules().filter(function (r) {
      var b = r.getBooleanCondition(); return !(b && String(b.getCriteriaValues()[0]).indexOf('Ακυρωμένη') > -1);
    });
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + st + '2="Ακυρωμένη"')
      .setBackground('#F4CCCC').setRanges([all]).build());
    bk.setConditionalFormatRules(rules);

    // Direct_Cash
    var dc = ss.getSheetByName(TAB_DC) || ss.insertSheet(TAB_DC);
    ensureHeaders_(dc, DC_COLS);
    var dm = SomnioCore.headerMap(dc);
    var dRows = Math.max(dc.getMaxRows() - 1, 1);
    dc.setFrozenRows(1);
    dc.getRange(1, 1, 1, dc.getLastColumn()).setFontWeight('bold').setBackground('#2F7A4A').setFontColor('#FFFFFF');
    dc.getRange(2, 1, dRows, dc.getLastColumn()).setBackground('#FFF8DC');
    dc.getRange(2, dm['DC_ID'] + 1, dRows, 1).setBackground('#EEEEEE');
    dc.getRange(2, dm['Check_in'] + 1, dRows, 2).setNumberFormat('dd/mm/yyyy');
    dc.getRange(2, dm['Ποσό'] + 1, dRows, 1).setNumberFormat('#,##0.00');
    dc.getRange(2, dm['Προμήθεια (ποσό)'] + 1, dRows, 1).setNumberFormat('#,##0.00');
    dc.getRange(2, dm['Guest_Phone'] + 1, dRows, 1).setNumberFormat('@');
    var P = loadProperties_();
    dc.getRange(2, dm['Residence'] + 1, dRows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(P.names, true).setAllowInvalid(false).build());
    dc.getRange(1, dm['DC_ID'] + 1).setNote('Συμπληρώνεται αυτόματα στο sync. Μην το αλλάζεις.');
    dc.getRange(1, dm['Ποσό'] + 1).setNote('Ό,τι εισπράχθηκε συνολικά από τον επισκέπτη.');
    dc.getRange(1, dm['Προμήθεια (ποσό)'] + 1).setNote('Προαιρετικό: σταθερό ποσό προμήθειας. Κενό = Ποσό × ποσοστό.');
    dc.getRange(1, dm['Comm_Rate_Override'] + 1).setNote('Προαιρετικό: π.χ. 15 για 15%. Κενό = ποσοστό του ακινήτου.');

    sheetByName_(TAB_CHECK);
    return { count: COLS.length, detail: 'Bookings + Direct_Cash + Έλεγχος' };
  });
  SpreadsheetApp.getUi().alert('Στήσιμο ΟΚ. Επόμενο: «2. Sync τώρα».');
}

/** Βρίσκει tab με όνομα (ανεκτικό σε τόνους/κενά)· αν δεν υπάρχει, το φτιάχνει. */
function sheetByName_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  var want = String(name).normalize('NFC').trim().toLowerCase();
  var found = ss.getSheets().filter(function (s) { return s.getName().normalize('NFC').trim().toLowerCase() === want; })[0];
  if (found) return found;
  try { return ss.insertSheet(name); }
  catch (e) { SpreadsheetApp.flush(); return ss.getSheetByName(name) || ss.getSheets().filter(function (s) { return s.getName().normalize('NFC').trim().toLowerCase() === want; })[0]; }
}

function ensureHeaders_(sh, names) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var hasAny = hdr.some(String);
  var missing = names.filter(function (n) { return hdr.indexOf(n) === -1; });
  if (!missing.length) return;
  var startCol = hasAny ? sh.getLastColumn() + 1 : 1;
  if (sh.getMaxColumns() < startCol + missing.length - 1) sh.insertColumnsAfter(sh.getMaxColumns(), startCol + missing.length - 1 - sh.getMaxColumns());
  sh.getRange(1, startCol, 1, missing.length).setValues([missing]);
}

function columnLetter_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

// -- AUTO SYNC -------------------------------------------------------------------
// Αν κοπεί στο χρονικό όριο (ΜΕΡΙΚΟ), προγραμματίζει μόνο του συνέχεια σε 1 λεπτό.

function syncAuto() {
  var res = runSync_(true);
  var props = PropertiesService.getScriptProperties();
  if (!res) {
    ScriptApp.newTrigger('syncResume').timeBased().after(10 * 60 * 1000).create();   // π.χ. 429: ξανά σε 10'
  } else if (props.getProperty('SYNC_PARTIAL')) {
    ScriptApp.newTrigger('syncResume').timeBased().after(60 * 1000).create();
  }
}

function syncResume() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'syncResume') ScriptApp.deleteTrigger(t); });
  syncAuto();
}

function autoSyncOn() {
  removeTriggers_();
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(SomnioCore.cfg('SYNC_TIME', false) || '').trim());
  var h = m ? Number(m[1]) : 7, min = m ? Number(m[2]) : 45;
  ScriptApp.newTrigger('syncAuto').timeBased().everyDays(1).atHour(h).nearMinute(min).inTimezone(tz_()).create();
  SomnioCore.logRun('Master File · Auto-sync', 'OK', '', 'ON ' + h + ':' + ('0' + min).slice(-2));
  SpreadsheetApp.getUi().alert('Αυτόματο sync ON — καθημερινά γύρω στις ' + h + ':' + ('0' + min).slice(-2) + '.');
}

function autoSyncOff() {
  removeTriggers_();
  SomnioCore.logRun('Master File · Auto-sync', 'WARNING', '', 'OFF');
  SpreadsheetApp.getUi().alert('Αυτόματο sync OFF.');
}

function removeTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'syncAuto' || f === 'syncResume') ScriptApp.deleteTrigger(t);
  });
}

function testConnection() {
  var r = SomnioCore.hosthubRentals(apiKey_());
  SpreadsheetApp.getUi().alert('Hosthub ΟΚ — ' + r.length + ' ακίνητα:\n' + r.slice(0, 8).map(function (x) { return x.name; }).join(', '));
}
