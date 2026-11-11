/**
 * Master Properties 2027 — εισαγωγή στοιχείων ιδιοκτητών από το αρχείο της ομάδας
 * («Somnio — Master Properties», 1ο tab, headers στη γραμμή 1, ταίριασμα με Listing_ID).
 *
 * Μενού: «4. Εισαγωγή στοιχείων από αρχείο ομάδας»
 *   1) δείχνει στο tab «Εισαγωγή» ΤΙ θα αλλάξει (Ακίνητο · Στήλη · Τώρα · Νέο · Σημείωση) — δεν γράφει τίποτα,
 *   2) ρωτάει «Να περαστούν;» → γράφει μόνο όσα διαφέρουν. Κενό στο αρχείο της ομάδας ΔΕΝ σβήνει τίποτα.
 * Το Active ΔΕΝ περνάει: ενεργά/ανενεργά ορίζονται μόνο εδώ (μενού 5/6).
 * Email: «a / b», κόμμα, ; ή αλλαγή γραμμής → «a, b». ΑΦΜ / ΑΜΑ γράφονται ως κείμενο (κρατούν τα μηδενικά μπροστά).
 * Config TEAM_PROPERTIES_FILE = id του αρχείου της ομάδας (αλλιώς το ρωτάει).
 */

var IMP_TAB = 'Εισαγωγή';
// στήλη αρχείου ομάδας → στήλη Master Properties 2027
var IMP_MAP = [['Owner_Type', 'Owner_Type'], ['Owner_Name', 'Owner_Name'], ['Owner_Email', 'Owner_Email'],
  ['Accountant_Email', 'Accountant_Email'], ['Greeting_Name', 'Greeting_Name'], ['AFM', 'AFM'], ['AMA', 'AMA'],
  ['Issue_Invoice', 'Issue_Invoice'], ['Owner_Legal_Name', 'Owner_Legal_Name'],
  ['DOY', 'DOY'], ['Owner_Address', 'Owner_Address'], ['Notes', 'Notes']];
var IMP_TEXT = ['AFM', 'AMA'];

function impEmails_(s) {
  var ok = [], bad = [];
  String(s || '').split(/[\s,;\/]+/).forEach(function (e) {
    e = e.trim(); if (!e) return;
    (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e) ? ok : bad).push(e);
  });
  return { ok: ok.join(', '), bad: bad };
}

/** Κανονικοποίηση τιμής + σημείωση ελέγχου. Καθαρή συνάρτηση. */
function impClean_(col, v, row) {
  var s = String(v === null || v === undefined ? '' : v).trim(), note = '';
  if (/_Email$/.test(col)) {
    var e = impEmails_(s); s = e.ok;
    if (e.bad.length) note = '⚠ λάθος email: ' + e.bad.join(', ');
  }
  if (col === 'AFM' && s) {
    var parts = s.split(/\s*[\/,;]\s*/);
    if (parts.some(function (x) { return !/^\d{9}$/.test(x); })) note = '⚠ ΑΦΜ όχι 9 ψηφία';
    else if (parts.length > 1) note = '⚠ 2 ΑΦΜ — σε ποιον εκδίδεται το παραστατικό;';
  }
  if (col === 'Owner_Address' && s && row && String(row['Owner_Type']).trim() === 'Εταιρεία') {
    if (/(^|[^\d])\d{6}(?!\d)/.test(s)) note = '⚠ ΤΚ με 6 ψηφία — έλεγξε';
    else if (!/(^|[^\d])\d{3} ?\d{2}(?!\d)/.test(s)) note = '⚠ λείπει ΤΚ (5 ψηφία)';
  }
  if (col === 'AFM' && /^\d{8}$/.test(s)) note = '⚠ ΑΦΜ 8 ψηφία — μήπως λείπει 0 μπροστά;';
  if (col === 'AMA' && s && /^\d+$/.test(s) && s.length < 11) note = 'ΑΜΑ ' + s.length + ' ψηφία (τα άλλα έχουν 11) — έλεγξε';
  if (col === 'Owner_Type' && row && row['Owner_Type'] === 'Δικό μας' && String(row['Issue_Invoice']).trim() === 'Τιμολόγιο') note = '⚠ «Δικό μας» αλλά Issue_Invoice = Τιμολόγιο';
  if (col === 'Active_2027' && s) s = String(s).toUpperCase();
  return { v: s, note: note };
}

