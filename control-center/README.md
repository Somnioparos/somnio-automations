# Control Center 2027

Μία σελίδα για το «τι χρειάζεται προσοχή σήμερα». **Μόνο διαβάζει** από τα υπόλοιπα αρχεία.

- Tab **Σήμερα**: 1) Χρειάζεται προσοχή (🔴/🟠/🟡) · 2) Αφίξεις/αναχωρήσεις σήμερα & αύριο (+ διαβατήριο) · 3) Χρήματα (Ledger, Εισπράξεις, Τιμολόγια) · 4) Επιδόσεις έτους ανά μήνα · 5) Υγεία αυτοματισμών (Config › Health).
- Tab **Εκκρεμότητες**: όλα τα tabs «Έλεγχος» + ό,τι βγαίνει από Ledger/Εισπράξεις/Τιμολόγηση/Health, με link στο αρχείο.
- Αυτόματα ~09:10. Email στο ALERT_EMAIL όταν υπάρχει 🔴 (ή κάθε μέρα με `CC_DAILY_EMAIL = YES`).
- `CC_IGNORE` στο Config: λέξεις (με κόμμα) που κρύβουν εκκρεμότητες, π.χ. `AMA`.

Στήσιμο: νέο Google Sheet «Control Center 2027» στο Shared Drive › 04 Outputs · Apps Script: ControlCenter.gs + appsscript.json (SomnioCore) · Config `FILE_CONTROL_CENTER` = id · μενού Somnio Control → 1. Στήσιμο → Αυτόματη ενημέρωση ON.
