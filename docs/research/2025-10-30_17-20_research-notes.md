# Web Client Errors MCP Research

## Goal

Research if someone already built a tool for AI Coding Agents to check client-side (console) errors on websites.

## Research Findings So Far

### Step 1: ✅ Complete - Search Terms Defined

- Used terms: "MCP browser console errors", "browser automation MCP server console errors", "web client errors MCP", "Sentry Rollbar error monitoring MCP"

### Step 2: ✅ Complete - GitHub Repository Search

**Key Findings:**

1. **Official Puppeteer MCP Server (ARCHIVED)**
   - Located in `modelcontextprotocol/servers-archived`
   - Provided browser automation via Puppeteer
   - **Had console logs resource**: `console://logs` - Browser console output in text format
   - **Key Gap**: This is now archived and no longer maintained

2. **Puppeteer MCP Server Docker (Third-party)**
   - Active fork/maintenance by dujonwalker
   - Provides same tools as original:
     - `puppeteer_navigate`: Navigate to URLs
     - `puppeteer_evaluate`: Execute JavaScript in browser console
     - `puppeteer_screenshot`: Capture screenshots
   - **Console Logs Resource**: Available via `console://logs`
   - **Status**: Active but not official

3. **Browser MCP Servers Found:**
   - Browser MCP by UI-TARS (ByteDance) - Fast, lightweight browser automation
   - browser-use MCP server - Dockerized playwright + chromium + vnc
   - BrowserLoop - Screenshot-focused with Playwright
   - Microsoft VS Code's Playwright MCP - For development/testing

### Step 3: In Progress - Documentation and Articles Search

**Error Monitoring Services Found:**

- Sentry, Rollbar, Bugsnag, Honeybadger - Traditional error monitoring
- **Gap**: No MCP integrations found for these services
- CatchJS - JavaScript error tracking with screenshots
- GlitchTip - Open-source error tracking, Sentry-compatible

### Step 4: Context7 Research

**MCP Documentation Found:**

- Microsoft MCP for beginners - Contains browser automation examples
- Shows how to create MCP servers with Playwright
- Focuses on navigation, screenshots, JavaScript execution
- **Gap**: No specific console error detection focus

## Final Analysis and Recommendations

### Step 5: ✅ Complete - Analysis of Findings

#### What Already Exists:

1. **Browser Automation MCP Servers**
   - **Puppeteer MCP (Archived)** - Official but discontinued
   - **Puppeteer MCP Docker** - Active third-party fork
   - **Browser MCP (ByteDance)** - Fast, lightweight automation
   - **Microsoft VS Code Playwright MCP** - Development focused
   - **BrowserLoop, browser-use** - Various implementations

2. **Error Detection Methods in JavaScript**
   - `window.onerror` - Traditional error handler
   - `window.addEventListener('error')` - Modern event-based approach
   - `window.addEventListener('unhandledrejection')` - Promise rejection handling
   - Console API: `console.error()`, `console.warn()`, etc.
   - DevTools Protocol for advanced detection

3. **Traditional Error Monitoring Services**
   - Sentry, Rollbar, Bugsnag, Honeybadger
   - **Gap**: No MCP integrations exist

4. **Error Monitoring Approaches**
   - Global error handlers (as shown in Meteor examples)
   - Event buffering for session replay (as shown in Chinese documentation)
   - Stack trace capture and analysis

#### Key Gaps Identified:

1. **No Dedicated MCP Server for Client-Side Errors**
   - Existing browser MCP servers focus on automation, not error detection
   - No MCP server specifically designed to monitor and parse console errors

2. **No Error Monitoring Service Integration**
   - Sentry/Rollbar have no official MCP servers
   - AI agents cannot access existing error monitoring infrastructure

3. **Limited Error Analysis Capabilities**
   - Existing tools capture raw errors but don't provide intelligent analysis
   - No categorization, severity assessment, or suggested fixes

4. **No AI-Friendly Error Interface**
   - Raw console logs are not structured for AI consumption
   - No standardized error format for LLM processing

### Step 6: ✅ Complete - Project Viability Assessment

#### ✅ **PROJECT IS NEEDED AND VIABLE**

**Reasons:**

1. **Clear Gap in Market** - No MCP server specifically for client-side error detection
2. **High Demand** - AI coding agents need this capability for web development
3. **Technically Feasible** - JavaScript error detection methods are well-established
4. **Integration Potential** - Can bridge existing error monitoring services with MCP

**Unique Value Proposition:**

- **Specialized Focus** - Unlike generic browser automation, focus specifically on error detection
- **AI-Optimized Output** - Structure errors in LLM-friendly format
- **Service Integration** - Bridge to existing error monitoring (Sentry, Rollbar)
- **Intelligent Analysis** - Categorize, assess severity, suggest fixes

#### Recommended Approach:

**Phase 1: Core Error Detection**

- Implement `window.onerror` and `addEventListener('error')` capture
- Handle `unhandledrejection` events
- Parse console API calls (`console.error`, `console.warn`)
- Structure output for AI consumption

**Phase 2: Browser Automation Integration**

- Use existing Puppeteer/Playwright MCP servers as base
- Add navigation and page interaction capabilities
- Implement error context capture (screenshots, DOM state)

**Phase 3: Service Integration**

- Add Sentry/Rollbar API integrations
- Create error aggregation and deduplication
- Implement error reporting to existing monitoring services

**Phase 4: Advanced Features**

- Error pattern recognition
- Automated fix suggestions
- Performance impact analysis
- Real-time error monitoring

#### Competitive Advantages:

1. **First-to-Market** for dedicated error detection MCP server
2. **AI-Centric Design** vs traditional monitoring tools
3. **Integration Bridge** between existing services and AI agents
4. **Specialized Focus** vs generic browser automation

## Conclusion

**The web-client-errors-mcp project should be built.**

There is a clear gap in the MCP ecosystem for dedicated client-side error detection and analysis. While browser automation tools exist, none focus specifically on error monitoring, and existing error monitoring services have no AI integration through MCP.

The project addresses a real need for AI coding agents to detect, analyze, and understand client-side errors on websites, which is crucial for web development workflows.

**Next Steps:**

1. Begin implementation with core error detection
2. Design MCP server structure and API
3. Integrate with existing browser automation tools
4. Add error monitoring service connections
5. Create AI-friendly error analysis and reporting
