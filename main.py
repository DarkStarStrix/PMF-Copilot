"""
PMF Researcher Backend - Simple Interview & Analysis API
One flow, one service, no complexity.
"""

import os
import uuid
import httpx
from enum import Enum
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, model_validator

load_dotenv()

# ============================================================================
# Configuration
# ============================================================================

YUTORI_API_KEY = os.getenv("YUTORI_API_KEY") or os.getenv("yutori")
YUTORI_BASE_URL = os.getenv("YUTORI_BASE_URL", "https://api.yutori.com")


def yutori_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if YUTORI_API_KEY:
        headers["X-API-KEY"] = YUTORI_API_KEY
        headers["Authorization"] = f"Bearer {YUTORI_API_KEY}"
    return headers


def json_detail(response: httpx.Response) -> dict:
    try:
        return response.json()
    except ValueError:
        return {"detail": response.text}

app = FastAPI(
    title="PMF Researcher API",
    description="Simple backend for product-market fit interviews",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Session State (In-Memory Storage)
# ============================================================================

class SessionStatus(str, Enum):
    CREATED = "created"
    LIVE = "live"
    POST_INTERVIEW = "post_interview"

# In-memory session storage
sessions: dict = {}

# ============================================================================
# Pydantic Models - Request/Response
# ============================================================================

# 1. Start Session
class StartRequest(BaseModel):
    product: str

class StartResponse(BaseModel):
    session_id: str
    questions: list[str]

# 2. Go Live
class LiveStartRequest(BaseModel):
    session_id: str

class LiveStartResponse(BaseModel):
    status: str

# 3. Transcript
class TranscriptRequest(BaseModel):
    session_id: str
    text: str

class TranscriptResponse(BaseModel):
    followups: list[str]

# 4. Stop
class LiveStopRequest(BaseModel):
    session_id: str

class LiveStopResponse(BaseModel):
    status: str

# 5. Analysis
class AnalysisRequest(BaseModel):
    session_id: str

class AnalysisRow(BaseModel):
    question: str
    answer: str
    category: str

class AnalysisResponse(BaseModel):
    rows: list[AnalysisRow]

# 6. Report
class ReportRequest(BaseModel):
    session_id: str

class ReportData(BaseModel):
    summary: str
    key_pains: list[str]
    opportunities: list[str]

class ReportResponse(BaseModel):
    report: ReportData

# 7. Yutori Research Proxy
class ResearchTaskRequest(BaseModel):
    task: str
    start_url: Optional[str] = None

class ResearchTaskResponse(BaseModel):
    upstream: dict

# 8. Yutori Scouting Proxy
class ScoutingTaskRequest(BaseModel):
    query: Optional[str] = None
    task: Optional[str] = None
    start_url: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_query(cls, values):
        if isinstance(values, dict) and not values.get("query") and values.get("task"):
            values["query"] = values["task"]
        return values

class ScoutingTaskResponse(BaseModel):
    upstream: dict

# ============================================================================
# LLM Integration (Yutori API)
# ============================================================================

async def call_llm(prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
    """Call Yutori LLM API"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{YUTORI_BASE_URL}/v1/chat/completions",
            headers=yutori_headers(),
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7
            }
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail={"message": "LLM API error", "upstream": json_detail(response)},
            )
        
        data = response.json()
        return data["choices"][0]["message"]["content"]

# ============================================================================
# Prompt Templates
# ============================================================================

INITIAL_QUESTIONS_PROMPT = """You are a product-market fit researcher. Given the following product description, generate exactly 3 insightful interview questions to understand the user's needs, pain points, and current workflow.

Product: {product}

Requirements:
- Questions should be open-ended
- Focus on understanding their current situation
- Avoid leading questions
- Keep questions concise

Return ONLY a JSON array of 3 questions, like:
["Question 1?", "Question 2?", "Question 3?"]"""

FOLLOWUP_PROMPT = """You are a product-market fit researcher conducting a live interview.

Product being researched: {product}

Transcript so far:
{transcript}

Based on what the user just said, suggest exactly 2 follow-up questions that dig deeper into their pain points, needs, or workflow.

Requirements:
- Questions should build on what was just said
- Probe for specifics, examples, or emotions
- Keep questions conversational

Return ONLY a JSON array of 2 questions, like:
["Follow-up question 1?", "Follow-up question 2?"]"""

ANALYSIS_PROMPT = """You are analyzing a product-market fit interview transcript.

Product: {product}

Full Transcript:
{transcript}

Transform this transcript into a structured table. Extract key question-answer pairs and categorize them.

Categories to use:
- Current Workflow
- Pain Point
- Need
- Feature Request
- Competitor Mention
- Budget/Pricing
- Other

Return ONLY a JSON array of objects like:
[
  {{"question": "...", "answer": "...", "category": "..."}},
  {{"question": "...", "answer": "...", "category": "..."}}
]

Extract all meaningful Q&A pairs from the transcript."""

REPORT_PROMPT = """You are generating a product-market fit report.

Product: {product}

Interview Transcript:
{transcript}

Structured Analysis:
{analysis}

Generate a concise PMF report with:
1. A summary (2-3 sentences max)
2. Key pain points identified (list of 2-4 items)
3. Opportunities for the product (list of 2-4 items)

Return ONLY a JSON object like:
{{
  "summary": "...",
  "key_pains": ["pain 1", "pain 2"],
  "opportunities": ["opportunity 1", "opportunity 2"]
}}"""

# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "PMF Researcher API", "version": "1.0.0"}


@app.get("/health/yutori")
async def yutori_health():
    """Check Yutori API availability"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{YUTORI_BASE_URL}/health", headers=yutori_headers())
    return {"status_code": response.status_code, "body": json_detail(response)}


@app.post("/yutori/research/tasks", response_model=ResearchTaskResponse)
async def create_research_task(request: ResearchTaskRequest):
    """Create a Yutori Research task (proxy)"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{YUTORI_BASE_URL}/v1/research/tasks",
            headers=yutori_headers(),
            json=request.model_dump(exclude_none=True),
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=json_detail(response))
    return ResearchTaskResponse(upstream=response.json())


@app.get("/yutori/research/tasks/{task_id}", response_model=ResearchTaskResponse)
async def get_research_task(task_id: str):
    """Fetch a Yutori Research task status/result (proxy)"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(
            f"{YUTORI_BASE_URL}/v1/research/tasks/{task_id}",
            headers=yutori_headers(),
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=json_detail(response))
    return ResearchTaskResponse(upstream=response.json())


