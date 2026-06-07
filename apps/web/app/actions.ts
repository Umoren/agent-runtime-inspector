"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadMockTrace } from "../src/lib/collector";

export async function loadMockRunAction(): Promise<void> {
  const result = await loadMockTrace();

  revalidatePath("/");
  redirect(`/runs/${result.runId}`);
}
