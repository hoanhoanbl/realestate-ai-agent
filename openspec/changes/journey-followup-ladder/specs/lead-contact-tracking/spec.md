# Spec Delta

## Purpose

Lets a sale record whether a customer was actually reached and why a lead was closed, so that follow-up automation knows when to stop and reports can say where customers are lost.

## ADDED Requirements

### Requirement: A sale can mark a customer as reached
The system SHALL let a staff member mark an open lead as "đã liên hệ được". The first mark stores the time and the staff member; later marks SHALL NOT change the stored time. The mark SHALL be refused for a lead that is `LOST`.

#### Scenario: First time reached
- **WHEN** the assigned sale marks a `CONSULTING` lead as reached
- **THEN** the lead stores the contact time
- **AND** the lead history shows a "contacted" entry naming that sale

#### Scenario: Marked again later
- **WHEN** a lead already marked as reached is marked again
- **THEN** the stored contact time stays the original one
- **AND** no second "contacted" entry is added

#### Scenario: Closed lead
- **WHEN** someone marks a `LOST` lead as reached
- **THEN** the request is refused and the lead is unchanged

### Requirement: A sale can log a failed contact attempt
The system SHALL let a staff member log a contact attempt that did not reach the customer, with one result from: no answer, busy, asked to call back, wrong number. A failed attempt SHALL NOT mark the lead as reached.

#### Scenario: No answer
- **WHEN** a sale logs an attempt with result "no answer"
- **THEN** the lead history shows the attempt with its result and time
- **AND** the lead is still not marked as reached

#### Scenario: Unknown result
- **WHEN** a request logs an attempt with a result outside the list
- **THEN** the request is refused

### Requirement: Contact actions count as the first response
When the lead has no first response yet, marking it reached or logging a failed attempt SHALL record the first response time, so the response-deadline reminder stops.

#### Scenario: Attempt before any other action
- **WHEN** a sale logs "no answer" on a lead with no first response
- **THEN** the first response time is set to that moment
- **AND** no response-deadline alert is sent for that lead afterwards

### Requirement: Closing a lead needs a supported reason
The system SHALL close a lead only with a reason from this list: price too high, chose another property, bought elsewhere, cannot be reached, no longer needs it, customer cancelled, no-show, expired, stale, other. Staff closing a lead by hand SHALL be offered price too high, chose another property, bought elsewhere, cannot be reached, no longer needs it, and other. The reasons no-show, customer cancelled, expired and stale SHALL be set only by the system.

#### Scenario: Staff closes with a detailed reason
- **WHEN** a sale closes a `VIEWED` lead with reason "price too high"
- **THEN** the lead becomes `LOST` with that reason and the history shows it

#### Scenario: Staff tries a system-only reason
- **WHEN** a staff request closes a lead with reason "stale"
- **THEN** the request is refused

#### Scenario: Old reason on an existing lead
- **WHEN** a lead was closed before this change with the reason "not interested"
- **THEN** it keeps that reason and is shown as "Không còn nhu cầu"
