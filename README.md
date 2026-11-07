# Somnio Automations 2027

Ο κώδικας (Google Apps Script) όλων των αυτοματισμών της Somnio για το 2027.
Τα δεδομένα ζουν στα Google Sheets του Shared Drive **«Somnio Automations 2027»**· εδώ ζει μόνο ο κώδικας και η τεκμηρίωσή του.

> **Κανόνας ασφαλείας:** κανένα κλειδί API, κωδικός ή token δεν μπαίνει ποτέ σε αυτό το repository.
> Τα κλειδιά (Hosthub, Oxygen κ.λπ.) φυλάσσονται μόνο στα **Script Properties** κάθε script.

## Δομή

| Φάκελος | Αρχείο Google Sheet | Τι κάνει |
|---|---|---|
| `core/` | — (βιβλιοθήκη SomnioCore) | Κοινές λειτουργίες για όλα τα scripts: ανάγνωση Config, εύρεση στηλών από headers, Log, ειδοποιήσεις αποτυχίας |
| `config/` | Somnio — Config 2027 | Κωδικοί αρχείων, έτος, κοινές ρυθμίσεις |
| `master-properties/` | Master Properties 2027 | Ακίνητα, ιδιοκτήτες, προμήθειες, agencies |
| `master-file/` | Master File 2027 | Sync κρατήσεων από Hosthub + Direct Cash |
| `candy/` | Candy Recipes 2027 | Έξοδα, κινήσεις χρημάτων, concierge, λίστες |
| `financials/` | Somnio Financials 2027 | P&L, Cash flow, Occupancy, Στόχοι |
| `scheduling/` | Scheduling 2027 | Πρόγραμμα operations |
| `proposals/` | Somnio - Proposals | Προσφορές προς agencies / πελάτες |
| `invoicing/` | Owner Invoicing 2027 | Τιμολόγια προμήθειας μέσω Oxygen + email |
| `ledger/` | Owner Ledger | Οφειλές & υπόλοιπα ανά κράτηση και ιδιοκτήτη |
| `control-center/` | Control Center | Υγεία συστήματος, εκκρεμότητες, έγκριση μήνα |
| `owner-portal/` | Owner Portal | Απόδοση & εκκαθάριση ανά ιδιοκτήτη |
| `runbook/` | — | Continuity: τι κάνει κάθε αρχείο, συνηθισμένα σφάλματα, χειροκίνητες διαδικασίες |
| `archive-2026/` | — | Τα scripts του 2026, μόνο για αναφορά (δεν ανεβαίνουν πουθενά) |

## Πώς ανεβαίνει ο κώδικας στα Sheets

Κάθε φάκελος συνδέεται με το script του αντίστοιχου Sheet μέσω **clasp** (αρχείο `.clasp.json` με το scriptId).
Αλλαγή → commit εδώ → `clasp push` στο Sheet. Το ιστορικό του GitHub επιτρέπει επαναφορά σε οποιαδήποτε προηγούμενη έκδοση.

## Οδηγός στησίματος

Τα βήματα, οι έλεγχοι και οι αποφάσεις κάθε φάσης: Claude Doc «Somnio 2027 — Οδηγός στησίματος».
