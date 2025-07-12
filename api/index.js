// Import required packages
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

// Create an Express application
const app = express();

// Use CORS to allow frontend to connect
app.use(cors());
// Use express.json() to parse JSON bodies
app.use(express.json());

// Create a new PostgreSQL connection pool
// The 'pg' library will automatically use the POSTGRES_URL environment variable
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- Test Endpoint ---
// This endpoint is just to verify the database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()'); // Query for the current time
    res.status(200).json({
      message: 'Database connection successful!',
      time: result.rows[0].now,
    });
    client.release();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to connect to the database.' });
  }
});


// TODO: All other API routes will be added here in the next phases.


// Export the app for Vercel
module.exports = app;
