"""
PMF Researcher Backend - Simple Interview & Analysis API
One flow, one service, no complexity.
"""

import os
import uuid
import asyncio
import httpx
from enum import Enum
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, model_validator
from elevenlabs.client import ElevenLabs

load_dotenv()

# ============================================================================
# Configuration
# ============================================================================

YUTORI_API_KEY = os.getenv("YUTORI_API_KEY") or os.getenv("yutori")
YUTORI_BASE_URL = os.getenv("YUTORI_BASE_URL", "https://api.yutori.com")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")


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


def openai_headers() -> dict:
    if not OPENAI_API_KEY:
        return {}
    return {"Authorization": f"Bearer {OPENAI_API_KEY}"}


def openai_json_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if OPENAI_API_KEY:
        headers["Authorization"] = f"Bearer {OPENAI_API_KEY}"
    return headers


def deepgram_headers() -> dict:
    if not DEEPGRAM_API_KEY:
        return {}
    return {"Authorization": f"Token {DEEPGRAM_API_KEY}"}

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

# Single persistent session ID (created on first request)
current_session_id: Optional[str] = None

# ============================================================================
# Pydantic Models - Request/Response
# ============================================================================

# 1. Start Session
class StartRequest(BaseModel):
    product: str
    count: int = 3

class StartResponse(BaseModel):
    session_id: str
    questions: list[str]

# 1b. Generate Questions (no session)
class QuestionsRequest(BaseModel):
    product: str
    count: int = 5

class QuestionsResponse(BaseModel):
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
    query: Optional[str] = None
    task: Optional[str] = None
    start_url: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_query(cls, values):
        if isinstance(values, dict) and not values.get("query") and values.get("task"):
            values["query"] = values["task"]
        return values

class ResearchTaskResponse(BaseModel):
    upstream: dict

# 7b. Product Research
class ProductResearchRequest(BaseModel):
    product: str
    focus: Optional[str] = None
    start_url: Optional[str] = None

class ProductResearchResponse(BaseModel):
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

# 9. Deepgram API Key
class DeepgramKeyResponse(BaseModel):
    api_key: Optional[str] = None
    message: str = ""

# 10. Question Status Management
class QuestionStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    DONE = "done"
    SKIPPED = "skipped"

class QuestionWithStatus(BaseModel):
    id: str
    text: str
    status: QuestionStatus
    created_at: str
    order: int

class GetQuestionsResponse(BaseModel):
    questions: list[QuestionWithStatus]
    current_question: Optional[QuestionWithStatus] = None

class UpdateQuestionStatusRequest(BaseModel):
    session_id: str
    question_id: str
    status: QuestionStatus

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

        try:
            data = response.json()
        except ValueError:
            raise HTTPException(
                status_code=502,
                detail={"message": "LLM API returned non-JSON body", "body": response.text},
            )
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
            raise HTTPException(status_code=502, detail={"message": "LLM API invalid response", "upstream": data})
        message = choices[0].get("message")
        if not isinstance(message, dict) or "content" not in message:
            raise HTTPException(status_code=502, detail={"message": "LLM API invalid response", "upstream": data})
        return message["content"]


async def call_llm_with_timeout(
    prompt: str,
    system_prompt: str = "You are a helpful assistant.",
    timeout_s: float = 12.0,
) -> str:
    return await asyncio.wait_for(call_llm(prompt, system_prompt), timeout=timeout_s)


async def call_openai_chat(prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers=openai_json_headers(),
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.7,
            },
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=json_detail(response))
    data = response.json()
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise HTTPException(status_code=502, detail={"message": "OpenAI invalid response", "upstream": data})
    message = choices[0].get("message")
    if not isinstance(message, dict) or "content" not in message:
        raise HTTPException(status_code=502, detail={"message": "OpenAI invalid response", "upstream": data})
    return message["content"]

# ============================================================================
# Prompt Templates
# ============================================================================

def questions_prompt(product: str, count: int) -> str:
    examples = ", ".join([f"\"Question {i+1}?\"" for i in range(count)])
    return f"""You are a product-market fit researcher. Given the following product description, generate exactly {count} insightful interview questions to understand the user's needs, pain points, and current workflow.

Product: {product}

Requirements:
- Questions should be open-ended
- Focus on understanding their current situation
- Avoid leading questions
- Keep questions concise

Return ONLY a JSON array of {count} questions, like:
[{examples}]"""

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


@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio with timestamps via OpenAI"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")
    data = {
        "model": "whisper-1",
        "response_format": "verbose_json",
        "timestamp_granularities[]": "segment",
    }
    files = {
        "file": (
            file.filename or "audio.wav",
            audio_bytes,
            file.content_type or "application/octet-stream",
        )
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers=openai_headers(),
            data=data,
            files=files,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=json_detail(response))
    return response.json()


