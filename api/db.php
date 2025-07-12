<?php
// api/db.php - PostgreSQL Database Connection File

// Reads connection details from Vercel Environment Variables
$host = getenv('DB_HOST');
$port = getenv('DB_PORT');
$dbname = getenv('DB_NAME');
$user = getenv('DB_USER');
$password = getenv('DB_PASSWORD');

// Create the connection string
$conn_string = "host={$host} port={$port} dbname={$dbname} user={$user} password={$password}";

// Establish a connection to the database
$conn = pg_connect($conn_string);

// Check connection
if (!$conn) {
    // Use a generic error message for security
    http_response_code(500);
    die("Connection failed: Internal Server Error.");
}

// Note: You don't need to set charset for pg_connect in the same way as mysqli
?>