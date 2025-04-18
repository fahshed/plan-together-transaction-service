const express = require("express");
const { db, bucket } = require("../config/firebase");
const router = express.Router();

const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });

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

module.exports = router;
