# Master File 2027

**Αρχείο:** `Master File 2027` · ID `1beMSRPgZYv4VpfIH2L8_pAyS7L74_gJ375VngYut-8Y` · Shared Drive / 01 Data
**Config:** `FILE_MASTER_FILE` = το παραπάνω ID.

Η μοναδική λίστα κρατήσεων 2027. Τη γράφει **μόνο** αυτό το script (Hosthub API + tab `Direct_Cash`).
Όλα τα άλλα αρχεία τη διαβάζουν από τα ονόματα των στηλών.

## Αρχεία κώδικα (Apps Script του Sheet)
| Αρχείο | Τι είναι |
|---|---|
| `MasterFile.gs` | Sync, υπολογισμοί, Direct Cash, Έλεγχος, μενού |
| `Countries.gs` | Κωδικός χώρας → όνομα |
| `appsscript.json` | Ζώνη ώρας Αθήνας + βιβλιοθήκη SomnioCore |

Script Property: `HOSTHUB_API_KEY` (ποτέ στο GitHub).

## Tabs
- **Bookings** — μία γραμμή ανά κράτηση. **Δεν γράφει κανείς εδώ.** Διαβατήριο, email, τηλέφωνο, χώρα και σημειώσεις καταχωρούνται στη Hosthub και περνούν στο επόμενο sync. Ειδικό ποσοστό: γραμμή `COMMISSION: 15` στα Notes της κράτησης. Agency: γραμμή `AGENCY: <όνομα>`.
- **Direct_Cash** — κρατήσεις εκτός Hosthub. Γράφεις Residence (λίστα), ημερομηνίες, επισκέπτη, **Ποσό**. Προαιρετικά ποσοστό ή σταθερό ποσό προμήθειας. Το `DC_ID` μπαίνει αυτόματα και μένει σταθερό (αλλαγή ημερομηνίας δεν φτιάχνει διπλή κράτηση).
- **Έλεγχος** — ξαναγράφεται σε κάθε sync: λείπει διαβατήριο (check-in μέσα σε 3 μέρες ή ήδη έγινε), άγνωστη agency, άγνωστο ακίνητο, λείπει Owner_Type, ελλιπές Direct Cash.

## Κανόνες υπολογισμού
- `Owner_Type`, `Residence`, `Commission_%` από **Master Properties 2027** (ταίριασμα με `Listing_ID`).
- `Comm_Rate`: `Comm_Rate_Override` → agency (tab Agencies, «Προμήθεια Somnio %») → `Commission_%` ακινήτου → `DEFAULT_COMMISSION`.
- Εταιρεία: βάση = Net_Price − τραπεζικά − προμήθεια πλατφόρμας. Φυσικό: βάση = Gross_Value − τραπεζικά − προμήθεια πλατφόρμας (όπως 2026).
- `Comm_Net` = βάση × ποσοστό · `Comm_VAT` = 24% · `Comm_Total`.
- **Airbnb + Εταιρεία:** `Airbnb_Fee_Recharge` = service_fee_host, `Airbnb_Fee_VAT` = 24%. `Invoice_Total` = Comm_Total + Recharge + Recharge VAT. `Owner_Payable` = Comm_Total + Recharge VAT (π.χ. 868 € τιμολόγιο → 568 € πληρωμή).
- Δικό μας: `Company_Revenue` = Total value − πλατφόρμα − ΦΠΑ − δημοτικός − ΤΑΑ − τραπεζικά.
- Direct Cash: χωρίς φορολογική ανάλυση, χωρίς ΦΠΑ προμήθειας (όπως 2026).
- Ακυρωμένες: κόκκινες, χωρίς προμήθεια.
- Agency: γραμμή `AGENCY: <όνομα>` στα Notes της κράτησης στη Hosthub.

## Sync
- Αυξητικό (`updated_gte`, 24h επικάλυψη). Αν μια κράτηση δεν άλλαξε στη Hosthub (`hh_updated`), δεν ξαναδιαβάζεται.
- Μόνο check-in ≥ `MIN_CHECKIN` (Config), και οι μελλοντικές. Owner blocks (`SKIP_GUESTS`, προεπιλογή «tade») εξαιρούνται.
- Αν κοπεί στα 4,5' → «ΜΕΡΙΚΟ»· το αυτόματο συνεχίζει μόνο του σε 1', αλλιώς ξανά «2. Sync τώρα».
- Κάθε τρέξιμο → Log/Health στο Config· αποτυχία → email.

## Πρώτο στήσιμο
1. Extensions → Apps Script. `appsscript.json` (Project Settings → Show manifest) → επικόλληση.
2. `Code.gs` → μετονομασία `MasterFile`, επικόλληση `MasterFile.gs`. Νέο αρχείο `Countries` → επικόλληση `Countries.gs`. Save.
3. Project Settings → Script Properties → `HOSTHUB_API_KEY`.
4. Πίσω στο Sheet, ανανέωση → μενού **Somnio Master** → 1. Στήσιμο → 2. Sync τώρα (ίσως 2–3 φορές την πρώτη) → 5. Αυτόματο sync ON.
