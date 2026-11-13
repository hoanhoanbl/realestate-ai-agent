# Spec Delta

## Purpose

Lets a manager see, for each sale, how many customers they hold at each stage, which need attention, and what they achieved over a period, and open the exact customers behind any number.

## ADDED Requirements

### Requirement: Team page is manager only
Web admin SHALL offer a "Đội sale" page, linked from the QUẢN LÝ group of the sidebar between "Báo cáo" and "Quản lý nhà". The link SHALL be shown to managers only. A sale who opens the page address SHALL see a "no permission" message and no numbers. Users who are not logged in SHALL be sent to the login page.

#### Scenario: Manager opens the page
- **WHEN** a logged-in manager clicks "Đội sale" in the sidebar
- **THEN** the team page opens with the "Hiện tại" period selected

#### Scenario: Sale cannot see the page
- **WHEN** a logged-in sale opens `/admin/doi-sale`
- **THEN** the page shows that only managers can view it, and the sidebar has no "Đội sale" item

### Requirement: Team statistics API is manager only
`GET /api/stats/team` SHALL require a valid login with the MANAGER role. Without a login it SHALL return 401; for a sale it SHALL return 403. `period` SHALL be one of `now`, `week`, `month` (default `now`); any other value SHALL return 400.

#### Scenario: Sale calls the API
- **WHEN** a logged-in sale requests `GET /api/stats/team`
- **THEN** the response is 403 and contains no numbers

#### Scenario: Invalid period
- **WHEN** a manager requests `GET /api/stats/team?period=year`
- **THEN** the response is 400

### Requirement: One row per owner
The page SHALL show one row for every SALE account, including sales who are not accepting customers or hold no customers, ordered by name. Below them, in a group labelled "Ngoài đội sale", it SHALL show one row per MANAGER account that holds customers and one "Chưa phân công" row when customers have no owner. Each sale row SHALL show whether the sale is accepting customers in words, not only by color.

#### Scenario: Sale paused
- **WHEN** a sale has "Đang nhận khách" turned off and holds 4 open customers
- **THEN** their row shows "Tạm ngừng" and still shows the 4 customers

#### Scenario: Sale with no customers
- **WHEN** a sale holds no customers
- **THEN** their row is shown with zeros

### Requirement: Current workload
In the "Hiện tại" period each row SHALL count the owner's open customers (status Đang tư vấn, Mới chờ duyệt, Đã chốt lịch, Đã xem nhà, Đang làm hợp đồng cọc) per status and in total, as of the moment of the request. Signed and lost customers SHALL NOT be counted in this period.

#### Scenario: Mixed statuses
- **WHEN** Hà holds 3 Đang tư vấn, 1 Đã xem nhà, 2 Đã ký and 1 Không mua customers
- **THEN** her row shows 3 under Đang tư vấn, 1 under Đã xem nhà and 4 as total open

### Requirement: Attention flags
In the "Hiện tại" period each row SHALL show, in words with a count, (a) open customers whose first-response deadline has passed with no first response ("trễ phản hồi"), and (b) open customers with no recorded activity for more than 7 days ("im quá 7 ngày"). Activity is any timeline event on the customer, or the assignment itself. A row with neither SHALL show no flag.

#### Scenario: Overdue first response
- **WHEN** a customer assigned to Phúc is past its response deadline and nobody has noted or acted on it
- **THEN** Phúc's row shows "1 trễ phản hồi"

#### Scenario: Quiet customer
- **WHEN** an open customer of Huy has had no timeline event for 9 days
- **THEN** Huy's row shows "1 im quá 7 ngày"

#### Scenario: Recent note clears quiet flag
- **WHEN** Huy adds a note to that customer
- **THEN** the next load no longer counts it as quiet

### Requirement: Results over a period
In the "Tuần này" and "Tháng này" periods each row SHALL show, for the current owner of each customer: customers assigned to them within the period, customers with a viewing marked attended within the period, deposit contracts signed within the period, customers marked lost within the period, and signed ÷ assigned as a percentage (shown as "—" when assigned is 0). "Tuần này" SHALL start Monday 00:00 and "Tháng này" the 1st 00:00, both in Vietnam time, and end at the time of the request.

#### Scenario: Weekly results
- **WHEN** this week Bảo was assigned 3 new customers, one of them attended a viewing and two older customers were marked lost
- **THEN** with "Tuần này" selected his row shows 3 assigned, 1 attended, 0 signed, 2 lost and 0%

#### Scenario: Week boundary
- **WHEN** a customer was assigned on Sunday 23:30 Vietnam time and the manager looks on Monday
- **THEN** that customer is not counted in "Tuần này"

### Requirement: Team totals
Above the table the page SHALL show summary cards for the selected period: in "Hiện tại", total open customers, overdue first responses, quiet customers, and sales accepting customers out of all sales; in "Tuần này"/"Tháng này", totals of assigned, attended, signed and lost.

#### Scenario: Switching period updates totals
- **WHEN** the manager switches from "Hiện tại" to "Tháng này"
- **THEN** the cards and the table columns change to the monthly results without leaving the page

### Requirement: Drill down to customers
Every sale name, every non-zero number and every attention flag SHALL be a link to the customer list filtered to that owner, and to the matching status when the number belongs to one status. Zero values SHALL NOT be links. The selected period SHALL be kept in the page address so it survives reload and can be shared.

#### Scenario: Lost customers of one sale
- **WHEN** the manager clicks Bảo's number under "Không mua"
- **THEN** the customer list opens with owner Bảo and status Không mua selected

#### Scenario: Reload keeps period
- **WHEN** the manager selects "Tuần này" and reloads the page
- **THEN** "Tuần này" is still selected

### Requirement: Owner filter on the customer list
For managers the customer list SHALL offer a "Phụ trách" select next to the status select, listing "Mọi người phụ trách", "Chưa phân công", every manager and every sale. It SHALL combine with the status select, the level chips and search, and the chip counts SHALL reflect it. The selection SHALL be read from and written to the address (`assignee=<id>` or `assignee=none`). Sales SHALL NOT see the select.

#### Scenario: Filter by owner and status
- **WHEN** the manager selects owner "Trần Thu Hà" and status "Đã ký hợp đồng cọc"
- **THEN** only Hà's signed customers are listed and the "Tất cả" chip shows their count

#### Scenario: Opened from a link
- **WHEN** the manager opens `/admin/leads?assignee=5&status=LOST`
- **THEN** the owner select shows sale 5, the status select shows Không mua, and the list matches

#### Scenario: Unassigned customers
- **WHEN** the manager selects "Chưa phân công"
- **THEN** only customers without an owner are listed

### Requirement: Owner name on a card filters the list
For managers the owner name shown on each customer card SHALL be a link that applies the owner filter for that person, without opening the customer.

#### Scenario: Click owner on card
- **WHEN** the manager clicks "Võ Hoàng Long" on a customer card
- **THEN** the list shows only Long's customers and the owner select shows Long

### Requirement: Usable on a phone
At 375px wide the team page SHALL show each owner as a card instead of a table, with no horizontal page scroll, and every link and the period switch SHALL be at least 44px tall. Loading SHALL show a placeholder of the same shape, and a failed load SHALL show an error message with a retry action.

#### Scenario: Phone width
- **WHEN** the manager opens the team page on a 375px wide screen
- **THEN** each sale appears as a card with the same numbers and links, and the page does not scroll sideways

#### Scenario: Load fails
- **WHEN** the API call fails
- **THEN** the page shows an error message and a "Thử lại" button instead of an empty table
