/**
 * Owner Invoicing 2027 — σύνδεση με Oxygen (Pelatologio ERP API).
 *
 * Βάση: https://sandbox-api.oxygen.gr/v1 (δοκιμές) · https://api.oxygen.gr/v1 (παραγωγή).
 * Πιστοποίηση: Authorization: Bearer <OXYGEN_API_KEY> (Script Property του αρχείου — ποτέ στο GitHub/chat).
 * Σχήμα API: https://docs.oxygen.gr/openapi.json (διαβάστηκε 9/11/2026).
 *
 * Config:
 *   OXYGEN_ENV              sandbox | production (προεπιλογή sandbox)
 *   OXYGEN_SERIES_INVOICE   σειρά Τιμολογίου Παροχής (όνομα, π.χ. ΠΡΟΜ, ή id) — τύπος σειράς «s»
 *   OXYGEN_SERIES_RECEIPT   σειρά Απόδειξης Παροχής (όνομα, π.χ. ΑΠΥ, ή id)    — τύπος σειράς «rs»
 *   OXYGEN_PAYMENT          τρόπος πληρωμής: κωδικός myDATA ή τίτλος (προεπιλογή 1 = Τραπεζική κατάθεση εσωτερικού)
 *   OXYGEN_MYDATA_CATEGORY  χαρακτηρισμός εσόδου (προεπιλογή category1_3 = Έσοδα από παροχή υπηρεσιών)
 *   OXYGEN_MYDATA_TYPE_INVOICE / OXYGEN_MYDATA_TYPE_RECEIPT  (προεπιλογή E3_561_001 / E3_561_003) — να επιβεβαιώσει ο λογιστής
 *   FOLDER_INVOICE_PDFS     φάκελος για τα PDF (αλλιώς ο γονικός του Vouchers)
 *   FOLDER_VOUCHERS_SENT    φάκελος Sent (εκεί πάει το voucher μετά την αποστολή)
 *
 * Ροή: επαφή (βρες με ΑΦΜ/email ή φτιάξε — στοιχεία εταιρείας από ΓΓΠΣ μέσω /vat-check)
 *      → POST /invoices (1 ή 2 γραμμές) → ΜΑΡΚ → PDF στο Drive → email.
 * Στο sandbox: τα email πάνε ΜΟΝΟ σε σένα (με [ΔΟΚΙΜΗ]) και το voucher δεν μετακινείται.
 */

function oxyBase_() {
  var env = String(SomnioCore.cfg('OXYGEN_ENV', false) || 'sandbox').toLowerCase();
  return env === 'production' ? 'https://api.oxygen.gr/v1' : 'https://sandbox-api.oxygen.gr/v1';
}

function oxyKey_() {
  var k = PropertiesService.getScriptProperties().getProperty('OXYGEN_API_KEY');
  if (!k) throw new Error('Λείπει το OXYGEN_API_KEY στα Script Properties του Owner Invoicing 2027.');
  return k.trim();
}

/** GET/POST στο Oxygen. Επιστρέφει { code, body (JSON ή κείμενο) }. */
function oxyCall_(method, path, payload) {
  var opt = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + oxyKey_(), Accept: 'application/json' } };
  if (payload) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(payload); }
  var res = UrlFetchApp.fetch(oxyBase_() + path, opt), txt = res.getContentText(), body = txt;
  try { body = JSON.parse(txt); } catch (e) {}
  return { code: res.getResponseCode(), body: body };
}

/**
 * Δοκιμή σύνδεσης: ζητά τις βασικές λίστες και γράφει στο tab «Oxygen» ό,τι επιστρέφει,
 * ώστε να δούμε τα πραγματικά πεδία/ids (σειρές, ΦΠΑ, μονάδες, τρόποι πληρωμής, επαφές).
 * Δεν δημιουργεί και δεν αλλάζει τίποτα στο Oxygen.
 */
