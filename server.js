const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const cron = require("node-cron");
const path = require("path");

const masterRoutes = require("./routes/masterRoutes");
const mainRoutes = require("./routes/mainRoutes");
const authRoutes = require("./routes/authRoutes");
const Notification = require("./models/masterModels/Notifications");
const Group = require("./models/masterModels/Group");
const Message = require("./models/masterModels/Message");
const {
  logoutUser,
  cronJobLogOut,
} = require("./controllers/masterControllers/EmployeeControllers");
const {
  autoCheckoutOnDisconnect,
} = require("./controllers/masterControllers/AttendanceControllers");
const {
  checkLogin,
} = require("./controllers/masterControllers/EmployeeControllers");
const webhookRoutes = require("./routes/webHookRoutes");
const LeadController = require("./controllers/masterControllers/LeadControllers");
const CallLogController = require("./controllers/masterControllers/callLogControllers");
const upload = multer({ dest: "uploads/" });

const app = express();
const PORT = 8001;
app.use(cors());

app.post(
  "/api/importLeadsExcel",
  upload.single("file"),
  LeadController.importLeads,
);

app.use(express.json());

require("dotenv").config();

app.get("/api/calls/fetch-all", CallLogController.fetchAllCallLogs);
app.use(
  express.json(
    {
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    },
    { limit: "15mb" },
  ),
);
app.use(express.urlencoded({ limit: "15mb", extended: true }));
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

require("dotenv").config();

app.use("/Employeepic", express.static(path.join(__dirname, "Employeepic")));
app.get("/privacy", (req, res) => {
  res.send(`
    <h1>Privacy Policy</h1>
    <p>We collect and process data such as employee names, phone numbers, email addresses, and task details.</p>
    <p>This data is used solely for notifying employees about assigned tasks via WhatsApp and for internal task management purposes.</p>
    <p>We do not share, sell, or distribute this information to third parties.</p>
    <p>If you wish to opt-out or request data deletion, please contact eethalnaditsolutions@gmail.com.</p>
  `);
});

app.use("/webhook", webhookRoutes);
app.use("/getAllCallLogs", LeadController.handleGenericWebhook);
app.use("/api", authRoutes);
app.use("/api", masterRoutes);
app.use("/api", mainRoutes);

app.get("/test", (req, res) => {
  res.send("Testing mongo db url", process.env.MONGODB_URI);
});

// Schedule: Every day at 7:00 PM IST
cron.schedule(
  "0 19 * * *",
  async () => {
    console.log(
      "🕖 Running daily cron job at 7 PM IST:",
      new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    );
    await cronJobLogOut();
  },
  {
    timezone: "Asia/Kolkata",
  },
);

const server = http.createServer(app);

