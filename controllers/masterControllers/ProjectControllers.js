const Project = require("../../models/masterModels/Project");
const ProjectStatus = require("../../models/masterModels/ProjectStatus");
const Employee = require("../../models/masterModels/Employee");
const Client = require("../../models/masterModels/Client");
const mongoose = require("mongoose");
// CREATE Project
exports.createProject = async (req, res) => {
  try {
    const {
      projectName,
      description,
      startDate,
      endDate,
      statusId,
      projectHead,
      assignees,
      createdBy,
      budget,
    } = req.body;

    // validation (basic)
    if (!projectName) {
      return res.status(400).json({ message: "projectName is required" });
    }
    const alreadyExist = await Project.findOne({ projectName: projectName });
    if (alreadyExist) {
      return res.status(400).json({ message: "Project already exists" });
    }
    const project = new Project({
      projectName,
      description,
      startDate,
      endDate,
      projectStatusId: statusId,
      projectHead,
      budget,
      assignedEmployees: assignees || [],
      createdBy,
      clientId: req.body.clientId, // Assuming clientId is sent in the request body
    });

    await project.save();
    res.status(201).json(project);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating project", error: error.message });
  }
};

// GET all Projects

exports.getAllProjects = async (req, res) => {
  try {
    const { _id, role } = req.body;

    let query = {};
    const defaultProjectId = "692686c4b601f8a865c89919";

    if (role !== "Super Admin" && role !== "Admin") {
      query = {
        $or: [
          { assignedEmployees: { $in: [_id] } },
          { _id: new mongoose.Types.ObjectId(defaultProjectId) },
        ],
      };
    }

    const projects = await Project.find(query)
      .populate("projectStatusId", "name")
      .populate({
        path: "assignedEmployees",
        select: "name email",
        match: { isActive: true },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json(projects);
  } catch (error) {
    console.error("getAllProjects error:", error);
    return res.status(500).json({
      message: "Error fetching projects",
      error: error.message,
    });
  }
};
exports.getAllProjectsforassign = async (req, res) => {
  try {
    // Extract user details from the request (sent from frontend)
    const { _id, role } = req.body;

    let query = {};

    // If the user is a Client, only find projects where clientId matches their ID
    if (role === "Client") {
      query = { clientId: _id };
    }
    // If it's Super Admin, query remains {}, fetching everything.

    const projects = await Project.find(query)
      .populate("projectStatusId", "name")
      .populate({
        path: "assignedEmployees",
        select: "name email",
        match: { isActive: true },
      })
      .populate("clientId", "UserName") // This will now show the client info
      .sort({ createdAt: -1 });

    return res.status(200).json(projects);
  } catch (error) {
    console.error("getAllProjects error:", error);
    return res.status(500).json({
      message: "Error fetching projects",
      error: error.message,
    });
  }
};
// GET single Project by ID
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("projectStatusId", "name")
      .populate("projectHead", "employeeName email")
      .populate({
        path: "assignedEmployees",
        select: "employeeName email",
        match: { isActive: true },
      });

    if (!project) return res.status(404).json({ message: "Project not found" });

    res.status(200).json(project);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching project", error: error.message });
  }
};

// UPDATE Project
exports.updateProject = async (req, res) => {
  try {
    const {
      _id,
      projectCode,
      projectName,
      description,
      startDate,
      endDate,
      statusId,
      projectHead,
      assignees,
      budget,
    } = req.body;

    const project = await Project.findById(_id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // update only destructured fields
    if (projectCode !== undefined) project.projectCode = projectCode;
    if (projectName !== undefined) project.projectName = projectName;
    if (description !== undefined) project.description = description;
    if (startDate !== undefined) project.startDate = startDate;
    if (endDate !== undefined) project.endDate = endDate;
    if (budget !== undefined) project.budget = budget;
    if (statusId !== undefined) project.projectStatusId = statusId;
    if (projectHead !== undefined) project.projectHead = projectHead;
    if (assignees !== undefined) project.assignedEmployees = assignees;

    await project.save();
    res.status(200).json(project);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating project", error: error.message });
  }
};

// DELETE Project
exports.deleteProject = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({ message: "Project _id is required" });
    }

    const project = await Project.findByIdAndDelete(_id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting project",
      error: error.message,
    });
  }
};

exports.assignProjectsToClient = async (req, res) => {
  try {
    const { clientId, projectIds } = req.body;

    if (!clientId || !Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({
        message: "clientId and projectIds[] are required",
      });
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // =====================================================
    // 🔥 STEP 1: Update Client (store project IDs)
    // =====================================================
    client.projects = projectIds;
    await client.save();

    // =====================================================
    // 🔥 STEP 2: Update Projects (store clientId)
    // =====================================================
    await Project.updateMany(
      { _id: { $in: projectIds } },
      { $set: { clientId: clientId } },
    );

    // =====================================================
    // 🔥 OPTIONAL: Remove clientId from unassigned projects
    // (important if reassigning)
    // =====================================================
    await Project.updateMany(
      { _id: { $nin: projectIds }, clientId: clientId },
      { $unset: { clientId: "" } },
    );

    return res.status(200).json({
      message: "Projects assigned to client successfully",
    });
  } catch (error) {
    console.error("assignProjectsToClient error:", error);
    return res.status(500).json({
      message: "Error assigning projects",
      error: error.message,
    });
  }
};