function oxygenTest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var paths = ['/contacts?per_page=3', '/numbering-sequences', '/taxes', '/measurement-units', '/payment-methods', '/invoices?per_page=1'];
  // Μία γραμμή ανά εγγραφή, με μικρά κελιά (τα πολύ μεγάλα κελιά δεν διαβάζονται εύκολα).
  var out = [['Endpoint', 'HTTP', 'id', 'Όνομα', 'Πεδία (JSON, αρχή)']], okN = 0;
  paths.forEach(function (p) {
    try {
      var r = oxyCall_('get', p);
      if (r.code === 200) okN++;
      var b = r.body, list = Array.isArray(b) ? b : (b && Array.isArray(b.data) ? b.data : null);
      if (!list) {
        var t = typeof b === 'string' ? b : JSON.stringify(b);
        for (var i = 0; i < Math.min(t.length, 6000); i += 1500) out.push([p, r.code, '', '(κομμάτι ' + (i / 1500 + 1) + ')', t.slice(i, i + 1500)]);
        return;
      }
      if (!list.length) out.push([p, r.code, '', '(κενή λίστα)', '']);
      list.slice(0, 25).forEach(function (it, n) {
        var name = it.name || it.title || it.description || it.code || it.company_name || it.surname || '';
        var js = JSON.stringify(it);
        out.push([p, r.code, String(it.id || ''), String(name).slice(0, 100), js.slice(0, 1500)]);
        if (n === 0 && js.length > 1500) out.push([p, r.code, String(it.id || ''), '(συνέχεια 1ης εγγραφής)', js.slice(1500, 3000)]);
      });
    } catch (e) { out.push([p, 'σφάλμα', '', '', e.message]); }
  });
  var sh = ss.getSheetByName('Oxygen') || ss.insertSheet('Oxygen');
  sh.clear();
  sh.getRange(1, 1, out.length, 5).setNumberFormat('@').setValues(out);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold');
  sh.setColumnWidth(1, 200); sh.setColumnWidth(3, 260); sh.setColumnWidth(4, 220); sh.setColumnWidth(5, 700);
  SomnioCore.logRun('Owner Invoicing · Oxygen test', okN ? 'OK' : 'ERROR', okN, oxyBase_() + ' · ' + okN + '/' + paths.length + ' OK');
  SpreadsheetApp.getUi().alert('Oxygen (' + oxyBase_() + '): ' + okN + '/' + paths.length + ' απαντήσεις ΟΚ. Δες το tab «Oxygen».');
}

// -- ΒΟΗΘΗΤΙΚΑ ΕΚΔΟΣΗΣ ----------------------------------------------------------------

function oxyIsProd_() { return oxyBase_().indexOf('sandbox') === -1; }

/** Λάθος του Oxygen σε μία γραμμή κειμένου (message + errors). */
function oxyErr_(r) {
  var b = r.body;
  if (b && typeof b === 'object') {
    var t = b.message || '';
    if (b.errors) Object.keys(b.errors).forEach(function (k) { t += ' · ' + k + ': ' + [].concat(b.errors[k]).join(' '); });
    return 'HTTP ' + r.code + ' — ' + t;
  }
  return 'HTTP ' + r.code + ' — ' + String(b).slice(0, 400);
}
function oxyList_(path) {
  var r = oxyCall_('get', path);
  if (r.code !== 200) throw new Error('Oxygen ' + path + ': ' + oxyErr_(r));
  return Array.isArray(r.body) ? r.body : (r.body && r.body.data) || [];
}

/** Σύγκριση ονομάτων σειράς: ίδια γράμματα Ελληνικά/Λατινικά (ΠPOM = ΠΡΟΜ), χωρίς τόνους/κενά. */
function oxyFold_(s) {
  var map = { 'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X' };
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ\s]/g, '')
    .split('').map(function (c) { return map[c] || c; }).join('');
}

