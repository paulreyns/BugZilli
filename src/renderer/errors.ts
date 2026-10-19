export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong.";
  return error.message.replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
}
