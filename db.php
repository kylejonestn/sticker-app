<?php
// db.php - Database Connection File

$servername = "127.0.0.1"; // When hosted on My Cloud, this should be 'localhost' or '127.0.0.1'
$username = "root";       // The user for your My Cloud database
$password = "";           // The password for that user
$dbname = "sticker_app_db";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}

$conn->set_charset("utf8");
?>
