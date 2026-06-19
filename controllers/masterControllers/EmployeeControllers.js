const Employee = require("../../models/masterModels/Employee");
const Department = require("../../models/masterModels/Department");
const Designation = require("../../models/masterModels/Designation");
const Shift = require("../../models/masterModels/Shift");
const WorkLocation = require("../../models/masterModels/WorkLocation");
const Role = require("../../models/masterModels/Role");
const Status = require("../../models/masterModels/Status");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const defaultMenus = require("./defaultMenu.json");
const UserRights = require("../../models/masterModels/UserRights");
const MenuRegistry = require("../../models/masterModels/MenuRegistry");
const RoleBased = require("../../models/masterModels/RBAC");
const LeaveBalance = require("../../models/masterModels/LeaveBalance");
const Client = require("../../models/masterModels/Client");
const {
  autoCheckoutOnDisconnect,
} = require("../masterControllers/AttendanceControllers");
// const LeaveModel = require("../../model/masterModels/Leave");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// --- MULTER CONFIGURATION ---
const uploadDir = "Employeepic";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, `employee-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedTypes.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error("Only .png, .jpg and .jpeg formats are allowed!"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("avatar");
// --- MIDDLEWARE WRAPPER ---
exports.employeeUploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        message:
          err.code === "LIMIT_FILE_SIZE"
            ? "File too large (Max 5MB)"
            : err.message,
      });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// CREATE Employee + LeaveBalance
exports.createEmployee = async (req, res) => {
  const session = await Employee.startSession();
  session.startTransaction();

  try {
    const {
      code,
      name,
      email,
      password,
      designationId,
      departmentId,
      joinDate,
      birthDate,
      phoneNumber,
      salary,
      statusId,
      workingHours,
      workLocationId,
      roleId,
      shiftId,
      unitId,
    } = req.body;

    const avatar = req.file
      ? `${req.protocol}://${req.get("host")}/Employeepic/${req.file.filename}`
      : "";

    const employee = new Employee({
      code,
      name,
      email,
      password,
      designationId,
      departmentId,
      joinDate,
      birthDate,
      phoneNumber,
      salary,
      statusId,
      avatar,
      workingHours,
      workLocationId,
      roleId,
      shiftId,
    });

    await employee.save({ session });

    const leaveBalances = [
      {
        leaveTypeId: "6925467ba48e61da37c0a220",
        totalAllocated: 12,
        remaining: 12,
      },
      {
        leaveTypeId: "69254608a48e61da37c0a1f5",
        totalAllocated: 10,
        remaining: 10,
      },
      {
        leaveTypeId: "692545eda48e61da37c0a1e8",
        totalAllocated: 12,
        remaining: 12,
      },
    ];

    const newLeaveBalance = new LeaveBalance({
      employeeId: employee._id,
      unitId,
      leaveBalances,
    });

    await newLeaveBalance.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Employee created successfully with leave balances",
      employee,
      leaveBalance: newLeaveBalance,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating employee with leave balance:", error);
    res.status(500).json({
      message: "Failed to create employee with leave balance",
      error: error.message,
    });
  }
};

