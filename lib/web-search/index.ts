import { searchWithBaidu } from './baidu';
import { searchWithBocha } from './bocha';
import { searchWithBrave } from './brave';
import { searchWithTavily } from './tavily';
import type { WebSearchResult } from '@/lib/types/web-search';
import type { BaiduSubSources, WebSearchProviderId } from './types';

export { formatSearchResultsAsContext } from './format';

export async function searchWeb(params: {
  providerId: WebSearchProviderId;
  query: string;
  apiKey?: string;
  maxResults?: number;
  baseUrl?: string;
  baiduSubSources?: BaiduSubSources;
}): Promise<WebSearchResult> {
  const { providerId, query, apiKey = '', maxResults, baseUrl, baiduSubSources } = params;

  switch (providerId) {
    case 'baidu':
      return searchWithBaidu({ query, apiKey, maxResults, baseUrl, subSources: baiduSubSources });
    case 'bocha':
      return searchWithBocha({ query, apiKey, maxResults, baseUrl });
    case 'brave':
      return searchWithBrave({ query, apiKey: apiKey || undefined, maxResults, baseUrl });
    case 'tavily':
      return searchWithTavily({ query, apiKey, maxResults, baseUrl });
    case 'familybuddy-web-search':
      return searchWithFamilyBuddy({ query, apiKey, maxResults, baseUrl });
    default: {
      const exhaustive: never = providerId;
      throw new Error(`Unsupported web search provider: ${exhaustive}`);
    }
  }
}

async function searchWithFamilyBuddy(params: {
  query: string;
  apiKey: string;
  maxResults?: number;
  baseUrl?: string;
}): Promise<WebSearchResult> {
  const baseUrl = params.baseUrl?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('FamilyBuddy web search relay base URL is required');
  }

  const response = await fetch(`${baseUrl}/web-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      query: params.query,
      max_results: params.maxResults,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`FamilyBuddy web search failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return {
    answer: typeof data.answer === 'string' ? data.answer : '',
    sources: Array.isArray(data.sources) ? data.sources : [],
    query: typeof data.query === 'string' ? data.query : params.query,
    responseTime: Number(data.responseTime) || 0,
  };
}
