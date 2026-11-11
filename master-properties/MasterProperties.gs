/**
 * Master Properties 2027 — script του αρχείου «Master Properties 2027».
 *
 * Απαιτεί: βιβλιοθήκη SomnioCore (Identifier: SomnioCore, Version: HEAD)
 *          Script Property HOSTHUB_API_KEY (μόνο για «Ενημέρωση από Hosthub»).
 *
 * Μενού «Somnio Properties»:
 *   1. Στήσιμο / φρεσκάρισμα μορφής  — headers, λίστες επιλογών, κίτρινα πεδία, tab Agencies
 *   2. Ενημέρωση από Hosthub         — νέα ακίνητα της Hosthub μπαίνουν ως γραμμές· ονόματα ενημερώνονται
 *   3. Έλεγχος πληρότητας            — tab «Έλεγχος» με ό,τι λείπει ανά ακίνητο
 *
 * Τίποτα δεν σβήνεται ποτέ από αυτό το script. Ό,τι γράφουν οι χρήστες μένει.
 */

var TAB_PROPS = 'Properties';
var TAB_AGENCIES = 'Agencies';
var TAB_CHECK = 'Έλεγχος';

var OWNER_TYPES = ['Εταιρεία', 'Φυσικό', 'Δικό μας'];
var ACTIVE_VALUES = ['TRUE', 'FALSE', 'ΠΡΟΣ ΕΠΙΒΕΒΑΙΩΣΗ'];
var INVOICE_TYPES = ['Τιμολόγιο', 'Απόδειξη', 'Δεν εφαρμόζεται'];
var POOL_VALUES = ['PRIVATE', 'SHARED', 'NO'];
var YESNO = ['YES', 'NO'];

// Στήλες που συμπληρώνουν οι χρήστες (κίτρινες)
var MANUAL_COLS = ['Active_2027', 'Owner_Type', 'Owner_Name', 'Owner_Legal_Name', 'AFM', 'DOY',
  'Owner_Address', 'Owner_Email', 'Accountant_Email', 'Greeting_Name', 'Commission_%', 'Issue_Invoice',
  'Env_Fee_Night', 'AMA', 'Area', 'Bedrooms', 'Bathrooms', 'Max_Guests', 'Pool', 'Sea_View',
  'Property_URL', 'Notes'];
// Στήλες που γράφει μόνο το σύστημα (γκρι)
var SYSTEM_COLS = ['Hosthub_Name', 'Listing_ID', 'Oxygen_Contact_ID'];

var AGENCY_HDR = ['Agency', 'Προμήθεια agency %', 'Προμήθεια Somnio %', 'Ποιος εισπράττει',
  'Τιμολογεί η Somnio;', 'Active', 'Επαφή / email', 'Σημειώσεις'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Somnio Properties')
    .addItem('1. Στήσιμο / φρεσκάρισμα μορφής', 'setupProperties')
    .addItem('2. Ενημέρωση από Hosthub', 'syncFromHosthub')
    .addItem('3. Έλεγχος πληρότητας', 'checkCompleteness')
    .addSeparator()
    .addItem('4. Εισαγωγή στοιχείων από αρχείο ομάδας', 'importTeamProperties')
    .addSeparator()
    .addItem('5. Αφαίρεση ακινήτου (επιλεγμένες γραμμές)', 'removeProperty')
    .addItem('6. Ενεργοποίηση ακινήτου (επιλεγμένες γραμμές)', 'restoreProperty')
    .addToUi();
}

// -- 1. ΣΤΗΣΙΜΟ ------------------------------------------------------------------

function propsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_PROPS);
  if (!sh) { sh = ss.getSheets()[0]; sh.setName(TAB_PROPS); }   // το αρχικό tab από το CSV
  return sh;
}

