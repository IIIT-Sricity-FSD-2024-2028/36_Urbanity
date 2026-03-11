# Summary of the Interaction

## Basic Information
- **Domain:** Smart City & Urban Services Platforms  
- **Problem Statement:** Urban Service Request & Issue Management Platform  
- **Date of Interaction:** 02 February 2026  
- **Mode of Interaction:** Video call  
- **Duration (in-minutes):** 35  
- **Publicly Accessible Video Link:** [Video Recording](https://vimeo.com/1160847085?share=copy&fl=sv&fe=ci)

## Domain Expert Details
- **Role / Designation (Do not include personal or sensitive information):**  
  AI & GIS Solutions Lead (MoU-based Smart City Projects)

- **Experience in the Domain (Brief description of responsibilities and years of experience in domain):**  
  The domain expert has hands-on experience working on smart city initiatives and (‘urban digital transformation’). The expert has signed an official MoU with Indore Smart City Development Limited (ISCDL) to design and deploy AI, Drone, and GIS-based solutions for smart city use cases. Current work involves AI-powered drone data processing, geospatial analytics, and GIS-based dashboards to support urban planning, monitoring, and data-driven decision-making. The expert is also involved in building scalable systems for managing drone imagery, spatial datasets, and real-time urban insights, along with implementing GenAI and LLM-driven analysis for automated reporting, anomaly detection, and smart city intelligence workflows. Regular collaboration with government stakeholders and city officials ensures alignment between technical solutions and real-world urban challenges.

- **Nature of Work:**  
  Technical / Managerial  

## Domain Context and Terminology
- **How would you describe the overall purpose of this problem statement in your daily work?**  
  The purpose is to provide a structured and transparent system for citizens to report civic issues and for municipal departments to track, assign, and resolve them efficiently.

- **What are the primary goals or outcomes of this problem statement?**  
  - Faster grievance resolution  
  - Clear accountability across departments  
  - Improved transparency for citizens  
  - Centralized tracking of urban service issues  

- **List key terms used by the domain expert and their meanings (Copy these to definitions.yml):**

| Term | Meaning as explained by the expert |
|---|---|
| Complaint | A formal issue reported by a citizen regarding urban services |
| Department | Municipal unit responsible for resolving a specific category of issues |
| Field Worker | Ground-level staff assigned to inspect or resolve complaints |
| SLA | Time limit within which a complaint should be resolved |
| Escalation | Forwarding unresolved complaints to higher authority |

## Actors and Responsibilities
- **Identify the different roles involved and what they do in practice:**

| Actor / Role | Responsibilities |
|---|---|
| Citizen | Raises complaints, tracks status, provides feedback |
| Department Officer | Reviews complaints, assigns field workers, updates status |
| Field Worker | Visits location, inspects issue, performs resolution |
| Department Head | Monitors performance and handles escalations |
| Admin | Manages system users, departments, and configurations |

## Core Workflows

### Workflow 1: Raising a Complaint
- **Trigger / Start Condition:**  
  Citizen notices an urban service issue
- **Steps Involved:**  
  1. Citizen submits complaint with description and location  
  2. System assigns complaint to the relevant department  
  3. Complaint is logged with a unique ID  
- **Outcome / End Condition:**  
  Complaint is successfully registered and visible to the department  

### Workflow 2: Complaint Resolution
- **Trigger / Start Condition:**  
  Department officer receives a new complaint
- **Steps Involved:**  
  1. Officer reviews complaint details  
  2. Field worker is assigned  
  3. Field worker inspects and resolves the issue  
  4. Status is updated in the system  
- **Outcome / End Condition:**  
  Complaint is marked as resolved  

### Workflow 3: Escalation Handling
- **Trigger / Start Condition:**  
  Complaint not resolved within SLA
- **Steps Involved:**  
  1. System flags the complaint  
  2. Department head is notified  
  3. Priority reassignment or intervention is performed  
- **Outcome / End Condition:**  
  Complaint is resolved or closed with justification  

## Rules, Constraints, and Exceptions
- **Mandatory Rules or Policies:**  
  - Every complaint must be assigned to a department  
  - Status updates are mandatory after field visits  

- **Constraints or Limitations:**  
  - Limited number of field workers  
  - Manual verification required for some complaints  

- **Common Exceptions or Edge Cases:**  
  - Duplicate complaints for the same issue  
  - Incorrect or incomplete location details  

- **Situations Where Things Usually Go Wrong:**  
  - Delays in assignment  
  - Communication gaps between departments  

## Current Challenges and Pain Points
- Manual tracking of complaints across departments  
- Delays due to lack of real-time visibility  
- Difficulty in monitoring SLA compliance  
- Citizens unaware of internal resolution progress  

## Assumptions & Clarifications
- **Assumptions Confirmed:**  
  - Citizens prefer digital platforms for reporting issues  
  - Centralized dashboards improve accountability  

- **Assumptions Corrected:**  
  - Not all complaints can be auto-assigned without manual review  

- **Open Questions That Need Follow-up:**  
  - Integration with existing municipal systems  
  - Use of AI for complaint categorization and prioritization  