export type ToolCallProvenance = {
  permissionSnapshotId: string;
  contextDecisionId: string;
  authorizationDecisionId?: string;
  authorizationRule?: string;
};
