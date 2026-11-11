# Spec Delta

## Purpose

Lets staff record customers who reached them outside the website and the bot, so every customer is in the system with a source and an owner, and the same person is never entered twice.

## ADDED Requirements

### Requirement: Add customer page
Web admin SHALL offer a "Thêm khách" page, opened from a button on the customer list, to every logged-in staff member. Users who are not logged in SHALL be sent to the login page.

#### Scenario: Sale opens the form
- **WHEN** a logged-in sale clicks "Thêm khách" on the customer list
- **THEN** the add customer form opens

### Requirement: Required and optional fields
The form SHALL require source, name and phone. Source SHALL be one of: hotline, sign on the property, walk-in, sale's personal Zalo, referral, other. Email, budget (whole VND, 0 or more), interested properties (several allowed), note and the marketing consent checkbox (unticked by default) SHALL be optional. Invalid input SHALL be reported next to the field before sending.

#### Scenario: Missing phone
- **WHEN** staff submit without a phone number
- **THEN** the form shows that the phone number is required and sends nothing

#### Scenario: Customer without email or budget
- **WHEN** staff fill only source, name and phone and submit
- **THEN** the customer is saved with empty email and budget

### Requirement: Duplicate warning while typing
When the phone field holds a plausible number (8 to 15 digits after removing spaces, dots, dashes, brackets, and `+84` read as `0`), the page SHALL look the number up and, if a customer exists, show their name, status and owner with a link to that lead, and SHALL NOT allow saving. Editing the number SHALL clear the warning until the next lookup.

#### Scenario: Number already exists in another format
- **WHEN** staff type `+84 905 123 456` and lead #42 has `0905123456`
- **THEN** the page shows "Số này đã có: lead #42 …, đang do … phụ trách" with a link to lead #42, and the save button is disabled

#### Scenario: New number
- **WHEN** staff type a number no customer has
- **THEN** no warning is shown and saving is allowed

### Requirement: Duplicate detected at save time
If the server rejects the save because the number was taken meanwhile, the page SHALL show the server message and the link to the existing lead, and keep the entered data.

#### Scenario: Another staff saved the same number first
- **WHEN** two staff enter the same new number and the other one saves first
- **THEN** this staff member sees the 409 message with a link to the existing lead and their form data is kept

### Requirement: Owner of the new customer
The owner SHALL default to the person entering, if that person is accepting customers or is a manager. The owner list SHALL contain staff who are accepting customers and managers. If the person entering is not accepting customers, the owner SHALL be required to be chosen.

#### Scenario: Sale enters a walk-in customer
- **WHEN** sale An enters a customer and keeps the default owner
- **THEN** the customer is saved with An as owner

#### Scenario: Sale who stopped accepting customers
- **WHEN** a sale whose "Đang nhận khách" is off opens the form
- **THEN** the owner field is empty and must be chosen before saving

### Requirement: After saving
After a successful save the page SHALL open the new lead's detail page.

#### Scenario: Save succeeds
- **WHEN** the server returns the created lead #57
- **THEN** the browser goes to `/admin/leads/57`

### Requirement: Usable on a phone
The page SHALL follow `docs/giao-dien-web.md`: no horizontal scroll at 375px width, touch targets at least 44px high, inputs at 16px text on phones, status not shown by colour alone.

#### Scenario: Phone width
- **WHEN** the page is opened at 375px width
- **THEN** there is no horizontal page scroll and every button and input is at least 44px high