function setupProperties() {
  SomnioCore.runJob('Master Properties · Στήσιμο', function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = propsSheet_();
    var map = SomnioCore.headerMap(sh);
    var n = Math.max(sh.getLastRow() - 1, 1);
    var maxRows = Math.max(sh.getMaxRows() - 1, n);

    sh.setFrozenRows(1);
    sh.setFrozenColumns(1);
    sh.getRange(1, 1, 1, sh.getLastColumn())
      .setFontWeight('bold').setBackground('#202D5D').setFontColor('#FFFFFF').setWrap(true);

    MANUAL_COLS.forEach(function (c) {
      if (map[c] !== undefined) sh.getRange(2, map[c] + 1, maxRows, 1).setBackground('#FFF8DC');
    });
    SYSTEM_COLS.forEach(function (c) {
      if (map[c] !== undefined) sh.getRange(2, map[c] + 1, maxRows, 1).setBackground('#EEEEEE');
    });

    list_(sh, map, 'Active_2027', ACTIVE_VALUES, maxRows);
    list_(sh, map, 'Owner_Type', OWNER_TYPES, maxRows);
    list_(sh, map, 'Issue_Invoice', INVOICE_TYPES, maxRows);
    list_(sh, map, 'Pool', POOL_VALUES, maxRows);
    list_(sh, map, 'Sea_View', YESNO, maxRows);

    // Agencies
    var ag = ss.getSheetByName(TAB_AGENCIES);
    if (!ag) {
      ag = ss.insertSheet(TAB_AGENCIES);
      ag.getRange(1, 1, 1, AGENCY_HDR.length).setValues([AGENCY_HDR]);
    }
    ag.setFrozenRows(1);
    ag.getRange(1, 1, 1, AGENCY_HDR.length)
      .setFontWeight('bold').setBackground('#202D5D').setFontColor('#FFFFFF');
    ag.getRange(2, 1, 200, AGENCY_HDR.length).setBackground('#FFF8DC');
    var am = SomnioCore.headerMap(ag);
    list_(ag, am, 'Ποιος εισπράττει', ['Ιδιοκτήτης', 'Somnio', 'Agency'], 200);
    list_(ag, am, 'Τιμολογεί η Somnio;', ['ΝΑΙ', 'ΟΧΙ'], 200);
    list_(ag, am, 'Active', ['TRUE', 'FALSE'], 200);

    return { count: sh.getLastRow() - 1, detail: 'μορφή + λίστες + Agencies' };
  });
}

function list_(sh, map, name, values, rows) {
  if (map[name] === undefined) return;
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  sh.getRange(2, map[name] + 1, rows, 1).setDataValidation(rule);
}

// -- 2. ΕΝΗΜΕΡΩΣΗ ΑΠΟ HOSTHUB ----------------------------------------------------

function syncFromHosthub() {
  var key = PropertiesService.getScriptProperties().getProperty('HOSTHUB_API_KEY');
  var msg = '';
  var ok = SomnioCore.runJob('Master Properties · Hosthub', function () {
    var sh = propsSheet_();
    var map = SomnioCore.headerMap(sh);
    var cId = SomnioCore.col(map, 'Listing_ID'), cName = SomnioCore.col(map, 'Hosthub_Name');
    var cRes = SomnioCore.col(map, 'Residence'), cAct = SomnioCore.col(map, 'Active_2027');
    var cNotes = SomnioCore.col(map, 'Notes');

    var rentals = SomnioCore.hosthubRentals(key);
    var last = sh.getLastRow();
    var vals = last > 1 ? sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues() : [];
    var row = {};
    vals.forEach(function (v, i) { if (v[cId]) row[String(v[cId]).trim()] = i; });

    var renamed = 0, added = [], seen = {};
    rentals.forEach(function (r) {
      var id = String(r.id || ''); seen[id] = 1;
      if (row.hasOwnProperty(id)) {
        var i = row[id];
        if (String(vals[i][cName]) !== String(r.name || '')) {
          sh.getRange(i + 2, cName + 1).setValue(r.name || '');
          renamed++;
        }
      } else {
        var line = new Array(sh.getLastColumn()).fill('');
        line[cRes] = r.name || ''; line[cName] = r.name || ''; line[cId] = id;
        line[cAct] = 'ΠΡΟΣ ΕΠΙΒΕΒΑΙΩΣΗ';
        line[cNotes] = 'Νέο από Hosthub ' + SomnioCore.ymd(new Date()) + ' — συμπλήρωσε τα στοιχεία';
        sh.appendRow(line);
        added.push(r.name || id);
      }
    });
    var missing = vals.filter(function (v) { return v[cId] && !seen[String(v[cId]).trim()]; })
                      .map(function (v) { return v[cRes]; });

    msg = rentals.length + ' ακίνητα στη Hosthub.\nΝέα: ' + (added.join(', ') || '—') +
          '\nΑλλαγή ονόματος: ' + renamed +
          '\nΣτο αρχείο αλλά όχι στη Hosthub: ' + (missing.join(', ') || '—');
    return { count: rentals.length, detail: 'νέα ' + added.length + ' · μετονομασίες ' + renamed + ' · λείπουν ' + missing.length };
  });
  try { SpreadsheetApp.getUi().alert(ok ? msg : 'Απέτυχε — δες Health/Log στο Config.'); } catch (e) {}
}

