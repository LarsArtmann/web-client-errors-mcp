/**
 * Framework Detection Service
 * Detects frontend frameworks and provides framework-specific error insights
 *
 * Supported Frameworks:
 * - React (including Next.js, Gatsby, Remix)
 * - Vue (including Nuxt)
 * - Angular
 * - Svelte
 * - Solid
 * - Vanilla JS
 */

import type { Page } from 'playwright';
import { getAppLogger } from '../logger.js';

const logger = getAppLogger('framework-detection');

/**
 * Detected framework information
 */
export interface FrameworkInfo {
  name: 'React' | 'Vue' | 'Angular' | 'Svelte' | 'Solid' | 'Next.js' | 'Nuxt' | 'Remix' | 'Gatsby' | 'Unknown';
  version?: string;
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
}

/**
 * Framework-specific error pattern
 */
export interface FrameworkErrorPattern {
  framework: FrameworkInfo['name'];
  pattern: RegExp;
  category: string;
  suggestion: string;
}

/**
 * Framework-specific error patterns
 */
const FRAMEWORK_ERROR_PATTERNS: FrameworkErrorPattern[] = [
  // React patterns
  {
    framework: 'React',
    pattern: /Cannot read propert(?:y|ies) of undefined.*reading 'useState'/,
    category: 'React Hooks',
    suggestion: 'useState must be called inside a React component function'
  },
  {
    framework: 'React',
    pattern: /Rendered more hooks than during the previous render/,
    category: 'React Hooks',
    suggestion: 'Hooks must be called in the same order on every render. Check conditional hook usage.'
  },
  {
    framework: 'React',
    pattern: /Cannot update a component.*while rendering a different component/,
    category: 'React State',
    suggestion: 'Avoid calling setState during render. Move state updates to useEffect or event handlers.'
  },
  {
    framework: 'React',
    pattern: /Maximum update depth exceeded/,
    category: 'React State',
    suggestion: 'Infinite loop detected. Check for setState calls that trigger re-renders.'
  },
  {
    framework: 'React',
    pattern: /Hydration failed|Text content does not match/,
    category: 'React SSR',
    suggestion: 'Server and client render mismatch. Ensure consistent rendering between server and client.'
  },

  // Next.js patterns
  {
    framework: 'Next.js',
    pattern: /Error: Hydration failed because the initial UI does not match/,
    category: 'Next.js Hydration',
    suggestion: 'SSR/CSR mismatch in Next.js. Check for client-only code running during SSR.'
  },
  {
    framework: 'Next.js',
    pattern: /getServerSideProps|getStaticProps|getStaticPaths/,
    category: 'Next.js Data Fetching',
    suggestion: 'Error in Next.js data fetching function. Check API routes and data handling.'
  },

  // Vue patterns
  {
    framework: 'Vue',
    pattern: /\[Vue warn\]|Vue\.config|app\._instance/,
    category: 'Vue Core',
    suggestion: 'Vue framework error. Check component lifecycle and reactivity.'
  },
  {
    framework: 'Vue',
    pattern: /Cannot read propert(?:y|ies) of undefined.*reading '\$'/,
    category: 'Vue Instance',
    suggestion: 'Accessing Vue instance properties before component is mounted.'
  },

  // Angular patterns
  {
    framework: 'Angular',
    pattern: /NG0\d{4}|Angular error|ExpressionChangedAfterItHasBeenCheckedError/,
    category: 'Angular Core',
    suggestion: 'Angular change detection error. Check for state mutations during change detection.'
  },
  {
    framework: 'Angular',
    pattern: /NullInjectorError|No provider for/,
    category: 'Angular DI',
    suggestion: 'Missing dependency injection provider. Add to module or component providers.'
  },

  // Svelte patterns
  {
    framework: 'Svelte',
    pattern: /\.svelte|svelte\/internal/,
    category: 'Svelte Core',
    suggestion: 'Svelte component error. Check component reactivity and bindings.'
  }
];