@app.post("/yutori/scouting/tasks", response_model=ScoutingTaskResponse)
async def create_scouting_task(request: ScoutingTaskRequest):
    """Create a Yutori Scouting task (proxy)"""
    payload = request.model_dump(exclude_none=True)
    if "query" not in payload:
        raise HTTPException(status_code=422, detail="Missing required field: query")
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{YUTORI_BASE_URL}/v1/scouting/tasks",
            headers=yutori_headers(),
            json=payload,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=json_detail(response))
    return ScoutingTaskResponse(upstream=response.json())


@app.get("/yutori/scouting/tasks/{task_id}", response_model=ScoutingTaskResponse)
async def get_scouting_task(task_id: str):
    """Fetch a Yutori Scouting task status/result (proxy)"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(
            f"{YUTORI_BASE_URL}/v1/scouting/tasks/{task_id}",
            headers=yutori_headers(),
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=json_detail(response))
    return ScoutingTaskResponse(upstream=response.json())


# 1️⃣ Start Session (Product Input)
@app.post("/start", response_model=StartResponse)
async def start_session(request: StartRequest):
    """
    Start a new interview session with product description.
    Generates initial interview questions.
    """
    session_id = str(uuid.uuid4())[:8]
    
    # Generate initial questions using LLM
    prompt = INITIAL_QUESTIONS_PROMPT.format(product=request.product)
    llm_response = await call_llm(prompt)
    
    # Parse JSON response
    import json
    try:
        # Clean up response if needed
        clean_response = llm_response.strip()
        if clean_response.startswith("```"):
            clean_response = clean_response.split("```")[1]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:]
        questions = json.loads(clean_response)
    except json.JSONDecodeError:
        # Fallback questions if parsing fails
        questions = [
            f"How do you currently handle {request.product.split()[0].lower()} tasks?",
            "What's the biggest challenge you face in this area?",
            "What tools or solutions have you tried?"
        ]
    
    # Store session
    sessions[session_id] = {
        "session_id": session_id,
        "product": request.product,
        "questions": questions,
        "transcript": [],
        "status": SessionStatus.CREATED,
        "rows": [],
        "report": None,
        "created_at": datetime.utcnow().isoformat()
    }
    
    return StartResponse(session_id=session_id, questions=questions)


# 2️⃣ Go Live (Start Interview)
@app.post("/live/start", response_model=LiveStartResponse)
async def go_live(request: LiveStartRequest):
    """
    Mark session as LIVE and initialize for real-time transcription.
    """
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[request.session_id]
    session["status"] = SessionStatus.LIVE
    session["transcript"] = []
    session["live_started_at"] = datetime.utcnow().isoformat()
    
    return LiveStartResponse(status="live")


# 3️⃣ Live Transcription + Follow-Ups
@app.post("/live/transcript", response_model=TranscriptResponse)
async def add_transcript(request: TranscriptRequest):
    """
    Append text to transcript and get AI-suggested follow-up questions.
    Call this repeatedly during the interview.
    """
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[request.session_id]
    
    if session["status"] != SessionStatus.LIVE:
        raise HTTPException(status_code=400, detail="Session is not live")
    
    # Append to transcript
    session["transcript"].append({
        "text": request.text,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Build transcript string
    transcript_text = "\n".join([t["text"] for t in session["transcript"]])
    
    # Generate follow-ups using LLM
    prompt = FOLLOWUP_PROMPT.format(
        product=session["product"],
        transcript=transcript_text
    )
    llm_response = await call_llm(prompt)
    
    # Parse JSON response
    import json
    try:
        clean_response = llm_response.strip()
        if clean_response.startswith("```"):
            clean_response = clean_response.split("```")[1]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:]
        followups = json.loads(clean_response)
    except json.JSONDecodeError:
        followups = [
            "Can you tell me more about that?",
            "How does that affect your day-to-day work?"
        ]
    
    return TranscriptResponse(followups=followups)


# 4️⃣ End Interview
@app.post("/live/stop", response_model=LiveStopResponse)
async def stop_live(request: LiveStopRequest):
    """
    Finalize transcript and end the live interview.
    """
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[request.session_id]
    session["status"] = SessionStatus.POST_INTERVIEW
    session["live_ended_at"] = datetime.utcnow().isoformat()
    
    return LiveStopResponse(status="stopped")


# 5️⃣ Structured Table (Q / A / Category)
@app.get("/analysis", response_model=AnalysisResponse)
async def get_analysis(session_id: str):
    """
    Transform transcript into structured Q/A/Category rows.
    This powers the spreadsheet screen.
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    
    if not session["transcript"]:
        raise HTTPException(status_code=400, detail="No transcript available")
    
    # Build transcript string
    transcript_text = "\n".join([t["text"] for t in session["transcript"]])
    
    # Generate analysis using LLM
    prompt = ANALYSIS_PROMPT.format(
        product=session["product"],
        transcript=transcript_text
    )
    llm_response = await call_llm(prompt)
    
    # Parse JSON response
    import json
    try:
        clean_response = llm_response.strip()
        if clean_response.startswith("```"):
            clean_response = clean_response.split("```")[1]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:]
        rows_data = json.loads(clean_response)
        rows = [AnalysisRow(**row) for row in rows_data]
    except (json.JSONDecodeError, Exception):
        rows = [
            AnalysisRow(
                question="Interview conducted",
                answer="See transcript for details",
                category="Other"
            )
        ]
    
    # Cache the rows
    session["rows"] = [r.model_dump() for r in rows]
    
    return AnalysisResponse(rows=rows)


