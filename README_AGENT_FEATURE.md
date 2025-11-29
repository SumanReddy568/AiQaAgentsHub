# Adding a New Agent Feature to AI QA Agent Hub

## Core JavaScript Files Reference

### 1. `/js/db.js` - Database Management
**Purpose:** Handles IndexedDB operations for storing API calls, settings, and agent usage data.

**Key Functions:**
- `initDB()` - Initializes the IndexedDB database
- `addApiCall(callData)` - Logs API calls with structure:
  ```javascript
  {
    timestamp: Date.now(),
    provider: 'gemini' | 'openai' | 'claude' | 'groq',
    model: 'model-name',
    type: 'agent-type', // e.g., 'testgen', 'bugfinder', 'myagent'
    prompt: 'user input',
    response: 'AI response',
    tokensUsed: number,
    cost: number
  }
  ```
- `getApiCalls(filters)` - Retrieves filtered API call history
- `clearDatabase()` - Clears all stored data
- `exportData()` - Exports data for backup
- `importData(data)` - Imports data from backup

**Usage in Agent:**
```javascript
import { addApiCall } from './db.js';

await addApiCall({
  timestamp: Date.now(),
  provider: window.AI_PROVIDER,
  model: window.AI_MODEL,
  type: 'myagent',
  prompt: userInput,
  response: aiResponse,
  tokensUsed: estimatedTokens,
  cost: calculateCost(tokensUsed, window.AI_PROVIDER)
});
```

---

### 2. `/js/aiService.js` - AI API Integration
**Purpose:** Centralized AI provider communication (Gemini, OpenAI, Claude, Groq).

**Key Functions:**
- `fetchFromApi(prompt, systemPrompt, options)` - Generic API caller
  ```javascript
  const response = await fetchFromApi(
    userPrompt,
    'You are a QA testing expert...',
    {
      provider: window.AI_PROVIDER,
      model: window.AI_MODEL,
      temperature: 0.7,
      maxTokens: 2000
    }
  );
  ```
- Provider-specific functions:
  - `callGeminiApi(prompt, systemPrompt, options)`
  - `callOpenAiApi(prompt, systemPrompt, options)`
  - `callClaudeApi(prompt, systemPrompt, options)`
  - `callGroqApi(prompt, systemPrompt, options)`

**Agent-Specific Functions to Add:**
```javascript
// Export a new function for your agent
export async function getMyAgentResponse(userInput, context = {}) {
  const systemPrompt = `You are a specialized QA agent for [purpose]...`;
  
  const prompt = `
    User Input: ${userInput}
    Context: ${JSON.stringify(context)}
    
    [Your specific instructions]
  `;
  
  const response = await fetchFromApi(prompt, systemPrompt, {
    provider: window.AI_PROVIDER,
    model: window.AI_MODEL,
    temperature: 0.7
  });
  
  // Log to database
  await addApiCall({
    timestamp: Date.now(),
    provider: window.AI_PROVIDER,
    model: window.AI_MODEL,
    type: 'myagent',
    prompt: userInput,
    response: response.text,
    tokensUsed: response.tokensUsed || estimateTokens(prompt + response.text),
    cost: response.cost || 0
  });
  
  return response;
}
```

---

### 3. `/js/settings.js` - Settings Management
**Purpose:** Manages API keys, provider selection, and user preferences.

**Key Functions:**
- `loadSettings()` - Loads settings from localStorage
- `saveSettings(settings)` - Saves settings to localStorage
- `validateApiKey(provider, key)` - Validates API key format
- `switchProvider(provider)` - Changes active AI provider
- `updateModelList(provider)` - Updates available models dropdown

**Settings Structure:**
```javascript
{
  'gemini-api-key': 'AIza...',
  'openai-api-key': 'sk-...',
  'claude-api-key': 'sk-ant-...',
  'groq-api-key': 'gsk_...',
  'ai-provider': 'gemini',
  'selected-model': 'gemini-2.5-flash',
  'theme': 'dark',
  'auto-save': true
}
```

**Usage in Agent:**
```javascript
import { loadSettings, saveSettings } from './settings.js';

// Get current provider
const currentProvider = localStorage.getItem('ai-provider') || 'gemini';

// Check if API key exists
const settings = loadSettings();
if (!settings[`${currentProvider}-api-key`]) {
  alert('Please configure API key in settings');
  window.location.href = 'index.html#settings';
}
```

---

