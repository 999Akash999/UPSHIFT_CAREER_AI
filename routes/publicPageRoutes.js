const express = require("express");
const router = express.Router();

const renderPage = (view, title) => (req, res) => res.render(`pages/${view}`, { title: `${title} | UPSHIFT` });

router.get("/about", renderPage("about", "About UPSHIFT"));
router.get("/team", renderPage("team", "The UPSHIFT Team"));
router.get("/contact", renderPage("contact", "Contact UPSHIFT"));
router.get("/help", renderPage("help", "Help Center"));
router.get("/resources", renderPage("resources", "Free Learning Resources"));
router.get("/privacy", renderPage("privacy", "Privacy"));
router.get("/terms", renderPage("terms", "Terms of Use"));

module.exports = router;