// -- 3. ΕΛΕΓΧΟΣ ΠΛΗΡΟΤΗΤΑΣ ---------------------------------------------------------

/** Τι πρέπει να υπάρχει ανά τύπο ιδιοκτήτη (μόνο για ενεργά ακίνητα). */
var REQUIRED = {
  'Εταιρεία': ['Owner_Name', 'Owner_Legal_Name', 'AFM', 'DOY', 'Owner_Address', 'Owner_Email', 'Greeting_Name', 'Commission_%', 'AMA'],
  'Φυσικό':   ['Owner_Name', 'AFM', 'Owner_Address', 'Owner_Email', 'Greeting_Name', 'Commission_%', 'AMA'],
  'Δικό μας': ['AMA']
};
var REQUIRED_ALL = ['Residence', 'Listing_ID', 'Owner_Type', 'Env_Fee_Night', 'Bedrooms', 'Max_Guests'];

function checkCompleteness() {
  var issues = 0;
  SomnioCore.runJob('Master Properties · Έλεγχος', function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = propsSheet_();
    var map = SomnioCore.headerMap(sh);
    var vals = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
    var out = [['Ακίνητο', 'Τι λείπει / τι να ελεγχθεί']];

    vals.forEach(function (v) {
      var res = v[map['Residence']];
      var active = String(v[map['Active_2027']]).toUpperCase();
      if (!res) return;
      if (active === 'ΠΡΟΣ ΕΠΙΒΕΒΑΙΩΣΗ') { out.push([res, 'Active_2027: να αποφασιστεί αν είναι ενεργό']); return; }
      if (active !== 'TRUE') return;

      var type = String(v[map['Owner_Type']] || '');
      var need = REQUIRED_ALL.concat(REQUIRED[type] || []);
      var miss = need.filter(function (c) { return map[c] !== undefined && String(v[map[c]]).trim() === ''; });
      if (miss.length) out.push([res, 'Λείπει: ' + miss.join(', ')]);

      var email = String(v[map['Owner_Email']] || '').trim();
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) out.push([res, 'Μη έγκυρο email: ' + email]);
      var afm = String(v[map['AFM']] || '').replace(/\s/g, '');
      if (afm && !/^\d{9}$/.test(afm)) out.push([res, 'Το ΑΦΜ δεν έχει 9 ψηφία: ' + afm]);

      var inv = String(v[map['Issue_Invoice']] || '');
      var expect = { 'Εταιρεία': 'Τιμολόγιο', 'Φυσικό': 'Απόδειξη', 'Δικό μας': 'Δεν εφαρμόζεται' }[type];
      if (expect && inv && inv !== expect) out.push([res, 'Issue_Invoice «' + inv + '» ενώ ο τύπος είναι ' + type]);
    });

    issues = out.length - 1;
    var ck = ss.getSheetByName(TAB_CHECK) || ss.insertSheet(TAB_CHECK);
    ck.clear();
    if (out.length === 1) out.push(['—', 'Όλα τα ενεργά ακίνητα είναι πλήρη ✓']);
    ck.getRange(1, 1, out.length, 2).setValues(out);
    ck.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#202D5D').setFontColor('#FFFFFF');
    ck.setColumnWidth(1, 200); ck.setColumnWidth(2, 600);
    ck.getRange(1, 3).setValue('Τελευταίος έλεγχος: ' + SomnioCore.ymd(new Date()));
    return { count: issues, detail: issues + ' εκκρεμότητες' };
  });
  try { SpreadsheetApp.getUi().alert('Έλεγχος ολοκληρώθηκε: δες το tab «' + TAB_CHECK + '».'); } catch (e) {}
}