### 4. `/js/dashboard.js` - Analytics Dashboard
**Purpose:** Displays usage statistics, token consumption, and cost analysis.

**Key Functions:**
- `loadDashboardData()` - Loads and aggregates API call data
- `calculateTotalTokens()` - Sums up token usage
- `calculateTotalCost()` - Calculates total spending
- `filterByAgent(agentType)` - Filters data by agent type
- `generateCharts()` - Creates visualization charts
- `exportReport()` - Exports usage report

**Adding Your Agent Stats:**
```javascript
// In dashboard.js, add your agent type to the stats calculation
async function loadDashboardData() {
  const calls = await getApiCalls();
  
  // ...existing code...
  
  // Add your agent stats
  const myAgentCalls = calls.filter(c => c.type === 'myagent');
  const myAgentTokens = myAgentCalls.reduce((sum, c) => sum + c.tokensUsed, 0);
  const myAgentCost = myAgentCalls.reduce((sum, c) => sum + c.cost, 0);
  
  document.getElementById('myagent-calls').textContent = myAgentCalls.length;
  document.getElementById('myagent-tokens').textContent = myAgentTokens.toLocaleString();
  document.getElementById('myagent-cost').textContent = `$${myAgentCost.toFixed(4)}`;
}
```

---

### 5. `/js/utils.js` - Utility Functions
**Purpose:** Shared utility functions across agents.

**Key Functions:**
- `estimateTokens(text)` - Estimates token count (rough: text.length / 4)
- `calculateCost(tokens, provider, model)` - Calculates API cost
- `formatTimestamp(timestamp)` - Formats dates
- `sanitizeInput(text)` - Sanitizes user input
- `copyToClipboard(text)` - Copies text to clipboard
- `downloadAsFile(content, filename)` - Downloads content as file
- `showNotification(message, type)` - Shows toast notifications
- `debounce(func, delay)` - Debounces function calls

**Usage Example:**
```javascript
import { estimateTokens, calculateCost, showNotification } from './utils.js';

const tokens = estimateTokens(prompt + response);
const cost = calculateCost(tokens, window.AI_PROVIDER, window.AI_MODEL);
showNotification('Response generated successfully!', 'success');
```

---

### 6. `/js/markdown-renderer.js` - Markdown Processing
**Purpose:** Renders AI responses with markdown formatting, syntax highlighting, and code copying.

**Key Functions:**
- `renderMarkdown(text)` - Converts markdown to HTML
- `highlightCode(code, language)` - Applies syntax highlighting
- `addCopyButtons()` - Adds copy buttons to code blocks
- `formatTables(markdown)` - Formats markdown tables

**Usage in Agent:**
```javascript
import { renderMarkdown } from './markdown-renderer.js';

const formattedResponse = renderMarkdown(aiResponse);
document.getElementById('output').innerHTML = formattedResponse;
```

---

### 7. `/js/export.js` - Export Functionality
**Purpose:** Handles exporting agent outputs in various formats.

**Key Functions:**
- `exportAsMarkdown(content, filename)`
- `exportAsJSON(data, filename)`
- `exportAsCSV(data, filename)`
- `exportAsPDF(content, filename)`
- `exportAsHTML(content, filename)`

**Usage:**
```javascript
import { exportAsMarkdown, exportAsJSON } from './export.js';

// Export as markdown
exportAsMarkdown(agentOutput, 'myagent-output.md');

// Export as JSON
exportAsJSON({ input: userInput, output: aiResponse }, 'myagent-data.json');
```

---

## Complete Agent Creation Steps

### 1. Create the Agent HTML Page
- Location: `/Users/sumanreddy/git/proj/AiQaAgentsHub/<agent-name>.html`
- Use the structure from existing agent HTML files (header, main, output, status button, etc.)
- Add a reference to the agent in `index.html` (in the "Choose an Agent" grid).

**Required HTML Structure:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Agent - AI QA Agent Hub</title>
  <link href="styles.css" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <!-- Navigation -->
  <nav class="navbar">
    <a href="index.html">Home</a>
    <a href="dashboard.html">Dashboard</a>
    <button id="statusBtn">Provider Status</button>
  </nav>
  
  <!-- Main Content -->
  <main class="container">
    <h1>My Agent</h1>
    <textarea id="input" placeholder="Enter your input..."></textarea>
    <button id="generateBtn">Generate</button>
    <div id="output"></div>
    <button id="exportBtn">Export</button>
  </main>
  
  <!-- Provider Context -->
  <script>
    window.AI_PROVIDER = localStorage.getItem('ai-provider') || 'gemini';
    window.AI_MODEL = localStorage.getItem('selected-model') || 'gemini-2.5-flash';
  </script>
  
  <!-- Agent Script -->
  <script type="module" src="js/myagent.js"></script>
