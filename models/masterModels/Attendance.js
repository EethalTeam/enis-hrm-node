// models/Attendance.js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true, // quick lookups per day
    },
    sessions: [
      {
        checkIn: { type: Date, required: true },
        checkOut: { type: Date },
        workedHours: { type: Number, default: 0 }, // per session hours
      },
    ],
    totalWorkedHours: {
      type: Number, // total hours for the day
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Attendance", attendanceSchema);