/** Τα ids που χρειάζεται το παραστατικό: σειρά, ΦΠΑ 24%, τρόπος πληρωμής. */
function oxySetup_(doc) {
  var wantType = doc === 'Τιμολόγιο' ? 's' : 'rs';
  var key = doc === 'Τιμολόγιο' ? 'OXYGEN_SERIES_INVOICE' : 'OXYGEN_SERIES_RECEIPT';
  var want = String(SomnioCore.cfg(key, false) || (doc === 'Τιμολόγιο' ? 'ΠΡΟΜ' : 'ΑΠΥ')).trim();
  var seqs = oxyList_('/numbering-sequences');
  var seq = seqs.filter(function (q) { return (q.id === want || oxyFold_(q.name) === oxyFold_(want)) && Number(q.status) === 1; })[0];
  if (!seq) throw new Error('Δεν βρέθηκε σειρά «' + want + '» στο Oxygen (Config ' + key + '). Υπάρχουν: ' +
    seqs.map(function (q) { return q.name + ' (' + q.document_type + ')'; }).join(', '));
  if (seq.document_type !== wantType) throw new Error('Η σειρά «' + seq.name + '» είναι φτιαγμένη για «' + seq.document_type +
    '» αλλά για ' + doc + ' χρειάζεται «' + wantType + '» (' + (wantType === 's' ? 'Τιμολόγιο Παροχής Υπηρεσιών' : 'Απόδειξη Παροχής Υπηρεσιών') +
    '). Φτιάξε τη σειρά στη σωστή κατηγορία παραστατικού στο Oxygen.');
  if (seq.is_draft) throw new Error('Η σειρά «' + seq.name + '» είναι πρόχειρη (draft) — δεν θα πάει στο myDATA.');
  var rate = Math.round(invVat_() * 10000) / 100;
  var tax = oxyList_('/taxes').filter(function (t) { return Number(t.rate) === rate && t.status; })[0];
  if (!tax) throw new Error('Δεν βρέθηκε συντελεστής ΦΠΑ ' + rate + '% στο Oxygen.');
  var pw = String(SomnioCore.cfg('OXYGEN_PAYMENT', false) || '1').trim();
  var pm = oxyList_('/payment-methods').filter(function (p) {
    return p.id === pw || String(p.mydata_code) === pw || invKey_(p.title_gr) === invKey_(pw);
  })[0];
  if (!pm) throw new Error('Δεν βρέθηκε τρόπος πληρωμής «' + pw + '» (Config OXYGEN_PAYMENT).');
  return { seq: seq, tax: tax, pm: pm };
}

/** Διεύθυνση σε ελεύθερη μορφή → {street, number, zip, city} (π.χ. «Κοραή 4 Κηφισιά ΤΚ 14561»). Ό,τι δεν βγαίνει μένει κενό. */
function oxyAddr_(s) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  var out = { street: '', number: '', zip: '', city: '' }; if (!s) return out;
  var z = s.match(/(^|[^\d])(\d{3}) ?(\d{2})(?!\d)/);
  var rest = s;
  if (z) { out.zip = z[2] + z[3]; rest = s.slice(0, z.index + z[1].length) + ' | ' + s.slice(z.index + z[0].length); }
  rest = rest.replace(/(^|\s)(?:με\s+)?(?:Τ\.?\s?Κ\.?|T\.?\s?K\.?)(?=\s|\||,|$)/gi, ' ').replace(/\s+/g, ' ');
  var parts = rest.split('|'), before = parts[0].replace(/[,\s]+$/, '').trim(), after = (parts[1] || '').replace(/^[,\s]+/, '').trim();
  var n = before.match(/(^|\s)(\d{1,4}[A-Za-zΑ-Ωα-ω]?)(?=[\s,]|$)/);
  if (n) {
    out.number = n[2];
    var pre = before.slice(0, n.index).replace(/[,\s]+$/, '').trim(), post = before.slice(n.index + n[0].length).replace(/^[,\s]+/, '').trim();
    if (pre) { out.street = pre.split(',').pop().trim(); if (!after) after = post.replace(/^[,\s]+/, ''); }
    else { var w = post.split(/[,]/)[0].trim().split(' '); out.street = w[0] || ''; if (!after) after = w.slice(1).join(' ') || post.split(',').slice(1).join(',').trim(); }
  } else {
    var b0 = before.split(',')[0].trim().split(' ');
    out.street = b0.length > 1 ? b0.slice(0, -1).join(' ') : b0[0];
    if (!after) after = before.split(',').length > 1 ? before.split(',').slice(1).join(',').trim() : (b0.length > 1 ? b0[b0.length - 1] : '');
  }
  out.city = after.split(',')[0].trim() || (before.split(',').length > 1 ? before.split(',').pop().trim() : '');
  return out;
}

/**
 * Βρίσκει ή φτιάχνει την επαφή του ιδιοκτήτη. Επιστρέφει το id.
 * Εταιρεία: ψάχνει με ΑΦΜ · αλλιώς στοιχεία από ΓΓΠΣ (/vat-check), με προτεραιότητα ό,τι γράφει το Master Properties.
 * Ιδιώτης: ψάχνει με email · αλλιώς τον φτιάχνει (όνομα/επώνυμο από Owner_Name).
 */
