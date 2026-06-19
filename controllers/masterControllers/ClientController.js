const Client = require("../../models/masterModels/Client");
const bcrypt = require("bcrypt");
const Tasks = require("../../models/masterModels/Task");
// CREATE CLIENT
exports.createClient = async (req, res) => {
  try {
    const { ClientCode, UserName, Password, RoleId, projects } = req.body;

    const existingClient = await Client.findOne({
      $or: [{ ClientCode }, { UserName }],
    });

    if (existingClient) {
      return res.status(400).json({
        message: "Client already exists with this code or username",
      });
    }

    let hashedPassword = "";
    if (Password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(Password, salt);
    }

    const client = new Client({
      ClientCode,
      UserName,
      Password: hashedPassword,
      RoleId,
      projects: projects || [],
    });

    await client.save();

    res.status(201).json({
      message: "Client created successfully",
      client,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating client",
      error: error.message,
    });
  }
};

// GET ALL CLIENTS
exports.getAllClients = async (req, res) => {
  try {
    const clients = await Client.find().populate("RoleId").populate("projects");

    res.status(200).json(clients);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching clients",
      error: error.message,
    });
  }
};

// GET SINGLE CLIENT
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate("RoleId")
      .populate("projects");

    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching client",
      error: error.message,
    });
  }
};

// UPDATE CLIENT
exports.updateClient = async (req, res) => {
  try {
    const { _id, ClientCode, UserName, Password, RoleId, projects } = req.body;

    const client = await Client.findById(_id);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    client.ClientCode = ClientCode || client.ClientCode;
    client.UserName = UserName || client.UserName;
    client.RoleId = RoleId || client.RoleId;
    client.projects = projects || client.projects;

    if (Password) {
      const salt = await bcrypt.genSalt(10);
      client.Password = await bcrypt.hash(Password, salt);
    }

    await client.save();

    res.status(200).json({
      message: "Client updated successfully",
      client,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating client",
      error: error.message,
    });
  }
};

// DELETE CLIENT
exports.deleteClient = async (req, res) => {
  try {
    const { _id } = req.body;
    const client = await Client.findByIdAndDelete(_id);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.status(200).json({ message: "Client deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to delete client", error: error.message });
  }
};

exports.loginClient = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userAgent = req.headers["user-agent"] || "";
    const isMobileUA = /mobile|android|iphone|ipad|phone/i.test(userAgent);
    const isMobileHardware = req.headers["x-is-mobile-hardware"] === "true";

    if (isMobileUA || isMobileHardware) {
      return res.status(403).json({
        message:
          "Login from mobile devices (including Desktop Mode) is not allowed.",
      });
    }

    const client = await Client.findOne({ UserName: email }).populate(
      "RoleId",
      "RoleName",
    );

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const isMatch = await bcrypt.compare(password, client.Password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }
    client.isCurrentlyLoggedIn = true;
    await client.save();

    res.status(200).json({
      message: "Login successful",
      client: {
        _id: client._id,
        clientCode: client.ClientCode,
        UserName: client.UserName,
        Password: client.Password,
        role: client.RoleId?.RoleName || "",
        avatar: client.avatar || "",
        isCurrentlyLoggedIn: client.isCurrentlyLoggedIn,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

exports.logoutClient = async (req, res) => {
  try {
    const { email } = req.body; // or get from token/session if you’re using auth

    // 1. Find client
    const client = await Client.findOne({ UserName: email });
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // 2. Check if already logged out
    if (!client.isCurrentlyLoggedIn) {
      return res.status(400).json({ message: "Client is already logged out" });
    }

    // 3. Update login status
    client.isCurrentlyLoggedIn = false;
    await client.save();

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Logout failed", error: error.message });
  }
};
exports.getClientTasks = async (req, res) => {
  try {
    const { clientId, search, status, priority } = req.body;

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // ✅ Extract only IDs
    const projectIds = client.projects.map((p) => p._id);

    const query = {
      projectId: { $in: projectIds },
    };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { taskId: { $regex: search, $options: "i" } },
      ];
    }

    if (status !== "all") {
      query.status = status;
    }

    if (priority !== "all") {
      query.priority = priority;
    }

    const task = await Tasks.find(query)
      .populate("assignedTo", "name")
      .populate("projectId", "projectName")
      .populate("taskStatusId", "name")
      .populate("taskPriorityId", "name")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      tasks: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
