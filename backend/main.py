"""AI Stock Analyst backend — Milestone 3: The Brain.

Two endpoints wrap an LLM (DeepSeek, OpenAI-compatible API):
- POST /interpret-profile: plain-English instructions -> investor profile + strategy
- POST /chat: grounded Q&A about the portfolio and recorded decisions

Paper trading only. The model proposes and explains; it never executes anything
from this service (execution + safeguards arrive in Milestone 4).
"""

import json
import os
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url=os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
)
MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

app = FastAPI(title="AI Stock Analyst backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-stock-analyst-backend"}


# ---------------------------------------------------------------------------
# Profile interpretation
# ---------------------------------------------------------------------------

INTERPRET_SYSTEM = """You are the strategy engine of a personal AI stock analyst \
for a beginner investor using a simulated paper-trading account.

You receive the user's CURRENT investor profile and strategy as JSON, plus NEW \
plain-English instructions. Merge the new instructions into the profile and \
strategy. Keep everything that still applies; change only what the new \
instructions affect; never invent preferences the user did not state.

Constraints:
- US-listed stocks and broad-market ETFs only. No options, margin, short \
selling, or crypto.
- The universe is a watchlist of at most 10 liquid symbols consistent with the \
user's stated interests. When preferred sectors or avoided names change, add \
or remove universe symbols to match.
- riskTolerance is exactly one of: "conservative", "moderate", "aggressive".
- Rules must be concrete and checkable, and must always include an approval \
rule ("Propose, don't execute — every order needs approval") unless the user \
explicitly asked for autonomous mode.
- Write for a smart beginner: plain language, no jargon.

Respond with JSON only, exactly this shape:
{
  "profile": {
    "goals": str,
    "riskTolerance": "conservative" | "moderate" | "aggressive",
    "timeHorizon": str,
    "preferredSectors": [str],
    "avoid": [str],
    "marketViews": [str],
    "tradingFrequency": str
  },
  "strategy": {
    "summary": str,
    "watching": [str],
    "rules": [str],
    "universe": [str]
  }
}"""


class InterpretRequest(BaseModel):
    instructions: str
    profile: dict[str, Any]
    strategy: dict[str, Any]


@app.post("/interpret-profile")
def interpret_profile(req: InterpretRequest) -> dict[str, Any]:
    if not req.instructions.strip():
        raise HTTPException(status_code=400, detail="instructions is empty")
    current = {
        "profile": req.profile,
        "strategy": req.strategy,
    }
    completion = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": INTERPRET_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"CURRENT:\n{json.dumps(current)}\n\n"
                    f"NEW INSTRUCTIONS:\n{req.instructions}"
                ),
            },
        ],
        temperature=0.3,
    )
    try:
        result = json.loads(completion.choices[0].message.content or "{}")
        return {"profile": result["profile"], "strategy": result["strategy"]}
    except (json.JSONDecodeError, KeyError) as exc:
        raise HTTPException(status_code=502, detail=f"model returned bad JSON: {exc}")


# ---------------------------------------------------------------------------
# Grounded chat
# ---------------------------------------------------------------------------

CHAT_SYSTEM = """You are a personal AI stock analyst and portfolio manager \
talking to the account owner — a beginner investor with a SIMULATED \
paper-trading account. Real money is never involved.

Ground every answer in the ACCOUNT STATE JSON below: the investor profile, \
strategy, portfolio, and recorded decisions (each with evidence and safeguard \
results). When asked why something happened, cite the recorded decision — do \
not invent trades, prices, news, or reasons that are not in the records. If \
the records don't contain the answer, say so plainly.

Style: warm, concise, plain language for a smart beginner. A few sentences, \
not essays. Never give advice about real-money investing; if asked, remind \
the user this is a simulated learning account.

ACCOUNT STATE:
"""


class ChatMessage(BaseModel):
    role: Literal["user", "agent"]
    text: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: dict[str, Any]


@app.post("/chat")
def chat(req: ChatRequest) -> dict[str, str]:
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages is empty")
    history = [
        {
            "role": "user" if m.role == "user" else "assistant",
            "content": m.text,
        }
        for m in req.messages[-12:]
    ]
    completion = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": CHAT_SYSTEM + json.dumps(req.context)},
            *history,
        ],
        temperature=0.5,
    )
    return {"text": completion.choices[0].message.content or ""}