function oxyContact_(g) {
  var known = String(g('Oxygen_Contact_ID') || '').trim();
  if (known) return { id: known, created: false };
  var isCo = g('Παραστατικό') === 'Τιμολόγιο', afm = String(g('ΑΦΜ') || '').trim(), email = String(g('Email ιδιοκτήτη') || '').split(',')[0].trim();   // στο Oxygen μόνο το πρώτο
  if (isCo) {
    if (!/^\d{9}$/.test(afm)) throw new Error('Λείπει ΑΦΜ (9 ψηφία) στο Master Properties.');
    var f = oxyList_('/contacts?vat=' + afm);
    if (f.length) return { id: f[0].id, created: false };
    var gs = {}, vr = oxyCall_('get', '/vat-check?vat=' + afm);
    if (vr.code === 200 && vr.body && typeof vr.body === 'object') {
      gs = vr.body.data || vr.body; if (Array.isArray(gs)) gs = gs[0] || {};
    }
    var vatInfo = 'ΓΓΠΣ (/vat-check): ' + (vr.code === 200 ? 'απάντησε ' + JSON.stringify(vr.body).slice(0, 300) : oxyErr_(vr).slice(0, 300));
    var a = oxyAddr_(g('Διεύθυνση'));
    var body = {
      type: 2, is_client: true, is_supplier: false, country: 'GR', vat_number: afm,
      company_name: String(gs.legalName || g('Επωνυμία') || '').trim(),
      tax_office: String(g('ΔΟΥ') || gs.taxAuthorityName || '').trim(),
      profession: String((gs.firms && gs.firms[0] && gs.firms[0].description) || 'Εκμίσθωση ακινήτων').slice(0, 120),
      street: String(gs.street || a.street || '').trim(), number: String(gs.streetNumber || a.number || '0').trim(),
      city: String(gs.city || a.city || '').trim(), zip_code: String(gs.postcode || a.zip || '').trim(), email: email || null
    };
    if (g('Επωνυμία') && g('Επωνυμία') !== g('Ιδιοκτήτης')) body.company_name = String(g('Επωνυμία')).trim();
    var miss = ['company_name', 'tax_office', 'street', 'city', 'zip_code'].filter(function (k) { return !body[k]; });
    if (miss.length) throw new Error('Η ΓΓΠΣ δεν έδωσε (και λείπουν από το Master Properties): ' + miss.join(', ') +
      '. Συμπλήρωσε στο Master Properties: DOY και Owner_Address με μορφή «Οδός Αριθμός, ΤΚ Πόλη» (π.χ. Τσιμισκή 12, 54622 Θεσσαλονίκη).\n\n' + vatInfo);
  } else {
    if (email) { var e = oxyList_('/contacts?email=' + encodeURIComponent(email)); if (e.length) return { id: e[0].id, created: false }; }
    var parts = String(g('Επωνυμία') || g('Ιδιοκτήτης') || '').trim().split(/\s+/);
    if (!parts[0]) throw new Error('Λείπει το όνομα του ιδιοκτήτη.');
    body = { type: 1, is_client: true, is_supplier: false, country: 'GR', name: parts[0], surname: parts.slice(1).join(' ') || parts[0], email: email || null };
    if (/^\d{9}$/.test(afm)) body.vat_number = afm;
  }
  var r = oxyCall_('post', '/contacts', body);
  if (r.code !== 200 && r.code !== 201) throw new Error('Δημιουργία επαφής: ' + oxyErr_(r));
  var c = r.body.data || r.body;
  return { id: c.id, created: true };
}

/** Το σώμα του POST /invoices για μία γραμμή του tab. Καθαρή συνάρτηση (για έλεγχο). */
function oxyInvoiceBody_(g, ids, contactId, today) {
  var isInv = g('Παραστατικό') === 'Τιμολόγιο';
  var cat = String(SomnioCore.cfg('OXYGEN_MYDATA_CATEGORY', false) || 'category1_3');
  var typ = String(SomnioCore.cfg(isInv ? 'OXYGEN_MYDATA_TYPE_INVOICE' : 'OXYGEN_MYDATA_TYPE_RECEIPT', false) || (isInv ? 'E3_561_001' : 'E3_561_003'));
  var line = function (desc, net, vat) {
    return { description: String(desc).slice(0, 300), quantity: 1, unit_net_value: invR2_(net), net_amount: invR2_(net),
      vat_amount: invR2_(vat), tax_id: ids.tax.id, mydata_classification_category: cat, mydata_classification_type: typ };
  };
  var items = [line(g('Περιγραφή γραμμής 1'), invNum_(g('Προμήθεια Somnio')), invNum_(g('ΦΠΑ προμήθειας')))];
  var ab = invNum_(g('Προμήθεια Airbnb'));
  if (isInv && ab > 0) items.push(line(g('Περιγραφή γραμμής 2'), ab, invNum_(g('ΦΠΑ προμήθειας Airbnb'))));
  return {
    numbering_sequence_id: ids.seq.id, issue_date: Utilities.formatDate(today, 'Europe/Athens', 'yyyy-MM-dd'),
    document_type: isInv ? 's' : 'rs', mydata_document_type: isInv ? '2.1' : '11.2', language: 'gr',
    payment_method_id: ids.pm.id, contact_id: contactId, items: items, is_paid: false,
    description: String(g('Περιγραφή γραμμής 1')).slice(0, 200),
    comments: 'Αιτιολογία κατάθεσης: ' + g('Αιτιολογία κατάθεσης') + (isInv && ab > 0 ? ' · Ποσό προς πληρωμή: ' + invEuro_(invNum_(g('Προς πληρωμή'))) : '')
  };
}