// =============================================================
// SOCKET.IO SETUP
// CORS opened up to support all front-end origins.
// Tighten this list once you confirm everything works.
// =============================================================
const io = new Server(server, {
  cors: {
    origin: "*", // Use "*" while debugging; replace with specific origins later
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

app.set("socketio", io);

const heartbeatTimers = new Map(); // employeeId -> timeout
const employeeSockets = new Map(); // employeeId -> Set of socketIds

io.on("connection", (socket) => {
  console.log("⚡ A client connected:", socket.id);

  // ================== Join Room for Personal Notifications ==================
  socket.on("joinRoom", ({ employeeId }) => {
    if (!employeeId) return;
    socket.employeeId = employeeId;
    socket.join(employeeId);

    if (!employeeSockets.has(employeeId)) {
      employeeSockets.set(employeeId, new Set());
    }
    employeeSockets.get(employeeId).add(socket.id);

    console.log(`👤 Socket ${socket.id} joined personal room: ${employeeId}`);
  });

  // ================== GROUP CHAT EVENTS ==================
  // 1. Event for a user to join a specific group chat room
  socket.on("join_group_chat", (groupId) => {
    if (!groupId) return;
    socket.join(groupId);
    console.log(`👥 Socket ${socket.id} joined group chat room: ${groupId}`);
  });

  // 2. Event for a user to leave a group chat room
  socket.on("leave_group_chat", (groupId) => {
    if (!groupId) return;
    socket.leave(groupId);
    console.log(`🚪 Socket ${socket.id} left group chat room: ${groupId}`);
  });

  // 3. Event for sending a message specifically to a group
  socket.on("send_group_message", async (messageData) => {
    if (
      !messageData?.groupId ||
      !messageData?.senderId ||
      !messageData?.content
    ) {
      console.error("❌ Invalid group message data received:", messageData);
      return;
    }
    await handleGroupChatMessage(socket, messageData);
  });

  // ================== Generic Send Message (Notifications) ==================
  socket.on(
    "sendMessage",
    async ({
      type,
      message,
      toEmployeeId = null,
      groupId = null,
      meta = {},
    }) => {
      try {
        const notification = await createNotification({
          type,
          message,
          fromEmployeeId: socket.employeeId,
          toEmployeeId,
          groupId,
          meta,
        });

        console.log("✅ Notification created:", notification._id);
      } catch (err) {
        console.error("❌ Error sending notification:", err.message);
      }
    },
  );

  // ================== Disconnect ==================
  socket.on("disconnect", (reason) => {
    const { employeeId } = socket;
    if (employeeId && employeeSockets.has(employeeId)) {
      const sockets = employeeSockets.get(employeeId);
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        employeeSockets.delete(employeeId);
      }
    }
    console.log(`❌ Socket disconnected: ${socket.id} (reason: ${reason})`);
  });
});

async function performLogout(employeeId) {
  try {
    await logoutUser(employeeId);
    await autoCheckoutOnDisconnect(employeeId);
    console.log(`✅ Successfully logged out employee: ${employeeId}`);
  } catch (error) {
    console.error(
      `❌ Error during logout for employee ${employeeId}:`,
      error.message,
    );
  }
}

// ---------------- HELPER: CREATE NOTIFICATION ----------------
const createNotification = async ({
  type,
  message,
  fromEmployeeId,
  toEmployeeId = null,
  groupId = null,
  meta = {},
}) => {
  try {
    const notificationData = {
      type,
      message,
      fromEmployeeId,
      toEmployeeId,
      groupId,
      meta,
    };

    if (
      [
        "leave-request",
        "permission-request",
        "chat-message",
        "group-chat-message",
      ].includes(type)
    ) {
      notificationData.status = "unseen";
    } else {
      notificationData.status = "seen";
    }

    const notification = await Notification.create(notificationData);

    if (toEmployeeId) {
      io.to(toEmployeeId.toString()).emit("receiveNotification", notification);
    } else if (groupId) {
      const group = await Group.findById(groupId).populate("members", "_id");
      group.members.forEach((member) => {
        if (member._id.toString() !== fromEmployeeId.toString()) {
          io.to(member._id.toString()).emit(
            "receiveNotification",
            notification,
          );
        }
      });
    }

    return notification;
  } catch (err) {
    console.error("❌ Error creating notification:", err.message);
    throw err;
  }
};

// ---------------- HELPER: HANDLE GROUP CHAT MESSAGE ----------------
const handleGroupChatMessage = async (
  socket,
  { groupId, senderId, content },
) => {
  try {
    const newMessage = await Message.create({ groupId, senderId, content });
    const populatedMessage = await newMessage.populate(
      "senderId",
      "name avatar",
    );
    await Group.findByIdAndUpdate(groupId, { lastMessage: newMessage._id });

    // Debug: confirm how many sockets are in the group room
    const socketsInRoom = await io.in(groupId).fetchSockets();
    console.log(
      `📡 Broadcasting to group ${groupId} — ${socketsInRoom.length} socket(s) in room`,
    );

    // Send to everyone in the room EXCEPT the sender
    socket.broadcast
      .to(groupId)
      .emit("receive_group_message", populatedMessage);

    // ===== FALLBACK: Notify offline / not-in-room members via their personal room =====
    // This ensures members who haven't opened the specific group chat
    // (but are online) still get the message delivered to their socket.
    try {
      const group = await Group.findById(groupId).populate("members", "_id");
      if (group?.members) {
        const inRoomSocketIds = new Set(socketsInRoom.map((s) => s.id));
        group.members.forEach((member) => {
          const memberId = member._id.toString();
          if (memberId === senderId.toString()) return;

          // Get this member's active sockets
          const memberSocketIds = employeeSockets.get(memberId);
          if (!memberSocketIds) return;

          // If none of the member's sockets are in the group room,
          // emit to their personal room so the UI/notification can react.
          const hasSocketInRoom = [...memberSocketIds].some((sid) =>
            inRoomSocketIds.has(sid),
          );
          if (!hasSocketInRoom) {
            io.to(memberId).emit("receive_group_message", populatedMessage);
          }
        });
      }
    } catch (fallbackErr) {
      console.error("⚠️ Fallback notify error:", fallbackErr.message);
    }

    console.log(`✅ Message broadcast complete for group ${groupId}`);
  } catch (err) {
    console.error("❌ Error handling group chat message:", err.message);
  }
};

// ---------------- MONGODB CONNECTION ----------------
async function main() {
  try {
    await mongoose.connect(
      "mongodb+srv://eethaldev:eethaldevteam123@goldsun.pazhgof.mongodb.net/enis-hrm?retryWrites=true&w=majority&appName=ENIS-HRM",
      {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
      },
    );
    console.log("✅ MongoDB successfully connected");

    server.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message);
  }
}

main();

module.exports = app;
