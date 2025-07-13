// Import required packages
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

// Create an Express application
const app = express();

// Use CORS to allow frontend to connect
app.use(cors());
// Increase the JSON body limit to allow for Base64 image data
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));


// Create a new PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- Main API Endpoint ---
// All actions are handled through this single endpoint
app.all('/api', async (req, res) => {
  // Combine query params (for GET) and body (for POST)
  const params = { ...req.query, ...req.body };
  const { action } = params;

  console.log('Received action:', action);

  // ===============================================
  //  USER-FACING ACTIONS
  // ===============================================
  if (action === 'getUser') {
    const { employee_id } = params;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'Employee ID not provided.' });
    }
    try {
      // UPDATED: Use LOWER() for case-insensitive comparison
      const userQuery = 'SELECT * FROM Employees WHERE LOWER(employee_id) = LOWER($1)';
      const userResult = await pool.query(userQuery, [employee_id]);

      if (userResult.rows.length === 0) {
        return res.json({ success: false, message: 'User not found.' });
      }
      
      const user = userResult.rows[0];
      const stickersQuery = `
        SELECT s.id, s.event_name, s.event_date, s.description, s.image_data 
        FROM Stickers s 
        JOIN Collection c ON s.id = c.sticker_id 
        WHERE c.employee_record_id = $1 ORDER BY c.date_earned DESC`;
      const stickersResult = await pool.query(stickersQuery, [user.id]);
      user.stickers = stickersResult.rows;
      return res.status(200).json({ success: true, user: user });
    } catch (err) {
      console.error('Error in getUser:', err);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }

  if (action === 'getStickerInfo') {
    const { sticker_id, employee_id } = params;
    if (!sticker_id) {
      return res.status(400).json({ success: false, message: 'Sticker ID not provided.' });
    }
    try {
      const stickerQuery = 'SELECT * FROM Stickers WHERE id = $1';
      const stickerResult = await pool.query(stickerQuery, [sticker_id]);

      if (stickerResult.rows.length === 0) {
        return res.json({ success: false, message: 'Sticker not found.' });
      }
      const response = { success: true, sticker: stickerResult.rows[0] };

      if (employee_id) {
        const userQuery = 'SELECT id FROM Employees WHERE LOWER(employee_id) = LOWER($1)';
        const userResult = await pool.query(userQuery, [employee_id]);
        if (userResult.rows.length > 0) {
          const feedbackQuery = 'SELECT comment FROM Feedback WHERE sticker_id = $1 AND employee_id = $2';
          const feedbackResult = await pool.query(feedbackQuery, [sticker_id, userResult.rows[0].id]);
          if (feedbackResult.rows.length > 0) {
            response.user_feedback = feedbackResult.rows[0].comment;
          }
        }
      }
      return res.status(200).json(response);
    } catch (err) {
      console.error('Error in getStickerInfo:', err);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
  
  if (action === 'addSticker') {
    const { employee_id, sticker_id } = params;
    if (!employee_id || !sticker_id) {
      return res.status(400).json({ success: false, message: 'Required data not provided.' });
    }
    try {
      const userResult = await pool.query('SELECT id FROM Employees WHERE LOWER(employee_id) = LOWER($1)', [employee_id]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }
      const userId = userResult.rows[0].id;

      const checkQuery = 'SELECT id FROM Collection WHERE employee_record_id = $1 AND sticker_id = $2';
      const checkResult = await pool.query(checkQuery, [userId, sticker_id]);
      if (checkResult.rows.length === 0) {
        const insertQuery = 'INSERT INTO Collection (employee_record_id, sticker_id) VALUES ($1, $2)';
        await pool.query(insertQuery, [userId, sticker_id]);
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error in addSticker:', err);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }

  if (action === 'registerAndAddSticker') {
    const { employee_id, full_name, sticker_id } = params;
    if (!employee_id || !full_name || !sticker_id) {
      return res.status(400).json({ success: false, message: 'Missing data for registration.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const registerQuery = 'INSERT INTO Employees (employee_id, full_name) VALUES ($1, $2) RETURNING id';
      const registerResult = await client.query(registerQuery, [employee_id.toLowerCase(), full_name]);
      const newUserId = registerResult.rows[0].id;
      
      const addStickerQuery = 'INSERT INTO Collection (employee_record_id, sticker_id) VALUES ($1, $2)';
      await client.query(addStickerQuery, [newUserId, sticker_id]);
      
      await client.query('COMMIT');
      return res.status(201).json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error in registerAndAddSticker:', err);
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'This Employee ID might already be taken.' });
      }
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    } finally {
      client.release();
    }
  }

  if (action === 'submitFeedback') {
    const { employee_id, sticker_id, comment } = params;
    if (!employee_id || !sticker_id) {
        return res.status(400).json({ success: false, message: 'Missing required data for feedback.' });
    }
    try {
        const userResult = await pool.query('SELECT id FROM Employees WHERE LOWER(employee_id) = LOWER($1)', [employee_id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const userId = userResult.rows[0].id;

        const upsertQuery = `
            INSERT INTO Feedback (sticker_id, employee_id, comment)
            VALUES ($1, $2, $3)
            ON CONFLICT (sticker_id, employee_id) 
            DO UPDATE SET comment = EXCLUDED.comment, submitted_at = NOW()
        `;
        await pool.query(upsertQuery, [sticker_id, userId, comment]);
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Error in submitFeedback:', err);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }

  // ===============================================
  //  ADMIN-FACING ACTIONS
  // ===============================================

  if (action === 'getAllStickers') {
    try {
      const query = `
        SELECT 
            s.*, 
            COUNT(DISTINCT f.id)::int AS feedback_count,
            COUNT(DISTINCT c.id)::int AS collection_count
        FROM Stickers s
        LEFT JOIN Feedback f ON s.id = f.sticker_id
        LEFT JOIN Collection c ON s.id = c.sticker_id
        GROUP BY s.id
        ORDER BY s.event_date DESC
      `;
      const result = await pool.query(query);
      return res.status(200).json({ success: true, stickers: result.rows });
    } catch (err) {
      console.error('Error in getAllStickers:', err);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }

  if (action === 'createSticker') {
    const { event_name, event_date, description, sticker_image_data } = params;
    if (!event_name || !event_date || !sticker_image_data) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    try {
      const query = `
        INSERT INTO Stickers (event_name, event_date, description, image_data) 
        VALUES ($1, $2, $3, $4) RETURNING id
      `;
      const result = await pool.query(query, [event_name, event_date, description, sticker_image_data]);
      return res.status(201).json({ success: true, new_sticker_id: result.rows[0].id });
    } catch (err) {
      console.error('Error in createSticker:', err);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
  
  if (action === 'updateStickerDetails') {
    const { sticker_id, event_name, event_date, description } = params;
    if (!sticker_id || !event_name || !event_date) {
        return res.status(400).json({ success: false, message: 'Missing required fields for update.' });
    }
    try {
        const query = `
            UPDATE Stickers 
            SET event_name = $1, event_date = $2, description = $3 
            WHERE id = $4
        `;
        await pool.query(query, [event_name, event_date, description, sticker_id]);
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Error in updateStickerDetails:', err);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }

  if (action === 'deleteSticker') {
      const { sticker_id } = params;
      if (!sticker_id) {
          return res.status(400).json({ success: false, message: 'Sticker ID not provided.' });
      }
      try {
          await pool.query('DELETE FROM Stickers WHERE id = $1', [sticker_id]);
          return res.status(200).json({ success: true });
      } catch (err) {
          console.error('Error in deleteSticker:', err);
          return res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
  }

  if (action === 'getFeedback') {
    const { sticker_id } = params;
    if (!sticker_id) {
        return res.status(400).json({ success: false, message: 'Sticker ID not provided.' });
    }
    try {
        const query = `
            SELECT f.comment, f.submitted_at, e.full_name, e.employee_id 
            FROM Feedback f 
            JOIN Employees e ON f.employee_id = e.id 
            WHERE f.sticker_id = $1 
            ORDER BY f.submitted_at DESC
        `;
        const result = await pool.query(query, [sticker_id]);
        return res.status(200).json({ success: true, feedback: result.rows });
    } catch (err) {
        console.error('Error in getFeedback:', err);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }

  // If no action matches, return an error
  if (!action) {
    return res.status(400).json({ success: false, message: 'No action specified.' });
  }

});

// Export the app for Vercel
module.exports = app;
