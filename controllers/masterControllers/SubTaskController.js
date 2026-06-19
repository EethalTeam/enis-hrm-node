const SubTask = require("../../models/masterModels/SubTask");
const Notification = require("../../models/masterModels/Notifications");
const Employee = require("../../models/masterModels/Employee");
const Task = require("../../models/masterModels/Task");
const Project = require("../../models/masterModels/Project");
const TaskStatus = require("../../models/masterModels/TaskStatus");

// ======================== CREATE SUBTASK ========================
exports.createSubTask = async (req, res) => {
  try {
    const {
      subtaskName,
      subdescription,
      parentTaskId,
      subprojectId,
      subassignedTo,
      subcreatedBy,
      subtaskPriorityId,
      subdueDate,
      subnotifyId,
      subTaskType,
      dependencyTaskId,
    } = req.body;

    // 🔴 Validation
    if (!subtaskName || !parentTaskId || !subprojectId) {
      return res.status(400).json({
        message: "subtaskName, parentTaskId and subprojectId are required",
      });
    }

    if (!subassignedTo || subassignedTo.length === 0) {
      return res.status(400).json({
        message: "At least one assignee is required",
      });
    }

    // 🔍 Parent Task check
    const parentTask = await Task.findById(parentTaskId);
    if (!parentTask) {
      return res.status(404).json({ message: "Parent task not found" });
    }

    // 🔍 Project check
    const project = await Project.findById(subprojectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // 🔥 Dependency validation
    if (subTaskType === "Dependent") {
      if (!dependencyTaskId) {
        return res.status(400).json({
          message: "dependencyTaskId is required for Dependent subtasks",
        });
      }

      const dependency = await SubTask.findById(dependencyTaskId);

      if (!dependency) {
        return res.status(404).json({
          message: "Dependency subtask not found",
        });
      }

      // ✅ Same parent check
      if (String(dependency.parentTaskId) !== String(parentTaskId)) {
        return res.status(400).json({
          message: "Dependency must belong to same parent task",
        });
      }

      // // ❌ Self dependency protection
      // if (String(dependency._id) === String(dependencyTaskId)) {
      //   return res.status(400).json({
      //     message: "Subtask cannot depend on itself",
      //   });
      // }
    }

    // 🔍 Default status
    const defaultStatus = await TaskStatus.findOne({ name: "To Do" });

    const createdSubTasks = [];

    const due = new Date(subdueDate);
    due.setHours(23, 59, 59, 999);

    // 🔁 Create per assignee
    for (const empId of subassignedTo) {
      const subtask = new SubTask({
        subtaskName,
        subdescription,
        parentTaskId,
        subprojectId,
        subassignedTo: [empId],
        subcreatedBy,
        subtaskPriorityId,
        subdueDate: due,
        subnotifyId: subnotifyId || [],
        subtaskStatusId: defaultStatus?._id,
        subTaskType: subTaskType || "Independent",
        dependencyTaskId: subTaskType === "Dependent" ? dependencyTaskId : null,
      });

      await subtask.save();

      // 🔥 Populate for UI
      await subtask.populate("subassignedTo", "name email");
      await subtask.populate("subtaskStatusId", "name");
      await subtask.populate("subtaskPriorityId", "name");
      await subtask.populate("parentTaskId", "taskName");

      createdSubTasks.push(subtask);

      // 🔔 Notification
      const employee = await Employee.findById(empId);
      if (employee) {
        await Notification.create({
          type: "subtask-assignment",
          message: `New subtask "${subtaskName}" assigned to you under task "${parentTask.taskName}"`,
          fromEmployeeId: subcreatedBy,
          toEmployeeId: empId,
          status: "unseen",
          meta: { subtaskId: subtask._id },
        });
      }
    }

    res.status(201).json({
      message: "Subtasks created successfully",
      subtasks: createdSubTasks,
    });
  } catch (err) {
    console.error("Create SubTask Error:", err);
    res.status(500).json({
      message: "Error creating subtask",
      error: err.message,
    });
  }
};

// ======================== GET SUBTASKS BY TASK ========================
exports.getSubTasksByTaskId = async (req, res) => {
  try {
    const { parentTaskId } = req.body;

    if (!parentTaskId) {
      return res.status(400).json({
        message: "parentTaskId is required",
      });
    }

    const subTasks = await SubTask.find({ parentTaskId })
      .populate("subassignedTo", "name email")
      .populate("subtaskStatusId", "name")
      .populate("subtaskPriorityId", "name")
      .populate({
        path: "dependencyTaskId",
        select: "subtaskName subtaskStatusId",
        populate: {
          path: "subtaskStatusId",
          select: "name",
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json(subTasks);
  } catch (error) {
    console.error("Get SubTasks Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ======================== GET SUBTASK BY ID ========================
exports.getSubTaskById = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({ message: "SubTask ID is required" });
    }

    const subTask = await SubTask.findById(_id)
      .populate("subassignedTo", "name email")
      .populate("subtaskStatusId", "name")
      .populate("subtaskPriorityId", "name")
      .populate("parentTaskId", "taskName");

    if (!subTask) {
      return res.status(404).json({ message: "SubTask not found" });
    }

    res.status(200).json(subTask);
  } catch (error) {
    console.error("Get SubTask Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ======================== UPDATE SUBTASK STATUS ========================
exports.updateSubTaskStatus = async (req, res) => {
  try {
    const { subtaskId, status, progressDetails, feedback } = req.body;

    if (!subtaskId || !status) {
      return res.status(400).json({
        message: "subtaskId and status are required",
      });
    }
    if (status === "Pause" && !progressDetails) {
      return res.status(400).json({
        message: "Progress message required to pause",
      });
    }

    if (status === "Complete" && !feedback) {
      return res.status(400).json({
        message: "Feedback required to complete",
      });
    }

    const subtask = await SubTask.findById(subtaskId).populate(
      "subtaskStatusId",
      "name",
    );
    if (status === "Pause") {
      subtask.subprogressDetails = progressDetails;
    }

    if (status === "Complete") {
      subtask.subfeedback = feedback;
    }
    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    // 🔥 Dependency Check
    if (subtask.subTaskType === "Dependent") {
      const dependency = await SubTask.findById(
        subtask.dependencyTaskId,
      ).populate("subtaskStatusId", "name");

      if (dependency && dependency.subtaskStatusId.name !== "Completed") {
        return res.status(400).json({
          message: "Complete dependency subtask first",
        });
      }
    }

    const statusMap = {
      Start: "69254d07a48e61da37c0a31d",
      Pause: "69254cefa48e61da37c0a317",
      Complete: "69254d16a48e61da37c0a321",
    };

    if (!statusMap[status]) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const currentTime = new Date();

    // 🔥 WORK LOGS
    if (status === "Start" || status === "Resume") {
      subtask.subworkLogs.push({
        employeeId: subtask.subassignedTo[0],
        startTime: currentTime,
      });
    }

    if (status === "Pause" || status === "Complete") {
      const lastLog = subtask.subworkLogs[subtask.subworkLogs.length - 1];

      if (lastLog && !lastLog.endTime) {
        lastLog.endTime = currentTime;
        const hours = (lastLog.endTime - lastLog.startTime) / (1000 * 60 * 60);
        lastLog.hoursWorked = parseFloat(hours.toFixed(2));
      }
    }

    subtask.subtaskStatusId = statusMap[status];
    await subtask.save();
    // 🔔 SEND NOTIFICATION ON COMPLETE
    if (status === "Complete") {
      // notify assignee
      const assigneeId = subtask.subassignedTo[0];

      await Notification.create({
        type: "subtask-completed",
        message: `Subtask "${subtask.subtaskName}" has been completed`,
        fromEmployeeId: assigneeId,
        toEmployeeId: assigneeId,
        status: "unseen",
        meta: { subtaskId: subtask._id },
      });

      // notify creator
      if (subtask.subcreatedBy) {
        await Notification.create({
          type: "subtask-completed",
          message: `Subtask "${subtask.subtaskName}" is completed by assignee`,
          fromEmployeeId: assigneeId,
          toEmployeeId: subtask.subcreatedBy,
          status: "unseen",
          meta: { subtaskId: subtask._id },
        });
      }
      const parentTask = await Task.findById(subtask.parentTaskId);

      if (parentTask?.assignedTo?.length) {
        for (const userId of parentTask.assignedTo) {
          await Notification.create({
            type: "subtask-completed",
            message: `A subtask "${subtask.subtaskName}" is completed under your task`,
            fromEmployeeId: assigneeId,
            toEmployeeId: userId,
            status: "unseen",
            meta: { subtaskId: subtask._id },
          });
        }
      }
    }

    // 🔥 AUTO COMPLETE PARENT TASK
    if (status === "Complete") {
      const allSubtasks = await SubTask.find({
        parentTaskId: subtask.parentTaskId,
      }).populate("subtaskStatusId", "name");

      const allDone = allSubtasks.every(
        (s) => s.subtaskStatusId.name === "Completed",
      );

      if (allDone) {
        await Task.findByIdAndUpdate(subtask.parentTaskId, {
          taskStatusId: "69254d16a48e61da37c0a321",
        });
      }
    }

    res.status(200).json({
      message: `Subtask ${status} successful`,
      subtask,
    });
  } catch (error) {
    console.error("Update SubTask Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
