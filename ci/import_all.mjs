import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import glob from 'glob';
import Ajv from 'ajv';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveModuleRoot() {
  const explicit = process.env.N8N_IMPORTER_MODULES;
  const candidates = [
    explicit,
    path.resolve(__dirname, '../node_modules'),
    path.resolve(__dirname, 'node_modules'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[candidates.length - 1];
}

const moduleRoot = resolveModuleRoot();
const restClientPath = path.join(moduleRoot, '@n8n/rest-api-client/dist/index.cjs');
const { request } = require(restClientPath);

const { N8N_API_URL, N8N_API_KEY, N8N_PUSH_REF } = process.env;

if (!N8N_API_URL) {
  console.error('[import_all] N8N_API_URL is required');
  process.exit(1);
}

if (!N8N_API_KEY) {
  console.error('[import_all] N8N_API_KEY is required');
  process.exit(1);
}

const baseUrl = `${N8N_API_URL.replace(/\/$/, '')}/api/v1`;
const context = {
  baseUrl,
  pushRef: N8N_PUSH_REF && N8N_PUSH_REF.length > 0 ? N8N_PUSH_REF : 'git-sync',
};

const validatorPromise = (async () => {
  const schemaPath = new URL('./workflow-schema.json', import.meta.url);
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  return ajv.compile(schema);
})();

function resolveWorkflowsDir() {
  const argDir = process.argv[2];
  const envDir = process.env.WORKFLOWS_DIR;
  const fallback = path.resolve(process.cwd(), 'workflows');
  const target = argDir ?? envDir ?? fallback;
  return path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
}

function sanitizeWorkflowObject(workflow, { isUpdate }) {
  const clone = JSON.parse(JSON.stringify(workflow));
  const readOnlyFields = [
    'versionId',
    'activeVersionId',
    'updatedAt',
    'createdAt',
    'staticData',
    'triggerCount',
    'versionCounter',
    'isArchived',
    'ownerId',
    'meta',
  ];
  for (const field of readOnlyFields) {
    if (field in clone) {
      delete clone[field];
    }
  }
  if (!isUpdate && clone.id) {
    delete clone.id;
  }
  if ('active' in clone) {
    delete clone.active;
  }
  if ('pinData' in clone) {
    delete clone.pinData;
  }
  if (!clone.settings || typeof clone.settings !== 'object') {
    clone.settings = {};
  }
  return clone;
}

async function main() {
  const workflowsRoot = resolveWorkflowsDir();
  const globbed = glob.sync('**/workflow.json', {
    cwd: workflowsRoot,
    nodir: true,
  });
  const workflowFiles = globbed.map((file) => path.join(workflowsRoot, file));
  const validateWorkflow = await validatorPromise;

  if (workflowFiles.length === 0) {
    console.log(`[import_all] No workflow.json files found under ${workflowsRoot}`);
    return;
  }

  let failures = 0;

  const logFailure = (file, error) => {
    failures += 1;
    const relativePath = path.relative(workflowsRoot, file) || file;
    console.error(`[import_all] Failed to import ${relativePath}`);
    if (error?.response?.data) {
      console.error(JSON.stringify(error.response.data));
    } else if (error?.stack) {
      console.error(error.stack);
    } else {
      console.error(error);
    }
  };

  for (const file of workflowFiles) {
    try {
      const raw = await readFile(file, 'utf8');
      const workflow = JSON.parse(raw);
      const isValid = validateWorkflow(workflow);
      if (!isValid) {
        const validationErrors = validateWorkflow.errors?.map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ');
        throw new Error(`Schema validation failed: ${validationErrors ?? 'Unknown error'}`);
      }
      const workflowName = workflow.name ?? path.basename(path.dirname(file));
      const hasId = typeof workflow.id === 'string' && workflow.id.trim() !== '';
      const sanitized = sanitizeWorkflowObject(workflow, { isUpdate: hasId });
      const endpoint = hasId ? `/workflows/${workflow.id}` : '/workflows';
      const method = hasId ? 'PUT' : 'POST';

      await request({
        method,
        baseURL: context.baseUrl,
        endpoint,
        headers: {
          'push-ref': context.pushRef,
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json',
        },
        data: sanitized,
      });
      console.log(`[import_all] ${method} ${endpoint} (${workflowName})`);
    } catch (error) {
      logFailure(file, error);
    }
  }

  if (failures > 0) {
    console.error(`[import_all] Completed with ${failures} failure(s)`);
    process.exit(1);
  }

  console.log(`[import_all] Successfully imported ${workflowFiles.length} workflow(s)`);
}

main().catch((error) => {
  console.error('[import_all] Unexpected failure');
  console.error(error);
  process.exit(1);
});
