<?php
// api.php - Main API Endpoint

require_once '/db.php';

header('Content-Type: application/json');
$response = [];
$requestData = $_REQUEST; 

if (isset($requestData['action'])) {
    $action = $requestData['action'];

    // Action: Get User Data and Stickers
    if ($action == 'getUser') {
        if (isset($requestData['employee_id'])) {
            $employeeId = $requestData['employee_id'];
            $stmt = $conn->prepare("SELECT * FROM Employees WHERE employee_id = ?");
            $stmt->bind_param("s", $employeeId);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) {
                $user = $result->fetch_assoc();
                $userId = $user['id'];
                $stickerStmt = $conn->prepare("SELECT s.id, s.event_name, s.event_date, s.description, s.image_data FROM Stickers s JOIN Collection c ON s.id = c.sticker_id WHERE c.employee_record_id = ? ORDER BY c.date_earned DESC");
                $stickerStmt->bind_param("i", $userId);
                $stickerStmt->execute();
                $stickersResult = $stickerStmt->get_result();
                $user['stickers'] = $stickersResult->fetch_all(MYSQLI_ASSOC);
                $response['success'] = true;
                $response['user'] = $user;
            } else { $response = ['success' => false, 'message' => "User not found."]; }
        } else { $response = ['success' => false, 'message' => "Employee ID not provided."]; }
    }
    
    // ACTION: Get a single sticker's info AND the user's feedback for it
    elseif ($action == 'getStickerInfo') {
        if (isset($requestData['sticker_id'])) {
            $stickerId = $requestData['sticker_id'];
            $stmt = $conn->prepare("SELECT * FROM Stickers WHERE id = ?");
            $stmt->bind_param("i", $stickerId);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows > 0) {
                $response['success'] = true;
                $response['sticker'] = $result->fetch_assoc();

                if (isset($requestData['employee_id'])) {
                    $employeeId = $requestData['employee_id'];
                    $userStmt = $conn->prepare("SELECT id FROM Employees WHERE employee_id = ?");
                    $userStmt->bind_param("s", $employeeId);
                    $userStmt->execute();
                    $userResult = $userStmt->get_result();
                    if($userResult->num_rows > 0) {
                        $user = $userResult->fetch_assoc();
                        $userId = $user['id'];
                        $feedbackStmt = $conn->prepare("SELECT comment FROM Feedback WHERE sticker_id = ? AND employee_id = ?");
                        $feedbackStmt->bind_param("ii", $stickerId, $userId);
                        $feedbackStmt->execute();
                        $feedbackResult = $feedbackStmt->get_result();
                        if($feedbackResult->num_rows > 0) {
                            $response['user_feedback'] = $feedbackResult->fetch_assoc()['comment'];
                        }
                    }
                }
            } else { $response = ['success' => false, 'message' => "Sticker not found."]; }
        } else { $response = ['success' => false, 'message' => "Sticker ID not provided."]; }
    }

    // ACTION: Add a sticker to a user's collection
    elseif ($action == 'addSticker') {
        if (isset($requestData['employee_id']) && isset($requestData['sticker_id'])) {
            $employeeId = $requestData['employee_id'];
            $stickerId = $requestData['sticker_id'];
            $userStmt = $conn->prepare("SELECT id FROM Employees WHERE employee_id = ?");
            $userStmt->bind_param("s", $employeeId);
            $userStmt->execute();
            $userResult = $userStmt->get_result();
            if ($userResult->num_rows > 0) {
                $user = $userResult->fetch_assoc();
                $userId = $user['id'];
                $checkStmt = $conn->prepare("SELECT id FROM Collection WHERE employee_record_id = ? AND sticker_id = ?");
                $checkStmt->bind_param("ii", $userId, $stickerId);
                $checkStmt->execute();
                if ($checkStmt->get_result()->num_rows == 0) {
                    $insertStmt = $conn->prepare("INSERT INTO Collection (employee_record_id, sticker_id) VALUES (?, ?)");
                    $insertStmt->bind_param("ii", $userId, $stickerId);
                    $insertStmt->execute();
                }
                $response['success'] = true;
            } else { $response = ['success' => false, 'message' => "Employee not found."]; }
        } else { $response = ['success' => false, 'message' => "Required data not provided."]; }
    }
    
    // ACTION: Register a new user and add their first sticker
    elseif ($action == 'registerAndAddSticker') {
        if (isset($_POST['employee_id']) && isset($_POST['full_name']) && isset($_POST['sticker_id'])) {
            $employeeId = $_POST['employee_id'];
            $fullName = $_POST['full_name'];
            $stickerId = $_POST['sticker_id'];
            
            $conn->begin_transaction();
            try {
                $registerStmt = $conn->prepare("INSERT INTO Employees (employee_id, full_name) VALUES (?, ?)");
                $registerStmt->bind_param("ss", $employeeId, $fullName);
                $registerStmt->execute();
                $newUserId = $conn->insert_id;

                $addStmt = $conn->prepare("INSERT INTO Collection (employee_record_id, sticker_id) VALUES (?, ?)");
                $addStmt->bind_param("ii", $newUserId, $stickerId);
                $addStmt->execute();

                $conn->commit();
                $response['success'] = true;
            } catch (Exception $e) {
                $conn->rollback();
                $response = ['success' => false, 'message' => "Registration failed. This Employee ID might already be taken."];
            }
        } else { $response = ['success' => false, 'message' => "Missing data for registration."]; }
    }

    // ACTION: Submit or Update feedback for a sticker
    elseif ($action == 'submitFeedback') {
        if (isset($_POST['sticker_id'], $_POST['employee_id'], $_POST['comment'])) {
            $stickerId = $_POST['sticker_id'];
            $employeeId = $_POST['employee_id'];
            $comment = $_POST['comment'];
            
            $userStmt = $conn->prepare("SELECT id FROM Employees WHERE employee_id = ?");
            $userStmt->bind_param("s", $employeeId);
            $userStmt->execute();
            $userResult = $userStmt->get_result();
            if($userResult->num_rows > 0) {
                $user = $userResult->fetch_assoc();
                $userId = $user['id'];
                
                $stmt = $conn->prepare("INSERT INTO Feedback (sticker_id, employee_id, comment) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE comment = VALUES(comment)");
                $stmt->bind_param("iis", $stickerId, $userId, $comment);
                if($stmt->execute()){
                    $response = ['success' => true];
                } else { 
                    $response = ['success' => false, 'message' => 'Database error: ' . $stmt->error]; 
                }
            } else { $response = ['success' => false, 'message' => 'User not found.']; }
        } else { $response = ['success' => false, 'message' => 'Missing feedback data.']; }
    }

    // ACTION: Get all feedback for a specific sticker (for admin)
    elseif ($action == 'getFeedback') {
        if (isset($_GET['sticker_id'])) {
            $stickerId = $_GET['sticker_id'];
            $stmt = $conn->prepare("SELECT f.comment, f.submitted_at, e.full_name, e.employee_id FROM Feedback f JOIN Employees e ON f.employee_id = e.id WHERE f.sticker_id = ? ORDER BY f.submitted_at DESC");
            $stmt->bind_param("i", $stickerId);
            $stmt->execute();
            $result = $stmt->get_result();
            $feedback = $result->fetch_all(MYSQLI_ASSOC);
            $response = ['success' => true, 'feedback' => $feedback];
        } else { $response = ['success' => false, 'message' => 'Sticker ID not provided.']; }
    }
    
    // ACTION: Get all stickers for the admin dashboard (with feedback AND collection count)
    elseif ($action == 'getAllStickers') {
        // UPDATED: Joined with both Feedback and Collection tables to get counts
        $sql = "
            SELECT 
                s.*, 
                COUNT(DISTINCT f.id) AS feedback_count,
                COUNT(DISTINCT c.id) AS collection_count
            FROM Stickers s
            LEFT JOIN Feedback f ON s.id = f.sticker_id
            LEFT JOIN Collection c ON s.id = c.sticker_id
            GROUP BY s.id
            ORDER BY s.event_date DESC
        ";
        $result = $conn->query($sql);
        $stickers = $result->fetch_all(MYSQLI_ASSOC);
        $response['success'] = true;
        $response['stickers'] = $stickers;
    }

    // ACTION: Create a new sticker with Base64 image data
    elseif ($action == 'createSticker') {
        $eventName = $_POST['event_name'] ?? '';
        $eventDate = $_POST['event_date'] ?? '';
        $description = $_POST['description'] ?? '';
        $imageData = $_POST['sticker_image_data'] ?? '';

        if (!empty($eventName) && !empty($eventDate) && !empty($imageData)) {
            $stmt = $conn->prepare("INSERT INTO Stickers (event_name, event_date, description, image_data) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("ssss", $eventName, $eventDate, $description, $imageData);
            
            if ($stmt->execute()) {
                $response['success'] = true;
                $response['new_sticker_id'] = $conn->insert_id;
            } else { $response = ['success' => false, 'message' => "Database error: Failed to create sticker."]; }
        } else { $response = ['success' => false, 'message' => "Missing required data (Event Name, Date, or Image)."]; }
    }

    // ACTION: Delete a sticker
    elseif ($action == 'deleteSticker') {
        if (isset($_POST['sticker_id'])) {
            $stickerId = $_POST['sticker_id'];
            $stmt = $conn->prepare("DELETE FROM Stickers WHERE id = ?");
            $stmt->bind_param("i", $stickerId);
            if ($stmt->execute()) {
                $response['success'] = true;
            } else { $response = ['success' => false, 'message' => "Failed to delete sticker."]; }
        } else { $response = ['success' => false, 'message' => "Sticker ID not provided."]; }
    }

    // ACTION: Replace a sticker's image
    elseif ($action == 'replaceStickerImage') {
        if (isset($_POST['sticker_id']) && isset($_POST['sticker_image_data'])) {
            $stickerId = $_POST['sticker_id'];
            $imageData = $_POST['sticker_image_data'];
            $stmt = $conn->prepare("UPDATE Stickers SET image_data = ? WHERE id = ?");
            $stmt->bind_param("si", $imageData, $stickerId);
            if ($stmt->execute()) {
                $response['success'] = true;
            } else { $response = ['success' => false, 'message' => "Failed to update sticker image."]; }
        } else { $response = ['success' => false, 'message' => "Required data not provided."]; }
    }

    // ACTION: Update a sticker's text details
    elseif ($action == 'updateStickerDetails') {
        if (isset($_POST['sticker_id'], $_POST['event_name'], $_POST['event_date'], $_POST['description'])) {
            $stickerId = $_POST['sticker_id'];
            $eventName = $_POST['event_name'];
            $eventDate = $_POST['event_date'];
            $description = $_POST['description'];

            $stmt = $conn->prepare("UPDATE Stickers SET event_name = ?, event_date = ?, description = ? WHERE id = ?");
            $stmt->bind_param("sssi", $eventName, $eventDate, $description, $stickerId);

            if ($stmt->execute()) {
                $response['success'] = true;
            } else {
                $response = ['success' => false, 'message' => 'Failed to update sticker details.'];
            }
        } else {
            $response = ['success' => false, 'message' => 'Missing data for update.'];
        }
    }

    else { 
        $response = ['success' => false, 'message' => "Unknown action."]; 
    }
} else { 
    $response = ['success' => false, 'message' => "No action specified."]; 
}

$conn->close();
echo json_encode($response);
?>
