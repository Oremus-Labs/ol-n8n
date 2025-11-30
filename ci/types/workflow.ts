import type { ITag, WorkflowDataCreate } from '@n8n/rest-api-client';
import type { IConnections, INode, IPinData, IWorkflowSettings } from 'n8n-workflow';

interface WorkflowMetadata {
  onboardingId?: string;
  templateId?: string;
  instanceId?: string;
  templateCredsSetupCompleted?: boolean;
}

interface WorkflowImportShape {
  id?: string;
  name?: string;
  description?: string | null;
  nodes?: INode[];
  connections?: IConnections;
  settings?: IWorkflowSettings;
  active?: boolean;
  tags?: (ITag | string)[];
  pinData?: IPinData;
  versionId?: string;
  activeVersionId?: string | null;
  meta?: WorkflowMetadata;
  parentFolderId?: string;
  uiContext?: string;
  projectId?: string;
}

export type WorkflowImport = WorkflowImportShape & {
  nodes: INode[];
  connections: IConnections;
};

type _WorkflowCompatCheck = WorkflowImport extends WorkflowDataCreate ? true : never;
