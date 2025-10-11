// controllers/leadController.js
const Lead = require('../../models/masterModels/Leads');
const LeadStatus = require('../../models/masterModels/LeadStatus');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const { fetch } = require("undici");
const xml2js = require("xml2js");

// Helper function to get a formatted timestamp for notes
const getFormattedTimestamp = () => {
    return new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
    });
};

// Create a new Lead
exports.createLead = async (req, res) => {
  try {
    const { notes: newNote, statusId, ...leadData } = req.body;
    
    const lead = new Lead({
        ...leadData,
        statusId: new mongoose.Types.ObjectId(statusId)
    });

    // If an initial note is provided, format it and add it to the notes array
    if (newNote && newNote.trim() !== '') {
        // Fetch the status name to include in the note
        const statusDoc = await LeadStatus.findById(statusId);
        const statusName = statusDoc ? statusDoc.statusName : 'Unknown Status';
        const timestamp = getFormattedTimestamp();

        const formattedNote = `${newNote} - [Status: ${statusName}] - [${timestamp}]`;
        lead.notes.push(formattedNote);
    }
    
    await lead.save();
    res.status(201).json({ message: 'Lead created successfully', lead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create lead', error: error.message });
  }
};

// Get all Leads (No changes needed here)
exports.getAllLeads = async (req, res) => {
    // ... This function works as is.
    try {
        const { _id, role } = req.body;
        const filter = {};
        if (role !== 'Super Admin' && role !== 'Admin') {
            filter.assignedTo = _id;
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

// Get a single Lead by ID (Minor fix for 'id' variable)
exports.getLeadById = async (req, res) => {
    try {
        const { _id } = req.body;
        if (!mongoose.Types.ObjectId.isValid(_id)) {
            return res.status(400).json({ message: 'Invalid Lead ID' });
        }
        // FIX: was using 'id' instead of '_id'
        const lead = await Lead.findById(_id)
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

// Update a Lead by ID (This is the main change)
exports.updateLead = async (req, res) => {
  try {
    const { _id, notes: newNote, ...updateData } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: 'Invalid Lead ID' });
    }

    const leadToUpdate = await Lead.findById(_id);
    if (!leadToUpdate) {
        return res.status(404).json({ message: 'Lead not found' });
    }

    const updatePayload = { $set: updateData };

    // If a new note is being added, format it and push it to the array
    if (newNote && newNote.trim() !== '') {
        // Determine the status to use for the note
        // Use the new statusId if it's being updated, otherwise use the existing one
        const statusToQuery = updateData.statusId || leadToUpdate.statusId;
        const statusDoc = await LeadStatus.findById(statusToQuery);
        const statusName = statusDoc ? statusDoc.statusName : 'Unknown';
        const timestamp = getFormattedTimestamp();
        
        const formattedNote = `${newNote} - [Status: ${statusName}] - [${timestamp}]`;
        
        // Use $push to add the new note to the existing array
        updatePayload.$push = { notes: formattedNote };
    }

    const updatedLead = await Lead.findByIdAndUpdate(_id, updatePayload, { new: true })
      .populate('statusId', 'statusName')
      .populate('assignedTo', 'name email');

    res.status(200).json({ message: 'Lead updated successfully', lead: updatedLead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update lead', error: error.message });
  }
};

// Delete a Lead (Minor fix for 'id' variable)
exports.deleteLead = async (req, res) => {
    try {
        const { _id } = req.body;
        // FIX: was using 'id' instead of '_id'
        if (!mongoose.Types.ObjectId.isValid(_id)) {
            return res.status(400).json({ message: 'Invalid Lead ID' });
        }

        const lead = await Lead.findById(_id);
        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        
        lead.isActive = false;
        await lead.save();
        res.status(200).json({ message: 'Lead deleted successfully (soft delete)', lead });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to delete lead', error: error.message });
    }
};

// Import Leads (Updated to handle notes array)
exports.importLeads = async (req, res) => {
  try {
    // ... (file reading logic is the same)
    if (!req.file) { /* ... */ }
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    if (rows.length === 0) { /* ... */ }

    // ... (row validation logic is the same)
    const leadsToInsert = [];
    const invalidRows = [];
    rows.forEach((row, index) => {
        // ...
        leadsToInsert.push({
            // ... (other fields are the same)
            // FIX: If notes exist, put it in an array. Otherwise, create an empty array.
            notes: row.notes ? [row.notes] : [], 
            isActive: true
        });
    });

    if (invalidRows.length) { /* ... */ }
    
    const insertedLeads = await Lead.insertMany(leadsToInsert);
    res.status(201).json({ message: `${insertedLeads.length} leads imported successfully`, leads: insertedLeads });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to import leads", error: error.message });
  }
};

exports.getLeadsFromIndiaMart = async (req, res) =>{
const MOBILE = 8754573741;   // the mobile/email used in IndiaMART
const API_KEY = 'mRy2G7Bl7HbCSvep5nGN7liMoVTElTI=' 
 try {
    const url = `https://mapi.indiamart.com/wservce/enquiry/listing/${MOBILE}/${API_KEY}/`;

   const response = await fetch(url);
    const xmlText = await response.text();   // get raw XML
    
    // parse XML → JSON
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlText);

    res.json(result);  // now you’ll see proper JSON
  } catch (error) {
    console.error("❌ Error fetching IndiaMART leads:", error);
    res.status(500).json({ error: "Failed to fetch IndiaMART leads" });
  }
}
