const express = require("express");
const rateLimit = require("express-rate-limit");
const contactController = require("../controllers/contactController");
const pdfNoteGroups = require("../data/freeResourcePdfNotes");
const router = express.Router();

const contactQueryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    req.flash("error", "Too many queries were submitted. Please try again in 15 minutes.");
    res.redirect(req.body?.source === "help" ? "/help" : "/contact");
  },
});

const renderPage = (view, title) => (req, res) => res.render(`pages/${view}`, {
  title: `${title} | UPSHIFT`,
  queryFormSource: view === "help" ? "help" : "contact",
  pdfNoteGroups: view === "resources" ? pdfNoteGroups : [],
});

router.get("/about", renderPage("about", "About UPSHIFT"));
router.get("/team", renderPage("team", "The UPSHIFT Team"));
router.get("/contact", renderPage("contact", "Contact UPSHIFT"));
router.get("/help", renderPage("help", "Help Center"));
router.post("/contact/query", contactQueryLimiter, contactController.submitQuery);
router.get("/resources", renderPage("resources", "Free Learning Resources"));
router.get("/privacy", renderPage("privacy", "Privacy"));
router.get("/terms", renderPage("terms", "Terms of Use"));

module.exports = router;