</body>
</html>
```

### 2. Add CSS
- Use `styles.css` for custom styles.
- Reuse Tailwind and existing classes for layout and effects.

**Key CSS Classes:**
- `.container` - Main content wrapper
- `.navbar` - Top navigation
- `.btn-primary`, `.btn-secondary` - Button styles
- `.output-section` - Output display area
- `.loading` - Loading spinner
- `.error-message` - Error display
- `.success-message` - Success notifications

### 3. Add JavaScript
- Create `/js/<agent-name>.js` for agent logic.
- Import shared modules as needed (`db.js`, `aiService.js`, etc.).

**Complete Agent JS Template:**
```javascript
// filepath: /js/myagent.js
import { addApiCall } from './db.js';
import { fetchFromApi } from './aiService.js';
import { estimateTokens, calculateCost, showNotification } from './utils.js';
import { renderMarkdown } from './markdown-renderer.js';
import { exportAsMarkdown } from './export.js';

// DOM Elements
const inputElement = document.getElementById('input');
const generateBtn = document.getElementById('generateBtn');
const outputElement = document.getElementById('output');
const exportBtn = document.getElementById('exportBtn');
const statusBtn = document.getElementById('statusBtn');

// State
let currentOutput = '';

// Event Listeners
generateBtn.addEventListener('click', handleGenerate);
exportBtn.addEventListener('click', handleExport);
statusBtn.addEventListener('click', showProviderStatus);

