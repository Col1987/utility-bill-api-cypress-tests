// cypress/support/commands.js

// --- Small pure helpers ---

function uniqueSuffix() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function futureIsoDate(daysAhead = 1) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString();
}

function pastIsoDate(daysAgo = 1) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function buildInvoicePayload(overrides = {}) {
  const suffix = uniqueSuffix();

  return {
    id: overrides.id || `inv_${suffix}`,
    customer_id: overrides.customer_id || `c_${suffix}`,
    currency: overrides.currency || "AED",
    amount_minor:
      typeof overrides.amount_minor === "number" ? overrides.amount_minor : 1293,
    due_date_iso: overrides.due_date_iso || futureIsoDate(1),
    status: overrides.status || "unpaid"
  };
}

// --- Attach helpers as Cypress commands ---

Cypress.Commands.add("apiBuildInvoicePayload", (overrides = {}) => {
  return buildInvoicePayload(overrides);
});

/**
 * Create invoice (happy path) and assert 201/unpaid.
 * Resolves with the created invoice body.
 */
Cypress.Commands.add("apiCreateInvoice", (overrides = {}) => {
  const payload = buildInvoicePayload(overrides);

  return cy
    .request({
      method: "POST",
      url: "/invoices",
      body: payload
    })
    .then((res) => {
      expect(res.status).to.eq(201);
      expect(res.body).to.include({
        id: payload.id,
        customer_id: payload.customer_id,
        currency: payload.currency,
        amount_minor: payload.amount_minor,
        status: "unpaid"
      });
      return res.body;
    });
});

/**
 * GET invoice by ID.
 */
Cypress.Commands.add("apiGetInvoice", (id) => {
  return cy.request({
    method: "GET",
    url: `/invoices/${encodeURIComponent(id)}`,
    failOnStatusCode: false
  });
});

/**
 * Create a payment attempt for an invoice.
 * Optionally pass { idempotencyKey }.
 */
Cypress.Commands.add("apiCreatePaymentAttempt", (invoiceId, options = {}) => {
  const headers = {};
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  return cy
    .request({
      method: "POST",
      url: "/payments",
      headers,
      body: {
        invoice_id: invoiceId
      },
      failOnStatusCode: false
    })
    .then((res) => {
      return res;
    });
});

/**
 * Confirm a payment attempt with optional X-Mock-Outcome header.
 * outcome: "success" | "fail" | undefined
 */
Cypress.Commands.add("apiConfirmPaymentAttempt", (attemptId, outcome) => {
  const headers = {};
  if (outcome) {
    headers["X-Mock-Outcome"] = outcome;
  }

  return cy.request({
    method: "POST",
    url: `/payments/${encodeURIComponent(attemptId)}/confirm`,
    headers,
    body: "",
    failOnStatusCode: false
  });
});

// Export helpers so tests can also import if needed
module.exports = {
  uniqueSuffix,
  futureIsoDate,
  pastIsoDate,
  buildInvoicePayload
};
