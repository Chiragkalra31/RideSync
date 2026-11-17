const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
  {
    driverId: {
      type: String,
      required: true,
      unique: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      default: ""
    },

    email: {
      type: String,
      default: ""
    },

    vehicle: {
      type: String,
      required: true
    },

    vehicleType: {
      type: String,
      enum: ["Hatchback", "Sedan", "SUV"],
      required: true
    },

    registrationNumber: {
      type: String,
      required: true,
      unique: true
    },

    rating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5
    },

    available: {
      type: Boolean,
      default: true
    },

    currentBookingId: {
      type: String,
      default: null
    },

    status: {
      type: String,
      enum: ["AVAILABLE", "ASSIGNED", "ON_DUTY", "INACTIVE"],
      default: "AVAILABLE"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Driver", driverSchema);