// Main Generation Function
async function handleGenerate() {
  const userInput = inputElement.value.trim();
  
  if (!userInput) {
    showNotification('Please enter input', 'error');
    return;
  }
  
  // Show loading
  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating...';
  outputElement.innerHTML = '<div class="loading">Processing...</div>';
  
  try {
    // System prompt for your agent
    const systemPrompt = `You are a specialized QA agent that [describe purpose]...`;
    
    // Call AI service
    const response = await fetchFromApi(
      userInput,
      systemPrompt,
      {
        provider: window.AI_PROVIDER,
        model: window.AI_MODEL,
        temperature: 0.7,
        maxTokens: 2000
      }
    );
    
    // Estimate tokens and cost
    const tokensUsed = response.tokensUsed || estimateTokens(userInput + response.text);
    const cost = calculateCost(tokensUsed, window.AI_PROVIDER, window.AI_MODEL);
    
    // Log to database
    await addApiCall({
      timestamp: Date.now(),
      provider: window.AI_PROVIDER,
      model: window.AI_MODEL,
      type: 'myagent',
      prompt: userInput,
      response: response.text,
      tokensUsed,
      cost
    });
    
    // Display output
    currentOutput = response.text;
    outputElement.innerHTML = renderMarkdown(currentOutput);
    
    showNotification('Generated successfully!', 'success');
    
  } catch (error) {
    console.error('Generation error:', error);
    outputElement.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
    showNotification('Generation failed', 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate';
  }
}

// Export Function
function handleExport() {
  if (!currentOutput) {
    showNotification('No output to export', 'error');
    return;
  }
  
  exportAsMarkdown(currentOutput, 'myagent-output.md');
  showNotification('Exported successfully!', 'success');
}

// Provider Status
function showProviderStatus() {
  const provider = window.AI_PROVIDER;
  const model = window.AI_MODEL;
  alert(`Current Provider: ${provider}\nCurrent Model: ${model}`);
}
```

### 4. Database Storage
- Use `addApiCall` from `db.js` to log agent usage.
- Define a new `type` for the agent (e.g., `'myagent'`) for dashboard filtering.

**DB Call Structure:**
```javascript
await addApiCall({
  timestamp: Date.now(),
  provider: window.AI_PROVIDER,
  model: window.AI_MODEL,
  type: 'myagent', // Unique identifier for your agent
  prompt: userInput,
  response: aiResponse,
  tokensUsed: estimatedTokens,
  cost: calculatedCost
});
```

### 5. Token Display in Dashboard
- Update `dashboard.html`:
  - Add a new stat card for your agent (copy/paste and adjust label/color).
  - Update `js/dashboard.js` to count and display calls/tokens for your agent's type.

**Dashboard HTML Addition:**
```html
<!-- Add to dashboard.html stats grid -->
<div class="stat-card bg-purple-500">
  <h3>My Agent</h3>
  <p class="stat-number" id="myagent-calls">0</p>
  <p class="stat-label">API Calls</p>
  <p class="stat-tokens" id="myagent-tokens">0 tokens</p>
  <p class="stat-cost" id="myagent-cost">$0.00</p>
</div>
```

**Dashboard JS Update:**
```javascript
// In dashboard.js loadDashboardData()
const myAgentCalls = calls.filter(c => c.type === 'myagent');
const myAgentTokens = myAgentCalls.reduce((sum, c) => sum + (c.tokensUsed || 0), 0);
const myAgentCost = myAgentCalls.reduce((sum, c) => sum + (c.cost || 0), 0);

document.getElementById('myagent-calls').textContent = myAgentCalls.length;
document.getElementById('myagent-tokens').textContent = myAgentTokens.toLocaleString();
document.getElementById('myagent-cost').textContent = `$${myAgentCost.toFixed(4)}`;
```

### 6. AI Service Changes
- Update `js/aiService.js`:
  - Add a new exported function for your agent's AI prompt/response logic.
  - Ensure it uses `fetchFromApi` and logs to DB.

### 7. Settings Modal (if needed)
- If your agent needs custom settings, update the modal in `index.html` and logic in `js/settings.js`.

### 8. Status/Docs Button
- Add/update the status/docs button logic in your agent HTML (see `index.html` for dynamic provider button code).

### 9. README Update
- Document your agent's purpose, usage, and integration steps here for future reference.

### 10. Agent Context: Provider & Model
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

## Additional Files and Components

### `/styles.css` - Main Stylesheet
Contains all custom CSS classes, themes, and responsive design rules.

### `/index.html` - Landing Page
- Main hub for agent selection
- Settings modal
- Navigation to all agents
- Provider configuration

### `/dashboard.html` - Analytics Page
- Usage statistics
- Token consumption charts
- Cost analysis
- Export/import functionality

### `/js/theme.js` (if exists)
- Dark/light theme toggling
- Theme persistence

### `/js/analytics.js` (if exists)
- Advanced analytics calculations
- Chart generation
- Trend analysis

---

## Example Checklist (fill in for your agent):

- [ ] Created `myagent.html` with proper structure
- [ ] Added entry to "Choose an Agent" in `index.html`
- [ ] Created `js/myagent.js` with all required imports
- [ ] Implemented `handleGenerate()` function
- [ ] Added export functionality
- [ ] Updated `dashboard.html` with agent stat card
- [ ] Updated `js/dashboard.js` to track agent metrics
- [ ] Added agent-specific function to `js/aiService.js`
- [ ] Updated DB logging with type `'myagent'`
- [ ] Added provider context scripts to HTML
- [ ] Implemented error handling and loading states
- [ ] Added markdown rendering for output
- [ ] Tested with all AI providers (Gemini, OpenAI, Claude, Groq)
- [ ] Updated settings modal if custom settings needed
- [ ] Updated status/docs button logic
- [ ] Added agent documentation to this README

---

## Testing Checklist

- [ ] Test with all AI providers
- [ ] Verify token counting accuracy
- [ ] Check cost calculations
- [ ] Test export functionality
- [ ] Verify database logging
- [ ] Test error scenarios (no API key, network errors)
- [ ] Check responsive design on mobile
- [ ] Verify markdown rendering
- [ ] Test dashboard metrics update
- [ ] Check theme compatibility

---

## Common Pitfalls to Avoid

1. **Not handling provider switching** - Always use `window.AI_PROVIDER` and `window.AI_MODEL`
2. **Missing error handling** - Wrap API calls in try-catch blocks
3. **Incorrect token estimation** - Use `estimateTokens()` utility function
4. **Not logging to database** - Always call `addApiCall()` after successful generation
5. **Hardcoding API keys** - Always use settings from localStorage
6. **Missing loading states** - Show loading indicators during API calls
7. **Not sanitizing input** - Use `sanitizeInput()` for user inputs
8. **Forgetting to update dashboard** - Add stats for your agent in dashboard.js

---

**Tip:**  
Use this file as a comprehensive checklist and reference for all necessary changes when launching a new agent feature. Review all JavaScript files mentioned above to understand the complete architecture before implementing your agent.
