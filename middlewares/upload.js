const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload folders exist
const uploadBase = path.join(__dirname, "../uploads");
const subDirs = ["resumes", "avatars", "company-logos"];
subDirs.forEach((dir) => {
  const fullPath = path.join(uploadBase, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "resume") {
      cb(null, path.join(uploadBase, "resumes"));
    } else if (file.fieldname === "avatar") {
      cb(null, path.join(uploadBase, "avatars"));
    } else if (file.fieldname === "logo") {
      cb(null, path.join(uploadBase, "company-logos"));
    } else {
      cb(null, uploadBase);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
  const allowedDocTypes = ["application/pdf"];

  if (file.fieldname === "resume") {
    if (allowedDocTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    const error = new Error("Only PDF files are accepted for resumes.");
    error.status = 400;
    return cb(error, false);
  }

  if (file.fieldname === "avatar" || file.fieldname === "logo") {
    if (allowedImageTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    const error = new Error("Only JPG, PNG, and WEBP image formats are supported.");
    error.status = 400;
    return cb(error, false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5) * 1024 * 1024, // 5MB default
  },
  fileFilter,
});

module.exports = upload;
