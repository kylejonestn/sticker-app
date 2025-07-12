// Import required packages
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

// Create an Express application
const app = express();

// Use CORS to allow frontend to connect
app.use(cors());
// Use express.json() to parse JSON bodies for POST requests
app.use(express.json());
// Use express.urlencoded() to parse form data
app.use(express.urlencoded({ extended: true }));


// Create a new PostgreSQL connection pool
// The 'pg' library will automatically use the POSTGRES_URL environment variable if available
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- Main API Endpoint ---
// All actions will be handled through this single endpoint
app.post('/api', async (req, res) => {
  // Determine the action from the request body (form data)
  const { action, employee_id } = req.body;

  if (action === 'getUser') {
    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'Employee ID not provided.' });
    }

    try {
      // --- Get User from Employees table ---
      const userQuery = 'SELECT * FROM Employees WHERE employee_id = $1';
      const userResult = await pool.query(userQuery, [employee_id]);

      if (userResult.rows.length === 0) {
        return res.json({ success: false, message: 'User not found.' });
      }
      
      const user = userResult.rows[0];
      const userId = user.id;

      // --- Get Stickers for that user from Collection and Stickers tables ---
      const stickersQuery = `
        SELECT s.id, s.event_name, s.event_date, s.description, s.image_data 
        FROM Stickers s 
        JOIN Collection c ON s.id = c.sticker_id 
        WHERE c.employee_record_id = $1 
        ORDER BY c.date_earned DESC
      `;
      const stickersResult = await pool.query(stickersQuery, [userId]);
      
      user.stickers = stickersResult.rows;

      return res.status(200).json({ success: true, user: user });

    } catch (err) {
      console.error('Error executing getUser action:', err);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }

  // --- Placeholder for other actions ---
  // TODO: Add 'addSticker', 'registerAndAddSticker', etc. in the next phases
  
  // If no action matches, return an error
  return res.status(400).json({ success: false, message: 'Unknown or missing action.' });
});


// --- Test Endpoint (keep for debugging) ---
app.get('/api/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
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

// Export the app for Vercel
module.exports = app;
