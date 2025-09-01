const mongoose = require('mongoose');

const PermissionRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    permissionDate: {
      type: Date,
      required: true,
    },
    fromTime: {
      type: String, // e.g., "09:30 AM"
      required: true,
    },
    toTime: {
      type: String, // e.g., "11:00 AM"
      required: true,
    },
    totalHours: {
      type: Number, // system can calculate (toTime - fromTime)
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    requestedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee', // manager or approver
      required: true,
    },
    RequestStatusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RequestStatus', // Pending, Approved, Rejected (master table)
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const PermissionRequest = mongoose.model('PermissionRequest', PermissionRequestSchema);

module.exports = PermissionRequest;
