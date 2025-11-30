import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import glob from 'glob';
import Ajv from 'ajv';

const require = createRequire(import.meta.url);
const { N8nApiClient } = require('./vendor/n8n-mcp/dist/services/n8n-api-client.js');
const { N8nApiError, N8nNotFoundError } = require('./vendor/n8n-mcp/dist/utils/n8n-errors.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { N8N_API_URL, N8N_API_KEY, N8N_PUSH_REF } = process.env;

if (!N8N_API_URL) {
  console.error('[import_all] N8N_API_URL is required');
  process.exit(1);
}

if (!N8N_API_KEY) {
  console.error('[import_all] N8N_API_KEY is required');
  process.exit(1);
}

const apiBaseUrl = `${N8N_API_URL.replace(/\/$/, '')}`;
const pushRef = N8N_PUSH_REF && N8N_PUSH_REF.length > 0 ? N8N_PUSH_REF : 'git-sync';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';
const apiClient = new N8nApiClient({ baseUrl: apiBaseUrl, apiKey: N8N_API_KEY, pushRef });

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
    if (error instanceof N8nApiError) {
      console.error(`Status: ${error.statusCode ?? 'unknown'} Code: ${error.code ?? 'n/a'} Message: ${error.message}`);
      if (error.details) {
        console.error(JSON.stringify(error.details));
      }
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
      if (hasId) {
        try {
          await apiClient.updateWorkflow(workflow.id, workflow);
          console.log(`[import_all] PUT /workflows/${workflow.id} (${workflowName})`);
        } catch (error) {
          if (error instanceof N8nNotFoundError) {
            console.warn(`[import_all] Workflow id ${workflow.id} not found, creating new (${workflowName})`);
            await apiClient.createWorkflow(workflow);
            console.log(`[import_all] POST /workflows (${workflowName})`);
          } else {
            throw error;
          }
        }
      } else {
        await apiClient.createWorkflow(workflow);
        console.log(`[import_all] POST /workflows (${workflowName})`);
      }
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
