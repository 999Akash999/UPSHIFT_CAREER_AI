const { Server } = require("socket.io");
const getAppBaseUrl = require("./appBaseUrl");

let ioInstance = null;

const initSocket = (httpServer, sessionMiddleware) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: getAppBaseUrl(),
      credentials: true,
    },
  });

  // Convert express-session middleware for Socket.io
  const wrap = (middleware) => (socket, next) => middleware(socket.request, {}, next);
  ioInstance.use(wrap(sessionMiddleware));

  ioInstance.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.passport && session.passport.user) {
      socket.userId = session.passport.user;
      return next();
    }
    return next(new Error("Unauthorized socket connection"));
  });

  ioInstance.on("connection", (socket) => {
    // Join personal notification channel
    socket.join(`user:${socket.userId}`);

    // AI Tutor Doubt room handler
    socket.on("join:doubt-room", (doubtId) => {
      socket.join(`doubt:${doubtId}`);
    });

    // Real-time peer message handler
    socket.on("send:doubt-message", (data) => {
      ioInstance.to(`doubt:${data.doubtId}`).emit("receive:doubt-message", {
        senderId: socket.userId,
        message: data.message,
        createdAt: new Date(),
      });
    });

    socket.on("disconnect", () => {
      socket.leave(`user:${socket.userId}`);
    });
  });

  console.log("⚡ Real-time Socket.io server initialized.");
  return ioInstance;
};

const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.io has not been initialized yet!");
  }
  return ioInstance;
};

module.exports = { initSocket, getIO };
