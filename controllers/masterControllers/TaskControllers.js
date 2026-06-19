// controllers/taskController.js
const Task = require("../../models/masterModels/Task");
const TaskStatus = require("../../models/masterModels/TaskStatus");
const Notification = require("../../models/masterModels/Notifications");
const Employee = require("../../models/masterModels/Employee");
const {
  sendWhatsAppTemplate,
} = require("../../controllers/masterControllers/WhatsAppControllers");
const Project = require("../../models/masterModels/Project");
function getIndiaDateTime() {
  const now = new Date();
  const indiaTime = now.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  return indiaTime;
}

// ✅ Create Tasks for Multiple Assignees
exports.createTask = async (req, res) => {
  try {
    const {
      taskCode,
      taskName,
      projectId,
      description,
      startDate,
      dueDate,
      taskPriorityId,
      assignees,
      notifyId,
      createdBy,
      reqLeadCount,
      compLeadCount,
    } = req.body;

    if (!taskName || !projectId) {
      return res
        .status(400)
        .json({ message: "taskName and projectId are required" });
    }

    if (!assignees || !Array.isArray(assignees) || assignees.length === 0) {
      return res.status(400).json({
        message: "assignees must be a non-empty array",
      });
    }

    const taskStatus = await TaskStatus.findOne({ name: "To Do" });

    const createdEmployee = await Employee.findById(createdBy);
    if (!createdEmployee) {
      return res.status(404).json({ message: "Creating employee not found" });
    }

    // ✅ Fetch project once
    const project = await Project.findById(projectId).select("projectName");
    // Get all Admins and Super Admins
    const superAdmin_id = "6915bd98b91129beed52104b";

    const admins = await Employee.find({
      roleId: { $in: [superAdmin_id] },
    }).select("_id");

    console.log("Admins fetched for notification:", admins);
    const due = new Date(dueDate);
    due.setHours(23, 59, 59, 999);
    const formattedDueDate = due.toLocaleString("en-IN");

    const io = req.app.get("socketio");
    const createdTasks = [];
    const notificationErrors = [];

    for (const assigneeId of assignees) {
      const task = new Task({
        taskCode,
        taskName,
        projectId,
        description,
        startDate,
        dueDate,
        taskStatusId: taskStatus._id,
        taskPriorityId,
        assignedTo: assigneeId,
        createdBy,
        reqLeadCount,
        notifyId: notifyId || [],
        compLeadCount,
      });

      await task.save();
      createdTasks.push(task);

      try {
        const assignedEmployee = await Employee.findById(assigneeId);
        if (!assignedEmployee) continue;

        // WhatsApp
        await sendWhatsAppTemplate(
          assignedEmployee.phoneNumber,
          assignedEmployee.name,
          createdEmployee.name,
          description,
          dueDate,
        );

        // ✅ Notification
        const notification = await Notification.create({
          type: "task-assignment",
          message: `New task "${taskName}" assigned. Project: ${
            project ? project.projectName : "Unknown"
          }. Due date: ${formattedDueDate}`,
          fromEmployeeId: createdBy,
          toEmployeeId: assigneeId,
          status: "unseen",
          meta: { taskId: task._id },
        });

        // Socket emit
        if (io) {
          io.to(assigneeId.toString()).emit(
            "receiveNotification",
            notification,
          );
        }
        // Notify Admins and Super Admins
      } catch (notifyError) {
        console.error("Notification Error:", notifyError.message);
        notificationErrors.push({
          assigneeId,
          error: notifyError.message,
        });
      }
    }
    for (const admin of admins) {
      const adminNotification = await Notification.create({
        type: "task-assignment",
        message: `New task "${taskName}" created by ${createdEmployee.name}. Project: ${
          project ? project.projectName : "Unknown"
        }.`,
        fromEmployeeId: createdBy,
        toEmployeeId: admin._id,
        status: "unseen",
        meta: { taskId: createdTasks[0]._id },
      });
      console.log("Admin Notification Created:", adminNotification);
      console.log("Admin Notification Created:", adminNotification.type);
      console.log(
        "Admin Notification Created:",
        adminNotification.toEmployeeId,
      );
      if (io) {
        io.to(admin._id.toString()).emit(
          "receiveNotification",
          adminNotification,
        );
      }
    }
    res.status(201).json({
      message: "Tasks created successfully",
      tasks: createdTasks,
      notificationErrors,
    });
  } catch (error) {
    console.error("Create Task Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//  Get All Tasks
exports.getAllTasks = async (req, res) => {
  try {
    const { _id, role } = req.body;

    let filter = {};

    if (role === "Employee") {
      filter.assignedTo = _id;
    }

    // Client should see tasks from their projects
    if (role === "Client") {
      const projects = await Project.find({ clientId: _id }).select("_id");

      const projectIds = projects.map((p) => p._id);

      filter.projectId = { $in: projectIds };
    }

    const tasks = await Task.find(filter)
      .populate("projectId", "projectName projectCode")
      .populate("taskStatusId", "name")
      .populate("taskPriorityId", "name")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(tasks);
  } catch (error) {
    console.error("Get All Tasks Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ✅ Get Task By ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("projectId", "projectName projectCode")
      .populate("taskStatusId", "name")
      .populate("taskPriorityId", "name")
      .populate("assignedTo", "name email");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json(task);
  } catch (error) {
    console.error("Get Task Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Update Task
exports.updateTask = async (req, res) => {
  try {
    const {
      _id,
      taskName,
      description,
      startDate,
      dueDate,
      taskStatusId,
      taskPriorityId,
      assignedTo,
      reqLeadCount,
      compLeadCount,
      notifyId,
    } = req.body;

    const task = await Task.findById(_id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Only updating selected fields
    if (taskName !== undefined) task.taskName = taskName;
    if (description !== undefined) task.description = description;
    if (startDate !== undefined) task.startDate = startDate;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (taskStatusId !== undefined) task.taskStatusId = taskStatusId;
    if (taskPriorityId !== undefined) task.taskPriorityId = taskPriorityId;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;
    if (reqLeadCount !== undefined) task.reqLeadCount = reqLeadCount;
    if (compLeadCount !== undefined) task.compLeadCount = compLeadCount;
    if (notifyId !== undefined) task.notifyId = notifyId;

    await task.save();
    res.status(200).json({ message: "Task updated successfully", task });
  } catch (error) {
    console.error("Update Task Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const {
      taskId,
      status,
      feedback,
      progressDetails,
      reasonForPending,
      reqLeadCount,
      compLeadCount,
      notifyId,
    } = req.body;

    if (!taskId || !status) {
      return res
        .status(400)
        .json({ message: "Task ID and status are required" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const statusMap = {
      Start: { id: "69254d07a48e61da37c0a31d", message: "Task Started" },
      Pause: { id: "69254cefa48e61da37c0a317", message: "Task Paused" },
      Complete: { id: "69254d16a48e61da37c0a321", message: "Task Completed" },
    };

    const selectedStatus = statusMap[status];
    if (!selectedStatus) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const currentTime = new Date();

    // ---------------- WORK LOG HANDLING ----------------

    if (status === "Start") {
      task.workLogs.push({
        employeeId: task.assignedTo[0],
        startTime: currentTime,
      });
    }

    if (status === "Pause" || status === "Complete") {
      const lastLogIndex = task.workLogs.length - 1;

      if (lastLogIndex >= 0) {
        const lastLog = task.workLogs[lastLogIndex];

        if (lastLog.startTime && !lastLog.endTime) {
          lastLog.endTime = currentTime;

          const durationMs = lastLog.endTime - lastLog.startTime;
          const hours = durationMs / (1000 * 60 * 60);

          lastLog.hoursWorked = parseFloat(hours.toFixed(2));
        }
      }
    }
    if (notifyId !== undefined) {
      task.notifyId = notifyId;
    }
    // ---------------- TASK COMPLETE NOTIFICATION ----------------

    if (status === "Complete") {
      const assignedEmployee = await Employee.findById(task.assignedTo[0]);
      const io = req.app.get("socketio");
      // Fetch Admins and Super Admins
      const admins = await Employee.find({
        role: { $in: ["Admin", "Super Admin"] },
      }).select("_id");
      const message = `Task Completed by ${
        assignedEmployee ? assignedEmployee.name : "Employee"
      } - ${task.taskName} (${task.description}), Feedback: ${feedback || ""}`;

      const notifiedEmployees = new Set();

      // 1️⃣ Notify Task Creator
      if (task.createdBy) {
        const creatorNotification = await Notification.create({
          type: "task-complete",
          message,
          fromEmployeeId: task.assignedTo[0],
          toEmployeeId: task.createdBy,
          status: "unseen",
          meta: { taskId },
        });

        notifiedEmployees.add(task.createdBy.toString());

        if (io) {
          io.to(task.createdBy.toString()).emit(
            "receiveNotification",
            creatorNotification,
          );
        }
      }

      // 2️⃣ Notify notifyId Employees (avoid duplicates)
      if (task.notifyId && task.notifyId.length > 0) {
        for (const employeeId of task.notifyId) {
          if (notifiedEmployees.has(employeeId.toString())) continue;

          const notification = await Notification.create({
            type: "task-complete",
            message,
            fromEmployeeId: task.assignedTo[0],
            toEmployeeId: employeeId,
            status: "unseen",
            meta: { taskId },
          });

          if (io) {
            io.to(employeeId.toString()).emit(
              "receiveNotification",
              notification,
            );
          }

          notifiedEmployees.add(employeeId.toString());
        }
      }
      // Notify Admins and Super Admins
      for (const admin of admins) {
        if (notifiedEmployees.has(admin._id.toString())) continue;

        const adminNotification = await Notification.create({
          type: "task-complete",
          message,
          fromEmployeeId: task.assignedTo[0],
          toEmployeeId: admin._id,
          status: "unseen",
          meta: { taskId },
        });

        if (io) {
          io.to(admin._id.toString()).emit(
            "receiveNotification",
            adminNotification,
          );
        }

        notifiedEmployees.add(admin._id.toString());
      }
      task.taskStatusId = selectedStatus.id;
    } else {
      task.taskStatusId = selectedStatus.id;
    }

    // ---------------- GENERIC UPDATES ----------------

    if (feedback) task.feedback = feedback;
    if (compLeadCount) task.compLeadCount = compLeadCount;

    if (progressDetails) {
      task.progressDetails.push(
        `${progressDetails} - ${new Date().toLocaleString("en-IN")}`,
      );
    }

    if (reasonForPending) {
      task.reasonForPending.push(reasonForPending);
    }

    await task.save();

    // ---------------- RESPONSE POPULATION ----------------

    await task.populate("projectId", "projectName");
    await task.populate("taskStatusId", "name");
    await task.populate("assignedTo", "name email");

    res.status(200).json({
      message: selectedStatus.message,
      task,
    });
  } catch (error) {
    console.error("Update Task Status Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
// ✅ Delete Task
exports.deleteTask = async (req, res) => {
  try {
    const { _id } = req.body;
    const task = await Task.findByIdAndDelete(_id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Delete Task Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
