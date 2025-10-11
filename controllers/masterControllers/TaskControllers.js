// controllers/taskController.js
const Task = require("../../models/masterModels/Task");
const Notification = require('../../models/masterModels/Notifications')
const Employee = require('../../models/masterModels/Employee')

function getIndiaDateTime() {
  const now = new Date();
  const indiaTime = now.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  return indiaTime; 
}

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
      reqLeadCount,
      compLeadCount
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
      reqLeadCount,
      compLeadCount
    });

    await task.save();

        // 2️⃣ Create a notification for the approver
        const notification = await Notification.create({
          type: "task-assignment",
          message: "New task is assigned for you",
          fromEmployeeId: createdBy,
          toEmployeeId: assignedTo,
          status: "unseen",
          meta: {
            taskId: task._id
          }
        });
        // 3️⃣ Emit notification via Socket.IO
        const io = req.app.get("socketio");
        if (io && assignedTo) {
          io.to(assignedTo.toString()).emit("receiveNotification", notification);
        }
    res.status(201).json({ message: "Task created successfully", task });
  } catch (error) {
    console.error("Create Task Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Get All Tasks
exports.getAllTasks = async (req, res) => {
  try {
    const {_id,role}= req.body;
    let filter={}
    if(role !== 'Super Admin' && role !== 'Admin'){
      filter.assignedTo = _id
    }
    const tasks = await Task.find(filter)
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
      reqLeadCount,
      compLeadCount
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
    if(reqLeadCount !== undefined) task.reqLeadCount = reqLeadCount;
    if(compLeadCount !== undefined) task.compLeadCount = compLeadCount; 

    await task.save();
    res.status(200).json({ message: "Task updated successfully", task });
  } catch (error) {
    console.error("Update Task Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId, status, feedback, progressDetails, reasonForPending ,reqLeadCount,compLeadCount} = req.body;

    if (!taskId || !status) {
      return res.status(400).json({ message: "Task ID and status are required" });
    }

    // Mapping status to TaskStatus IDs
    const statusMap = {
      Start: { id: "68b5a26288e62ec178bb2927", message: "Task Started" },     // In Progress
      Pause: { id: "68b5a25b88e62ec178bb2923", message: "Task Paused" },      // To Do
      // Complete: { id: "68b5a26d88e62ec178bb292b", message: "Task Completed" } // Completed
    };
        const updateObj = {};
        const selectedStatus = statusMap[status];
    if(status === 'Complete'){
 const taskname=await Task.findOne({_id:taskId})
    const assignedEmployee=await Employee.findOne({_id:taskname.assignedTo})
        // 2️⃣ Create a notification for the approver
        const notification = await Notification.create({
          type: "task-complete",
          message: `Task Completed by ${assignedEmployee.name} - ${taskname.taskName} (${taskname.description}), FeedBack:${feedback}`,
          fromEmployeeId: taskname.assignedTo,
          toEmployeeId: taskname.createdBy,
          status: "unseen",
          meta: {
            taskId: taskId
          }
        });
        // 3️⃣ Emit notification via Socket.IO
        const io = req.app.get("socketio");
        if (io && taskname.createdBy) {
          io.to(taskname.createdBy.toString()).emit("receiveNotification", notification);
        }
    }else{
    if (!selectedStatus && status !== 'Complete') {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Build update object
    updateObj.taskStatusId = selectedStatus.id ;
    }    
    if (feedback) updateObj.feedback = feedback;
    if (compLeadCount) updateObj.compLeadCount = compLeadCount

    const pushObj = {};
    if (progressDetails) pushObj.progressDetails = `${progressDetails} - ${getIndiaDateTime()}`;
    if (reasonForPending) pushObj.reasonForPending = reasonForPending;
    
    if (Object.keys(pushObj).length > 0) {
      updateObj.$push = pushObj;
    }

    const task = await Task.findByIdAndUpdate(taskId, updateObj, { new: true })
      .populate("projectId", "projectName")
      .populate("taskStatusId", "name")
      .populate("assignedTo", "name email");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json({
      message: status !== 'Complete' ? selectedStatus.message : 'Task Completion requested',
      task,
    });
  } catch (error) {
    console.error("Update Task Status Error:", error);
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
