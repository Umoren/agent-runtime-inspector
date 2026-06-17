"use server";

import { revalidatePath } from "next/cache";
import { envValue } from "../src/lib/env";

export async function clearLocalTracesAction(): Promise<void> {
  const collectorUrl = envValue("ARI_COLLECTOR_URL") ?? "http://localhost:4319";

  await fetch(`${collectorUrl}/events`, {
    method: "DELETE",
    cache: "no-store"
  });

  revalidatePath("/");
}