// GET ALL Employees
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({})
      .populate("departmentId", "departmentName")
      .populate("designationId", "designationName")
      .populate("roleId", "RoleName")
      .populate("statusId", "statusName")
      .populate("workLocationId", "locationName")
      .populate("shiftId", "shiftName startTime endTime")
      .lean();

    const formattedEmployees = employees.map((emp) => ({
      _id: emp._id,
      code: emp.code,
      name: emp.name,
      email: emp.email,
      password: emp.password,
      joinDate: emp.joinDate,
      birthDate: emp.birthDate,
      phoneNumber: emp.phoneNumber,
      salary: emp.salary,
      avatar: emp.avatar,
      workingHours: emp.workingHours,
      lastLoggedIn: emp.lastLoggedIn,
      isCurrentlyLoggedIn: emp.isCurrentlyLoggedIn,
      isActive: emp.isActive,

      departmentId: emp.departmentId?._id || null,
      departmentName: emp.departmentId?.departmentName || "",

      designationId: emp.designationId?._id || null,
      designationName: emp.designationId?.designationName || "",

      roleId: emp.roleId?._id || null,
      roleName: emp.roleId?.RoleName || "",

      statusId: emp.statusId?._id || null,
      statusName: emp.statusId?.statusName || "",

      workLocationId: emp.workLocationId?._id || null,
      workLocationName: emp.workLocationId?.locationName || "",

      shiftId: emp.shiftId?._id || null,
      shiftName: emp.shiftId?.shiftName || "",
      shiftStartTime: emp.shiftId?.startTime || "",
      shiftEndTime: emp.shiftId?.endTime || "",
    }));

    res.status(200).json(formattedEmployees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
exports.getAllActiveEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true })
      .populate("departmentId", "departmentName")
      .populate("designationId", "designationName")
      .populate("roleId", "RoleName")
      .populate("statusId", "statusName")
      .populate("workLocationId", "locationName")
      .populate("shiftId", "shiftName startTime endTime")
      .lean();

    const formattedEmployees = employees.map((emp) => ({
      _id: emp._id,
      code: emp.code,
      name: emp.name,
      email: emp.email,
      password: emp.password,
      joinDate: emp.joinDate,
      birthDate: emp.birthDate,
      phoneNumber: emp.phoneNumber,
      salary: emp.salary,
      avatar: emp.avatar,
      workingHours: emp.workingHours,
      lastLoggedIn: emp.lastLoggedIn,
      isCurrentlyLoggedIn: emp.isCurrentlyLoggedIn,
      isActive: emp.isActive,

      departmentId: emp.departmentId?._id || null,
      departmentName: emp.departmentId?.departmentName || "",

      designationId: emp.designationId?._id || null,
      designationName: emp.designationId?.designationName || "",

      roleId: emp.roleId?._id || null,
      roleName: emp.roleId?.RoleName || "",

      statusId: emp.statusId?._id || null,
      statusName: emp.statusId?.statusName || "",

      workLocationId: emp.workLocationId?._id || null,
      workLocationName: emp.workLocationId?.locationName || "",

      shiftId: emp.shiftId?._id || null,
      shiftName: emp.shiftId?.shiftName || "",
      shiftStartTime: emp.shiftId?.startTime || "",
      shiftEndTime: emp.shiftId?.endTime || "",
    }));

    res.status(200).json(formattedEmployees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.uploadEmployeeAvatar = async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({
        success: false,
        message: "Employee id is required",
      });
    }

    const employee = await Employee.findById(_id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    const avatarUrl = `${req.protocol}://${req.get("host")}/Employeepic/${req.file.filename}`;

    employee.avatar = avatarUrl;
    await employee.save();

    return res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      employee,
      avatar: avatarUrl,
    });
  } catch (error) {
    console.error("uploadEmployeeAvatar error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload avatar",
      error: error.message,
    });
  }
};
// GET ALL Department
exports.getAllDepartments = async (req, res) => {
  try {
    const department = await Department.find();
    res.status(200).json(department);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to get employees", error: error.message });
  }
};

// GET ALL Designation
exports.getAllDesignations = async (req, res) => {
  try {
    const designation = await Designation.find();
    res.status(200).json(designation);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to get employees", error: error.message });
  }
};

// GET ALL Shift
exports.getAllShifts = async (req, res) => {
  try {
    const shift = await Shift.find();
    res.status(200).json(shift);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to get employees", error: error.message });
  }
};

// GET ALL WorkLocation
exports.getAllWorkLocations = async (req, res) => {
  try {
    const workLocation = await WorkLocation.find();
    res.status(200).json(workLocation);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to get employees", error: error.message });
  }
};

// GET ALL Role
exports.getAllRoles = async (req, res) => {
  try {
    const role = await RoleBased.find();
    res.status(200).json(role);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to get employees", error: error.message });
  }
};

// GET ALL Status
exports.getAllStatus = async (req, res) => {
  try {
    const status = await Status.find().limit(2);
    res.status(200).json(status);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to get employees", error: error.message });
  }
};

// GET Employee BY ID
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.body.id); // no populate

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json(employee);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to get employee", error: error.message });
  }
};

