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

// app.post('/api/chatWithGemini', (req,res)=>{
//   console.log(req.body,"req.body")
// })
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

const heartbeatTimers = new Map();       // employeeId -> timeout
const employeeSockets = new Map();       // employeeId -> Set of socketIds

io.on("connection", (socket) => {
  console.log("⚡ A client connected:", socket.id);

  // ================== Join Room ==================
  socket.on("joinRoom", ({ employeeId }) => {
    socket.employeeId = employeeId;
    socket.join(employeeId);

    if (!employeeSockets.has(employeeId)) {
      employeeSockets.set(employeeId, new Set());
    }
    employeeSockets.get(employeeId).add(socket.id);

    console.log(`Socket ${socket.id} joined room: ${employeeId}`);
  });

  // // ================== Heartbeat ==================
  // socket.on("heartbeat", ({ employeeId }) => {
  //   if (!employeeId) return;
  //   console.log(`❤️ Heartbeat from ${employeeId}`);

  //   // Clear old timer
  //   if (heartbeatTimers.has(employeeId)) clearTimeout(heartbeatTimers.get(employeeId));

  //   // Start new timer (2 min grace period)
  //   const timer = setTimeout(async () => {
  //     const sockets = employeeSockets.get(employeeId) || new Set();
  //     if (sockets.size === 0) { // only logout if no active sockets
  //       console.log(`⚠️ No heartbeat from ${employeeId}, logging out`);
  //       await performLogout(employeeId);
  //       heartbeatTimers.delete(employeeId);
  //     }
  //   }, 120000); // 2 minutes

  //   heartbeatTimers.set(employeeId, timer);
  // });

  // // ================== Tab Closing ==================
  // socket.on("tabClosing", async ({ employeeId }) => {
  //   console.log("🚪 Tab closed, logging out:", employeeId);
  //   await performLogout(employeeId);

  //   if (heartbeatTimers.has(employeeId)) {
  //     clearTimeout(heartbeatTimers.get(employeeId));
  //     heartbeatTimers.delete(employeeId);
  //   }

  //   if (employeeSockets.has(employeeId)) {
  //     employeeSockets.get(employeeId).delete(socket.id);
  //     if (employeeSockets.get(employeeId).size === 0) {
  //       employeeSockets.delete(employeeId);
  //     }
  //   }
  // });

  // ================== Send Message ==================
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

  // ================== Disconnect ==================
  socket.on("disconnect", () => {
    const { employeeId } = socket;
    if (employeeId && employeeSockets.has(employeeId)) {
      const sockets = employeeSockets.get(employeeId);
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        employeeSockets.delete(employeeId);
        // Timer will handle logout if heartbeat not received
      }
    }
    console.log(`❌ Socket disconnected: ${socket.id}`);
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
