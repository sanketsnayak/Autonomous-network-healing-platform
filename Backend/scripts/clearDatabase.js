/**
 * Database Clearing Script for Autonomous Network Healing Platform
 * This script will remove all data from all collections
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import all models to ensure collections are recognized
const Device = require('../src/models/Device');
const Alert = require('../src/models/Alert');
const Incident = require('../src/models/Incident');
const Action = require('../src/models/Action');
const Policy = require('../src/models/Policy');
const Topology = require('../src/models/Topology');

const clearDatabase = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/network_management';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully');

    // Get all collection names
    const collections = await mongoose.connection.db.collections();
    console.log(`Found ${collections.length} collections`);

    // Clear each collection
    for (const collection of collections) {
      const count = await collection.countDocuments();
      if (count > 0) {
        await collection.deleteMany({});
        console.log(`✅ Cleared collection '${collection.collectionName}' (${count} documents removed)`);
      } else {
        console.log(`⚪ Collection '${collection.collectionName}' was already empty`);
      }
    }

    console.log('\n🎉 Database cleared successfully!');
    console.log('All collections have been emptied.');

  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run the script
console.log('🗑️  Starting database clearing process...');
console.log('This will remove ALL data from the database!');
clearDatabase();
