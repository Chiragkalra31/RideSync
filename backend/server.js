require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const connectDB = require("./config/db");
const Booking = require("./models/booking");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5050;
const API_KEY = process.env.RAILRADAR_API_KEY;

const POLLING_INTERVAL_MS =
  Number(process.env.RAILRADAR_POLL_INTERVAL_MS) || 1800000;

// =====================================
// VEHICLE FARES
// =====================================

const fares = {
  Hatchback: 249,
  Sedan: 349,
  SUV: 499
};

// =====================================
// DRIVER FLEET
// =====================================

const drivers = [
  { id: "D001", name: "Aman Sharma", vehicle: "Hyundai Aura", vehicleType: "Sedan", number: "CH 01 AB 4821", rating: 4.8, available: true },
  { id: "D002", name: "Rahul Verma", vehicle: "Maruti Dzire", vehicleType: "Sedan", number: "PB 10 CD 7291", rating: 4.7, available: true },
  { id: "D003", name: "Arjun Singh", vehicle: "Maruti Ertiga", vehicleType: "SUV", number: "CH 01 EF 5632", rating: 4.9, available: true },
  { id: "D004", name: "Karan Mehta", vehicle: "Maruti Swift", vehicleType: "Hatchback", number: "CH 01 GH 9012", rating: 4.6, available: true },
  { id: "D005", name: "Vikram Singh", vehicle: "Honda City", vehicleType: "Sedan", number: "CH 01 JK 4521", rating: 4.9, available: true },
  { id: "D006", name: "Mohit Kumar", vehicle: "Hyundai Verna", vehicleType: "Sedan", number: "PB 10 LM 6723", rating: 4.8, available: true },
  { id: "D007", name: "Rohit Malhotra", vehicle: "Maruti Brezza", vehicleType: "SUV", number: "CH 01 MN 7821", rating: 4.7, available: true },
  { id: "D008", name: "Sahil Kapoor", vehicle: "Tata Tiago", vehicleType: "Hatchback", number: "CH 01 PQ 8921", rating: 4.6, available: true },
  { id: "D009", name: "Nitin Sharma", vehicle: "Honda Amaze", vehicleType: "Sedan", number: "CH 01 RS 3456", rating: 4.8, available: true },
  { id: "D010", name: "Deepak Verma", vehicle: "Toyota Innova", vehicleType: "SUV", number: "PB 10 TU 2345", rating: 4.9, available: true },
  { id: "D011", name: "Harsh Gupta", vehicle: "Maruti Baleno", vehicleType: "Hatchback", number: "CH 01 VW 6789", rating: 4.7, available: true },
  { id: "D012", name: "Manish Arora", vehicle: "Hyundai Creta", vehicleType: "SUV", number: "CH 01 XY 1234", rating: 4.8, available: true },
  { id: "D013", name: "Rajat Khanna", vehicle: "Honda City", vehicleType: "Sedan", number: "CH 01 ZA 5678", rating: 4.7, available: true },
  { id: "D014", name: "Gaurav Saini", vehicle: "Tata Punch", vehicleType: "SUV", number: "PB 10 BC 4567", rating: 4.8, available: true },
  { id: "D015", name: "Akash Malhotra", vehicle: "Maruti Swift", vehicleType: "Hatchback", number: "CH 01 DE 7890", rating: 4.6, available: true }
];

// =====================================
// HELPER FUNCTIONS
// =====================================

function addMinutes(dateValue, minutes) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setMinutes(date.getMinutes() + minutes);

  return date;
}

function calculateDispatchTime(arrivalTime) {
  return addMinutes(arrivalTime, -20);
}

function getTodayIST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function getArrivalDate(value, travelDate) {
  if (!value) value = "18:35";

  if (
    typeof value === "string" &&
    /^\d{2}:\d{2}$/.test(value)
  ) {
    return new Date(`${travelDate}T${value}:00+05:30`);
  }

  return new Date(value);
}

function normalizeVehicleType(body) {
  let vehicleType =
    body.vehicleType ||
    body.selectedVehicle ||
    body.vehicle?.vehicleType ||
    body.vehicle?.name ||
    body.vehicle?.type ||
    body.vehicle ||
    "Sedan";

  if (typeof vehicleType === "object") {
    vehicleType =
      vehicleType.vehicleType ||
      vehicleType.name ||
      vehicleType.type ||
      "Sedan";
  }

  vehicleType = String(vehicleType);

  if (/hatch/i.test(vehicleType)) return "Hatchback";

  if (/suv|ertiga|creta|innova|brezza|punch/i.test(vehicleType)) {
    return "SUV";
  }

  if (/sedan|dzire|aura|city|verna|amaze/i.test(vehicleType)) {
    return "Sedan";
  }

  return vehicleType;
}

