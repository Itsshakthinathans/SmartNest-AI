# SmartNest AI Development Customizations

## Rules

### Browser Launch & Runtime Verification Constraints
Unless the user explicitly requests runtime verification:
* Do NOT launch the browser.
* Do NOT create browser verification tasks.
* Do NOT capture screenshots.
* Do NOT record videos.
* Do NOT wait for browser completion.

Responsibilities are limited to:
1. Studying the implementation.
2. Modifying the required code.
3. Building the affected project.
4. Explaining the changes.
5. Producing the walkthrough.

The user will perform all runtime verification manually. If runtime verification is needed by the agent, the agent must ask the user first.