function importTeamProperties() {
  var ui = SpreadsheetApp.getUi(), id = String(SomnioCore.cfg('TEAM_PROPERTIES_FILE', false) || '').trim();
  if (!id) {
    var r = ui.prompt('Εισαγωγή στοιχείων', 'Επικόλλησε το link του αρχείου της ομάδας («Somnio — Master Properties»):', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    id = (String(r.getResponseText()).match(/[-\w]{25,}/) || [''])[0];
    if (!id) { ui.alert('Δεν βρήκα id αρχείου στο link.'); return; }
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = propsSheet_(), m = SomnioCore.headerMap(sh), changes = [], extra = [];
  var src = SpreadsheetApp.openById(id), team = src.getSheetByName(TAB_PROPS) || src.getSheets()[0], tm = SomnioCore.headerMap(team);
  // ίδια μορφή με το Master Properties 2027 (αντίγραφο) → περνούν όλες οι στήλες των χρηστών, εκτός από Active_2027
  var same = tm['Hosthub_Name'] !== undefined;
  var pairs = same ? MANUAL_COLS.filter(function (c) { return c !== 'Active_2027'; }).map(function (c) { return [c, c]; }) : IMP_MAP;
  if (tm['Listing_ID'] === undefined) { ui.alert('Το αρχείο της ομάδας δεν έχει στήλη Listing_ID.'); return; }
  var tv = team.getRange(2, 1, team.getLastRow() - 1, team.getLastColumn()).getValues();
  var mv = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues(), rowOf = {};
  mv.forEach(function (r, i) { rowOf[String(r[m['Listing_ID']]).trim()] = i; });
  tv.forEach(function (t) {
    var lid = String(t[tm['Listing_ID']] || '').trim(); if (!lid) return;
    var obj = {}; for (var k in tm) obj[k] = t[tm[k]];
    var i = rowOf[lid];
    if (i === undefined) { extra.push(String(t[tm['Residence']] || lid)); return; }
    var res = mv[i][m['Residence']];
    pairs.forEach(function (pair) {
      if (tm[pair[0]] === undefined || m[pair[1]] === undefined) return;
      var c = impClean_(pair[1], t[tm[pair[0]]], obj), now = String(mv[i][m[pair[1]]] === null ? '' : mv[i][m[pair[1]]]).trim();
      if (!c.v) { if (c.note) changes.push([res, pair[1], now, '', c.note, i + 2, m[pair[1]] + 1, false]); return; }   // κενό δεν σβήνει
      if (pair[1] === 'Notes' && now && now.indexOf(c.v) > -1) return;
      var nv = pair[1] === 'Notes' && now && !same && c.v.indexOf(now) === -1 ? now + ' · ' + c.v : c.v;
      if (nv === now && !c.note) return;
      var raw = t[tm[pair[0]]];   // αριθμοί/booleans γράφονται όπως είναι (π.χ. 1.5 μπάνια — όχι ως κείμενο)
      changes.push([res, pair[1], now, nv, c.note, i + 2, m[pair[1]] + 1, nv !== now, 'p', (typeof raw === 'number' || typeof raw === 'boolean') && IMP_TEXT.indexOf(pair[1]) === -1 ? raw : undefined]);
    });
  });
  // --- Agencies (αν το αρχείο της ομάδας έχει tab Agencies): νέες γραμμές προστίθενται, υπάρχουσες ενημερώνονται
  var agT = src.getSheetByName(TAB_AGENCIES), agM = ss.getSheetByName(TAB_AGENCIES);
  if (agT && agM && agT.getLastRow() > 1) {
    var am = SomnioCore.headerMap(agM), atm = SomnioCore.headerMap(agT);
    var cur = agM.getLastRow() > 1 ? agM.getRange(2, 1, agM.getLastRow() - 1, agM.getLastColumn()).getValues() : [], at = {}, seenA = {}, next = agM.getLastRow() + 1;
    cur.forEach(function (r, i) { var k = String(r[am['Agency']] || '').trim().toLowerCase(); if (k) at[k] = i; });
    agT.getRange(2, 1, agT.getLastRow() - 1, agT.getLastColumn()).getValues().forEach(function (r) {
      var name = String(r[atm['Agency']] || '').trim(); if (!name) return;
      var k = name.toLowerCase(), dup = seenA[k]; seenA[k] = 1;
      var i = at[k], rowN = i === undefined ? next++ : i + 2;
      if (i === undefined) at[k] = rowN - 2;
      AGENCY_HDR.forEach(function (h) {
        if (atm[h] === undefined || am[h] === undefined) return;
        var raw = r[atm[h]], v = typeof raw === 'number' && /%/.test(h) && raw <= 1 ? Math.round(raw * 100) + '%' : String(raw === null ? '' : raw).trim();
        if (!v) return;
        var now = i === undefined || i >= cur.length ? '' : String(cur[i][am[h]] === null ? '' : cur[i][am[h]]).trim();
        if (typeof (cur[i] || [])[am[h]] === 'number' && /%/.test(h)) now = Math.round(cur[i][am[h]] * 100) + '%';
        var note = dup ? '⚠ η agency υπάρχει 2 φορές στο αρχείο — κράτα μία' : (h === 'Επαφή / email' && impEmails_(v).bad.length ? '⚠ λάθος email' : '');
        if (v === now && !note) return;
        changes.push(['Agency: ' + name, h, now, v, note, rowN, am[h] + 1, v !== now && !dup, 'ag', raw]);
      });
    });
  }
  var out = [['Ακίνητο', 'Στήλη', 'Τώρα', 'Νέο', 'Σημείωση']].concat(changes.map(function (c) { return c.slice(0, 5); }));
  if (extra.length) out.push(['(δεν υπάρχουν στο Master Properties 2027)', extra.join(', '), '', '', '⚠ τρέξε «2. Ενημέρωση από Hosthub»']);
  var p = ss.getSheetByName(IMP_TAB) || ss.insertSheet(IMP_TAB);
  p.clear(); p.getRange(1, 1, out.length, 5).setNumberFormat('@').setValues(out);
  p.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#202D5D').setFontColor('#FFFFFF');
  p.setColumnWidth(1, 220); p.setColumnWidth(2, 140); p.setColumnWidth(3, 260); p.setColumnWidth(4, 260); p.setColumnWidth(5, 340);
  p.setFrozenRows(1); ss.setActiveSheet(p);
  var todo = changes.filter(function (c) { return c[7]; }), warn = changes.filter(function (c) { return c[4]; }).length;
  if (!todo.length) { ui.alert('Τίποτα για αλλαγή.' + (warn ? ' Υπάρχουν ' + warn + ' σημειώσεις στο tab «' + IMP_TAB + '».' : '')); return; }
  if (ui.alert('Εισαγωγή στοιχείων', todo.length + ' αλλαγές σε ' + Object.keys(todo.reduce(function (a, c) { a[c[0]] = 1; return a; }, {})).length +
    ' ακίνητα (δες το tab «' + IMP_TAB + '»).' + (warn ? '\n' + warn + ' σημειώσεις ⚠ προς έλεγχο.' : '') + '\n\nΝα περαστούν;', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  SomnioCore.runJob('Master Properties · Εισαγωγή', function () {
    todo.forEach(function (c) {
      var val = c[9] !== undefined && typeof c[9] !== 'string' ? c[9] : c[3];
      if (c[8] === 'ag') { agM.getRange(c[5], c[6]).setValue(val); return; }
      var cell = sh.getRange(c[5], c[6]);
      if (IMP_TEXT.indexOf(c[1]) > -1) cell.setNumberFormat('@');
      cell.setValue(val);
    });
    return { count: todo.length, detail: 'αλλαγές ' + todo.length + ' · σημειώσεις ' + warn };
  });
  ui.alert('Πέρασαν ' + todo.length + ' αλλαγές. Τρέξε «3. Έλεγχος πληρότητας».');
}