@app.post("/transcribe/deepgram")
async def transcribe_audio_deepgram(file: UploadFile = File(...)):
    """Transcribe audio with Deepgram (timestamps included)."""
    if not DEEPGRAM_API_KEY:
        raise HTTPException(status_code=500, detail="DEEPGRAM_API_KEY is not configured")
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")
    params = {
        "model": "nova-2",
        "smart_format": "true",
        "punctuate": "true",
        "timestamps": "true",
        "utterances": "true",
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.deepgram.com/v1/listen",
            headers=deepgram_headers() | {"Content-Type": file.content_type or "application/octet-stream"},
            params=params,
            content=audio_bytes,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=json_detail(response))
    return response.json()


@app.post("/yutori/research/tasks", response_model=ResearchTaskResponse)
async def create_research_task(request: ResearchTaskRequest):
    """Create a Yutori Research task (proxy)"""
    payload = request.model_dump(exclude_none=True)
    if "query" not in payload:
        raise HTTPException(status_code=422, detail="Missing required field: query")
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{YUTORI_BASE_URL}/v1/research/tasks",
            headers=yutori_headers(),
            json=payload,
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


@app.post("/research", response_model=ProductResearchResponse)
async def research_product(request: ProductResearchRequest):
    """Create a Yutori research task for a product."""
    focus = request.focus or "market size, competitors, pricing, and target users"
    task = (
        "Research the product described and summarize key findings.\n"
        f"Product: {request.product}\n"
        f"Focus: {focus}"
    )
    payload = {"query": task}
    if request.start_url:
        payload["start_url"] = request.start_url
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{YUTORI_BASE_URL}/v1/research/tasks",
            headers=yutori_headers(),
            json=payload,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=json_detail(response))
    return ProductResearchResponse(upstream=response.json())


