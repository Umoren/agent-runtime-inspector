export function cloudTraceFailureMessage(error: unknown): string {
  const code = getGrpcStatusCode(error);

  switch (code) {
    case 3:
      return "Cloud Trace rejected the request as invalid (INVALID_ARGUMENT).";
    case 5:
      return "Cloud Trace could not find the project (NOT_FOUND). Check GOOGLE_CLOUD_PROJECT.";
    case 7:
      return "Cloud Trace denied the write (PERMISSION_DENIED). Check that the Application Default Credentials account has the Cloud Trace Agent role and that the Cloud Trace API is enabled.";
    case 8:
      return "Cloud Trace quota was exceeded (RESOURCE_EXHAUSTED).";
    case 9:
      return "Cloud Trace could not accept the request (FAILED_PRECONDITION). Check the project and API setup.";
    case 14:
      return "Cloud Trace is unavailable (UNAVAILABLE). Try again later.";
    case 16:
      return "Cloud Trace did not accept the credentials (UNAUTHENTICATED). Check Application Default Credentials.";
    default:
      return "Cloud Trace export failed. The provider returned an unrecognized status.";
  }
}

function getGrpcStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "number") {
    return undefined;
  }

  return error.code;
}
