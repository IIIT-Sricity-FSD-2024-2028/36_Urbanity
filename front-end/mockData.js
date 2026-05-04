(function () {
  const STORAGE_KEY = "urbanity.mockData.v4";
  const API_BASE_URL = "http://localhost:3000";

  const BACKEND_ENTITY_PATHS = {
    users: "users",
    roles: "roles",
    departments: "departments",
    complaints: "complaints",
    assignments: "assignments",
    complaintUpdates: "complaint-updates",
    feedback: "feedback",
  };

  const ROLE_NAME_TO_ID = {
    Admin: "11111111-1111-4111-8111-111111111111",
    "Department Head": "22222222-2222-4222-8222-222222222222",
    "Department Officer": "33333333-3333-4333-8333-333333333333",
    "Field Worker": "44444444-4444-4444-8444-444444444444",
    Citizen: "55555555-5555-4555-8555-555555555555",
  };

  const ROLE_ID_TO_NAME = Object.fromEntries(
    Object.entries(ROLE_NAME_TO_ID).map(([name, id]) => [id, name]),
  );

  const departmentOptions = ["Road", "Water Services", "Sanitation"];

  function toEmail(name) {
    return `${name.toLowerCase().replace(/\s+/g, ".")}@urbanity.gov`;
  }

  function toPassword(name) {
    return `${name.split(" ")[0].toLowerCase()}123`;
  }

  function toPhone(index) {
    const firstDigit = 6 + (index % 4);
    const remainingDigits = String(100000000 + index).slice(-9);
    return `+91-${firstDigit}${remainingDigits}`;
  }

  function buildUsers() {
    const users = [];
    const heads = [];
    const officers = [];
    const fieldWorkers = [];
    const citizens = [];
    let index = 1;

    function addUser(name, role, department, lastActive, extra = {}) {
      const user = {
        id: `USR-${String(index).padStart(3, "0")}`,
        name,
        email: toEmail(name),
        password: toPassword(name),
        role,
        department,
        status: "Active",
        lastActive,
        phone: toPhone(index),
        ...extra,
      };

      users.push(user);
      index += 1;
      return user;
    }

    addUser("Arjun Mehta", "Admin", "System", "5 minutes ago", {
      employeeCode: "ADM-001",
    });

    ["Amit Kumar", "Rajesh Sharma", "Sunita Rao"].forEach((name, i) => {
      const department = departmentOptions[i % departmentOptions.length];
      const head = addUser(name, "Department Head", department, `${i + 1} hours ago`, {
        employeeCode: `DH-${String(i + 1).padStart(3, "0")}`,
      });
      heads.push(head);
    });

    ["Priya Sharma", "Neeraj Gupta", "Pooja Nair"].forEach((name, i) => {
      const department = departmentOptions[i % departmentOptions.length];
      const head = heads.find((entry) => entry.department === department) || heads[0];
      const officer = addUser(name, "Department Officer", department, `${i + 10} minutes ago`, {
        reportsTo: head.id,
        headId: head.id,
        employeeCode: `DO-${String(i + 1).padStart(3, "0")}`,
      });
      officers.push(officer);
    });

    ["Ravi Verma", "Sohan Lal", "Vikas Rao"].forEach((name, i) => {
      const department = departmentOptions[i % departmentOptions.length];
      const officersInDepartment = officers.filter((entry) => entry.department === department);
      const officer = officersInDepartment[i % officersInDepartment.length] || officers[0];
      const worker = addUser(name, "Field Worker", department, `${i + 20} minutes ago`, {
        reportsTo: officer.id,
        officerId: officer.id,
        headId: officer.headId,
        employeeCode: `FW-${String(i + 1).padStart(3, "0")}`,
      });
      fieldWorkers.push(worker);
    });

    ["Anita Rao", "Suresh Nair", "Neha Singh", "Asha Kumari", "Ajay Kumar"].forEach((
      name,
      i,
    ) => {
      const citizen = addUser(name, "Citizen", "N/A", `${i + 1} days ago`);
      citizens.push(citizen);
    });

    return {
      users,
      heads,
      officers,
      fieldWorkers,
      citizens,
    };
  }

  const generatedUsers = buildUsers();
  const assignmentWorkers = generatedUsers.fieldWorkers;
  const complaintCitizens = generatedUsers.citizens;

  const defaultData = {
    users: generatedUsers.users,
    roles: [
      {
        id: "ROL-001",
        name: "Department Head",
        description: "Full department management authority",
        permissionLevel: "Full Access",
      },
      {
        id: "ROL-002",
        name: "Department Officer",
        description: "Issue validation and assignment",
        permissionLevel: "Moderate Access",
      },
      {
        id: "ROL-003",
        name: "Field Worker",
        description: "On-ground issue resolution",
        permissionLevel: "Limited Access",
      },
      {
        id: "ROL-004",
        name: "Citizen",
        description: "Default role for registered users",
        permissionLevel: "View Only",
      },
    ],
    departments: [
      {
        id: "DEP-001",
        name: "Road",
        description: "Road and civic infrastructure maintenance",
        manager: "Amit Kumar",
        responseTime: "24",
      },
      {
        id: "DEP-002",
        name: "Water Services",
        description: "Water supply and utility services management",
        manager: "Rajesh Sharma",
        responseTime: "18",
      },
      {
        id: "DEP-003",
        name: "Sanitation",
        description: "Waste management and cleanliness",
        manager: "Sunita Rao",
        responseTime: "12",
      },
    ],
    complaints: [
      {
        id: "CMP-1001",
        title: "Street Light Not Working",
        description: "Street light has been off for 3 days.",
        location: "Oak Street",
        status: "pending",
        category: "Infrastructure",
        date: "March 10, 2026",
        upvotes: 23,
        reportedBy: complaintCitizens[0].name,
        reportedById: complaintCitizens[0].id,
        media: [
          {
            type: "image",
            url: "../SampleImages/Pothole_1.png",
            name: "Pothole_1.png",
          },
        ],
      },
      {
        id: "CMP-1002",
        title: "Garbage Not Collected",
        description: "Trash bins overflowing for a week.",
        location: "Pine Avenue",
        status: "in-progress",
        category: "Sanitation",
        date: "March 12, 2026",
        upvotes: 15,
        reportedBy: complaintCitizens[1].name,
        reportedById: complaintCitizens[1].id,
        media: [
          {
            type: "image",
            url: "../SampleImages/Sanitation_1.png",
            name: "Sanitation_1.png",
          },
        ],
      },
      {
        id: "CMP-1003",
        title: "Water Leakage",
        description: "Major leak causing road blockage.",
        location: "Maple Drive",
        status: "pending",
        category: "Infrastructure",
        date: "March 15, 2026",
        upvotes: 34,
        reportedBy: complaintCitizens[2].name,
        reportedById: complaintCitizens[2].id,
        media: [
          {
            type: "image",
            url: "../SampleImages/Water_1.png",
            name: "Water_1.png",
          },
        ],
      },
      {
        id: "CMP-1004",
        title: "Pothole Near Market",
        description: "Deep pothole causing traffic slowdown.",
        location: "Lal Market Road",
        status: "escalated",
        category: "Roads",
        date: "March 16, 2026",
        upvotes: 21,
        reportedBy: complaintCitizens[3].name,
        reportedById: complaintCitizens[3].id,
        media: [
          {
            type: "image",
            url: "../SampleImages/Pothole_2.png",
            name: "Pothole_2.png",
          },
        ],
      },
      {
        id: "CMP-1005",
        title: "Garbage Not Picked",
        description: "Garbage are all over the streets. It is not picked up.",
        location: "Ganga Lane",
        status: "pending",
        category: "Sanitation",
        date: "March 17, 2026",
        upvotes: 11,
        reportedBy: complaintCitizens[4].name,
        reportedById: complaintCitizens[4].id,
        media: [
          {
            type: "image",
            url: "../SampleImages/Sanitation_2.png",
            name: "Sanitation_2.png",
          },
        ],
        resolutionMedia: [
          {
            type: "image",
            url: "../SampleImages/Sanitation_3.png",
            name: "Sanitation_3.png",
          },
        ],
      },
    ],
    assignments: [
      {
        id: "ASG-1234",
        complaintId: "CMP-1001",
        issueDescription: "Street Light Not Working",
        category: "Electricity",
        location: "Oak Street",
        assignedDate: "3/17/2026",
        priority: "High",
        status: "Pending",
        details: "Inspect and restore street light connection.",
        citizenName: "Anita Rao",
        citizenContact: "+91-9988776655",
        assignee: assignmentWorkers[0].name,
        assigneeId: assignmentWorkers[0].id,
        officerId: assignmentWorkers[0].officerId,
        headId: assignmentWorkers[0].headId,
      },
      {
        id: "ASG-1235",
        complaintId: "CMP-1002",
        issueDescription: "Garbage Not Collected",
        category: "Sanitation",
        location: "Pine Avenue",
        assignedDate: "3/18/2026",
        priority: "Medium",
        status: "In Progress",
        details: "Coordinate collection team and clear waste.",
        citizenName: "Suresh Nair",
        citizenContact: "+91-9988774455",
        assignee: assignmentWorkers[1].name,
        assigneeId: assignmentWorkers[1].id,
        officerId: assignmentWorkers[1].officerId,
        headId: assignmentWorkers[1].headId,
      },
      {
        id: "ASG-1236",
        complaintId: "CMP-1003",
        issueDescription: "Water Leakage",
        category: "Water",
        location: "Maple Drive",
        assignedDate: "3/19/2026",
        priority: "High",
        status: "In Progress",
        details: "Locate pipe damage and start leakage repair.",
        citizenName: "Neha Singh",
        citizenContact: "+91-7788556699",
        assignee: assignmentWorkers[2].name,
        assigneeId: assignmentWorkers[2].id,
        officerId: assignmentWorkers[2].officerId,
        headId: assignmentWorkers[2].headId,
      },
      {
        id: "ASG-1237",
        complaintId: "CMP-1004",
        issueDescription: "Pothole Near Market",
        category: "Roads",
        location: "Lal Market Road",
        assignedDate: "3/20/2026",
        priority: "Medium",
        status: "Pending",
        details: "Inspect area and schedule quick patching work.",
        citizenName: "Ajay Kumar",
        citizenContact: "+91-9574867884",
        assignee: assignmentWorkers[0].name,
        assigneeId: assignmentWorkers[0].id,
        officerId: assignmentWorkers[0].officerId,
        headId: assignmentWorkers[0].headId,
      },
      {
        id: "ASG-1238",
        complaintId: "CMP-1005",
        issueDescription: "Drain Overflow",
        category: "Sanitation",
        location: "Ganga Lane",
        assignedDate: "3/21/2026",
        priority: "Medium",
        status: "Completed",
        details: "Clear blocked drain and disinfect the area.",
        citizenName: "Asha Kumari",
        citizenContact: "+91-9574867885",
        assignee: assignmentWorkers[1].name,
        assigneeId: assignmentWorkers[1].id,
        officerId: assignmentWorkers[1].officerId,
        headId: assignmentWorkers[1].headId,
        proofMedia: [
          {
            type: "image",
            url: "../SampleImages/Sanitation_3.png",
            name: "Sanitation_3.png",
          },
        ],
      },
    ],
    complaintUpdates: [],
    feedback: [],
  };

  let db = load();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function withoutUndefinedFields(item) {
    return Object.fromEntries(
      Object.entries(item || {}).filter(([, value]) => typeof value !== "undefined"),
    );
  }

  function backendHeaders() {
    return {
      role: "admin",
      "Content-Type": "application/json",
    };
  }

  function toBackendStatus(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "in-progress") return "In Progress";
    if (normalized === "resolved") return "Resolved";
    if (normalized === "closed") return "Closed";
    return status || "Pending";
  }

  function toFrontendStatus(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "in progress") return "in-progress";
    if (normalized === "pending") return "pending";
    if (normalized === "resolved") return "resolved";
    if (normalized === "closed") return "closed";
    return normalized || "pending";
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || ""),
    );
  }

  function normalizeBackendItem(entity, item) {
    if (!item) {
      return item;
    }

    if (entity === "users") {
      const normalizedRole = item.role || ROLE_ID_TO_NAME[item.roleId] || "Citizen";
      return {
        ...item,
        password: item.password || item.passwordHash,
        role: normalizedRole,
        department: item.department || (normalizedRole === "Citizen" ? "N/A" : "System"),
        status: item.status || "Active",
        lastActive: item.lastActive || "Just now",
      };
    }

    if (entity === "roles") {
      return {
        ...item,
        name: ROLE_ID_TO_NAME[item.id] || item.name,
        description: item.description || "System role",
        permissionLevel: item.permissionLevel || "Configured Access",
      };
    }

    if (entity === "departments") {
      return {
        ...item,
        description: item.description || "",
        manager: item.manager || "Unassigned",
        responseTime: item.responseTime || "24",
      };
    }

    if (entity === "complaints") {
      return {
        ...item,
        status: toFrontendStatus(item.status),
        date: item.date || item.createdAt || new Date().toLocaleDateString(),
        upvotes: Number(item.upvotes || 0),
        upvotedBy: Array.isArray(item.upvotedBy) ? item.upvotedBy : [],
        media: Array.isArray(item.media) ? item.media : [],
        resolutionMedia: Array.isArray(item.resolutionMedia) ? item.resolutionMedia : [],
      };
    }

    return item;
  }

  function toBackendItem(entity, item) {
    if (!item) {
      return item;
    }

    if (entity === "users") {
      return {
        name: item.name,
        email: item.email,
        passwordHash: item.passwordHash || item.password || "user123",
        phone: item.phone === "N/A" ? undefined : item.phone,
        roleId: item.roleId || ROLE_NAME_TO_ID[item.role] || ROLE_NAME_TO_ID.Citizen,
        department: item.department,
        status: item.status,
        lastActive: item.lastActive,
        employeeCode: item.employeeCode,
        reportsTo: item.reportsTo,
        headId: item.headId,
        officerId: item.officerId,
      };
    }

    if (entity === "roles") {
      return {
        name: Object.keys(ROLE_NAME_TO_ID).includes(item.name)
          ? item.name.toLowerCase().replace(/\s+/g, "-")
          : item.name,
      };
    }

    if (entity === "departments") {
      return {
        name: item.name,
        description: item.description,
        manager: item.manager,
        responseTime: String(item.responseTime || ""),
      };
    }

    if (entity === "complaints") {
      return {
        citizenId: isUuid(item.citizenId || item.reportedById)
          ? item.citizenId || item.reportedById
          : undefined,
        title: item.title,
        description: item.description,
        status: toBackendStatus(item.status),
        location: item.location,
        category: item.category,
        department: item.department,
        reportedBy: item.reportedBy,
        reportedByEmail: item.reportedByEmail,
        upvotes: Number(item.upvotes || 0),
        upvotedBy: Array.isArray(item.upvotedBy) ? item.upvotedBy : [],
        media: Array.isArray(item.media) ? item.media : [],
        resolutionMedia: Array.isArray(item.resolutionMedia) ? item.resolutionMedia : [],
        date: item.date,
        feedback: item.feedback,
        feedbackSubmittedAt: item.feedbackSubmittedAt,
      };
    }

    if (entity === "assignments") {
      return {
        complaintId: item.complaintId,
        assignedBy: isUuid(item.assignedBy || item.officerId)
          ? item.assignedBy || item.officerId
          : "11111111-1111-4111-8111-111111111111",
        workerId: isUuid(item.workerId || item.assigneeId)
          ? item.workerId || item.assigneeId
          : "44444444-4444-4444-8444-444444444444",
        assignee: item.assignee,
        assigneeId: item.assigneeId,
        officer: item.officer,
        department: item.department,
        status: item.status,
        priority: item.priority,
        dueDate: item.dueDate,
        notes: item.notes,
        proofMedia: Array.isArray(item.proofMedia) ? item.proofMedia : [],
        verifiedAt: item.verifiedAt,
        issueDescription: item.issueDescription,
        category: item.category,
        location: item.location,
        assignedDate: item.assignedDate,
        details: item.details,
        citizenName: item.citizenName,
        citizenContact: item.citizenContact,
        officerId: item.officerId,
        headId: item.headId,
        remarks: item.remarks,
        workDetails: item.workDetails,
        materials: item.materials,
        completedAt: item.completedAt,
      };
    }

    if (entity === "complaintUpdates") {
      return {
        complaintId: item.complaintId,
        updateNo: Number(item.updateNo || 1),
        updatedBy: item.updatedBy || "system",
        updateMessage: item.updateMessage || item.message || "Complaint updated.",
      };
    }

    if (entity === "feedback") {
      return {
        complaintId: item.complaintId,
        userId: item.userId || item.citizenId || "citizen",
        rating: Number(item.rating || 1),
        comments: item.comments || "",
      };
    }

    return item;
  }

  async function backendRequest(entity, id, options = {}) {
    const path = BACKEND_ENTITY_PATHS[entity];
    if (!path || typeof fetch !== "function") {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/${path}${id ? `/${id}` : ""}`, {
      ...options,
      headers: {
        ...backendHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`${entity} backend sync failed with status ${response.status}`);
    }

    return response.json();
  }

  function syncAddToBackend(entity, item) {
    const path = BACKEND_ENTITY_PATHS[entity];
    if (!path) {
      return;
    }

    backendRequest(entity, null, {
      method: "POST",
      body: JSON.stringify(toBackendItem(entity, item)),
    })
      .then((response) => {
        if (!response?.data?.id || response.data.id === item.id) {
          return;
        }

        const index = db[entity].findIndex((entry) => entry.id === item.id);
        if (index !== -1) {
          db[entity][index] = {
            ...db[entity][index],
            id: response.data.id,
          };
          save();
        }
      })
      .catch((error) => {
        console.warn(error.message);
        window.dispatchEvent(
          new CustomEvent("urbanity:backend-sync-error", {
            detail: { entity, action: "add", message: error.message },
          }),
        );
      });
  }

  function syncUpdateToBackend(entity, id, partial) {
    if (!BACKEND_ENTITY_PATHS[entity]) {
      return;
    }

    backendRequest(entity, id, {
      method: "PATCH",
      body: JSON.stringify(toBackendItem(entity, partial)),
    }).catch((error) => {
      console.warn(error.message);
      window.dispatchEvent(
        new CustomEvent("urbanity:backend-sync-error", {
          detail: { entity, action: "update", message: error.message },
        }),
      );
    });
  }

  function syncRemoveFromBackend(entity, id) {
    if (!BACKEND_ENTITY_PATHS[entity]) {
      return;
    }

    backendRequest(entity, id, { method: "DELETE" }).catch((error) => {
      console.warn(error.message);
      window.dispatchEvent(
        new CustomEvent("urbanity:backend-sync-error", {
          detail: { entity, action: "delete", message: error.message },
        }),
      );
    });
  }

  async function createBackend(entity, item) {
    const response = await backendRequest(entity, null, {
      method: "POST",
      body: JSON.stringify(toBackendItem(entity, item)),
    });

    return normalizeBackendItem(entity, response.data);
  }

  async function hydrateFromBackend() {
    await Promise.all(
      Object.keys(BACKEND_ENTITY_PATHS).map(async (entity) => {
        try {
          const response = await backendRequest(entity);
          if (!Array.isArray(response?.data) || response.data.length === 0) {
            return;
          }

          const backendItems = response.data.map((item) => normalizeBackendItem(entity, item));
          const mergedByKey = new Map();

          if (!Array.isArray(db[entity])) {
            db[entity] = [];
          }

          db[entity].forEach((item) => {
            const key = item.email ? `email:${String(item.email).toLowerCase()}` : `id:${item.id}`;
            mergedByKey.set(key, item);
          });

          backendItems.forEach((item) => {
            const key = item.email ? `email:${String(item.email).toLowerCase()}` : `id:${item.id}`;
            mergedByKey.set(key, {
              ...(mergedByKey.get(key) || {}),
              ...withoutUndefinedFields(item),
            });
          });

          db[entity] = Array.from(mergedByKey.values());
        } catch (error) {
          console.warn(error.message);
        }
      }),
    );

    save();
    window.dispatchEvent(new CustomEvent("urbanity:data-sync"));
    window.dispatchEvent(new Event("storage"));
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function normalizeStoreData(data) {
    const defaultByEmail = new Map(defaultData.users.map((user) => [user.email, user]));
    const defaultComplaintById = new Map(defaultData.complaints.map((complaint) => [complaint.id, complaint]));
    const defaultAssignmentById = new Map(defaultData.assignments.map((assignment) => [assignment.id, assignment]));
    const citizenUsers = defaultData.users.filter((user) => user.role === "Citizen");
    const users = (Array.isArray(data.users) ? data.users : []).map((user) => {
      const fallback = defaultByEmail.get(user.email) || {};
      return {
        ...fallback,
        ...user,
      };
    });

    const usersById = new Map(users.map((user) => [user.id, user]));
    const usersByName = new Map(users.map((user) => [user.name, user]));

    function normalizeMediaList(mediaList) {
      if (!Array.isArray(mediaList)) {
        return [];
      }

      return mediaList
        .filter((item) => item && item.url)
        .map((item) => ({
          type: item.type || (String(item.url).startsWith("data:video") ? "video" : "image"),
          url: item.url,
          name: item.name || "attachment",
        }));
    }

    const assignments = (Array.isArray(data.assignments) ? data.assignments : []).map((assignment) => {
      const assigneeUser =
        usersById.get(assignment.assigneeId) || usersByName.get(assignment.assignee);
      const fallbackAssignment = defaultAssignmentById.get(assignment.id) || {};

      return {
        ...assignment,
        assignee: assignment.assignee || assigneeUser?.name,
        assigneeId: assignment.assigneeId || assigneeUser?.id,
        officerId: assignment.officerId || assigneeUser?.officerId,
        headId: assignment.headId || assigneeUser?.headId,
        proofMedia: normalizeMediaList(
          Array.isArray(assignment.proofMedia) && assignment.proofMedia.length
            ? assignment.proofMedia
            : fallbackAssignment.proofMedia,
        ),
      };
    });

    function deriveDepartmentFromCategory(category) {
      const normalized = (category || "").toLowerCase();
      if (normalized === "sanitation") return "Sanitation";
      if (normalized === "water" || normalized === "electricity") return "Water Services";
      if (normalized === "roads" || normalized === "infrastructure") return "Road";
      return "Road";
    }

    const complaints = (Array.isArray(data.complaints) ? data.complaints : []).map(
      (complaint, index) => {
        const fallbackCitizen = citizenUsers[index % citizenUsers.length];
        const citizenFromId = usersById.get(complaint.reportedById);
        const citizenFromName = usersByName.get(complaint.reportedBy);
        const citizen = citizenFromId || citizenFromName || fallbackCitizen;
        const fallbackComplaint = defaultComplaintById.get(complaint.id) || {};

        return {
          ...complaint,
          reportedBy:
            !complaint.reportedBy || complaint.reportedBy === "Citizen"
              ? citizen?.name || "Citizen"
              : complaint.reportedBy,
          reportedById: complaint.reportedById || citizen?.id,
          department: complaint.department || deriveDepartmentFromCategory(complaint.category),
          media: normalizeMediaList(
            Array.isArray(complaint.media) && complaint.media.length
              ? complaint.media
              : fallbackComplaint.media,
          ),
          resolutionMedia: normalizeMediaList(
            Array.isArray(complaint.resolutionMedia) && complaint.resolutionMedia.length
              ? complaint.resolutionMedia
              : fallbackComplaint.resolutionMedia,
          ),
        };
      },
    );

    return {
      ...data,
      users,
      complaints,
      assignments,
      complaintUpdates: Array.isArray(data.complaintUpdates)
        ? data.complaintUpdates
        : clone(defaultData.complaintUpdates),
      feedback: Array.isArray(data.feedback) ? data.feedback : clone(defaultData.feedback),
    };
  }

  function load() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return clone(defaultData);
    }

    try {
      const parsed = JSON.parse(stored);
      return normalizeStoreData({
        users: Array.isArray(parsed.users) ? parsed.users : clone(defaultData.users),
        roles: Array.isArray(parsed.roles) ? parsed.roles : clone(defaultData.roles),
        departments: Array.isArray(parsed.departments)
          ? parsed.departments
          : clone(defaultData.departments),
        complaints: Array.isArray(parsed.complaints)
          ? parsed.complaints
          : clone(defaultData.complaints),
        assignments: Array.isArray(parsed.assignments)
          ? parsed.assignments
          : clone(defaultData.assignments),
        complaintUpdates: Array.isArray(parsed.complaintUpdates)
          ? parsed.complaintUpdates
          : clone(defaultData.complaintUpdates),
        feedback: Array.isArray(parsed.feedback) ? parsed.feedback : clone(defaultData.feedback),
      });
    } catch (error) {
      console.error("Failed to parse mock data store.", error);
      return clone(defaultData);
    }
  }

  function ensureEntity(entity) {
    if (!Object.prototype.hasOwnProperty.call(db, entity)) {
      throw new Error(`Unknown entity: ${entity}`);
    }
  }

  function list(entity) {
    ensureEntity(entity);
    return clone(db[entity]);
  }

  function get(entity, id) {
    ensureEntity(entity);
    const item = db[entity].find((entry) => entry.id === id);
    return item ? clone(item) : null;
  }

  function add(entity, item, options = {}) {
    ensureEntity(entity);
    const nextItem = { ...item };
    if (!nextItem.id) {
      nextItem.id = `ID-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    db[entity].push(nextItem);
    save();
    if (!options.skipBackend) {
      syncAddToBackend(entity, nextItem);
    }
    return clone(nextItem);
  }

  function update(entity, id, partial) {
    ensureEntity(entity);
    const index = db[entity].findIndex((entry) => entry.id === id);
    if (index === -1) {
      return null;
    }

    db[entity][index] = { ...db[entity][index], ...partial };
    save();
    syncUpdateToBackend(entity, id, partial);
    return clone(db[entity][index]);
  }

  function remove(entity, id) {
    ensureEntity(entity);
    const before = db[entity].length;
    db[entity] = db[entity].filter((entry) => entry.id !== id);
    const changed = db[entity].length !== before;
    if (changed) {
      save();
      syncRemoveFromBackend(entity, id);
    }
    return changed;
  }

  function setEntity(entity, items) {
    ensureEntity(entity);
    db[entity] = Array.isArray(items) ? clone(items) : [];
    save();
    return list(entity);
  }

  function reset() {
    db = clone(defaultData);
    save();
    return clone(db);
  }

  function ensureUiFeedback() {
    if (window.UIFeedback) {
      return;
    }

    function toast({ scope = "urbanity", message = "", type = "info", duration = 2600 } = {}) {
      const safeType = ["info", "success", "error"].includes(type) ? type : "info";
      const hostId = `${scope}ToastHost`;

      let host = document.getElementById(hostId);
      if (!host) {
        host = document.createElement("div");
        host.id = hostId;
        host.className = "urbanity-toast-host";
        document.body.appendChild(host);
      }

      const item = document.createElement("div");
      item.className = `urbanity-toast urbanity-toast-${safeType}`;
      item.textContent = String(message || "");
      host.appendChild(item);

      window.setTimeout(() => item.remove(), duration);
    }

    function dialog({
      title = "Confirm",
      message = "",
      confirmText = "Confirm",
      cancelText = "Cancel",
      inputValue,
    } = {}) {
      return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "urbanity-dialog-overlay";

        const panel = document.createElement("div");
        panel.className = "urbanity-dialog-panel";

        const heading = document.createElement("h4");
        heading.className = "urbanity-dialog-title";
        heading.textContent = title;
        panel.appendChild(heading);

        if (message) {
          const body = document.createElement("p");
          body.className = "urbanity-dialog-message";
          body.textContent = message;
          panel.appendChild(body);
        }

        let input = null;
        if (typeof inputValue === "string") {
          input = document.createElement("input");
          input.type = "text";
          input.value = inputValue;
          input.className = "urbanity-dialog-input";
          panel.appendChild(input);
        }

        const actions = document.createElement("div");
        actions.className = "urbanity-dialog-actions";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "urbanity-dialog-btn urbanity-dialog-btn-cancel";
        cancelBtn.textContent = cancelText;

        const confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.className = "urbanity-dialog-btn urbanity-dialog-btn-confirm";
        confirmBtn.textContent = confirmText;

        function close(payload) {
          overlay.remove();
          resolve(payload);
        }

        cancelBtn.addEventListener("click", () => close({ confirmed: false, value: null }));
        confirmBtn.addEventListener("click", () =>
          close({ confirmed: true, value: input ? input.value : null }),
        );

        overlay.addEventListener("click", (event) => {
          if (event.target === overlay) {
            close({ confirmed: false, value: null });
          }
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        panel.appendChild(actions);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        if (input) {
          window.setTimeout(() => input.focus(), 10);
        }
      });
    }

    window.UIFeedback = {
      toast,
      dialog,
    };
  }

  ensureUiFeedback();
  hydrateFromBackend();

  window.MockDataAPI = {
    list,
    get,
    add,
    update,
    remove,
    setEntity,
    reset,
    createBackend,
  };
})();
