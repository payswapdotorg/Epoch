// Provider-neutrality evidence (acceptance criterion: interfaces remain
// provider-neutral). The SOFTWARE blocklist pins the architecture-lock
// rule 13 plus the DP1.0 pack discipline: no field, type, vocabulary
// entry, or emitted view may name a vendor, brand, product, marketplace,
// cloud, devops tool, issue tracker or API surface. The pack owns NO UI:
// no view-layer imports exist.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  projectBacklog,
  projectDeploymentPlan,
  projectRoadmap,
  renderDeployProposal,
  softwareDeployProposalTemplates,
  softwarePackProfile,
  softwareVocabularyBundle,
  softwareWorkTemplates,
} from '../src/index';
import {
  checkoutChain,
  deployProposalParams,
  environmentAssignments,
  workItemIndex,
} from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

const AURUM_BLOCKLIST = ['aurum', 'aurumchat', 'aurum-chat'];

const VENDOR_BLOCKLIST = [
  // Software-industry clouds, platforms and devops vendors/products.
  'aws',
  'amazon-web-services',
  'azure',
  'gcp',
  'google-cloud',
  'github',
  'gitlab',
  'bitbucket',
  'jira',
  'linear-app',
  'asana',
  'trello',
  'azure-devops',
  'jenkins',
  'circleci',
  'teamcity',
  'docker',
  'kubernetes',
  'k8s',
  'helm',
  'terraform',
  'ansible',
  'puppet',
  'chef-io',
  'heroku',
  'vercel',
  'netlify',
  'pagerduty',
  'datadog',
  'grafana',
  'splunk',
  'newrelic',
  'sentry',
  'sonarqube',
  'nexus',
  'artifactory',
  'npm-registry',
  'pypi',
  'rubygems',
  // General software/ERP/payment/AI vendors.
  'sap',
  'oracle',
  'microsoft-project',
  'msproject',
  'stripe',
  'paypal',
  'braintree',
  'adyen',
  'klarna',
  'razorpay',
  'worldpay',
  'mollie',
  'openai',
  'anthropic',
  'bedrock',
];

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full));
    } else if (/\.(ts|mts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('NAMED: provider-vocabulary-rejected (source scan)', () => {
  it('no src file mentions a provider name', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no src file mentions Aurum (the reference adapter is never a prerequisite)', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of AURUM_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no src file imports a view/UI framework (the pack owns NO UI)', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      const imports = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!);
      for (const specifier of imports) {
        expect(
          /^(react|react-dom|next|@epoch\/experience-|@epoch\/renderer-|@epoch\/ai-experience)/.test(
            specifier,
          ),
          `${file} imports UI framework "${specifier}"`,
        ).toBe(false);
      }
    }
  });
});

describe('NAMED: provider-vocabulary-rejected (emitted data scan)', () => {
  it('the profile, vocabulary bundle, templates and views carry no vendor tokens', () => {
    const chain = checkoutChain();
    const roadmap = projectRoadmap(chain.program);
    const backlog = projectBacklog({
      program: chain.program,
      delivery: chain.delivery,
      workItemIndex: workItemIndex(),
    });
    const plan = projectDeploymentPlan({
      program: chain.program,
      assignments: environmentAssignments(),
    });
    if (!roadmap.ok || !backlog.ok || !plan.ok) {
      throw new Error('fixture projections failed');
    }
    const releaseRollout = softwareDeployProposalTemplates().find(
      (template) => template.templateId === 'software.deploy.template.release-rollout',
    )!;
    const rendered = renderDeployProposal(releaseRollout, deployProposalParams());
    if (!rendered.ok) {
      throw new Error('fixture deploy proposal failed to render');
    }
    const renderedData = [
      softwarePackProfile('tenant:globex'),
      softwareVocabularyBundle(),
      ...softwareWorkTemplates(),
      ...softwareDeployProposalTemplates(),
      roadmap.value,
      backlog.value,
      plan.value,
      rendered.value,
    ];
    for (const content of renderedData) {
      // Digest fields are opaque 64-char hex; scrub them so coincidental
      // hex substrings cannot fake a vendor hit (scan only semantic text).
      const semantic = JSON.stringify(content)
        .replace(/"[0-9a-f]{64}"/g, '"digest"')
        .toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...AURUM_BLOCKLIST]) {
        expect(semantic.includes(token), `rendered pack data contains "${token}"`).toBe(false);
      }
    }
  });
});
