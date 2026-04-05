import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')?.trim();
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';

interface ChatRequestBody {
  postId?: string;
  stateCode?: string;
  district?: string;
  messages: { role: string; content: string }[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: 'OpenAI API key not configured' }, 500);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Supabase environment variables are incomplete.' }, 500);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const body = (await request.json()) as ChatRequestBody;
    const postId = body.postId?.trim();
    const stateCode = body.stateCode?.trim().toUpperCase() || '';
    const district = body.district?.trim() || '';
    const messages = body.messages || [];

    if (!postId) {
      return jsonResponse({ error: 'postId is required.' }, 400);
    }

    if (!messages || messages.length === 0) {
      return jsonResponse({ error: 'messages are required.' }, 400);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: postData, error: postError } = await serviceClient
      .from('posts')
      .select('category, severity, location, content')
      .eq('id', postId)
      .maybeSingle();

    if (postError || !postData) {
      return jsonResponse({ error: 'Post not found.' }, 404);
    }

    const systemPrompt = `You are CivicVoice India Assistant. Provide neutral, grounded, India-only informational guidance for unverified user reports.
Never hallucinate laws or authorities. Emphasize safety, evidence preservation, and official complaint paths. Avoid definitive legal conclusions.
You are helping the user with further questions regarding this post.
Post context: Category: ${postData.category}, Severity: ${postData.severity}, Content: "${postData.content}"
Location Context: ${stateCode} ${district ? `, ${district}` : ''}
Keep your responses helpful, concise, and focused on Indian law or practical steps. Break down complex steps simply.`;

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      console.error('OpenAI Error:', openAiResponse.status, errorText);
      return jsonResponse({ error: `OpenAI API Error: ${openAiResponse.status} ${errorText}` }, 500);
    }

    // Return the Response stream back to the client directly
    return new Response(openAiResponse.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });

  } catch (error) {
    console.error('post-assistant-chat function failed:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected assistant failure.' },
      500,
    );
  }
});
