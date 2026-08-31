# Actor permissions

Backend authorization is authoritative. This matrix summarizes controller/service behavior; frontend visibility is not a security control.

| Actor | Confirmed access |
| --- | --- |
| Super Admin | Global hierarchy access; creates/updates/deletes communities, towers, floors, apartments, users, and worker profiles where controller/service rules permit. Can view all complaints, attachments, reviews, dashboard, and reports. Complaint assignment/lifecycle endpoints are not currently decorated for Super Admin. |
| Community Admin | Scoped to the authenticated user's community. Manages that community's towers, floors, apartments, residents, worker profiles, and permitted user associations. Views/manages community complaints, assignments, authorized lifecycle actions, dashboard, reports, and profile. Cannot globally manage communities. |
| Tower Representative | Scoped to the associated tower. Views eligible tower complaints (not community-wide complaint type), eligible workers in the complaint community, and can act as the responsible authority for applicable complaints. |
| Resident | Scoped to own account/apartment and own complaints. Creates complaints, uploads supporting images for owned complaints, and submits one review after resolution. |
| Maintenance Worker | Scoped to own worker profile and assigned complaints in the worker's community. Starts and resolves only assigned work. Worker rating, completed count, and history are service-managed. |

## User creation

The users controller permits Super Admin and Community Admin requests, while `UserAccessService` validates allowed role/hierarchy combinations and scopes targets. A Community Admin may create only `RESIDENT`, `TOWER_REPRESENTATIVE`, and `MAINTENANCE_WORKER` accounts; it may not create Super Admin or Community Admin accounts. Do not document or implement a client-side permission as if it overrides those backend checks.

## Complaint authority

- Community-type complaints route to the Community Admin of the complaint community.
- Apartment and tower-type complaints route to the Tower Representative assigned to that tower.
- Assignment requires an available worker in the same community with matching specialization.
- Only the assigned Maintenance Worker can start or resolve assigned work.
- A Resident can access only own complaints and can review only an owned resolved complaint.
- A Tower Representative cannot view community-type complaints through the complaint listing/ownership rules.
- A Maintenance Worker can view only complaints assigned to that worker and within its community.

## Association invariants

| Role | Required association | Disallowed hierarchy associations |
| --- | --- | --- |
| `SUPER_ADMIN` | None | Community, tower, apartment |
| `COMMUNITY_ADMIN` | Community | Tower, apartment |
| `TOWER_REPRESENTATIVE` | Tower | Community, apartment |
| `RESIDENT` | Apartment | Community, tower |
| `MAINTENANCE_WORKER` | Community | Tower, apartment |

The backend validates these invariants. A client must not infer that sending a different association changes the authenticated actor's authority.
