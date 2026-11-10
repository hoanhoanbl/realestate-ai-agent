# Spec Delta

## Purpose

Lets one customer (one lead, identified by phone number) view several properties over time, keeping every viewing as history, without losing the lead when a single viewing is cancelled or missed.

## ADDED Requirements

### Requirement: One open viewing per lead
A lead SHALL have at most one open viewing, meaning a viewing that is still waiting to happen (pending approval or confirmed). Earlier viewings that were attended, missed or cancelled SHALL stay attached to the lead as history.

#### Scenario: Second booking while one is open
- **WHEN** a customer whose lead has an open viewing at 09:00 Saturday books another property
- **THEN** the API returns 409 with a message giving the open viewing's time and asking to use the link in the confirmation email or contact staff
- **AND** nothing is saved

### Requirement: Returning customer books on the existing lead
A booking whose phone matches an existing lead SHALL add a new viewing to that lead instead of creating a new lead, when the lead has no open viewing and is not in `DEPOSIT` or `SIGNED`. The lead's owner, source, name and consent SHALL be kept; missing email, budget and needs SHALL be filled from the form.

#### Scenario: Customer who viewed one property books another
- **WHEN** a customer whose lead is `VIEWED` (viewing 1 attended) books a different property
- **THEN** a new viewing is created on the same lead and no new lead is created
- **AND** viewing 1 stays `ATTENDED`

#### Scenario: Consulting customer books for the first time
- **WHEN** a customer whose lead is `CONSULTING` with no viewing books a property
- **THEN** the first viewing is created on that lead

#### Scenario: Closed customer comes back
- **WHEN** a customer whose lead is `LOST` books a property
- **THEN** the lead is reopened, gets a new viewing, and its lost reason is cleared

#### Scenario: Customer in deposit books again
- **WHEN** a customer whose lead is `DEPOSIT` or `SIGNED` books a property
- **THEN** the API returns 409 asking the customer to contact staff
- **AND** nothing is saved

### Requirement: Booking restarts the approval cycle
When a viewing is booked on a lead, the lead SHALL become `NEW` (pending approval) with any previous approval link cleared, and the booking workflow SHALL be triggered for the new viewing exactly as for a first booking.

#### Scenario: Viewed customer books again
- **WHEN** a `VIEWED` lead books a new viewing
- **THEN** the lead becomes `NEW`, a `STATUS_CHANGED` event records the move, and the booking workflow receives the new viewing's time, property and manage link

### Requirement: Ending a viewing does not close the lead
When the open viewing ends without being attended (customer cancels through the manage link, or staff record a no-show without rescheduling), only that viewing SHALL change (`CANCELLED` or `NO_SHOW`). The lead SHALL return to its base status: `VIEWED` if any of its other viewings was attended, otherwise `CONSULTING`. Lost reason SHALL stay empty.

#### Scenario: First-time customer cancels
- **WHEN** a lead with one viewing (pending or confirmed) is cancelled by the customer through the manage link
- **THEN** the viewing becomes `CANCELLED`, the lead becomes `CONSULTING`, and a `VIEWING_CANCELLED` event is logged

#### Scenario: Customer who viewed before misses the second viewing
- **WHEN** staff record "no-show, do not reschedule" for viewing 2 of a lead whose viewing 1 was attended
- **THEN** viewing 2 becomes `NO_SHOW` and the lead becomes `VIEWED`

#### Scenario: Pending approval link is disabled
- **WHEN** a customer cancels a viewing that is still waiting for staff approval
- **THEN** the lead's approval link is cleared so the old Approve button cannot confirm a cancelled viewing

### Requirement: Closing the lead stays explicit
Marking a lead lost SHALL remain a separate staff action. If the lead has an open viewing at that moment, that viewing SHALL be cancelled.

#### Scenario: Staff close a lead with an open viewing
- **WHEN** staff mark a lead "Mất khách" while it has an open viewing
- **THEN** the lead becomes `LOST` with the chosen reason and the open viewing becomes `CANCELLED`

### Requirement: Deposit contract uses the last attended viewing
A deposit contract SHALL be created for the property of the lead's most recent attended viewing. A lead without an attended viewing cannot get a contract.

#### Scenario: Later viewing was cancelled
- **WHEN** a lead attended viewing 1 (property A), then booked and cancelled viewing 2 (property B), and staff create a contract
- **THEN** the contract is for property A

### Requirement: Staff see the viewing history
The lead detail SHALL list all of the lead's viewings with property, time and status, newest first, alongside the current viewing.

#### Scenario: Lead with two viewings
- **WHEN** staff open a lead with an attended viewing and a new pending viewing
- **THEN** the detail shows the pending viewing as current and lists both viewings in the history
