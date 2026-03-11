CREATE DATABASE Urbanity;
USE Urbanity;

CREATE TABLE Roles (
role_id INT AUTO_INCREMENT PRIMARY KEY,
role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE Departments (
department_id INT AUTO_INCREMENT PRIMARY KEY,
department_name VARCHAR(100) NOT NULL,
description TEXT,
contact_email VARCHAR(100),
contact_phone VARCHAR(20)
);

CREATE TABLE Cities (
city_id INT AUTO_INCREMENT PRIMARY KEY,
city_name VARCHAR(100) NOT NULL,
state VARCHAR(100),
country VARCHAR(100)
);

CREATE TABLE Areas (
area_id INT AUTO_INCREMENT PRIMARY KEY,
area_name VARCHAR(100) NOT NULL,
city_id INT,
FOREIGN KEY (city_id) REFERENCES Cities(city_id)
);

CREATE TABLE Offices (
office_id INT AUTO_INCREMENT PRIMARY KEY,
office_name VARCHAR(100) NOT NULL,
office_address TEXT,
contact_phone VARCHAR(20),
department_id INT,
area_id INT,
FOREIGN KEY (department_id) REFERENCES Departments(department_id),
FOREIGN KEY (area_id) REFERENCES Areas(area_id)
);

CREATE TABLE Users (
user_id INT AUTO_INCREMENT PRIMARY KEY,
name VARCHAR(100) NOT NULL,
email VARCHAR(100) UNIQUE NOT NULL,
password_hash VARCHAR(255) NOT NULL,
phone VARCHAR(20),
role_id INT,
office_id INT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (role_id) REFERENCES Roles(role_id),
FOREIGN KEY (office_id) REFERENCES Offices(office_id)
);

CREATE TABLE Complaints (
complaint_id INT AUTO_INCREMENT PRIMARY KEY,
citizen_id INT,
department_id INT,
office_id INT,
area_id INT,
title VARCHAR(200) NOT NULL,
description TEXT,
status VARCHAR(50) DEFAULT 'Pending',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (citizen_id) REFERENCES Users(user_id),
FOREIGN KEY (office_id) REFERENCES Offices(office_id),
FOREIGN KEY (department_id) REFERENCES Departments(department_id),
FOREIGN KEY (area_id) REFERENCES Areas(area_id)
);

CREATE TABLE Complaint_Assignments (
complaint_id INT NOT NULL,
assigned_by INT NOT NULL,
worker_id INT NOT NULL,
assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (complaint_id, worker_id),
FOREIGN KEY (complaint_id) REFERENCES Complaints(complaint_id),
FOREIGN KEY (assigned_by) REFERENCES Users(user_id),
FOREIGN KEY (worker_id) REFERENCES Users(user_id)
);

CREATE TABLE Complaint_Updates (
complaint_id INT NOT NULL,
update_no INT NOT NULL,
updated_by INT NOT NULL,
update_message TEXT,
update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (complaint_id, update_no),
FOREIGN KEY (complaint_id) REFERENCES Complaints(complaint_id),
FOREIGN KEY (updated_by) REFERENCES Users(user_id)
);

CREATE TABLE Attachments (
complaint_id INT NOT NULL,
attachment_no INT NOT NULL,
user_id INT NOT NULL,
file_url VARCHAR(255),
uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (complaint_id, attachment_no),
FOREIGN KEY (complaint_id) REFERENCES Complaints(complaint_id),
FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE Complaint_Supports (
complaint_id INT NOT NULL,
user_id INT NOT NULL,
supported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (complaint_id, user_id),
FOREIGN KEY (complaint_id) REFERENCES Complaints(complaint_id),
FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE Feedback (
complaint_id INT NOT NULL,
user_id INT NOT NULL,
rating INT CHECK (rating BETWEEN 1 AND 5),
comments TEXT,
submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (complaint_id, user_id),
FOREIGN KEY (complaint_id) REFERENCES Complaints(complaint_id),
FOREIGN KEY (user_id) REFERENCES Users(user_id)
);