# 6️⃣ Generate Report
@app.post("/report", response_model=ReportResponse)
async def generate_report(request: ReportRequest):
    """
    Generate a structured PMF report from product + transcript + analysis.
    """
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[request.session_id]
    
    if not session["transcript"]:
        raise HTTPException(status_code=400, detail="No transcript available")
    
    # Build transcript string
    transcript_text = "\n".join([t["text"] for t in session["transcript"]])
    
    # Get analysis if available
    analysis_text = "No structured analysis available"
    if session.get("rows"):

        import json
        analysis_text = json.dumps(session["rows"], indent=2)
    
    # Generate report using LLM
    prompt = REPORT_PROMPT.format(
        product=session["product"],
        transcript=transcript_text,
        analysis=analysis_text
    )
    llm_response = await call_llm(prompt)
    
    # Parse JSON response
    import json
    try:
        clean_response = llm_response.strip()
        if clean_response.startswith("```"):
            clean_response = clean_response.split("```")[1]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:]
        report_data = json.loads(clean_response)
        report = ReportData(**report_data)
    except (json.JSONDecodeError, Exception):
        report = ReportData(
            summary="Interview completed. Review transcript for insights.",
            key_pains=["See transcript for details"],
            opportunities=["Further analysis recommended"]
        )
    
    # Cache the report
    session["report"] = report.model_dump()
    
    return ReportResponse(report=report)


# ============================================================================
# Utility Endpoints
# ============================================================================

@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get full session data (for debugging)"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]


@app.get("/sessions")
async def list_sessions():
    """List all sessions (for debugging)"""
    return {
        "count": len(sessions),
        "sessions": [
            {
                "session_id": s["session_id"],
                "product": s["product"][:50] + "..." if len(s["product"]) > 50 else s["product"],
                "status": s["status"],
                "transcript_length": len(s["transcript"])
            }
            for s in sessions.values()
        ]
    }


# ============================================================================
# Run Server
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
