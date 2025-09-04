const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');

const masterRoutes = require('./routes/masterRoutes');
const mainRoutes = require('./routes/mainRoutes');
const Notification = require('./models/masterModels/Notifications');
const Group = require('./models/masterModels/Group');

const app = express();
const PORT = 8001;

app.use(bodyParser.json());
app.use(cors());
require('dotenv').config();

app.use('/api', masterRoutes);
app.use('/api', mainRoutes);

app.get('/test', (req, res) => {
  res.send("Testing mongo db url", process.env.MONGODB_URI);
});

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

app.set("socketio", io);

io.on("connection", (socket) => {
  console.log("⚡ A client connected:", socket.id);

  // Employee joins their own room
  socket.on("joinRoom", ({ employeeId }) => {
    socket.employeeId = employeeId;
    socket.join(employeeId);
    console.log(`Socket ${socket.id} joined room: ${employeeId}`);
  });

  // Handle sending messages / notifications
  socket.on("sendMessage", async ({ type, message, toEmployeeId = null, groupId = null, meta = {} }) => {
    try {
      // Use the centralized function
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

  socket.on("disconnect", () => {
    console.log(`❌ Employee ${socket.employeeId || socket.id} disconnected`);
  });
});
const createNotification = async ({ 
  type, 
  message, 
  fromEmployeeId, 
  toEmployeeId = null, 
  groupId = null, 
  meta = {} 
}) => {
  try {
    // Build notification object
    const notificationData = {
      type,
      message,
      fromEmployeeId,
      toEmployeeId,
      groupId,
      meta,
    };

    // Set default status based on type
    if (type === "leave-request" || type === "permission-request") {
      notificationData.status = "unseen"; // pending approval
    } else if (type === "chat-message" || type === "group-chat-message") {
      notificationData.status = "unseen"; // unread message
    } else {
      notificationData.status = "seen"; // announcements, system alerts, etc.
    }

    // Create notification in DB
    const notification = await Notification.create(notificationData);

    // Emit via socket if employee or group online
    if (toEmployeeId) {
      // Individual notification
      io.to(toEmployeeId.toString()).emit("receiveNotification", notification);
    } else if (groupId) {
      // Group notification: emit to all members except sender
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

// MongoDB Connection
async function main() {
  try {
    await mongoose.connect('mongodb+srv://eethaldev:eethaldevteam123@goldsun.pazhgof.mongodb.net/enis-hrm?retryWrites=true&w=majority&appName=ENIS-HRM', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000
    });

    console.log("✅ MongoDB successfully connected");

    const dbName = mongoose.connection.db.databaseName;
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📦 Collections in database: ${dbName}`, collections.map(col => col.name));

    server.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message);
  }
}

main();

module.exports = app;
