# Spec Delta

## Purpose

Lets staff see what a customer asked the Telegram bot, on the customer's lead, without opening n8n.

## ADDED Requirements

### Requirement: Chats are linked to the lead when a contact is saved
When a lead is created, reopened or matched by a call that carries a Telegram chat id, the system SHALL link every earlier bot log of that chat that is not yet linked to that lead. Logs already linked to another lead SHALL stay with that lead.

#### Scenario: History before the number
- **WHEN** a chat has 6 logs and then the customer leaves a number that creates lead 30
- **THEN** the 6 logs belong to lead 30

#### Scenario: Chat already linked elsewhere
- **WHEN** a chat's earlier logs are linked to lead 12 and a new contact in the same chat creates lead 30
- **THEN** the earlier logs stay on lead 12 and only logs written afterwards belong to lead 30

### Requirement: Later messages follow the lead
A bot log written for a chat that has a linked lead SHALL be linked to the lead that the chat's most recent linked log belongs to, without the caller naming the lead.

#### Scenario: Conversation continues
- **WHEN** a chat linked to lead 30 produces another log
- **THEN** that log belongs to lead 30

#### Scenario: Chat never linked
- **WHEN** a chat has no linked lead
- **THEN** its logs stay unlinked and are not visible on any lead

### Requirement: Only trusted callers can link a chat
A chat id SHALL be accepted for linking only on calls that carry the webhook secret. A public booking or contact call without the secret SHALL ignore the field.

#### Scenario: Public form sends a chat id
- **WHEN** a request to the public booking endpoint without the secret includes a chat id
- **THEN** the booking is processed and no chat is linked

### Requirement: Staff can read the chat of a lead
Logged-in staff SHALL be able to read the logs linked to a lead, oldest first, showing time, route, the customer's text, the bot's reply and whether staff were called in. The texts SHALL be the already-masked texts (email and long numbers replaced), and no chat id or n8n execution id SHALL be returned. Access SHALL require login.

#### Scenario: Lead with a chat
- **WHEN** a staff member opens lead 30 whose chat has 7 logs
- **THEN** the page shows a "Lịch sử chat Telegram" section with the 7 exchanges in order

#### Scenario: Lead without a chat
- **WHEN** a staff member opens a lead that came from the web form
- **THEN** no chat section is shown

#### Scenario: Not logged in
- **WHEN** a request for a lead's chat has no valid login
- **THEN** it is rejected with 401 and returns nothing
