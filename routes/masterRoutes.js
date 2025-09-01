const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // temp folder

const DepartmentController = require('../controllers/masterControllers/DepartmentControllers')
const ShiftController = require('../controllers/masterControllers/ShiftControllers')
const WorkLocationController = require('../controllers/masterControllers/WorkLocationControllers')
const DesignationController = require('../controllers/masterControllers/DesignationControllers')
const EmployeeController = require('../controllers/masterControllers/EmployeeControllers')
const LoginController = require('../controllers/masterControllers/LoginControllers')
const NotificationController = require('../controllers/masterControllers/NotificationControllers')
const StatusController = require('../controllers/masterControllers/StatusControllers')
const StateController = require('../controllers/masterControllers/StateControllers')
const CityController = require('../controllers/masterControllers/CityControllers')
const RBACController = require('../controllers/masterControllers/RBACControllers');
const RoleController = require('../controllers/masterControllers/RoleControllers')
const LeadController = require('../controllers/masterControllers/LeadControllers')
const LeadStatusController = require('../controllers/masterControllers/LeadStatusControllers')

//Notification 

router.post("/notifications", NotificationController.createNotification);
router.post("/Notifications/getNotifications", NotificationController.getNotificationsByUnit);


//********* Login ***************************** */
router.post('/Auth/login', LoginController.verifyLogin);

//********************Department routers ********************** */

router.post('/Department/createDepartment', DepartmentController.createDepartment); 
router.post('/Department/getAllDepartments', DepartmentController.getAllDepartments);
router.post('/Department/updateDepartment', DepartmentController.updateDepartment);

//********************Shift routers ********************** */

router.post('/Shift/createShift', ShiftController.createShift); 
router.post('/Shift/getAllShifts', ShiftController.getAllShifts);
router.post('/Shift/updateShift', ShiftController.updateShift);

//********************Employee routers ********************** */

router.post('/Employee/createEmployee', EmployeeController.createEmployee); 
router.post('/Employee/getAllEmployees', EmployeeController.getAllEmployees);
router.post('/Employee/updateEmployee', EmployeeController.updateEmployee);
router.post('/Employee/getAllDepartments', EmployeeController.getAllDepartments);
router.post('/Employee/getAllDesignations', EmployeeController.getAllDesignations);
router.post('/Employee/getAllShifts', EmployeeController.getAllShifts);
router.post('/Employee/getAllWorkLocations', EmployeeController.getAllWorkLocations);
router.post('/Employee/getAllRoles', EmployeeController.getAllRoles);
router.post('/Employee/getAllStatus', EmployeeController.getAllStatus);
router.post('/Employee/login', EmployeeController.loginEmployee);
router.post('/Employee/logout', EmployeeController.logoutEmployee);

//Status Routes
router.post('/Status/createStatus', StatusController.createStatus)
router.post('/Status/deleteStatus', StatusController.deleteStatus)
router.post('/Status/updateStatus', StatusController.updateStatus)
router.post('/Status/getAllStatus', StatusController.getAllStatuses)

//WorkLocation Routes
router.post('/WorkLocation/createWorkLocation', WorkLocationController.createWorkLocation)
router.post('/WorkLocation/deleteWorkLocation', WorkLocationController.deleteWorkLocation)
router.post('/WorkLocation/updateWorkLocation', WorkLocationController.updateWorkLocation)
router.post('/WorkLocation/getAllWorkLocation', WorkLocationController.getAllWorkLocations)

//Designation Routes
router.post('/Designation/createDesignation', DesignationController.createDesignation)
router.post('/Designation/deleteDesignation', DesignationController.deleteDesignation)
router.post('/Designation/updateDesignation', DesignationController.updateDesignation)
router.post('/Designation/getAllDesignation', DesignationController.getAllDesignations)

//State Routes
router.post('/State/createState', StateController.createState)
router.post('/State/deleteState', StateController.deleteState)
router.post('/State/updateState', StateController.updateState)
router.post('/State/getAllStates', StateController.getAllStates)

//City Routes
router.post('/City/createCity', CityController.createCity)
router.post('/City/deleteCity', CityController.deleteCity)
router.post('/City/updateCity', CityController.updateCity)
router.post('/City/getAllCitys', CityController.getAllCitys)
router.post('/City/getAllStates', CityController.getAllStates)

//Role Routes
router.post('/RoleBased/createRole', RBACController.createRole)
router.post('/RoleBased/deleteRole', RBACController.deleteRole)
router.post('/RoleBased/updateRole', RBACController.updateRole)
router.post('/RoleBased/getAllRoles', RBACController.getAllRoles)
router.post('/RoleBased/getAllMenus', RBACController.getAllMenus)

//Role Routes
router.post('/Role/createRole', RoleController.createRole)
router.post('/Role/deleteRole', RoleController.deleteRole)
router.post('/Role/updateRole', RoleController.updateRole)
router.post('/Role/getAllRoles', RoleController.getAllRoles)

//Lead Routes
router.post('/Lead/createLead', LeadController.createLead)
router.post('/Lead/deleteLead', LeadController.deleteLead)
router.post('/Lead/updateLead', LeadController.updateLead)
router.post('/Lead/getAllLeads', LeadController.getAllLeads)
router.post('/importLeadsExcel', upload.single('file'), LeadController.importLeads);

//LeadStatus Routes
router.post('/LeadStatus/createLeadStatus', LeadStatusController.createLeadStatus)
router.post('/LeadStatus/deleteLeadStatus', LeadStatusController.deleteLeadStatus)
router.post('/LeadStatus/updateLeadStatus', LeadStatusController.updateLeadStatus)
router.post('/LeadStatus/getAllLeadStatus', LeadStatusController.getAllLeadStatus)

module.exports = router;