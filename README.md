# PMF Researcher API

Simple backend for product-market fit interviews. One flow, one service, no complexity.

## Quick Start

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

## API Documentation

Once running, visit: http://localhost:8000/docs

## Endpoints

### 1️⃣ Start Session (Product Input)
```
POST /start
```
```json
{
  "product": "A SaaS platform that helps you create your own customized AI experiences"
}
```
**Returns:** `session_id` + 3 initial interview questions

---

### 2️⃣ Go Live (Start Interview)
```
POST /live/start
```
```json
{
  "session_id": "123"
}
```
**Returns:** `{ "status": "live" }`

---

### 3️⃣ Live Transcription + Follow-Ups
```
POST /live/transcript
```
```json
{
  "session_id": "123",
  "text": "We usually hack something together with prompts."
}
```
**Returns:** 2 AI-suggested follow-up questions

---

### 4️⃣ End Interview
```
POST /live/stop
```
```json
{
  "session_id": "123"
}
```
**Returns:** `{ "status": "stopped" }`

---

### 5️⃣ Structured Analysis (Q/A/Category)
```
GET /analysis?session_id=123
```
**Returns:** Structured rows with question, answer, and category

---

### 6️⃣ Generate Report
```
POST /report
```
```json
{
  "session_id": "123"
}
```
**Returns:** Summary, key pain points, and opportunities

---

## Environment Variables

Create a `.env` file:
```
yutori=your_api_key_here
```

## Architecture

- **In-memory session storage** (no database required)
- **Yutori API** for LLM calls
- **FastAPI** for the web framework

**Input → LLM → Store → Return**

That's it. Simple.
