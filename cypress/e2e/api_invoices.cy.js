// cypress/e2e/api_invoices.cy.js

const { futureIsoDate, pastIsoDate, buildInvoicePayload, uniqueSuffix } =
  require("../support/commands");

describe("Invoices API", () => {
  it("GET /invoices?limit=5 returns up to 5 items and a next_cursor field", () => {
    cy.request({
      method: "GET",
      url: "/invoices",
      qs: { limit: 5 }
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property("items");
      expect(res.body.items).to.be.an("array");
      expect(res.body.items.length).to.be.lte(5);
      expect(res.body).to.have.property("next_cursor"); // can be null
    });
  });

  it("can create a new unpaid invoice (happy path)", () => {
    const payload = buildInvoicePayload({
      amount_minor: 2500,
      due_date_iso: futureIsoDate(2)
    });

    cy.request({
      method: "POST",
      url: "/invoices",
      body: payload
    }).then((res) => {
      expect(res.status).to.eq(201);
      expect(res.body).to.include({
        id: payload.id,
        customer_id: payload.customer_id,
        currency: payload.currency,
        amount_minor: payload.amount_minor,
        status: "unpaid"
      });
      expect(res.body.due_date_iso).to.be.a("string");
    });
  });

  it("returns 409 when creating an invoice with a duplicate id", () => {
    const suffix = uniqueSuffix();
    const payload = buildInvoicePayload({
      id: `inv_dup_${suffix}`
    });

    // First one succeeds
    cy.request({
      method: "POST",
      url: "/invoices",
      body: payload
    }).then((firstRes) => {
      expect(firstRes.status).to.eq(201);

      // Second should conflict
      cy.request({
        method: "POST",
        url: "/invoices",
        body: payload,
        failOnStatusCode: false
      }).then((secondRes) => {
        expect(secondRes.status).to.eq(409);
        expect(secondRes.body).to.have.property("error");
        expect(secondRes.body.error).to.have.property("code");
        expect(secondRes.body.error).to.have.property("message");
      });
    });
  });

  it("returns 400 when creating an invoice with an invalid payload", () => {
    const badPayload = {
      // missing required fields and invalid date format
      due_date_iso: "not-a-date",
      status: "unpaid"
    };

    cy.request({
      method: "POST",
      url: "/invoices",
      body: badPayload,
      failOnStatusCode: false
    }).then((res) => {
      expect(res.status).to.eq(400);
      expect(res.body).to.have.property("error");
      expect(res.body.error).to.have.property("code");
      expect(res.body.error).to.have.property("message");
    });
  });

  it("can fetch an existing invoice by id", () => {
    cy.apiCreateInvoice({ amount_minor: 1293 }).then((invoice) => {
      cy.request({
        method: "GET",
        url: `/invoices/${encodeURIComponent(invoice.id)}`
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.include({
          id: invoice.id,
          customer_id: invoice.customer_id,
          currency: invoice.currency,
          amount_minor: invoice.amount_minor
        });
      });
    });
  });

  it("returns 404 for a non-existent invoice", () => {
    const fakeId = `inv_missing_${uniqueSuffix()}`;

    cy.request({
      method: "GET",
      url: `/invoices/${encodeURIComponent(fakeId)}`,
      failOnStatusCode: false
    }).then((res) => {
      expect(res.status).to.eq(404);
      expect(res.body).to.have.property("error");
      expect(res.body.error).to.have.property("code");
      expect(res.body.error).to.have.property("message");
    });
  });

  it("documents behaviour for an invoice with a past due_date_iso (expiry assumption)", () => {
    const payload = buildInvoicePayload({
      due_date_iso: pastIsoDate(2)
    });

    cy.request({
      method: "POST",
      url: "/invoices",
      body: payload
    }).then((createRes) => {
      expect(createRes.status).to.eq(201);

      cy.request({
        method: "GET",
        url: `/invoices/${encodeURIComponent(payload.id)}`
      }).then((getRes) => {
        expect(getRes.status).to.eq(200);
        // Depending on implementation this may or may not read 'expired';
        // we at least assert it's one of the allowed statuses.
        expect(["unpaid", "paid", "expired", "void"]).to.include(
          getRes.body.status
        );
      });
    });
  });
});
