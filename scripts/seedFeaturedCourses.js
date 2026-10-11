require("dotenv").config();

const mongoose = require("mongoose");
const Course = require("../models/Course");
const featuredCourses = require("../data/featuredCourses");

const databaseUrl = process.env.ATLASDB_URL || process.env.MONGO_URI;

if (featuredCourses.length !== 10) {
  throw new Error(`Expected exactly 10 featured courses, found ${featuredCourses.length}.`);
}
for (const course of featuredCourses) {
  if (!Number.isFinite(course.price) || course.price < 9999 || course.price > 14999) {
    throw new Error(`Course ${course.slug} must be priced between ₹9,999 and ₹14,999.`);
  }
}

async function seedFeaturedCourses() {
  if (!databaseUrl) {
    throw new Error("Set ATLASDB_URL or MONGO_URI before seeding courses.");
  }

  await mongoose.connect(databaseUrl, { serverSelectionTimeoutMS: 15000 });
  let insertedCount = 0;
  let updatedCount = 0;
  const activeSlugs = featuredCourses.map(({ slug }) => slug);

  // Replace the old platform-owned catalog while preserving courses created by mentors.
  const removed = await Course.deleteMany({
    isPublished: true,
    slug: { $nin: activeSlugs },
    $or: [{ instructor: { $exists: false } }, { instructor: null }],
  });

  for (const course of featuredCourses) {
    const result = await Course.updateOne(
      { slug: course.slug },
      { $set: course },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    if (result.upsertedCount) insertedCount += 1;
    else if (result.modifiedCount) updatedCount += 1;
  }

  console.log(`Course catalog replaced: ${insertedCount} added, ${updatedCount} refreshed, ${removed.deletedCount} old platform courses removed; mentor-created courses were preserved.`);
}

seedFeaturedCourses()
  .catch((error) => {
    console.error("Could not seed the featured course catalog:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
