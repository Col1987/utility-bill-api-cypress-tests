# Utility Bill Pay – Cypress API Test Suite

This repository contains a complete, automated **API test suite** for the Utility Bill Pay technical assignment.  
The solution is written in **Cypress** and is designed to run:

- Locally (Node.js)
- Via the Cypress Runner (GUI)
- Fully headless in **Docker** using the official `cypress/included` image

The suite covers all endpoints defined in the Swagger, including valid flows, error handling, idempotency, invalid states, and the special **amount-based rule** (payments fail when `amount_minor` ends in 3 or 7), tested thoroughly using **Boundary Value Analysis (BVA)**.

---

## 📌 Scope of API Coverage

### **Health**
- `GET /health`
  - Validates service availability, JSON content-type, and status `200`.

---

## **Invoices**

### ✔ Happy Path  
- `POST /invoices` → Creates invoice (`unpaid`)
- `GET /invoices/{id}` → Returns correct invoice fields  

### ✔ Error Handling  
- Invalid payload → `400`  
- Duplicate invoice → `409`  
- Non-existent invoice → `404`  

### ✔ Pagination  
- `GET /invoices?limit=5`  
  - Ensures list length ≤ limit  
  - Confirms presence of `next_cursor`  

### ✔ Expiry Logic (Observation Test)  
Creates invoice with **past `due_date_iso`** to observe whether system marks it `expired`.

---

## **Payments**

### ✔ Payment Attempts  
- Valid invoice → `201`, `pending`  
- Missing invoice → `404`  

### ✔ Confirmation  
- With `X-Mock-Outcome: success` → `200`  
- With `X-Mock-Outcome: fail` → `400/402/422`  
- Missing attempt → `404 ATTEMPT_NOT_FOUND`  

### ✔ Idempotency  
- Reusing same `Idempotency-Key` returns **same attempt**, not a duplicate.  

### ✔ Invalid State  
- Paying an already-paid invoice triggers a 4xx (`400 / 409 / 422`) depending on implementation.

---

## ✔ Amount-Based Rule (Boundary Value Analysis)

Business rule:

> Payments **fail** when `amount_minor` ends in **3 or 7**, and succeed otherwise.

Tests include:

- Low boundaries: `2, 3, 4`  
- High boundaries: `6, 7, 8`  
- Extended: `102, 103, 104`, `106, 107, 108`

These are implemented in:  
`cypress/e2e/api_payments_amount_rule.cy.js`

This verifies "before/on/after" transitions around the failing digits.

---

## 🧰 Technology Stack

- Node.js + npm  
- Cypress 13.15.0  
- Docker using `cypress/included:13.15.0`  
- Visual Studio Code  

---

## 📁 Project Structure

```text
utility-bill-api-cypress-tests/
│
├── cypress/
│   ├── e2e/
│   │   ├── api_health.cy.js
│   │   ├── api_invoices.cy.js
│   │   ├── api_payments.cy.js
│   │   └── api_payments_amount_rule.cy.js   # BVA rule tests
│   │
│   └── support/
│       ├── commands.js
│       └── e2e.js
│
├── cypress.config.js
├── Dockerfile
├── package.json
└── README.md
```

---

# 🚀 Running Tests Locally

### 1. Install dependencies
```bash
npm install
```

### 2. Install Cypress binary
```bash
npx cypress install
```

### 3. Run all tests (headless)
```bash
npm test
```

### 4. Open Cypress GUI
```bash
npm run cy:open
```

### 5. Override API base URL
```bash
CYPRESS_BASE_URL="https://api-t6vbon.bunnyenv.com" npx cypress run
```

---

# 🐳 Running Tests in Docker

### 1. Build the image
```bash
docker build -t utility-bill-api-tests .
```

### 2. Run tests
```bash
docker run --rm utility-bill-api-tests
```

### 3. Override API URL
```bash
docker run --rm   -e CYPRESS_BASE_URL="https://api-t6vbon.bunnyenv.com"   utility-bill-api-tests
```

---

# 🧪 Test Design Techniques Used

### ✔ Boundary Value Analysis (BVA)
- Tests around 3 and 7  
- Tests around 103 and 107  
- Ensures correct transitions “before/on/after”

### ✔ Equivalence Partitioning
- Failure: values ending in 3 or 7  
- Success: all other digits  

### ✔ State Testing
- Payment → confirmation → invoice state  
- Prevent double payments  

### ✔ Negative Testing
- Invalid payloads  
- Duplicate IDs  
- Missing IDs  
- Wrong ID formats  

### ✔ Idempotency
- Same `Idempotency-Key` returns same attempt  

---

# 🔍 Assumptions

- Backend may not automatically update invoice to `paid` after payment  
- Error codes may vary (`400`, `402`, `422`)  
- Expiry logic determined by observed behaviour  
- Tests avoid assuming undocumented logic  

---

## 🛑 Out of Scope (Intentional Exclusions)

The following areas were intentionally left out of this assignment to ensure focus, depth, and relevance to the core API behaviours defined in the Swagger documentation:

### **UI Testing**
UI-level tests were not included because:
- Given the time constraints, API tests provide **higher risk‐based coverage**, validating logic, state transitions, error handling, and integration points far earlier than UI tests could.

Focusing on API behaviour ensures:
- Faster feedback loops  
- More stable and deterministic test results  
- A deeper validation of business rules (expiry, idempotency, amount-based rejection rules)  
 

---

### **Performance & Load Testing**
Not included due to:
- Lack of performance SLAs  
- No stable environment for stress/load scenarios  
- Exercise scope focused on correctness, not throughput  

These would normally be executed using tools like k6, Gatling, or JMeter.

---

### **Security / Authentication Testing**
Omitted because:
- Endpoints are fully open (no OAuth/token flows)  
- No security model or threat profile was included in the assignment  

Such tests would normally include:
- Auth handling  
- Permission boundaries  
- Rate-limit behaviour  
- Input sanitisation  

---

### **Full Contract Testing Against JSON Schema**
Swagger examples are valid but do not define strict JSON schema contracts for:
- Field formats  
- Required attributes  
- Type constraints  

Contract testing (e.g., with Pact or Schema validators) was not included for this reason.

---

These exclusions were made deliberately and strategically to deliver **maximum functional coverage** of the highest-risk and most business-critical backend behaviours within the available time window.


  




