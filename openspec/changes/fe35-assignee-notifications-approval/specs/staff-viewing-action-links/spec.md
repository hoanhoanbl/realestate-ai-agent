# Spec Delta

## Purpose

Lets staff approve a pending viewing or ask to reschedule it directly from a notification, for as long as the viewing can still be acted on, without keeping a workflow execution waiting.

## ADDED Requirements

### Requirement: Links valid until the viewing time
A staff action link for a viewing SHALL work from the moment it is issued until the viewing's scheduled time, and SHALL NOT expire after a fixed number of hours.

#### Scenario: Approve two days after the alert
- **WHEN** staff open the Approve link 48 hours after the notification and the viewing is still pending and in the future
- **THEN** the confirmation page offers the action and confirming approves the viewing

#### Scenario: Link used after the viewing time
- **WHEN** staff open a link after the viewing's scheduled time
- **THEN** the page says the link is no longer valid and nothing changes

### Requirement: Opening a link never changes anything
Opening a staff action link SHALL only show a summary (property, time, customer name, current status). The viewing SHALL change only after staff press the confirm button on that page.

#### Scenario: Mail scanner opens the link
- **WHEN** an automated scanner requests the link URL
- **THEN** no approval, event or email is produced

### Requirement: Approve confirms the viewing
Confirming Approve on a lead that is `NEW` with a pending viewing and finished AI scoring SHALL confirm the viewing exactly as approval from the web admin does: the lead becomes `CONFIRMED`, the customer receives the confirmation email with the viewing management link, an `APPROVED` event is logged, and the first-response time of the lead is recorded.

#### Scenario: Normal approval
- **WHEN** staff confirm Approve for a pending viewing on a scored lead
- **THEN** the lead is `CONFIRMED`, the customer email is sent once, and the page shows "Đã duyệt"

#### Scenario: AI scoring not finished
- **WHEN** staff confirm Approve while the lead's scoring is still pending
- **THEN** nothing changes and the page says scoring is not finished yet and to try again shortly

### Requirement: Reschedule request
Confirming "Change time" SHALL log a `RESCHEDULE_REQUESTED` event, send the customer the "we need to arrange another time" email, record the first response, and leave the lead `NEW` so staff set the new time on the web admin.

#### Scenario: Staff ask to change the time
- **WHEN** staff confirm "Change time" for a pending viewing
- **THEN** the customer receives the rearrangement email and the event is logged
- **AND** the lead stays `NEW` and the viewing keeps its old time until staff change it

### Requirement: Link refuses when the situation changed
A link SHALL refuse to act, show the reason, and change nothing when any of these is true: the lead is no longer `NEW`, the viewing is not pending (cancelled, attended or missed), the viewing is not the lead's current open viewing, or the link was issued for a different viewing than the one it names.

#### Scenario: Customer cancelled first
- **WHEN** the customer cancelled the viewing from their own link and staff then confirm Approve
- **THEN** the page says the viewing was cancelled and nothing is sent to the customer

#### Scenario: Old link after a new booking
- **WHEN** a returning customer booked a second viewing and staff use the Approve link of the first one
- **THEN** the link refuses and the second viewing is not approved

#### Scenario: Already approved elsewhere
- **WHEN** the lead was approved on the web admin and staff then confirm the same link
- **THEN** the page says it was already approved and no second email is sent

### Requirement: Links cannot be forged
A link SHALL carry a signature issued by the backend. A link with a changed viewing id or action, or with a bad signature, SHALL be rejected without revealing whether the viewing exists. The preview SHALL show only the property, time, customer name and status, and no phone or email.

#### Scenario: Tampered link
- **WHEN** someone edits the viewing id inside a link
- **THEN** the request is rejected as invalid and no customer data is returned
