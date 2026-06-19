const mongoose = require("mongoose");

const SubTaskSchema = new mongoose.Schema(
  {
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    subtaskCode: {
      type: String,
      trim: true,
    },
    subtaskName: {
      type: String,
      required: true,
      trim: true,
    },
    subTaskType: {
      type: String,
      enum: ["Dependent", "Independent"],
    },
    dependencyTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubTask",
    },
    subprojectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    subnotifyId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null,
      },
    ],
    subdescription: {
      type: String,
      trim: true,
    },
    substartDate: {
      type: Date,
    },
    subdueDate: {
      type: Date,
    },
    subtaskStatusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskStatus",
    },
    subtaskPriorityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskPriority",
    },
    subassignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
      },
    ],
    subcreatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    subfeedback: {
      type: String,
      trim: true,
    },
    subreqLeadCount: {
      type: String,
      trim: true,
    },
    subcompLeadCount: {
      type: String,
      trim: true,
    },
    subprogressDetails: [
      {
        type: String,
        trim: true,
      },
    ],
    subreasonForPending: [
      {
        type: String,
        trim: true,
      },
    ],
    subworkLogs: [
      {
        employeeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
          required: true,
        },
        startTime: {
          type: Date,
          required: true,
        },
        endTime: {
          type: Date,
        },
        hoursWorked: {
          type: Number,
        },
        logDescription: {
          type: String,
          trim: true,
        },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("SubTask", SubTaskSchema);
