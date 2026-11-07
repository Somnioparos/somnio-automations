# Master Properties 2027

Google Sheet **Master Properties 2027** (Shared Drive / 01 Data) — ID `1F2T5YC6VByP8VXWAGeP9dXasG4FUSLq8kY8qZvLHXug`

Η μοναδική πηγή για ακίνητα, ιδιοκτήτες, ΑΦΜ, τύπο ιδιοκτήτη, προμήθειες, τέλη και agencies. Όλα τα άλλα αρχεία διαβάζουν από εδώ.

## Tabs
- **Properties** — μία γραμμή ανά ακίνητο. Κίτρινα = συμπληρώνουν οι χρήστες· γκρι = γράφει το σύστημα (Hosthub_Name, Listing_ID, Oxygen_Contact_ID).
- **Agencies** — ποσοστά ανά agency (Φάση 1/2).
- **Έλεγχος** — ό,τι λείπει ανά ενεργό ακίνητο (από το μενού 3).

## Script (`MasterProperties.gs`)
- Βιβλιοθήκη: SomnioCore (HEAD). Script Property: `HOSTHUB_API_KEY`.
- Μενού **Somnio Properties**: 1. Στήσιμο · 2. Ενημέρωση από Hosthub · 3. Έλεγχος πληρότητας.
- Δεν σβήνει ποτέ δεδομένα χρηστών.

## Κανόνες
- Commission_% κενό = 20% (Config DEFAULT_COMMISSION). «Δικό μας» = χωρίς προμήθεια.
- Issue_Invoice: Εταιρεία → Τιμολόγιο · Φυσικό → Απόδειξη · Δικό μας → Δεν εφαρμόζεται.
- Ιδιοκτήτες-εταιρείες με κρατήσεις Airbnb: επανατιμολόγηση προμήθειας Airbnb (βλ. invoicing/).
