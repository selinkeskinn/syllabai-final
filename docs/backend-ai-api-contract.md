# Backend AI API Contract

This document describes the backend API contract for the course-scoped RAG assistant.

Base URL:

```txt
http://localhost:3000/api
```

Swagger:

```txt
http://localhost:3000/api/docs
```

## Runtime Setup

Start PostgreSQL from the project root:

```powershell
docker compose up -d
```

Run backend migrations from `apps/backend`:

```powershell
npx.cmd prisma migrate deploy
npx.cmd prisma generate
```

Start Ollama and pull the required models:

```powershell
ollama pull nomic-embed-text
ollama pull llama3.2:3b
```

Recommended `.env` for local development:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/syllabai"
JWT_SECRET="change-me-in-production"
PORT=3000
AI_PROVIDER="ollama"
AI_BASE_URL="http://localhost:11434"
AI_EMBEDDING_MODEL="nomic-embed-text"
AI_CHAT_MODEL="llama3.2:3b"
AI_TOP_K=5
```

Start the backend:

```powershell
npm.cmd run start:dev
```

## Authentication

Protected endpoints require a bearer token:

```http
Authorization: Bearer <access_token>
```

Instructor emails must end with:

```txt
@bau.edu.tr
```

Student emails must end with:

```txt
@bahcesehir.edu.tr
```

### Register Instructor

```http
POST /auth/register
```

Request:

```json
{
  "email": "teacher2@bau.edu.tr",
  "password": "Password123",
  "confirmPassword": "Password123",
  "role": "INSTRUCTOR",
  "firstName": "Test",
  "lastName": "Teacher"
}
```

Response:

```json
{
  "access_token": "...",
  "user": {
    "id": "...",
    "email": "teacher2@bau.edu.tr",
    "role": "INSTRUCTOR"
  }
}
```

### Register Student

```http
POST /auth/register
```

Request:

```json
{
  "email": "student2@bahcesehir.edu.tr",
  "password": "Password123",
  "confirmPassword": "Password123",
  "role": "STUDENT",
  "firstName": "Test",
  "lastName": "Student",
  "studentId": "123457"
}
```

### Login

```http
POST /auth/login
```

Request:

```json
{
  "email": "teacher2@bau.edu.tr",
  "password": "Password123"
}
```

Response:

```json
{
  "access_token": "...",
  "user": {
    "id": "...",
    "email": "teacher2@bau.edu.tr",
    "role": "INSTRUCTOR"
  }
}
```

## Course Enrollment Flow

### Create Course

Role:

```txt
INSTRUCTOR
```

```http
POST /courses
```

Request:

JSON is still supported when no PDF is attached:

```json
{
  "code": "CMPE102",
  "title": "Data Structures",
  "description": "Data structures and algorithms basics",
  "semester": "Spring 2026"
}
```

For the instructor UI, use multipart so course creation and initial AI indexing happen in one flow:

```txt
Content-Type: multipart/form-data