function normalizeBookingData(body) {
  const arrivalStation =
    body.arrivalStation || body.to || body.station || "";

  const travelDate =
    body.travelDate || body.date || getTodayIST();

  const arrivalValue =
    body.arrivalTime ||
    body.scheduledArrivalTime ||
    body.estimatedArrivalTime ||
    body.journeyArrival ||
    body.arrival ||
    "18:35";

  return {
    passenger:
      body.passenger ||
      body.passengerName ||
      body.name ||
      "Guest Passenger",

    trainNumber: String(
      body.trainNumber || body.trainNo || ""
    ).trim(),

    trainName: body.trainName || body.nameOfTrain || "",

    travelDate,

    arrivalStation,

    destinationStationCode:
      body.destinationStationCode ||
      body.stationCode ||
      (arrivalStation.match(/\(([A-Z]{2,5})\)/)?.[1] || ""),

    destination:
      body.destination ||
      body.finalDestination ||
      body.destinationName ||
      body.dropLocation ||
      body.drop ||
      "",

    arrivalTime: getArrivalDate(arrivalValue, travelDate),

    vehicleType: normalizeVehicleType(body)
  };
}

// =====================================
// RAILRADAR API
// =====================================

function readableError(error) {
  if (typeof error === "string") return error;

  if (error?.message && typeof error.message === "string") {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown RailRadar error";
  }
}

async function fetchLiveTrainStatus(trainNumber, travelDate) {
  if (!API_KEY) {
    throw new Error("RailRadar API key missing in .env");
  }

  const url = new URL(
    `https://api.railradar.in/v1/trains/${encodeURIComponent(trainNumber)}/live`
  );

  if (travelDate) {
    url.searchParams.set("date", travelDate);
  }

  url.searchParams.set("authoritative", "true");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(20000)
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.message ||
      result.error ||
      `RailRadar HTTP ${response.status}`
    );
  }

  if (result.success === false) {
    throw new Error(
      readableError(result.message || result.error)
    );
  }

  return result.data || result;
}

// =====================================
// AUTOMATIC DELAY DETECTION
// =====================================

function isTrainLive(train) {
  return (
    train.isLive === true &&
    train.status !== "not-started" &&
    train.trackingMode !== "none"
  );
}

function getTrainDelay(train, destinationCode) {
  const route = Array.isArray(train.route)
    ? train.route
    : [];

  if (destinationCode) {
    const stop = route.find(
      item =>
        String(item.stationCode || "").toUpperCase() ===
        String(destinationCode).toUpperCase()
    );

    if (stop) {
      const values = [
        stop.delayArrival,
        stop.arrivalDelayMinutes
      ];

      for (const value of values) {
        if (
          value !== null &&
          value !== undefined &&
          value !== "" &&
          Number.isFinite(Number(value))
        ) {
          return {
            minutes: Math.max(0, Number(value)),
            source: "Destination route"
          };
        }
      }
    }
  }

  if (
    train.delayMinutes !== null &&
    train.delayMinutes !== undefined &&
    Number.isFinite(Number(train.delayMinutes))
  ) {
    return {
      minutes: Math.max(0, Number(train.delayMinutes)),
      source: "Train live status"
    };
  }

  return null;
}

function updateBookingData(booking, train) {
  booking.lastTrainUpdate = new Date();

  if (!isTrainLive(train)) {
    booking.trainTrackingStatus = "WAITING_FOR_LIVE_TRACKING";

    booking.trainTrackingMessage =
      "Waiting for live train tracking.";

    return;
  }

  const delayInfo = getTrainDelay(
    train,
    booking.destinationStationCode
  );

  if (!delayInfo) {
    booking.trainTrackingStatus = "LIVE_DELAY_UNAVAILABLE";

    booking.trainTrackingMessage =
      "Live tracking available, but delay information unavailable.";

    return;
  }

  const updatedArrival = addMinutes(
    booking.scheduledArrivalTime,
    delayInfo.minutes
  );

  if (!updatedArrival) {
    booking.trainTrackingStatus = "ETA_ERROR";
    return;
  }

  booking.lastDetectedDelayMinutes = delayInfo.minutes;

  booking.arrivalTime = updatedArrival;

  booking.dispatchTime = calculateDispatchTime(
    updatedArrival
  );

  booking.delaySource = delayInfo.source;

  booking.trainTrackingStatus = "LIVE";

  booking.trainTrackingMessage =
    "Train delay automatically detected through RailRadar.";

  booking.trainStatus = train.status || "unknown";
}

