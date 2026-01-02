from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
import json
import sqlite3
import os
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime
from contextlib import asynccontextmanager

# Import backend components
from agentd_backend.agentD_2 import initialize_agent, invoke_agent, summarize_chat_history
from agentd_backend.mcp_config import router as mcp_router
from agentd_backend.system_metrics import (
    get_system_metrics, 
    get_detailed_system_info, 
    log_system_metrics, 
    get_historical_metrics
)

# --- Database Initialization ---
DB_PATH = "memory.sqlite"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Chat Tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )""")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )""")
    # Agent Tasks Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS agent_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        task TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_result TEXT
    )""")
    conn.commit()
    conn.close()

init_db()

# --- Background Tasks ---
async def periodic_metrics_logger(interval_seconds: int = 60):
    while True:
        try:
            log_system_metrics()
        except Exception as e:
            print(f"[Periodic Logger] Error: {e}")
        await asyncio.sleep(interval_seconds)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing LangGraph agent...")
    await initialize_agent()
    asyncio.create_task(periodic_metrics_logger(60))
    yield
    print("Application shutting down...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Frontend Setup ---
frontend_dist_dir = Path(__file__).parent / "agentd-web" / "dist"
if not frontend_dist_dir.exists():
    print("Warning: React build directory not found. Run `npm run build` in frontend folder.")
else:
    app.mount("/assets", StaticFiles(directory=frontend_dist_dir / "assets"), name="assets")
    templates = Jinja2Templates(directory=frontend_dist_dir)

# Include MCP router
app.include_router(mcp_router, prefix="/api")

# --- API Routes ---

# 1. System Metrics
@app.get("/api/system-metrics")
async def get_metrics():
    return JSONResponse(content=get_system_metrics())

@app.get("/api/historical-metrics/{time_range}")
async def get_historical(time_range: str):
    return JSONResponse(content={"metrics": get_historical_metrics(time_range), "time_range": time_range})

# 2. Chat & Messaging
@app.post("/api/chat")
async def chat_endpoint(payload: Dict[str, Any]):
    session_id = payload.get("session_id")
    user_message = payload.get("message")
    
    async def event_generator():
        config = {"configurable": {"thread_id": session_id}}
        async for event in invoke_agent(user_message, config):
            yield f"data: {json.dumps(event)}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/chat_sessions")
async def list_sessions():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC")
    sessions = [{"id": r[0], "title": r[1], "created_at": r[2], "updated_at": r[3]} for r in cursor.fetchall()]
    conn.close()
    return JSONResponse(content={"sessions": sessions})

# 3. Zapier MCP Configuration
@app.get("/api/zapier_mcp")
async def get_zapier_mcp():
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "browser_mcp.json")
    if os.path.exists(path):
        with open(path, 'r') as f:
            config = json.load(f)
            return {"url": config.get("mcpServers", {}).get("zapier", {}).get("url", "")}
    return {"url": ""}

@app.post("/api/zapier_mcp")
async def update_zapier_mcp(payload: Dict[str, Any]):
    url = payload.get("url", "")
    if not url.startswith("https://actions.zapier.com/mcp/"):
        raise HTTPException(status_code=400, detail="Invalid Zapier URL format")
    
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "browser_mcp.json")
    config = json.load(open(path)) if os.path.exists(path) else {"mcpServers": {}}
    config["mcpServers"]["zapier"] = {"url": url}
    
    with open(path, 'w') as f:
        json.dump(config, f, indent=2)
    return {"status": "success", "url": url}

# 4. Agent Tasks
@app.get("/api/agent_tasks")
async def get_agent_tasks():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, description, task, created_at, last_result FROM agent_tasks ORDER BY created_at DESC")
    tasks = [{"id": r[0], "name": r[1], "description": r[2], "task": r[3], "created_at": r[4], "last_result": r[5]} for r in cursor.fetchall()]
    conn.close()
    return {"tasks": tasks}

@app.post("/api/agent_tasks")
async def create_agent_task(payload: Dict[str, Any]):
    name, task = payload.get("name"), payload.get("task")
    if not name or not task:
        raise HTTPException(status_code=400, detail="Name and task are required")
    
    task_id = f"task_{int(datetime.utcnow().timestamp() * 1000)}"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO agent_tasks (id, name, description, task) VALUES (?, ?, ?, ?)", 
                   (task_id, name, payload.get("description"), task))
    conn.commit()
    conn.close()
    return {"id": task_id, "status": "created"}

# --- Catch-all for Frontend ---
@app.get("/{full_path:path}", response_class=HTMLResponse)
async def serve_frontend(request: Request, full_path: str):
    if not frontend_dist_dir.exists():
        return HTMLResponse("Frontend not built. Please run <code>npm run build</code>.")
    return templates.TemplateResponse("index.html", {"request": request})

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)