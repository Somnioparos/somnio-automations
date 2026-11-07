/**
 * IMPORT OWNER DETAILS — one-off (20/7/2026), AYTONOMO.
 * Trexei MESA sto "Somnio — Master Properties":
 *   anoixe to Master Properties -> Extensions -> Apps Script -> epikollise
 *   ayto to arxeio -> dialekse ti synartisi updateOwnerDetails -> Run.
 * Meta to trexeimo boreis na to svisis — den xreiazetai monima.
 *
 * Pigi: "Owner_Property Details.xlsx" (OWNERS_MASTER + Property Owners),
 * snapshot 20/7 ensomatomeno pio kato. Grafei: Owner_Name, Owner_Email,
 * Accountant_Email, Greeting_Name, AFM, AMA. Mono otan i pigi exei timi.
 * AFM/AMA os keimeno (kratane midenika). Owner_Type/Issue_Invoice den
 * allazoun — an diaferoun apo tin pigi, anaferontai sto telos.
 */

function updateOwnerDetails() {
  var OWNER_DATA = {   // residence(lower) -> [name, email, accountant, greeting, afm, ama, ownerType(pigi), issueInvoice(pigi)]
    "blue coral 1": ["MARELIA GROUP OE", "mari.benopoulou@gmail.com", "", "", "", "00002674702", "Εταιρεία", "Τιμολόγιο"],
    "blue coral 2": ["Κλέλια Μπενοπούλου", "clelia.benopoulou@gmail.com", "", "κα Κλέλια", "", "00002674723", "Εταιρεία", "Τιμολόγιο"],
    "caper": ["", "", "", "", "047244114", "00003213363", "Δικό μας", "Δεν εφαρμόζεται"],
    "casa olea villa": ["Κηποτεχνική Πάρου ΙΚΕ", "mpromb@yahoo.gr", "", "", "800601864", "", "Εταιρεία", "Τιμολόγιο"],
    "citrine": ["", "", "", "", "045558494", "00003595187", "Δικό μας", "Δεν εφαρμόζεται"],
    "coral pearl": ["Μαρία Ζιώγα", "mariazioga@hotmail.com", "", "κα Μαρία", "", "00002817455", "Φυσικό", "Απόδειξη"],
    "fiora i": ["Diana Emad Abdelhamid Elgebaly", "d.jebally@gmail.com", "katerina.trdf@gmail.com", "", "189686026", "00003604701", "Φυσικό", "Απόδειξη"],
    "fiora ii": ["Ntali Sami Hameed Shardan", "natalieshardan@gmail.com", "katerina.trdf@gmail.com", "", "189693122", "00003604865", "Φυσικό", "Απόδειξη"],
    "islander house": ["Ανδρέας Τζινέρης / Θεόδωρος Θεοδωρίδης", "andytzin@hotmail.com / th.theodoridis@hotmail.com", "", "κ. Ανδρέα", "124071230 / 101081460", "00003609067", "Φυσικό", "Απόδειξη"],
    "jasper cycladic town-house": ["", "", "", "", "048173290", "00003595204", "Δικό μας", "Δεν εφαρμόζεται"],
    "mirabilia": ["Lechos Retreats EE", "fragkoulisgian@gmail.com / lechos.retreats@gmail.com", "alpalogistikh@gmail.com", "κ. Γιάννη", "802704295", "00001236945", "Εταιρεία", "Τιμολόγιο"],
    "ōrigín_the cycladic windmill experience": ["LAVACA PROPERTY IKE", "info@lavacaproperty.gr", "i.tastanis@tax-solutions.gr", "Σίγκε", "802444468", "00003441445", "Εταιρεία", "Τιμολόγιο"],
    "peppermint": ["", "", "", "", "073799023", "00002520247", "Δικό μας", "Δεν εφαρμόζεται"],
    "peppermint ii": ["", "", "", "", "073153039", "00003674472", "Δικό μας", "Δεν εφαρμόζεται"],
    "piperi - 2 bedroom": ["Βίκυ Ράμφου", "ramfouvicky@gmail.com", "", "κα Βίκυ", "064597415", "00002013731", "Φυσικό", "Απόδειξη"],
    "solasta": ["Γιάννης Περαντινός", "fournos_h_dimitra@hotmail.com", "kritikou.oe@outlook.com", "κ. Γιάννη", "046922988", "00001737807", "Φυσικό", "Απόδειξη"],
    "thymari villa": ["Μιχάλης Κατσίνας", "mkatsinas@gmail.com", "maria.alpalog@gmail.com / info@accountantparos.com", "κ. Μιχάλη", "024273291", "00003694156", "Εταιρεία", "Τιμολόγιο"],
    "villa candia": ["Λοης Γαβαλάς / Στέλλα Λαζαρίδου", "theo.gavalas@gamilcom", "", "κ. Λοη", "111800104", "00003335382", "Εταιρεία", "Τιμολόγιο"],
    "villa hara naousa": ["Χαρά Κορδώνη", "info@kordoni.gr", "", "κα Χαρά", "062396578", "00000444024", "Εταιρεία", "Τιμολόγιο"],
    "villa vireya": ["Ιφιγένεια Τσιφτσή", "ifitsiftsi@windowslive.com", "cp@accountinganalytics.gr", "κα Ιφιγένεια", "079884530", "00003212255", "Φυσικό", "Απόδειξη"],
    "villa yagha": ["ESAI DEVELOPMENTS IKE", "iliasmalamas@yahoo.com / esaidevelopments@gmail.com", "m.kamvisi@taxis-center.gr", "", "801094546", "00002021157", "Εταιρεία", "Τιμολόγιο"],
    "white heaven apt4-cycladic home": ["Fresh Property ΟΕ", "apaloumpi@gmail.com", "acc.panagiotis@gmail.com", "", "802009796", "00001716117", "Εταιρεία", "Τιμολόγιο"],
    "walk to naousa | 1br sea view | pepperleaf": ["", "", "", "", "802423805", "00003767137", "Δικό μας", "Δεν εφαρμόζεται"],
  };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mp = ss.getSheetByName('Master_Properties') || ss.getSheets()[0];
  var last = mp.getLastRow();
  if (last < 2) { SpreadsheetApp.getUi().alert('Adeio Master Properties.'); return; }

  function norm(v) {
    var s = String(v || '').trim().toLowerCase().replace(/\s+/g, '');
    if (s.indexOf('εταιρ') === 0) return 'Εταιρεία';
    if (s.indexOf('φυσ') === 0) return 'Φυσικό';
    if (s.indexOf('δικ') === 0 || s.indexOf('δκ') === 0) return 'Δικό μας';
    return String(v || '').trim();
  }

  mp.getRange(2, 8, last - 1, 2).setNumberFormat('@');   // AFM (H), AMA (I) os keimeno
  var vals = mp.getRange(2, 1, last - 1, 13).getValues();
  var updated = 0, unmatchedRows = [], mismatches = [], usedKeys = {};

  for (var i = 0; i < vals.length; i++) {
    var res = String(vals[i][0] || '').trim();
    if (!res) continue;
    var d = OWNER_DATA[res.toLowerCase()];
    if (!d) { unmatchedRows.push(res); continue; }
    usedKeys[res.toLowerCase()] = 1;
    var n = 0;
    if (d[0]) { vals[i][3] = d[0]; n++; }   // Owner_Name
    if (d[1]) { vals[i][4] = d[1]; n++; }   // Owner_Email
    if (d[2]) { vals[i][5] = d[2]; n++; }   // Accountant_Email
    if (d[3]) { vals[i][6] = d[3]; n++; }   // Greeting_Name
    if (d[4]) { vals[i][7] = d[4]; n++; }   // AFM
    if (d[5]) { vals[i][8] = d[5]; n++; }   // AMA
    if (n) updated++;
    if (d[6] && norm(vals[i][2]) !== norm(d[6])) mismatches.push(res + ': Owner_Type sheet=' + vals[i][2] + ' vs πηγή=' + d[6]);
    if (d[7] && String(vals[i][10] || '').trim() !== d[7]) mismatches.push(res + ': Issue_Invoice sheet=' + vals[i][10] + ' vs πηγή=' + d[7]);
  }
  var unusedKeys = [];
  for (var k in OWNER_DATA) { if (!usedKeys[k]) unusedKeys.push(k); }

  mp.getRange(2, 1, vals.length, 13).setValues(vals);
  SpreadsheetApp.getUi().alert('Owner details DONE\nΕνημερώθηκαν: ' + updated + ' ακίνητα' +
    (unmatchedRows.length ? '\nΧωρίς δεδομένα στην πηγή: ' + unmatchedRows.join(', ') : '') +
    (unusedKeys.length ? '\nΣτην πηγή αλλά όχι στο sheet: ' + unusedKeys.join(', ') : '') +
    (mismatches.length ? '\n\nΔΙΑΦΟΡΕΣ (δεν άλλαξαν):\n' + mismatches.join('\n') : ''));
}
