# Adding a New Agent Feature to AI QA Agent Hub

## 1. Create the Agent HTML Page
- Location: `/s:\PROJECTS\AiQaAgentsHub\<agent-name>.html`
- Use the structure from existing agent HTML files (header, main, output, status button, etc.)
- Add a reference to the agent in `index.html` (in the "Choose an Agent" grid).

## 2. Add CSS
- Use `styles.css` for custom styles.
- Reuse Tailwind and existing classes for layout and effects.

## 3. Add JavaScript
- Create `/js/<agent-name>.js` for agent logic.
- Import shared modules as needed (`db.js`, `aiService.js`, etc.).
- Add `<script type="module" src="js/<agent-name>.js"></script>` to the agent HTML.

## 4. Database Storage
- Use `addApiCall` from `db.js` to log agent usage.
- Define a new `type` for the agent (e.g., `'myagent'`) for dashboard filtering.

## 5. Token Display in Dashboard
- Update `dashboard.html`:
  - Add a new stat card for your agent (copy/paste and adjust label/color).
  - Update `js/dashboard.js` to count and display calls/tokens for your agent's type.

## 6. AI Service Changes
- Update `js/aiService.js`:
  - Add a new exported function for your agent's AI prompt/response logic.
  - Ensure it uses `fetchFromApi` and logs to DB.

## 7. Settings Modal (if needed)
- If your agent needs custom settings, update the modal in `index.html` and logic in `js/settings.js`.

## 8. Status/Docs Button
- Add/update the status/docs button logic in your agent HTML (see `index.html` for dynamic provider button code).

## 9. README Update
- Document your agent's purpose, usage, and integration steps here for future reference.

## 10. Agent Context: Provider & Model
- In your agent HTML, add:
  ```html
  <script>
    window.AI_PROVIDER = localStorage.getItem('ai-provider') || 'gemini';
    window.AI_MODEL = localStorage.getItem('selected-model') || 'gemini-2.5-flash';
  </script>
  ```
- In your JS (UI, DB, etc.), use:
  ```javascript
  const providerContext = window.AI_PROVIDER || 'gemini';
  const modelContext = window.AI_MODEL || 'gemini-2.5-flash';
  ```
- This ensures your agent always knows which provider/model is active for correct API calls, UI display, and DB logging.

---

## Example Checklist (fill in for your agent):

- [ ] Created `myagent.html`
- [ ] Added entry to "Choose an Agent" in `index.html`
- [ ] Created `js/myagent.js`
- [ ] Updated `dashboard.html` and `js/dashboard.js`
- [ ] Updated `js/aiService.js` with `getMyAgentResponse()`
- [ ] Updated DB logging with type `'myagent'`
- [ ] Updated settings modal if needed
- [ ] Updated status/docs button logic
- [ ] Documented agent here

---

**Tip:**  
Use this file as a checklist and reference for all necessary changes when launching a new agent feature.
