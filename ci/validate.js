import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import Ajv from 'ajv';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, 'workflow-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const repoRoot = path.resolve(__dirname, '..');
const workflowsDir = path.join(repoRoot, 'workflows');

const problems = [];

function visit(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      visit(fullPath);
    } else if (entry.isFile() && entry.name === 'workflow.json') {
      lintWorkflow(fullPath);
    }
  }
}

function lintWorkflow(filePath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    problems.push({ filePath, message: `Invalid JSON: ${err.message}` });
    return;
  }
  const valid = validate(data);
  if (!valid) {
    const message = validate.errors?.map((err) => `${err.instancePath || '(root)'} ${err.message}`).join('; ');
    problems.push({ filePath, message });
  }
  if (typeof data.active === 'boolean' && data.active) {
    problems.push({ filePath, message: 'Workflow marked as active=true. Consider committing workflows in an inactive state.' });
  }
}

if (fs.existsSync(workflowsDir)) {
  visit(workflowsDir);
}

if (problems.length > 0) {
  console.error('[validate] Found workflow issues:');
  for (const problem of problems) {
    console.error(` - ${problem.filePath}: ${problem.message}`);
  }
  process.exit(1);
}

console.log('[validate] All workflow JSON files passed validation');
