const express = require("express");
const paymentController = require("../controllers/paymentController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const { apiLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();
router.use(requireAuth, requireStudent);
router.post("/orders", apiLimiter, paymentController.createOrder);
router.post("/orders/verify", apiLimiter, paymentController.verifySignature);

module.exports = router;
