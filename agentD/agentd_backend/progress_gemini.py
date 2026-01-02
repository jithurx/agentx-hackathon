import os
from google import genai
from dotenv import load_dotenv
import time
load_dotenv()

client = genai.Client()

def generate_progress_steps(prompt, max_steps=6):
    system_prompt = f"""
You are generating UI progress updates for a web automation agent.

Task:
{prompt}

Rules:
- Generate {max_steps} short progress steps
- Steps should look realistic for browser-based automation
- Do NOT include results
- Each step should be one short sentence
- Output as a numbered list only
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=system_prompt
    )

    steps = []
    for line in response.text.splitlines():
        line = line.strip()
        if line and line[0].isdigit():
            steps.append(line.split(".", 1)[1].strip())
            

    return steps
