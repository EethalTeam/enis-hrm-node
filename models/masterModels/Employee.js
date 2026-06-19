// models/Employee.js
const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    birthDate: {
      type: Date,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    designationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Designation",
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoleBased",
    },
    statusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Status",
    },
    workLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkLocation",
    },
    joinDate: {
      type: Date,
      required: true,
    },
    salary: {
      type: Number,
      required: true,
    },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
    },
    workingHours: {
      type: Number,
      default: 8,
    },
    lastLoggedIn: {
      type: Date,
    },
    isCurrentlyLoggedIn: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Employee", employeeSchema);
