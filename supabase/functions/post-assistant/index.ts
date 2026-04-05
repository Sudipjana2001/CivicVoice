import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')?.trim();
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL')?.trim() || 'gpt-5.4-mini';
const PROMPT_VERSION = 1;

type AssistantUrgency = 'emergency' | 'priority' | 'standard';

interface AssistantRequestBody {
  postId?: string;
  stateCode?: string;
  district?: string;
}

interface PostRow {
  id: string;
  anonymous_id: string;
  content: string;
  category: string;
  severity: string;
  evidence_type: string | null;
  location: string | null;
  incident_date: string | null;
  incident_time: string | null;
  created_at: string;
  comment_count: number;
  report_count: number;
  status: string;
}

interface ResourceRow {
  topic_key: string;
  authority_name: string;
  route_type: string;
  phone: string | null;
  url: string | null;
  applicability_note: string;
  priority: number;
  official_source_url: string;
}

interface LawRow {
  topic_key: string;
  act_name: string;
  summary: string;
  caution_note: string;
  source_url: string;
}

interface AssistantLegalRoute {
  title: string;
  whyItMayApply: string;
  caution: string;
}

interface AssistantReportingOption {
  authority: string;
  reason: string;
  phone: string | null;
  url: string | null;
  note: string;
}

interface AssistantPayload {
  headline: string;
  urgency: AssistantUrgency;
  topicTags: string[];
  whatThisPostAppearsToDescribe: string;
  whyItMayMatterInIndia: string;
  possibleLegalRoutes: AssistantLegalRoute[];
  immediateNextSteps: string[];
  evidenceChecklist: string[];
  officialReportingOptions: AssistantReportingOption[];
  questionsToAskLawyerOrAuthority: string[];
  safetyNote: string | null;
  disclaimer: string;
}

const TOPIC_LABELS: Record<string, string> = {
  violence_and_threat: 'Violence or threat',
  cyber_fraud_and_online_abuse: 'Cyber fraud or online abuse',
  women_safety_and_domestic_violence: 'Women safety or domestic violence',
  child_safety: 'Child safety',
  workplace_harassment: 'Workplace harassment',
  corruption_public_official: 'Corruption or bribery',
  public_service_grievance: 'Public service grievance',
  civic_infrastructure_and_local_body_issue: 'Civic or infrastructure issue',
  public_information_access: 'RTI or public information access',
  police_inaction_or_refusal_to_register: 'Police inaction or FIR issue',
  property_or_document_fraud: 'Property or document fraud',
  evidence_preservation: 'Evidence preservation',
};

const TOPIC_ORDER = [
  'violence_and_threat',
  'women_safety_and_domestic_violence',
  'child_safety',
  'cyber_fraud_and_online_abuse',
  'corruption_public_official',
  'workplace_harassment',
  'police_inaction_or_refusal_to_register',
  'property_or_document_fraud',
  'public_service_grievance',
  'civic_infrastructure_and_local_body_issue',
  'public_information_access',
  'evidence_preservation',
];

