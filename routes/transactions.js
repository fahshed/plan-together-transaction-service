const express = require("express");
const router = express.Router();

const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });

const { db, bucket } = require("../config/firebase");
const { computeLedger } = require("../utils/ledger");

router.post(
  "/trips/:tripId/events/:eventId",
  upload.single("receipt"),
  async (req, res) => {
    const { tripId, eventId } = req.params;
    const { description, amount, category, paidBy, splitBetween, createdAt } =
      req.body;

    if (!description || !amount || !paidBy || !splitBetween) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      let receiptUrl = null;
      if (req.file) {
        const fileName = `receipts/${tripId}/${Date.now()}_${
          req.file.originalname
        }`;
        const file = bucket.file(fileName);

        await file.save(req.file.buffer, {
          metadata: { contentType: req.file.mimetype },
        });

        await file.makePublic();
        receiptUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      }

      const transactionRef = db
        .collection(`trips/${tripId}/events/${eventId}/transactions`)
        .doc();

      const transaction = {
        id: transactionRef.id,
        description,
        amount: parseFloat(amount),
        category,
        paidBy: JSON.parse(paidBy),
        splitBetween: JSON.parse(splitBetween),
        createdAt,
        receiptUrl,
      };

      await transactionRef.set(transaction);

      res.status(201).json(transaction);
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to add transaction", details: err.message });
    }
  }
);

router.get("/trips/:tripId/events/:eventId", async (req, res) => {
  const { tripId, eventId } = req.params;

  try {
    const snapshot = await db
      .collection(`trips/${tripId}/events/${eventId}/transactions`)
      .orderBy("createdAt", "desc")
      .get();

    const transactions = snapshot.docs.map((doc) => doc.data());

    res.json(transactions);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch transactions", details: err.message });
  }
});

router.get("/trips/:tripId/ledger", async (req, res) => {
  const { tripId } = req.params;

  try {
    const eventsSnap = await db.collection(`trips/${tripId}/events`).get();
    const eventIds = eventsSnap.docs.map((d) => d.id);

    const txSnaps = await Promise.all(
      eventIds.map((eventId) =>
        db.collection(`trips/${tripId}/events/${eventId}/transactions`).get()
      )
    );

    const transactions = txSnaps.flatMap((snap) =>
      snap.docs.map((doc) => ({ type: "expense", ...doc.data() }))
    );

    const settlementsSnap = await db
      .collection(`trips/${tripId}/settlements`)
      .get();

    const settlements = settlementsSnap.docs.map((doc) => ({
      type: "settlement",
      ...doc.data(),
    }));

    const allRecords = [...transactions, ...settlements];
    const ledger = computeLedger(allRecords);

    res.json(ledger);
  } catch (err) {
    console.error("Failed to build trip ledger:", err);
    res
      .status(500)
      .json({ error: "Failed to compute ledger", details: err.message });
  }
});

router.post("/trips/:tripId/settlements", async (req, res) => {
  const { tripId } = req.params;
  const { from, to, amount, createdAt } = req.body;

  if (!from || !to || !amount) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const settlementRef = db.collection(`trips/${tripId}/settlements`).doc();

    const settlement = {
      id: settlementRef.id,
      amount: parseFloat(amount),
      from,
      to,
      settledBy: req.user.id || null,
      createdAt,
    };

    await settlementRef.set(settlement);
    res.status(201).json(settlement);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to record settlement", details: err.message });
  }
});

router.get("/trips/:tripId/expenses/by-category", async (req, res) => {
  const { tripId } = req.params;

  try {
    const eventsSnap = await db.collection(`trips/${tripId}/events`).get();
    const eventIds = eventsSnap.docs.map((doc) => doc.id);

    const txSnaps = await Promise.all(
      eventIds.map((eventId) =>
        db.collection(`trips/${tripId}/events/${eventId}/transactions`).get()
      )
    );

    const transactions = txSnaps.flatMap((snap) =>
      snap.docs.map((doc) => doc.data())
    );

    const categoryTotals = {};

    transactions.forEach((tx) => {
      const category = tx.category || "Uncategorized";
      const amount = parseFloat(tx.amount);
      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
      }
      categoryTotals[category] += amount;
    });

    const result = Object.entries(categoryTotals).map(([category, total]) => ({
      category,
      expense: parseFloat(total.toFixed(2)),
      label: categoryLabelMap[category] || category,
    }));

    res.json(result);
  } catch (err) {
    console.error("Error aggregating expenses by category:", err);
    res.status(500).json({
      error: "Failed to compute category totals",
      details: err.message,
    });
  }
});

router.get("/trips/:tripId/expenses/by-event", async (req, res) => {
  const { tripId } = req.params;

  try {
    const eventsSnap = await db.collection(`trips/${tripId}/events`).get();
    const eventIds = eventsSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "Unnamed Event",
    }));

    const txSnaps = await Promise.all(
      eventIds.map((event) =>
        db.collection(`trips/${tripId}/events/${event.id}/transactions`).get()
      )
    );

    const expensesByEvent = eventIds.map((event, index) => {
      const transactions = txSnaps[index].docs.map((doc) => doc.data());
      const totalExpense = transactions.reduce(
        (sum, tx) => sum + parseFloat(tx.amount || 0),
        0
      );

      return {
        eventId: event.id,
        label: event.name,
        expense: parseFloat(totalExpense.toFixed(2)),
      };
    });

    res.json(expensesByEvent);
  } catch (err) {
    console.error("Error aggregating expenses by event:", err);
    res.status(500).json({
      error: "Failed to compute expenses by event",
      details: err.message,
    });
  }
});

router.get("/trips/:tripId/expenses/by-user", async (req, res) => {
  const { tripId } = req.params;

  try {
    const eventsSnap = await db.collection(`trips/${tripId}/events`).get();
    const eventIds = eventsSnap.docs.map((doc) => doc.id);

    const txSnaps = await Promise.all(
      eventIds.map((eventId) =>
        db.collection(`trips/${tripId}/events/${eventId}/transactions`).get()
      )
    );

    const transactions = txSnaps.flatMap((snap) =>
      snap.docs.map((doc) => doc.data())
    );

    const userTotals = {}; // userId => { name, total }

    transactions.forEach((tx) => {
      const share = tx.amount / tx.splitBetween.length;
      tx.splitBetween.forEach((user) => {
        const { userId, name } = user;
        if (!userTotals[userId]) {
          userTotals[userId] = { userId, name, total: 0 };
        }
        userTotals[userId].total += share;
      });
    });

    const result = Object.values(userTotals).map((u) => ({
      userId: u.userId,
      label: u.name,
      expense: parseFloat(u.total.toFixed(2)),
    }));

    res.json(result);
  } catch (err) {
    console.error("Error aggregating expenses by user:", err);
    res.status(500).json({
      error: "Failed to compute user totals",
      details: err.message,
    });
  }
});

module.exports = router;

const categoryLabelMap = {
  food: "🍔 Food",
  transport: "🚗 Transport",
  stay: "🏨 Stay",
  activity: "🎫 Activity",
  shopping: "🛍️ Shopping",
};
