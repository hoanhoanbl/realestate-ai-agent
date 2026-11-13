# Spec Delta

## Purpose

Gives a customer who did not come to a booked viewing an easy way to book again, instead of leaving the lead with no next step.

## ADDED Requirements

### Requirement: A no-show customer is invited to book again
When staff record that a customer did not attend a viewing, the system SHALL email the customer once, within 2 hours, with the property and a link to book a new time. The email is a service message about the customer's own booking, so it SHALL be sent whether or not the customer consented to marketing messages.

#### Scenario: Sale marks no-show
- **WHEN** a sale marks a viewing as "không đến" and the customer has an email
- **THEN** the customer receives one email naming the property and linking to the booking page for it
- **AND** the lead history records that the invitation was sent

#### Scenario: Customer without email
- **WHEN** the customer has no email
- **THEN** nothing is sent and the lead history notes that no invitation could be sent

### Requirement: The invitation is not sent when it makes no sense
The system SHALL NOT send the invitation if the lead is `LOST`, if the customer already has another open viewing, or if an invitation was already sent for that viewing.

#### Scenario: Customer already booked another time
- **WHEN** the customer has a newer open viewing when the invitation is due
- **THEN** no email is sent

#### Scenario: Marked twice
- **WHEN** the same viewing is marked no-show a second time
- **THEN** no second invitation is sent
