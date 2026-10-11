// controllers/paymentController.js
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Course = require("../models/Course");
const Order = require("../models/Order");
const Student = require("../models/Student");

const ensureEnrollment = async (studentUserId, courseId) => {
  const result = await Student.updateOne(
    { user: studentUserId },
    { $addToSet: { enrolledCourses: courseId } }
  );
  if (!result.matchedCount) {
    const error = new Error("Student profile not found.");
    error.status = 404;
    throw error;
  }
  if (result.modifiedCount) {
    const courseResult = await Course.updateOne({ _id: courseId }, { $inc: { enrolledCount: 1 } });
    if (!courseResult.matchedCount) throw new Error("Course no longer exists.");
  }
};

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

exports.createOrder = async (req, res) => {
  try {
    const { courseId } = req.body;
    const course = await Course.findOne({ _id: courseId, isPublished: true });
    if (!course) return res.status(404).json({ error: "Course not found" });

    const student = await Student.findOne({ user: req.user._id }).select("enrolledCourses");
    if (!student) return res.status(404).json({ error: "Student profile not found." });
    if ((student.enrolledCourses || []).some((id) => String(id) === String(course._id))) {
      return res.status(409).json({ error: "You are already enrolled in this course." });
    }

    const payableAmount = Math.round((course.discountPrice > 0 ? course.discountPrice : course.price) * 100);
    if (payableAmount === 0) {
      await ensureEnrollment(req.user._id, course._id);
      return res.json({ success: true, enrolled: true, message: "You are enrolled in this free course." });
    }
    if (payableAmount < 100) return res.status(400).json({ error: "Paid courses must cost at least ₹1." });

    const gateway = getRazorpay();
    if (!gateway) return res.status(503).json({ error: "Payments are not configured." });

    const receipt = `rcpt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const rzpOrder = await gateway.orders.create({
      amount: payableAmount,
      currency: "INR",
      receipt,
    });

    await Order.create({
      student: req.user._id,
      course: course._id,
      razorpayOrderId: rzpOrder.id,
      amount: payableAmount,
      receipt,
    });

    res.json({
      orderId: rzpOrder.id,
      amount: payableAmount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Create payment order failed:", err.message);
    res.status(err.status || 500).json({ error: err.message || "Failed to initiate payment." });
  }
};

exports.verifySignature = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const order = await Order.findOne({
      razorpayOrderId: razorpay_order_id,
      student: req.user._id,
    });
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ success: false, message: "Payments are not configured." });
    }

    const payload = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest("hex");

    const expected = Buffer.from(expectedSig, "hex");
    const received = Buffer.from(razorpay_signature || "", "hex");
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return res.status(400).json({ success: false, message: "Invalid payment signature." });
    }

    if (order.status !== "paid") {
      const claimedOrder = await Order.findOneAndUpdate(
        { _id: order._id, status: "created" },
        { $set: { status: "paid", razorpayPaymentId: razorpay_payment_id } },
        { new: true, runValidators: true }
      );
      if (!claimedOrder) {
        const latestOrder = await Order.findById(order._id);
        if (latestOrder?.status !== "paid") {
          return res.status(409).json({ success: false, message: "This order cannot be completed." });
        }
      }
    }

    // Idempotent: a retry repairs enrollment if a process stopped after marking payment paid.
    await ensureEnrollment(req.user._id, order.course);

    res.json({ success: true, message: "Enrollment complete!" });
  } catch (err) {
    console.error("Payment verification failed:", err.message);
    res.status(err.status || 500).json({ success: false, message: err.message || "Internal verification error." });
  }
};
