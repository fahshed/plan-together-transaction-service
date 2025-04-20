function computeLedger(transactions) {
  const balances = {}; // balances[borrowerId][lenderId] = net owed amount
  const users = {}; // users[userId] = { name }

  transactions.forEach((tx) => {
    if (tx.type === "settlement") {
      const { from, to, amount } = tx;
      balances[from] = balances[from] || {};
      balances[from][to] = (balances[from][to] || 0) - amount;
      return;
    }

    const payerId = tx.paidBy.userId;
    users[payerId] = tx.paidBy;

    const share = tx.amount / tx.splitBetween.length;
    tx.splitBetween.forEach((person) => {
      users[person.userId] = person;
      if (person.userId === payerId) return;
      balances[person.userId] = balances[person.userId] || {};
      balances[person.userId][payerId] =
        (balances[person.userId][payerId] || 0) + share;
    });
  });

  const seen = new Set();
  const ledger = [];

  Object.entries(balances).forEach(([borrowerId, owes]) => {
    // eslint-disable-next-line complexity
    Object.entries(owes).forEach(([lenderId, amt]) => {
      const key = `${borrowerId}_${lenderId}`;
      if (seen.has(key)) return;

      const reverseAmt = balances[lenderId]?.[borrowerId] || 0;
      const netAmt = amt - reverseAmt;

      if (netAmt > 0.009) {
        ledger.push({
          borrower: {
            userId: borrowerId,
            name: users[borrowerId]?.name || borrowerId,
          },
          lender: {
            userId: lenderId,
            name: users[lenderId]?.name || lenderId,
          },
          amount: parseFloat(netAmt.toFixed(2)),
        });
      } else if (netAmt < -0.009) {
        ledger.push({
          borrower: {
            userId: lenderId,
            name: users[lenderId]?.name || lenderId,
          },
          lender: {
            userId: borrowerId,
            name: users[borrowerId]?.name || borrowerId,
          },
          amount: parseFloat(Math.abs(netAmt).toFixed(2)),
        });
      }

      seen.add(key);
      seen.add(`${lenderId}_${borrowerId}`);
    });
  });

  return ledger;
}

module.exports = { computeLedger };