const RESPONSE_SCHEMA = {
  name: 'india_post_assistant_response',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      headline: { type: 'string' },
      urgency: { type: 'string', enum: ['emergency', 'priority', 'standard'] },
      topicTags: {
        type: 'array',
        items: { type: 'string' },
      },
      whatThisPostAppearsToDescribe: { type: 'string' },
      whyItMayMatterInIndia: { type: 'string' },
      possibleLegalRoutes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            whyItMayApply: { type: 'string' },
            caution: { type: 'string' },
          },
          required: ['title', 'whyItMayApply', 'caution'],
        },
      },
      immediateNextSteps: {
        type: 'array',
        items: { type: 'string' },
      },
      evidenceChecklist: {
        type: 'array',
        items: { type: 'string' },
      },
      officialReportingOptions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            authority: { type: 'string' },
            reason: { type: 'string' },
            phone: { type: ['string', 'null'] },
            url: { type: ['string', 'null'] },
            note: { type: 'string' },
          },
          required: ['authority', 'reason', 'phone', 'url', 'note'],
        },
      },
      questionsToAskLawyerOrAuthority: {
        type: 'array',
        items: { type: 'string' },
      },
      safetyNote: { type: ['string', 'null'] },
      disclaimer: { type: 'string' },
    },
    required: [
      'headline',
      'urgency',
      'topicTags',
      'whatThisPostAppearsToDescribe',
      'whyItMayMatterInIndia',
      'possibleLegalRoutes',
      'immediateNextSteps',
      'evidenceChecklist',
      'officialReportingOptions',
      'questionsToAskLawyerOrAuthority',
      'safetyNote',
      'disclaimer',
    ],
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeStateCode(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

function normalizeDistrict(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeList(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function formatTopicLabels(topics: string[]): string[] {
  return topics.map((topic) => TOPIC_LABELS[topic] ?? topic.replace(/_/g, ' '));
}

function pickTopUniqueResources(resources: ResourceRow[]): AssistantReportingOption[] {
  const seen = new Set<string>();
  const items: AssistantReportingOption[] = [];

  for (const resource of resources.sort((a, b) => a.priority - b.priority)) {
    const key = `${resource.authority_name}|${resource.url ?? ''}|${resource.phone ?? ''}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push({
      authority: resource.authority_name,
      reason: resource.applicability_note,
      phone: resource.phone,
      url: resource.url,
      note: `Official source: ${resource.official_source_url}`,
    });
  }

  return items.slice(0, 5);
}

function pickTopLegalRoutes(laws: LawRow[]): AssistantLegalRoute[] {
  const seen = new Set<string>();
  const items: AssistantLegalRoute[] = [];

  for (const law of laws) {
    const key = `${law.act_name}|${law.source_url}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push({
      title: law.act_name,
      whyItMayApply: law.summary,
      caution: law.caution_note,
    });
  }

  return items.slice(0, 4);
}

function inferTopics(post: PostRow): { topics: string[]; urgency: AssistantUrgency; safetyNote: string | null } {
  const haystack = `${post.content} ${post.location ?? ''}`.toLowerCase();
  const topics = new Set<string>(['evidence_preservation']);

  const hasEmergencyWords = /\b(kill|murder|weapon|attack|bleeding|kidnap|abduct|rape|molest|fire|urgent|immediate danger|life threat|threat to life)\b/.test(haystack);
  const hasCyberWords = /\b(cyber|online|upi|otp|bank|wallet|phishing|scam|telegram|whatsapp|instagram|facebook|email|account hacked|fake app)\b/.test(haystack);
  const hasCorruptionWords = /\b(bribe|bribery|corruption|kickback|tender fraud|public servant|officer demanded money)\b/.test(haystack);
  const hasWomenSafetyWords = /\b(domestic violence|dowry|husband|wife|in-laws|stalking|sexual harassment|rape|molest|assault against woman)\b/.test(haystack);
  const hasChildWords = /\b(child|minor|underage|school student|kid|girl aged|boy aged|juvenile)\b/.test(haystack);
  const hasWorkplaceWords = /\b(workplace|office|boss|manager|colleague|employee|employer|company)\b/.test(haystack) && /\b(harassment|sexual harassment|hostile|inappropriate)\b/.test(haystack);
  const hasPoliceWords = /\b(fir|police refused|refused to register|no fir|station refused|complaint not taken)\b/.test(haystack);
  const hasPropertyWords = /\b(property|plot|land|sale deed|registry|forged document|forgery|fake papers|mutation|encroachment)\b/.test(haystack);
  const hasPublicInfoWords = /\b(rti|right to information|information request|official records|public records)\b/.test(haystack);

  switch (post.category) {
    case 'fraud':
      topics.add('property_or_document_fraud');
      break;
    case 'violence':
      topics.add('violence_and_threat');
      break;
    case 'corruption':
      topics.add('corruption_public_official');
      break;
    case 'governance':
      topics.add('public_service_grievance');
      break;
    case 'safety':
      topics.add('violence_and_threat');
      topics.add('civic_infrastructure_and_local_body_issue');
      break;
    case 'healthcare':
      topics.add('public_service_grievance');
      break;
    case 'infrastructure':
      topics.add('civic_infrastructure_and_local_body_issue');
      topics.add('public_service_grievance');
      break;
    default:
      topics.add('public_service_grievance');
      break;
  }

  if (hasCyberWords) {
    topics.add('cyber_fraud_and_online_abuse');
  }

  if (hasCorruptionWords) {
    topics.add('corruption_public_official');
  }

  if (hasWomenSafetyWords) {
    topics.add('women_safety_and_domestic_violence');
  }

  if (hasChildWords) {
    topics.add('child_safety');
  }

  if (hasWorkplaceWords) {
    topics.add('workplace_harassment');
  }

  if (hasPoliceWords) {
    topics.add('police_inaction_or_refusal_to_register');
  }

  if (hasPropertyWords) {
    topics.add('property_or_document_fraud');
  }

  if (hasPublicInfoWords) {
    topics.add('public_information_access');
  }

  let urgency: AssistantUrgency = 'standard';
  let safetyNote: string | null = null;

  if (hasEmergencyWords || (post.category === 'violence' && (post.severity === 'high' || post.severity === 'critical'))) {
    urgency = 'emergency';
    safetyNote = 'If anyone may be in immediate danger, contact 112 right away before focusing on documentation or complaint drafting.';
  } else if (
    post.severity === 'high' ||
    post.severity === 'critical' ||
    topics.has('cyber_fraud_and_online_abuse') ||
    topics.has('women_safety_and_domestic_violence') ||
    topics.has('child_safety')
  ) {
    urgency = 'priority';
    safetyNote = 'This looks time-sensitive. Preserve records early and use the relevant official route without waiting too long.';
  }

  const orderedTopics = Array.from(topics).sort(
    (left, right) => TOPIC_ORDER.indexOf(left) - TOPIC_ORDER.indexOf(right),
  );

  return {
    topics: orderedTopics,
    urgency,
    safetyNote,
  };
}

function buildPostSummary(post: PostRow): string {
  const timingParts = [post.incident_date, post.incident_time].filter(Boolean);
  const timing = timingParts.length > 0 ? ` The report mentions the incident timing as ${timingParts.join(' ')}.` : '';
  const location = post.location ? ` The post refers to ${post.location}.` : '';
  return `The post is an unverified report about ${post.category.replace(/_/g, ' ')} with ${post.severity} severity.${location}${timing} It says: ${post.content}`;
}

function buildDeterministicFallback(args: {
  post: PostRow;
  stateCode: string;
  district: string | null;
  topics: string[];
  urgency: AssistantUrgency;
  safetyNote: string | null;
  resources: ResourceRow[];
  laws: LawRow[];
}): AssistantPayload {
  const { post, stateCode, district, topics, urgency, safetyNote, resources, laws } = args;
  const topicLabels = formatTopicLabels(topics);
  const stateDescriptor = district ? `${district}, ${stateCode}` : stateCode;
  const officialReportingOptions = pickTopUniqueResources(resources);
  const legalRoutes = pickTopLegalRoutes(laws);

  const immediateNextSteps = normalizeList([
    urgency === 'emergency' ? 'If anyone is in immediate danger, call 112 first and focus on safety before documentation.' : '',
    topics.includes('cyber_fraud_and_online_abuse')
      ? 'If money, accounts, or digital assets are at risk, report quickly through 1930 or cybercrime.gov.in and keep transaction references handy.'
      : '',
    topics.includes('women_safety_and_domestic_violence')
      ? 'If the situation involves violence against a woman, consider using 181 or a One Stop Centre for support alongside any police complaint.'
      : '',
    topics.includes('child_safety')
      ? 'If a child may be unsafe, use 1098 promptly and avoid delaying protection while collecting more details.'
      : '',
    'Write a short fact timeline with dates, time, location, people involved, and what happened before and after the incident.',
    'Keep communication factual and avoid confronting the other side in a way that could escalate risk or compromise evidence.',
  ]).slice(0, 5);

  const evidenceChecklist = normalizeList([
    'Keep original screenshots, messages, call logs, emails, photos, videos, and documents without editing them.',
    'Save dates, times, transaction IDs, complaint numbers, and names or designations of officials or witnesses.',
    topics.includes('property_or_document_fraud')
      ? 'Preserve sale deeds, agreements, notices, registry records, receipts, mutation papers, and any disputed document copies.'
      : '',
    topics.includes('cyber_fraud_and_online_abuse')
      ? 'Preserve bank SMS alerts, UPI references, app screenshots, URLs, handles, wallet details, and device screenshots.'
      : '',
    'Back up records in a safe place and, where possible, preserve originals along with copies for later use.',
  ]).slice(0, 5);

  const questionsToAskLawyerOrAuthority = normalizeList([
    'What is the best first official step in this situation in my state, and what documents should I carry?',
    'Should this be treated mainly as a criminal complaint, a service grievance, a women or child protection matter, or a documentation issue first?',
    'Which facts still need to be recorded clearly before I approach the authority?',
    topics.includes('police_inaction_or_refusal_to_register')
      ? 'If the police station does not register or act, what documented escalation route should I use next?'
      : '',
    topics.includes('workplace_harassment')
      ? 'Should I approach the Internal Committee or Local Committee first, and what written record should accompany the complaint?'
      : '',
  ]).slice(0, 5);

  return {
    headline: `India guidance for this ${post.category.replace(/_/g, ' ')} report`,
    urgency,
    topicTags: topicLabels.slice(0, 4),
    whatThisPostAppearsToDescribe: buildPostSummary(post),
    whyItMayMatterInIndia: `For ${stateDescriptor}, this report may involve ${topicLabels.join(', ')}. The safest first step is usually to preserve evidence, choose the correct official route, and avoid treating an allegation as a proved legal conclusion without review.`,
    possibleLegalRoutes: legalRoutes,
    immediateNextSteps,
    evidenceChecklist,
    officialReportingOptions,
    questionsToAskLawyerOrAuthority,
    safetyNote,
    disclaimer:
      'This is informational guidance for India only. It is not legal advice, does not create a lawyer-client relationship, and does not treat this unverified allegation as a proven fact.',
  };
}

async function sha256Text(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function callOpenAI(args: {
  post: PostRow;
  stateCode: string;
  district: string | null;
  topics: string[];
  urgency: AssistantUrgency;
  safetyNote: string | null;
  resources: ResourceRow[];
  laws: LawRow[];
}): Promise<AssistantPayload> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const { post, stateCode, district, topics, urgency, safetyNote, resources, laws } = args;
  const topicLabels = formatTopicLabels(topics);
  const userPrompt = [
    'You are producing grounded, neutral, India-only informational guidance for an unverified civic report.',
    'Only refer to laws and official reporting routes that appear in the provided grounding data.',
    'Do not cite section numbers that are not explicitly provided.',
    'Do not state guilt as a fact.',
    'Prefer evidence preservation, safety, and official reporting routes over dramatic legal conclusions.',
    '',
    `STATE_CODE: ${stateCode}`,
    `DISTRICT: ${district ?? 'Not provided'}`,
    `URGENCY_HINT: ${urgency}`,
    `SAFETY_NOTE_HINT: ${safetyNote ?? 'None'}`,
    `INFERRED_TOPICS: ${JSON.stringify(topicLabels)}`,
    '',
    `POST: ${JSON.stringify({
      anonymousId: post.anonymous_id,
      category: post.category,
      severity: post.severity,
      location: post.location,
      incidentDate: post.incident_date,
      incidentTime: post.incident_time,
      status: post.status,
      evidenceType: post.evidence_type,
      content: post.content,
    })}`,
    '',
    `GROUNDED_RESOURCES: ${JSON.stringify(resources)}`,
    `GROUNDED_LAWS: ${JSON.stringify(laws)}`,
    '',
    'Write concise, plain-English output that a user in India can act on immediately.',
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are CivicVoice India Assistant. Provide neutral, grounded, India-only informational guidance for unverified user reports. Never hallucinate laws or authorities. Use only the provided law and route grounding. Emphasize safety, evidence preservation, and official complaint paths. Avoid definitive legal conclusions.',
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const message = payload?.choices?.[0]?.message;

  if (message?.refusal) {
    throw new Error(`OpenAI refused the request: ${message.refusal}`);
  }

  const content = message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenAI returned no structured assistant content.');
  }

  return JSON.parse(content) as AssistantPayload;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Supabase environment variables are incomplete.' }, 500);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const body = (await request.json()) as AssistantRequestBody;
    const postId = body.postId?.trim();
    const stateCode = normalizeStateCode(body.stateCode);
    const district = normalizeDistrict(body.district);

    if (!postId || !stateCode) {
      return jsonResponse({ error: 'postId and stateCode are required.' }, 400);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: postData, error: postError } = await serviceClient
      .from('posts')
      .select('id, anonymous_id, content, category, severity, evidence_type, location, incident_date, incident_time, created_at, comment_count, report_count, status')
      .eq('id', postId)
      .maybeSingle();

    if (postError) {
      throw postError;
    }

    const post = postData as PostRow | null;

    if (!post) {
      return jsonResponse({ error: 'Post not found.' }, 404);
    }

    const { topics, urgency, safetyNote } = inferTopics(post);

    const [{ data: resources, error: resourcesError }, { data: laws, error: lawsError }] = await Promise.all([
      serviceClient
        .from('india_assistant_resources')
        .select('topic_key, authority_name, route_type, phone, url, applicability_note, priority, official_source_url')
        .in('topic_key', topics)
        .eq('active', true)
        .order('priority', { ascending: true }),
      serviceClient
        .from('india_assistant_laws')
        .select('topic_key, act_name, summary, caution_note, source_url')
        .in('topic_key', topics)
        .eq('active', true),
    ]);

    if (resourcesError) {
      throw resourcesError;
    }

    if (lawsError) {
      throw lawsError;
    }

    const runtimeModeKey = OPENAI_API_KEY ? OPENAI_MODEL : 'deterministic-fallback';
    const postSnapshotHash = await sha256Text(
      JSON.stringify({
        id: post.id,
        content: post.content,
        category: post.category,
        severity: post.severity,
        location: post.location,
        incidentDate: post.incident_date,
        incidentTime: post.incident_time,
        evidenceType: post.evidence_type,
        status: post.status,
      }),
    );
    const inputHash = await sha256Text(
      JSON.stringify({
        postId: post.id,
        stateCode,
        district,
        promptVersion: PROMPT_VERSION,
        mode: runtimeModeKey,
        postSnapshotHash,
      }),
    );

    const { data: cachedRunData } = await serviceClient
      .from('assistant_runs')
      .select('assistant_payload')
      .eq('input_hash', inputHash)
      .maybeSingle();

    const cachedRun = cachedRunData as { assistant_payload: AssistantPayload } | null;

    if (cachedRun?.assistant_payload) {
      return jsonResponse(cachedRun.assistant_payload);
    }

    let assistantPayload: AssistantPayload;
    let modelUsed = 'deterministic-fallback';

    try {
      assistantPayload = await callOpenAI({
        post,
        stateCode,
        district,
        topics,
        urgency,
        safetyNote,
        resources: resources ?? [],
        laws: laws ?? [],
      });
      modelUsed = OPENAI_MODEL;
    } catch (error) {
      console.error('Falling back to deterministic assistant response:', error);
      assistantPayload = buildDeterministicFallback({
        post,
        stateCode,
        district,
        topics,
        urgency,
        safetyNote,
        resources: resources ?? [],
        laws: laws ?? [],
      });
    }

    await serviceClient
      .from('assistant_runs')
      .upsert(
        {
          post_id: post.id,
          requester_user_id: user.id,
          state_code: stateCode,
          district,
          prompt_version: PROMPT_VERSION,
          post_snapshot_hash: postSnapshotHash,
          input_hash: inputHash,
          model: modelUsed,
          assistant_payload: assistantPayload,
        },
        {
          onConflict: 'input_hash',
        },
      );

    return jsonResponse(assistantPayload);
  } catch (error) {
    console.error('post-assistant function failed:', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unexpected assistant failure.',
      },
      500,
    );
  }
});
