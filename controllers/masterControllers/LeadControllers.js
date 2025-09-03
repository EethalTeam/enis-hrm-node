// controllers/leadController.js
const Lead = require('../../models/masterModels/Leads');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

// Create a new Lead
exports.createLead = async (req, res) => {
  try {
    const {assignedTo,
companyName,
contactEmail,
contactPerson,
contactPhone,
employee,
estimatedValue,
lastContact,
nextFollowUp,
source,
status,
statusId} = req.body
    const lead = new Lead({assignedTo:new mongoose.Types.ObjectId(assignedTo),
companyName,
contactEmail,
contactPerson,
contactPhone,
estimatedValue,
lastContact,
nextFollowUp,
source,
statusId:new mongoose.Types.ObjectId(statusId)});
    await lead.save();
    res.status(201).json({ message: 'Lead created successfully', lead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create lead', error: error.message });
  }
};

// Get all Leads (with optional filtering by isActive)
exports.getAllLeads = async (req, res) => {
  try {
     const {_id,role}= req.body;
    const filter = {};
     if(role !== 'Super Admin' && role !== 'Admin'){
      filter.assignedTo = _id
    }
    const leads = await Lead.find(filter)
      .populate('statusId', 'statusName')
      .populate('assignedTo', 'name');

    res.status(200).json({ leads });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch leads', error: error.message });
  }
};

// Get a single Lead by ID
exports.getLeadById = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: 'Invalid Lead ID' });
    }

    const lead = await Lead.findById(id)
      .populate('statusId', 'statusName')
      .populate('assignedTo', 'name email');

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.status(200).json({ lead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch lead', error: error.message });
  }
};

// Update a Lead by ID
exports.updateLead = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: 'Invalid Lead ID' });
    }

    const updatedLead = await Lead.findByIdAndUpdate(_id, req.body, { new: true })
      .populate('statusId', 'statusName')
      .populate('assignedTo', 'name email');

    if (!updatedLead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.status(200).json({ message: 'Lead updated successfully', lead: updatedLead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update lead', error: error.message });
  }
};

// Delete a Lead (soft delete by default)
exports.deleteLead = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Lead ID' });
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Soft delete
    lead.isActive = false;
    await lead.save();

    res.status(200).json({ message: 'Lead deleted successfully (soft delete)', lead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete lead', error: error.message });
  }
};

exports.importLeads = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file is required" });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ message: "Excel file is empty" });
    }

   const leadsToInsert = [];
const invalidRows = [];

rows.forEach((row, index) => {
  const companyName = row.companyName || row.CompanyName || "";
  const contactPerson = row.contactPerson || row.ContactPerson || "";
  const contactPhone = row.contactPhone || row.ContactPhone || "";

  if (!companyName || !contactPerson || !contactPhone) {
    invalidRows.push({ row: index + 1, message: "Company Name, Contact Person, and Contact Phone are required" });
    return; 
  }

  leadsToInsert.push({
    leadCode: row.leadCode || row.LeadCode || "",
    leadName: row.leadName || row.LeadName || "",
    contactPerson,
    contactEmail: row.contactEmail || row.ContactEmail || "",
    contactPhone,
    companyName,
    source: row.source || row.Source || "",
    statusId: new mongoose.Types.ObjectId(row.statusId),
    assignedTo: row.assignedTo ? new mongoose.Types.ObjectId(row.assignedTo) : null,
    estimatedValue: row.estimatedValue || 0,
    followUpDate: row.followUpDate ? new Date(row.followUpDate) : null,
    notes: row.notes || "",
    isActive: true
  });
});

// Optionally, return invalid rows info
if (invalidRows.length) {
  return res.status(400).json({ message: "Some rows are invalid", invalidRows });
}

    const insertedLeads = await Lead.insertMany(leadsToInsert);

    res.status(201).json({
      message: `${insertedLeads.length} leads imported successfully`,
      leads: insertedLeads
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to import leads", error: error.message });
  }
};
