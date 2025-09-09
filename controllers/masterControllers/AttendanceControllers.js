// controllers/attendanceController.js
const Attendance = require("../../models/masterModels/Attendance");
const mongoose = require("mongoose");

// 🟢 Employee Check-In
exports.checkIn = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const now = new Date();
    const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let attendance = await Attendance.findOne({ employeeId, date: dateOnly });

    if (!attendance) {
      // first session for the day
      attendance = new Attendance({
        employeeId,
        date: dateOnly,
        sessions: [{ checkIn: now }],
      });
    } else {
      const lastSession = attendance.sessions[attendance.sessions.length - 1];
      if (lastSession && !lastSession.checkOut) {
        return res.status(400).json({ message: "Already checked in. Please check out first." });
      }

      attendance.sessions.push({ checkIn: now });
    }

    await attendance.save();
    res.status(200).json({ message: "Checked in successfully", attendance });
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({ message: "Check-in failed", error: error.message });
  }
};

// 🔴 Employee Check-Out (worked hours comes from frontend)
exports.checkOut = async (req, res) => {
  try {
    const { employeeId, workedHours } = req.body; // workedHours sent from frontend
    const now = new Date();
    const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const attendance = await Attendance.findOne({ employeeId, date: dateOnly });

    if (!attendance) {
      return res.status(404).json({ message: "No attendance record found for today" });
    }

    const lastSession = attendance.sessions[attendance.sessions.length - 1];
    if (!lastSession || lastSession.checkOut) {
      return res.status(400).json({ message: "No active check-in found" });
    }

    // update with provided workedHours
    lastSession.checkOut = now;
    lastSession.workedHours = workedHours; // ✅ frontend controls break deductions

    // recalc total
    attendance.totalWorkedHours = attendance.sessions.reduce(
      (sum, s) => sum + (s.workedHours || 0),
      0
    );

    await attendance.save();
    res.status(200).json({ message: "Checked out successfully", attendance });
  } catch (error) {
    console.error("Check-out error:", error);
    res.status(500).json({ message: "Check-out failed", error: error.message });
  }
};

exports.autoCheckoutOnDisconnect = async (employeeId) => {
  try {
    if (!employeeId) return;

    // 1. Define start and end of today's date
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 2. Find today's attendance record
    const attendance = await Attendance.findOne({
      employeeId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!attendance) {
      console.log(`⚠️ No attendance record found for employee ${employeeId} today`);
      return;
    }

    // 3. Get last session (if exists)
    const lastSession = attendance.sessions[attendance.sessions.length - 1];

    // 4. If last session exists and has no checkout, close it
    if (lastSession && !lastSession.checkOut) {
      const checkOutTime = new Date();

      // totalHours will be handled in frontend usually,
      // but for auto checkout, we can at least log 0 or elapsed
      const elapsedMs = checkOutTime - new Date(lastSession.checkIn);
      const totalSeconds = Math.floor(elapsedMs / 1000);

      // Convert ms → hours (decimal)
      const workedHours = (elapsedMs / (1000 * 60 * 60)).toFixed(2); // e.g. 0.01, 1.25, etc.
      lastSession.checkOut = checkOutTime;
      lastSession.workedHours = workedHours; // decimal hours
  // recalc total
    attendance.totalWorkedHours = attendance.sessions.reduce(
      (sum, s) => sum + (s.workedHours || 0),
      0
    );
      await attendance.save();
      console.log(`✅ Auto checkout done for employee ${employeeId} at ${workedHours}`);
    }
  } catch (error) {
    console.error("❌ Auto checkout error:", error.message);
  }
};

// 📅 Get Attendance for a specific date
exports.getAttendanceByDate = async (req, res) => {
  try {
    const { employeeId, date } = req.body;
    const queryDate = new Date(date);
    const dateOnly = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate());

    const attendance = await Attendance.findOne({ employeeId, date: dateOnly });
    if (!attendance) {
      return res.status(404).json({ message: "No attendance found" });
    }

    res.status(200).json(attendance);
  } catch (error) {
    console.error("Get attendance error:", error);
    res.status(500).json({ message: "Failed to get attendance", error: error.message });
  }
};

// 👤 Get all Attendance of an Employee
exports.getAttendanceByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.body;

    const records = await Attendance.find({ employeeId }).sort({ date: -1 });
    res.status(200).json(records);
  } catch (error) {
    console.error("Get employee attendance error:", error);
    res.status(500).json({ message: "Failed to get employee attendance", error: error.message });
  }
};