// UPDATE Employee
exports.updateEmployee = async (req, res) => {
  try {
    if (!req.body || !req.body._id) {
      return res.status(400).json({ message: "_id is required" });
    }

    const existingEmployee = await Employee.findById(req.body._id);

    if (!existingEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    let avatar = existingEmployee.avatar;

    if (req.file) {
      avatar = `${req.protocol}://${req.get("host")}/Employeepic/${req.file.filename}`;
    }
    const statusIdInactive = "69253cc8a48e61da37c09edc";

    let isActive = true;

    if (req.body.statusId === statusIdInactive) {
      isActive = false;
    }
    const employee = await Employee.findByIdAndUpdate(
      req.body._id,
      {
        code: req.body.code,
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        designationId: req.body.designationId,
        departmentId: req.body.departmentId,
        joinDate: req.body.joinDate,
        birthDate: req.body.birthDate,
        phoneNumber: req.body.phoneNumber,
        salary: req.body.salary,
        statusId: req.body.statusId,
        shiftId: req.body.shiftId,
        workingHours: req.body.workingHours,
        workLocationId: req.body.workLocationId,
        roleId: req.body.roleId,
        avatar,
        isActive: isActive,
      },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      message: "Employee updated successfully",
      employee,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to update employee",
      error: error.message,
    });
  }
};
// DELETE Employee
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.body.id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to delete employee", error: error.message });
  }
};

// LOGIN Employee
exports.loginEmployee = async (req, res) => {
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

    const employee = await Employee.findOne({ email: email }).populate(
      "roleId",
      "RoleName",
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (employee.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    employee.isCurrentlyLoggedIn = true;
    await employee.save();

    res.status(200).json({
      message: "Login successful",
      employee: {
        _id: employee._id,
        employeeCode: employee.code ? employee.code : "",
        name: employee.name,
        email: employee.email,
        role: employee.roleId?.RoleName || "",
        avatar: employee.avatar || "",
        isCurrentlyLoggedIn: employee.isCurrentlyLoggedIn,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

exports.logoutEmployee = async (req, res) => {
  try {
    const { email, UserName } = req.body; // or get from token/session if you’re using auth

    // 1. Find employee
    const employee = await Employee.findOne({ email: email });
    if (!employee) {
      const client = await Client.findOne({ UserName: UserName });
      if (client) {
        client.isCurrentlyLoggedIn = false;
        await client.save();
        return res.status(200).json({ message: "Client logout successful" });
      }
      return res.status(404).json({ message: "Employee not found" });
    }

    // 2. Check if already logged out
    if (!employee.isCurrentlyLoggedIn) {
      return res
        .status(400)
        .json({ message: "Employee is already logged out" });
    }

    // 3. Update login status
    employee.isCurrentlyLoggedIn = false;
    await employee.save();

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Logout failed", error: error.message });
  }
};

exports.logoutUser = async (employeeId) => {
  try {
    // Update lastActive or any other logout tracking if needed
    await Employee.findByIdAndUpdate(employeeId, {
      isCurrentlyLoggedIn: false,
    });
  } catch (err) {
    console.error("❌ Error logging out user:", err.message);
  }
};

exports.cronJobLogOut = async (req, res) => {
  try {
    // Get all employees currently logged in
    const loggedInEmployees = await Employee.find({
      isCurrentlyLoggedIn: true,
    });

    if (loggedInEmployees.length === 0) {
      console.log("✅ No logged-in employees found at logout time.");
      return res.status(200).json({ message: "No logged-in employees found." });
    }

    // Iterate through each logged-in employee
    for (const employee of loggedInEmployees) {
      await autoCheckoutOnDisconnect(employee._id);

      employee.isCurrentlyLoggedIn = false;
      employee.lastLoggedIn = new Date();
      await employee.save();
    }

    console.log(
      `🕖 Cron job logout executed: ${loggedInEmployees.length} employees logged out.`,
    );

    return res.status(200).json({
      message: `${loggedInEmployees.length} employees logged out and auto-checked out successfully.`,
    });
  } catch (error) {
    console.error("❌ Error during cron job logout:", error);
    return res.status(500).json({
      message: "Internal Server Error during cron job logout.",
      error: error.message,
    });
  }
};

exports.checkLogin = async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"]; // userId passed from frontend
    if (!userId) {
      return res.status(401).json({ message: "User ID missing" });
    }

    const user = await Employee.findById(userId);

    if (!user || !user.isCurrentlyLoggedIn) {
      return res.status(401).json({ message: "User not logged in" });
    }

    // ✅ User is valid and logged in
    req.user = user;
    next();
  } catch (err) {
    console.error("checkLogin error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
