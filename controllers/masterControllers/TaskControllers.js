// controllers/taskController.js
const Task = require("../../models/masterModels/Task");

// ✅ Create Task
exports.createTask = async (req, res) => {
  try {
    const {
      taskCode,
      taskName,
      projectId,
      description,
      startDate,
      dueDate,
      taskStatusId,
      taskPriorityId,
      assignedTo,
      createdBy,
    } = req.body;

    // Validation: require taskCode, taskName, projectId
    if (!taskName || !projectId) {
      return res.status(400).json({ message: "taskName and projectId are required" });
    }

    const task = new Task({
      taskCode,
      taskName,
      projectId,
      description,
      startDate,
      dueDate,
      taskStatusId,
      taskPriorityId,
      assignedTo,
      createdBy,
    });

    await task.save();
    res.status(201).json({ message: "Task created successfully", task });
  } catch (error) {
    console.error("Create Task Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Get All Tasks
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("projectId", "projectName projectCode")
      .populate("taskStatusId", "name")
      .populate("taskPriorityId", "name")
      .populate("assignedTo", "name email")

    res.status(200).json(tasks);
  } catch (error) {
    console.error("Get All Tasks Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Get Task By ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("projectId", "projectName projectCode")
      .populate("taskStatusId", "name")
      .populate("taskPriorityId", "name")
      .populate("assignedTo", "name email")

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json(task);
  } catch (error) {
    console.error("Get Task Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
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

    await task.save();
    res.status(200).json({ message: "Task updated successfully", task });
  } catch (error) {
    console.error("Update Task Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Delete Task
exports.deleteTask = async (req, res) => {
  try {
    const {_id} = req.body
    const task = await Task.findByIdAndDelete(_id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Delete Task Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};
