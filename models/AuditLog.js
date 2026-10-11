const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, "Action identifier is required"],
      enum: [
        "USER_ROLE_CHANGE",
        "USER_DEACTIVATION",
        "COMPANY_VERIFICATION",
        "COURSE_PUBLISHED",
        "PAYMENT_FORCE_VERIFIED",
        "SECURITY_ALERT",
        "AUTH_PASSWORD_RESET",
      ],
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    targetModel: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);