/** PDF παραστατικού → αρχείο στο Drive. Επιστρέφει το url. */
function oxySavePdf_(invId, name) {
  var res = UrlFetchApp.fetch(oxyBase_() + '/invoices/' + invId + '/pdf', { muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + oxyKey_(), Accept: 'application/pdf' } });
  if (res.getResponseCode() !== 200) throw new Error('PDF: HTTP ' + res.getResponseCode() + ' — ' + res.getContentText().slice(0, 300));
  var fid = String(SomnioCore.cfg('FOLDER_INVOICE_PDFS', false) || '').trim(), folder;
  if (fid) folder = DriveApp.getFolderById(fid);
  else folder = DriveApp.getFolderById(String(SomnioCore.cfg('FOLDER_VOUCHERS')).trim()).getParents().next();
  return folder.createFile(res.getBlob().setName(name + '.pdf')).getUrl();
}

/**
 * Φέρνει από το Oxygen τον ΜΑΡΚ (και τυχόν λάθος myDATA) για όσα έχουν εκδοθεί αλλά δεν έχουν ακόμα ΜΑΡΚ.
 * Τρέχει και μόνο του σε κάθε «Ενημέρωση».
 */
function refreshMarks(silent) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(INV.MAIN);
  if (!sh || sh.getLastRow() < 2) return 0;
  if (!PropertiesService.getScriptProperties().getProperty('OXYGEN_API_KEY')) return 0;
  var m = SomnioCore.headerMap(sh), v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues(), n = 0, err = 0;
  v.forEach(function (r, i) {
    var id = String(r[m['Oxygen_Invoice_ID']] || '').trim(), mk = String(r[m['ΜΑΡΚ']] || '');
    if (!id || (mk && !/αναμένεται|⚠/.test(mk))) return;
    var res = oxyCall_('get', '/invoices/' + id);
    if (res.code !== 200) return;
    var md = ((res.body.data || res.body) || {}).mydata || {};
    var val = md.mark ? String(md.mark) : md.errors ? '⚠ myDATA: ' + String(md.errors.response || '').slice(0, 300) : '';
    if (!val || val === mk) return;
    sh.getRange(i + 2, m['ΜΑΡΚ'] + 1).setNumberFormat('@').setValue(val);
    if (!md.mark) { err++; return; }
    n++;
    // νέο PDF, τώρα με ΜΑΡΚ + QR (αν υπήρχε παλιό χωρίς ΜΑΡΚ, μένει στον φάκελο με «_χωρίς_ΜΑΡΚ» στο όνομα)
    try {
      var old = String(r[m['PDF']] || '').match(/[-\w]{25,}/);
      if (old) { var f = DriveApp.getFileById(old[0]); if (!/χωρίς_ΜΑΡΚ/.test(f.getName())) f.setName(f.getName().replace(/\.pdf$/i, '') + '_χωρίς_ΜΑΡΚ.pdf'); }
      var g = function (c) { return r[m[c]]; };
      sh.getRange(i + 2, m['PDF'] + 1).setValue(oxySavePdf_(id, invPdfName_(g)));
    } catch (e) { sh.getRange(i + 2, m['PDF'] + 1).setValue('⚠ ' + e.message.slice(0, 200)); }
  });
  if (!silent) SpreadsheetApp.getUi().alert('ΜΑΡΚ: ενημερώθηκαν ' + n + (err ? ' · με λάθος myDATA ' + err + ' (δες τη στήλη ΜΑΡΚ)' : '') + '.');
  return n;
}
