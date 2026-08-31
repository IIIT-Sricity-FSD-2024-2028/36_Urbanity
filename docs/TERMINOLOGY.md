# Terminology

Use these names consistently in active UI, documentation, and discussions.

| Display name | Backend enum |
| --- | --- |
| Super Admin | `SUPER_ADMIN` |
| Community Admin | `COMMUNITY_ADMIN` |
| Tower Representative | `TOWER_REPRESENTATIVE` |
| Resident | `RESIDENT` |
| Maintenance Worker | `MAINTENANCE_WORKER` |

Core domain vocabulary: **Community**, **Tower**, **Floor**, **Apartment**, **Complaint**, **Worker Profile**, **Shared Maintenance Workforce**, **Review**, and **Report**.

Use **community-scoped** for a resource limited to one community and **tower-scoped** for a resource limited to a specific tower. A Worker Profile belongs to a community; it is not a tower membership. Use **assignment** for a worker's temporary link to a complaint, not for the worker's permanent scope.

Do not rename backend enum values. Do not use obsolete actor terminology in active features. `front-end/Dept Head/` is legacy only and is not an active portal.
