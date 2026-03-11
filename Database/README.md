# Urbanity — Database Design (ER Model)

A normalized database design for **Urbanity**, a civic complaint management platform that enables citizens to report local issues and allows government departments to track, assign, and resolve them efficiently.

## Overview

Urbanity follows a **complaint-driven workflow** where citizens submit complaints about civic issues and government departments manage them through assignment, resolution, and feedback.

The platform tracks the lifecycle of a complaint from:

**Complaint Submission → Department Handling → Worker Assignment → Progress Updates → Resolution → Feedback**

The schema is normalized to **Third Normal Form (3NF)** and supports:

* Role-based user management
* Administrative geographic hierarchy
* Departmental complaint handling
* Worker assignment and progress tracking
* Complaint attachments and community supports
* Citizen feedback after resolution

---

# Entities

The system consists of the following core entities:

**Core Administrative Entities**

* **ROLES**
* **DEPARTMENTS**
* **CITIES**
* **AREAS**
* **OFFICES**
* **USERS**

**Complaint Management Entities**

* **COMPLAINTS**
* **COMPLAINT_ASSIGNMENTS**
* **COMPLAINT_UPDATES**
* **ATTACHMENTS**
* **COMPLAINT_SUPPORTS**
* **FEEDBACK**

Attributes and constraints for these entities are defined in the **ER Diagram**.

---

# Relationships

Key relationships in the system include:

* **ROLES** define the type of **USERS**
* **DEPARTMENTS** operate through **OFFICES**
* **CITIES** contain multiple **AREAS**
* **AREAS** contain multiple **OFFICES**
* **OFFICES** manage employees (users with officer/worker roles)

Complaint workflow relationships:

* **USERS (Citizens)** create **COMPLAINTS**
* **COMPLAINTS** are handled by **DEPARTMENTS**
* **COMPLAINTS** are processed through **OFFICES**
* **COMPLAINTS** occur within a specific **AREA**
* **DEPARTMENT OFFICERS** assign **FIELD WORKERS** to complaints
* **FIELD WORKERS** provide **COMPLAINT_UPDATES**
* **USERS** can upload **ATTACHMENTS**
* **USERS** can support complaints through **COMPLAINT_SUPPORTS**
* Citizens can leave **FEEDBACK** after resolution

---

# Normalization

The Urbanity database is normalized up to **Third Normal Form (3NF)** to reduce redundancy and ensure data integrity.

---

## First Normal Form (1NF)

Initially, complaint records could contain repeating attributes such as:

* Multiple assigned workers
* Multiple complaint updates
* Multiple attachments
* Multiple user supports

Example conceptual structure:

```
COMPLAINT_SYSTEM(
complaint_id,
citizen_name,
department_name,
office_name,
area_name,
worker_ids,
update_messages,
attachment_urls,
support_user_ids
)
```

These repeating groups violate atomicity.

To achieve **1NF**, repeating attributes were decomposed into separate relations:

* **COMPLAINT_ASSIGNMENTS**
* **COMPLAINT_UPDATES**
* **ATTACHMENTS**
* **COMPLAINT_SUPPORTS**

Each attribute now stores **only one atomic value**.

---

## Second Normal Form (2NF)

2NF removes **partial dependencies** from relations that contain composite primary keys.

Examples of composite key relations:

* **COMPLAINT_ASSIGNMENTS**
* **COMPLAINT_UPDATES**
* **ATTACHMENTS**
* **COMPLAINT_SUPPORTS**

Example:

```
(complaint_id, worker_id) → assignment
```

Worker details such as name and contact information are stored in the **USERS** table rather than in the assignment relation.

Therefore, all attributes depend on the **entire primary key**, satisfying **2NF**.

---

## Third Normal Form (3NF)

3NF removes **transitive dependencies**.

Example dependency chain:

```
office_id → area_id
area_id → city_id
```

Instead of storing city information inside the **OFFICES** table, the hierarchy is decomposed into:

* **CITIES**
* **AREAS**
* **OFFICES**

Relationships:

```
CITIES → AREAS → OFFICES
```

This ensures that all non-key attributes depend **only on the primary key**, satisfying **3NF**.

---

# Functional Dependencies

### ROLES

```
role_id → role_name
```

---

### USERS

```
user_id → name, email, password_hash, phone, role_id, office_id
email → user_id
```

---

### DEPARTMENTS

```
department_id → department_name, description, contact_email, contact_phone
```

---

### CITIES

```
city_id → city_name, state, country
```

---

### AREAS

```
area_id → area_name, city_id
```

---

### OFFICES

```
office_id → office_name, office_address, contact_phone, department_id, area_id
```

---

### COMPLAINTS

```
complaint_id → citizen_id, department_id, office_id, area_id, title, description, status, created_at
```

---

### COMPLAINT_ASSIGNMENTS

```
(complaint_id, worker_id) → assigned_by, assigned_at
```

---

### COMPLAINT_UPDATES

```
(complaint_id, update_no) → updated_by, update_message, update_time
```

---

### ATTACHMENTS

```
(complaint_id, attachment_no) → user_id, file_url, uploaded_at
```

---

### COMPLAINT_SUPPORTS

```
(complaint_id, user_id) → supported_at
```

---

### FEEDBACK

```
complaint_id → user_id, rating, comments, submitted_at
```

---

# Design Decisions

* **Complaints** act as the **central entity** of the system.
* Worker assignments are modeled using **COMPLAINT_ASSIGNMENTS** with a composite key.
* Complaint updates are stored separately to track progress over time.
* Attachments are stored independently to support multiple images/files per complaint.
* Complaint supports allow multiple users to upvote the same complaint.
* Feedback is linked directly to the complaint to maintain a one-to-one relationship.
* Geographic hierarchy (**City → Area → Office**) simplifies administrative management.

---

# Future Extensions

Potential improvements for future versions include:

* Real-time complaint tracking dashboard
* SMS or email notifications for complaint updates
* Complaint categorization and prioritization
* Worker performance analytics
* AI-based complaint classification and routing
* Public complaint heatmaps for city administrators
