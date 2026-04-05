export type IndiaAssistantUrgency = 'emergency' | 'priority' | 'standard';

export interface IndiaAssistantLegalRoute {
  title: string;
  whyItMayApply: string;
  caution: string;
}

export interface IndiaAssistantReportingOption {
  authority: string;
  reason: string;
  phone: string | null;
  url: string | null;
  note: string;
}

export interface IndiaAssistantResponse {
  headline: string;
  urgency: IndiaAssistantUrgency;
  topicTags: string[];
  whatThisPostAppearsToDescribe: string;
  whyItMayMatterInIndia: string;
  possibleLegalRoutes: IndiaAssistantLegalRoute[];
  immediateNextSteps: string[];
  evidenceChecklist: string[];
  officialReportingOptions: IndiaAssistantReportingOption[];
  questionsToAskLawyerOrAuthority: string[];
  safetyNote: string | null;
  disclaimer: string;
}

export interface IndiaAssistantRequest {
  postId: string;
  stateCode: string;
  district?: string;
}

export const POST_ASSISTANT_STATE_STORAGE_KEY = 'civicvoice.post-assistant.state-code';

export const INDIA_STATE_OPTIONS = [
  { code: 'AN', label: 'Andaman and Nicobar Islands' },
  { code: 'AP', label: 'Andhra Pradesh' },
  { code: 'AR', label: 'Arunachal Pradesh' },
  { code: 'AS', label: 'Assam' },
  { code: 'BR', label: 'Bihar' },
  { code: 'CH', label: 'Chandigarh' },
  { code: 'CT', label: 'Chhattisgarh' },
  { code: 'DN', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: 'DL', label: 'Delhi' },
  { code: 'GA', label: 'Goa' },
  { code: 'GJ', label: 'Gujarat' },
  { code: 'HR', label: 'Haryana' },
  { code: 'HP', label: 'Himachal Pradesh' },
  { code: 'JK', label: 'Jammu and Kashmir' },
  { code: 'JH', label: 'Jharkhand' },
  { code: 'KA', label: 'Karnataka' },
  { code: 'KL', label: 'Kerala' },
  { code: 'LA', label: 'Ladakh' },
  { code: 'LD', label: 'Lakshadweep' },
  { code: 'MP', label: 'Madhya Pradesh' },
  { code: 'MH', label: 'Maharashtra' },
  { code: 'MN', label: 'Manipur' },
  { code: 'ML', label: 'Meghalaya' },
  { code: 'MZ', label: 'Mizoram' },
  { code: 'NL', label: 'Nagaland' },
  { code: 'OR', label: 'Odisha' },
  { code: 'PY', label: 'Puducherry' },
  { code: 'PB', label: 'Punjab' },
  { code: 'RJ', label: 'Rajasthan' },
  { code: 'SK', label: 'Sikkim' },
  { code: 'TN', label: 'Tamil Nadu' },
  { code: 'TG', label: 'Telangana' },
  { code: 'TR', label: 'Tripura' },
  { code: 'UP', label: 'Uttar Pradesh' },
  { code: 'UT', label: 'Uttarakhand' },
  { code: 'WB', label: 'West Bengal' },
] as const;

export function getIndiaStateLabel(stateCode: string | null | undefined): string | undefined {
  if (!stateCode) {
    return undefined;
  }

  const normalizedCode = stateCode.trim().toUpperCase();
  return INDIA_STATE_OPTIONS.find((option) => option.code === normalizedCode)?.label;
}

/**
 * Parse a free-text location string (e.g. "Kolkata, West Bengal") into a
 * state code and district prefix for the assistant panel.
 *
 * Strategy:
 *  1. Try to match entire location or comma-separated segments against state
 *     labels (case-insensitive, partial prefix match).
 *  2. If a match is found, use the rest of the text as the district.
 *  3. Falls back to empty strings when nothing can be detected.
 */
export function parseLocationFromPost(location: string | null | undefined): {
  stateCode: string;
  district: string;
} {
  if (!location?.trim()) {
    return { stateCode: '', district: '' };
  }

  const parts = location.split(',').map((p) => p.trim()).filter(Boolean);

  // Walk from the last segment backwards so "City, District, State" works.
  for (let i = parts.length - 1; i >= 0; i--) {
    const segment = parts[i].toUpperCase();

    // Check exact state code match first (e.g. the location contains "WB").
    const byCode = INDIA_STATE_OPTIONS.find((o) => o.code === segment);
    if (byCode) {
      const district = parts.slice(0, i).join(', ');
      return { stateCode: byCode.code, district };
    }

    // Check whether the segment is a prefix/substring of a state label.
    const byLabel = INDIA_STATE_OPTIONS.find((o) =>
      o.label.toUpperCase().includes(segment) || segment.includes(o.label.toUpperCase())
    );
    if (byLabel) {
      const district = parts.slice(0, i).join(', ');
      return { stateCode: byLabel.code, district };
    }
  }

  // No state found – put the whole location into district as a convenience.
  return { stateCode: '', district: location.trim() };
}
