const Doubt = require("../models/Doubt");

exports.postDoubt = async (req, res) => {
  try {
    const { title, description, tags, codeSnippet } = req.body;
    await Doubt.create({
      author: req.user._id,
      title,
      description,
      codeSnippet,
      tags: String(tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    });
    req.flash("success", "Doubt posted to community forum.");
    res.redirect("/student/doubts");
  } catch (err) {
    req.flash("error", "Failed to submit doubt.");
    res.redirect("/student/doubts");
  }
};

exports.addReply = async (req, res) => {
  try {
    const { message } = req.body;
    const doubt = await Doubt.findById(req.params.id);
    if (!doubt) return res.status(404).render("errors/404", { title: "Question not found" });
    doubt.replies.push({ author: req.user._id, message });
    await doubt.save();
    res.redirect(`/student/doubts/${req.params.id}`);
  } catch (err) {
    res.status(500).send("Error adding reply.");
  }
};
