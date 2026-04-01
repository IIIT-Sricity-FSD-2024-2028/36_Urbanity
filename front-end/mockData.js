(function () {
  const STORAGE_KEY = "urbanity.mockData.v4";

  const departmentOptions = ["Road", "Water Services", "Sanitation"];

  function toEmail(name) {
    return `${name.toLowerCase().replace(/\s+/g, ".")}@urbanity.gov`;
  }

  function toPassword(name) {
    return `${name.split(" ")[0].toLowerCase()}123`;
  }

  function toPhone(index) {
    return `+91-98${String(100000 + index).slice(-6)}`;
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
        status: "in-progress",
        category: "Roads",
        date: "March 16, 2026",
        upvotes: 19,
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
        citizenContact: "+1-555-0101",
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
        citizenContact: "+1-555-0102",
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
        citizenContact: "+1-555-0103",
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
        citizenContact: "+1-555-0104",
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
        citizenContact: "+1-555-0105",
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
  };

  let db = load();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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

  function add(entity, item) {
    ensureEntity(entity);
    const nextItem = { ...item };
    if (!nextItem.id) {
      nextItem.id = `ID-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    db[entity].push(nextItem);
    save();
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
    return clone(db[entity][index]);
  }

  function remove(entity, id) {
    ensureEntity(entity);
    const before = db[entity].length;
    db[entity] = db[entity].filter((entry) => entry.id !== id);
    const changed = db[entity].length !== before;
    if (changed) {
      save();
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

  window.MockDataAPI = {
    list,
    get,
    add,
    update,
    remove,
    setEntity,
    reset,
  };
})();
