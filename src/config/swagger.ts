import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Memorly API Documentation",
      version: "1.0.0",
      description:
        "Complete API documentation for Memorly - A financial resource tracking application with user authentication, email verification, and password reset features.",
      contact: {
        name: "Memorly API Support",
        email: "support@memorly.com",
      },
      license: {
        name: "ISC",
      },
    },
    servers: [
      {
        url: "http://localhost:4000/api/v1",
        description: "Development server",
      },
      {
        url: "https://api.memorly.com/v1",
        description: "Production server (TBD)",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token in the format: Bearer <token>",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "User ID",
              example: "507f1f77bcf86cd799439011",
            },
            username: {
              type: "string",
              description: "Username",
              example: "johndoe",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email address",
              example: "john@example.com",
            },
            dateOfBirth: {
              type: "string",
              format: "date",
              description: "User date of birth",
              example: "2000-01-01",
            },
            isVerified: {
              type: "boolean",
              description: "Email verification status",
              example: false,
            },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "User registered successfully",
            },
            data: {
              type: "object",
              properties: {
                token: {
                  type: "string",
                  description: "JWT authentication token",
                  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                },
                user: {
                  $ref: "#/components/schemas/User",
                },
              },
            },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Operation successful",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Error message here",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication and account management endpoints",
      },
      {
        name: "Email Verification",
        description: "Email verification and OTP management endpoints",
      },
      {
        name: "Password Reset",
        description: "Password reset and recovery endpoints",
      },
    ],
  },
  apis: ["./src/routes/**/*.ts", "./src/controllers/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
