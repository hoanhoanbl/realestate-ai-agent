# bot-lead-capture Specification

## Purpose

Defines how the Telegram bot turns a customer who leaves contact details into a lead that a sale follows up, without requiring a viewing booking.

## Requirements

### Requirement: Bot saves a contact after the customer confirms
The bot SHALL save a customer's contact as a lead only after it has collected a name and a phone number, repeated them back, and received a clear confirmation in the customer's latest message. It SHALL NOT ask for or store an email, a budget or marketing consent in this step.

#### Scenario: Customer asks to be called
- **WHEN** a customer writes "gọi lại cho tôi nhé", gives name "Bình" and phone "0901 234 567", and confirms the bot's summary
- **THEN** a lead exists for that phone with source `telegram` and marketing consent false
- **AND** the bot tells the customer that staff will contact them

#### Scenario: Customer has not confirmed
- **WHEN** the customer gave a name and phone but has not answered the bot's confirmation question
- **THEN** no lead is created

### Requirement: Duplicates reuse the existing lead
A contact whose normalized phone matches an existing lead SHALL NOT create a second lead and SHALL NOT overwrite that lead's name, email, source, consent or assigned sale.

#### Scenario: Known customer leaves the number again
- **WHEN** a customer whose phone already belongs to lead 12 (assigned to sale An) confirms a contact
- **THEN** lead 12 is reused and still assigned to An
- **AND** the bot does not tell the customer they are a duplicate

### Requirement: Invalid input is refused and re-asked
A phone number that does not normalize to 8–15 digits SHALL NOT create a lead. The bot SHALL tell the customer the number looks wrong and ask again, and SHALL NOT call the save tool again with the same value.

#### Scenario: Typo in the phone
- **WHEN** the customer gives "09012" and confirms
- **THEN** no lead is created and the bot asks for the number again

### Requirement: The assigned sale is notified
After a contact is saved or matched, the system SHALL notify the lead's assigned sale through the staff-notification routing (the assigned sale only; the manager when there is no assignee). A newly created or reopened lead SHALL be titled as a new customer; a lead that already existed SHALL be titled as a returning customer. The alert SHALL name the customer, the Telegram username when known, and link to the lead.

#### Scenario: New customer
- **WHEN** a contact creates lead 30 assigned to sale An
- **THEN** An receives one alert "Khách Telegram để lại số" with a link to lead 30
- **AND** nobody else is alerted

#### Scenario: Returning customer
- **WHEN** a contact matches existing lead 12 assigned to sale An
- **THEN** An receives one alert "Khách cũ nhắn lại" for lead 12

#### Scenario: Save failed
- **WHEN** the save call fails
- **THEN** no staff alert is sent and the bot tells the customer it could not save the number and to try again

### Requirement: Bot never invents or reveals customer data
The bot SHALL only save values the customer wrote in this conversation, and SHALL NOT state another customer's name, phone or lead status when a duplicate is found.

#### Scenario: Matching phone belongs to someone else
- **WHEN** a customer gives a phone that matches an existing lead with a different name
- **THEN** the bot confirms only that the request was received and does not reveal the existing name
