import { fetchFromApi } from "../aiService.js";
import { state } from "../state.js";
import { addApiCall, initDB } from "../db.js";

/**
 * Generates test cases based on file content and specified test type.
 * @param {string} fileContent - The content of the file to generate test cases for.
 * @param {string} testType - The type of test cases to generate (e.g., functional, unit, integration).
 * @param {string} additionalDetails - Any additional details or requirements for the test cases.
 * @returns {Promise<Object>} - An object containing the generated test cases and usage stats.
 */
export async function getTestCaseResponse(
  fileContent,
  testType,
  additionalDetails
) {
  const systemPrompt = `You are an expert QA engineer with 15+ years of experience in test automation and quality assurance. You specialize in creating comprehensive, actionable, and well-structured test cases that cover all critical scenarios. Your test cases are precise, easy to execute, and follow industry best practices.`;

  const testTypeFrameworks = {
    functional: {
      focus: "business requirements, user workflows, and feature functionality",
      aspects: [
        "Positive test scenarios (happy path)",
        "Negative test scenarios (error conditions)",
        "Boundary value analysis",
        "Input validation",
        "User interface interactions",
        "Data persistence and state management",
      ],
      format: "Gherkin-style (Given-When-Then) where appropriate",
    },
    unit: {
      focus: "individual functions, methods, and code units in isolation",
      aspects: [
        "Function input/output validation",
        "Exception handling",
        "Edge cases and boundary conditions",
        "Mock dependencies and stubs",
        "Code coverage for branches and paths",
      ],
      format: "Code-level test cases with specific assertions",
    },
    integration: {
      focus: "interactions between modules, services, and components",
      aspects: [
        "API contracts and data flow",
        "Service dependencies",
        "Database interactions",
        "Message queues and event handlers",
        "Error propagation between components",
      ],
      format: "Component interaction scenarios",
    },
    e2e: {
      focus: "complete user journeys from start to finish",
      aspects: [
        "Critical user workflows",
        "Cross-browser compatibility",
        "Mobile responsiveness",
        "Performance under realistic conditions",
        "Third-party integrations",
      ],
      format: "User story-based scenarios",
    },
    api: {
      focus:
        "REST/GraphQL endpoints, request/response formats, and HTTP behavior",
      aspects: [
        "HTTP status codes and error responses",
        "Request validation and payload formats",
        "Authentication and authorization",
        "Rate limiting and throttling",
        "Pagination and filtering",
        "API versioning and backward compatibility",
      ],
      format: "API endpoint validation with specific request/response examples",
    },
    security: {
      focus: "vulnerabilities, data protection, and access control",
      aspects: [
        "Authentication bypass attempts",
        "SQL injection and XSS vulnerabilities",
        "Data encryption and privacy",
        "Role-based access control",
        "Input sanitization and validation",
        "Security headers and CORS policies",
      ],
      format: "Security vulnerability scenarios",
    },
    performance: {
      focus: "system behavior under load, response times, and scalability",
      aspects: [
        "Load testing with concurrent users",
        "Stress testing beyond capacity limits",
        "Endurance testing over time",
        "Spike testing for sudden traffic increases",
        "Resource utilization monitoring",
      ],
      format: "Performance benchmark scenarios with measurable metrics",
    },
    accessibility: {
      focus: "WCAG compliance and usability for people with disabilities",
      aspects: [
        "Screen reader compatibility",
        "Keyboard navigation",
        "Color contrast and visual indicators",
        "ARIA labels and semantic HTML",
        "Form accessibility and error messaging",
      ],
      format: "Accessibility compliance checks",
    },
    regression: {
      focus: "existing functionality after code changes or updates",
      aspects: [
        "Core feature verification",
        "Integration point validation",
        "Data migration impacts",
        "Backward compatibility",
        "Previously fixed defects",
      ],
      format: "Smoke test scenarios for critical paths",
    },
    smoke: {
      focus: "basic validation of critical functionality",
      aspects: [
        "Application startup and initialization",
        "Core feature availability",
        "Basic user authentication",
        "Essential data operations",
      ],
      format: "Quick validation scenarios (5-10 minute execution)",
    },
  };

  const framework =
    testTypeFrameworks[testType] || testTypeFrameworks.functional;

  const prompt = `
CONTEXT:
You are generating ${testType} test cases for a software application. As an expert QA engineer, create comprehensive test cases that are specific, actionable, and follow industry standards.

TEST TYPE: ${testType.toUpperCase()}
FOCUS AREAS: ${framework.aspects.join(", ")}

FILES CONTENT:
${fileContent}

${
  additionalDetails
    ? `ADDITIONAL REQUIREMENTS & CONTEXT:\n${additionalDetails}`
    : ""
}

TEST CASE GENERATION GUIDELINES:

1. STRUCTURE EACH TEST CASE WITH:
   Test Case [Number]: [Clear, descriptive title that reflects the scenario]
   Type: ${testType}
   Priority: [High/Medium/Low - based on business impact and risk]
   Description: [Concise explanation of what is being validated and why it matters]
   Preconditions: [Any setup requirements, data prerequisites, or system state needed]
   Test Steps:
   1. [Actionable step with specific inputs/data]
   2. [Next actionable step]
   3. [Continue with precise actions...]
   Expected Result: [Specific, verifiable outcome with acceptance criteria]
   Notes: [Any additional context, potential risks, or testing considerations]

2. COVERAGE REQUIREMENTS:
   - 30% Positive/Happy Path scenarios
   - 40% Negative/Error scenarios
   - 20% Edge Cases and Boundary conditions
   - 10% Security/Performance considerations

3. SPECIFIC INSTRUCTIONS:
   - Make test steps executable by a QA engineer
   - Include specific test data examples where applicable
   - Consider different user roles and permissions
   - Account for various data states and conditions
   - Include validation of error messages and handling
   - Consider internationalization if applicable
   - Address mobile/responsive behavior if relevant

4. QUANTITY & QUALITY:
   Generate 10-15 high-quality test cases that provide comprehensive coverage.
   Prioritize test cases based on risk and business criticality.

5. FORMATTING:
   Use clear numbering and consistent formatting.
   Ensure each test case is independent and can be executed separately.
 
 OUTPUT FORMAT:
 Please provide the test cases in the exact structure specified above, ready for immediate use in test management systems.
`;

  const startTime = Date.now();
  const { content, usage } = await fetchFromApi(prompt, systemPrompt);
  const duration = Date.now() - startTime;

  await initDB();
  await addApiCall({
    timestamp: new Date(),
    model: state.selectedModel,
    totalTokens: usage.totalTokenCount,
    promptTokens: usage.prompt_tokens || usage.promptTokenCount,
    responseTokens: usage.completion_tokens || usage.candidatesTokenCount,
    locatorsGenerated: 0,
    type: "testcasegen",
    duration,
  }).catch((err) => console.error("DB save failed (testcase):", err));

  return { content, usage };
}
