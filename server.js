const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');

const masterRoutes = require('./routes/masterRoutes');
const mainRoutes = require('./routes/mainRoutes');
const authRoutes = require('./routes/authRoutes');
const Notification = require('./models/masterModels/Notifications');
const Group = require('./models/masterModels/Group');
const { logoutUser } = require('./controllers/masterControllers/EmployeeControllers');
const { autoCheckoutOnDisconnect } = require('./controllers/masterControllers/AttendanceControllers');
const { checkLogin } = require('./controllers/masterControllers/EmployeeControllers');

const app = express();
const PORT = 8001;

app.use(bodyParser.json());
app.use(cors());
require('dotenv').config();

app.use('/api', authRoutes);
app.use('/api', checkLogin, masterRoutes);
app.use('/api', mainRoutes);

app.get('/test', (req, res) => {
  res.send("Testing mongo db url", process.env.MONGODB_URI);
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// const io = new Server(server, {
//   cors: {
//     origin: "https://enishrm.grss.in",
//     methods: ["GET", "POST"],
//     credentials: true
//   }
// });

app.set("socketio", io);

const heartbeatTimers = new Map();

io.on("connection", (socket) => {
  console.log("⚡ A client connected:", socket.id);

  socket.on("joinRoom", ({ employeeId }) => {
    socket.employeeId = employeeId;
    socket.join(employeeId);

    console.log(`Socket ${socket.id} joined room: ${employeeId}`);
  });

  // 🫀 Heartbeat listener
  socket.on("heartbeat", ({ employeeId }) => {
    console.log(`❤️ Heartbeat from ${employeeId}`);

    // Clear old timer if exists
    if (heartbeatTimers.has(employeeId)) {
      clearTimeout(heartbeatTimers.get(employeeId));
    }

    // Start new timer → if no heartbeat within 35s, logout
    const timer = setTimeout(async () => {
      console.log(`⚠️ No heartbeat from ${employeeId}, logging out`);
      await performLogout(employeeId);
      heartbeatTimers.delete(employeeId);
    }, 35000);

    heartbeatTimers.set(employeeId, timer);
  });

  // 🚪 Tab closing → immediate logout
  socket.on("tabClosing", async ({ employeeId }) => {
    console.log("🚪 Tab closed, logging out:", employeeId);
    await performLogout(employeeId);

    if (heartbeatTimers.has(employeeId)) {
      clearTimeout(heartbeatTimers.get(employeeId));
      heartbeatTimers.delete(employeeId);
    }
  });

  // 💬 Handle messages
  socket.on("sendMessage", async ({ type, message, toEmployeeId = null, groupId = null, meta = {} }) => {
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
  });

  // ❌ Handle disconnect
  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
    // no logout here → handled by heartbeat timeout
  });
});

async function performLogout(employeeId) {
  try {
    await logoutUser(employeeId);
    await autoCheckoutOnDisconnect(employeeId);
    console.log(`✅ Successfully logged out employee: ${employeeId}`);
  } catch (error) {
    console.error(`❌ Error during logout for employee ${employeeId}:`, error.message);
  }
}

// ---------------- HELPER: CREATE NOTIFICATION ----------------
const createNotification = async ({ type, message, fromEmployeeId, toEmployeeId = null, groupId = null, meta = {} }) => {
  try {
    const notificationData = {
      type,
      message,
      fromEmployeeId,
      toEmployeeId,
      groupId,
      meta,
    };

    if (["leave-request", "permission-request", "chat-message", "group-chat-message"].includes(type)) {
      notificationData.status = "unseen";
    } else {
      notificationData.status = "seen";
    }

    const notification = await Notification.create(notificationData);

    // Emit via socket if online
    if (toEmployeeId) {
      io.to(toEmployeeId.toString()).emit("receiveNotification", notification);
    } else if (groupId) {
      const group = await Group.findById(groupId).populate("members", "_id");
      group.members.forEach(member => {
        if (member._id.toString() !== fromEmployeeId.toString()) {
          io.to(member._id.toString()).emit("receiveNotification", notification);
        }
      });
    }

    return notification;
  } catch (err) {
    console.error("❌ Error creating notification:", err.message);
    throw err;
  }
};

// ---------------- MONGODB CONNECTION ----------------
async function main() {
  try {
    await mongoose.connect('mongodb+srv://eethaldev:eethaldevteam123@goldsun.pazhgof.mongodb.net/enis-hrm?retryWrites=true&w=majority&appName=ENIS-HRM', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    });
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
