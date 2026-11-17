const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    passenger: {
      type: String,
      required: true,
      trim: true
    },

    trainNumber: {
      type: String,
      required: true
    },

    trainName: {
      type: String,
      default: ""
    },

    travelDate: {
      type: String,
      required: true
    },

    arrivalStation: {
      type: String,
      default: ""
    },

    destinationStationCode: {
      type: String,
      default: ""
    },

    destination: {
      type: String,
      required: true
    },

    // Original scheduled arrival time
    scheduledArrivalTime: {
      type: Date,
      required: true
    },

    // Automatically updated arrival time
    arrivalTime: {
      type: Date
    },

    // Calculated driver dispatch time
    dispatchTime: {
      type: Date
    },

    // Automatically detected train delay
    lastDetectedDelayMinutes: {
      type: Number,
      default: 0
    },

    lastTrainUpdate: {
      type: Date,
      default: null
    },

    trainTrackingStatus: {
      type: String,
      enum: [
        "CHECKING",
        "LIVE",
        "WAITING_FOR_LIVE_TRACKING",
        "LIVE_DELAY_UNAVAILABLE",
        "API_ERROR",
        "ETA_ERROR"
      ],
      default: "CHECKING"
    },

    trainTrackingMessage: {
      type: String,
      default: ""
    },

    trainStatus: {
      type: String,
      default: "unknown"
    },

    delaySource: {
      type: String,
      default: ""
    },

    // Driver information
    driverId: {
      type: String,
      default: null
    },

    driver: {
      id: String,
      name: String,
      vehicle: String,
      vehicleType: String,
      number: String,
      rating: Number
    },

    vehicleType: {
      type: String,
      enum: ["Hatchback", "Sedan", "SUV"],
      required: true
    },

    fare: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      enum: [
        "DRIVER_ASSIGNED",
        "ACCEPTED",
        "ON_THE_WAY",
        "ARRIVED",
        "PICKED_UP",
        "COMPLETED",
        "CANCELLED"
      ],
      default: "DRIVER_ASSIGNED"
    },

    bookingMode: {
      type: String,
      default: "DEMO_SIMULATION"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Booking", bookingSchema);