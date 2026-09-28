/**
 * @epoch/deploy-model — provider-neutrality enforcement (lock rule 13:
 * "Provider-specific behavior is adapterized").
 *
 * The topology model is deliberately provider-NEUTRAL: no cloud vendor,
 * orchestrator, container runtime, registry or infrastructure tool appears
 * anywhere in ids, names, paths, commands or free text. Real providers are
 * future ADAPTERS behind the topology model (the W029 pattern). This module
 * is the active enforcement: a closed blocklist of provider vocabulary
 * tokens, and a deterministic scanner over whole records (keys AND string
 * values, token-boundary matched, case-insensitive). Every admission path
 * in this tree runs the scan and surfaces hits as the typed
 * `provider-vocabulary-rejected` error — the same quarantine discipline as
 * the W029 per-adapter provider directory, applied to deployment.
 *
 * The blocklist names INFRASTRUCTURE PROVIDERS and provider-scoped
 * vocabulary, not neutral engineering words: 'service', 'build', 'image'
 * (medical/inspection senses), 'region' (geography) remain legal. Tokens
 * are matched on word boundaries so 's3' inside 's3kr3t'-style collisions
 * cannot occur, and 'aws' inside 'lawson' never matches.
 */

/** Provider vocabulary tokens rejected everywhere in deploy records. */
export const PROVIDER_VOCABULARY_TOKENS: readonly string[] = [
  // Cloud vendors + their provider-scoped resource vocabulary.
  'aws',
  'azure',
  'gcp',
  'gce',
  'ec2',
  's3',
  'lambda',
  'cloudformation',
  'eks',
  'gke',
  'aks',
  'blobstore',
  'azuredevops',
  // Container/orchestration/registry tooling (adapter territory, not model).
  'docker',
  'kubernetes',
  'k8s',
  'helm',
  'terraform',
  'ansible',
  'puppet',
  'chef',
  'containerd',
  'podman',
  'openshift',
  'rancher',
  // PaaS/FaaS hosting vendors.
  'heroku',
  'vercel',
  'netlify',
  'flyio',
  'digitalocean',
  'linode',
  'openstack',
  'cloudflare',
  'rackspace',
  // Provider address forms (value-level patterns).
  'arn',
];

/** Provider-scoped VALUE patterns (prefix forms like `arn:`, `oci://`). */
export const PROVIDER_VALUE_PREFIXES: readonly string[] = ['arn:', 'oci://', 'docker://', 'ghcr.io/', 'registry.'];

const TOKEN_SET = new Set(PROVIDER_VOCABULARY_TOKENS.map((token) => token.toLowerCase()));

/**
 * Tokenize an identifier-ish string on non-alphanumeric AND camelCase
 * boundaries (case preserved — callers lowercase the tokens): `awsRegion`
 * -> ['aws','Region']; `aws-region` -> ['aws','region'];
 * `KUBERNETES_NAMESPACE` -> ['KUBERNETES','NAMESPACE'].
 */
function tokenize(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter((token) => token.length > 0);
}

/** Does this string value carry provider vocabulary? Returns the first hit. */
export function providerTokenInValue(value: string): string | null {
  const lowered = value.toLowerCase();
  for (const prefix of PROVIDER_VALUE_PREFIXES) {
    if (lowered.startsWith(prefix)) return prefix;
  }
  for (const token of tokenize(value)) {
    if (TOKEN_SET.has(token.toLowerCase())) return token.toLowerCase();
  }
  return null;
}

/** Does this record KEY carry provider vocabulary? Returns the first hit. */
export function providerTokenInKey(key: string): string | null {
  for (const token of tokenize(key)) {
    if (TOKEN_SET.has(token.toLowerCase())) return token.toLowerCase();
  }
  return null;
}

export interface NeutralityFinding {
  readonly path: string;
  readonly token: string;
  readonly excerpt: string;
}

/**
 * Deterministic provider-vocabulary scan over an arbitrary record tree:
 * object KEYS and STRING VALUES are token-boundary matched against the
 * blocklist. Findings are sorted by path (stable); an empty list means the
 * record is provider-neutral. Numbers/booleans/null carry no vocabulary.
 */
export function scanProviderVocabulary(value: unknown, path = '$'): readonly NeutralityFinding[] {
  const findings: NeutralityFinding[] = [];
  const walk = (node: unknown, at: string): void => {
    if (node === null || typeof node !== 'object') {
      if (typeof node === 'string') {
        const token = providerTokenInValue(node);
        if (token !== null) findings.push({ path: at, token, excerpt: node.slice(0, 64) });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((element, index) => walk(element, `${at}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      const keyToken = providerTokenInKey(key);
      if (keyToken !== null) {
        findings.push({ path: `${at}.${key}`, token: keyToken, excerpt: `<key> ${key}` });
      }
      walk(child, `${at}.${key}`);
    }
  };
  walk(value, path);
  findings.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return findings;
}

/** Render findings into one deterministic message. */
export function renderNeutralityFindings(findings: readonly NeutralityFinding[]): string {
  return findings
    .map((finding) => `${finding.path}: provider token "${finding.token}" (${finding.excerpt})`)
    .join('; ');
}
