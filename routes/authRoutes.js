const express = require("express");
const router = express.Router();

const EmployeeController = require("../controllers/masterControllers/EmployeeControllers");
const ClientController = require("../controllers/masterControllers/ClientController");
router.post("/Employee/login", EmployeeController.loginEmployee);
router.post("/Employee/logout", EmployeeController.logoutEmployee);
router.post("/Client/clientlogin", ClientController.loginClient);
router.post("/Client/clientlogout", ClientController.logoutClient);

module.exports = router;