// -- 5/6. ΑΦΑΙΡΕΣΗ / ΕΠΑΝΑΦΟΡΑ ΑΚΙΝΗΤΟΥ ------------------------------------------
// Τίποτα δεν σβήνεται: αλλάζει μόνο το Active_2027 (FALSE = εκτός χαρτοφυλακίου 2027) + σημείωση με ημερομηνία.
// Με FALSE: δεν εμφανίζεται σε Proposals, Owner Portal, Financials ανά ακίνητο, πληρότητα Control Center, λίστες Candy.

function setActive_(on) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi(), sh = ss.getActiveSheet();
  if (sh.getName() !== TAB_PROPS) { ui.alert('Πήγαινε στο tab «' + TAB_PROPS + '» και κάνε κλικ στη γραμμή (ή σε πολλές γραμμές) του ακινήτου.'); return; }
  var rg = sh.getActiveRange(), r0 = Math.max(rg.getRow(), 2), r1 = rg.getLastRow();
  if (r1 < 2) { ui.alert('Διάλεξε γραμμή ακινήτου (όχι τους τίτλους).'); return; }
  var map = SomnioCore.headerMap(sh), cRes = map['Residence'], cAct = map['Active_2027'], cNotes = map['Notes'];
  var v = sh.getRange(r0, 1, r1 - r0 + 1, sh.getLastColumn()).getValues();
  var names = v.map(function (x) { return x[cRes]; }).filter(String);
  if (!names.length) return;
  var q = on ? 'Να γίνουν ΕΝΕΡΓΑ για το 2027:\n\n' + names.join('\n') + '\n\n(θα εμφανίζονται ξανά σε προτάσεις, αναφορές, καταστάσεις ιδιοκτητών)'
    : 'Να ΑΦΑΙΡΕΘΟΥΝ από το 2027:\n\n' + names.join('\n') + '\n\nΔεν σβήνεται τίποτα — γίνονται Active_2027 = FALSE και σταματούν να εμφανίζονται σε προτάσεις, αναφορές και καταστάσεις ιδιοκτητών.';
  if (ui.alert(on ? 'Ενεργοποίηση ακινήτου' : 'Αφαίρεση ακινήτου', q, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  SomnioCore.runJob('Master Properties · ' + (on ? 'Ενεργοποίηση' : 'Αφαίρεση'), function () {
    var d = Utilities.formatDate(new Date(), 'Europe/Athens', 'dd/MM/yyyy');
    v.forEach(function (x, i) {
      if (!x[cRes]) return;
      sh.getRange(r0 + i, cAct + 1).setValue(on ? 'TRUE' : 'FALSE');
      if (cNotes !== undefined) {
        var n = String(x[cNotes] || '').trim(), add = (on ? 'Ενεργό από ' : 'Αφαιρέθηκε ') + d;
        sh.getRange(r0 + i, cNotes + 1).setValue(n ? n + ' · ' + add : add);
      }
    });
    return { count: names.length, detail: names.join(', ') };
  });
  try { checkCompleteness(); } catch (e) {}
}
function removeProperty() { setActive_(false); }
function restoreProperty() { setActive_(true); }
