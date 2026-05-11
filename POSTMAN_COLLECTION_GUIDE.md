# School Management API - Postman Collection

This collection contains all API endpoints for the School Management System built with Django REST Framework.

## Files

- **School-Management-API.postman_collection.json** - Complete Postman collection with all endpoints

## How to Import

### Method 1: Import in Postman Desktop
1. Open Postman desktop application
2. Click **Import** button (top-left)
3. Select **File** tab
4. Choose `School-Management-API.postman_collection.json`
5. Click **Import**

### Method 2: Import via URL
1. Click **Import** → **Link** tab
2. Paste the file path or URL
3. Click **Import**

## Setup Instructions

### 1. Set Base URL
After importing, you need to set the base URL for your API:

1. Click **Variables** tab in collection
2. Update `base_url` value (default: `http://localhost:8000`)
3. Click **Save**

Example values:
- Local: `http://localhost:8000`
- Development: `https://api-dev.example.com`
- Production: `https://api.example.com`

### 2. Authentication Setup

#### Get JWT Token:
1. Go to **Authentication** folder → **Login (Get JWT Token)**
2. Update email and password in request body
3. Click **Send**
4. Copy the `access` token from response
5. Go to **Variables** → Update `access_token` value
6. Go to **Variables** → Update `refresh_token` value (if you want to refresh tokens)

#### Alternative: Manual Token Entry
1. Get your JWT token from your API or frontend
2. Edit **Variables** in collection
3. Paste token into `access_token` variable
4. Save

### 3. Using the Collection

All requests are organized by module:

- **Authentication** - User registration, login, password reset
- **Schools** - School CRUD operations
- **Accounts (Users)** - User management
- **Students** - Student management with CSV import
- **Teachers** - Teacher management and subjects
- **Attendance** - Student & teacher attendance tracking
- **Exams** - Exams, subjects, and results
- **Fees** - Fee structures and payments
- **Applications** - Student applications (leave, transfer, etc.)
- **Notices** - Notices and calendar events

## Common Parameters

### Pagination
Most list endpoints support pagination:
```
?page=1
```

### Filtering
Filter results using query parameters:
```
?class_name=10&section=A&status=present
```

### Search
Search by name or identifier:
```
?search=john
```

### Ordering
Sort results:
```
?ordering=-created_at
```

## API Endpoints Summary

| Module | Count | Description |
|--------|-------|-------------|
| Authentication | 5 | JWT token management, user registration |
| Schools | 6 | School CRUD operations |
| Accounts | 9 | User management and dashboards |
| Students | 6 | Student management with bulk import |
| Teachers | 5 | Teacher management |
| Attendance | 9 | Student & teacher attendance tracking |
| Exams | 15 | Exams, subjects, and results |
| Fees | 11 | Fee structures and payments |
| Applications | 10 | Student applications workflow |
| Notices | 10 | Notices and calendar events |
| **TOTAL** | **86** | **Complete API Coverage** |

## Request/Response Examples

### Register User
```json
POST /api/auth/users/
{
  "email": "user@example.com",
  "password": "securepassword123",
  "first_name": "John",
  "last_name": "Doe"
}
```

### Create Student
```json
POST /api/students/
{
  "user": {
    "email": "student@example.com",
    "first_name": "John",
    "last_name": "Student",
    "password": "securepassword123"
  },
  "roll_number": "001",
  "class_name": "10",
  "section": "A"
}
```

### Mark Attendance
```json
POST /api/attendance/bulk-mark/
{
  "attendance_records": [
    {"student": 1, "date": "2024-01-15", "status": "present"},
    {"student": 2, "date": "2024-01-15", "status": "absent"}
  ]
}
```

### Record Fee Payment
```json
POST /api/payments/pay/
{
  "student": 1,
  "amount": 50000,
  "payment_method": "cash",
  "transaction_id": "TXN001",
  "payment_date": "2024-01-15"
}
```

## Authentication

All endpoints except `/api/auth/` require JWT authentication.

**Header Format:**
```
Authorization: Bearer {access_token}
```

## Role-Based Access

Different endpoints have different permission levels:

| Role | Permissions |
|------|-------------|
| **Student** | View own data, apply for leave, view results, portal |
| **Teacher** | Manage attendance, view students, manage results |
| **Admin** | Full CRUD access to all resources |
| **Superuser** | Manage schools and all data |

## Tips & Tricks

### 1. Save Responses in Variables
Click **Tests** tab on any request to auto-save response values:
```javascript
pm.environment.set("student_id", pm.response.json().id);
```

### 2. Chain Requests
Use the response from one request as input to another by referencing variables.

### 3. Bulk Operations
Use the bulk endpoints for better performance:
- `/api/attendance/bulk-mark/` - Mark attendance for multiple students
- `/api/students/import-csv/` - Bulk import students

### 4. Filtering & Searching
Use query parameters for efficient data retrieval:
- Filter: `?class_name=10&section=A`
- Search: `?search=smith`
- Filter by date: `?date__gte=2024-01-01&date__lte=2024-01-31`

## Troubleshooting

### Token Expired
If you get 401 errors:
1. Generate a new token via **Login (Get JWT Token)**
2. Update the `access_token` variable

### School Access Denied
Each endpoint is scoped to the user's school. Ensure:
- You're logged in with correct user
- User is assigned to the school
- Admin users have proper permissions

### CSV Import Format
When bulk importing students, ensure CSV has headers:
```
email,first_name,last_name,roll_number,class_name,section
```

## Additional Resources

- **API Documentation**: `/api/auth/docs/`
- **Django Admin**: `/admin/`
- **Backend Code**: `./backend/`

## Support

For issues or questions:
1. Check the request/response error messages
2. Verify your JWT token is valid
3. Ensure user has appropriate permissions
4. Check server logs for detailed errors

---

**Collection Created**: May 2026  
**API Version**: Django REST Framework  
**Total Endpoints**: 86  
**Last Updated**: May 2026
