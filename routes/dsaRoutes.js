const express = require("express");
const router = express.Router();
const dsaController = require("../controllers/dsaController");
const requireAuth = require("../middlewares/requireAuth");
const requireStudent = require("../middlewares/requireStudent");
const { apiLimiter } = require("../middlewares/rateLimiter");

router.use(requireAuth, requireStudent);
router.get("/", dsaController.getPractice);
router.post("/answer", apiLimiter, dsaController.submitAnswer);
router.post("/code-solved", apiLimiter, dsaController.recordCodeSolve);

module.exports = router;
