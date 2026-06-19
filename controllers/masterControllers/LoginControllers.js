require("dotenv").config(); // ✅ Ensure this is at the top of your entry point (e.g., server.js)

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Employee = require("../../models/masterModels/Employee");
const Client = require("../../models/masterModels/Client");
exports.verifyLogin = async (req, res) => {
  try {
    const { EmployeeCode, password } = req.body;

    // Find user
    const user = await Employee.findOne({ EmployeeCode });

    if (!user) {
      return res.status(400).json({ message: "Employee Code does not exist" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // ✅ Generate JWT token
    const token = jwt.sign(
      {
        _id: user._id,
        EmployeeCode: user.EmployeeCode,
        role: user.role,
      },
      process.env.JWT_SECRET || "9@B!7eD#v^3Qp2LmZ$Wk1X%tRg6N*oYu8hGlDd4Ci",
      { expiresIn: "7d" },
    );

    // ✅ Update last login
    const now = new Date();
    user.lastLogin = now;
    await user.save();

    // ✅ Format last login as date & time
    const lastLoginFormatted = now.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    res.status(200).json({
      message: "Login successful",
      data: {
        _id: user._id,
        EmployeeName: user.EmployeeName,
        EmployeeCode: user.EmployeeCode,
        password: user.password,
        lastLogin: lastLoginFormatted,
        role: user.employeeRole,
        token,
        tokenExpiry: "7 days",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

exports.verifyClientLogin = async (req, res) => {
  try {
    const { UserName, Password } = req.body;

    const user = await Client.findOne({ UserName })
      .populate("RoleId")
      .populate("projects");

    if (!user) {
      return res.status(400).json({
        message: "Client not found",
      });
    }

    const isMatch = await bcrypt.compare(Password, user.Password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        _id: user._id,
        UserName: user.UserName,
        role: user.RoleId,
      },
      process.env.JWT_SECRET || "yourSecretKey",
      { expiresIn: "7d" },
    );

    // Update last login
    const now = new Date();
    user.lastLogin = now;
    await user.save();

    const lastLoginFormatted = now.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    res.status(200).json({
      message: "Client login successful",
      data: {
        _id: user._id,
        ClientCode: user.ClientCode,
        UserName: user.UserName,
        projects: user.projects,
        role: user.RoleId,
        lastLogin: lastLoginFormatted,
        token,
        tokenExpiry: "7 days",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error.message,
    });
  }
};
