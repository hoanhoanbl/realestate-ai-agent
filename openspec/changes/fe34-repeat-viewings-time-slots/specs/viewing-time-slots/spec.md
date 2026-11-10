# Spec Delta

## Purpose

Defines which times a property viewing can be booked or moved to, and the slot list customers see, so that customers only pick times staff can actually serve and never learn about a taken slot only after submitting.

## ADDED Requirements

### Requirement: Viewing hours
Every viewing time, whoever sets it, SHALL fall between 08:00 and 19:00 Vietnam time (UTC+7), both ends included. A time outside this range SHALL be rejected with HTTP 400 and a message naming the allowed hours.

#### Scenario: Booking at night is rejected
- **WHEN** a customer submits a booking for 03:00 Vietnam time
- **THEN** the API returns 400 with a message saying viewings are between 08:00 and 19:00
- **AND** no lead, viewing or event is saved

#### Scenario: Last slot is accepted
- **WHEN** a customer books 19:00 on a valid day with the slot free
- **THEN** the booking is accepted

### Requirement: Customer bookings are on the hour
A booking made through the public booking endpoint (web form or bot) SHALL use a time on the full hour (minutes and seconds zero). Other times SHALL be rejected with 400.

#### Scenario: Half-hour time from the bot
- **WHEN** the bot books 10:30 for a customer
- **THEN** the API returns 400 with a message saying viewings start on the hour

### Requirement: Earliest bookable slot
A customer booking SHALL be at or after the earliest slot: take now, add 3 hours counted only within working hours 08:00–21:00 Vietnam time, round up to the next full hour; if that is after 19:00, use 08:00 the next day. Earlier times SHALL be rejected with 400 naming the earliest slot.

#### Scenario: Morning request
- **WHEN** a customer books at 09:00
- **THEN** the earliest slot is 12:00 the same day

#### Scenario: Mid-afternoon request rounds up
- **WHEN** a customer books at 15:30
- **THEN** the earliest slot is 19:00 the same day

#### Scenario: Late afternoon request moves to next morning
- **WHEN** a customer books at 17:00
- **THEN** the earliest slot is 08:00 the next day

#### Scenario: Night request counts from opening time
- **WHEN** a customer books at 22:00, or at 02:00 the following night
- **THEN** the earliest slot is 11:00 on the coming morning

#### Scenario: Too-early time is rejected
- **WHEN** at 09:00 a customer submits a booking for 11:00 the same day
- **THEN** the API returns 400 and the message names 12:00 as the earliest slot

### Requirement: Latest bookable slot
A customer booking SHALL be no later than 14 days after now. Later times SHALL be rejected with 400.

#### Scenario: Three weeks ahead
- **WHEN** a customer books a slot 21 days from now
- **THEN** the API returns 400 with a message saying bookings are open up to 14 days ahead

### Requirement: Staff time rules
When staff move a viewing (reschedule, or no-show then reschedule), the new time SHALL be in the future and within viewing hours. The on-the-hour, earliest-slot and 14-day rules SHALL NOT apply to staff.

#### Scenario: Staff reschedules one hour ahead
- **WHEN** at 14:00 a staff member moves a viewing to 15:30 the same day with no conflict
- **THEN** the change is accepted

#### Scenario: Staff reschedules outside hours
- **WHEN** a staff member moves a viewing to 20:00
- **THEN** the API returns 400 with the viewing-hours message

### Requirement: Same-property gap still applies
Two open viewings of the same property SHALL stay at least 60 minutes apart for every way a time is set (customer, bot, staff). A conflicting time SHALL be rejected with 409 as today.

#### Scenario: Adjacent hour slots are both bookable
- **WHEN** a property has an open viewing at 09:00 and a customer books 10:00
- **THEN** the booking is accepted

#### Scenario: Same slot is taken
- **WHEN** a property has an open viewing at 09:00 and a customer books 09:00
- **THEN** the API returns 409 with the existing "Khung giờ này đã có khách hẹn" message

### Requirement: Public slot list
The system SHALL provide a public endpoint that, for one bookable property, lists every hourly slot from the earliest slot to 14 days ahead, grouped by day, each marked available or taken. It SHALL NOT return any customer data. A property that does not accept bookings SHALL return 400.

#### Scenario: Taken slot shown
- **WHEN** a property has an open viewing at 09:00 tomorrow and the slot list is requested
- **THEN** tomorrow's 09:00 slot is marked taken and 10:00 is available
- **AND** the response contains only dates, times and availability

#### Scenario: Slots before the earliest slot are left out
- **WHEN** the list is requested at 09:00
- **THEN** today's list starts at 12:00

#### Scenario: Unavailable property
- **WHEN** the slot list is requested for a property that is reserved, sold or hidden
- **THEN** the API returns 400 with "Căn nhà này hiện không nhận đặt lịch xem"

### Requirement: Booking form slot picker
The public booking form SHALL let the customer choose a day and then an hourly slot from the slot list, show taken slots as not selectable, and not offer a free date-time input. If the submit is still rejected (slot taken meanwhile), the form SHALL show the message and refresh the slot list.

#### Scenario: Customer sees a taken slot before submitting
- **WHEN** a customer opens the form for a property with 09:00 tomorrow taken
- **THEN** that slot is shown as unavailable and cannot be selected

#### Scenario: Slot taken between loading and submitting
- **WHEN** another customer books the chosen slot just before this customer submits
- **THEN** the form shows the 409 message and reloads the slot list

### Requirement: Bot follows the same slot rules
The Telegram bot SHALL book only through the public booking endpoint, so the same customer rules apply, and SHALL pass the backend's rejection message to the customer.

#### Scenario: Bot asks for a late-night time
- **WHEN** a customer asks the bot for 22:00 tomorrow
- **THEN** the booking is rejected with the viewing-hours message and the bot tells the customer the allowed hours