// =====================================
// DRIVER ALLOCATION
// =====================================

function assignDriver(vehicleType) {
  const driver = drivers.find(
    item =>
      item.vehicleType === vehicleType &&
      item.available === true
  );

  if (!driver) return null;

  driver.available = false;

  return { ...driver };
}

function releaseDriver(driverId) {
  const driver = drivers.find(
    item => item.id === driverId
  );

  if (driver) {
    driver.available = true;
  }
}

// =====================================
// RESTORE DRIVER AVAILABILITY
// AFTER SERVER RESTART
// =====================================

async function restoreDriverAvailability() {
  drivers.forEach(driver => {
    driver.available = true;
  });

  const activeBookings = await Booking.find({
    status: {
      $nin: ["COMPLETED", "CANCELLED"]
    }
  }).select("driverId");

  for (const booking of activeBookings) {
    const driver = drivers.find(
      item => item.id === booking.driverId
    );

    if (driver) {
      driver.available = false;
    }
  }
}

// =====================================
// HEALTH CHECK
// =====================================

app.get("/", async (req, res) => {
  try {
    res.json({
      success: true,
      message: "RideSync Backend Running",
      storage: "MongoDB Atlas",
      database: require("mongoose").connection.name,
      railRadar: API_KEY ? "Configured" : "Missing",
      totalDrivers: drivers.length,
      availableDrivers: drivers.filter(d => d.available).length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: readableError(error)
    });
  }
});

// =====================================
// TRAIN SEARCH
// =====================================

app.get("/api/train/:trainNumber", async (req, res) => {
  try {
    const train = await fetchLiveTrainStatus(
      req.params.trainNumber,
      req.query.date
    );

    res.json({
      success: true,
      data: train
    });

  } catch (error) {
    console.error("Train search error:", readableError(error));

    res.status(502).json({
      success: false,
      message: readableError(error)
    });
  }
});

// =====================================
// DRIVER FLEET
// =====================================

app.get("/api/drivers", (req, res) => {
  res.json({
    success: true,
    totalDrivers: drivers.length,
    availableDrivers: drivers.filter(d => d.available).length,
    drivers
  });
});

// =====================================
// CREATE BOOKING - MONGODB
// =====================================

app.post("/api/bookings", async (req, res) => {
  let assignedDriver = null;

  try {
    const data = normalizeBookingData(req.body);

    const {
      passenger,
      trainNumber,
      trainName,
      travelDate,
      arrivalStation,
      destinationStationCode,
      destination,
      arrivalTime,
      vehicleType
    } = data;

    if (!trainNumber) {
      return res.status(400).json({
        success: false,
        message: "Please enter a train number."
      });
    }

    if (!destination) {
      return res.status(400).json({
        success: false,
        message: "Please enter your final destination."
      });
    }

    if (!fares[vehicleType]) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid vehicle."
      });
    }

    if (Number.isNaN(arrivalTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid arrival time."
      });
    }

    assignedDriver = assignDriver(vehicleType);

    if (!assignedDriver) {
      return res.status(409).json({
        success: false,
        message: `No available ${vehicleType} driver.`
      });
    }

    const booking = new Booking({
      bookingId:
        "RS-" +
        crypto.randomBytes(4).toString("hex").toUpperCase(),

      passenger,
      trainNumber,
      trainName,
      travelDate,

      arrivalStation,
      destinationStationCode,
      destination,

      scheduledArrivalTime: arrivalTime,
      arrivalTime,

      dispatchTime: calculateDispatchTime(arrivalTime),

      lastDetectedDelayMinutes: 0,
      lastTrainUpdate: null,

      trainTrackingStatus: "CHECKING",
      trainTrackingMessage: "Checking RailRadar.",

      status: "DRIVER_ASSIGNED",

      driverId: assignedDriver.id,
      driver: assignedDriver,

      vehicleType,
      fare: fares[vehicleType],

      bookingMode: "DEMO_SIMULATION"
    });

    // Initial RailRadar check
    try {
      const train = await fetchLiveTrainStatus(
        trainNumber,
        travelDate
      );

      updateBookingData(booking, train);

    } catch (error) {
      console.error(
        "Initial RailRadar error:",
        readableError(error)
      );

      booking.trainTrackingStatus = "API_ERROR";
      booking.trainTrackingMessage = readableError(error);
    }

    // Save directly to MongoDB
    await booking.save();

    console.log("MongoDB booking created:", booking.bookingId);

    res.status(201).json({
      success: true,
      message: "RideSync booking created successfully.",
      booking
    });

  } catch (error) {
    if (assignedDriver) {
      releaseDriver(assignedDriver.id);
    }

    console.error("Booking creation error:", readableError(error));

    res.status(500).json({
      success: false,
      message: readableError(error)
    });
  }
});

