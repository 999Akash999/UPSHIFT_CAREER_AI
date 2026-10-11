const LearningResource = require("../models/LearningResource");

exports.getResources = async (req, res) => {
  const { domain } = req.query;
  const filter = domain ? { domain } : {};
  const resources = await LearningResource.find(filter);
  res.render("student/resources", { title: "Learning Resources", resources, domain: domain || "" });
};
