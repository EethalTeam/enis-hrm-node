const mongoose = require('mongoose');

const LeaveRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    leaveTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveType', // Master table for leave types (Sick, Casual, etc.)
      required: true
    },
    RequestStatusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RequestStatus', // Master table for statuses (Pending, Approved, Rejected)
      required: true
    },
    requestedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee', // Who should approve (manager, HR, etc.)
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    totalDays: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

const LeaveRequest = mongoose.model('LeaveRequest', LeaveRequestSchema);

module.exports = LeaveRequest;
