## ADDED Requirements

### Requirement: Property status lifecycle
The system SHALL support property statuses `AVAILABLE`, `RESERVED`, `SOLD` and `HIDDEN`. `RESERVED` SHALL only be set by the system. Managers SHALL be able to set `AVAILABLE`, `HIDDEN` and `SOLD`, subject to the rules below.

#### Scenario: Manual reserve rejected
- **WHEN** a manager sends `PUT /properties/:id` with status `RESERVED`
- **THEN** the request is rejected with 400

#### Scenario: Unhide blocked by active contract
- **WHEN** a manager sets a property to `AVAILABLE` or `HIDDEN` while it has an active contract
- **THEN** the request is rejected with 409 and the status is unchanged

### Requirement: One active contract per property
The system MUST NOT allow more than one contract with status `DRAFTING`, `PENDING_APPROVAL`, `SENT` or `SIGNED` for the same property. The rule SHALL be enforced in the contract service and by a partial unique index in the database.

#### Scenario: Second contract on the same property
- **WHEN** staff create a contract for a property that already has a `SENT` contract for another customer
- **THEN** the request is rejected with 409 naming the existing contract and customer, and no contract is created

#### Scenario: Concurrent creation
- **WHEN** two staff members create contracts for the same property at the same moment
- **THEN** exactly one contract is created and the other request receives 409

#### Scenario: After rejection
- **WHEN** the only contract on a property is `REJECTED` or `EXPIRED`
- **THEN** staff can create a new contract for that property

### Requirement: Contracts reserve and release the property
Creating a contract SHALL set the property to `RESERVED` in the same transaction and log `PROPERTY_RESERVED`. When a contract becomes `REJECTED` or `EXPIRED`, the system SHALL set the property back to `AVAILABLE` if it is still `RESERVED` and has no other active contract.

#### Scenario: Contract created
- **WHEN** staff create a contract for an `AVAILABLE` property
- **THEN** the property becomes `RESERVED`

#### Scenario: Contract expired
- **WHEN** flow 3 marks the contract `EXPIRED`
- **THEN** the property returns to `AVAILABLE` and the lead returns to `VIEWED`

#### Scenario: Hidden meanwhile
- **WHEN** a contract is rejected but the property was changed to something other than `RESERVED`
- **THEN** the property status is left unchanged

### Requirement: Reserved properties stop taking bookings
The public site SHALL list `RESERVED` properties with the label "Đã có người đặt cọc" and SHALL NOT show the booking form for them. `SOLD` and `HIDDEN` properties SHALL NOT be listed. The booking API SHALL reject bookings for any property that is not `AVAILABLE`.

#### Scenario: Booking a reserved property
- **WHEN** a customer or the Telegram agent submits a booking for a `RESERVED` property
- **THEN** the request is rejected with 400 "Căn nhà này hiện không nhận đặt lịch xem"

#### Scenario: Public detail page
- **WHEN** a customer opens a `RESERVED` property page
- **THEN** the page shows the reserved label instead of the booking form

### Requirement: Existing bookings on a reserved property are kept as backups
When a property becomes `RESERVED`, other leads with status `NEW` or `CONFIRMED` and a `NEW` viewing of that property SHALL keep their booking. They SHALL appear in the admin task group "Khách có lịch xem căn đã có người cọc".

#### Scenario: Backup customer listed
- **WHEN** a contract reserves a property that another `CONFIRMED` customer is booked to view
- **THEN** that customer's booking is unchanged and the customer appears in the backup task group

### Requirement: Deposit received and sold
A manager SHALL be able to record "Đã nhận tiền cọc" on a `SIGNED` contract. This stores `deposit_received_at` and `deposit_received_by` and logs `DEPOSIT_RECEIVED`. A manager SHALL be able to mark a `RESERVED` property `SOLD` only when it has a `SIGNED` contract, logging `PROPERTY_SOLD`.

#### Scenario: Deposit received
- **WHEN** a manager records deposit received on a `SIGNED` contract
- **THEN** the contract shows the date and the manager's name

#### Scenario: Deposit on unsigned contract
- **WHEN** a manager records deposit received on a `SENT` contract
- **THEN** the request is rejected with 400

#### Scenario: Mark sold
- **WHEN** a manager marks a `RESERVED` property with a `SIGNED` contract as sold
- **THEN** the property becomes `SOLD` and disappears from the public listing

### Requirement: Deposit status labels
The web SHALL label lead status `DEPOSIT` as "Đang làm hợp đồng cọc" and `SIGNED` as "Đã ký hợp đồng cọc".

#### Scenario: Lead list labels
- **WHEN** staff view a lead with status `DEPOSIT`
- **THEN** the status badge reads "Đang làm hợp đồng cọc"
