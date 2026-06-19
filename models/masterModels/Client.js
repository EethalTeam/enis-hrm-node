const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    ClientCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    UserName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    Password: {
      type: String,
      trim: true,
    },

    RoleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoleBased",
      required: true,
    },

    // Reference to Projects
    projects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Client", clientSchema);
