const Company = require("../models/Company");
const mongoose = require("mongoose");

exports.getCompany = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).render("errors/404", { title: "Company not found" });
  const company = await Company.findById(req.params.id);
  if (!company) return res.status(404).render("errors/404", { title: "Company not found" });
  res.render("company/show", { company });
};

exports.registerCompany = async (req, res) => {
  try {
    const { name, website, industry, description } = req.body;
    const company = await Company.create({
      name,
      website,
      industry,
      description,
      isVerified: false,
    });
    res.redirect(`/companies/${company._id}`);
  } catch (err) {
    res.status(500).send("Error registering company.");
  }
};
