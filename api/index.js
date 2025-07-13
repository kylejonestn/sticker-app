// Import required packages
const express = require('express');
const { Pool } =  require('pg');
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
    // ... (logic is unchanged)
  }
  if (action === 'getStickerInfo') {
    // ... (logic is unchanged)
  }
  if (action === 'addSticker') {
    // ... (logic is unchanged)
  }
  if (action === 'registerAndAddSticker') {
    // ... (logic is unchanged)
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
          // Note: In a real-world app, you might want to also delete related collection and feedback entries.
          await pool.query('DELETE FROM Stickers WHERE id = $1', [sticker_id]);
          return res.status(200).json({ success: true });
      } catch (err) {
          console.error('Error in deleteSticker:', err);
          return res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
  }


  // If no action matches, return an error
  // Note: This part of the code might not be reached if an action is always provided.
  // It's good practice to have a fallback.
  if (!action) {
    return res.status(400).json({ success: false, message: 'No action specified.' });
  }

});

// Export the app for Vercel
module.exports = app;
