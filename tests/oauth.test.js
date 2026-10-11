const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/User");
const OAuthAccount = require("../models/OAuthAccount");
const Student = require("../models/Student");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await OAuthAccount.deleteMany({});
  await Student.deleteMany({});
});

describe("OAuth Account Linking Suite", () => {
  it("should link a new OAuth account to an existing user with matching email", async () => {
    const existingUser = await User.create({
      name: "Existing Developer",
      email: "dev@company.com",
      role: "student",
      isEmailVerified: true,
    });

    const oauthRecord = await OAuthAccount.create({
      user: existingUser._id,
      provider: "github",
      providerId: "gh_987654321",
      profileData: { login: "dev-github", repos_url: "https://api.github.com" },
    });

    expect(oauthRecord.user.toString()).toBe(existingUser._id.toString());
    expect(oauthRecord.provider).toBe("github");
  });

  it("should prevent duplicate bindings of the same provider and providerId", async () => {
    const userA = await User.create({ name: "User A", email: "a@test.com", role: "student" });
    const userB = await User.create({ name: "User B", email: "b@test.com", role: "student" });

    await OAuthAccount.create({
      user: userA._id,
      provider: "google",
      providerId: "google_12345",
    });

    await expect(
      OAuthAccount.create({
        user: userB._id,
        provider: "google",
        providerId: "google_12345",
      })
    ).rejects.toThrow();
  });
});