/**
 * Control Center 2027 — σελίδα-εφαρμογή (Web App) πάνω στο ίδιο Sheet.
 *
 * Διαβάζει τα έτοιμα αποτελέσματα από το κρυφό tab «_web» (τα γράφει κάθε «Ενημέρωση»), άρα ανοίγει αμέσως.
 * Κουμπί «Ενημέρωση» στη σελίδα → ccRefresh_() (~15–30″).
 *
 * Δημοσίευση (μία φορά): Apps Script → Ανάπτυξη → Νέα ανάπτυξη → Εφαρμογή ιστού
 *   Εκτέλεση ως: Εγώ · Πρόσβαση: Οποιοσδήποτε στο somnioestate.com
 * Μετά από αλλαγή κώδικα: Ανάπτυξη → Διαχείριση αναπτύξεων → ✏️ → Έκδοση: Νέα έκδοση → Ανάπτυξη (το link μένει ίδιο).
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Somnio Control')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** Τα τελευταία αποτελέσματα (από το «_web»). Αν δεν υπάρχουν ακόμα, κάνει ενημέρωση. */
function webData() {
  var sh = ccSs_().getSheetByName('_web');
  var txt = sh ? String(sh.getRange(1, 1).getValue() || '') : '';
  if (!txt) return ccRefresh_();
  try { return JSON.parse(txt); } catch (e) { return ccRefresh_(); }
}

/** Κουμπί «Ενημέρωση τώρα». */
function webRefresh() { return ccRefresh_(); }

/** Το link της εφαρμογής (για το email και το μενού). */
function ccAppUrl_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }

function showAppLink() {
  var u = ccAppUrl_();
  SpreadsheetApp.getUi().alert(u ? 'Link εφαρμογής:\n\n' + u + '\n\nΣτο κινητό: άνοιξέ το → Κοινοποίηση/⋮ → «Προσθήκη στην αρχική οθόνη».'
    : 'Η εφαρμογή δεν έχει δημοσιευτεί ακόμα: Apps Script → Ανάπτυξη → Νέα ανάπτυξη → Εφαρμογή ιστού.');
}
