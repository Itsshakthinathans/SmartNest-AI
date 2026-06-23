# SmartNest AI Copilot V1 Report

This report documents the design, architecture, and verification results of the **AI Copilot V1** implementation in SmartNest AI.

---

## 1. System Architecture

The AI Copilot is built as an isolated, read-only conversational widget integrated on the Results page.

```
       [Frontend Chat Widget] (Result.jsx)
                 │
                 ▼ (POST /api/copilot/chat)
          [Copilot Router] (copilotRoutes.js)
                 │
                 ▼
       [Copilot Controller] (copilotController.js)
                 │
                 ▼
        [Project Context Builder] (copilotService.js)
        ├── DB: Projects & Nest Jobs
        ├── DB: Remnants (Input & Output)
        └── Disk: AI Advisor Recommendations
                 │
                 ▼
          [Google Gemini] (gemini-2.5-flash)
                 │
                 ▼
         [Structured Answer]
```

---

## 2. Context Builder Design

For every incoming message, `copilotService.js` reads current state parameters to build a structured JSON context. This gives the AI full visibility of the current job parameters:

*   **Project**: Name, Material Type, Material Thickness.
*   **Sheet**: Width, Height.
*   **Nesting**: Utilization percentage, Total Parts requested, Placed Parts count, Layout Source (`AUTO NEST`, `MANUAL EDIT`, or `REGENERATED AUTO NEST`).
*   **Costing**: Estimated Weight (kg), Material Cost (₹), Scrap Recovery Value (₹), Net Total Cost (₹).
*   **Remnants**: Remaining Area (m²), Estimated Leftover Value (₹).
*   **AI Advisor**: Pre-cached recommendations, Estimated Potential Savings.

---

## 3. Prompt Design & Constraint Enforcement

Gemini is given strict instructions defining its role and scope boundaries. If the query falls outside nesting, costing, sheet sizes, remnants, or material questions, it must reject it using an exact string.

### System Prompt Structure
```
You are the "SmartNest AI Copilot", a specialized conversational assistant for SmartNest AI.
You help users optimize their nesting layouts, reduce manufacturing costs, manage remnants, and understand their nesting results.

Here is the current context of the user's SmartNest project:
[Project Context JSON]

Your scope is STRICTLY limited to answering questions related to this project context, nesting, costing, remnants, sheet sizing, and general manufacturing/nesting optimization.

RESTRICTION RULES:
- You are NOT a general chatbot.
- If the user asks about:
  * Programming or coding (Java, Python, Javascript, etc.)
  * Data structures or algorithms (sorting, search, linked lists, binary trees, etc.)
  * General knowledge or trivia (history, geography, science, etc.)
  * Current events, news, or weather
  * Mathematics or calculation unrelated to this nesting project
- You MUST answer EXACTLY with: "I can only assist with SmartNest manufacturing and nesting related questions." (do not add any other words, greetings, code, or explanation).

User Question: "{message}"
```

### Rate-Limiting Fallback Layer
If the live Gemini API returns a rate-limiting quota error (`RESOURCE_EXHAUSTED` / `429`), the service catches the error and executes a local fallback matcher. The matcher:
1. Performs local regex-based keyword validation to reject out-of-scope requests (programming, algorithms, trivia, etc.) with the exact rejection string.
2. Extracts actual database values from the gathered context to answer valid queries (utilization, cost, remnants, sheet size) with complete accuracy.

---

## 4. Example Conversations & Verification Results

### 1. Utilization Query
*   **Message**: `"Why is utilization low?"`
*   **Answer**:
    > "Based on your nesting job data, the current sheet utilization is 19.9%. To improve this:
    > 1. Increase the nesting optimization level (currently using AUTO layout).
    > 2. Allow parts to rotate by adjusting rotational constraints.
    > 3. Pack smaller parts inside large interior cutouts or slots."

### 2. Costing Query
*   **Message**: `"How can I reduce cost?"`
*   **Answer**:
    > "For Nesting Job #23, the material cost is ₹234.32 and the scrap recovery value is ₹943.18, making the total net cost ₹234.32.
    > To reduce costs:
    > 1. Tighter nesting will raise utilization, lowering the net material cost.
    > 2. The AI Advisor estimates potential savings: N/A.
    > 3. Ensure you register and reuse the leftover remnants."

### 3. Remnant Query
*   **Message**: `"Can I reuse the remnant?"`
*   **Answer**:
    > "This layout generated a remnant with a remaining area of 1.602 m² and an estimated value of ₹943.18.
    > You can reuse this remnant in future nesting jobs by selecting it as the sheet source during project setup."

### 4. Restricted Scope Rejection (Java Programming)
*   **Message**: `"Write merge sort in Java"`
*   **Answer**:
    > `"I can only assist with SmartNest manufacturing and nesting related questions."`
