## ADDED Requirements

### Requirement: No double booking of a property
The system MUST reject a new booking or a reschedule when another viewing of the same property has status `NEW`, belongs to a lead with status `NEW` or `CONFIRMED`, and is less than 60 minutes away from the requested time. The check and the write SHALL run in one transaction serialized per property.

#### Scenario: Conflicting booking
- **WHEN** a customer books property 3 at 10:00 and another pending booking of property 3 exists at 10:30
- **THEN** the request is rejected with 409 "Khung giờ này đã có khách hẹn xem căn này" and no lead or viewing is created

#### Scenario: Different property
- **WHEN** a customer books property 3 at 10:00 and a pending booking exists for property 4 at 10:00
- **THEN** the booking succeeds

#### Scenario: Old booking no longer pending
- **WHEN** the other booking at 10:30 belongs to a `LOST` lead or its viewing is `CANCELLED`
- **THEN** the new booking succeeds

#### Scenario: Conflicting reschedule
- **WHEN** staff move a viewing to a time within 60 minutes of another pending viewing of the same property
- **THEN** the request is rejected with 409 and the viewing time is unchanged

### Requirement: No duplicate pending booking per customer and property
The system MUST reject a booking when a lead with the same email (case-insensitive) already has a `NEW` viewing of the same property and its status is `NEW` or `CONFIRMED`.

#### Scenario: Customer submits twice
- **WHEN** a customer submits the booking form twice for the same property with the same email
- **THEN** the second request is rejected with 409 stating the existing viewing time

#### Scenario: Same customer, other property
- **WHEN** the same email books a different property
- **THEN** the booking succeeds as a new lead

### Requirement: Staff see a customer's earlier bookings
`GET /leads/:id` SHALL include `otherBookings`: the other leads with the same email (case-insensitive), each with id, status, created time, property name and viewing time. The admin lead page SHALL show them with links.

#### Scenario: Returning customer
- **WHEN** staff open a lead whose email has two earlier leads
- **THEN** the page shows "Khách này đã đặt 2 lần khác" with links to both leads

### Requirement: Booking endpoint is rate limited
`POST /viewings` SHALL accept at most `BOOKING_RATE_LIMIT` requests (default 5) per `BOOKING_RATE_TTL_MS` (default 10 minutes) per client IP. Above the limit it SHALL return 429. Requests carrying a valid `X-Webhook-Secret` SHALL be exempt. The client IP SHALL be taken from the forwarded chain according to `TRUST_PROXY_HOPS`.

#### Scenario: Flooding from one IP
- **WHEN** one IP sends 6 booking requests within 10 minutes
- **THEN** the 6th request receives 429 and creates nothing

#### Scenario: Telegram agent
- **WHEN** flow 6 sends 10 bookings within 10 minutes with a valid `X-Webhook-Secret`
- **THEN** none of them is rate limited

#### Scenario: Web form shows limit message
- **WHEN** the booking form receives 429
- **THEN** the form shows "Bạn gửi quá nhiều lần, vui lòng thử lại sau ít phút"

### Requirement: Honeypot rejects automated submissions
The booking form SHALL include a hidden field `website`. The API MUST reject any booking whose `website` value is non-empty, with 400 and without saving.

#### Scenario: Bot fills hidden field
- **WHEN** a booking arrives with `website` set to any non-empty value
- **THEN** the request is rejected with 400 and no lead is created

### Requirement: Booking errors reach the customer
The web booking form and the Telegram agent (flow 6) SHALL show the backend's 409 message to the customer so they can choose another time.

#### Scenario: Agent relays conflict
- **WHEN** the Telegram agent's booking call returns 409 for a time conflict
- **THEN** the agent tells the customer the slot is taken and asks for another time
