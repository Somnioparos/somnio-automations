# Owner Invoicing 2027

**Αρχείο:** `Owner Invoicing 2027` · ID `1Z-gZAH7MiBh_7qYouTbnKhTiGpMu95vF9jclw_aKWhE` · Shared Drive / 03 Invoicing
**Config:** `FILE_OWNER_INVOICING` · (Oxygen) `OXYGEN_ENV` = sandbox|production · `OXYGEN_SERIES_INVOICE` = ΠΡΟΜ · `OXYGEN_SERIES_RECEIPT` = ΑΠΥ · προαιρετικά `BANK_DETAILS` (κείμενο με IBAN στο τέλος του email).
**Script Property:** `OXYGEN_API_KEY` (μόνο εκεί — ποτέ στο GitHub/chat).
Κώδικας: `Invoicing.gs` (ουρά, έλεγχοι, email, Gmail draft) · `Oxygen.gs` (σύνδεση Oxygen — 9/11 μόνο δοκιμή σύνδεσης).

## Tab «Τιμολόγηση» — μία γραμμή ανά κράτηση ιδιοκτήτη (Hosthub, όχι Direct Cash)
Κατάσταση: Μελλοντική → Λείπουν στοιχεία → **Έτοιμο για έκδοση** → Εκδόθηκε → Στάλθηκε (ή Σε αναμονή με ✋).
- Παραστατικό: Issue_Invoice του Master Properties (Εταιρεία → Τιμολόγιο, Φυσικό → Απόδειξη).
- Γραμμή 1: προμήθεια Somnio + ΦΠΑ 24%. Γραμμή 2 (μόνο Airbnb + Τιμολόγιο): προμήθεια Airbnb + ΦΠΑ 24%.
- Προς πληρωμή = προμήθεια + ΦΠΑ των δύο γραμμών (π.χ. Mirabilia 2.203,88 → 1.353,17). Το email το εξηγεί ρητά.
- Έλεγχοι: διαβατήριο (Hosthub) · voucher στο φάκελο Vouchers (όνομα αρχείου με τον κωδικό κράτησης) · Owner_Email · για Τιμολόγιο ΑΦΜ 9 ψηφία, επωνυμία, ΔΟΥ, διεύθυνση.
- Κρατιούνται ανά κράτηση: ✋ Αναμονή, Σημείωση, Αρ. παραστατικού, ΜΑΡΚ, PDF, Εκδόθηκε, Email στάλθηκε.

## Μενού «Somnio Invoicing»
1. Στήσιμο · 2. Ενημέρωση · 3. Gmail draft για την επιλεγμένη γραμμή (voucher + PDF όταν υπάρχει, cc λογιστή — δεν στέλνει) · Oxygen: δοκιμή σύνδεσης · Αυτόματο ON (~08:55).

## Επόμενο (όταν έρθει το Sandbox API Key)
Ροή: Δοκιμή σύνδεσης → «4. Έκδοση» (επαφή με ΑΦΜ/ΓΓΠΣ → POST /invoices → ΜΑΡΚ → PDF στο Drive) → «5. Αποστολή email» (PDF + voucher, cc λογιστή, voucher → Sent). Στο sandbox το email πάει μόνο στον χρήστη. Σχήμα API: https://docs.oxygen.gr/openapi.json.
Ανοιχτά για τον λογιστή: τύπος παραστατικού και χαρακτηρισμός εσόδου (E3) ανά γραμμή, ΦΠΑ στη γραμμή Airbnb.
