const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const AppleStrategy = require("passport-apple");

const User = require("../models/User");
const OAuthAccount = require("../models/OAuthAccount");
const Student = require("../models/Student");
const getProviderConfig = require("./oauthProviders");

const providers = getProviderConfig();

// Serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// passport-local-mongoose owns password verification and uses email as username.
passport.use(User.createStrategy());

// Generic OAuth User Sync Helper
const handleOAuthUser = async ({ provider, providerId, email, name, avatar }) => {
  let oauth = await OAuthAccount.findOne({ provider, providerId });
  if (oauth) {
    return await User.findById(oauth.user);
  }

  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    user = await User.create({
      email: email.toLowerCase(),
      name: name || email.split("@")[0],
      avatar: avatar || "/images/avatars/default.png",
      role: "student",
      isEmailVerified: true,
    });

    await Student.create({
      user: user._id,
      academicDetails: {},
      skills: [],
    });
  }

  await OAuthAccount.create({
    user: user._id,
    provider,
    providerId,
  });

  return user;
};

// 2. Google OAuth
if (providers.google.enabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: providers.google.clientID,
        clientSecret: providers.google.clientSecret,
        callbackURL: providers.google.callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("No email returned from Google"));
          const user = await handleOAuthUser({
            provider: "google",
            providerId: profile.id,
            email,
            name: profile.displayName,
            avatar: profile.photos?.[0]?.value,
          });
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  console.info("ℹ️ Google OAuth skipped: Credentials not configured.");
}

// 3. GitHub OAuth
if (providers.github.enabled) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: providers.github.clientID,
        clientSecret: providers.github.clientSecret,
        callbackURL: providers.github.callbackURL,
        scope: ["user:email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || `${profile.username}@github.noreply.com`;
          const user = await handleOAuthUser({
            provider: "github",
            providerId: profile.id,
            email,
            name: profile.displayName || profile.username,
            avatar: profile.photos?.[0]?.value,
          });
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  console.info("ℹ️ GitHub OAuth skipped: Credentials not configured.");
}

// 4. LinkedIn OAuth
if (providers.linkedin.enabled) {
  passport.use(
    new LinkedInStrategy(
      {
        clientID: providers.linkedin.clientID,
        clientSecret: providers.linkedin.clientSecret,
        callbackURL: providers.linkedin.callbackURL,
        scope: providers.linkedin.scope,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const user = await handleOAuthUser({
            provider: "linkedin",
            providerId: profile.id,
            email,
            name: profile.displayName,
            avatar: profile.photos?.[0]?.value,
          });
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}

// 5. Apple OAuth
if (providers.apple.enabled) {
  passport.use(
    new AppleStrategy(
      {
        clientID: providers.apple.clientID,
        teamID: providers.apple.teamID,
        keyID: providers.apple.keyID,
        privateKeyLocation: providers.apple.privateKeyLocation,
        callbackURL: providers.apple.callbackURL,
      },
      async (accessToken, refreshToken, idToken, profile, done) => {
        try {
          const email = profile?.email || `${idToken.sub}@apple.privaterelay.appleid.com`;
          const user = await handleOAuthUser({
            provider: "apple",
            providerId: idToken.sub,
            email,
            name: profile?.name ? `${profile.name.firstName} ${profile.name.lastName}` : "Apple User",
          });
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}

module.exports = passport;