// =====================================
// GET ALL BOOKINGS FROM MONGODB
// =====================================

app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({
      createdAt: -1
    });

    res.json({
      success: true,
      bookings
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: readableError(error)
    });
  }
});

// =====================================
// GET SINGLE BOOKING
// =====================================

app.get("/api/bookings/:bookingId", async (req, res) => {
  try {
    const booking = await Booking.findOne({
      bookingId: req.params.bookingId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    res.json({
      success: true,
      booking
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: readableError(error)
    });
  }
});

// =====================================
// UPDATE BOOKING STATUS
// =====================================

app.patch("/api/bookings/:bookingId/status", async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "DRIVER_ASSIGNED",
      "ACCEPTED",
      "ON_THE_WAY",
      "ARRIVED",
      "PICKED_UP",
      "COMPLETED",
      "CANCELLED"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status."
      });
    }

    const booking = await Booking.findOne({
      bookingId: req.params.bookingId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    const previousStatus = booking.status;

    booking.status = status;

    await booking.save();

    if (
      ["COMPLETED", "CANCELLED"].includes(status) &&
      !["COMPLETED", "CANCELLED"].includes(previousStatus)
    ) {
      releaseDriver(booking.driverId);
    }

    res.json({
      success: true,
      booking
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: readableError(error)
    });
  }
});

// =====================================
// AUTOMATIC RAILRADAR MONITORING
// =====================================

let monitorRunning = false;

async function monitorActiveBookings() {
  if (monitorRunning) return;

  monitorRunning = true;

  try {
    const activeBookings = await Booking.find({
      status: {
        $nin: ["COMPLETED", "CANCELLED"]
      }
    });

    const groups = new Map();

    for (const booking of activeBookings) {
      const key =
        `${booking.trainNumber}_${booking.travelDate}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(booking);
    }

    for (const group of groups.values()) {
      const first = group[0];

      try {
        console.log(
          `Checking RailRadar: Train ${first.trainNumber}`
        );

        const train = await fetchLiveTrainStatus(
          first.trainNumber,
          first.travelDate
        );

        for (const booking of group) {
          updateBookingData(booking, train);
          await booking.save();
        }

        console.log(
          `Updated ${group.length} booking(s) for train ${first.trainNumber}`
        );

      } catch (error) {
        console.error(
          "RailRadar monitoring error:",
          readableError(error)
        );

        for (const booking of group) {
          booking.trainTrackingStatus = "API_ERROR";
          booking.trainTrackingMessage = readableError(error);
          await booking.save();
        }
      }
    }

  } catch (error) {
    console.error(
      "Monitoring error:",
      readableError(error)
    );

  } finally {
    monitorRunning = false;
  }
}

// =====================================
// START APPLICATION AFTER DB CONNECTS
// =====================================

async function startServer() {
  try {
    await connectDB();

    await restoreDriverAvailability();

    app.listen(PORT, () => {
      console.log("--------------------------------");
      console.log("       RIDESYNC BACKEND");
      console.log("--------------------------------");

      console.log(`Server: http://localhost:${PORT}`);
      console.log("Storage: MongoDB Atlas");

      console.log(
        "RailRadar:",
        API_KEY ? "Configured" : "Missing"
      );

      console.log("Total demo drivers:", drivers.length);

      console.log(
        "Available drivers:",
        drivers.filter(d => d.available).length
      );

      console.log("Automatic monitoring: Active");

      console.log(
        "Polling interval:",
        POLLING_INTERVAL_MS / 60000,
        "minutes"
      );

      console.log("--------------------------------");

      monitorActiveBookings();

      setInterval(
        monitorActiveBookings,
        POLLING_INTERVAL_MS
      );
    });

  } catch (error) {
    console.error("Server startup failed:", readableError(error));
    process.exit(1);
  }
}

startServer();