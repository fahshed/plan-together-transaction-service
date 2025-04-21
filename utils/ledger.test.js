const { computeLedger } = require("./ledger");

describe("computeLedger", () => {
  it("should calculate balances from a single expense", () => {
    const transactions = [
      {
        type: "expense",
        amount: 60,
        paidBy: { userId: "u1", name: "Alice" },
        splitBetween: [
          { userId: "u1", name: "Alice" },
          { userId: "u2", name: "Bob" },
        ],
      },
    ];

    const ledger = computeLedger(transactions);

    expect(ledger).toEqual([
      {
        borrower: { userId: "u2", name: "Bob" },
        lender: { userId: "u1", name: "Alice" },
        amount: 30,
      },
    ]);
  });

  it("should net out mutual debts correctly", () => {
    const transactions = [
      {
        type: "expense",
        amount: 60,
        paidBy: { userId: "u1", name: "Alice" },
        splitBetween: [
          { userId: "u1", name: "Alice" },
          { userId: "u2", name: "Bob" },
        ],
      },
      {
        type: "expense",
        amount: 40,
        paidBy: { userId: "u2", name: "Bob" },
        splitBetween: [
          { userId: "u1", name: "Alice" },
          { userId: "u2", name: "Bob" },
        ],
      },
    ];

    const ledger = computeLedger(transactions);

    expect(ledger).toEqual([
      {
        borrower: { userId: "u2", name: "Bob" },
        lender: { userId: "u1", name: "Alice" },
        amount: 10,
      },
    ]);
  });

  it("should apply settlements to reduce balances", () => {
    const transactions = [
      {
        type: "expense",
        amount: 60,
        paidBy: { userId: "u1", name: "Alice" },
        splitBetween: [
          { userId: "u1", name: "Alice" },
          { userId: "u2", name: "Bob" },
        ],
      },
      {
        type: "settlement",
        from: "u2",
        to: "u1",
        amount: 10,
      },
    ];

    const ledger = computeLedger(transactions);

    expect(ledger).toEqual([
      {
        borrower: { userId: "u2", name: "Bob" },
        lender: { userId: "u1", name: "Alice" },
        amount: 20,
      },
    ]);
  });

  it("should return empty ledger when fully settled", () => {
    const transactions = [
      {
        type: "expense",
        amount: 60,
        paidBy: { userId: "u1", name: "Alice" },
        splitBetween: [
          { userId: "u1", name: "Alice" },
          { userId: "u2", name: "Bob" },
        ],
      },
      {
        type: "settlement",
        from: "u2",
        to: "u1",
        amount: 30,
      },
    ];

    const ledger = computeLedger(transactions);
    expect(ledger).toEqual([]);
  });
});