/**
 * Detects the frontend framework used on a page
 */
export async function detectFramework(page: Page): Promise<FrameworkInfo> {
  try {
    const detection = await page.evaluate(() => {
      const indicators: string[] = [];
      let name: FrameworkInfo['name'] = 'Unknown';
      let version: string | undefined;
      let confidence: FrameworkInfo['confidence'] = 'low';

      // Type-safe window property access
      const windowObj = window as Window & {
        React?: { version?: string };
        Vue?: { version?: string };
        __NEXT_DATA__?: unknown;
        __NUXT__?: unknown;
        $nuxt?: unknown;
        ng?: unknown;
        Solid?: unknown;
        __remixContext?: unknown;
        ___gatsby?: unknown;
      };

      // Check for React
      if (typeof windowObj.React !== 'undefined') {
        name = 'React';
        version = windowObj.React.version;
        confidence = 'high';
        indicators.push('window.React detected');
      } else if (document.querySelector('[data-reactroot], [data-reactid]')) {
        name = 'React';
        confidence = 'medium';
        indicators.push('React DOM attributes found');
      } else if (document.querySelector('script[src*="react"]')) {
        name = 'React';
        confidence = 'medium';
        indicators.push('React script tag found');
      }

      // Check for Next.js
      if (windowObj.__NEXT_DATA__ || document.getElementById('__NEXT_DATA__')) {
        name = 'Next.js';
        confidence = 'high';
        indicators.push('__NEXT_DATA__ detected');
      } else if (document.querySelector('script[src*="/_next/"]')) {
        name = 'Next.js';
        confidence = 'high';
        indicators.push('Next.js script paths detected');
      }

      // Check for Vue
      if (windowObj.Vue) {
        name = 'Vue';
        version = windowObj.Vue.version;
        confidence = 'high';
        indicators.push('window.Vue detected');
      } else if (document.querySelector('[data-v-]')) {
        name = 'Vue';
        confidence = 'medium';
        indicators.push('Vue data attributes found');
      } else if (document.querySelector('script[src*="vue"]')) {
        name = 'Vue';
        confidence = 'medium';
        indicators.push('Vue script tag found');
      }

      // Check for Nuxt
      if (windowObj.__NUXT__ || windowObj.$nuxt) {
        name = 'Nuxt';
        confidence = 'high';
        indicators.push('Nuxt globals detected');
      }

      // Check for Angular
      if (windowObj.ng || document.querySelector('[ng-version]')) {
        name = 'Angular';
        const versionEl = document.querySelector('[ng-version]');
        version = versionEl?.getAttribute('ng-version') || undefined;
        confidence = 'high';
        indicators.push('Angular detected');
      } else if (document.querySelector('script[src*="angular"]')) {
        name = 'Angular';
        confidence = 'medium';
        indicators.push('Angular script tag found');
      }

      // Check for Svelte
      if (document.querySelector('script[src*="svelte"]') ||
          Array.from(document.querySelectorAll('*')).some(el =>
            el.className && typeof el.className === 'string' && el.className.includes('svelte-')
          )) {
        name = 'Svelte';
        confidence = 'medium';
        indicators.push('Svelte detected');
      }

      // Check for Solid
      if (windowObj.Solid || document.querySelector('script[src*="solid"]')) {
        name = 'Solid';
        confidence = 'medium';
        indicators.push('Solid detected');
      }

      // Check for Remix
      if (windowObj.__remixContext || document.querySelector('script[src*="remix"]')) {
        name = 'Remix';
        confidence = 'high';
        indicators.push('Remix detected');
      }

      // Check for Gatsby
      if (windowObj.___gatsby || document.getElementById('___gatsby')) {
        name = 'Gatsby';
        confidence = 'high';
        indicators.push('Gatsby detected');
      }

      return {
        name,
        version,
        confidence,
        indicators
      };
    });

    logger.info('Framework detected', {
      framework: detection.name,
      version: detection.version,
      confidence: detection.confidence,
      indicators: detection.indicators.length
    });

    return detection;
  } catch (error) {
    logger.error('Framework detection failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      name: 'Unknown',
      confidence: 'low',
      indicators: []
    };
  }
}

