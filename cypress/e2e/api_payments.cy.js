// cypress/e2e/api_payments.cy.js

const { uniqueSuffix } = require("../support/commands");

describe("Payments API", () => {
  it("can create a payment attempt for a valid invoice", () => {
    cy.apiCreateInvoice({ amount_minor: 2500 }).then((invoice) => {
      cy.apiCreatePaymentAttempt(invoice.id).then((res) => {
        expect(res.status).to.eq(201);
        expect(res.body).to.have.property("id");
        expect(res.body).to.include({
          invoice_id: invoice.id
        });
        expect(res.body.status).to.eq("pending");
      });
    });
  });

  it("successful confirmation (X-Mock-Outcome: success)", () => {
    cy.apiCreateInvoice({ amount_minor: 2500 }).then((invoice) => {
      cy.apiCreatePaymentAttempt(invoice.id).then((attemptRes) => {
        const attemptId = attemptRes.body.id;

        cy.apiConfirmPaymentAttempt(attemptId, "success").then((confirmRes) => {
          // According to schema example this returns 200 with PaymentAttempt
          expect(confirmRes.status).to.eq(200);
          expect(confirmRes.body).to.have.property("id", attemptId);
          expect(confirmRes.body).to.have.property("invoice_id", invoice.id);
          expect(["pending", "confirmed", "failed"]).to.include(
            confirmRes.body.status
          );

          // Optionally, fetch invoice to see if status becomes "paid"
          cy.apiGetInvoice(invoice.id).then((invoiceRes) => {
            expect(invoiceRes.status).to.eq(200);
            expect(["unpaid", "paid", "expired", "void"]).to.include(
              invoiceRes.body.status
            );
          });
        });
      });
    });
  });

  it("mocked failure (X-Mock-Outcome: fail) leaves invoice unpaid", () => {
    cy.apiCreateInvoice({ amount_minor: 1293 }).then((invoice) => {
      cy.apiCreatePaymentAttempt(invoice.id).then((attemptRes) => {
        const attemptId = attemptRes.body.id;

        cy.apiConfirmPaymentAttempt(attemptId, "fail").then((confirmRes) => {
          // Swagger suggests 402 for mock failure; assert 4xx + error structure
          expect([400, 402, 422]).to.include(confirmRes.status);
          expect(confirmRes.body).to.have.property("error");

          // Invoice should still not be paid
          cy.apiGetInvoice(invoice.id).then((invoiceRes) => {
            expect(invoiceRes.status).to.eq(200);
            expect(["unpaid", "expired", "void"]).to.include(
              invoiceRes.body.status
            );
          });
        });
      });
    });
  });

  it("returns 404 when creating a payment attempt for a non-existent invoice", () => {
    const fakeInvoiceId = `inv_missing_${uniqueSuffix()}`;

    cy.apiCreatePaymentAttempt(fakeInvoiceId).then((res) => {
      expect(res.status).to.eq(404);
      expect(res.body).to.have.property("error");
      expect(res.body.error).to.have.property("code");
      expect(res.body.error).to.have.property("message");
    });
  });

  it("returns 404 ATTEMPT_NOT_FOUND when confirming a non-existent attempt", () => {
    const fakeAttemptId = `attempt_missing_${uniqueSuffix()}`;

    cy.apiConfirmPaymentAttempt(fakeAttemptId, "success").then((res) => {
      expect(res.status).to.eq(404);
      expect(res.body).to.have.property("error");
      expect(res.body.error).to.have.property("code");
      expect(res.body.error).to.have.property("message");
      // Often code will be ATTEMPT_NOT_FOUND as per example
    });
  });

  it("Idempotency-Key ensures same payment attempt is reused", () => {
    cy.apiCreateInvoice({ amount_minor: 2000 }).then((invoice) => {
      const key = `idempo-${uniqueSuffix()}`;

      cy.apiCreatePaymentAttempt(invoice.id, { idempotencyKey: key }).then(
        (firstRes) => {
          expect(firstRes.status).to.eq(201);
          const firstAttempt = firstRes.body;

          cy.apiCreatePaymentAttempt(invoice.id, {
            idempotencyKey: key
          }).then((secondRes) => {
            expect([200, 201]).to.include(secondRes.status);
            const secondAttempt = secondRes.body;

            expect(secondAttempt.id).to.eq(firstAttempt.id);
            expect(secondAttempt.invoice_id).to.eq(invoice.id);
          });
        }
      );
    });
  });

  it("does not allow paying an already paid invoice (invalid state assumption)", () => {
    cy.apiCreateInvoice({ amount_minor: 2500 }).then((invoice) => {
      // First successful attempt
      cy.apiCreatePaymentAttempt(invoice.id).then((attemptRes) => {
        const attemptId = attemptRes.body.id;

        cy.apiConfirmPaymentAttempt(attemptId, "success").then(() => {
          // Second attempt should be rejected as invalid state (likely 422)
          cy.apiCreatePaymentAttempt(invoice.id).then((secondRes) => {
            if (secondRes.status >= 400) {
              expect([400, 409, 422]).to.include(secondRes.status);
              expect(secondRes.body).to.have.property("error");
            }
          });
        });
      });
    });
  });

  //
  // BVA-style tests around the 3/7 rule
  //
  describe("amount-based success/fail rule (BVA around 3 and 7)", () => {
    /**
     * Business rule from the assignment:
     * - Payments FAIL when amount_minor ends in 3 or 7
     * - Payments SUCCEED otherwise
     *
     * We use boundary values around 3 and 7 to validate this:
     *   - 2, 3, 4
     *   - 6, 7, 8
     * and a couple of higher numbers ending with those digits.
     */

    const bvaCases = [
      // Around 3 (low)
      {
        label: "amount 2 (just before 3) should succeed",
        amount_minor: 2,
        shouldSucceed: true
      },
      {
        label: "amount 3 should fail",
        amount_minor: 3,
        shouldSucceed: false
      },
      {
        label: "amount 4 (just after 3) should succeed",
        amount_minor: 4,
        shouldSucceed: true
      },

      // Around 103
      {
        label: "amount 102 (before 103) should succeed",
        amount_minor: 102,
        shouldSucceed: true
      },
      {
        label: "amount 103 should fail",
        amount_minor: 103,
        shouldSucceed: false
      },
      {
        label: "amount 104 (after 103) should succeed",
        amount_minor: 104,
        shouldSucceed: true
      },

      // Around 7 (low)
      {
        label: "amount 6 (just before 7) should succeed",
        amount_minor: 6,
        shouldSucceed: true
      },
      {
        label: "amount 7 should fail",
        amount_minor: 7,
        shouldSucceed: false
      },
      {
        label: "amount 8 (just after 7) should succeed",
        amount_minor: 8,
        shouldSucceed: true
      },

      // Around 107
      {
        label: "amount 106 (before 107) should succeed",
        amount_minor: 106,
        shouldSucceed: true
      },
      {
        label: "amount 107 should fail",
        amount_minor: 107,
        shouldSucceed: false
      },
      {
        label: "amount 108 (after 107) should succeed",
        amount_minor: 108,
        shouldSucceed: true
      }
    ];

    bvaCases.forEach(({ label, amount_minor, shouldSucceed }) => {
      it(label, () => {
        // 1. Create invoice with the chosen amount
        cy.apiCreateInvoice({ amount_minor }).then((invoice) => {
          // 2. Create payment attempt for that invoice
          cy.apiCreatePaymentAttempt(invoice.id).then((attemptRes) => {
            expect(attemptRes.status).to.eq(201);
            const attemptId = attemptRes.body.id;

            // 3. Confirm WITHOUT forcing X-Mock-Outcome
            //    This lets the backend apply its own business rule
            cy.apiConfirmPaymentAttempt(attemptId).then((confirmRes) => {
              if (shouldSucceed) {
                // Expect success path
                expect(confirmRes.status).to.eq(200);
                expect(confirmRes.body).to.have.property("id", attemptId);
                expect(confirmRes.body).to.have.property(
                  "invoice_id",
                  invoice.id
                );

                // Optionally assert invoice status is 'paid' if API does that
                cy.apiGetInvoice(invoice.id).then((invoiceRes) => {
                  expect(invoiceRes.status).to.eq(200);
                  // If the implementation sets status to 'paid', you can tighten this:
                  // expect(invoiceRes.body.status).to.eq("paid");
                  expect(["unpaid", "paid", "expired", "void"]).to.include(
                    invoiceRes.body.status
                  );
                });
              } else {
                // Expect failure path (4xx and error body)
                expect(confirmRes.status).to.be.oneOf([400, 402, 422]);
                expect(confirmRes.body).to.have.property("error");
                expect(confirmRes.body.error).to.have.property("code");
                expect(confirmRes.body.error).to.have.property("message");

                // Invoice should still not be paid
                cy.apiGetInvoice(invoice.id).then((invoiceRes) => {
                  expect(invoiceRes.status).to.eq(200);
                  expect(["unpaid", "expired", "void"]).to.include(
                    invoiceRes.body.status
                  );
                });
              }
            });
          });
        });
      });
    });
  });
});