code=CMPE102
title=Data Structures
description=Data structures and algorithms basics
semester=Spring 2026
file=@Syllabus.pdf
```

Response fields required by the frontend:

```json
{
  "id": "235689d9-d5b2-4799-8b4e-e64f7622e166",
  "code": "CMPE102",
  "title": "Data Structures",
  "joinKey": "C6F47F",
  "initialResource": {
    "resourceId": "c551f378-8f69-4645-8b9e-f1123f6c2653",
    "resourceName": "Syllabus.pdf",
    "status": "PROCESSING",
    "chunkCount": 0
  }
}
```

Use `id` as `courseId`. Do not use `instructorId` as `courseId`.
If `initialResource.status` is `PROCESSING`, poll `GET /courses/:courseId/resources`.

### Enroll Student

Role:

```txt
STUDENT
```

```http
POST /courses/enroll
```

Request:

```json
{
  "joinKey": "C6F47F"
}
```

Success:

```json
{
  "message": "Enrolled successfully",
  "course": {
    "id": "235689d9-d5b2-4799-8b4e-e64f7622e166",
    "code": "CMPE102",
    "title": "Data Structures"
  }
}
```

## AI Resource Upload

Uploads a course PDF and indexes it for RAG.

Role:

```txt
INSTRUCTOR
```

Permission rule:

```txt
The instructor must own the course.
```

Endpoint:

```http
POST /courses/:courseId/resources/upload
```

Content type:

```txt
multipart/form-data
```

Form field:

```txt
file: PDF file
```

Success response:

```json
{
  "resourceId": "c551f378-8f69-4645-8b9e-f1123f6c2653",
  "courseId": "235689d9-d5b2-4799-8b4e-e64f7622e166",
  "resourceName": "syllabus.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 51606,
  "status": "READY",
  "errorMessage": null,
  "chunkCount": 1,
  "createdAt": "2026-05-13T15:57:17.713Z",
  "updatedAt": "2026-05-13T15:57:21.160Z"
}
```

Possible `status` values:

```txt
PROCESSING
READY
FAILED
```

Notes:

- Only PDF files are accepted.
- The PDF must contain selectable text.
- Scanned/image-only PDFs cannot be indexed until OCR is added.
- If Ollama/LM Studio is not reachable, indexing fails.

Common errors:

```json
{
  "message": "A PDF file is required.",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "Only PDF files are supported for AI resources.",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "PDF could not be processed. Please upload a valid text-based PDF.",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "You can only manage resources for your own courses",
  "error": "Forbidden",
  "statusCode": 403
}
```

## List Course AI Resources

Role:

```txt
INSTRUCTOR owner or enrolled STUDENT
```

Endpoint:

```http
GET /courses/:courseId/resources
```

Response:

```json
[
  {
    "resourceId": "c551f378-8f69-4645-8b9e-f1123f6c2653",
    "courseId": "235689d9-d5b2-4799-8b4e-e64f7622e166",
    "resourceName": "syllabus.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 51606,
    "status": "READY",
    "errorMessage": null,
    "chunkCount": 1,
    "createdAt": "2026-05-13T15:57:17.713Z",
    "updatedAt": "2026-05-13T15:57:21.160Z"
  }
]
```

Frontend usage:

- Show `READY` resources as available for AI.
- Show `FAILED` resources with `errorMessage`.
- Disable AI ask if there are no `READY` resources.

## Course AI Ask

Asks the RAG assistant a question scoped to one course.

Role:

```txt
INSTRUCTOR owner or enrolled STUDENT
```

Endpoint:

```http
POST /courses/:courseId/ai/ask
```

Request:

```json
{
  "question": "What is the grading policy of this course?"
}
```

Success response:

```json
{
  "answer": "The grading policy of this course is as follows:\n\n- Midterm: 30%\n- Final exam: 40%\n- Project: 20%\n- Participation: 10%\n\nThis information is based on the uploaded syllabus document.",
  "courseId": "235689d9-d5b2-4799-8b4e-e64f7622e166",
  "mode": "rag",
  "sourceCount": 1,
  "sources": [
    {
      "resourceId": "c551f378-8f69-4645-8b9e-f1123f6c2653",
      "resourceName": "syllabus.pdf",
      "pageNumber": 1,
      "contentPreview": "CMPE102 Data Structures Syllabus Grading Policy Midterm 30 percent...",
      "score": 0.517
    }
  ]
}
```

Frontend display rules:

- Render `answer` as the main assistant response.
- Render `sources` under the answer.
- Use `resourceName`, `pageNumber`, and `contentPreview` as citation UI.
- `score` is for debugging or subtle relevance display; it does not need to be prominent.

Common errors:

```json
{
  "message": "Question is required",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "No indexed AI resources are ready for this course.",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "You can only ask AI about courses you are enrolled in",
  "error": "Forbidden",
  "statusCode": 403
}
```

## Permission Matrix

| Action | Instructor Owner | Other Instructor | Enrolled Student | Non-Enrolled Student |
| --- | --- | --- | --- | --- |
| Create course | Yes | N/A | No | No |
| Upload AI resource | Yes | No | No | No |
| List course AI resources | Yes | No | Yes | No |
| Ask course AI | Yes | No | Yes | No |
| Enroll by join key | No | No | Yes | Yes |

## Frontend Integration Checklist

Student course page:

- Call `GET /courses/:courseId/resources`.
- If no resource has `status === "READY"`, show AI unavailable state.
- Call `POST /courses/:courseId/ai/ask` with `{ "question": "..." }`.
- Show `answer`.
- Show `sources` as citations.

Instructor course page:

- Prefer creating a course and initial PDF together with `POST /courses` multipart.
- Upload PDF with `POST /courses/:courseId/resources/upload`.
- Show `PROCESSING` while background indexing is running.
- Poll `GET /courses/:courseId/resources` until the resource becomes `READY` or `FAILED`.
- Show `status`, `chunkCount`, and `errorMessage`.

## Current Limitations

- Vector search is currently implemented in application code with cosine similarity over stored float arrays.
- This is fine for MVP scale, but should move to pgvector or a vector database for larger datasets.
- PDF extraction supports text-based PDFs only.
- OCR is not implemented.
- Upload indexing runs in-process in the NestJS server. A durable queue should be added later for production use.
