# Spec Delta

## Purpose

Defines who receives a staff alert about a lead and through which channels, so that the sale responsible for a customer is the one told, with a defined fallback when that is not possible.

## ADDED Requirements

### Requirement: Alerts go only to the assigned sale
When a staff alert about a lead names an assignee, the system SHALL deliver it to that person's own email address, personal Telegram chat and push token, and to no other staff member. It SHALL NOT post to a shared Telegram group and SHALL NOT push to other staff.

#### Scenario: Sale with all channels
- **WHEN** a new-viewing alert is sent for a lead assigned to a sale who has an email, a personal Telegram chat id and a push token
- **THEN** that sale receives the email, the Telegram message and the push notification
- **AND** no other staff member receives anything

#### Scenario: Sale without Telegram
- **WHEN** the assigned sale has no personal Telegram chat id
- **THEN** the alert is delivered by email (and push, if a token exists) only
- **AND** the result reports Telegram as skipped, not as failed

### Requirement: Fallback to the manager
When a lead has no assignee, or the assignee cannot be found, or none of the assignee's channels can be used, the system SHALL deliver the alert by email to the manager instead, and the result SHALL say that the fallback was used.

#### Scenario: Lead without an assigned sale
- **WHEN** an alert is requested for a lead whose assignee is empty
- **THEN** the manager receives the alert by email
- **AND** the result marks the delivery as a manager fallback

#### Scenario: Assignee has no usable channel
- **WHEN** the assigned user has no email, no Telegram chat id and no push token
- **THEN** the manager receives the alert by email and the result marks the fallback

### Requirement: Assignee is not required to be accepting new leads
Delivery SHALL NOT depend on the assignee's "accepting leads" switch. That switch only affects who receives new customers, not alerts for customers the person already owns.

#### Scenario: Sale paused after being assigned
- **WHEN** a sale switched "accepting leads" off after a lead was assigned to them, and an alert about that lead is sent
- **THEN** the alert still goes to that sale

### Requirement: Existing callers keep their behavior
An alert that names only a recipient email, with no assignee, SHALL be delivered to that email and the existing Telegram group exactly as before, and the result fields already consumed by callers (`emailSent`, `telegramSent`, `telegramSkipped`) SHALL keep their meaning.

#### Scenario: Manager overdue alert
- **WHEN** the response-deadline workflow sends an alert addressed to the manager email without an assignee
- **THEN** the email is sent to that address and `emailSent` is true in the result

### Requirement: Delivery result per channel
Every alert SHALL return which of email, Telegram and push were sent, which were skipped because the recipient has no such channel, and an error message for each that failed. A failure on one channel SHALL NOT stop the others.

#### Scenario: Telegram fails, email succeeds
- **WHEN** the Telegram API rejects the message but the email is sent
- **THEN** the result shows `emailSent` true, Telegram failed with its error text, and the alert is not reported as undelivered
