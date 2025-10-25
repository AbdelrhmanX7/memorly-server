# Memorly API Documentation

Base URL: `http://localhost:4000/api`

## Table of Contents
- [Authentication](#authentication)
  - [Register](#register)
  - [Login](#login)
  - [Verify Email](#verify-email)
  - [Resend Verification OTP](#resend-verification-otp)
  - [Forgot Password](#forgot-password)
  - [Reset Password](#reset-password)

---

## Authentication

### Register

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "dateOfBirth": "2000-01-01",
  "acceptPrivacyPolicy": true
}
```

**Validation Rules:**
- `username`: 3-30 characters, required
- `email`: Valid email format, required
- `password`: Minimum 6 characters, required
- `dateOfBirth`: Valid date, must be at least 13 years old, required
- `acceptPrivacyPolicy`: Must be `true`, required

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully. Please verify your email.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "john@example.com",
      "dateOfBirth": "2000-01-01T00:00:00.000Z",
      "isVerified": false
    }
  }
}
```

**Error Responses:**
- `400` - Validation error
- `409` - Email already registered / Username already taken
- `500` - Internal server error

---

### Login

Authenticate an existing user.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "john@example.com",
      "dateOfBirth": "2000-01-01T00:00:00.000Z",
      "isVerified": true
    }
  }
}
```

**Error Responses:**
- `400` - Validation error
- `401` - Invalid email or password
- `500` - Internal server error

---

### Verify Email

Verify user's email address with OTP.

**Endpoint:** `POST /api/auth/verify-email`

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

**Validation Rules:**
- `email`: Valid email format, required
- `otp`: Exactly 6 digits, required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Error Responses:**
- `400` - Validation error / Email already verified / Invalid or expired OTP
- `404` - User not found
- `500` - Internal server error

---

### Resend Verification OTP

Request a new verification OTP.

**Endpoint:** `POST /api/auth/resend-verification-otp`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Verification OTP sent to your email"
}
```

**Error Responses:**
- `400` - Validation error / Email already verified
- `404` - User not found
- `500` - Internal server error / Failed to send email

---

### Forgot Password

Request a password reset OTP.

**Endpoint:** `POST /api/auth/forgot-password`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset OTP sent to your email"
}
```

**Error Responses:**
- `400` - Validation error
- `404` - User not found
- `500` - Internal server error / Failed to send email

---

### Reset Password

Reset password using OTP.

**Endpoint:** `POST /api/auth/reset-password`

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456",
  "newPassword": "newPassword123"
}
```

**Validation Rules:**
- `email`: Valid email format, required
- `otp`: Exactly 6 digits, required
- `newPassword`: Minimum 6 characters, required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Error Responses:**
- `400` - Validation error / Invalid or expired OTP
- `404` - User not found
- `500` - Internal server error

---

## Protected Routes

For endpoints that require authentication, include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

**Example:**
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:4000/api/protected-route
```

---

## Error Response Format

All errors follow this format:

```json
{
  "message": "Error message here"
}
```

---

## Notes

- All OTPs expire after 10 minutes
- JWT tokens are valid for 30 days
- All timestamps are in ISO 8601 format (UTC)
- Password is hashed using bcrypt and never returned in responses
- Rate limiting may apply to prevent abuse (not yet implemented)

---

## Development

### Base URLs by Environment

- **Development:** `http://localhost:4000/api`
- **Staging:** TBD
- **Production:** TBD

### CORS

CORS is enabled for all origins in development. Configure this in production.