@app.get("/research/{task_id}", response_model=ProductResearchResponse)
async def get_product_research(task_id: str):
    """Fetch a Yutori research task status/result."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(
            f"{YUTORI_BASE_URL}/v1/research/tasks/{task_id}",
            headers=yutori_headers(),
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=json_detail(response))
    return ProductResearchResponse(upstream=response.json())


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


# ============================================================================
# Deepgram Integration
# ============================================================================

@app.get("/deepgram-key", response_model=DeepgramKeyResponse)
async def get_deepgram_key():
    """
    Returns Deepgram API key for frontend WebSocket connection.
    In production, use a more secure method (e.g., generate temporary tokens).
    """
    if not DEEPGRAM_API_KEY:
        return DeepgramKeyResponse(
            api_key=None,
            message="DEEPGRAM_API_KEY not set. Get a free API key at https://deepgram.com (60 hours/month free)"
        )
    return DeepgramKeyResponse(
        api_key=DEEPGRAM_API_KEY,
        message="Deepgram API key available"
    )


# Get or Create Single Persistent Session
@app.get("/get-session", response_model=StartResponse)
async def get_session():
    """
    Get or create a single persistent session for the entire app.
    Ensures only one session exists at a time.
    """
    global current_session_id

    # If session already exists, return it
    if current_session_id and current_session_id in sessions:
        session = sessions[current_session_id]
        return StartResponse(session_id=current_session_id, questions=session.get("questions", []))

    # Create new session
    session_id = str(uuid.uuid4())[:8]
    current_session_id = session_id

    # Initial questions
    questions = [
        "How do you currently approach this?",
        "What's the biggest challenge you face?",
        "What tools or solutions have you considered?"
    ]

    # Store session
    sessions[session_id] = {
        "session_id": session_id,
        "product": "Interview Session",
        "questions": questions,
        "transcript": [],
        "status": SessionStatus.CREATED,
        "rows": [],
        "report": None,
        "created_at": datetime.utcnow().isoformat()
    }

    print(f"Created persistent session: {session_id}")
    return StartResponse(session_id=session_id, questions=questions)


# 1️⃣ Start Session (Product Input)
@app.post("/start", response_model=StartResponse)
async def start_session(request: StartRequest):
    """
    Start a new interview session with product description.
    Generates initial interview questions.
    Reuses existing session if available (single session mode).
    """
    global current_session_id

    # Reuse existing session if available, otherwise create new
    if current_session_id and current_session_id in sessions:
        session_id = current_session_id
        session = sessions[session_id]
        # Update product description
        session["product"] = request.product
        questions = session.get("questions", [])
    else:
        session_id = str(uuid.uuid4())[:8]
        current_session_id = session_id
        questions = []

        # Generate initial questions using LLM (with fallback)
        prompt = INITIAL_QUESTIONS_PROMPT.format(product=request.product)
        llm_response = None

        try:
            llm_response = await call_llm_with_timeout(prompt, timeout_s=10.0)
        except Exception as e:
            print(f"LLM call failed, using fallback questions: {e}")
            llm_response = None

        # Parse JSON response
        import json
        if llm_response:
            try:
                # Clean up response if needed
                clean_response = llm_response.strip()
                if clean_response.startswith("```"):
                    clean_response = clean_response.split("```")[1]
                    if clean_response.startswith("json"):
                        clean_response = clean_response[4:]
                questions = json.loads(clean_response)
            except json.JSONDecodeError as e:
                print(f"JSON parsing failed: {e}")
                questions = []

        if not questions:
            # Fallback questions if parsing fails or LLM unavailable
            questions = [
                f"How do you currently handle {(request.product.split()[0].lower() if request.product.split() else 'your')} tasks?",
                "What's the biggest challenge you face in this area?",
                "What tools or solutions have you tried?"
            ]

        # Store session (keep original structure)
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

    print(f"Using session: {session_id}")
    print(f"Total sessions: {len(sessions)}")
    return StartResponse(session_id=session_id, questions=questions)


@app.post("/questions", response_model=QuestionsResponse)
async def generate_questions(request: QuestionsRequest):
    """Generate interview questions without creating a session."""
    count = max(1, min(request.count, 10))
    prompt = questions_prompt(request.product, count)
    llm_response = None
    try:
        llm_response = await call_llm_with_timeout(prompt)
    except (Exception, asyncio.TimeoutError):
        llm_response = None

    import json
    if llm_response:
        try:
            clean_response = llm_response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            questions = json.loads(clean_response)
        except json.JSONDecodeError:
            questions = []
    else:
        questions = []

    if not questions and OPENAI_API_KEY:
        try:
            openai_response = await call_openai_chat(prompt)
            clean_response = openai_response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            questions = json.loads(clean_response)
        except Exception:
            questions = []

    if not questions:
        base = [
            f"How do you currently handle {request.product.split()[0].lower()} tasks?",
            "What's the biggest challenge you face in this area?",
            "What tools or solutions have you tried?",
            "What would an ideal solution look like for you?",
            "How do you measure success in this part of your workflow?",
        ]
        if len(base) < request.count:
            base.extend(['Any other pain points or needs?' for _ in range(request.count - len(base))])
        questions = base

    return QuestionsResponse(questions=questions)


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

    # Initialize generated questions with the initial questions from /start
    if request.session_id not in generated_questions:
        generated_questions[request.session_id] = []

    # Convert initial questions to question items with status tracking
    initial_questions = session.get("questions", [])
    for idx, question_text in enumerate(initial_questions):
        generated_questions[request.session_id].append({
            "id": str(uuid.uuid4()),
            "text": question_text,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "order": idx
        })

    print(f"Initialized {len(generated_questions[request.session_id])} questions for session {request.session_id}")

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

    # Generate follow-ups using LLM (with fallback)
    prompt = FOLLOWUP_PROMPT.format(
        product=session["product"],
        transcript=transcript_text
    )
    llm_response = None
    followups = []

    try:
        llm_response = await call_llm_with_timeout(prompt, timeout_s=10.0)
    except Exception as e:
        print(f"LLM call failed for follow-ups, using defaults: {e}")
        llm_response = None

    # Parse JSON response
    import json
    if llm_response:
        try:
            clean_response = llm_response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            followups = json.loads(clean_response)
        except json.JSONDecodeError as e:
            print(f"JSON parsing failed for follow-ups: {e}")
            followups = []

    if not followups and OPENAI_API_KEY:
        try:
            openai_response = await call_openai_chat(prompt)
            clean_response = openai_response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            followups = json.loads(clean_response)
        except Exception:
            followups = []

    if not followups:
        followups = [
            "Can you tell me more about that?",
            "How does that affect your day-to-day work?"
        ]

    # Add generated follow-ups to the generated_questions list
    if request.session_id not in generated_questions:
        generated_questions[request.session_id] = []

    current_order = len(generated_questions[request.session_id])
    for idx, followup_text in enumerate(followups):
        generated_questions[request.session_id].append({
            "id": str(uuid.uuid4()),
            "text": followup_text,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "order": current_order + idx
        })

    print(f"Added {len(followups)} follow-up questions to session {request.session_id}")

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


# ============================================================================
# In-Memory Storage for Question States (separate from sessions)
# ============================================================================

# Track question states and generated questions per session
question_states: dict = {}  # {session_id: {question_id: status}, ...}
generated_questions: dict = {}  # {session_id: [questions_with_status], ...}


# ============================================================================
# Helper Function for Question Generation
# ============================================================================

async def generate_and_append_followups(session_id: str):
    """Generate new follow-up questions based on current transcript"""
    if session_id not in sessions:
        return

    session = sessions[session_id]
    transcript_text = "\n".join([t["text"] for t in session["transcript"]])

    if not transcript_text.strip():
        return

    # Generate follow-ups using LLM (with fallback)
    prompt = FOLLOWUP_PROMPT.format(
        product=session["product"],
        transcript=transcript_text
    )
    llm_response = None
    followups = []

    try:
        llm_response = await call_llm_with_timeout(prompt, timeout_s=10.0)
    except Exception as e:
        print(f"LLM call failed for follow-ups generation, using defaults: {e}")
        llm_response = None

    if llm_response:
        import json
        try:
            clean_response = llm_response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]

            followups = json.loads(clean_response)
        except Exception as e:
            print(f"JSON parsing failed for generated follow-ups: {e}")
            followups = []

    if not followups:
        followups = [
            "Can you tell me more about that?",
            "How does that affect your day-to-day work?"
        ]

    # Initialize generated questions list if needed
    if session_id not in generated_questions:
        generated_questions[session_id] = []

    # Append new questions
    current_order = len(generated_questions[session_id])
    for idx, followup_text in enumerate(followups):
        generated_questions[session_id].append({
            "id": str(uuid.uuid4()),
            "text": followup_text,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "order": current_order + idx
        })

    print(f"Generated {len(followups)} follow-up questions for session {session_id}")

# ============================================================================
# Live Questions API (Polling)
# ============================================================================

@app.get("/live/questions", response_model=GetQuestionsResponse)
async def get_live_questions(session_id: str):
    """
    Get current list of generated questions with their statuses.
    Called repeatedly by frontend for polling every 5 seconds.
    """
    print(f"Looking for session: {session_id}")
    print(f"Available sessions: {list(sessions.keys())}")
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found. Available: {list(sessions.keys())}")

    # Initialize generated questions if not exists
    if session_id not in generated_questions:
        generated_questions[session_id] = []

    # Initialize question states if not exists
    if session_id not in question_states:
        question_states[session_id] = {}

    questions_list = generated_questions[session_id]

    # Apply tracked states
    for q in questions_list:
        q["status"] = question_states[session_id].get(q["id"], "pending")

    # Find current active question or first pending
    current_question = None
    for q in questions_list:
        if q["status"] == "active":
            current_question = q
            break

    if not current_question:
        for q in questions_list:
            if q["status"] == "pending":
                current_question = q
                break

    return GetQuestionsResponse(
        questions=[QuestionWithStatus(**q) for q in questions_list],
        current_question=QuestionWithStatus(**current_question) if current_question else None
    )


@app.post("/live/question/status")
async def update_question_status(request: UpdateQuestionStatusRequest):
    """
    Update question status (pending/active/done/skipped).
    - 'done': Remove question from list (completed)
    - 'skipped': Remove question from list (not relevant)
    - 'active': Activate the question
    """
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    if request.session_id not in generated_questions:
        generated_questions[request.session_id] = []

    questions_list = generated_questions[request.session_id]

    if request.status == "done" or request.status == "skipped":
        # Remove the question from the list
        questions_list[:] = [q for q in questions_list if q["id"] != request.question_id]
        print(f"Removed question {request.question_id} (status: {request.status}). Remaining: {len(questions_list)}")
    elif request.status == "active":
        # Mark as active, deactivate others
        for q in questions_list:
            if q["id"] == request.question_id:
                q["status"] = "active"
            elif q["status"] == "active":
                q["status"] = "pending"
        print(f"Activated question {request.question_id}")

    return {"status": "updated"}


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
    if llm_response:
        try:
            clean_response = llm_response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            rows_data = json.loads(clean_response)
            rows = [AnalysisRow(**row) for row in rows_data]
        except (json.JSONDecodeError, Exception):
            rows = []
    else:
        rows = []

    if not rows and OPENAI_API_KEY:
        try:
            openai_response = await call_openai_chat(prompt)
            clean_response = openai_response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            rows_data = json.loads(clean_response)
            rows = [AnalysisRow(**row) for row in rows_data]
        except Exception:
            rows = []

    if not rows:
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
    if llm_response:
        try:
            clean_response = llm_response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            report_data = json.loads(clean_response)
            report = ReportData(**report_data)
        except (json.JSONDecodeError, Exception):
            report = None
    else:
        report = None

    if report is None and OPENAI_API_KEY:
        try:
            openai_response = await call_openai_chat(prompt)
            clean_response = openai_response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            report_data = json.loads(clean_response)
            report = ReportData(**report_data)
        except Exception:
            report = None

    if report is None:
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
