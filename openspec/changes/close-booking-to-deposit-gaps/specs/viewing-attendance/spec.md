## ADDED Requirements

### Requirement: Viewing outcome is recorded on the viewing
The system SHALL store the outcome of each viewing in `viewings.status` with one of `NEW`, `ATTENDED`, `NO_SHOW`, `CANCELLED`. The system SHALL keep exactly one viewing row per lead.

#### Scenario: New booking starts as NEW
- **WHEN** a customer books a viewing
- **THEN** the viewing is stored with status `NEW`

#### Scenario: Lost lead cancels its pending viewing
- **WHEN** staff mark a lead `LOST` while its viewing is `NEW`
- **THEN** the viewing status becomes `CANCELLED`

### Requirement: Staff confirm attendance
The system SHALL let authenticated staff record that a `CONFIRMED` customer attended or did not attend a `NEW` viewing.
- Attended: the viewing becomes `ATTENDED` and the lead becomes `VIEWED`.
- No-show: staff choose between "close", which makes the viewing `NO_SHOW`, makes the lead `LOST` with `lost_reason = NO_SHOW`, and logs `VIEWING_NO_SHOW`; and "reschedule", which logs `VIEWING_NO_SHOW` and `VIEWING_RESCHEDULED`, moves the same viewing to the new time with status `NEW`, keeps the lead `CONFIRMED`, and emails the customer the new time.

#### Scenario: Customer attended
- **WHEN** staff record outcome `ATTENDED` for a `CONFIRMED` lead after the viewing has started
- **THEN** the viewing is `ATTENDED`, the lead is `VIEWED`, and a `STATUS_CHANGED` event names the staff member

#### Scenario: No-show closed
- **WHEN** staff record outcome `NO_SHOW` with next step `CLOSE`
- **THEN** the viewing is `NO_SHOW`, the lead is `LOST` with `lost_reason = NO_SHOW`, and a `VIEWING_NO_SHOW` event is logged

#### Scenario: No-show rescheduled
- **WHEN** staff record outcome `NO_SHOW` with next step `RESCHEDULE` and a future time that does not conflict
- **THEN** the same viewing row has the new time and status `NEW`, the lead stays `CONFIRMED`, `VIEWING_NO_SHOW` and `VIEWING_RESCHEDULED` events are logged, and the customer receives an email with the new time

#### Scenario: Wrong lead state
- **WHEN** staff record attendance for a lead that is not `CONFIRMED`, or a viewing that is not `NEW`
- **THEN** the request is rejected with 400 and nothing changes

### Requirement: Attendance cannot be recorded before the viewing
The system MUST reject an attendance outcome while the current time is more than 30 minutes before the viewing time. The same rule applies when `VIEWED` is set through `PUT /leads/:id/admin-status`.

#### Scenario: Too early
- **WHEN** staff try to mark a customer as attended 2 hours before the viewing time
- **THEN** the request is rejected with 400 "Chưa đến giờ hẹn" and nothing changes

#### Scenario: Within the grace window
- **WHEN** staff mark a customer as attended 20 minutes before the viewing time
- **THEN** the outcome is recorded

#### Scenario: Buttons hidden before the viewing
- **WHEN** staff open the lead page of a `CONFIRMED` customer whose viewing is more than 30 minutes away
- **THEN** the "Đã xem nhà" and "Khách không đến" buttons are not shown and the page says the viewing has not started yet

### Requirement: Lost leads carry a reason
The system SHALL store `leads.lost_reason` as one of `NO_SHOW`, `NOT_INTERESTED`, `CUSTOMER_CANCELLED`, `OTHER` whenever a lead becomes `LOST` through staff or customer actions. The lead status values SHALL remain the existing six.

#### Scenario: Generic lost button
- **WHEN** staff press "Mất khách" without choosing a reason
- **THEN** the lead is `LOST` with `lost_reason = OTHER`

#### Scenario: Reason shown to staff
- **WHEN** staff open the page of a `LOST` lead
- **THEN** the page shows the lost reason in Vietnamese

### Requirement: Flow 2 never infers attendance
Flow 2 MUST NOT change a lead's status to `VIEWED`. For a `CONFIRMED` lead whose `NEW` viewing ended more than 2 hours ago, flow 2 SHALL notify staff once (`ATTENDANCE_CHECK_SENT`) with a link to the lead page. If the viewing is still unconfirmed 24 hours after that notice, flow 2 SHALL email the manager once (`ATTENDANCE_ESCALATED`). Both "once" rules reset after a reschedule.

#### Scenario: Staff forgot to confirm
- **WHEN** flow 2 runs and a `CONFIRMED` lead's viewing ended 3 hours ago with status `NEW`
- **THEN** staff receive an attendance-check notification, `ATTENDANCE_CHECK_SENT` is logged, and the lead stays `CONFIRMED`

#### Scenario: Still unconfirmed a day later
- **WHEN** flow 2 runs and `ATTENDANCE_CHECK_SENT` was logged more than 24 hours ago and the viewing is still `NEW`
- **THEN** the manager receives an escalation email and `ATTENDANCE_ESCALATED` is logged

#### Scenario: Feedback only after attendance
- **WHEN** flow 2 looks for feedback candidates
- **THEN** it selects only leads with status `VIEWED` and viewing status `ATTENDED` whose viewing ended more than 2 hours ago

### Requirement: Reminder follows the current viewing time
Flow 2 SHALL send a reminder for a `CONFIRMED` lead with a `NEW` viewing in the next 24 hours, unless a `REMINDER_SENT` event exists after the latest `VIEWING_RESCHEDULED` event of that lead.

#### Scenario: Rescheduled after reminder
- **WHEN** a customer was reminded, then staff moved the viewing to a new time within the next 24 hours
- **THEN** flow 2 sends a new reminder for the new time

#### Scenario: Not rescheduled
- **WHEN** a reminder was already sent and the viewing time has not changed
- **THEN** flow 2 sends no further reminder

### Requirement: Reports separate no-shows
The admin funnel and the weekly report (flow 4) SHALL show the number of no-shows, counted from `VIEWING_NO_SHOW` events, separately from other lost customers.

#### Scenario: Weekly report
- **WHEN** flow 4 builds the weekly report for a week with two `VIEWING_NO_SHOW` events
- **THEN** the report shows 2 no-shows for that week

#### Scenario: Overview funnel
- **WHEN** staff open the admin overview
- **THEN** the funnel response includes a `noShow` count
