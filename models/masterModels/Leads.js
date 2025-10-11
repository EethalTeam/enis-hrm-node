const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema(
  {
    leadCode: {
      type: String,
      trim: true
    },
    leadName: {
      type: String,
      trim: true
    },
    contactPerson: {
      type: String,
      trim: true
    },
    contactEmail: {
      type: String,
      trim: true
    },
    contactPhone: {
      type: String,
      trim: true
    },
    companyName: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    source: {
      type: String, // e.g., Referral, Website, Cold Call
      trim: true
    },
    statusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeadStatus', 
      required: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee' // Salesperson or account manager
    },
    estimatedValue: {
      type: Number
    },
    lastContact: {
      type: Date
    },
    nextFollowUp: {
      type: Date
    },
    notes: [{
      type: String,
      trim: true
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const Lead = mongoose.model('Lead', LeadSchema);
module.exports = Lead;
