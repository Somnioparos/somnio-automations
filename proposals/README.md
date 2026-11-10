# Proposals 2027 — προτάσεις διαμονής σε πελάτες και agencies

Ροή: tab **Αίτημα** → **1. Διαθεσιμότητα & τιμές** (Hosthub: διαθεσιμότητα + τιμή ανά νύχτα του βασικού rate plan, που γράφει η Beyond) → tab **Ακίνητα** (✅ επιλογή, ✏️ δική μου τιμή) → **2. Δημιουργία πρότασης** (δικό της link `…/exec?p=<id>`, γραμμή στο **Ιστορικό**, κάρτα Trello) → **3. Αποστολή email**.

- Χαρακτηριστικά από Master Properties (Listing_ID, Max_Guests, Bedrooms, Bathrooms, Pool, Sea_View, Area, Property_URL). Agencies από Master Properties › Agencies.
- Agency: τιμή προσφοράς = Hosthub × (1 + `PROPOSAL_AGENCY_MARKUP`, προεπιλογή 10%) — **προς επιβεβαίωση**.
- Ακυρωμένες κρατήσεις δεν μπλοκάρουν διαθεσιμότητα (διόρθωση σε σχέση με το 2026).
- Script Properties: `HOSTHUB_API_KEY`, (προαιρετικά) `TRELLO_KEY`, `TRELLO_TOKEN`. Config: `FILE_PROPOSALS`, `PROPOSAL_WEBAPP_URL`, `TRELLO_LIST_ID`, `PROPOSAL_AGENCY_MARKUP`.
- Web App: Εκτέλεση ως Εγώ · Πρόσβαση **Οποιοσδήποτε** (οι πελάτες δεν έχουν λογαριασμό Google).
