// cypress/e2e/api_health.cy.js

describe("Health API", () => {
  it("GET /health returns 200 and JSON", () => {
    cy.request("/health").then((res) => {
      expect(res.status).to.eq(200);
      expect(res.headers["content-type"]).to.include("application/json");
      expect(res.body).to.be.an("object");
    });
  });
});
