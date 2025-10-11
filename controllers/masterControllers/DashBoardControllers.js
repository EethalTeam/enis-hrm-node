// controllers/employeeController.js

const Employee = require('../../models/masterModels/Employee');
const Attendance = require('../../models/masterModels/Attendance'); // Make sure the path is correct
const Shift = require('../../models/masterModels/Shift');       // Make sure the path is correct
const mongoose = require('mongoose');

// REPLACE THIS with the actual ObjectId of your "Approved" status
const APPROVED_PERMISSION_STATUS_ID = new mongoose.Types.ObjectId("68b6a2610c502941d03c6372");

const getStartOfDayISTAsUTC = (date = new Date()) => {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value);
  const day = parseInt(parts.find(p => p.type === 'day').value);
  return new Date(Date.UTC(year, month - 1, day));
};

exports.getLateLoginsForToday = async (req, res) => {
  try {
    const today = getStartOfDayISTAsUTC(new Date());

    const lateAttendances = await Attendance.aggregate([
      { $addFields: { localDate: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "Asia/Kolkata" } } } },
      { $match: { localDate: today.toISOString().split('T')[0] } },
      { $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'employee' } },
      { $unwind: "$employee" },
      { $lookup: { from: 'shifts', localField: 'employee.shiftId', foreignField: '_id', as: 'shift' } },
      { $unwind: "$shift" },
      { $match: { "employee.isActive": true } },
      {
        $lookup: {
          from: 'permissionrequests',
          let: { empId: "$employeeId", pDate: "$date" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$employeeId", "$$empId"] },
                    { $eq: ["$permissionDate", "$$pDate"] },
                    { $eq: ["$RequestStatusId", APPROVED_PERMISSION_STATUS_ID] }
                  ]
                }
              }
            }
          ],
          as: 'permissions'
        }
      }
    ]);
    
    const allLateEmployeeDetails = lateAttendances
      .filter(att => {
        if (!att.shift || !att.sessions || !att.sessions.length === 0) return false;

        const checkInTime = new Date(att.sessions[0].checkIn);
        const [shiftHour, shiftMinute] = att.shift.startTime.split(':').map(Number);
        
        const timeOptions = { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: false };
        const formatter = new Intl.DateTimeFormat('en-US', timeOptions);
        const parts = formatter.formatToParts(checkInTime);
        
        const checkInHourIST = parseInt(parts.find(p => p.type === 'hour').value);
        const checkInMinuteIST = parseInt(parts.find(p => p.type === 'minute').value);

        const isLate = checkInHourIST > shiftHour || (checkInHourIST === shiftHour && checkInMinuteIST > shiftMinute);

        if (!isLate) {
            return false;
        }
        
        const hasValidPermission = att.permissions.some(permission => {
            const [fromHour, fromMin] = permission.fromTime.split(':').map(Number);
            const [toHour, toMin] = permission.toTime.split(':').map(Number);
            const permissionFromTime = new Date(checkInTime);
            permissionFromTime.setHours(fromHour, fromMin, 0, 0);
            const permissionToTime = new Date(checkInTime);
            permissionToTime.setHours(toHour, toMin, 0, 0);
            return checkInTime >= permissionFromTime && checkInTime <= permissionToTime;
        });

        return isLate && !hasValidPermission;
      })
      .map(att => {
        const loginTimeDate = new Date(att.sessions[0].checkIn);
        return {
            _id: att.employee._id,
            name: att.employee.name,
            // ================= THIS IS THE FIX =================
            loginTime: loginTimeDate.toLocaleTimeString('en-IN', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: true, 
                timeZone: 'Asia/Kolkata' 
            }),
            // ===================================================
            rawLoginTime: loginTimeDate,
            shiftStartTime: att.shift.startTime
        };
      });

    const uniqueLatestLogins = new Map();
    allLateEmployeeDetails.forEach(employee => {
        const existingEntry = uniqueLatestLogins.get(employee._id.toString());
        if (!existingEntry || employee.rawLoginTime > existingEntry.rawLoginTime) {
            uniqueLatestLogins.set(employee._id.toString(), employee);
        }
    });

    const finalResult = Array.from(uniqueLatestLogins.values()).map(emp => {
      const [shiftHour, shiftMinute] = emp.shiftStartTime.split(':').map(Number);
      const shiftStartDateTime = new Date(emp.rawLoginTime);
      shiftStartDateTime.setHours(shiftHour, shiftMinute, 0, 0);
      let lateByMins = 0;
      if (emp.rawLoginTime > shiftStartDateTime) {
          const diffMs = emp.rawLoginTime - shiftStartDateTime;
          lateByMins = Math.floor(diffMs / (1000 * 60));
      }
      const hours = Math.floor(lateByMins / 60);
      const minutes = lateByMins % 60;
      let lateByFormatted = '';
      if (hours > 0) lateByFormatted += `${hours} hr `;
      if (minutes > 0 || hours === 0) lateByFormatted += `${minutes} mins`;
      const { rawLoginTime, ...rest } = emp;
      return { ...rest, lateBy: lateByFormatted.trim() };
    });

    res.status(200).json({
      success: true,
      count: finalResult.length,
      data: finalResult,
    });

  } catch (error) {
    console.error("Error fetching late logins:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};