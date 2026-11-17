const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error("MONGODB_URI is missing from .env");
    }

    const connection = await mongoose.connect(mongoURI);

    console.log("================================");
    console.log("MongoDB Connected Successfully!");
    console.log("Database:", connection.connection.name);
    console.log("================================");

  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;