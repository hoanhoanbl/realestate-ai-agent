# Spec Delta

## Purpose

Makes sure a lead that nobody is acting on is reminded in steps, escalated to the manager, and finally closed, instead of sitting open forever. The automation proposes the next action; a person approves anything sent to the customer.

## ADDED Requirements

### Requirement: Unreached leads are reminded at fixed steps
The system SHALL remind the assigned sale about an open lead (`CONSULTING`, `NEW`, `CONFIRMED`, `VIEWED`) that is not marked as reached, 1, 3 and 7 days after the lead was assigned. Each step SHALL be sent at most once per assignment. A lead with no assignee SHALL be reminded to the manager instead. The existing 2-working-hour response alert stays as the day-0 step.

#### Scenario: Day 1 without contact
- **WHEN** a lead was assigned 1 day ago and is not marked as reached
- **THEN** the assigned sale gets one day-1 reminder

#### Scenario: Reached before the step
- **WHEN** the sale marks the lead as reached on day 2
- **THEN** the day-3 and day-7 reminders are never sent

#### Scenario: Reassigned lead
- **WHEN** the manager moves the lead to another sale
- **THEN** the steps count from the new assignment time and go to the new sale

### Requirement: Quiet leads are reminded after 7 days
The system SHALL remind the assigned sale about a `CONSULTING` or `VIEWED` lead that has had no activity for 7 days. Activity is any note, contact mark or attempt, status change, assignment change, customer feedback, or new booking; automated entries do not count. Any activity restarts the quiet period.

#### Scenario: Silent after a viewing
- **WHEN** a `VIEWED` lead has had no activity for 7 days, whatever its HOT, WARM or COLD level and whether or not the customer consented to marketing
- **THEN** the assigned sale gets a quiet-lead reminder

#### Scenario: Note resets the clock
- **WHEN** the sale adds a note on day 5 of silence
- **THEN** no reminder is sent on day 7 of the old period and a new 7-day period starts at the note

### Requirement: Quiet leads are closed as stale after 14 days
The system SHALL close a `CONSULTING` or `VIEWED` lead as `LOST` with reason stale when it has had no activity for 14 days, and SHALL tell the manager. It SHALL NOT close a lead that has an open viewing or a contract. It SHALL NOT email the customer about the closing.

#### Scenario: Nobody handled the lead
- **WHEN** a `VIEWED` lead reaches 14 days without activity
- **THEN** the lead becomes `LOST` with reason stale
- **AND** the manager gets one alert naming the lead and the assigned sale

#### Scenario: Lead with a deposit contract
- **WHEN** a lead has been quiet for 14 days but has a contract that is not rejected or expired
- **THEN** the lead is not closed

#### Scenario: Reopened
- **WHEN** staff reopen a lead closed as stale
- **THEN** the quiet period starts again from the reopening

### Requirement: Each reminder carries an AI suggestion
For each due reminder the system SHALL ask the AI for a structured suggestion: the next action (call, send email, offer a new viewing, or wait), a short reason, and an email draft for the customer. The draft SHALL be checked before use and SHALL be dropped if it promises a price or discount, states a fact not in the lead data, or is empty or too long. If the AI fails or the draft is dropped, the reminder SHALL still be sent without a draft.

#### Scenario: Valid suggestion
- **WHEN** the AI returns "call" with a reason and a clean draft
- **THEN** the sale's reminder shows the action, the reason and the draft

#### Scenario: Draft promises a discount
- **WHEN** the AI draft contains a price promise
- **THEN** the draft is dropped
- **AND** the sale still gets the reminder with the action and reason only

#### Scenario: AI unavailable
- **WHEN** the AI call fails after its retries
- **THEN** the sale gets a plain reminder with no suggestion and the failure is recorded

### Requirement: The customer is emailed only after the sale approves
The system SHALL send a ladder email to the customer only when the assigned sale approves it from the reminder, and only if the customer has an email and consented to marketing messages. The sale SHALL be able to edit the draft before approving. An approval link SHALL work once, only while the lead is still open and the step is the current one.

#### Scenario: Sale approves an edited draft
- **WHEN** the sale opens the link, changes the text and approves
- **THEN** the customer receives the edited text
- **AND** the lead history records who approved and what was sent

#### Scenario: No consent
- **WHEN** the customer has not consented to marketing messages
- **THEN** the reminder offers no send option and the sale is told to contact the customer directly

#### Scenario: Link used twice or lead closed
- **WHEN** the link is opened again after sending, or after the lead became `LOST`
- **THEN** nothing is sent and the page says it was already handled or is no longer valid

### Requirement: A step is never repeated and failures are recorded
The system SHALL NOT send the same step for the same lead and quiet period twice, even if the flow runs again or overlaps. When sending a reminder fails, the system SHALL retry up to three times, then record a failure in the lead history and report it to the error workflow.

#### Scenario: Flow runs twice in the same hour
- **WHEN** two runs both find the same due step
- **THEN** only one reminder is sent

#### Scenario: Notification channel fails
- **WHEN** all three attempts to notify the sale fail
- **THEN** the lead history shows a failed ladder step
- **AND** the error workflow is triggered

### Requirement: Silent customers are handled only by the ladder
The viewing follow-up flow SHALL NOT remind the sale or enrol the customer in Mautic because the customer stayed silent after a viewing. This applies to HOT, WARM and COLD leads. Reminders, feedback requests and attendance checks for viewings are unchanged.

#### Scenario: Warm customer, no consent
- **WHEN** a WARM customer has not replied for 3 days after the feedback request
- **THEN** nothing is sent to Mautic and no nudge is sent by the viewing flow
- **AND** the ladder handles the lead at 7 days
