const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    projectCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    projectStatusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectStatus", // Active, Completed, On Hold etc.
    },
    projectHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee", // Employee heading the project
      required: true,
    },
    assignedEmployees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", ProjectSchema);
