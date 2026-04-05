-- India-only post assistant grounding tables and run cache.

create table if not exists public.india_assistant_resources (
  id uuid primary key default gen_random_uuid(),
  topic_key text not null,
  authority_name text not null,
  route_type text not null,
  phone text,
  url text,
  applicability_note text not null,
  priority integer not null default 100,
  official_source_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.india_assistant_laws (
  id uuid primary key default gen_random_uuid(),
  topic_key text not null,
  act_name text not null,
  summary text not null,
  caution_note text not null,
  source_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  state_code text not null,
  district text,
  prompt_version integer not null default 1,
  post_snapshot_hash text not null,
  input_hash text not null,
  model text not null,
  assistant_payload jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_india_assistant_resources_unique
on public.india_assistant_resources (topic_key, authority_name, official_source_url);

create unique index if not exists idx_india_assistant_laws_unique
on public.india_assistant_laws (topic_key, act_name, source_url);

create unique index if not exists idx_assistant_runs_input_hash
on public.assistant_runs (input_hash);

create index if not exists idx_assistant_runs_post_id_created_at
on public.assistant_runs (post_id, created_at desc);

create index if not exists idx_assistant_runs_requester_user_id
on public.assistant_runs (requester_user_id, created_at desc);

alter table public.india_assistant_resources enable row level security;
alter table public.india_assistant_laws enable row level security;
alter table public.assistant_runs enable row level security;

drop policy if exists "Anyone can read India assistant resources" on public.india_assistant_resources;
create policy "Anyone can read India assistant resources"
on public.india_assistant_resources
for select
to anon, authenticated
using (active);

drop policy if exists "Anyone can read India assistant laws" on public.india_assistant_laws;
create policy "Anyone can read India assistant laws"
on public.india_assistant_laws
for select
to anon, authenticated
using (active);

drop policy if exists "Users can view their own assistant runs" on public.assistant_runs;
create policy "Users can view their own assistant runs"
on public.assistant_runs
for select
to authenticated
using (requester_user_id = auth.uid());

insert into public.india_assistant_resources (
  topic_key,
  authority_name,
  route_type,
  phone,
  url,
  applicability_note,
  priority,
  official_source_url
)
values
  (
    'violence_and_threat',
    'Emergency Response Support System (ERSS)',
    'emergency',
    '112',
    'https://www.112.gov.in/whentouse',
    'Use when anyone may be in immediate danger or needs police, fire, or medical emergency response.',
    1,
    'https://www.112.gov.in/whentouse'
  ),
  (
    'cyber_fraud_and_online_abuse',
    'Indian Cyber Crime Reporting Portal',
    'cyber_portal',
    '1930',
    'https://cybercrime.gov.in/',
    'Use quickly for cyber fraud, impersonation, phishing, UPI or banking scams, online extortion, and other online abuse.',
    1,
    'https://i4c.mha.gov.in/tau.aspx'
  ),
  (
    'women_safety_and_domestic_violence',
    'Women Helpline / Mission Shakti',
    'women_support',
    '181',
    'https://missionshakti.wcd.gov.in/contact',
    'Use for women in distress, domestic violence support, and referral to government assistance systems.',
    1,
    'https://missionshakti.wcd.gov.in/contact'
  ),
  (
    'women_safety_and_domestic_violence',
    'One Stop Centre (Sakhi)',
    'women_support',
    null,
    'https://missionshakti.wcd.gov.in/statisticsOsc',
    'One Stop Centres provide integrated support for women affected by violence, including police assistance, medical aid, legal aid, counselling, and temporary shelter.',
    2,
    'https://missionshakti.wcd.gov.in/statisticsOsc'
  ),
  (
    'women_safety_and_domestic_violence',
    'National Commission for Women complaint portal',
    'commission',
    null,
    'https://ncwapps.nic.in/onlinecomplaintsv2/frminstructions.aspx',
    'Use for complaint filing and follow-up in many women-related matters where commission support or escalation may be helpful.',
    3,
    'https://ncwapps.nic.in/onlinecomplaintsv2/frminstructions.aspx'
  ),
  (
    'workplace_harassment',
    'National Commission for Women complaint portal',
    'commission',
    null,
    'https://ncwapps.nic.in/onlinecomplaintsv2/frminstructions.aspx',
    'Workplace sexual harassment complaints may also require the Internal Committee or Local Committee route under workplace-harassment law, but the NCW portal can still be a support and escalation path.',
    3,
    'https://ncwapps.nic.in/onlinecomplaintsv2/frminstructions.aspx'
  ),
  (
    'child_safety',
    'Child Helpline',
    'child_support',
    '1098',
    'https://www.spniwcd.wcd.gov.in/child-helpline',
    'Use when a child may be unsafe, abused, missing, exploited, or otherwise needs immediate protection.',
    1,
    'https://www.spniwcd.wcd.gov.in/child-helpline'
  ),
  (
    'public_service_grievance',
    'CPGRAMS',
    'grievance_portal',
    null,
    'https://pgportal.gov.in/',
    'Use for public grievances against many government departments and service delivery failures. Check portal scope before filing.',
    2,
    'https://darpg.gov.in/en'
  ),
  (
    'civic_infrastructure_and_local_body_issue',
    'CPGRAMS',
    'grievance_portal',
    null,
    'https://pgportal.gov.in/',
    'Use after documenting complaints to the relevant local authority where applicable, especially if a department is unresponsive.',
    3,
    'https://darpg.gov.in/en'
  ),
  (
    'public_information_access',
    'RTI Online',
    'rti_portal',
    null,
    'https://rtionline.gov.in/',
    'Use for information requests under the RTI Act to central ministries, departments, and other listed central public authorities.',
    2,
    'https://rtionline.gov.in/faq.php'
  ),
  (
    'corruption_public_official',
    'Central Vigilance Commission complaint portal',
    'vigilance_portal',
    null,
    'https://portal.cvc.gov.in/login?loginType=complainant',
    'Use where the complaint appears to fall within CVC jurisdiction, especially corruption involving covered central public servants.',
    2,
    'https://portal.cvc.gov.in/login?loginType=complainant'
  ),
  (
    'police_inaction_or_refusal_to_register',
    'National Legal Services Authority helpline',
    'legal_aid',
    '15100',
    'https://nalsa.gov.in/promoting-inclusive-legal-system/',
    'If police action is delayed or disputed, legal aid can help you understand documentation, escalation, and procedural options.',
    2,
    'https://nalsa.gov.in/promoting-inclusive-legal-system/'
  ),
  (
    'evidence_preservation',
    'National Legal Services Authority helpline',
    'legal_aid',
    '15100',
    'https://nalsa.gov.in/promoting-inclusive-legal-system/',
    'Use if you need help preserving evidence, understanding legal-aid eligibility, or planning the next formal step safely.',
    3,
    'https://nalsa.gov.in/promoting-inclusive-legal-system/'
  ),
  (
    'property_or_document_fraud',
    'National Legal Services Authority helpline',
    'legal_aid',
    '15100',
    'https://nalsa.gov.in/promoting-inclusive-legal-system/',
    'Use if the case involves property, documents, or fraud and you need help understanding the correct forum or record-keeping steps.',
    3,
    'https://nalsa.gov.in/promoting-inclusive-legal-system/'
  )
on conflict do nothing;

insert into public.india_assistant_laws (
  topic_key,
  act_name,
  summary,
  caution_note,
  source_url
)
values
  (
    'violence_and_threat',
    'Bharatiya Nyaya Sanhita, 2023',
    'This may matter where the allegation involves assault, criminal intimidation, hurt, wrongful restraint, or offences affecting public safety.',
    'The assistant should not treat allegations as proved or infer exact offences without legal review.',
    'https://www.indiacode.nic.in/handle/123456789/20062?view_type=browse'
  ),
  (
    'women_safety_and_domestic_violence',
    'Protection of Women from Domestic Violence Act, 2005',
    'This may matter where the allegation involves domestic violence or abuse within a domestic relationship and the person may need protection, residence, custody, or monetary relief.',
    'Relief depends on facts, the relationship involved, and the forum approached. Immediate safety planning may matter more than labels.',
    'https://www.indiacode.nic.in/handle/123456789/12904?view_type=browse'
  ),
  (
    'workplace_harassment',
    'Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013',
    'This may matter where the allegation concerns workplace sexual harassment and complaint handling through an Internal Committee or Local Committee.',
    'This is not a substitute for institution-specific procedure, documentary evidence, or legal advice.',
    'https://www.indiacode.nic.in/handle/123456789/18898'
  ),
  (
    'child_safety',
    'Protection of Children from Sexual Offences Act, 2012',
    'This may matter where a child may have faced sexual assault, sexual harassment, or pornography-related abuse and child protection reporting becomes important.',
    'Where a child may be at risk, immediate protection and child-welfare reporting should come before detailed legal analysis.',
    'https://www.indiacode.nic.in/handle/123456789/2079?locale=en'
  ),
  (
    'cyber_fraud_and_online_abuse',
    'Information Technology Act, 2000',
    'This may matter where allegations involve online impersonation, hacking-related conduct, electronic records, cyber abuse, or digital wrongdoing alongside general criminal law.',
    'Cyber-fraud cases are time-sensitive. Portal and banking-response timelines can matter, so early reporting is important.',
    'https://www.indiacode.nic.in/handle/123456789/1999?locale=en'
  ),
  (
    'corruption_public_official',
    'Prevention of Corruption Act, 1988',
    'This may matter where the allegation involves bribery or corrupt conduct by a covered public servant.',
    'Jurisdiction and proof standards matter. The correct authority depends on whether the official falls within central or state complaint mechanisms.',
    'https://www.indiacode.nic.in/handle/123456789/1558?locale=en'
  ),
  (
    'police_inaction_or_refusal_to_register',
    'Bharatiya Nagarik Suraksha Sanhita, 2023',
    'Procedural law may matter where a complainant needs to understand reporting, investigation, and next procedural steps when police response is delayed or disputed.',
    'Procedural options depend heavily on facts and forum, so legal-aid support may still be useful.',
    'https://www.indiacode.nic.in/handle/123456789/20099?locale=en'
  ),
  (
    'evidence_preservation',
    'Bharatiya Sakshya Adhiniyam, 2023',
    'Evidence law may matter when preserving records, digital messages, screenshots, documents, audio, video, or other material that may later need to be relied on.',
    'Preserving chronology, originality, and metadata can matter. Avoid editing or overwriting source material when possible.',
    'https://www.indiacode.nic.in/handle/123456789/21070'
  ),
  (
    'property_or_document_fraud',
    'Bharatiya Nyaya Sanhita, 2023',
    'This may matter where the allegation involves cheating, forged documents, dishonest inducement, or fraudulent property dealings.',
    'Exact offences depend on documents, timing, and intent, so the assistant should stay neutral and evidence-focused.',
    'https://www.indiacode.nic.in/handle/123456789/20062?view_type=browse'
  ),
  (
    'public_information_access',
    'Right to Information Act, 2005',
    'This may matter where the core problem is getting official records or information from a public authority rather than reporting a criminal offence.',
    'RTI is for access to information, not a substitute for emergency reporting or criminal complaint filing.',
    'https://www.indiacode.nic.in/handle/123456789/21578?view_type=browse'
  )
on conflict do nothing;
