## ADDED Requirements

### Requirement: Manage-booking link
Each viewing SHALL have a unique random `manage_token`. The booking confirmation email (flow 1 and flow 1b) and the new-time email (flow 1b) SHALL include a link `<public web>/lich/<token>`.

#### Scenario: Confirmation email
- **WHEN** staff approve a booking
- **THEN** the customer's confirmation email contains a working "Huỷ / xin đổi lịch" link

#### Scenario: Unknown token
- **WHEN** someone opens `/lich/<token>` with a token that does not exist
- **THEN** the page shows "Liên kết không hợp lệ"

### Requirement: Customer cancels a booking
From the manage-booking page, the customer SHALL be able to cancel while the lead is `NEW` or `CONFIRMED`, the viewing is `NEW`, and the viewing time has not passed. Cancelling makes the viewing `CANCELLED`, makes the lead `LOST` with `lost_reason = CUSTOMER_CANCELLED`, logs `VIEWING_CANCELLED`, and clears the pending approval link.

#### Scenario: Cancel before viewing
- **WHEN** a `CONFIRMED` customer presses "Huỷ lịch" one day before the viewing
- **THEN** the viewing is `CANCELLED`, the lead is `LOST` with reason `CUSTOMER_CANCELLED`, and the page confirms the cancellation

#### Scenario: Cancel after viewing time
- **WHEN** a customer tries to cancel after the viewing time has passed
- **THEN** the request is rejected and the page explains the booking can no longer be changed

### Requirement: Stale approvals are ignored
Flow 1 and flow 1b MUST check that the lead is still `NEW` and the viewing is still `NEW` before sending a confirmation email or setting `CONFIRMED`.

#### Scenario: Approve after customer cancelled
- **WHEN** a customer cancels, and staff later press "Duyệt" in the original approval email
- **THEN** no confirmation email is sent, the lead stays `LOST`, and staff see "Lịch này đã bị huỷ hoặc đã xử lý"

### Requirement: Customer asks to reschedule
From the manage-booking page, under the same conditions as cancelling, the customer SHALL be able to send a reschedule request with an optional note. This logs `CUSTOMER_RESCHEDULE_REQUESTED`, changes no status, and does not let the customer pick a time.

#### Scenario: Reschedule request
- **WHEN** a customer sends "Xin đổi sang chiều thứ 7"
- **THEN** a `CUSTOMER_RESCHEDULE_REQUESTED` event with that note is logged and the customer appears in the admin task group for customer requests

### Requirement: Admin task groups from customer signals
The admin overview SHALL show, from one `GET /stats/tasks` call, task groups for:
- viewings waiting for attendance confirmation;
- customers whose feedback interest is `DEPOSIT` and who are still `VIEWED`;
- customers whose feedback interest is `NONE` and who are not `LOST` or `SIGNED`;
- backup customers on reserved properties;
- customer reschedule requests from the last 7 days whose lead is still `NEW` or `CONFIRMED`.

Each group SHALL link to the lead page.

#### Scenario: Customer wants to deposit
- **WHEN** a `VIEWED` customer submits feedback with interest "Muốn đặt cọc căn này"
- **THEN** the customer appears in the "Khách muốn đặt cọc" group on the overview

#### Scenario: Customer no longer interested
- **WHEN** a customer submits feedback with interest "Không còn nhu cầu"
- **THEN** the customer appears in the "Khách báo không còn nhu cầu" group, and their status is unchanged until staff act

#### Scenario: Pending attendance
- **WHEN** a `CONFIRMED` customer's viewing time has passed and attendance is not recorded
- **THEN** the customer appears in the "Buổi xem chờ xác nhận" group
