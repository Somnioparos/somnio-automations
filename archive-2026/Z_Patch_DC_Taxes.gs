/**
 * PATCH — Direct Cash χωρίς φορολογική διάσπαση (26/08/2026)
 *
 * ΟΔΗΓΙΕΣ: Στο Apps Script του Master: Files → [+] → Script → όνομα "Z_Patch"
 * → επικόλλησε ΟΛΟ αυτό το περιεχόμενο → Ctrl+S.
 * Μετά, από το dropdown συναρτήσεων επάνω, διάλεξε clearDcTaxes → Run (μία φορά).
 *
 * Τι κάνει:
 *  1. Αντικαθιστά το deriveRow_ με έκδοση ΧΩΡΙΣ τη διάσπαση ΦΠΑ στα Direct Cash
 *     (επειδή το αρχείο αυτό φορτώνει τελευταίο, η δική του έκδοση υπερισχύει).
 *     Όλα τα υπόλοιπα ίδια: αυτόματο Payout/Value/Paid, Comm_Rate%, χειροκίνητο
 *     ποσό προμήθειας, προμήθεια cash χωρίς ΦΠΑ.
 *  2. Προσθέτει τη clearDcTaxes: καθαρίζει Net/VAT/City/Env/AADE/Gross από τις
 *     υπάρχουσες DC γραμμές του Bookings.
 */

// -- deriveRow_ (OVERRIDE: xoris forologiki diaspasi sta DC) -----------------------

function deriveRow_(r) {
  var num = function(v){ var x = Number(v); return isNaN(x) ? 0 : x; };
  var ownerType = normOwner_(r[27]);
  r[27] = ownerType;
  var net = num(r[21]), gross = num(r[26]), env = num(r[24]), bank = num(r[18]),
      chan = Math.abs(num(r[19])), tv = num(r[16]), vat = num(r[22]), city = num(r[23]);

  var isDC = String(r[EVENT_IDX] || '').indexOf('DC|') === 0;
  if (isDC) {
    var pay = num(r[15]) || num(r[17]) || num(r[16]);
    if (!num(r[15])) r[15] = pay;   // Total payout
    if (!num(r[16])) r[16] = pay;   // Total value
    if (!num(r[17])) r[17] = pay;   // Guest paid
    // Oi Direct Cash DEN pairnoun forologiki diaspasi — Net/FPA/City/Env menoun kena
    if (!net) net = pay; if (!gross) gross = pay; if (!tv) tv = pay;
  }

  var base='', comm='', commVat='', commTotal='', compRev='';
  if (ownerType === 'Εταιρεία') { base = net - bank - chan; }
  else if (ownerType === 'Φυσικό') { base = (gross || net) - bank - chan; }
  if (base !== '') {
    base = Math.round(base * 100) / 100;
    var manualComm = (isDC && String(r[COMMRATE_IDX] || '') === '' && num(r[29]) > 0) ? num(r[29]) : 0;
    comm = manualComm ? manualComm
                      : Math.round(base * commRate_(r[COMMRATE_IDX]) * 100) / 100;
    if (isDC) {
      commVat = 0; commTotal = comm;   // cash: xoris FPA
    } else {
      commVat = Math.round(comm * COMMISSION_VAT * 100) / 100;
      commTotal = Math.round((comm + commVat) * 100) / 100;
    }
  }
  if (ownerType === 'Δικό μας') { compRev = Math.round((tv - chan - vat - city - env - bank) * 100) / 100; }
  else if (comm !== '') { compRev = comm; }
  r[28] = base; r[29] = comm; r[30] = commVat; r[31] = commTotal; r[32] = compRev;
  return r;
}

// -- clearDcTaxes (one-off) --------------------------------------------------------

function clearDcTaxes() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_BOOKINGS);
  if (!sh) return;
  var last = sh.getLastRow(); if (last < 2) return;
  var vals = sh.getRange(2, 1, last - 1, TOTAL_COLS).getValues();
  var n = 0;
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (String(r[EVENT_IDX] || '').indexOf('DC|') !== 0) continue;
    if (String(r[21]) === '' && String(r[22]) === '') continue;   // idi kena
    sh.getRange(2 + i, 22, 1, 6).setValues([['', '', '', '', '', '']]);   // Net..Gross
    n++;
  }
  SpreadsheetApp.getUi().alert('Katharistikan oi foroi apo ' + n + ' Direct Cash grammes.');
}