/**
 * Analyzes an error message for framework-specific patterns
 */
export function analyzeFrameworkError(
  errorMessage: string,
  framework: FrameworkInfo
): {
  isFrameworkError: boolean;
  pattern?: FrameworkErrorPattern;
} {
  // First check framework-specific patterns
  for (const pattern of FRAMEWORK_ERROR_PATTERNS) {
    if (pattern.framework === framework.name && pattern.pattern.test(errorMessage)) {
      return {
        isFrameworkError: true,
        pattern
      };
    }
  }

  // Then check generic patterns for detected framework
  const genericPatterns = FRAMEWORK_ERROR_PATTERNS.filter(
    p => errorMessage.toLowerCase().includes(p.framework.toLowerCase())
  );

  if (genericPatterns.length > 0) {
    return {
      isFrameworkError: true,
      pattern: genericPatterns[0]
    };
  }

  return {
    isFrameworkError: false
  };
}

/**
 * Extracts React component name from stack trace
 */
export function extractReactComponent(stack: string): string | null {
  // Try to find React component in stack trace
  // Pattern: at ComponentName (file.jsx:line:col)
  const componentMatch = stack.match(/at ([A-Z][a-zA-Z0-9]+) \(/);
  if (componentMatch) {
    return componentMatch[1];
  }

  // Pattern: ComponentName@file.jsx:line:col
  const componentMatch2 = stack.match(/([A-Z][a-zA-Z0-9]+)@/);
  if (componentMatch2) {
    return componentMatch2[1];
  }

  return null;
}

/**
 * Extracts Vue component name from stack trace
 */
export function extractVueComponent(stack: string): string | null {
  // Vue components often have .vue in the file path
  const vueMatch = stack.match(/([a-zA-Z0-9_-]+)\.vue/);
  if (vueMatch) {
    return vueMatch[1];
  }

  return null;
}

/**
 * Extracts Angular component name from stack trace
 */
export function extractAngularComponent(stack: string): string | null {
  // Angular components often have .component in the file path
  const angularMatch = stack.match(/([a-zA-Z0-9_-]+)\.component/);
  if (angularMatch) {
    return angularMatch[1];
  }

  return null;
}

/**
 * Gets framework-specific debugging suggestions
 */
export function getFrameworkSuggestions(framework: FrameworkInfo): string[] {
  const suggestions: string[] = [];

  switch (framework.name) {
    case 'React':
    case 'Next.js':
    case 'Gatsby':
    case 'Remix':
      suggestions.push('Install React DevTools browser extension for component inspection');
      suggestions.push('Check React component lifecycle and hook dependencies');
      suggestions.push('Enable React Strict Mode to catch common issues');
      break;

    case 'Vue':
    case 'Nuxt':
      suggestions.push('Install Vue DevTools browser extension');
      suggestions.push('Check component reactivity and data bindings');
      suggestions.push('Verify component lifecycle hooks');
      break;

    case 'Angular':
      suggestions.push('Install Angular DevTools browser extension');
      suggestions.push('Check change detection and zone.js issues');
      suggestions.push('Verify dependency injection configuration');
      break;

    case 'Svelte':
      suggestions.push('Check Svelte component reactivity statements');
      suggestions.push('Verify component bindings and props');
      break;

    case 'Solid':
      suggestions.push('Check Solid reactive primitives (signals, memos, effects)');
      suggestions.push('Verify component props and stores');
      break;

    default:
      suggestions.push('Check browser console for additional error details');
      suggestions.push('Verify JavaScript module loading');
  }

  return suggestions;
}
